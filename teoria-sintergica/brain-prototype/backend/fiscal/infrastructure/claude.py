"""Adaptador del modelo: Claude por el SDK oficial de Anthropic. Único módulo fiscal que importa el SDK.

No se loguean prompts ni respuestas (datos fiscales): solo el tipo de error.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping, Sequence
from typing import Any, cast

import anthropic

from fiscal.application.agent import ModelTurn, ToolCall
from fiscal.application.errors import AgentUnavailable

logger = logging.getLogger("fiscal.agent")

# Haiku por costo: el código calcula y el modelo conversa. Se sube a Sonnet/Opus por env sin tocar código.
DEFAULT_MODEL = "claude-haiku-5-5"
DEFAULT_EFFORT = "low"
MAX_TOKENS = 16000
# Los clasificadores de seguridad pueden rechazar un pedido legítimo; con el fallback por defecto el
# pedido se reintenta del lado del servidor en otro modelo en lugar de devolver el rechazo.
# Haiku no tiene fallback del lado del servidor: ahí el rechazo lo maneja el agente.
_FALLBACK_BETA = "server-side-fallback-2026-07-01"
_FALLBACK_MODELS = ("claude-opus-", "claude-fable-", "claude-sonnet-5-5")


def _fallback_args(model: str) -> dict[str, Any]:
    if model.startswith(_FALLBACK_MODELS):
        return {"betas": [_FALLBACK_BETA], "fallbacks": "default"}
    return {}


class ClaudeChatModel:
    def __init__(self, client: anthropic.AsyncAnthropic | None = None) -> None:
        self._client = client
        self._model = os.getenv("FISCAL_AGENT_MODEL") or DEFAULT_MODEL
        self._effort = os.getenv("FISCAL_AGENT_EFFORT") or DEFAULT_EFFORT

    def _get_client(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
            if not api_key:
                raise AgentUnavailable("El agente no está configurado (falta ANTHROPIC_API_KEY).")
            self._client = anthropic.AsyncAnthropic(api_key=api_key, timeout=120.0)
        return self._client

    async def complete(
        self, system: str, tools: Sequence[Mapping[str, Any]], messages: Sequence[Mapping[str, Any]]
    ) -> ModelTurn:
        client = self._get_client()
        try:
            response = await client.beta.messages.create(
                model=self._model,
                max_tokens=MAX_TOKENS,
                output_config={"effort": cast("Any", self._effort)},
                # Prompt y tools son constantes: se cachean juntos como prefijo.
                system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
                # Breakpoint automático al final: cada vuelta del loop de tools lee de caché lo ya enviado
                # (historial, adjuntos y resultados) en lugar de pagarlo entero otra vez.
                cache_control={"type": "ephemeral"},
                **_fallback_args(self._model),
                # La capa de aplicación arma tools y mensajes como dicts con la forma de la Messages API.
                tools=cast("Any", list(tools)),
                messages=cast("Any", list(messages)),
            )
        except anthropic.AuthenticationError as exc:
            logger.error("agente: credenciales inválidas")
            raise AgentUnavailable("El agente no está configurado (clave de API inválida).") from exc
        except anthropic.RateLimitError as exc:
            raise AgentUnavailable("El agente está saturado. Probá de nuevo en un minuto.") from exc
        except anthropic.APIStatusError as exc:
            logger.error("agente: error %s del modelo", exc.status_code)
            raise AgentUnavailable("El agente no pudo responder. Probá de nuevo.") from exc
        except anthropic.APIConnectionError as exc:
            raise AgentUnavailable("No se pudo conectar con el agente. Probá de nuevo.") from exc

        u = response.usage
        # Solo cantidades de tokens: nunca contenido.
        logger.info(
            "agente: model=%s in=%s cache_read=%s cache_write=%s out=%s",
            response.model,
            u.input_tokens,
            u.cache_read_input_tokens or 0,
            u.cache_creation_input_tokens or 0,
            u.output_tokens,
        )
        text = "\n".join(b.text for b in response.content if b.type == "text").strip()
        calls = tuple(
            ToolCall(b.id, b.name, b.input if isinstance(b.input, dict) else {})
            for b in response.content
            if b.type == "tool_use"
        )
        return ModelTurn(response.stop_reason or "end_turn", text, calls, response.content)
