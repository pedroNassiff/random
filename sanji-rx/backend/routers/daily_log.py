"""
Router de bitácora diaria — POST/GET /sanji/log
"""

from datetime import date, datetime
from typing import Optional
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from database.postgres import get_pool
from core.alerts import check_red_flags

router = APIRouter(prefix="/sanji/log", tags=["log"])


class DailyLogInput(BaseModel):
    model_config = ConfigDict(extra='ignore')

    log_date: date = Field(default_factory=date.today)
    subject_id: Optional[str] = None         # si None, usa el sujeto por defecto

    # Vector digestivo
    appetite_pct: Optional[int] = Field(None, ge=0, le=100)
    water_intake: Optional[str] = None       # 'none'|'low'|'normal'|'high'
    water_ml_est: Optional[int] = None
    stool: Optional[str] = None
    vomit_count: int = 0
    food_visits: Optional[int] = None    # veces que se acercó al plato
    water_visits: Optional[int] = None   # veces que fue al bebedero (indicador PU/PD)

    # Vector sensorial / neurológico
    hyperesthesia_score: Optional[int] = Field(None, ge=0, le=5)
    seizure_suspected: bool = False
    seizure_notes: Optional[str] = None

    # Vector motor
    mobility_notes: Optional[str] = None
    ataxia_observed: bool = False
    head_tilt_observed: bool = False

    # Vector emocional
    social_score: Optional[int] = Field(None, ge=0, le=5)
    purr_observed: Optional[bool] = None
    social_notes: Optional[str] = None

    # Vector sueño
    sleep_quality: Optional[int] = Field(None, ge=0, le=5)
    sleep_notes: Optional[str] = None

    # Contexto
    environment_notes: Optional[str] = None
    observations: Optional[str] = None
    caretaker_state: Optional[dict] = None
    logged_by: str = "pedro"


async def _get_default_subject_id(pool) -> str:
    row = await pool.fetchrow(
        "SELECT id FROM subjects WHERE name = 'Sanji' LIMIT 1"
    )
    if not row:
        raise HTTPException(status_code=404, detail="Sujeto 'Sanji' no encontrado. Ejecutá el seed primero.")
    return str(row["id"])


@router.post("")
async def submit_log(body: DailyLogInput):
    pool = await get_pool()
    subject_id = body.subject_id or await _get_default_subject_id(pool)

    data = body.dict()
    data["subject_id"] = subject_id

    # asyncpg necesita JSONB como string serializado
    caretaker_state_json = json.dumps(body.caretaker_state) if body.caretaker_state else None

    # Upsert: si ya hay log de hoy, actualiza
    existing = await pool.fetchrow(
        "SELECT id FROM daily_log WHERE subject_id=$1 AND log_date=$2",
        subject_id, body.log_date,
    )

    if existing:
        await pool.execute(
            """
            UPDATE daily_log SET
              appetite_pct=$3, water_intake=$4, water_ml_est=$5, stool=$6,
              vomit_count=$7, hyperesthesia_score=$8, seizure_suspected=$9,
              seizure_notes=$10, mobility_notes=$11, ataxia_observed=$12,
              head_tilt_observed=$13, social_score=$14, purr_observed=$15,
              social_notes=$16, sleep_quality=$17, sleep_notes=$18,
              environment_notes=$19, observations=$20,
              caretaker_state=$21, logged_by=$22, logged_at=NOW(),
              food_visits=$23, water_visits=$24
            WHERE subject_id=$1 AND log_date=$2
            """,
            subject_id, body.log_date,
            body.appetite_pct, body.water_intake, body.water_ml_est, body.stool,
            body.vomit_count, body.hyperesthesia_score, body.seizure_suspected,
            body.seizure_notes, body.mobility_notes, body.ataxia_observed,
            body.head_tilt_observed, body.social_score, body.purr_observed,
            body.social_notes, body.sleep_quality, body.sleep_notes,
            body.environment_notes, body.observations,
            caretaker_state_json, body.logged_by,
            body.food_visits, body.water_visits,
        )
        log_id = str(existing["id"])
    else:
        row = await pool.fetchrow(
            """
            INSERT INTO daily_log (
              subject_id, log_date,
              appetite_pct, water_intake, water_ml_est, stool,
              vomit_count, hyperesthesia_score, seizure_suspected, seizure_notes,
              mobility_notes, ataxia_observed, head_tilt_observed,
              social_score, purr_observed, social_notes,
              sleep_quality, sleep_notes,
              environment_notes, observations, caretaker_state, logged_by,
              food_visits, water_visits
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
            ) RETURNING id
            """,
            subject_id, body.log_date,
            body.appetite_pct, body.water_intake, body.water_ml_est, body.stool,
            body.vomit_count, body.hyperesthesia_score, body.seizure_suspected,
            body.seizure_notes, body.mobility_notes, body.ataxia_observed,
            body.head_tilt_observed, body.social_score, body.purr_observed,
            body.social_notes, body.sleep_quality, body.sleep_notes,
            body.environment_notes, body.observations, caretaker_state_json,
            body.logged_by, body.food_visits, body.water_visits,
        )
        log_id = str(row["id"])

    # Evaluar banderas rojas y crear alertas si corresponde
    red_flag_alerts = check_red_flags(data)
    if red_flag_alerts:
        for alert in red_flag_alerts:
            await pool.execute(
                """
                INSERT INTO alerts (subject_id, level, kind, message_es,
                  action_required_es, evidence_refs)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                """,
                subject_id,
                alert["level"],
                alert["kind"],
                alert["message_es"],
                alert.get("action_required_es"),
                json.dumps(alert.get("evidence_refs", [])),
            )

    return {
        "status": "ok",
        "log_id": log_id,
        "date": str(body.log_date),
        "alerts_generated": len(red_flag_alerts),
    }


@router.get("/{log_date}")
async def get_log(log_date: date, subject_id: Optional[str] = None):
    pool = await get_pool()
    sid = subject_id or await _get_default_subject_id(pool)

    row = await pool.fetchrow(
        "SELECT * FROM daily_log WHERE subject_id=$1 AND log_date=$2",
        sid, log_date,
    )
    if not row:
        return {"status": "not_found", "date": str(log_date)}
    return {"status": "ok", "log": dict(row)}


@router.get("")
async def list_logs(subject_id: Optional[str] = None, limit: int = 14):
    pool = await get_pool()
    sid = subject_id or await _get_default_subject_id(pool)

    rows = await pool.fetch(
        "SELECT * FROM daily_log WHERE subject_id=$1 ORDER BY log_date DESC LIMIT $2",
        sid, limit,
    )
    return {"status": "ok", "logs": [dict(r) for r in rows]}
