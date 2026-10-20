"""Reglas de contraseña de Fútbol Vaquero. El hash (scrypt) vive en `accounts`, compartido con el resto de apps."""

from __future__ import annotations

from accounts.application.credentials import burn_time, hash_password, verify_password
from futbol.application.errors import Invalid

__all__ = ["burn_time", "hash_password", "validate_password", "verify_password"]

MIN_LENGTH = 8
MAX_LENGTH = 128


def validate_password(password: str) -> None:
    if len(password) < MIN_LENGTH:
        raise Invalid(f"La contraseña necesita al menos {MIN_LENGTH} caracteres.")
    if len(password) > MAX_LENGTH:
        raise Invalid(f"La contraseña puede tener hasta {MAX_LENGTH} caracteres.")
