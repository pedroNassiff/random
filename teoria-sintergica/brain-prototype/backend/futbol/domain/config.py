"""Constantes del dominio (ALGORITHMS §1). Se pueden sobreescribir desde groups.balancer_config."""

from __future__ import annotations

MIN_RATERS = 3
"""Mínimo de raters pares para usar la mediana de pares."""

UNKNOWN_DEFAULT = 5.0
"""Valor de una skill sin datos (ni 3 pares ni admin): "no sabemos cómo juega" = 5 (decisión del grupo,
29/09/2026; reemplaza la media del grupo de ALGORITHMS §1.2 paso 4)."""

GOALKEEPING_KEY = "goalkeeping"
"""Skill especial: no entra al compuesto, solo reparte arqueros."""
