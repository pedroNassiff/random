"""Migraciones destructivas: las que borran o cambian datos existentes. El builder no las publica solo."""

from __future__ import annotations

import re

_COMMENTS = re.compile(r"--[^\n]*|/\*.*?\*/", re.DOTALL)
_DESTRUCTIVE = (
    re.compile(r"^DROP\s+(TABLE|SCHEMA|VIEW|MATERIALIZED\s+VIEW|TYPE|SEQUENCE)\b"),
    re.compile(r"^TRUNCATE\b"),
    re.compile(r"^DELETE\s+FROM\b"),
    re.compile(r"^ALTER\s+TABLE\b.*\bDROP\s+(?!CONSTRAINT\b|DEFAULT\b|NOT\s+NULL\b|POLICY\b)"),
    re.compile(r"^ALTER\s+TABLE\b.*\bRENAME\b"),
    re.compile(r"^ALTER\s+TABLE\b.*\bALTER\s+(COLUMN\s+)?\S+\s+(SET\s+DATA\s+)?TYPE\b"),
)


def destructive_statements(sql: str) -> list[str]:
    """Las sentencias que borran tablas, columnas o filas, renombran o cambian el tipo de una columna."""
    found: list[str] = []
    for raw in _COMMENTS.sub("", sql).split(";"):
        statement = " ".join(raw.split())
        if any(p.search(statement.upper()) for p in _DESTRUCTIVE):
            found.append(statement)
    return found
