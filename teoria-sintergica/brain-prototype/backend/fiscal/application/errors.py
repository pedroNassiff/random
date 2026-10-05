"""Errores de aplicación. La capa de transporte los traduce a códigos HTTP."""

from __future__ import annotations


class FiscalError(Exception):
    """Base de los errores esperados de los casos de uso fiscales."""


class NotFound(FiscalError):
    pass


class Invalid(FiscalError):
    """Datos de entrada que violan una regla fiscal."""


class AgentUnavailable(FiscalError):
    """El modelo no está configurado o no respondió: el dashboard sigue funcionando sin el agente."""
