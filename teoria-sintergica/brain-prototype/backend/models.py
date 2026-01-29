from pydantic import BaseModel
from typing import List, Optional, Dict
import random
import math

class Vector3(BaseModel):
    x: float
    y: float
    z: float

class FrequencyBands(BaseModel):
    """Potencia relativa en cada banda de frecuencia"""
    delta: float   # 0.5-4 Hz: Sueño profundo
    theta: float   # 4-8 Hz: Meditación profunda
    alpha: float   # 8-13 Hz: Relajación consciente (SINTERGIA)
    beta: float    # 13-30 Hz: Concentración
    gamma: float   # 30-50 Hz: Insight cognitivo

class SyntergicState(BaseModel):
    """
    Representa el estado instantáneo del campo neuronal.
    
    Ahora incluye análisis espectral completo y métricas científicas.
    """
    timestamp: float
    coherence: float  # 0.0 a 1.0 (Coherencia inter-hemisférica Alpha)
    entropy: float    # 0.0 a 1.0 (Entropía espectral)
    
    # Factor de Direccionalidad (Hacia dónde apunta la conciencia)
    focal_point: Vector3 
    
    # Frecuencia dominante
    frequency: float # Hz (ej: 10Hz Alpha, 40Hz Gamma)
    
    # NUEVO: Análisis espectral completo
    bands: Optional[FrequencyBands] = None
    
    # NUEVO: Estado mental inferido
    state: Optional[str] = "neutral"  # 'meditation', 'focused', 'relaxed', etc.
    
    # NUEVO: Phase Locking Value (métrica avanzada)
    plv: Optional[float] = None
    
    # NUEVO: Fuente de datos ('recorded', 'muse2', 'dataset', etc.)
    source: Optional[str] = None
    
    # NUEVO: Progreso de reproducción de sesión
    session_progress: Optional[float] = None
    session_timestamp: Optional[float] = None
    
    @staticmethod
    def simulate_next(t: float):
        """
        Genera un estado simulado basado en el tiempo para pruebas.
        En el futuro esto vendrá de la Neural Network.
        """
        # Simular una "respiración" de coherencia
        coherence = (math.sin(t * 0.5) + 1) / 2 * 0.8 + 0.1
        
        # El punto focal se mueve en un patrón de "ocho" (infinito)
        x = math.sin(t) * 30
        y = math.cos(t * 0.5) * 20 + 20
        z = math.sin(t * 0.3) * 30
        
        return SyntergicState(
            timestamp=t,
            coherence=coherence,
            entropy=1.0 - coherence, # A mayor coherencia, menor entropía
            focal_point=Vector3(x=x, y=y, z=z),
            frequency=10.0 + (coherence * 30.0) # Delta -> Gamma
        )
