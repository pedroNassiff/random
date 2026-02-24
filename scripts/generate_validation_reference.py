#!/usr/bin/env python3
"""
Genera tabla de referencia para validar lo que muestra el frontend.

Replica EXACTAMENTE el pipeline del backend para cada segundo del primer
minuto de sub-001_meditation.edf, produciendo reference_data.json.

Pipeline replicado (de inference.py → _process_eeg_window):
  EDF 79ch @1024Hz
    → crop 64 canales
    → resample 1024→160Hz
    → crop 161 samples (1s)
    → avg canales → señal 1D
    → Welch PSD → bandas normalizadas
    → bandas_display (f_centre/bandwidth)
    → PLV pairwise por hemisfierio (8 pares)
    → get_state_from_bands

Salida: src/pages/analisis-datasets/reference_data.json
"""

import sys
import os
import json

# Agregar el backend al path para importar SpectralAnalyzer y CoherenceAnalyzer
BACKEND_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                             'teoria-sintergica', 'brain-prototype', 'backend')
sys.path.insert(0, BACKEND_PATH)

import numpy as np
import mne
from scipy import signal as scipy_signal
from analysis.spectral import SpectralAnalyzer
from analysis.coherence import CoherenceAnalyzer

# ── Configuración ─────────────────────────────────────────────────────────────
EDF_PATH = os.path.join(BACKEND_PATH, 'data', 'meditation', 'sub-001_meditation.edf')
TARGET_CHANNELS  = 64    # El backend usa 64 canales
TARGET_FS        = 160   # El backend trabaja a 160Hz (VAE entrenado con esto)
TARGET_TIMEPOINTS = 161  # 1 segundo a 160Hz (161 pts para coincidir con n_channels * n_timepoints = 10304)
STEP_SECONDS     = 1.0   # Un punto de referencia por segundo
FIRST_MINUTE     = 60.0  # Sólo el primer minuto
N_PAIRS          = 8     # Pares de canales para PLV

OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'src', 'pages', 'analisis-datasets', 'reference_data.json'
)

# ── Cargar EDF ─────────────────────────────────────────────────────────────────
print(f"Loading EDF: {EDF_PATH}")
raw = mne.io.read_raw_edf(EDF_PATH, preload=True, verbose=False)

edf_fs     = int(raw.info['sfreq'])   # 1024Hz
edf_nch    = raw.info['nchan']         # 79 canales
edf_data   = raw.get_data()            # (79, N_samples), en Voltios
print(f"  Duration: {raw.times[-1]:.1f}s  |  Channels: {edf_nch}  |  fs: {edf_fs}Hz")

# Window de 2s en samples originales (mismo que session_player usa)
WINDOW_SAMPLES = int(2.0 * edf_fs)    # 2048 samples

def process_window_at(t_secs: float) -> dict:
    """
    Extrae y procesa la ventana de EEG que el backend mostraría en t_secs.
    Replica inference.py _process_eeg_window exactamente.
    """
    # 1. Extraer ventana de 2s centrada en t_secs
    start_sample = int(t_secs * edf_fs)
    end_sample   = start_sample + WINDOW_SAMPLES
    if end_sample > edf_data.shape[1]:
        end_sample   = edf_data.shape[1]
        start_sample = max(0, end_sample - WINDOW_SAMPLES)

    window = edf_data[:, start_sample:end_sample].copy()  # (79, 2048)

    # 2. Crop / pad a 64 canales
    if window.shape[0] > TARGET_CHANNELS:
        window = window[:TARGET_CHANNELS, :]
    elif window.shape[0] < TARGET_CHANNELS:
        padding = np.zeros((TARGET_CHANNELS - window.shape[0], window.shape[1]))
        window  = np.vstack([window, padding])

    # 3. Resample 1024Hz → 160Hz
    if edf_fs != TARGET_FS:
        new_length = int(window.shape[1] * TARGET_FS / edf_fs)   # ~320
        resampled  = np.zeros((TARGET_CHANNELS, new_length))
        for ch in range(TARGET_CHANNELS):
            resampled[ch] = scipy_signal.resample(window[ch], new_length)
        window = resampled

    # 4. Crop a TARGET_TIMEPOINTS (161)
    if window.shape[1] > TARGET_TIMEPOINTS:
        window = window[:, :TARGET_TIMEPOINTS]
    elif window.shape[1] < TARGET_TIMEPOINTS:
        pad    = np.zeros((TARGET_CHANNELS, TARGET_TIMEPOINTS - window.shape[1]))
        window = np.hstack([window, pad])
    # window: (64, 161)

    # 5. Z-score por canal (el VAE fue entrenado con datos normalizados)
    mean = window.mean(axis=1, keepdims=True)
    std  = window.std(axis=1, keepdims=True) + 1e-8
    window = (window - mean) / std

    # 6. Señal promedio (igual que en inference.py antes del fix, y sigue siendo así)
    signal_main = window.mean(axis=0)  # (161,)

    # 7. Bandas crudas (Welch PSD, igual que SyntergicMetrics.compute_all → SpectralAnalyzer)
    bands         = SpectralAnalyzer.compute_frequency_bands(signal_main, fs=TARGET_FS)
    bands_display = SpectralAnalyzer.compute_frequency_bands_display(signal_main, fs=TARGET_FS)
    state         = SpectralAnalyzer.get_state_from_bands(bands)
    dominant_freq = SpectralAnalyzer.get_dominant_frequency(signal_main, fs=TARGET_FS)

    # 8. PLV pairwise (igual que el override de coherencia en inference.py)
    n_half = TARGET_CHANNELS // 2  # 32
    step   = max(1, n_half // N_PAIRS)   # 4
    plvs   = []
    for i in range(0, n_half, step):
        plv = CoherenceAnalyzer.compute_phase_locking_value(
            window[i],
            window[i + n_half],
            fs=TARGET_FS
        )
        if np.isfinite(plv):
            plvs.append(float(plv))
    coherence = float(np.mean(plvs)) if plvs else 0.5

    return {
        't': round(t_secs, 2),
        'bands': {k: round(float(v), 4) for k, v in bands.items()},
        'bands_display': {k: round(float(v), 4) for k, v in bands_display.items()},
        'coherence': round(coherence, 4),
        'state': state,
        'dominant_freq': round(float(dominant_freq), 2),
        # para debug: cuáles canales se promediaron
        '_window_shape': list(window.shape),
        '_n_plv_pairs': len(plvs),
    }

# ── Generar tabla ─────────────────────────────────────────────────────────────
timestamps = np.arange(0.0, FIRST_MINUTE, STEP_SECONDS)
rows = []

print(f"Processing {len(timestamps)} windows...")
for i, t in enumerate(timestamps):
    row = process_window_at(t)
    rows.append(row)
    if (i + 1) % 10 == 0:
        print(f"  [{i+1}/{len(timestamps)}] t={t:.0f}s  state={row['state']}  "
              f"α={row['bands']['alpha']:.3f}  δ={row['bands']['delta']:.3f}  "
              f"coherence={row['coherence']:.3f}")

# ── Metadata del dataset ───────────────────────────────────────────────────────
output = {
    'meta': {
        'dataset': 'OpenNeuro ds003969 - sub-001 meditación vipassana',
        'file': 'sub-001_meditation.edf',
        'total_duration_s': float(raw.times[-1]),
        'original_fs': edf_fs,
        'original_channels': edf_nch,
        'processing': {
            'target_channels': TARGET_CHANNELS,
            'target_fs': TARGET_FS,
            'target_timepoints': TARGET_TIMEPOINTS,
            'window_s': 2.0,
            'step_s': STEP_SECONDS,
            'zscore_per_channel': True,
            'correction': 'f_centre / bandwidth (NO f^1.5)',
        },
        'column_descriptions': {
            't': 'Tiempo en segundos desde el inicio de la sesión',
            'bands.delta': '[0.5-4Hz] Potencia cruda normalizada (suma 1.0 con todas las bandas)',
            'bands.theta': '[4-8Hz] Potencia cruda normalizada',
            'bands.alpha': '[8-13Hz] Potencia cruda normalizada — clave para meditación',
            'bands.beta':  '[13-30Hz] Potencia cruda normalizada',
            'bands.gamma': '[30-50Hz] Potencia cruda normalizada',
            'bands_display.delta': 'Versión corregida 1/f para UI (f_centre/bandwidth)',
            'bands_display.alpha': 'Alpha corregido — lo que la barra muestra en pantalla',
            'coherence': 'PLV promedio de 8 pares interhemisféricos en banda alpha',
            'state': 'Estado inferido por get_state_from_bands(bands)',
            'dominant_freq': 'Frecuencia con mayor potencia espectral (Hz)',
        },
        'states_legend': {
            'deep_relaxation': 'Delta > 0.55 — descanso muy profundo',
            'meditation': 'Alpha > 0.35 — relajación consciente',
            'deep_meditation': 'Alpha > 0.28 AND Theta > 0.18',
            'relaxed': 'Theta > 0.30 OR Alpha > 0.22',
            'focused': 'Beta > 0.17 OR Gamma > 0.10',
            'transitioning': 'Ninguna banda claramente dominante',
        },
        'generated': '2026-02-21',
    },
    'rows': rows
}

# ── Guardar ───────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\n✓ Reference data saved to: {OUTPUT_PATH}")
print(f"  {len(rows)} rows × 1s step = {FIRST_MINUTE:.0f}s of reference data")
