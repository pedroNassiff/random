"""Clientes: los datos que una factura necesita y lo que de ellos se deriva (operación, mención, casilla)."""

from __future__ import annotations

import re
from dataclasses import dataclass, replace
from datetime import datetime
from decimal import Decimal
from typing import Literal, get_args

from fiscal.domain.errors import FiscalRuleError
from fiscal.domain.invoices import (
    CASILLAS,
    EU_COUNTRIES,
    MENCION_EXTRACOMUNITARIA,
    MENCION_INTRACOMUNITARIA,
    RETENCIONES,
    Operation,
    operation_for,
)

ClientType = Literal["empresa", "autonomo", "particular"]
TIPOS: tuple[ClientType, ...] = get_args(ClientType)
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_DIAS_PAGO = 365


@dataclass(frozen=True)
class Client:
    nombre: str
    pais: str
    tipo: ClientType
    tax_id: str | None
    direccion: str
    """Domicilio del cliente: dato obligatorio de la factura (RD 1619/2012 art. 6)."""
    email: str | None = None
    moneda: str = "EUR"
    retencion_pct: Decimal = Decimal("0")
    """Retención de IRPF que aplica este cliente: solo empresas y profesionales españoles."""
    dias_pago: int | None = None
    vinculada: bool = False
    """Sociedad propia o de un familiar: sus operaciones van a valor de mercado (LIS art. 18)."""
    notas: str = ""
    vies_ok: bool | None = None
    vies_checked_at: datetime | None = None
    vies_nombre: str | None = None
    activo: bool = True
    codigo: int = 0
    id: str = ""

    @property
    def es_empresa(self) -> bool:
        """Empresario o profesional (B2B), a efectos de localización del servicio."""
        return self.tipo != "particular"

    @property
    def operacion(self) -> Operation:
        return operation_for(self.pais, self.es_empresa, self.tax_id)

    @property
    def mencion(self) -> str:
        """Mención legal que deben llevar sus facturas ('' si no hace falta ninguna)."""
        return {
            "nacional": "",
            "intracomunitaria": MENCION_INTRACOMUNITARIA,
            "extracomunitaria": MENCION_EXTRACOMUNITARIA,
        }[self.operacion]

    @property
    def casillas(self) -> str:
        return CASILLAS[self.operacion]

    @property
    def requiere_vies(self) -> bool:
        return self.operacion == "intracomunitaria"


def validated(client: Client) -> Client:
    """Devuelve el cliente normalizado o lanza FiscalRuleError con el primer dato inválido."""
    nombre = client.nombre.strip()
    pais, moneda = client.pais.strip().upper(), client.moneda.strip().upper()
    tax_id = re.sub(r"[\s.-]", "", client.tax_id or "").upper() or None
    email = (client.email or "").strip() or None
    español = pais == "ES"
    checks = (
        (not nombre, "Falta el nombre del cliente."),
        (len(pais) != 2 or not pais.isalpha(), "El país va en código de dos letras (ES, IT, US…)."),
        (client.tipo not in TIPOS, "El tipo debe ser empresa, autónomo o particular."),
        (len(moneda) != 3 or not moneda.isalpha(), "La moneda va en código de tres letras (EUR, USD…)."),
        (email is not None and not _EMAIL.match(email), "El email no es válido."),
        (client.retencion_pct not in RETENCIONES, "La retención de IRPF debe ser 0, 7 o 15."),
        (
            client.retencion_pct != 0 and (not español or client.tipo == "particular"),
            "Solo retienen IRPF las empresas y profesionales españoles.",
        ),
        (
            client.dias_pago is not None and not 0 <= client.dias_pago <= MAX_DIAS_PAGO,
            f"El plazo de pago debe estar entre 0 y {MAX_DIAS_PAGO} días.",
        ),
        (
            client.tipo != "particular" and (español or pais in EU_COUNTRIES) and tax_id is None,
            "Falta el NIF o VAT: es obligatorio en la factura a una empresa o profesional de España o de la UE.",
        ),
    )
    for failed, message in checks:
        if failed:
            raise FiscalRuleError(message)
    return replace(
        client,
        nombre=nombre,
        pais=pais,
        moneda=moneda,
        tax_id=tax_id,
        email=email,
        direccion=client.direccion.strip(),
        notas=client.notas.strip(),
    )


def client_issues(client: Client) -> tuple[str, ...]:
    """Lo que falta o conviene revisar antes de facturarle."""
    issues: list[str] = []
    if not client.direccion:
        issues.append("Falta el domicilio: es un dato obligatorio de la factura.")
    if client.requiere_vies and client.vies_ok is None:
        issues.append("VAT sin comprobar en VIES: sin esa validación no corresponde facturar sin IVA.")
    if client.requiere_vies and client.vies_ok is False:
        issues.append("El VAT no figura como válido en VIES: no corresponde la inversión del sujeto pasivo.")
    if client.pais in EU_COUNTRIES and client.operacion == "nacional":
        issues.append("Cliente de la UE sin VAT de empresa: se le factura con IVA español. Revisar con un asesor.")
    if client.vinculada:
        issues.append("Operación vinculada: el precio debe ser de mercado y conviene documentarlo.")
    return tuple(issues)
