"""
audit/application/scoring.py

Pure domain logic — no I/O. Scores and prioritizes findings.
"""
from ..domain.entities import Finding, AuditReport
from ..domain.enums import Severity, Category

_SEVERITY_WEIGHTS: dict[Severity, int] = {
    Severity.CRITICAL: 10,
    Severity.HIGH:      7,
    Severity.MEDIUM:    4,
    Severity.LOW:       2,
    Severity.INFO:      0,
}

# Industry-specific category multipliers
_INDUSTRY_MULTIPLIERS: dict[str, dict[Category, float]] = {
    "ecommerce": {
        Category.PERFORMANCE: 1.5,
        Category.PRIVACY:     1.3,
        Category.SECURITY:    1.2,
    },
    "fintech": {
        Category.SECURITY: 2.0,
        Category.PRIVACY:  1.5,
        Category.LEGAL:    1.5,
    },
    "media": {
        Category.PERFORMANCE: 1.7,
        Category.SEO:         1.5,
    },
    "saas": {
        Category.SECURITY:    1.4,
        Category.PERFORMANCE: 1.2,
    },
    "agency": {
        Category.SEO:          1.3,
        Category.ACCESSIBILITY: 1.3,
    },
}


def score_findings(findings: list[Finding], industry: str = "default") -> list[Finding]:
    """
    Sort findings by priority score.
    Score = severity_weight × category_multiplier × (1 + impact_boost).
    Mutates `finding.priority_score` in place.
    """
    cat_weights = _INDUSTRY_MULTIPLIERS.get(industry, {})

    for f in findings:
        base          = _SEVERITY_WEIGHTS[f.severity]
        cat_mult      = cat_weights.get(f.category, 1.0)
        impact_boost  = min((f.impact_eur_monthly or 0) / 1000, 2.0)  # cap at 2x
        f.priority_score = round(base * cat_mult * (1.0 + impact_boost), 4)

    return sorted(findings, key=lambda f: f.priority_score, reverse=True)


def compute_overall_scores(findings: list[Finding]) -> dict:
    """
    Score 0–100 per category and a global overall.
    100 = zero findings. Each finding deducts based on severity.
    Returns: { "overall": int, "breakdown": { cat: score } }
    """
    deductions: dict[str, float] = {c.value: 0.0 for c in Category}

    for f in findings:
        deductions[f.category.value] += _SEVERITY_WEIGHTS[f.severity] * 2

    breakdown = {
        cat: max(0, round(100 - ded))
        for cat, ded in deductions.items()
    }
    # Only include categories that had at least 1 finding or are key
    key_cats = [c.value for c in [
        Category.SECURITY, Category.PERFORMANCE, Category.SEO,
        Category.ACCESSIBILITY, Category.PRIVACY,
    ]]
    filtered = {k: v for k, v in breakdown.items() if k in key_cats}
    overall = round(sum(filtered.values()) / len(filtered)) if filtered else 100

    return {"overall": overall, "breakdown": breakdown}


def build_executive_md(
    run_id: str,
    root_url: str,
    findings: list[Finding],
    scores: dict,
    contact_name: str = "",
) -> str:
    """Generate a concise markdown executive summary."""
    top = findings[:5]
    total_eur = sum(f.impact_eur_monthly or 0 for f in findings if f.impact_eur_monthly)
    overall = scores.get("overall", 0)
    breakdown = scores.get("breakdown", {})

    lines = [
        f"# Audit Express — {root_url}",
        f"**Score global: {overall}/100**",
        "",
        "## Puntuación por categoría",
    ]
    for cat, score in breakdown.items():
        bar = "█" * (score // 10) + "░" * (10 - score // 10)
        lines.append(f"- **{cat.capitalize()}**: {score}/100 `{bar}`")

    if total_eur > 0:
        lines += [
            "",
            f"## Impacto económico estimado",
            f"**~{total_eur:.0f}€/mes** en costos evitables o pérdidas por conversion/rendimiento.",
        ]

    lines += ["", "## Top hallazgos críticos"]
    for i, f in enumerate(top, 1):
        badge = f.severity.value.upper()
        eur_note = f" · ~{f.impact_eur_monthly:.0f}€/mes" if f.impact_eur_monthly else ""
        lines.append(f"{i}. **[{badge}]** {f.title}{eur_note}")

    lines += [
        "",
        "---",
        "_Generado por Random Lab — Audit Express v1_",
    ]
    return "\n".join(lines)
