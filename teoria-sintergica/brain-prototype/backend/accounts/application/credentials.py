"""Primitivas de credenciales: tokens (SHA-256) y contraseñas (scrypt, stdlib).

Formato del hash de contraseña: scrypt$n$r$p$salt_hex$hash_hex.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import timedelta

SESSION_TTL = timedelta(days=30)
_N, _R, _P, _DKLEN = 2**14, 8, 1, 64


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _derive(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, dklen=_DKLEN)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = _derive(password, salt, _N, _R, _P)
    return f"scrypt${_N}${_R}${_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = _derive(password, bytes.fromhex(salt_hex), int(n), int(r), int(p))
    except ValueError:
        return False
    return hmac.compare_digest(digest, bytes.fromhex(digest_hex))


# Hash de referencia para igualar el tiempo de respuesta cuando el email no existe.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def burn_time(password: str) -> None:
    verify_password(password, _DUMMY_HASH)
