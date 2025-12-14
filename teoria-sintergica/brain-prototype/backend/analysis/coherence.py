"""
Análisis de coherencia inter-hemisférica.
Métrica core de la Teoría Sintérgica.
"""

import numpy as np
from scipy import signal
from typing import Tuple


class CoherenceAnalyzer:
    """
    Calcula coherencia entre hemisferios cerebrales.
    
    Alta coherencia = Alta sintergia (hemisferios trabajando unificados)
    Baja coherencia = Baja sintergia (hemisferios desconectados)
    """
    
    @staticmethod
    def compute_coherence(signal1: np.ndarray, 
                         signal2: np.ndarray, 
                         fs: int = 256,
                         freq_band: Tuple[float, float] = (8.0, 13.0)) -> float:
        """
        Calcula coherencia espectral entre dos señales en una banda de frecuencia.
        
        Método: Magnitude Squared Coherence (MSC) de Welch.
        
        Args:
            signal1: Señal hemisferio 1 (ej: promedio canales izquierdos)
            signal2: Señal hemisferio 2 (ej: promedio canales derechos)
            fs: Frecuencia de muestreo
            freq_band: Rango de frecuencias (default: Alpha 8-13 Hz)
            
        Returns:
            float: Coherencia en [0, 1]. 
                   0 = Sin correlación
                   1 = Perfectamente coherentes
        """
        # Validar que las señales tengan la misma longitud
        min_len = min(len(signal1), len(signal2))
        signal1 = signal1[:min_len]
        signal2 = signal2[:min_len]
        
        if min_len < 64:
            # Señal muy corta, retornar valor neutral
            return 0.5
        
        # Calcular coherencia espectral usando Welch
        freqs, Cxy = signal.coherence(
            signal1, 
            signal2, 
            fs=fs,
            nperseg=min(256, min_len)
        )
        
        # Extraer coherencia en la banda de interés
        low_freq, high_freq = freq_band
        idx_band = np.logical_and(freqs >= low_freq, freqs <= high_freq)
        
        if np.any(idx_band):
            # Coherencia promedio en la banda
            coherence_band = np.mean(Cxy[idx_band])
        else:
            coherence_band = 0.5  # Fallback
        
        # Asegurar rango [0, 1]
        return float(np.clip(coherence_band, 0.0, 1.0))
    
    @staticmethod
    def compute_phase_locking_value(signal1: np.ndarray,
                                    signal2: np.ndarray,
                                    fs: int = 256,
                                    freq_band: Tuple[float, float] = (8.0, 13.0)) -> float:
        """
        Calcula Phase Locking Value (PLV) - métrica más sensible que MSC.
        
        PLV mide sincronización de fase entre señales.
        Más adecuado para detectar sintergia momentánea.
        
        Args:
            signal1, signal2: Señales a comparar
            fs: Frecuencia de muestreo
            freq_band: Banda de frecuencias
            
        Returns:
            float: PLV en [0, 1]
        """
        # Filtrar señales en la banda de interés
        low_freq, high_freq = freq_band
        sos = signal.butter(4, [low_freq, high_freq], btype='bandpass', fs=fs, output='sos')
        
        filtered1 = signal.sosfilt(sos, signal1)
        filtered2 = signal.sosfilt(sos, signal2)
        
        # Transformada de Hilbert para obtener fase
        analytic1 = signal.hilbert(filtered1)
        analytic2 = signal.hilbert(filtered2)
        
        phase1 = np.angle(analytic1)
        phase2 = np.angle(analytic2)
        
        # Diferencia de fase
        phase_diff = phase1 - phase2
        
        # PLV: Magnitud del promedio de vectores unitarios de diferencia de fase
        plv = np.abs(np.mean(np.exp(1j * phase_diff)))
        
        return float(plv)
    
    @staticmethod
    def compute_alpha_coherence(left_channels: np.ndarray,
                                right_channels: np.ndarray,
                                fs: int = 256) -> float:
        """
        Coherencia específica en banda Alpha (8-13 Hz).
        Esta es la métrica sintérgica por excelencia.
        
        Args:
            left_channels: Promedio de canales izquierdos (Fp1, F3, C3, P3, O1)
            right_channels: Promedio de canales derechos (Fp2, F4, C4, P4, O2)
            fs: Frecuencia de muestreo
            
        Returns:
            float: Coherencia Alpha [0, 1]
        """
        return CoherenceAnalyzer.compute_coherence(
            left_channels,
            right_channels,
            fs=fs,
            freq_band=(8.0, 13.0)
        )
