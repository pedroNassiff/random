"""
Análisis de entropía en señales EEG.
Mide el grado de orden/caos en la actividad cerebral.
"""

import numpy as np
from scipy.stats import entropy as shannon_entropy
from scipy import signal
from typing import List


class EntropyAnalyzer:
    """
    Calcula diferentes medidas de entropía en EEG.
    
    Alta entropía = Caos, desorden, muchas frecuencias dispersas
    Baja entropía = Orden, coherencia, frecuencias dominantes
    """
    
    @staticmethod
    def compute_spectral_entropy(eeg_signal: np.ndarray, fs: int = 256) -> float:
        """
        Entropía de Shannon del espectro de potencia.
        
        Interpretación sintérgica:
        - Entropía baja: Estado unificado, pocas frecuencias dominantes (meditación)
        - Entropía alta: Estado disperso, muchas frecuencias (pensamiento caótico)
        
        Args:
            eeg_signal: Señal EEG
            fs: Frecuencia de muestreo
            
        Returns:
            float: Entropía normalizada en [0, 1]
        """
        # Calcular PSD
        freqs, psd = signal.welch(eeg_signal, fs=fs, nperseg=min(256, len(eeg_signal)))
        
        # Filtrar solo frecuencias relevantes (0.5-50 Hz)
        valid_idx = np.logical_and(freqs >= 0.5, freqs <= 50.0)
        psd_valid = psd[valid_idx]
        
        # Normalizar a distribución de probabilidad
        psd_norm = psd_valid / np.sum(psd_valid)
        
        # Shannon entropy
        H = shannon_entropy(psd_norm)
        
        # Normalizar a [0, 1]
        # Máxima entropía posible = log(N) donde N = número de bins
        max_entropy = np.log(len(psd_norm))
        normalized_entropy = H / max_entropy if max_entropy > 0 else 0.5
        
        return float(np.clip(normalized_entropy, 0.0, 1.0))
    
    @staticmethod
    def compute_sample_entropy(eeg_signal: np.ndarray, m: int = 2, r: float = 0.2) -> float:
        """
        Sample Entropy - mide complejidad/regularidad de la señal.
        
        Más robusto que entropía espectral para señales cortas.
        
        Args:
            eeg_signal: Señal EEG
            m: Longitud de patrones a comparar (default: 2)
            r: Tolerancia como fracción de std (default: 0.2)
            
        Returns:
            float: Sample entropy (valores más bajos = más regular)
        """
        N = len(eeg_signal)
        
        if N < 10 * m:
            # Señal muy corta
            return 0.5
        
        # Calcular tolerancia
        r_abs = r * np.std(eeg_signal)
        
        def _maxdist(x_i, x_j):
            """Distancia de Chebyshev"""
            return max([abs(ua - va) for ua, va in zip(x_i, x_j)])
        
        def _phi(m):
            """Función auxiliar para cálculo"""
            x = np.array([eeg_signal[i:i + m] for i in range(N - m + 1)])
            C = np.zeros(len(x))
            
            for i in range(len(x)):
                for j in range(len(x)):
                    if i != j and _maxdist(x[i], x[j]) <= r_abs:
                        C[i] += 1
            
            C = C / (N - m - 1)
            return np.sum(np.log(C[C > 0])) / (N - m)
        
        try:
            return float(abs(_phi(m + 1) - _phi(m)))
        except:
            return 0.5  # Fallback en caso de error
    
    @staticmethod
    def compute_entropy_from_variance(variance: float) -> float:
        """
        Estimación rápida de entropía basada en varianza del espacio latente.
        
        Este es el método actual usado en el VAE.
        Lo mantenemos como fallback rápido.
        
        Args:
            variance: Varianza promedio del espacio latente
            
        Returns:
            float: Entropía estimada en [0, 1]
        """
        # Alta varianza = alta entropía
        # Normalizar usando función logística
        entropy = 1.0 - (1.0 / (1.0 + variance))
        return float(np.clip(entropy, 0.0, 1.0))
