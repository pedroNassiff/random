"""
SanjiCopilotService — Servicio de chat clínico para SANJI-RX.

Usa Claude (Anthropic) directamente con el system prompt del sanji_rx_prompt.md.
El frontend/sanji-rx backend envía el contexto del historial pre-construido.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

ANTHROPIC_BASE = "https://api.anthropic.com/v1/messages"

# ── System prompt (extraído de sanji_rx_prompt.md §2) ────────────────────────
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
"""


class SanjiCopilotService:
    def __init__(self):
        self.api_key = os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY", "")
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client

    async def aclose(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def chat(
        self,
        message: str,
        history_context: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """
        Procesa un mensaje del cuidador con contexto de historial de bitácoras.

        history_context: {
            log_today: {...},
            week_stats: {...},
            recent_logs: [...],
            medications_active: [...],
            alerts_unread: [...],
        }
        conversation_history: lista de {role, content} previos en la sesión
        """
        if not self.api_key:
            return {
                "text": "❌ ANTHROPIC_API_KEY no configurada. Revisá el .env.",
                "model": "none",
            }

        # Construir user message con contexto del historial
        context_block = ""
        if history_context:
            context_block = f"""
<historial_actual>
{json.dumps(history_context, indent=2, default=str, ensure_ascii=False)}
</historial_actual>

"""

        full_message = f"{context_block}<pregunta_cuidador>\n{message}\n</pregunta_cuidador>"

        # Construir messages para Claude
        messages = []
        if conversation_history:
            messages.extend(conversation_history)
        messages.append({"role": "user", "content": full_message})

        client = self._get_client()
        try:
            resp = await client.post(
                ANTHROPIC_BASE,
                headers={
                    "x-api-key": self.api_key,
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
            logger.error("Anthropic API error: %s — %s", e.response.status_code, e.response.text)
            return {"text": f"❌ Error API ({e.response.status_code}). Revisá los logs.", "model": "none"}
        except Exception as e:
            logger.exception("SanjiCopilot error: %s", e)
            return {"text": f"❌ Error inesperado: {e}", "model": "none"}
