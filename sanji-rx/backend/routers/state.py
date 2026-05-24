"""
Router de alertas y estado global — GET /sanji/state + /sanji/alerts
"""

from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import APIRouter
from database.postgres import get_pool
from core.alerts import check_medication_due, check_trend_alerts, should_generate_weekly_summary
import json

router = APIRouter(prefix="/sanji", tags=["state"])


def _serialize_log(row) -> dict:
    """Convierte un asyncpg Record de daily_log a dict con JSONB parseado."""
    d = dict(row)
    cs = d.get("caretaker_state")
    if isinstance(cs, str):
        try:
            d["caretaker_state"] = json.loads(cs)
        except (ValueError, TypeError):
            d["caretaker_state"] = None
    return d


async def _get_default_subject_id(pool) -> str:
    row = await pool.fetchrow("SELECT id FROM subjects WHERE name='Sanji' LIMIT 1")
    if not row:
        return None
    return str(row["id"])


@router.get("/state")
async def get_state():
    """
    Estado completo actual de Sanji: subject, medicamentos activos,
    log de hoy, alertas no leídas, adherencia a medicación.
    """
    pool = await get_pool()
    sid = await _get_default_subject_id(pool)
    if not sid:
        return {"status": "no_subject", "message": "Ejecutá el seed primero."}

    today = date.today()
    now = datetime.now()

    # Datos del sujeto
    subject = dict(await pool.fetchrow("SELECT * FROM subjects WHERE id=$1", sid))

    # Medicamentos activos
    meds = [dict(r) for r in await pool.fetch(
        "SELECT * FROM medications WHERE subject_id=$1 AND ended_at IS NULL ORDER BY created_at",
        sid,
    )]

    # Administraciones de hoy
    admins_today = [dict(r) for r in await pool.fetch(
        """SELECT * FROM medication_administrations
           WHERE subject_id=$1 AND scheduled_at::date = $2
        """,
        sid, today,
    )]

    # Generar alertas de medicación pendiente en memoria (no persisten aquí)
    med_alerts = check_medication_due(meds, admins_today, now)

    # Logs recientes para detección de tendencias (últimos 3 días)
    three_days_ago = today - timedelta(days=3)
    recent_logs = [dict(r) for r in await pool.fetch(
        """SELECT hyperesthesia_score, appetite_pct, social_score, sleep_quality, log_date
           FROM daily_log WHERE subject_id=$1 AND log_date >= $2
           ORDER BY log_date DESC
        """,
        sid, three_days_ago,
    )]
    trend_alerts = check_trend_alerts(recent_logs, meds)

    # Log de hoy
    log_today = await pool.fetchrow(
        "SELECT * FROM daily_log WHERE subject_id=$1 AND log_date=$2",
        sid, today,
    )

    # Alertas no leídas de la DB (banderas rojas + otras persistidas)
    db_alerts = [dict(r) for r in await pool.fetch(
        """SELECT * FROM alerts
           WHERE subject_id=$1 AND read_at IS NULL AND resolved_at IS NULL
           ORDER BY created_at DESC LIMIT 20
        """,
        sid,
    )]

    # Promedios últimos 7 días para contexto
    week_ago = today - timedelta(days=7)
    week_avg = await pool.fetchrow(
        """SELECT
             AVG(appetite_pct)        AS appetite_avg,
             AVG(hyperesthesia_score) AS hyperesthesia_avg,
             AVG(social_score)        AS social_avg,
             AVG(sleep_quality)       AS sleep_avg,
             COUNT(*)                 AS days_logged
           FROM daily_log
           WHERE subject_id=$1 AND log_date >= $2
        """,
        sid, week_ago,
    )

    # Último resumen semanal
    last_summary = await pool.fetchrow(
        "SELECT week_start FROM weekly_summaries WHERE subject_id=$1 ORDER BY week_start DESC LIMIT 1",
        sid,
    )
    last_summary_date = last_summary["week_start"] if last_summary else None
    weekly_due = should_generate_weekly_summary(last_summary_date)

    # Adherencia últimos 7 días
    total_scheduled = await pool.fetchval(
        """SELECT COUNT(*) FROM medication_administrations
           WHERE subject_id=$1 AND scheduled_at::date >= $2
        """,
        sid, week_ago,
    )
    total_given = await pool.fetchval(
        """SELECT COUNT(*) FROM medication_administrations
           WHERE subject_id=$1 AND scheduled_at::date >= $2 AND given=true
        """,
        sid, week_ago,
    )
    adherence_7d = round(total_given / total_scheduled * 100, 1) if total_scheduled else 100.0

    return {
        "status": "ok",
        "subject": {
            "id": subject["id"],
            "name": subject["name"],
            "weight_kg": subject.get("weight_kg"),
        },
        "medications_active": [
            {
                "id": str(m["id"]),
                "name": m["name"],
                "dose_description": m.get("dose_description"),
                "frequency_hours": m["frequency_hours"],
                "schedule_hours": m.get("schedule_hours") or [],
                "days_remaining": m.get("days_remaining"),
            }
            for m in meds
        ],
        "administrations_today": admins_today,
        "medication_alerts": med_alerts + trend_alerts,   # pendientes + tendencias
        "log_today": _serialize_log(log_today) if log_today else None,
        "alerts_unread": db_alerts,
        "weekly_summary_due": weekly_due,
        "week_stats": {
            "appetite_avg": round(float(week_avg["appetite_avg"]), 1) if week_avg["appetite_avg"] else None,
            "hyperesthesia_avg": round(float(week_avg["hyperesthesia_avg"]), 2) if week_avg["hyperesthesia_avg"] else None,
            "social_avg": round(float(week_avg["social_avg"]), 2) if week_avg["social_avg"] else None,
            "sleep_avg": round(float(week_avg["sleep_avg"]), 2) if week_avg["sleep_avg"] else None,
            "days_logged": int(week_avg["days_logged"]),
            "adherence_7d_pct": adherence_7d,
        },
    }


@router.post("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str):
    pool = await get_pool()
    await pool.execute(
        "UPDATE alerts SET read_at=NOW() WHERE id=$1",
        alert_id,
    )
    return {"status": "ok"}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    pool = await get_pool()
    await pool.execute(
        "UPDATE alerts SET resolved_at=NOW() WHERE id=$1",
        alert_id,
    )
    return {"status": "ok"}


@router.get("/alerts")
async def list_alerts(subject_id: Optional[str] = None, unread_only: bool = True):
    pool = await get_pool()
    sid = subject_id or await _get_default_subject_id(pool)
    if not sid:
        return {"alerts": []}

    query = "SELECT * FROM alerts WHERE subject_id=$1"
    if unread_only:
        query += " AND read_at IS NULL AND resolved_at IS NULL"
    query += " ORDER BY created_at DESC LIMIT 50"

    rows = await pool.fetch(query, sid)
    return {"status": "ok", "alerts": [dict(r) for r in rows]}


@router.get("/history")
async def get_history(days: int = 30):
    """
    Historial enriquecido: daily_log + conteo de fotos + avg FGS + resumen visual conjunto.
    Un item por día registrado, ordenado del más reciente al más antiguo.
    """
    pool = await get_pool()
    sid = await _get_default_subject_id(pool)
    if not sid:
        return []

    from_date = date.today() - timedelta(days=days)

    # --- Daily logs ---
    log_rows = await pool.fetch(
        """SELECT log_date, appetite_pct, hyperesthesia_score, social_score,
                  sleep_quality, vomit_count, water_visits, seizure_suspected,
                  observations, food_visits
           FROM daily_log
           WHERE subject_id=$1 AND log_date >= $2
           ORDER BY log_date DESC""",
        sid, from_date,
    )

    # --- Photo counts + avg FGS per day ---
    photo_rows = await pool.fetch(
        """SELECT log_date, COUNT(*) AS photo_count,
                  ROUND(AVG(fgs_score)::numeric, 1) AS avg_fgs,
                  bool_or(COALESCE(array_length(urgent_flags, 1), 0) > 0) AS has_urgent
           FROM vision_analysis
           WHERE subject_id=$1 AND log_date >= $2
           GROUP BY log_date""",
        sid, from_date,
    )
    photos_by_date = {str(r["log_date"]): r for r in photo_rows}

    # --- Vision day summaries ---
    summary_rows = await pool.fetch(
        "SELECT log_date, summary FROM vision_day_summaries WHERE log_date >= $1",
        from_date,
    )
    summaries_by_date = {str(r["log_date"]): r["summary"] for r in summary_rows}

    result = []
    for row in log_rows:
        d = str(row["log_date"])
        ph = photos_by_date.get(d, {})
        result.append({
            "log_date": d,
            "appetite_pct": row["appetite_pct"],
            "hyperesthesia_score": row["hyperesthesia_score"],
            "social_score": row["social_score"],
            "sleep_quality": row["sleep_quality"],
            "vomit_count": row["vomit_count"],
            "water_visits": row["water_visits"],
            "food_visits": row["food_visits"],
            "seizure_suspected": row["seizure_suspected"],
            "observations": row["observations"],
            "photo_count": int(ph.get("photo_count", 0)) if ph else 0,
            "avg_fgs": float(ph["avg_fgs"]) if ph and ph.get("avg_fgs") is not None else None,
            "has_urgent_vision": bool(ph.get("has_urgent", False)) if ph else False,
            "vision_summary": summaries_by_date.get(d),
        })

    return result
