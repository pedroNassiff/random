"""Adaptador PostgreSQL del schema `fiscal`. SQL parametrizado; el perfil es append-only."""

from __future__ import annotations

from datetime import datetime
from typing import cast

import asyncpg

from fiscal.application.documents import StoredDocument
from fiscal.application.ports import StoredStatus
from fiscal.domain.holidays import Holiday
from fiscal.domain.profile import RegimenIrpf, RegimenIva, TaxProfile
from fiscal.domain.status import Estado

_PROFILE_COLS = (
    "nif, fecha_alta, iae, regimen_iva, regimen_irpf, roi, tarifa_plana_hasta, "
    "domicilio_fiscal, municipio, comunidad, version"
)


def _profile(r: asyncpg.Record) -> TaxProfile:
    return TaxProfile(
        nif=r["nif"],
        fecha_alta=r["fecha_alta"],
        iae=r["iae"],
        regimen_iva=cast("RegimenIva", r["regimen_iva"]),
        regimen_irpf=cast("RegimenIrpf", r["regimen_irpf"]),
        roi=r["roi"],
        tarifa_plana_hasta=r["tarifa_plana_hasta"],
        domicilio_fiscal=r["domicilio_fiscal"],
        municipio=r["municipio"],
        comunidad=r["comunidad"],
        version=r["version"],
    )


_DOC_COLS = "id, name, media_type, size_bytes, sha256, storage_key, created_at"


def _document(r: asyncpg.Record) -> StoredDocument:
    return StoredDocument(
        str(r["id"]), r["name"], r["media_type"], r["size_bytes"], r["sha256"], r["storage_key"], r["created_at"]
    )


class PgFiscalRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def latest_profile(self, owner_id: str) -> TaxProfile | None:
        row = cast(
            "asyncpg.Record | None",
            await self._pool.fetchrow(
                f"SELECT {_PROFILE_COLS} FROM fiscal.tax_profiles "  # nosec B608 - columnas constantes
                "WHERE owner_id = $1::uuid ORDER BY version DESC LIMIT 1",
                owner_id,
            ),
        )
        return None if row is None else _profile(row)

    async def add_profile_version(self, owner_id: str, profile: TaxProfile) -> TaxProfile:
        row = cast(
            "asyncpg.Record | None",
            await self._pool.fetchrow(
                "INSERT INTO fiscal.tax_profiles (owner_id, version, nif, fecha_alta, iae, regimen_iva, "
                "regimen_irpf, roi, tarifa_plana_hasta, domicilio_fiscal, municipio, comunidad) "
                "SELECT $1::uuid, COALESCE(MAX(version), 0) + 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11 "
                "FROM fiscal.tax_profiles WHERE owner_id = $1::uuid "
                f"RETURNING {_PROFILE_COLS}",  # nosec B608 - columnas constantes
                owner_id,
                profile.nif,
                profile.fecha_alta,
                profile.iae,
                profile.regimen_iva,
                profile.regimen_irpf,
                profile.roi,
                profile.tarifa_plana_hasta,
                profile.domicilio_fiscal,
                profile.municipio,
                profile.comunidad,
            ),
        )
        assert row is not None
        return _profile(row)

    async def list_holidays(self) -> list[Holiday]:
        rows = await self._pool.fetch("SELECT day, territorio, nombre FROM fiscal.holidays ORDER BY day")
        return [Holiday(r["day"], r["territorio"], r["nombre"]) for r in rows]

    async def list_statuses(self, owner_id: str) -> dict[str, StoredStatus]:
        rows = await self._pool.fetch(
            "SELECT key, estado, justificante FROM fiscal.obligation_status WHERE owner_id = $1::uuid", owner_id
        )
        return {r["key"]: StoredStatus(cast("Estado", r["estado"]), r["justificante"]) for r in rows}

    async def save_status(self, owner_id: str, key: str, status: StoredStatus, now: datetime) -> None:
        await self._pool.execute(
            "INSERT INTO fiscal.obligation_status (owner_id, key, estado, justificante, updated_at) "
            "VALUES ($1::uuid, $2, $3, $4, $5) ON CONFLICT (owner_id, key) DO UPDATE "
            "SET estado = EXCLUDED.estado, justificante = EXCLUDED.justificante, updated_at = EXCLUDED.updated_at",
            owner_id,
            key,
            status.estado,
            status.justificante,
            now,
        )

    # ── documentos ──────────────────────────────────────────────────────────
    async def upsert_document(self, owner_id: str, doc: StoredDocument) -> StoredDocument:
        row = cast(
            "asyncpg.Record | None",
            await self._pool.fetchrow(
                "INSERT INTO fiscal.documents "
                "(owner_id, name, media_type, size_bytes, sha256, storage_key, created_at) "
                "VALUES ($1::uuid, $2, $3, $4, $5, $6, $7) "
                # DO UPDATE sin cambios reales: hace que RETURNING devuelva la fila existente.
                "ON CONFLICT (owner_id, sha256) DO UPDATE SET sha256 = EXCLUDED.sha256 "
                f"RETURNING {_DOC_COLS}",  # nosec B608 - columnas constantes
                owner_id,
                doc.name,
                doc.media_type,
                doc.size_bytes,
                doc.sha256,
                doc.storage_key,
                doc.created_at,
            ),
        )
        assert row is not None
        return _document(row)

    async def list_documents(self, owner_id: str) -> list[StoredDocument]:
        rows = await self._pool.fetch(
            f"SELECT {_DOC_COLS} FROM fiscal.documents "  # nosec B608 - columnas constantes
            "WHERE owner_id = $1::uuid ORDER BY created_at DESC, name",
            owner_id,
        )
        return [_document(r) for r in rows]

    async def get_document(self, owner_id: str, document_id: str) -> StoredDocument | None:
        # Se compara como texto: un id que no es uuid devuelve "no existe" en vez de un error de cast.
        row = cast(
            "asyncpg.Record | None",
            await self._pool.fetchrow(
                f"SELECT {_DOC_COLS} FROM fiscal.documents "  # nosec B608 - columnas constantes
                "WHERE owner_id = $1::uuid AND id::text = $2",
                owner_id,
                document_id,
            ),
        )
        return None if row is None else _document(row)

    async def delete_document(self, owner_id: str, document_id: str) -> None:
        await self._pool.execute(
            "DELETE FROM fiscal.documents WHERE owner_id = $1::uuid AND id::text = $2", owner_id, document_id
        )
