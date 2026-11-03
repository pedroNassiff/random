"""Nombre de la rama de un pedido: neo/<slug del módulo>."""

from __future__ import annotations

import re
import unicodedata


def slugify(modulo: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", modulo).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    if not slug:
        raise ValueError(f"El nombre del módulo no sirve para una rama: {modulo!r}")
    return slug


def branch_for(modulo: str) -> str:
    return f"neo/{slugify(modulo)}"
