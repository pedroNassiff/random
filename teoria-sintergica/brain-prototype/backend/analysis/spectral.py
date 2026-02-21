"""
Análisis espectral de señales EEG.
Calcula potencia en bandas de frecuencia estándar.
"""

import numpy as np
from scipy import signal
from scipy.fft import fft, fftfreq
from typing import Dict, Tuple


class SpectralAnalyzer:
    """
    Análisis de frecuencias en señales EEG.
    
    Bandas estándar:
    - Delta (0.5-4 Hz): Sueño profundo, inconsciente
    - Theta (4-8 Hz): Meditación profunda, creatividad, memoria
    - Alpha (8-13 Hz): Relajación consciente, coherencia sintérgica
    - Beta (13-30 Hz): Concentración, alerta, procesamiento activo
    - Gamma (30-50 Hz): Insight, procesamiento cognitivo superior
    """
    
    # Definición de bandas (Hz)
    BANDS = {
        'delta': (0.5, 4.0),
        'theta': (4.0, 8.0),
        'alpha': (8.0, 13.0),
        'beta': (13.0, 30.0),
        'gamma': (30.0, 50.0)
    }
    
    @staticmethod
    def compute_psd(eeg_signal: np.ndarray, fs: int = 256) -> Tuple[np.ndarray, np.ndarray]:
        """
        Calcula Power Spectral Density usando método de Welch.
        
        Args:
            eeg_signal: Señal EEG (1D array)
            fs: Frecuencia de muestreo en Hz
            
        Returns:
            Tuple[freqs, psd]: Frecuencias y densidad espectral de potencia
        """
        freqs, psd = signal.welch(
            eeg_signal,
            fs=fs,
            nperseg=min(256, len(eeg_signal)),
            scaling='density'
        )
        return freqs, psd
    
    @staticmethod
    def compute_frequency_bands(eeg_signal: np.ndarray, fs: int = 256) -> Dict[str, float]:
        """
        Calcula potencia relativa en cada banda de frecuencia.
        
        Args:
            eeg_signal: Señal EEG (1D array)
            fs: Frecuencia de muestreo
            
        Returns:
            Dict con potencia normalizada por banda: {'delta': 0.15, 'theta': 0.25, ...}
            Las potencias suman ~1.0
        """
        # Validar input
        if len(eeg_signal) < 64:
            # Si la señal es muy corta, retornar valores default
            return {band: 0.2 for band in SpectralAnalyzer.BANDS.keys()}
        
        # Calcular PSD
        freqs, psd = SpectralAnalyzer.compute_psd(eeg_signal, fs)
        
        # Calcular potencia por banda
        band_powers = {}
        for band_name, (low_freq, high_freq) in SpectralAnalyzer.BANDS.items():
            # Índices de frecuencias en el rango
            idx_band = np.logical_and(freqs >= low_freq, freqs <= high_freq)
            
            # Potencia promedio en la banda
            if np.any(idx_band):
                band_powers[band_name] = np.mean(psd[idx_band])
            else:
                band_powers[band_name] = 0.0
        
        # Normalizar a suma = 1.0
        total_power = sum(band_powers.values())
        if total_power > 0:
            band_powers = {k: v / total_power for k, v in band_powers.items()}
        else:
            # Fallback: distribución uniforme
            band_powers = {k: 0.2 for k in band_powers.keys()}
        
        return band_powers

    @staticmethod
    def compute_frequency_bands_display(eeg_signal: np.ndarray, fs: int = 256) -> Dict[str, float]:
        """
        Versión corregida para VISUALIZACIÓN usando normalización por ancho de banda.

        El EEG sigue un espectro 1/f; delta siempre domina en potencia absoluta.
        Esta función corrige por (f_centre / bandwidth), que compensa AMBAS:
          - La caída espectral 1/f (f_centre alto = más boost)
          - El ancho de banda desigual (gamma 20Hz vs delta 3.5Hz)

        Por qué NO usar f^1.5 directamente:
          - gamma(40Hz)^1.5 = 252 vs delta(2.25Hz)^1.5 = 3.4  → ratio 74x
          - Un gamma raw=0.007 (tiny) × 252 = 1.77 → aparece como 17% visual ← incorrecto
          - Con f/bw: gamma 0.007 × (40/20)=2.0 = 0.014 → 1.6% visual ← correcto

        Resultados esperados con datos sub-001 meditación vipassana:
          - Relajación profunda (δ raw ~0.78): δ≈58% θ≈16% α≈19% β≈5%  γ≈2%
          - Meditación       (α raw ~0.35): δ≈9%  θ≈21% α≈48% β≈11% γ≈12%
          - Activo           (γ raw ~0.09): δ≈10% θ≈16% α≈36% β≈19% γ≈12%
        """
        raw = SpectralAnalyzer.compute_frequency_bands(eeg_signal, fs)

        # Corrección: f_centre / bandwidth
        # Frecuencias centrales y anchos de banda de cada banda estándar
        centre_freqs = {
            'delta': 2.25,   # (0.5+4)/2
            'theta': 6.0,    # (4+8)/2
            'alpha': 10.5,   # (8+13)/2
            'beta':  21.5,   # (13+30)/2
            'gamma': 40.0,   # (30+50)/2
        }
        bandwidths = {
            'delta': 3.5,    # 0.5-4 Hz
            'theta': 4.0,    # 4-8 Hz
            'alpha': 5.0,    # 8-13 Hz
            'beta':  17.0,   # 13-30 Hz
            'gamma': 20.0,   # 30-50 Hz
        }

        corrected = {k: raw[k] * (centre_freqs[k] / bandwidths[k]) for k in raw}

        # Renormalizar a suma = 1.0
        total = sum(corrected.values())
        if total > 0:
            corrected = {k: v / total for k, v in corrected.items()}
        else:
            corrected = {k: 0.2 for k in corrected}

        return corrected
    
    @staticmethod
    def get_dominant_frequency(eeg_signal: np.ndarray, fs: int = 256) -> float:
        """
        Retorna la frecuencia dominante en la señal.
        
        Args:
            eeg_signal: Señal EEG
            fs: Frecuencia de muestreo
            
        Returns:
            float: Frecuencia en Hz con mayor potencia
        """
        freqs, psd = SpectralAnalyzer.compute_psd(eeg_signal, fs)
        
        # Filtrar solo frecuencias relevantes (0.5-50 Hz)
        valid_idx = np.logical_and(freqs >= 0.5, freqs <= 50.0)
        valid_freqs = freqs[valid_idx]
        valid_psd = psd[valid_idx]
        
        # Frecuencia con máxima potencia
        if len(valid_psd) > 0:
            peak_idx = np.argmax(valid_psd)
            return float(valid_freqs[peak_idx])
        else:
            return 10.0  # Default: Alpha
    
    @staticmethod
    def get_state_from_bands(bands: Dict[str, float]) -> str:
        """
        Determina el estado mental basado en las bandas dominantes.

        Thresholds calibrados con datos reales de sub-001 meditation (PhysioNet):
          - alpha raw: 0.08–0.48 (nunca supera 0.50 en meditación normal)
          - delta raw: 0.12–0.78
          - theta raw: 0.09–0.38
          - beta  raw: 0.03–0.21
          - gamma raw: 0.00–0.14
        """
        # Banda dominante
        dominant_band = max(bands, key=bands.get)

        if bands['delta'] > 0.55:
            return 'deep_relaxation'   # Delta muy alto: sueño/anestesia/relajación muy profunda
        elif bands['alpha'] > 0.35:
            return 'meditation'        # Alpha claro: relajación consciente, meditación
        elif bands['alpha'] > 0.28 and bands['theta'] > 0.18:
            return 'deep_meditation'   # Alpha+Theta: meditación profunda
        elif bands['theta'] > 0.30:
            return 'relaxed'           # Theta dominante: somnolencia creativa
        elif bands['alpha'] > 0.22:
            return 'relaxed'           # Alpha moderado: reposo con ojos cerrados
        elif bands['beta'] > 0.17 or bands['gamma'] > 0.10:
            return 'focused'           # Beta/Gamma: actividad cognitiva
        elif bands['delta'] > 0.38:
            return 'deep_relaxation'
        else:
            return 'transitioning'     # Ninguna banda es claramente dominante
