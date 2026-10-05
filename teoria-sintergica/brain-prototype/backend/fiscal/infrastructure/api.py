"""Router FastAPI del Gestor Autónomo. Traduce HTTP ↔ casos de uso; no tiene lógica fiscal.

Todo el router exige sesión compartida + acceso a la app `dashboard`.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from accounts.application.ports import Identity
from accounts.infrastructure.api import require_app
from accounts.infrastructure.wiring import DASHBOARD_APP
from fiscal.application.agent import ChatMessage, FiscalAgent
from fiscal.application.attachments import MAX_BYTES, MAX_FILES, Attachment
from fiscal.application.documents import DocumentService, StoredDocument
from fiscal.application.invoices import InvoiceService
from fiscal.application.onboarding import onboarding_state
from fiscal.application.errors import AgentUnavailable, FiscalError, Invalid, NotFound
from fiscal.application.service import CalendarItem, DeadlineKind, FiscalService
from fiscal.domain.profile import RegimenIrpf, RegimenIva, TaxProfile
from fiscal.infrastructure.api_chat import router as chat_router
from fiscal.infrastructure.api_clients import router as clients_router
from fiscal.infrastructure.api_invoices import router as invoices_router
from fiscal.infrastructure.api_movements import router as movements_router

router = APIRouter(prefix="/fiscal", tags=["Gestor Autónomo"])


class ProfileIn(BaseModel):
    nif: str = Field(min_length=1, max_length=20)
    fecha_alta: date
    iae: str = Field(max_length=10)
    regimen_iva: RegimenIva
    regimen_irpf: RegimenIrpf
    roi: bool = False
    tarifa_plana_hasta: date | None = None
    domicilio_fiscal: str = Field(max_length=300)
    municipio: str = Field(max_length=100)
    comunidad: str = Field(max_length=100)


class StatusIn(BaseModel):
    estado: str = Field(max_length=20)
    justificante: str | None = Field(default=None, max_length=1000)


class DeadlineIn(BaseModel):
    tipo: DeadlineKind
    fecha_notificacion: date
    dias: int | None = None


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=8000)


class AttachmentIn(BaseModel):
    name: str = Field(max_length=200)
    media_type: str = Field(max_length=100)
    # base64 ocupa 4/3 del tamaño original
    data: str = Field(min_length=1, max_length=MAX_BYTES * 4 // 3 + 4)


class AgentChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessageIn] = Field(default_factory=list, max_length=60)
    pagina: str | None = Field(default=None, max_length=200)
    attachments: list[AttachmentIn] = Field(default_factory=list, max_length=MAX_FILES)


def _agent(request: Request) -> FiscalAgent:
    agent: FiscalAgent = request.app.state.fiscal_agent
    return agent


Agent = Annotated[FiscalAgent, Depends(_agent)]


def _documents(request: Request) -> DocumentService:
    documents: DocumentService = request.app.state.fiscal_documents
    return documents


Documents = Annotated[DocumentService, Depends(_documents)]


def _document_out(d: StoredDocument) -> dict[str, Any]:
    return {
        "id": d.id,
        "name": d.name,
        "media_type": d.media_type,
        "size_bytes": d.size_bytes,
        "created_at": d.created_at.isoformat(),
    }


def _service(request: Request) -> FiscalService:
    service: FiscalService = request.app.state.fiscal
    return service


Svc = Annotated[FiscalService, Depends(_service)]
Owner = Annotated[Identity, Depends(require_app(DASHBOARD_APP))]


def http_error(exc: FiscalError) -> HTTPException:
    if isinstance(exc, NotFound):
        return HTTPException(404, str(exc))
    if isinstance(exc, Invalid):
        return HTTPException(422, str(exc))
    if isinstance(exc, AgentUnavailable):
        return HTTPException(503, str(exc))
    return HTTPException(400, str(exc))


def _profile_out(p: TaxProfile) -> dict[str, Any]:
    return {
        "version": p.version,
        "nif": p.nif,
        "fecha_alta": p.fecha_alta.isoformat(),
        "iae": p.iae,
        "regimen_iva": p.regimen_iva,
        "regimen_irpf": p.regimen_irpf,
        "roi": p.roi,
        "tarifa_plana_hasta": p.tarifa_plana_hasta.isoformat() if p.tarifa_plana_hasta else None,
        "domicilio_fiscal": p.domicilio_fiscal,
        "municipio": p.municipio,
        "comunidad": p.comunidad,
    }


def _item_out(item: CalendarItem) -> dict[str, Any]:
    o = item.obligation
    return {
        "key": o.key,
        "modelo": o.modelo,
        "ejercicio": o.ejercicio,
        "periodo": o.periodo,
        "titulo": o.titulo,
        "vence": o.vence.isoformat(),
        "vence_nominal": o.vence_nominal.isoformat(),
        "provisional": o.provisional,
        "condicional": o.condicional,
        "nota": o.nota,
        "fuente": o.fuente,
        "estado": item.estado,
        "justificante": item.justificante,
        "aviso": item.aviso,
        "dias_restantes": item.dias_restantes,
    }


@router.get("/profile")
async def get_profile(svc: Svc, owner: Owner) -> dict[str, Any] | None:
    profile = await svc.get_profile(owner.user_id)
    return None if profile is None else _profile_out(profile)


@router.put("/profile")
async def save_profile(body: ProfileIn, svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        return _profile_out(await svc.save_profile(owner.user_id, TaxProfile(**body.model_dump())))
    except FiscalError as exc:
        raise http_error(exc) from exc


@router.get("/calendar")
async def calendar(svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        view = await svc.calendar(owner.user_id)
    except FiscalError as exc:
        raise http_error(exc) from exc
    return {
        "hoy": view.hoy.isoformat(),
        "festivos_cargados": list(view.festivos_cargados),
        "items": [_item_out(i) for i in view.items],
    }


@router.put("/obligations/{key}/status")
async def set_status(key: str, body: StatusIn, svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        return _item_out(await svc.set_status(owner.user_id, key, body.estado, body.justificante))
    except FiscalError as exc:
        raise http_error(exc) from exc


@router.post("/deadlines")
async def compute_deadline(body: DeadlineIn, svc: Svc, owner: Owner) -> dict[str, Any]:
    try:
        result = await svc.deadline(owner.user_id, body.tipo, body.fecha_notificacion, body.dias)
    except FiscalError as exc:
        raise http_error(exc) from exc
    return {"vence": result.vence.isoformat(), "fuente": result.fuente, "traza": list(result.traza)}


@router.post("/agent/chat")
async def agent_chat(body: AgentChatIn, agent: Agent, owner: Owner) -> dict[str, Any]:
    """El agente responde y propone; nunca guarda. Las propuestas se confirman con los endpoints de arriba."""
    history = [ChatMessage(m.role, m.text) for m in body.history]
    try:
        attachments = [Attachment(a.name, a.media_type, a.data) for a in body.attachments]
        reply = await agent.chat(owner.user_id, history, body.message, body.pagina, attachments)
    except FiscalError as exc:
        raise http_error(exc) from exc
    return {
        "reply": reply.text,
        "proposals": [
            {"id": p.id, "kind": p.kind, "titulo": p.titulo, "detalle": list(p.detalle), "payload": p.payload}
            for p in reply.proposals
        ],
    }


@router.get("/documents")
async def list_documents(documents: Documents, owner: Owner) -> list[dict[str, Any]]:
    return [_document_out(d) for d in await documents.list(owner.user_id)]


@router.get("/documents/{document_id}")
async def download_document(document_id: str, documents: Documents, owner: Owner) -> Response:
    try:
        doc, data = await documents.read(owner.user_id, document_id)
    except FiscalError as exc:
        raise http_error(exc) from exc
    # attachment + nosniff: el navegador lo descarga, nunca lo interpreta como página.
    filename = "".join(c if c.isalnum() or c in "._- " else "_" for c in doc.name)
    return Response(
        data,
        media_type=doc.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(document_id: str, documents: Documents, owner: Owner) -> None:
    try:
        await documents.delete(owner.user_id, document_id)
    except FiscalError as exc:
        raise http_error(exc) from exc


@router.get("/onboarding")
async def onboarding(request: Request, svc: Svc, owner: Owner) -> dict[str, Any]:
    """Pasos de puesta en marcha con su estado y el siguiente pendiente."""
    invoices: InvoiceService = request.app.state.fiscal_invoices
    return await onboarding_state(svc, invoices, owner.user_id)


router.include_router(invoices_router)
router.include_router(chat_router)
router.include_router(clients_router)
router.include_router(movements_router)
