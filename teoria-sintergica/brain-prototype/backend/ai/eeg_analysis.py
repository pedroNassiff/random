"""
EEG Analysis — port Python del analyzeSession() del frontend.

Calcula score, fases, eventos de mind-wandering y comparación
con literatura de mindfulness. Trabaja sobre la lista de métricas
que devuelve InfluxDB (array de dicts con keys alpha, theta, beta,
gamma, delta, coherence).
"""

from typing import List, Dict, Optional
from statistics import mean


# ── Umbrales de referencia (literatura mindfulness/meditación) ────────────────
LITERATURE_REFS = {
    "alpha":     {"min": 0.08, "max": 0.25, "label": "α alpha"},
    "theta":     {"min": 0.15, "max": 0.35, "label": "θ theta"},
    "beta":      {"min": 0.00, "max": 0.05, "label": "β beta (bajo=bueno)"},
    "coherence": {"min": 0.50, "max": 0.80, "label": "coherencia"},
}

# Umbral sintérgico teórico (α≥0.25, coherencia≥0.75)
SYNTERGY_ALPHA_THRESHOLD = 0.25
SYNTERGY_COH_THRESHOLD = 0.75


def _avg(series: List[float]) -> float:
    return mean(series) if series else 0.0


def analyze_session(metrics: List[Dict]) -> Optional[Dict]:
    """
    Analiza las métricas EEG de una sesión y devuelve un dict con:
    - score (0-100), fases detectadas, eventos mind-wandering,
      distribución de tiempo, comparación con literatura,
      proximidad sintérgica.

    Devuelve None si hay menos de 5 puntos de datos.
    """
    if not metrics or len(metrics) < 5:
        return None

    n = len(metrics)

    alpha_s = [m.get("alpha", 0.0) for m in metrics]
    theta_s = [m.get("theta", 0.0) for m in metrics]
    beta_s  = [m.get("beta",  0.0) for m in metrics]
    coh_s   = [m.get("coherence", 0.0) for m in metrics]

    avg_alpha = _avg(alpha_s)
    max_alpha = max(alpha_s)
    avg_theta = _avg(theta_s)
    avg_beta  = _avg(beta_s)
    avg_coh   = _avg(coh_s)

    # ── Score (0–100) ──────────────────────────────────────────────────────────
    score = round(
        min(30, (avg_alpha / 0.12) * 30)
        + min(20, (avg_theta / 0.25) * 20)
        + min(20, (avg_coh   / 0.65) * 20)
        + min(15, max(0, (1 - avg_beta / 0.05)) * 15)
        + min(15, (sum(1 for a in alpha_s if a >= 0.13) / n) * 100)
    )

    # ── Fases ─────────────────────────────────────────────────────────────────
    window = max(5, n // 12)
    phases = []
    for i in range(0, n, window):
        sl = slice(i, i + window)
        a = _avg(alpha_s[sl])
        t = _avg(theta_s[sl])
        c = _avg(coh_s[sl])
        label = ("deep" if a >= 0.13 else
                 "meditation" if a >= 0.08 else
                 "building"   if a >= 0.04 else
                 "onset")
        phases.append({"idx": i, "frac": i / n, "alpha": a, "theta": t, "coh": c, "label": label})

    # ── Eventos de mind-wandering (caídas bruscas de α) ───────────────────────
    sw = max(3, n // 20)
    events = []
    i = sw
    while i < n - sw:
        before = _avg(alpha_s[max(0, i - sw):i])
        after  = _avg(alpha_s[i:i + sw])
        if before > 0.08 and after < before * 0.5:
            events.append({
                "idx": i,
                "frac": i / n,
                "before": before,
                "after": after,
                "drop_pct": round((before - after) / before * 100, 1),
            })
            i += sw
        else:
            i += 1

    # ── Distribución de tiempo ─────────────────────────────────────────────────
    time_deep     = sum(1 for a in alpha_s if a >= 0.13) / n
    time_med      = sum(1 for a in alpha_s if 0.08 <= a < 0.13) / n
    time_building = sum(1 for a in alpha_s if 0.04 <= a < 0.08) / n
    time_onset    = sum(1 for a in alpha_s if a < 0.04) / n

    # ── Literatura ────────────────────────────────────────────────────────────
    def _lit_status(value: float, ref_min: float, ref_max: float, invert: bool = False) -> str:
        if invert:
            return "✓ bajo y estable" if value <= ref_max else "↗ elevado"
        if value < ref_min:
            return "↘ bajo (en desarrollo)"
        if value > ref_max:
            return "↗ por encima del rango"
        return "✓ dentro del rango"

    literature = {
        "alpha":     {"value": avg_alpha, "status": _lit_status(avg_alpha, 0.08, 0.25), "ref": "0.08–0.25"},
        "theta":     {"value": avg_theta, "status": _lit_status(avg_theta, 0.15, 0.35), "ref": "0.15–0.35"},
        "beta":      {"value": avg_beta,  "status": _lit_status(avg_beta,  0.00, 0.05, invert=True), "ref": "<0.05"},
        "coherence": {"value": avg_coh,   "status": _lit_status(avg_coh,   0.50, 0.80), "ref": "0.50–0.80"},
    }

    # ── Proximidad sintérgica ─────────────────────────────────────────────────
    syntergy = _syntergy_proximity(max_alpha, avg_coh)

    # ── Label del score ───────────────────────────────────────────────────────
    score_label = (
        "Excelente"      if score >= 75 else
        "Buena"          if score >= 55 else
        "En desarrollo"  if score >= 35 else
        "Iniciando"
    )

    return {
        "score": score,
        "score_label": score_label,
        "avg_alpha": round(avg_alpha, 4),
        "max_alpha": round(max_alpha, 4),
        "avg_theta": round(avg_theta, 4),
        "avg_beta":  round(avg_beta,  4),
        "avg_coh":   round(avg_coh,   4),
        "n_samples": n,
        "phases": phases,
        "events": events,
        "time_distribution": {
            "deep":     round(time_deep,     3),
            "meditation": round(time_med,    3),
            "building": round(time_building, 3),
            "onset":    round(time_onset,    3),
        },
        "literature": literature,
        "syntergy": syntergy,
    }


def _syntergy_proximity(max_alpha: float, avg_coh: float) -> Dict:
    """Estima qué tan cerca está el practicante del estado sintérgico teórico."""
    alpha_gap = max(0.0, SYNTERGY_ALPHA_THRESHOLD - max_alpha)
    coh_gap   = max(0.0, SYNTERGY_COH_THRESHOLD   - avg_coh)

    alpha_pct = min(100, (max_alpha / SYNTERGY_ALPHA_THRESHOLD) * 100)
    coh_pct   = min(100, (avg_coh   / SYNTERGY_COH_THRESHOLD)   * 100)

    reached = max_alpha >= SYNTERGY_ALPHA_THRESHOLD and avg_coh >= SYNTERGY_COH_THRESHOLD

    if reached:
        msg = "🌟 ¡Estado sintérgico alcanzado! α≥0.25 y coherencia≥0.75."
    elif alpha_gap <= 0.02 and coh_gap <= 0.05:
        msg = f"🔥 Muy cerca del estado sintérgico. Falta α +{alpha_gap:.3f} y coherencia +{coh_gap:.2f}."
    elif alpha_pct >= 70 or coh_pct >= 70:
        msg = f"📈 Progreso sólido. α al {alpha_pct:.0f}% del umbral sintérgico."
    else:
        msg = f"🌱 En desarrollo. α al {alpha_pct:.0f}% del umbral (0.25), coherencia al {coh_pct:.0f}% (0.75)."

    return {
        "reached": reached,
        "alpha_pct": round(alpha_pct, 1),
        "coh_pct":   round(coh_pct,   1),
        "alpha_gap": round(alpha_gap,  4),
        "coh_gap":   round(coh_gap,    4),
        "message":   msg,
    }
