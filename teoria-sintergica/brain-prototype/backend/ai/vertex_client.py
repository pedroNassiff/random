"""
ai/vertex_client.py — Cliente Vertex AI nativo para Gemini.

Reemplaza la llamada indirecta a Gemini vía OpenRouter (proxy de terceros)
por una llamada nativa a Vertex AI, usando Application Default Credentials
de la misma service account que ya corre el backend en Cloud Run
(sa-random-backend-runner) — sin ninguna API key nueva.
"""

import os
from typing import Optional

from google import genai
from google.genai import types

_client: Optional[genai.Client] = None


def get_vertex_client() -> genai.Client:
    """
    Cliente Vertex AI singleton. En Cloud Run usa Application Default
    Credentials automáticamente (la identidad de sa-random-backend-runner) —
    no requiere ninguna API key. En local, requiere haber corrido
    `gcloud auth application-default login` una vez.
    """
    global _client
    if _client is None:
        _client = genai.Client(
            vertexai=True,
            project=os.environ["GCP_PROJECT_ID"],
            location=os.environ.get("GCP_VERTEX_LOCATION", "us-central1"),
        )
    return _client


async def call_vertex_gemini(
    prompt: str,
    system_instruction: Optional[str] = None,
    model: str = "gemini-2.5-flash",
    max_tokens: int = 1024,
) -> str:
    """
    Reemplaza la llamada indirecta a Gemini vía OpenRouter (que usaba
    google/gemini-2.0-flash-001 — deprecado en el Model Garden de Vertex AI
    a la fecha de esta migración). Mismo tier "flash" (rápido/barato),
    ahora servido nativo desde Vertex AI en vez de un proxy de terceros.
    """
    client = get_vertex_client()
    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            max_output_tokens=max_tokens,
        ),
    )
    return response.text
