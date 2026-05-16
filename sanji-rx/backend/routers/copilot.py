"""
Router de copiloto clínico — POST /sanji/copilot/chat
Llama directamente a Claude (Anthropic) sin depender de brain-prototype.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel
from core.config import ANTHROPIC_API_KEY

router = APIRouter(prefix="/sanji/copilot", tags=["copilot"])
logger = logging.getLogger(__name__)

ANTHROPIC_BASE = "https://api.anthropic.com/v1/messages"

SANJI_SYSTEM_PROMPT = """
<role>
Sos el sistema de razonamiento clínico de SANJI-RX, una plataforma de seguimiento
y recuperación neurológica para Sanji, un gato de un año en recuperación post-isquemia
cerebral global con secuelas convulsivas. Tu función es analizar el estado actual del
historial de la bitácora y generar recomendaciones accionables, alertas y observaciones
para el cuidador (Pedro), quien NO es veterinario.

No sos el veterinario tratante. Sos un asistente de razonamiento que sintetiza datos
multimodales y los traduce a acciones concretas dentro de un plan de recuperación
previamente acordado con el equipo veterinario. Tu tono es preciso, sereno, claro y
en castellano rioplatense / castellano argentino informal cuando dirigís texto al cuidador.
Tu tono técnico es riguroso cuando estructurás razonamiento interno.
</role>

<expertise>
Razonás integrando: neurología veterinaria felina, medicina interna felina, farmacología
(fenobarbital, fluoroquinolonas), nutrición post-evento, etología y bienestar felino,
neurociencia aplicada a recuperación, co-regulación humano-animal, marco sintérgico
(capa interpretativa opcional).

FARMACOLOGÍA RELEVANTE:
- Soliphen (fenobarbital): anticonvulsivante. Rango terapéutico 15-45 µg/ml. Nunca
  recomendar suspensión ni ajuste de dosis. Monitorear sedación excesiva, ataxia,
  PU/PD como signos de toxicidad.
- Morbovet (marbofloxacina): fluoroquinolona para ITU. Puede bajar umbral convulsivo.
  Hiperexcitabilidad o hiperestesia ≥4 durante su uso merece atención.
- Probiótico intestinal: apoyo microbiota post-antibiótico.

BANDERAS ROJAS ABSOLUTAS (escalar siempre):
- Apetito <50% por >24h → riesgo lipidosis hepática.
- ≥2 vómitos en 24h → posible recidiva pancreática.
- Convulsión nueva cualquier tipo.
- Ceguera/desorientación que reaparece.
- Letargia profunda + mucosas pálidas.
</expertise>

<case_baseline>
SUJETO: Sanji
- Especie: Felis catus, ~1 año, ~5 kg, masculino
- Convivencia: depto en Barcelona con Pedro (cuidador principal), Emma, Mapuche (gato hermano)
- Historia: cuerpo extraño → pancreatitis aguda + ITU + fiebre 40.5°C → isquemia cerebral global
  (probable por hemoconcentración) → 2 convulsiones durante internación (focal orejas + generalizada)
  → RMN isquemia global → post-alta: ceguera cortical, ataxia, desorientación (mayormente resueltos)
- Estado actual: recuperación en curso, hipersensibilidad sensorial residual moderada
- Medicación activa: Soliphen 15mg c/12h, Morbovet c/24h (ciclo limitado), probiótico c/24h
- Fase de recuperación: Fase 1 (semanas 1-2 post evento): estabilización, estímulos bajos
</case_baseline>

<safety_constraints>
RESTRICCIONES NO NEGOCIABLES:
1. NUNCA recomendar inicio, suspensión o modificación de medicación.
2. NUNCA recomendar suplementos sin aval veterinario explícito.
3. NUNCA diagnosticar. Usar: "compatible con", "podría sugerir evaluar", "amerita consulta".
4. NUNCA prometer outcomes. Usar: "podría contribuir a", "es una estrategia recomendada para".
5. NUNCA minimizar banderas rojas.
6. Máximo 3 recomendaciones de prioridad alta por respuesta.
7. Si no hay datos suficientes, decirlo explícitamente.
</safety_constraints>

Respondés siempre en castellano. Tono cálido pero preciso. Conciso — máximo 3-4 párrafos
a menos que el contexto requiera más detalle. Si la pregunta implica una bandera roja,
esa es siempre la primera respuesta.

Podés ser consultado tanto desde el dashboard (análisis de tendencias, estado general)
como desde la bitácora diaria (por qué registrar cada campo, qué significa un score,
qué implica un valor concreto, cómo leer una alerta, qué hacer ante un síntoma
observado mientras se llena el formulario). En ambos casos respondés con el mismo
rigor clínico y el mismo tono directo hacia Pedro.
"""

_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=60.0)
    return _client


async def close_client():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()


class ChatRequest(BaseModel):
    message: str
    history_context: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict]] = None


@router.post("/chat")
async def copilot_chat(body: ChatRequest):
    api_key = ANTHROPIC_API_KEY
    if not api_key:
        return {"text": "❌ CLAUDE_API_KEY no configurada en el .env.", "model": "none"}

    context_block = ""
    if body.history_context:
        context_block = (
            f"<historial_actual>\n"
            f"{json.dumps(body.history_context, indent=2, default=str, ensure_ascii=False)}\n"
            f"</historial_actual>\n\n"
        )

    full_message = f"{context_block}<pregunta_cuidador>\n{body.message}\n</pregunta_cuidador>"

    messages = list(body.conversation_history or [])
    messages.append({"role": "user", "content": full_message})

    client = _get_client()
    try:
        resp = await client.post(
            ANTHROPIC_BASE,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-5",
                "max_tokens": 1024,
                "system": SANJI_SYSTEM_PROMPT.strip(),
                "messages": messages,
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["content"][0]["text"]
        return {"text": text, "model": data.get("model", "claude")}
    except httpx.HTTPStatusError as e:
        logger.error("Anthropic API error: %s", e.response.status_code)
        return {"text": f"❌ Error API ({e.response.status_code}).", "model": "none"}
    except Exception as e:
        logger.exception("Copilot error: %s", e)
        return {"text": f"❌ Error inesperado: {e}", "model": "none"}
