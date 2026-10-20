"""Tipos compartidos por el agente y sus grupos de tools."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal, Protocol

ProposalKind = Literal["profile", "status", "invoice", "client"]


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    input: Mapping[str, Any]


@dataclass(frozen=True)
class ModelTurn:
    stop_reason: str
    text: str
    tool_calls: tuple[ToolCall, ...]
    raw_content: Any
    """Contenido del turno tal cual lo devolvió el modelo: se reenvía sin tocar dentro del mismo pedido."""


class ChatModel(Protocol):
    async def complete(
        self, system: str, tools: Sequence[Mapping[str, Any]], messages: Sequence[Mapping[str, Any]]
    ) -> ModelTurn: ...


@dataclass(frozen=True)
class ChatMessage:
    role: Literal["user", "assistant"]
    text: str


@dataclass(frozen=True)
class Proposal:
    id: str
    kind: ProposalKind
    titulo: str
    detalle: tuple[str, ...]
    payload: dict[str, Any]


@dataclass(frozen=True)
class AgentReply:
    text: str
    proposals: tuple[Proposal, ...]


@dataclass(frozen=True)
class ToolOutput:
    content: str | list[dict[str, Any]]
    is_error: bool = False
    proposal: Proposal | None = None


def to_json(data: object) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


Handler = Callable[[str, Mapping[str, Any]], Awaitable[ToolOutput]]
PROPOSED = "Propuesta mostrada al usuario. Todavía no se guardó: espera su confirmación."
