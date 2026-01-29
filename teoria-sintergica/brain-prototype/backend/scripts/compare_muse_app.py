"""
Comparación: App Muse vs Brain-Prototype

Este script compara los datos de una sesión de meditación grabada con:
1. La app oficial de Muse (exportada como CSV)
2. Nuestro software brain-prototype (PostgreSQL + InfluxDB)

Uso:
1. Hacer meditación de 1 minuto con app Muse
2. Exportar sesión desde la app (Settings > Export Session Data)
3. Hacer meditación de 1 minuto con brain-prototype
4. Ejecutar: python compare_muse_app.py --muse-csv <archivo.csv> --recording-id <id>
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import argparse
import pandas as pd
import numpy as np
from datetime import datetime
import json

def load_muse_csv(csv_path: str) -> dict:
    """
    Carga datos exportados de la app Muse.
    
    La app Muse exporta varios archivos CSV:
    - *_eeg.csv: Datos EEG crudos
    - *_accelerometer.csv: Acelerómetro
    - *_gyroscope.csv: Giroscopio
    - *_horseshoe.csv: Calidad de señal (indicadores de fit)
    - *_brainwaves.csv: Bandas de frecuencia (alpha, beta, etc.)
    
    Returns:
        Dict con DataFrames de cada tipo de dato
    """
    data = {}
    base_path = csv_path.replace('.csv', '')
    
    # Intentar cargar diferentes tipos de archivos
    file_types = ['eeg', 'brainwaves', 'horseshoe', 'accelerometer']
    
    for ftype in file_types:
        # Probar diferentes patrones de nombre
        patterns = [
            f"{base_path}_{ftype}.csv",
            f"{base_path}{ftype}.csv",
            csv_path.replace('.csv', f'_{ftype}.csv'),
        ]
        
        for pattern in patterns:
            if os.path.exists(pattern):
                try:
                    df = pd.read_csv(pattern)
                    data[ftype] = df
                    print(f"✓ Cargado {ftype}: {len(df)} filas")
                except Exception as e:
                    print(f"⚠ Error cargando {pattern}: {e}")
                break
    
    # Si solo se pasó un archivo, intentar cargarlo directamente
    if not data and os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
            # Detectar tipo por columnas
            cols = df.columns.tolist()
            if 'RAW_TP9' in cols or 'TP9' in cols:
                data['eeg'] = df
                print(f"✓ Cargado EEG directo: {len(df)} filas")
            elif 'Alpha_TP9' in cols or 'alpha' in cols.lower():
                data['brainwaves'] = df
                print(f"✓ Cargado brainwaves directo: {len(df)} filas")
        except Exception as e:
            print(f"⚠ Error cargando {csv_path}: {e}")
    
    return data

def load_brain_prototype_data(recording_id: int) -> dict:
    """
    Carga datos de brain-prototype desde PostgreSQL + InfluxDB.
    """
    from database import get_postgres_client_sync, get_influx_client
    
    print(f"\n📊 Cargando datos de brain-prototype (recording #{recording_id})...")
    
    # PostgreSQL: metadata
    postgres = get_postgres_client_sync()
    postgres.connect()
    recording = postgres.get_recording(recording_id)
    
    if not recording:
        raise ValueError(f"Recording {recording_id} no encontrado")
    
    # InfluxDB: samples y métricas
    influx = get_influx_client()
    influx.connect()
    
    samples = influx.get_samples(recording_id, limit=100000)
    metrics = influx.get_metrics(recording_id)
    
    print(f"✓ Recording: {recording.name}")
    print(f"  Duración: {recording.duration_seconds:.1f}s")
    print(f"  Samples: {len(samples)}")
    print(f"  Métricas: {len(metrics)}")
    
    return {
        'recording': recording,
        'samples': samples,
        'metrics': metrics
    }

def analyze_muse_app(data: dict) -> dict:
    """
    Analiza datos de la app Muse y calcula estadísticas.
    """
    stats = {
        'duration_seconds': 0,
        'avg_alpha': None,
        'avg_beta': None,
        'avg_theta': None,
        'avg_gamma': None,
        'avg_delta': None,
        'alpha_range': (0, 0),
        'samples_count': 0
    }
    
    # Si hay datos de brainwaves (bandas ya calculadas)
    if 'brainwaves' in data:
        df = data['brainwaves']
        
        # La app Muse guarda bandas por canal: Alpha_TP9, Alpha_AF7, etc.
        # Vamos a promediar todos los canales
        alpha_cols = [c for c in df.columns if 'alpha' in c.lower()]
        beta_cols = [c for c in df.columns if 'beta' in c.lower()]
        theta_cols = [c for c in df.columns if 'theta' in c.lower()]
        gamma_cols = [c for c in df.columns if 'gamma' in c.lower()]
        delta_cols = [c for c in df.columns if 'delta' in c.lower()]
        
        if alpha_cols:
            alpha_values = df[alpha_cols].mean(axis=1)
            stats['avg_alpha'] = alpha_values.mean()
            stats['alpha_range'] = (alpha_values.min(), alpha_values.max())
        
        if beta_cols:
            stats['avg_beta'] = df[beta_cols].mean().mean()
        if theta_cols:
            stats['avg_theta'] = df[theta_cols].mean().mean()
        if gamma_cols:
            stats['avg_gamma'] = df[gamma_cols].mean().mean()
        if delta_cols:
            stats['avg_delta'] = df[delta_cols].mean().mean()
        
        # Duración basada en timestamps
        if 'TimeStamp' in df.columns or 'timestamp' in df.columns:
            ts_col = 'TimeStamp' if 'TimeStamp' in df.columns else 'timestamp'
            stats['duration_seconds'] = (df[ts_col].max() - df[ts_col].min())
        
        stats['samples_count'] = len(df)
    
    # Si hay datos EEG crudos
    if 'eeg' in data:
        df = data['eeg']
        stats['eeg_samples'] = len(df)
        
        # Calcular alpha desde EEG crudo si no hay brainwaves
        if stats['avg_alpha'] is None:
            # Esto requeriría FFT, lo dejamos para después
            pass
    
    return stats

def analyze_brain_prototype(data: dict) -> dict:
    """
    Analiza datos de brain-prototype y calcula estadísticas.
    """
    metrics = data['metrics']
    recording = data['recording']
    
    if not metrics:
        return {
            'duration_seconds': recording.duration_seconds,
            'avg_alpha': recording.avg_alpha,
            'avg_coherence': recording.avg_coherence,
            'samples_count': len(data['samples']),
            'metrics_count': 0
        }
    
    # Calcular estadísticas de las métricas
    alphas = [m['alpha'] for m in metrics if m.get('alpha') is not None]
    coherences = [m['coherence'] for m in metrics if m.get('coherence') is not None]
    betas = [m['beta'] for m in metrics if m.get('beta') is not None]
    thetas = [m['theta'] for m in metrics if m.get('theta') is not None]
    gammas = [m['gamma'] for m in metrics if m.get('gamma') is not None]
    deltas = [m['delta'] for m in metrics if m.get('delta') is not None]
    
    return {
        'duration_seconds': recording.duration_seconds,
        'avg_alpha': np.mean(alphas) if alphas else None,
        'avg_coherence': np.mean(coherences) if coherences else None,
        'avg_beta': np.mean(betas) if betas else None,
        'avg_theta': np.mean(thetas) if thetas else None,
        'avg_gamma': np.mean(gammas) if gammas else None,
        'avg_delta': np.mean(deltas) if deltas else None,
        'alpha_range': (min(alphas), max(alphas)) if alphas else (0, 0),
        'coherence_range': (min(coherences), max(coherences)) if coherences else (0, 0),
        'samples_count': len(data['samples']),
        'metrics_count': len(metrics)
    }

def compare_sessions(muse_stats: dict, bp_stats: dict):
    """
    Compara estadísticas de ambas sesiones.
    """
    print("\n" + "="*60)
    print("📊 COMPARACIÓN: Muse App vs Brain-Prototype")
    print("="*60)
    
    print(f"\n{'Métrica':<25} {'Muse App':>15} {'Brain-Proto':>15} {'Diferencia':>15}")
    print("-"*70)
    
    # Duración
    muse_dur = muse_stats.get('duration_seconds', 0)
    bp_dur = bp_stats.get('duration_seconds', 0)
    diff_dur = bp_dur - muse_dur if muse_dur and bp_dur else 0
    print(f"{'Duración (s)':<25} {muse_dur:>15.1f} {bp_dur:>15.1f} {diff_dur:>+15.1f}")
    
    # Samples
    muse_samples = muse_stats.get('samples_count', 0)
    bp_samples = bp_stats.get('samples_count', 0)
    print(f"{'Samples EEG':<25} {muse_samples:>15} {bp_samples:>15}")
    
    # Alpha
    muse_alpha = muse_stats.get('avg_alpha')
    bp_alpha = bp_stats.get('avg_alpha')
    if muse_alpha is not None and bp_alpha is not None:
        # Normalizar si es necesario (Muse usa valores absolutos, nosotros relativos)
        diff_alpha = bp_alpha - muse_alpha
        print(f"{'Alpha Promedio':<25} {muse_alpha:>15.4f} {bp_alpha:>15.4f} {diff_alpha:>+15.4f}")
    else:
        print(f"{'Alpha Promedio':<25} {'N/A':>15} {bp_alpha or 'N/A':>15}")
    
    # Beta
    muse_beta = muse_stats.get('avg_beta')
    bp_beta = bp_stats.get('avg_beta')
    if muse_beta is not None and bp_beta is not None:
        diff_beta = bp_beta - muse_beta
        print(f"{'Beta Promedio':<25} {muse_beta:>15.4f} {bp_beta:>15.4f} {diff_beta:>+15.4f}")
    
    # Theta
    muse_theta = muse_stats.get('avg_theta')
    bp_theta = bp_stats.get('avg_theta')
    if muse_theta is not None and bp_theta is not None:
        diff_theta = bp_theta - muse_theta
        print(f"{'Theta Promedio':<25} {muse_theta:>15.4f} {bp_theta:>15.4f} {diff_theta:>+15.4f}")
    
    # Coherencia (solo brain-prototype)
    bp_coh = bp_stats.get('avg_coherence')
    if bp_coh is not None:
        print(f"{'Coherencia (solo BP)':<25} {'N/A':>15} {bp_coh:>15.4f}")
    
    print("-"*70)
    
    # Rangos
    if muse_stats.get('alpha_range') and bp_stats.get('alpha_range'):
        muse_range = muse_stats['alpha_range']
        bp_range = bp_stats['alpha_range']
        print(f"\n{'Rango Alpha:':<25}")
        print(f"  Muse:     [{muse_range[0]:.4f} - {muse_range[1]:.4f}]")
        print(f"  BP:       [{bp_range[0]:.4f} - {bp_range[1]:.4f}]")
    
    # Conclusión
    print("\n" + "="*60)
    print("📝 NOTAS:")
    print("="*60)
    print("""
- La app Muse usa potencia absoluta (µV²), nosotros usamos potencia relativa (0-1)
- La coherencia es una métrica propia de brain-prototype
- Para comparar mejor, deberían normalizarse los valores
- Diferencias < 20% son normales por variación del algoritmo
""")

def main():
    parser = argparse.ArgumentParser(description='Comparar sesiones Muse App vs Brain-Prototype')
    parser.add_argument('--muse-csv', type=str, help='Ruta al CSV exportado de Muse')
    parser.add_argument('--recording-id', type=int, help='ID de la grabación en brain-prototype')
    parser.add_argument('--list-recordings', action='store_true', help='Listar grabaciones disponibles')
    
    args = parser.parse_args()
    
    # Listar grabaciones disponibles
    if args.list_recordings:
        from database import get_postgres_client_sync
        postgres = get_postgres_client_sync()
        postgres.connect()
        recordings = postgres.get_all_recordings()
        
        print("\n📼 Grabaciones disponibles:")
        print("-"*60)
        for r in recordings:
            print(f"  #{r.id}: {r.name} ({r.duration_seconds:.1f}s) - {r.started_at}")
        return
    
    # Modo solo brain-prototype
    if args.recording_id and not args.muse_csv:
        print("\n🧠 Analizando solo datos de brain-prototype...")
        bp_data = load_brain_prototype_data(args.recording_id)
        bp_stats = analyze_brain_prototype(bp_data)
        
        print("\n📊 Estadísticas de la sesión:")
        print("-"*40)
        for key, value in bp_stats.items():
            if value is not None:
                if isinstance(value, float):
                    print(f"  {key}: {value:.4f}")
                else:
                    print(f"  {key}: {value}")
        return
    
    # Comparación completa
    if args.muse_csv and args.recording_id:
        print("\n🔬 Iniciando comparación...")
        
        # Cargar datos de Muse
        print(f"\n📱 Cargando datos de Muse: {args.muse_csv}")
        muse_data = load_muse_csv(args.muse_csv)
        
        if not muse_data:
            print("❌ No se pudieron cargar datos de Muse")
            print("\nAsegúrate de exportar los datos desde la app Muse:")
            print("  Settings > Account > Export Session Data")
            return
        
        muse_stats = analyze_muse_app(muse_data)
        
        # Cargar datos de brain-prototype
        bp_data = load_brain_prototype_data(args.recording_id)
        bp_stats = analyze_brain_prototype(bp_data)
        
        # Comparar
        compare_sessions(muse_stats, bp_stats)
    
    else:
        print("\n📋 INSTRUCCIONES PARA EL EXPERIMENTO:")
        print("="*60)
        print("""
1. SESIÓN CON APP MUSE:
   - Abrir app Muse en el móvil
   - Conectar el Muse 2
   - Hacer meditación guiada de 1 minuto
   - Al terminar, exportar datos:
     Settings > Account > Export Session Data
   - El CSV se enviará por email

2. SESIÓN CON BRAIN-PROTOTYPE:
   - Abrir http://localhost:5173
   - Conectar Muse 2 desde el dashboard
   - Iniciar grabación
   - Meditar 1 minuto (mismo tipo de meditación)
   - Detener grabación
   - Anotar el ID de la grabación

3. COMPARAR:
   python compare_muse_app.py --muse-csv <archivo.csv> --recording-id <id>

Para ver grabaciones disponibles:
   python compare_muse_app.py --list-recordings
        """)

if __name__ == "__main__":
    main()
