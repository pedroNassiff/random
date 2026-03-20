"""
LLM Router — selecciona el modelo según la complejidad de la query.

Usa OpenRouter como backend (OpenAI-compatible REST API, free tier).
Fallback a Anthropic si OPENROUTER_API_KEY no está configurado.
"""

from enum import Enum
from typing import Dict


class QueryComplexity(Enum):
    SIMPLE = "simple"      # 1 lookup  → respuesta directa
    MODERATE = "moderate"  # 2-3 datos → síntesis
    COMPLEX = "complex"    # razonamiento multi-step, predicciones


# Modelos Groq — free tier, rate limit generous, sin créditos
GROQ_MODELS: Dict[QueryComplexity, Dict] = {
    QueryComplexity.SIMPLE: {
        "model": "llama-3.1-8b-instant",
        "max_tokens": 600,
        "display_name": "Llama 3.1 8B (Groq)",
    },
    QueryComplexity.MODERATE: {
        "model": "llama-3.3-70b-versatile",
        "max_tokens": 900,
        "display_name": "Llama 3.3 70B (Groq)",
    },
    QueryComplexity.COMPLEX: {
        "model": "llama-3.3-70b-versatile",
        "max_tokens": 1200,
        "display_name": "Llama 3.3 70B (Groq)",
    },
}

# Modelos OpenRouter — fallback si no hay GROQ_API_KEY
OPENROUTER_MODELS: Dict[QueryComplexity, Dict] = {
    QueryComplexity.SIMPLE: {
        "model": "google/gemini-2.0-flash-001",
        "max_tokens": 600,
        "display_name": "Gemini 2.0 Flash",
    },
    QueryComplexity.MODERATE: {
        "model": "meta-llama/llama-3.3-70b-instruct:free",
        "max_tokens": 900,
        "display_name": "Llama 3.3 70B",
    },
    QueryComplexity.COMPLEX: {
        "model": "google/gemini-2.0-flash-001",
        "max_tokens": 1200,
        "display_name": "Gemini 2.0 Flash",
    },
}

# Keywords que elevan la complejidad
_COMPLEX_KEYWORDS = [
    "predic", "cuándo", "cuando", "alcanzar", "proyect",
    "tendencia", "compara", "vs", "versus", "progres",
    "evolución", "historia", "semana", "mes",
]
_SIMPLE_KEYWORDS = [
    "score", "puntuación", "cómo estuvo", "resumen",
    "última sesión", "ultima sesion", "última grabación",
    "qué tal", "que tal", "duración",
]


class LLMRouter:
    """Selecciona el modelo LLM según la complejidad estimada de la query."""

    def classify(self, message: str) -> QueryComplexity:
        lower = message.lower()
        if any(k in lower for k in _COMPLEX_KEYWORDS):
            return QueryComplexity.COMPLEX
        if any(k in lower for k in _SIMPLE_KEYWORDS):
            return QueryComplexity.SIMPLE
        return QueryComplexity.MODERATE

    def select(self, complexity: QueryComplexity) -> Dict:
        import os
        # Groq tiene prioridad: free tier real, sin créditos
        if os.getenv("GROQ_API_KEY"):
            return {**GROQ_MODELS[complexity], "provider": "groq"}
        return {**OPENROUTER_MODELS[complexity], "provider": "openrouter"}

    def select_fallback(self, complexity: QueryComplexity) -> Dict:
        """Devuelve OpenRouter config para usar tras 429/límite en Groq."""
        return {**OPENROUTER_MODELS[complexity], "provider": "openrouter"}
