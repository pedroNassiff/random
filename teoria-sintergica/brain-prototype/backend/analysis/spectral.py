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
        
        Args:
            bands: Dict con potencias normalizadas
            
        Returns:
            str: 'deep_meditation', 'meditation', 'relaxed', 'focused', 'alert', 'insight'
        """
        # Encontrar banda dominante
        dominant_band = max(bands, key=bands.get)
        dominant_power = bands[dominant_band]
        
        # Reglas heurísticas basadas en literatura
        if bands['delta'] > 0.4:
            return 'deep_sleep'
        elif bands['theta'] > 0.35 and bands['alpha'] > 0.25:
            return 'deep_meditation'  # Theta + Alpha = Meditación profunda
        elif bands['alpha'] > 0.4:
            return 'meditation'  # Alpha dominante = Relajación consciente
        elif bands['alpha'] > 0.3 and bands['beta'] < 0.25:
            return 'relaxed'  # Alpha alto, Beta bajo
        elif bands['beta'] > 0.35:
            return 'focused'  # Beta dominante = Concentración
        elif bands['gamma'] > 0.2:
            return 'insight'  # Gamma elevado = Procesamiento superior
        else:
            return 'neutral'
