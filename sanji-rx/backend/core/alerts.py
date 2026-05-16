"""
Motor de alertas de SANJI-RX.

Responsabilidades:
- Generar alertas de medicación pendiente (cada vez que se consulta el estado)
- Detectar banderas rojas en el log diario
- Generar recordatorios de resumen semanal
- Marcar alertas como auto-resueltas cuando la condición desaparece
"""

from datetime import datetime, date, timedelta
from typing import List, Optional
import uuid


# ── Reglas duras de bandera roja ──────────────────────────────────────────────

def check_red_flags(log: dict) -> List[dict]:
    """
    Evalúa un daily_log contra las banderas rojas clínicas.
    Retorna lista de alertas a crear (pueden ser vacías).
    """
    alerts = []

    if log.get("appetite_pct") is not None and log["appetite_pct"] < 50:
        alerts.append({
            "level": "urgent",
            "kind": "red_flag_clinical",
            "message_es": (
                f"⚠️ Apetito muy bajo: {log['appetite_pct']}% de lo normal. "
                "Si se mantiene más de 24h, existe riesgo de lipidosis hepática."
            ),
            "action_required_es": (
                "Registrá si come en la próxima toma. "
                "Si sigue por debajo del 50% al cierre del día, contactá al veterinario hoy."
            ),
            "evidence_refs": [f"appetite_pct={log['appetite_pct']}"],
        })

    if log.get("vomit_count") and log["vomit_count"] >= 2:
        alerts.append({
            "level": "urgent",
            "kind": "red_flag_clinical",
            "message_es": (
                f"⚠️ {log['vomit_count']} vómitos en el día. "
                "En el contexto post-pancreatitis, esto amerita evaluación."
            ),
            "action_required_es": "Contactá al veterinario si los vómitos continúan.",
            "evidence_refs": [f"vomit_count={log['vomit_count']}"],
        })

    if log.get("seizure_suspected"):
        alerts.append({
            "level": "critical",
            "kind": "red_flag_clinical",
            "message_es": (
                "🔴 ALERTA: posible evento convulsivo registrado. "
                "Esto requiere evaluación veterinaria hoy."
            ),
            "action_required_es": (
                "Contactá al veterinario neurológico inmediatamente. "
                "Describí duración, tipo de movimientos, y estado post-ictal."
            ),
            "evidence_refs": [
                f"seizure_suspected=true",
                f"seizure_notes={log.get('seizure_notes', 'sin notas')}",
            ],
        })

    if log.get("hyperesthesia_score") and log["hyperesthesia_score"] >= 4:
        alerts.append({
            "level": "warning",
            "kind": "red_flag_clinical",
            "message_es": (
                f"Hipersensibilidad alta hoy (score {log['hyperesthesia_score']}/5). "
                "Reducir estímulos acústicos y lumínicos. "
                "Tener en cuenta que Morbovet (fluoroquinolona) puede reducir el umbral convulsivo."
            ),
            "action_required_es": (
                "Ambiente tranquilo el resto del día. "
                "Si coincide con dosis de Morbovet, anotarlo."
            ),
            "evidence_refs": [f"hyperesthesia_score={log['hyperesthesia_score']}"],
        })

    return alerts


# ── Alertas de tendencia multi-día ───────────────────────────────────────────

def check_trend_alerts(
    recent_logs: List[dict],
    medications: List[dict],
) -> List[dict]:
    """
    Detecta patrones de riesgo que requieren varios días de datos.

    recent_logs: últimos N logs ordenados DESC (hoy primero)
    medications: medicamentos activos
    """
    alerts = []
    if not recent_logs:
        return alerts

    med_names = [m.get("name", "").lower() for m in medications]
    morbovet_active = any("morbovet" in n or "marbofloxacina" in n for n in med_names)
    fenobarbital_active = any("soliphen" in n or "fenobarbital" in n for n in med_names)

    # ── 1. Cruce Morbovet + Fenobarbital activos simultáneamente ─────────────
    if morbovet_active and fenobarbital_active:
        alerts.append({
            "level": "warning",
            "kind": "drug_interaction",
            "message_es": (
                "⚠️ Morbovet (marbofloxacina) y Soliphen (fenobarbital) activos simultáneamente. "
                "Las fluoroquinolonas antagonizan GABA-A y pueden bajar el umbral convulsivo."
            ),
            "action_required_es": (
                "Observar hiperestesia, vocalización o agitación inusual. "
                "Ante cualquier evento motor sospechoso, contactar al veterinario."
            ),
            "evidence_refs": ["morbovet_active=true", "fenobarbital_active=true"],
        })

    # ── 2. Hiperestesia elevada ≥3 en 2+ días consecutivos ───────────────────
    hyper_scores = [
        l.get("hyperesthesia_score")
        for l in recent_logs[:3]
        if l.get("hyperesthesia_score") is not None
    ]
    days_elevated = sum(1 for s in hyper_scores if s >= 3)
    if days_elevated >= 2:
        trend_note = "con Morbovet activo" if morbovet_active else ""
        alerts.append({
            "level": "warning",
            "kind": "trend_hyperesthesia",
            "message_es": (
                f"📈 Hiperestesia elevada (≥3) registrada {days_elevated} días consecutivos {trend_note}. "
                f"Scores: {hyper_scores}. Patrón pre-ictal posible."
            ),
            "action_required_es": (
                "Reducir estímulos acústicos y lumínicos. "
                "Verificar adherencia estricta al Soliphen. "
                "Comunicar al veterinario si se mantiene mañana."
            ),
            "evidence_refs": [f"hyperesthesia_scores={hyper_scores}", f"days_elevated={days_elevated}"],
        })

    # ── 3. Apetito en descenso sostenido (<70%) en 2+ días ───────────────────
    appetite_scores = [
        l.get("appetite_pct")
        for l in recent_logs[:3]
        if l.get("appetite_pct") is not None
    ]
    days_low_appetite = sum(1 for a in appetite_scores if a < 70)
    if days_low_appetite >= 2:
        alerts.append({
            "level": "urgent",
            "kind": "trend_appetite",
            "message_es": (
                f"⚠️ Apetito bajo (<70%) registrado {days_low_appetite} días consecutivos. "
                f"Valores: {appetite_scores}%. Riesgo de lipidosis hepática si continúa."
            ),
            "action_required_es": (
                "Intentar estimulación con comida húmeda aromática. "
                "Si no mejora hoy, contactar al veterinario sin esperar."
            ),
            "evidence_refs": [f"appetite_pct_series={appetite_scores}"],
        })

    return alerts


# ── Alertas de medicación ────────────────────────────────────────────────────

def check_medication_due(
    medications: List[dict],
    administrations_today: List[dict],
    now: Optional[datetime] = None,
) -> List[dict]:
    """
    Para cada medicamento activo, verifica si hay tomas pendientes
    que ya deberían haberse dado según el schedule.

    medications: lista de dicts con campos de la tabla medications
    administrations_today: tomas ya registradas hoy (medication_id, scheduled_at, given)
    """
    if now is None:
        now = datetime.now()

    alerts = []

    def _local_hour(dt) -> int:
        """Extrae la hora LOCAL de un datetime (con o sin timezone)."""
        if hasattr(dt, 'tzinfo') and dt.tzinfo is not None:
            return dt.astimezone().hour
        return dt.hour

    # Índice de tomas ya dadas: (medication_id_str, hora_local_int)
    given_slots = {
        (str(a["medication_id"]), _local_hour(a["scheduled_at"]))
        for a in administrations_today
        if a.get("given") and a.get("scheduled_at") is not None
    }

    for med in medications:
        if not med.get("schedule_hours"):
            continue

        # Días restantes
        days_rem = med.get("days_remaining")
        if days_rem is not None and days_rem <= 0:
            continue

        for hour in med["schedule_hours"]:
            scheduled = now.replace(hour=hour, minute=0, second=0, microsecond=0)
            if scheduled > now:
                continue  # aún no toca

            if (str(med["id"]), hour) in given_slots:
                continue  # ya dada

            # Cuánto tiempo lleva de retraso
            delay_min = int((now - scheduled).total_seconds() / 60)

            level = "info" if delay_min < 30 else "warning" if delay_min < 120 else "urgent"
            dose_desc = med.get("dose_description") or f"{med.get('dose_mg')} mg"

            days_note = (
                f" (quedan {days_rem} días de tratamiento)" if days_rem is not None else ""
            )

            alerts.append({
                "level": level,
                "kind": "medication_due",
                "message_es": (
                    f"💊 {med['name']} pendiente — {dose_desc} a las {hour:02d}:00"
                    f"{days_note}. Retraso: {delay_min} min."
                ),
                "action_required_es": (
                    f"Dar {dose_desc} de {med['name']} ahora "
                    f"y registrar la toma."
                ),
                "evidence_refs": [
                    f"medication={med['name']}",
                    f"scheduled={hour:02d}:00",
                    f"delay_min={delay_min}",
                ],
                "medication_id": str(med["id"]),
                "scheduled_at": scheduled.isoformat(),
            })

    return alerts


# ── Alerta de resumen semanal ─────────────────────────────────────────────────

def should_generate_weekly_summary(last_summary_date: Optional[date], today: Optional[date] = None) -> bool:
    """
    Retorna True si toca generar resumen semanal (cada domingo).
    """
    if today is None:
        today = date.today()
    if today.weekday() != 6:  # 6 = domingo
        return False
    if last_summary_date is None:
        return True
    return last_summary_date < today


# ── Adherencia a medicación ───────────────────────────────────────────────────

def compute_medication_adherence(
    administrations: List[dict],
    since_date: date,
    until_date: Optional[date] = None,
) -> float:
    """
    Calcula porcentaje de tomas dadas / programadas en el rango.
    """
    if until_date is None:
        until_date = date.today()

    scheduled = [
        a for a in administrations
        if since_date <= a["scheduled_at"].date() <= until_date
    ]
    if not scheduled:
        return 100.0

    given = sum(1 for a in scheduled if a.get("given"))
    return round(given / len(scheduled) * 100, 1)
