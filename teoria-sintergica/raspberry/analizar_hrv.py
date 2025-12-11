#!/usr/bin/env python3
"""
Análisis de HRV - Experimento Coherencia Cardíaca
Proyecto: Teoría Sintérgica - Validación Experimental

Procesa datos de IBI (Inter-Beat Interval) y calcula métricas HRV
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal, stats
import seaborn as sns
import sys
import os

sns.set_style("whitegrid")

def calcular_hrv(ibi_data):
    """
    Calcula métricas HRV estándar desde datos IBI
    
    Args:
        ibi_data (array): Intervalos inter-beat en milisegundos
        
    Returns:
        dict: Métricas HRV (SDNN, RMSSD, pNN50, etc.)
    """
    # Filtrar outliers (IBIs fisiológicamente imposibles)
    ibi_clean = ibi_data[(ibi_data > 300) & (ibi_data < 2000)]
    
    if len(ibi_clean) < 10:
        print("⚠️  Advertencia: Muy pocos datos válidos para calcular HRV")
        return None
    
    # --- Métricas en dominio del tiempo ---
    
    # SDNN: Desviación estándar de todos los IBIs
    sdnn = np.std(ibi_clean)
    
    # RMSSD: Raíz cuadrada media de diferencias sucesivas
    diff_ibi = np.diff(ibi_clean)
    rmssd = np.sqrt(np.mean(diff_ibi**2))
    
    # pNN50: % de diferencias sucesivas > 50ms
    pnn50 = 100 * np.sum(np.abs(diff_ibi) > 50) / len(diff_ibi)
    
    # BPM promedio
    mean_ibi = np.mean(ibi_clean)
    mean_bpm = 60000 / mean_ibi
    
    return {
        'SDNN': sdnn,
        'RMSSD': rmssd,
        'pNN50': pnn50,
        'Mean_IBI': mean_ibi,
        'Mean_BPM': mean_bpm,
        'N_beats': len(ibi_clean)
    }

def analizar_sesion(filename, show_plots=True):
    """
    Análisis completo de una sesión experimental
    
    Args:
        filename (str): Path al archivo CSV con datos
        show_plots (bool): Mostrar gráficos
    """
    print(f"\n{'='*60}")
    print(f"ANÁLISIS DE SESIÓN: {os.path.basename(filename)}")
    print(f"{'='*60}\n")
    
    # Cargar datos
    try:
        df = pd.read_csv(filename)
    except Exception as e:
        print(f"❌ Error al cargar archivo: {e}")
        return None
    
    # Validar columnas esperadas
    required_cols = ['timestamp_ms', 'ibi_ms', 'bpm']
    if not all(col in df.columns for col in required_cols):
        print(f"❌ Faltan columnas. Esperadas: {required_cols}")
        return None
    
    # Info básica
    duracion_s = (df['timestamp_ms'].iloc[-1] - df['timestamp_ms'].iloc[0]) / 1000
    duracion_min = duracion_s / 60
    print(f"📊 Duración total: {duracion_min:.1f} minutos ({len(df)} latidos)")
    print(f"📊 Frecuencia promedio: {df['bpm'].mean():.1f} BPM")
    
    # Calcular métricas HRV
    print(f"\n{'─'*60}")
    print("MÉTRICAS HRV (sesión completa)")
    print(f"{'─'*60}")
    
    hrv = calcular_hrv(df['ibi_ms'].values)
    
    if hrv is None:
        return None
    
    for key, val in hrv.items():
        if key == 'N_beats':
            print(f"  {key:15s}: {val}")
        else:
            print(f"  {key:15s}: {val:.2f}")
    
    # Interpretación
    print(f"\n{'─'*60}")
    print("INTERPRETACIÓN")
    print(f"{'─'*60}")
    
    if hrv['SDNN'] < 40:
        print("  SDNN: BAJA - Posible estrés o baja variabilidad")
    elif hrv['SDNN'] < 80:
        print("  SDNN: NORMAL - Variabilidad típica en reposo")
    elif hrv['SDNN'] < 120:
        print("  SDNN: ALTA - Buena coherencia (posible meditación)")
    else:
        print("  SDNN: MUY ALTA - Excelente coherencia")
    
    if hrv['RMSSD'] < 25:
        print("  RMSSD: BAJA - Poca actividad parasimpática")
    elif hrv['RMSSD'] < 50:
        print("  RMSSD: NORMAL")
    else:
        print("  RMSSD: ALTA - Alta actividad parasimpática (relajación)")
    
    # Visualizaciones
    if show_plots:
        crear_visualizaciones(df, hrv, filename)
    
    return hrv

def crear_visualizaciones(df, hrv, filename):
    """Genera gráficos de análisis"""
    
    fig = plt.figure(figsize=(14, 10))
    gs = fig.add_gridspec(3, 2, hspace=0.3, wspace=0.3)
    
    tiempo_min = df['timestamp_ms'] / 1000 / 60
    
    # 1. Serie temporal IBI
    ax1 = fig.add_subplot(gs[0, :])
    ax1.plot(tiempo_min, df['ibi_ms'], linewidth=0.8, color='steelblue', alpha=0.7)
    ax1.fill_between(tiempo_min, df['ibi_ms'], alpha=0.2, color='steelblue')
    ax1.set_xlabel('Tiempo (minutos)', fontsize=11)
    ax1.set_ylabel('IBI (ms)', fontsize=11)
    ax1.set_title('Intervalos Inter-Beat (IBI)', fontsize=13, fontweight='bold')
    ax1.grid(True, alpha=0.3)
    ax1.axhline(df['ibi_ms'].mean(), color='red', linestyle='--', linewidth=1, 
                label=f'Media: {df["ibi_ms"].mean():.0f} ms')
    ax1.legend()
    
    # 2. BPM
    ax2 = fig.add_subplot(gs[1, 0])
    ax2.plot(tiempo_min, df['bpm'], linewidth=0.8, color='crimson', alpha=0.8)
    ax2.fill_between(tiempo_min, df['bpm'], alpha=0.2, color='crimson')
    ax2.set_xlabel('Tiempo (minutos)', fontsize=11)
    ax2.set_ylabel('BPM', fontsize=11)
    ax2.set_title('Frecuencia Cardíaca', fontsize=12, fontweight='bold')
    ax2.grid(True, alpha=0.3)
    ax2.axhline(df['bpm'].mean(), color='darkred', linestyle='--', linewidth=1)
    
    # 3. Distribución IBI (histograma)
    ax3 = fig.add_subplot(gs[1, 1])
    ax3.hist(df['ibi_ms'], bins=40, color='seagreen', alpha=0.7, edgecolor='black')
    ax3.axvline(df['ibi_ms'].mean(), color='red', linestyle='--', linewidth=2, 
                label=f'Media: {df["ibi_ms"].mean():.0f}')
    ax3.axvline(df['ibi_ms'].median(), color='orange', linestyle='--', linewidth=2, 
                label=f'Mediana: {df["ibi_ms"].median():.0f}')
    ax3.set_xlabel('IBI (ms)', fontsize=11)
    ax3.set_ylabel('Frecuencia', fontsize=11)
    ax3.set_title('Distribución de IBI', fontsize=12, fontweight='bold')
    ax3.legend()
    ax3.grid(True, alpha=0.3, axis='y')
    
    # 4. HRV deslizante (ventana móvil)
    ax4 = fig.add_subplot(gs[2, 0])
    window_size = 60  # latidos
    hrv_sliding = []
    times_sliding = []
    
    for i in range(0, len(df) - window_size, 10):
        window = df['ibi_ms'].iloc[i:i+window_size]
        sdnn_window = np.std(window)
        hrv_sliding.append(sdnn_window)
        times_sliding.append(df['timestamp_ms'].iloc[i] / 1000 / 60)
    
    ax4.plot(times_sliding, hrv_sliding, linewidth=1.2, color='forestgreen')
    ax4.fill_between(times_sliding, hrv_sliding, alpha=0.3, color='forestgreen')
    ax4.set_xlabel('Tiempo (minutos)', fontsize=11)
    ax4.set_ylabel('SDNN (ms)', fontsize=11)
    ax4.set_title(f'HRV Deslizante (ventana {window_size} latidos)', 
                  fontsize=12, fontweight='bold')
    ax4.grid(True, alpha=0.3)
    ax4.axhline(np.mean(hrv_sliding), color='darkgreen', linestyle='--', linewidth=1.5,
                label=f'Media: {np.mean(hrv_sliding):.1f}')
    ax4.legend()
    
    # 5. Poincaré plot (SD1 vs SD2)
    ax5 = fig.add_subplot(gs[2, 1])
    ibi_n = df['ibi_ms'].values[:-1]
    ibi_n1 = df['ibi_ms'].values[1:]
    ax5.scatter(ibi_n, ibi_n1, alpha=0.5, s=10, color='purple')
    ax5.plot([ibi_n.min(), ibi_n.max()], [ibi_n.min(), ibi_n.max()], 
             'r--', linewidth=1.5, label='Identidad')
    ax5.set_xlabel('IBI(n) [ms]', fontsize=11)
    ax5.set_ylabel('IBI(n+1) [ms]', fontsize=11)
    ax5.set_title('Poincaré Plot', fontsize=12, fontweight='bold')
    ax5.grid(True, alpha=0.3)
    ax5.legend()
    ax5.set_aspect('equal', adjustable='datalim')
    
    # Texto con métricas
    textstr = '\n'.join([
        'Métricas HRV:',
        f'SDNN: {hrv["SDNN"]:.1f} ms',
        f'RMSSD: {hrv["RMSSD"]:.1f} ms',
        f'pNN50: {hrv["pNN50"]:.1f}%',
        f'BPM: {hrv["Mean_BPM"]:.1f}'
    ])
    
    fig.text(0.02, 0.98, textstr, fontsize=10, verticalalignment='top',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    # Guardar
    output_file = filename.replace('.csv', '_analisis.png')
    plt.savefig(output_file, dpi=150, bbox_inches='tight')
    print(f"\n💾 Gráficos guardados: {output_file}")
    
    plt.show()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 analizar_hrv.py <archivo_datos.csv>")
        print("Ejemplo: python3 analizar_hrv.py datos/sujeto01_20250130.csv")
        sys.exit(1)
    
    archivo = sys.argv[1]
    
    if not os.path.exists(archivo):
        print(f"❌ Archivo no encontrado: {archivo}")
        sys.exit(1)
    
    resultados = analizar_sesion(archivo, show_plots=True)
    
    if resultados:
        print(f"\n✅ Análisis completado exitosamente\n")
