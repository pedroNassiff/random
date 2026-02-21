"""
Orquestador de métricas sintérgicas.
Combina todos los análisis en un sistema unificado.
"""

import numpy as np
from typing import Dict, Optional
from .spectral import SpectralAnalyzer
from .coherence import CoherenceAnalyzer
from .entropy import EntropyAnalyzer


class SyntergicMetrics:
    """
    Calcula todas las métricas sintérgicas de una señal EEG.
    
    Esta es la clase principal que usará el backend para análisis completo.
    """
    
    @staticmethod
    def compute_all(eeg_data: Dict[str, np.ndarray], 
                   fs: int = 256) -> Dict[str, any]:
        """
        Calcula métricas sintérgicas completas.
        
        Args:
            eeg_data: Dict con estructura:
                {
                    'signal': np.ndarray,          # Señal principal (1 canal o promedio)
                    'left_hemisphere': np.ndarray,  # Promedio hemisferio izquierdo
                    'right_hemisphere': np.ndarray, # Promedio hemisferio derecho
                    'raw_variance': float           # Varianza del espacio latente VAE (opcional)
                }
            fs: Frecuencia de muestreo
            
        Returns:
            Dict con todas las métricas:
                {
                    'coherence': float,              # Coherencia inter-hemisférica [0, 1]
                    'entropy': float,                # Entropía espectral [0, 1]
                    'bands': dict,                   # Potencia por banda
                    'dominant_frequency': float,     # Frecuencia dominante (Hz)
                    'state': str,                    # Estado mental inferido
                    'plv': float                     # Phase Locking Value (opcional)
                }
        """
        results = {}
        
        # 1. ANÁLISIS ESPECTRAL (siempre se puede calcular)
        signal_main = eeg_data.get('signal')
        if signal_main is not None and len(signal_main) > 0:
            results['bands'] = SpectralAnalyzer.compute_frequency_bands(signal_main, fs)
            # Versión 1/f-corregida para visualización (evita delta siempre al 60%)
            results['bands_display'] = SpectralAnalyzer.compute_frequency_bands_display(signal_main, fs)
            results['dominant_frequency'] = SpectralAnalyzer.get_dominant_frequency(signal_main, fs)
            results['state'] = SpectralAnalyzer.get_state_from_bands(results['bands'])
        else:
            # Fallback: valores default
            results['bands'] = {band: 0.2 for band in SpectralAnalyzer.BANDS.keys()}
            results['bands_display'] = {band: 0.2 for band in SpectralAnalyzer.BANDS.keys()}
            results['dominant_frequency'] = 10.0
            results['state'] = 'neutral'
        
        # 2. COHERENCIA INTER-HEMISFÉRICA (requiere ambos hemisferios)
        left_hemi = eeg_data.get('left_hemisphere')
        right_hemi = eeg_data.get('right_hemisphere')
        
        if left_hemi is not None and right_hemi is not None:
            # Coherencia Alpha (métrica sintérgica principal)
            results['coherence'] = CoherenceAnalyzer.compute_alpha_coherence(
                left_hemi, right_hemi, fs
            )
            
            # PLV (opcional, más sensible)
            try:
                results['plv'] = CoherenceAnalyzer.compute_phase_locking_value(
                    left_hemi, right_hemi, fs
                )
            except:
                results['plv'] = results['coherence']  # Fallback
        else:
            # Fallback: usar varianza del VAE si está disponible
            raw_variance = eeg_data.get('raw_variance')
            if raw_variance is not None:
                results['coherence'] = 1.0 / (1.0 + raw_variance)
            else:
                results['coherence'] = 0.5  # Neutral
            results['plv'] = results['coherence']
        
        # 3. ENTROPÍA (mide orden/caos)
        if signal_main is not None and len(signal_main) > 0:
            results['entropy'] = EntropyAnalyzer.compute_spectral_entropy(signal_main, fs)
        else:
            # Fallback: usar varianza si está disponible
            raw_variance = eeg_data.get('raw_variance')
            if raw_variance is not None:
                results['entropy'] = EntropyAnalyzer.compute_entropy_from_variance(raw_variance)
            else:
                results['entropy'] = 0.5
        
        return results
    
    @staticmethod
    def validate_metrics(metrics: Dict[str, any]) -> bool:
        """
        Valida que las métricas estén en rangos correctos.
        
        Args:
            metrics: Dict retornado por compute_all()
            
        Returns:
            bool: True si todas las métricas son válidas
        """
        # Coherencia en [0, 1]
        if not (0.0 <= metrics.get('coherence', 0.5) <= 1.0):
            return False
        
        # Entropía en [0, 1]
        if not (0.0 <= metrics.get('entropy', 0.5) <= 1.0):
            return False
        
        # Bandas suman ~1.0
        bands = metrics.get('bands', {})
        total_bands = sum(bands.values())
        if not (0.9 <= total_bands <= 1.1):
            return False
        
        # Frecuencia dominante en rango fisiológico
        freq = metrics.get('dominant_frequency', 10.0)
        if not (0.5 <= freq <= 50.0):
            return False
        
        return True
