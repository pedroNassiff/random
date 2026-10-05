"""Agente gestor: conversa, consulta el dominio por tools y propone cambios que la persona confirma.

El código calcula, el modelo explica: las tools de lectura y cálculo llaman a `FiscalService`; las de
escritura validan y devuelven una `Proposal`, nunca escriben. Guardar es una acción humana desde la UI.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import fields
from datetime import date
from typing import Any
from uuid import uuid4

from fiscal.application.agent_tools import SYSTEM_PROMPT, TOOLS
from fiscal.application.agent_types import (
    PROPOSED,
    AgentReply,
    ChatMessage,
    ChatModel,
    Handler,
    ModelTurn,
    Proposal,
    ToolCall,
    ToolOutput,
    to_json,
)
from fiscal.application.client_tools import ClientTools
from fiscal.application.clients import ClientService
from fiscal.application.attachments import Attachment, block_for, check_count
from fiscal.application.documents import DocumentService
from fiscal.application.errors import FiscalError
from fiscal.application.invoice_tools import InvoiceTools
from fiscal.application.invoices import InvoiceService
from fiscal.application.onboarding import onboarding_state
from fiscal.application.service import CalendarItem, DeadlineKind, FiscalService
from fiscal.domain.errors import FiscalRuleError
from fiscal.domain.profile import TaxProfile, validated
from fiscal.domain.status import is_closed, validate_status

__all__ = ["MAX_TURNS", "AgentReply", "ChatMessage", "ChatModel", "FiscalAgent", "ModelTurn", "Proposal", "ToolCall"]

MAX_TURNS = 8
MAX_MESSAGE = 4000
MAX_HISTORY = 30
_PROFILE_FIELDS = tuple(f.name for f in fields(TaxProfile) if f.name != "version")
_DATE_FIELDS = ("fecha_alta", "tarifa_plana_hasta")


def _mask_nif(nif: str) -> str:
    return "•" * max(len(nif) - 3, 0) + nif[-3:]


def _profile_dict(p: TaxProfile) -> dict[str, Any]:
    return {
        name: (value.isoformat() if isinstance(value := getattr(p, name), date) else value) for name in _PROFILE_FIELDS
    }


def _item_dict(i: CalendarItem) -> dict[str, Any]:
    o = i.obligation
    return {
        "clave": o.key,
        "titulo": o.titulo,
        "vence": o.vence.isoformat(),
        "provisional": o.provisional,
        "si_aplica": o.condicional,
        "estado": i.estado,
        "aviso": i.aviso,
        "dias_restantes": i.dias_restantes,
        "fuente": o.fuente,
    }


def _show(value: object) -> str:
    """Valor de un campo tal como lo lee la persona en la propuesta."""
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "sí" if value else "no"
    return str(value)


def _parse_date(value: object, label: str) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise FiscalRuleError(f"{label} debe ser una fecha aaaa-mm-dd.") from exc


class FiscalAgent:
    def __init__(
        self,
        service: FiscalService,
        model: ChatModel,
        documents: DocumentService,
        invoices: InvoiceService,
        clients: ClientService,
        *,
        id_factory: Callable[[], str] = lambda: uuid4().hex,
    ) -> None:
        self._service = service
        self._documents = documents
        self._invoices = invoices
        self._clients = clients
        self._model = model
        self._new_id = id_factory
        self._handlers: dict[str, Handler] = {
            "ver_perfil": self._ver_perfil,
            "ver_pasos": self._ver_pasos,
            "ver_documentos": self._ver_documentos,
            "leer_documento": self._leer_documento,
            "ver_calendario": self._ver_calendario,
            "calcular_plazo": self._calcular_plazo,
            "proponer_perfil": self._proponer_perfil,
            "proponer_estado": self._proponer_estado,
        }
        self._handlers.update(InvoiceTools(invoices, self._new_id).handlers())
        self._handlers.update(ClientTools(clients, self._new_id).handlers())

    async def chat(
        self,
        owner_id: str,
        history: Sequence[ChatMessage],
        message: str,
        pagina: str | None = None,
        attachments: Sequence[Attachment] = (),
    ) -> AgentReply:
        documents = await self._store(owner_id, attachments)  # valida y guarda antes de llamar al modelo
        messages: list[dict[str, Any]] = [
            {"role": m.role, "content": m.text[:MAX_MESSAGE]} for m in history[-MAX_HISTORY:] if m.text.strip()
        ]
        context = (
            f"<contexto>Hoy es {self._service.today().isoformat()}. Página abierta: {pagina or 'dashboard'}.</contexto>"
        )
        text = f"{context}\n\n{message[:MAX_MESSAGE]}"
        # Los documentos van antes del texto; sin adjuntos el contenido es un string simple.
        messages.append(
            {"role": "user", "content": [*documents, {"type": "text", "text": text}] if documents else text}
        )

        proposals: list[Proposal] = []
        for _ in range(MAX_TURNS):
            turn = await self._model.complete(SYSTEM_PROMPT, TOOLS, messages)
            if turn.stop_reason == "refusal":
                return AgentReply("No puedo ayudarte con eso. Probá reformular la consulta.", tuple(proposals))
            if turn.stop_reason != "tool_use" or not turn.tool_calls:
                return AgentReply(turn.text or "No tengo una respuesta para eso.", tuple(proposals))
            messages.append({"role": "assistant", "content": turn.raw_content})
            results = []
            for call in turn.tool_calls:
                output = await self._run(owner_id, call)
                if output.proposal is not None:
                    proposals.append(output.proposal)
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": call.id,
                        "content": output.content,
                        "is_error": output.is_error,
                    }
                )
            messages.append({"role": "user", "content": results})
        return AgentReply("No llegué a terminar la consulta. Probá con una pregunta más acotada.", tuple(proposals))

    async def _store(self, owner_id: str, attachments: Sequence[Attachment]) -> list[dict[str, Any]]:
        """Guarda cada adjunto y devuelve sus bloques para el mensaje, con el id con que quedó guardado."""
        check_count(attachments)
        blocks: list[dict[str, Any]] = []
        for a in attachments:
            doc = await self._documents.save(owner_id, a)
            blocks.extend(block_for(doc.name, doc.media_type, a.data))
            blocks.append({"type": "text", "text": f"(Documento guardado: {doc.name}, id {doc.id})"})
        return blocks

    async def _run(self, owner_id: str, call: ToolCall) -> ToolOutput:
        handler = self._handlers.get(call.name)
        if handler is None:
            return ToolOutput(f"Tool desconocida: {call.name}", is_error=True)
        try:
            return await handler(owner_id, call.input)
        except (FiscalError, FiscalRuleError) as exc:
            return ToolOutput(str(exc), is_error=True)

    # ── lectura y cálculo ───────────────────────────────────────────────────
    async def _ver_perfil(self, owner_id: str, _args: Mapping[str, Any]) -> ToolOutput:
        profile = await self._service.get_profile(owner_id)
        if profile is None:
            return ToolOutput("El usuario todavía no cargó su perfil fiscal.")
        return ToolOutput(
            to_json({**_profile_dict(profile), "nif": _mask_nif(profile.nif), "version": profile.version})
        )

    async def _ver_documentos(self, owner_id: str, _args: Mapping[str, Any]) -> ToolOutput:
        docs = await self._documents.list(owner_id)
        if not docs:
            return ToolOutput("El usuario todavía no subió ningún documento.")
        return ToolOutput(
            to_json(
                [
                    {
                        "id": d.id,
                        "nombre": d.name,
                        "tipo": d.media_type,
                        "subido": d.created_at.date().isoformat(),
                        "bytes": d.size_bytes,
                    }
                    for d in docs
                ]
            )
        )

    async def _leer_documento(self, owner_id: str, args: Mapping[str, Any]) -> ToolOutput:
        doc, data = await self._documents.read_base64(owner_id, str(args.get("id", "")))
        blocks = block_for(doc.name, doc.media_type, data)
        # El documento se reenvía en cada vuelta del loop: con el breakpoint se lee de caché.
        blocks[-1]["cache_control"] = {"type": "ephemeral"}
        return ToolOutput(blocks)

    async def _ver_pasos(self, owner_id: str, _args: Mapping[str, Any]) -> ToolOutput:
        return ToolOutput(to_json(await onboarding_state(self._service, self._invoices, owner_id)))

    async def _ver_calendario(self, owner_id: str, args: Mapping[str, Any]) -> ToolOutput:
        view = await self._service.calendar(owner_id)
        filtro = args.get("filtro", "abiertas")
        items = [
            i
            for i in view.items
            if (
                args.get("incluir_cuotas_reta")
                or i.obligation.modelo != "RETA"
                or i.obligation.periodo == "tarifa-plana"
            )
            and (filtro == "todas" or not is_closed(i.estado))
            and (filtro != "vencidas" or i.aviso == "vencida")
        ]
        return ToolOutput(
            to_json(
                {
                    "hoy": view.hoy.isoformat(),
                    "festivos_cargados": list(view.festivos_cargados),
                    "obligaciones": [_item_dict(i) for i in items],
                }
            )
        )

    async def _calcular_plazo(self, owner_id: str, args: Mapping[str, Any]) -> ToolOutput:
        tipo: DeadlineKind = "apremio" if args.get("tipo") == "apremio" else "dias_habiles"
        notificado = _parse_date(args.get("fecha_notificacion"), "fecha_notificacion")
        dias = args.get("dias")
        result = await self._service.deadline(owner_id, tipo, notificado, dias if isinstance(dias, int) else None)
        return ToolOutput(to_json({"vence": result.vence.isoformat(), "fuente": result.fuente, "traza": result.traza}))

    # ── propuestas (no escriben) ────────────────────────────────────────────
    async def _proponer_perfil(self, owner_id: str, args: Mapping[str, Any]) -> ToolOutput:
        current = await self._service.get_profile(owner_id)
        base: dict[str, Any] = _profile_dict(current) if current else {"roi": False, "tarifa_plana_hasta": None}
        merged = {**base, **{k: v for k, v in args.items() if k in _PROFILE_FIELDS and v is not None}}
        if args.get("quitar_tarifa_plana"):
            merged["tarifa_plana_hasta"] = None
        missing = [name for name in _PROFILE_FIELDS if name not in merged]
        if missing:
            return ToolOutput(
                f"Faltan datos para el perfil: {', '.join(missing)}. Pedíselos al usuario.", is_error=True
            )
        for name in _DATE_FIELDS:
            if merged[name] is not None:
                merged[name] = _parse_date(merged[name], name)
        clean = validated(TaxProfile(**merged))
        if clean.fecha_alta > self._service.today():
            raise FiscalRuleError("La fecha de alta no puede ser futura.")
        after = _profile_dict(clean)
        before = _profile_dict(current) if current else {}
        detalle = tuple(
            f"{name}: {_show(before.get(name))} → {_show(after[name])}"
            for name in _PROFILE_FIELDS
            if before.get(name) != after[name]
        )
        if not detalle:
            return ToolOutput("La propuesta es igual al perfil actual: no hay nada que cambiar.", is_error=True)
        titulo = "Actualizar perfil fiscal" if current else "Crear perfil fiscal"
        proposal = Proposal(self._new_id(), "profile", titulo, detalle, after)
        return ToolOutput(PROPOSED, proposal=proposal)

    async def _proponer_estado(self, owner_id: str, args: Mapping[str, Any]) -> ToolOutput:
        key = str(args.get("clave", ""))
        view = await self._service.calendar(owner_id)
        item = next((i for i in view.items if i.obligation.key == key), None)
        if item is None:
            return ToolOutput(f"No existe la obligación {key}. Consultá ver_calendario para la clave.", is_error=True)
        estado, justificante = validate_status(str(args.get("estado", "")), args.get("justificante"))
        if (estado, justificante) == (item.estado, item.justificante):
            return ToolOutput("La obligación ya está en ese estado.", is_error=True)
        detalle = [f"estado: {item.estado} → {estado}"]
        if justificante:
            detalle.append(f"justificante: {justificante}")
        proposal = Proposal(
            self._new_id(),
            "status",
            item.obligation.titulo,
            tuple(detalle),
            {"key": key, "estado": estado, "justificante": justificante},
        )
        return ToolOutput(PROPOSED, proposal=proposal)
