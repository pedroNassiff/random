"""Errores de sesión. La capa de transporte los traduce a códigos HTTP."""

from __future__ import annotations


class AccountError(Exception):
    """Base de los errores esperados de cuentas y sesión."""


class Unauthorized(AccountError):
    """Sin sesión válida o credenciales incorrectas."""


class Forbidden(AccountError):
    """Sesión válida pero sin acceso a la app pedida."""
