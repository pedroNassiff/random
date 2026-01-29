#!/usr/bin/env python3
"""
Script de validación de grabaciones EEG.

Uso:
  1. ANTES de grabar: python validate_recording.py --snapshot
  2. DESPUÉS de grabar: python validate_recording.py --validate <recording_id>
  3. Ver última grabación: python validate_recording.py --last
"""

import sys
import os
import json
import argparse
from datetime import datetime
from statistics import mean, stdev

# Agregar el path del backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_postgres_client_sync, get_influx_client


def get_snapshot():
    """Obtiene snapshot del estado actual de las DBs."""
    postgres = get_postgres_client_sync()
    postgres.connect()
    
    recordings = postgres.get_all_recordings()
    
    snapshot = {
        'timestamp': datetime.now().isoformat(),
        'recording_count': len(recordings),
        'last_recording_id': recordings[0].id if recordings else None,
        'recordings': [
            {
                'id': r.id,
                'name': r.name,
                'sample_count': r.sample_count,
                'metrics_count': r.metrics_count
            }
            for r in recordings[:5]  # Últimas 5
        ]
    }
    
    return snapshot


def validate_recording(recording_id: int, verbose: bool = True):
    """
    Valida una grabación específica comparando PostgreSQL e InfluxDB.
    """
    print(f"\n{'='*60}")
    print(f"📊 VALIDACIÓN DE GRABACIÓN #{recording_id}")
    print(f"{'='*60}\n")
    
    # Conectar a DBs
    postgres = get_postgres_client_sync()
    postgres.connect()
    
    influx = get_influx_client()
    influx.connect()
    
    # 1. Obtener metadata de PostgreSQL
    print("1️⃣  METADATA (PostgreSQL)")
    print("-" * 40)
    
    recording = postgres.get_recording(recording_id)
    if not recording:
        print(f"❌ Recording #{recording_id} no encontrada en PostgreSQL")
        return False
    
    print(f"   Nombre: {recording.name}")
    print(f"   Inicio: {recording.started_at}")
    print(f"   Fin: {recording.ended_at}")
    print(f"   Duración: {recording.duration_seconds:.2f}s")
    print(f"   Samples esperados: {recording.sample_count}")
    print(f"   Metrics esperados: {recording.metrics_count}")
    print(f"   Avg Coherence: {recording.avg_coherence:.4f}" if recording.avg_coherence else "   Avg Coherence: N/A")
    print(f"   Avg Alpha: {recording.avg_alpha:.4f}" if recording.avg_alpha else "   Avg Alpha: N/A")
    print(f"   Peak Coherence: {recording.peak_coherence:.4f}" if recording.peak_coherence else "   Peak Coherence: N/A")
    
    # 2. Verificar samples en InfluxDB
    print(f"\n2️⃣  SAMPLES EEG (InfluxDB)")
    print("-" * 40)
    
    influx_sample_count = influx.get_sample_count(recording_id)
    print(f"   Samples en InfluxDB: {influx_sample_count}")
    print(f"   Samples en PostgreSQL: {recording.sample_count}")
    
    sample_match = influx_sample_count == recording.sample_count
    if sample_match:
        print(f"   ✅ Counts coinciden")
    else:
        diff = abs(influx_sample_count - recording.sample_count)
        print(f"   ⚠️  Diferencia: {diff} samples")
    
    # 3. Obtener samples para análisis
    print(f"\n3️⃣  ANÁLISIS DE SAMPLES")
    print("-" * 40)
    
    samples = influx.get_samples(recording_id, limit=10000)
    if samples:
        # Extraer valores por canal (samples pueden ser dict o objetos)
        def get_val(s, key):
            if isinstance(s, dict):
                return s.get(key)
            return getattr(s, key, None)
        
        tp9_values = [get_val(s, 'tp9') for s in samples if get_val(s, 'tp9') is not None]
        af7_values = [get_val(s, 'af7') for s in samples if get_val(s, 'af7') is not None]
        af8_values = [get_val(s, 'af8') for s in samples if get_val(s, 'af8') is not None]
        tp10_values = [get_val(s, 'tp10') for s in samples if get_val(s, 'tp10') is not None]
        
        print(f"   Samples analizados: {len(samples)}")
        print(f"\n   📈 Estadísticas por canal (µV):")
        
        for name, values in [('TP9', tp9_values), ('AF7', af7_values), 
                             ('AF8', af8_values), ('TP10', tp10_values)]:
            if values:
                avg = mean(values)
                std = stdev(values) if len(values) > 1 else 0
                min_v = min(values)
                max_v = max(values)
                print(f"   {name}: avg={avg:.2f}, std={std:.2f}, range=[{min_v:.2f}, {max_v:.2f}]")
        
        # Verificar rango típico de EEG (-100 a 100 µV)
        all_values = tp9_values + af7_values + af8_values + tp10_values
        if all_values:
            in_range = sum(1 for v in all_values if -200 <= v <= 200) / len(all_values) * 100
            print(f"\n   Valores en rango típico (-200 a 200 µV): {in_range:.1f}%")
            if in_range < 80:
                print(f"   ⚠️  Muchos valores fuera de rango - posibles artefactos")
            else:
                print(f"   ✅ Datos EEG parecen válidos")
    
    # 4. Verificar métricas
    print(f"\n4️⃣  MÉTRICAS CALCULADAS (InfluxDB)")
    print("-" * 40)
    
    try:
        metrics = influx.get_metrics(recording_id)
    except TypeError:
        # Fallback si no acepta limit
        metrics = influx.get_metrics(recording_id)
    
    if metrics:
        def get_metric_val(m, key):
            if isinstance(m, dict):
                return m.get(key)
            return getattr(m, key, None)
        
        coherence_values = [get_metric_val(m, 'coherence') for m in metrics if get_metric_val(m, 'coherence') is not None]
        alpha_values = [get_metric_val(m, 'alpha') for m in metrics if get_metric_val(m, 'alpha') is not None]
        
        print(f"   Métricas encontradas: {len(metrics)}")
        
        if coherence_values:
            calc_avg_coherence = mean(coherence_values)
            calc_peak_coherence = max(coherence_values)
            print(f"\n   Coherencia:")
            print(f"   - Calculada avg: {calc_avg_coherence:.4f}")
            print(f"   - Guardada avg: {recording.avg_coherence:.4f}" if recording.avg_coherence else "   - Guardada: N/A")
            if recording.avg_coherence:
                diff = abs(calc_avg_coherence - recording.avg_coherence)
                if diff < 0.01:
                    print(f"   ✅ Coherencia coincide (diff={diff:.6f})")
                else:
                    print(f"   ⚠️  Diferencia: {diff:.4f}")
        
        if alpha_values:
            calc_avg_alpha = mean(alpha_values)
            print(f"\n   Alpha:")
            print(f"   - Calculada avg: {calc_avg_alpha:.4f}")
            print(f"   - Guardada avg: {recording.avg_alpha:.4f}" if recording.avg_alpha else "   - Guardada: N/A")
    
    # 5. Verificar frecuencia de muestreo
    print(f"\n5️⃣  FRECUENCIA DE MUESTREO")
    print("-" * 40)
    
    if recording.duration_seconds > 0 and influx_sample_count > 0:
        effective_hz = influx_sample_count / recording.duration_seconds
        expected_hz = 256  # Muse 2
        print(f"   Frecuencia efectiva: {effective_hz:.1f} Hz")
        print(f"   Frecuencia esperada: {expected_hz} Hz")
        
        hz_diff_percent = abs(effective_hz - expected_hz) / expected_hz * 100
        if hz_diff_percent < 5:
            print(f"   ✅ Frecuencia dentro del 5% esperado")
        else:
            print(f"   ⚠️  Desviación: {hz_diff_percent:.1f}%")
    
    # 6. Resumen
    print(f"\n{'='*60}")
    print("📋 RESUMEN DE VALIDACIÓN")
    print(f"{'='*60}")
    
    checks = []
    checks.append(("Samples count match", sample_match))
    checks.append(("Data in valid range", in_range >= 80 if 'in_range' in dir() else True))
    checks.append(("Sample rate OK", hz_diff_percent < 10 if 'hz_diff_percent' in dir() else True))
    
    all_passed = all(c[1] for c in checks)
    
    for name, passed in checks:
        status = "✅" if passed else "❌"
        print(f"   {status} {name}")
    
    print(f"\n{'✅ VALIDACIÓN EXITOSA' if all_passed else '⚠️  HAY ADVERTENCIAS'}")
    
    return all_passed


def show_last_recording():
    """Muestra info de la última grabación."""
    postgres = get_postgres_client_sync()
    postgres.connect()
    
    recordings = postgres.get_all_recordings(limit=1)
    if recordings:
        rec = recordings[0]
        print(f"\n📼 Última grabación: #{rec.id} - {rec.name}")
        print(f"   Fecha: {rec.started_at}")
        print(f"   Duración: {rec.duration_seconds:.1f}s")
        print(f"   Samples: {rec.sample_count}")
        return rec.id
    else:
        print("No hay grabaciones")
        return None


def compare_with_ui_data(recording_id: int, ui_data: dict):
    """
    Compara datos de la UI con los guardados.
    
    ui_data debe tener formato:
    {
        "coherence": [0.5, 0.6, ...],
        "alpha": [0.3, 0.4, ...],
        ...
    }
    """
    print(f"\n🔍 Comparando datos de UI con grabación #{recording_id}")
    
    influx = get_influx_client()
    influx.connect()
    
    metrics = influx.get_metrics(recording_id, limit=1000)
    
    if not metrics:
        print("❌ No hay métricas guardadas")
        return
    
    stored_coherence = [m.coherence for m in metrics if m.coherence is not None]
    
    if 'coherence' in ui_data:
        ui_coherence = ui_data['coherence']
        
        # Comparar longitudes
        print(f"   UI data points: {len(ui_coherence)}")
        print(f"   Stored data points: {len(stored_coherence)}")
        
        # Comparar primeros valores
        min_len = min(len(ui_coherence), len(stored_coherence), 10)
        print(f"\n   Primeros {min_len} valores de coherencia:")
        print(f"   {'UI':<12} {'Stored':<12} {'Match':<8}")
        print(f"   {'-'*32}")
        
        for i in range(min_len):
            ui_val = ui_coherence[i]
            stored_val = stored_coherence[i]
            match = "✅" if abs(ui_val - stored_val) < 0.001 else "❌"
            print(f"   {ui_val:<12.4f} {stored_val:<12.4f} {match}")


def main():
    parser = argparse.ArgumentParser(description='Validar grabaciones EEG')
    parser.add_argument('--snapshot', action='store_true', help='Crear snapshot del estado actual')
    parser.add_argument('--validate', type=int, metavar='ID', help='Validar grabación por ID')
    parser.add_argument('--last', action='store_true', help='Validar última grabación')
    parser.add_argument('--compare', type=str, metavar='FILE', help='Comparar con datos de UI (JSON)')
    
    args = parser.parse_args()
    
    if args.snapshot:
        snapshot = get_snapshot()
        print("\n📸 SNAPSHOT DEL ESTADO ACTUAL")
        print("-" * 40)
        print(f"   Timestamp: {snapshot['timestamp']}")
        print(f"   Total grabaciones: {snapshot['recording_count']}")
        print(f"   Última grabación ID: {snapshot['last_recording_id']}")
        
        # Guardar snapshot
        with open('/tmp/recording_snapshot.json', 'w') as f:
            json.dump(snapshot, f, indent=2)
        print(f"\n   Snapshot guardado en /tmp/recording_snapshot.json")
        print("\n   ⏺️  Ahora puedes hacer tu grabación...")
        print("   Luego ejecuta: python validate_recording.py --last")
        
    elif args.validate:
        validate_recording(args.validate)
        
    elif args.last:
        rec_id = show_last_recording()
        if rec_id:
            print("\n¿Validar esta grabación? (presiona Enter)")
            input()
            validate_recording(rec_id)
    
    elif args.compare:
        with open(args.compare) as f:
            ui_data = json.load(f)
        # Obtener última grabación
        rec_id = show_last_recording()
        if rec_id:
            compare_with_ui_data(rec_id, ui_data)
    
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
