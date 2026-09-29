"""Errores de aplicación. La capa de transporte los traduce a códigos HTTP."""

from __future__ import annotations


class FutbolError(Exception):
    """Base de los errores esperados de los casos de uso."""


class Unauthorized(FutbolError):
    """Sin sesión válida o link vencido/usado."""


class Forbidden(FutbolError):
    """Sesión válida pero sin permiso para la acción."""


class NotFound(FutbolError):
    pass


class Invalid(FutbolError):
    """Datos de entrada que violan una regla de negocio."""
