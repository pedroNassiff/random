"""
Módulo de análisis científico de señales EEG.
Implementa métricas sintérgicas validadas.
"""

from .spectral import SpectralAnalyzer
from .coherence import CoherenceAnalyzer
from .entropy import EntropyAnalyzer
from .metrics import SyntergicMetrics

__all__ = [
    'SpectralAnalyzer',
    'CoherenceAnalyzer', 
    'EntropyAnalyzer',
    'SyntergicMetrics'
]
