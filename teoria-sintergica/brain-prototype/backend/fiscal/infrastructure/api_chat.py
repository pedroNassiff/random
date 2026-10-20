"""Historial del chat con NEO: se guarda por mensaje y se lee por bloques, del más reciente al más viejo.

El servidor solo guarda y devuelve lo que la UI muestra; el modelo no lee esta tabla (el historial que
recibe viaja en cada pedido de chat).
"""

from __future__ import annotations

import json
from typing import Annotated, Any, Literal, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from accounts.application.ports import Identity
from accounts.infrastructure.api import require_app
from accounts.infrastructure.wiring import DASHBOARD_APP

PAGE = 30
MAX_PAGE = 100
router = APIRouter(prefix="/agent/history")


class ProposalIn(BaseModel):
    id: str = Field(max_length=64)
    kind: Literal["profile", "status", "invoice", "client"]
    titulo: str = Field(max_length=300)
    detalle: list[Annotated[str, Field(max_length=500)]] = Field(max_length=30)
    payload: dict[str, Any]


class ProposalStateIn(BaseModel):
    proposal: ProposalIn
    status: Literal["pendiente", "guardada", "descartada"]
    error: str | None = Field(default=None, max_length=500)


class EntryIn(BaseModel):
    kind: Literal["user", "assistant", "event"]
    text: str = Field(max_length=20000)
    files: list[Annotated[str, Field(max_length=200)]] = Field(default_factory=list, max_length=3)
    proposals: list[ProposalStateIn] = Field(default_factory=list, max_length=10)


class AppendIn(BaseModel):
    entries: list[EntryIn] = Field(min_length=1, max_length=10)


class ProposalsIn(BaseModel):
    proposals: list[ProposalStateIn] = Field(max_length=10)


def _pool(request: Request) -> asyncpg.Pool:
    return cast("asyncpg.Pool", request.app.state.db_pool)


Pool = Annotated[asyncpg.Pool, Depends(_pool)]
Owner = Annotated[Identity, Depends(require_app(DASHBOARD_APP))]


def _dump(items: list[Any]) -> str:
    return json.dumps(items, ensure_ascii=False)


@router.get("")
async def get_history(
    pool: Pool,
    owner: Owner,
    before: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE)] = PAGE,
) -> dict[str, Any]:
    """Un bloque de mensajes anteriores a `before` (o los últimos), en orden cronológico."""
    rows = await pool.fetch(
        "SELECT id, kind, text, files, proposals FROM fiscal.chat_messages "
        "WHERE owner_id = $1::uuid AND ($2::bigint IS NULL OR id < $2) ORDER BY id DESC LIMIT $3",
        owner.user_id,
        before,
        limit + 1,  # uno de más para saber si quedan mensajes más viejos
    )
    page = rows[:limit]
    entries = [
        {
            "id": r["id"],
            "kind": r["kind"],
            "text": r["text"],
            "files": json.loads(r["files"]),
            "proposals": json.loads(r["proposals"]),
        }
        for r in reversed(page)
    ]
    return {"entries": entries, "has_more": len(rows) > limit}


@router.post("", status_code=201)
async def append(body: AppendIn, pool: Pool, owner: Owner) -> dict[str, list[int]]:
    ids: list[int] = []
    for e in body.entries:
        ids.append(
            await pool.fetchval(
                "INSERT INTO fiscal.chat_messages (owner_id, kind, text, files, proposals) "
                "VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb) RETURNING id",
                owner.user_id,
                e.kind,
                e.text,
                _dump(e.files),
                _dump([p.model_dump() for p in e.proposals]),
            )
        )
    return {"ids": ids}


@router.put("/{message_id}", status_code=204)
async def update_proposals(message_id: int, body: ProposalsIn, pool: Pool, owner: Owner) -> None:
    """Actualiza el estado de las propuestas de un mensaje (guardada, descartada…)."""
    result: str = await pool.execute(
        "UPDATE fiscal.chat_messages SET proposals = $3::jsonb WHERE owner_id = $1::uuid AND id = $2",
        owner.user_id,
        message_id,
        _dump([p.model_dump() for p in body.proposals]),
    )
    if not result.endswith(" 1"):
        raise HTTPException(404, "Ese mensaje no existe.")


@router.delete("", status_code=204)
async def clear_history(pool: Pool, owner: Owner) -> None:
    await pool.execute("DELETE FROM fiscal.chat_messages WHERE owner_id = $1::uuid", owner.user_id)
