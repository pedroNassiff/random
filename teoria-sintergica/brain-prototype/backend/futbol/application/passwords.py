"""Hash de contraseñas con scrypt (stdlib). Formato: scrypt$n$r$p$salt_hex$hash_hex."""

from __future__ import annotations

import hashlib
import hmac
import secrets

from futbol.application.errors import Invalid

MIN_LENGTH = 8
MAX_LENGTH = 128
_N, _R, _P, _DKLEN = 2**14, 8, 1, 64


def validate_password(password: str) -> None:
    if len(password) < MIN_LENGTH:
        raise Invalid(f"La contraseña necesita al menos {MIN_LENGTH} caracteres.")
    if len(password) > MAX_LENGTH:
        raise Invalid(f"La contraseña puede tener hasta {MAX_LENGTH} caracteres.")


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
