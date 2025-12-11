from pydantic import BaseModel
from typing import List, Optional
import random
import math

class Vector3(BaseModel):
    x: float
    y: float
    z: float

class SyntergicState(BaseModel):
    """
    Representa el estado instantáneo del campo neuronal.
    """
    timestamp: float
    coherence: float  # 0.0 a 1.0 (Nivel de unificación hemisférica)
    entropy: float    # Nivel de desorden/ruido en la percepción
    
    # Factor de Direccionalidad (Hacia dónde apunta la conciencia)
    focal_point: Vector3 
    
    # Estado emocional/vibracional
    frequency: float # Hz (ej: 10Hz Alpha, 40Hz Gamma)
    
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
