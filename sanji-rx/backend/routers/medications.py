"""
Router de medicamentos — GET /sanji/medications + POST /sanji/medications/{id}/give
"""

from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database.postgres import get_pool

router = APIRouter(prefix="/sanji/medications", tags=["medications"])


async def _get_default_subject_id(pool) -> str:
    row = await pool.fetchrow("SELECT id FROM subjects WHERE name='Sanji' LIMIT 1")
    if not row:
        raise HTTPException(404, "Sujeto 'Sanji' no encontrado.")
    return str(row["id"])


@router.get("")
async def list_medications(subject_id: Optional[str] = None, active_only: bool = True):
    pool = await get_pool()
    sid = subject_id or await _get_default_subject_id(pool)

    query = "SELECT * FROM medications WHERE subject_id=$1"
    if active_only:
        query += " AND ended_at IS NULL"
    query += " ORDER BY created_at"

    rows = await pool.fetch(query, sid)
    return {"status": "ok", "medications": [dict(r) for r in rows]}


class GiveInput(BaseModel):
    given_at: Optional[datetime] = None
    dose_given_mg: Optional[float] = None
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None   # si no existe el registro previo, crear


@router.post("/{medication_id}/give")
async def mark_given(medication_id: str, body: GiveInput):
    """
    Registra que se dio una toma de medicamento.
    Si el registro de administration no existe para ese scheduled_at, lo crea.
    Si ya existe, actualiza.
    """
    pool = await get_pool()
    given_at = body.given_at or datetime.now()
    scheduled_at = body.scheduled_at or given_at.replace(minute=0, second=0, microsecond=0)

    # Busca administration existente
    existing = await pool.fetchrow(
        """SELECT id FROM medication_administrations
           WHERE medication_id=$1
             AND scheduled_at::date = $2::date
             AND EXTRACT(hour FROM scheduled_at) = EXTRACT(hour FROM $2::timestamptz)
        """,
        medication_id, scheduled_at,
    )

    # Obtener subject_id desde medication
    med = await pool.fetchrow(
        "SELECT subject_id, dose_mg, name FROM medications WHERE id=$1",
        medication_id,
    )
    if not med:
        raise HTTPException(404, f"Medicamento {medication_id} no encontrado.")

    dose = body.dose_given_mg or med["dose_mg"]

    if existing:
        await pool.execute(
            """UPDATE medication_administrations
               SET given=true, given_at=$2, dose_given_mg=$3, notes=$4
               WHERE id=$1
            """,
            str(existing["id"]), given_at, dose, body.notes,
        )
        admin_id = str(existing["id"])
    else:
        row = await pool.fetchrow(
            """INSERT INTO medication_administrations
               (medication_id, subject_id, scheduled_at, given_at, given, dose_given_mg, notes)
               VALUES ($1, $2, $3, $4, true, $5, $6)
               RETURNING id
            """,
            medication_id, str(med["subject_id"]),
            scheduled_at, given_at, dose, body.notes,
        )
        admin_id = str(row["id"])

    # Auto-resolver alertas de esa toma
    await pool.execute(
        """UPDATE alerts SET resolved_at=NOW(), auto_resolved=true
           WHERE subject_id=$1 AND kind='medication_due'
             AND evidence_refs::text ILIKE $2
             AND resolved_at IS NULL
        """,
        str(med["subject_id"]),
        f"%{med['name']}%",
    )

    return {
        "status": "ok",
        "administration_id": admin_id,
        "medication": med["name"],
        "given_at": given_at.isoformat(),
    }


@router.get("/{medication_id}/history")
async def administration_history(medication_id: str, days: int = 14):
    pool = await get_pool()
    since = datetime.now() - timedelta(days=days)
    rows = await pool.fetch(
        """SELECT * FROM medication_administrations
           WHERE medication_id=$1 AND scheduled_at >= $2
           ORDER BY scheduled_at DESC
        """,
        medication_id, since,
    )
    total = len(rows)
    given = sum(1 for r in rows if r["given"])
    return {
        "status": "ok",
        "medication_id": medication_id,
        "period_days": days,
        "scheduled": total,
        "given": given,
        "adherence_pct": round(given / total * 100, 1) if total else 100.0,
        "history": [dict(r) for r in rows],
    }
