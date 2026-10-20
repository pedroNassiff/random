"""Facturas emitidas: clasificación por tipo de operación, controles y bases por trimestre.

Funciones puras. No calculan el resultado de ningún modelo: dejan las bases que el 303, el 130 y el 349
necesitan, cada una con las facturas que la componen.
"""

from __future__ import annotations

import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from fiscal.domain.errors import FiscalRuleError

Operation = Literal["nacional", "intracomunitaria", "extracomunitaria"]
# Estados miembros de la UE distintos de España (ISO 3166-1 alfa-2; Grecia usa EL en el VAT, GR en ISO).
EU_COUNTRIES = frozenset("AT BE BG HR CY CZ DK EE FI FR DE GR EL HU IE IT LV LT LU MT NL PL PT RO SK SI SE".split())
IVA_GENERAL = Decimal("21")
RETENCIONES = (Decimal("0"), Decimal("7"), Decimal("15"))
_CENT = Decimal("0.01")
MENCION_INTRACOMUNITARIA = "Inversión del sujeto pasivo (art. 84.Uno.2º LIVA)"
MENCION_EXTRACOMUNITARIA = "Operación no sujeta, art. 69.Uno.1º LIVA"
# Casillas del 303 según el tipo de operación (spec § Motor de cálculo).
CASILLAS: dict[Operation, str] = {
    "nacional": "303: casillas 07 (base) y 09 (cuota)",
    "intracomunitaria": "303: casilla 59 · modelo 349",
    "extracomunitaria": "303: casilla 120",
}


def operation_for(pais: str, empresa: bool, tax_id: str | None) -> Operation:
    """Tipo de operación según el cliente: decide la mención de la factura y la casilla del 303."""
    if pais == "ES":
        return "nacional"
    if pais in EU_COUNTRIES:
        # Cliente UE sin VAT (particular): tributa como una operación interior.
        return "intracomunitaria" if empresa and tax_id else "nacional"
    return "extracomunitaria"


def money(value: Decimal) -> Decimal:
    return value.quantize(_CENT, rounding=ROUND_HALF_UP)


def _fold(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return plain.casefold()


@dataclass(frozen=True)
class Invoice:
    serie: str
    numero: int
    fecha: date
    fecha_devengo: date
    cliente: str
    cliente_pais: str
    cliente_tax_id: str | None
    cliente_empresa: bool
    concepto: str
    moneda: str
    importe: Decimal
    """Base en la moneda de la factura."""
    tipo_cambio: Decimal
    """Euros por unidad de la moneda de la factura (1 si es EUR)."""
    tipo_iva: Decimal
    retencion_pct: Decimal
    mencion: str
    documento_id: str | None = None
    anulada: bool = False
    id: str = ""

    @property
    def base(self) -> Decimal:
        return money(self.importe * self.tipo_cambio)

    @property
    def cuota_iva(self) -> Decimal:
        return money(self.base * self.tipo_iva / 100)

    @property
    def retencion(self) -> Decimal:
        return money(self.base * self.retencion_pct / 100)

    @property
    def total(self) -> Decimal:
        return self.base + self.cuota_iva - self.retencion

    @property
    def trimestre(self) -> int:
        """El IVA se devenga con la operación, no con el cobro: manda la fecha de devengo."""
        return (self.fecha_devengo.month - 1) // 3 + 1

    @property
    def operacion(self) -> Operation:
        return operation_for(self.cliente_pais, self.cliente_empresa, self.cliente_tax_id)


def validated(invoice: Invoice, today: date) -> Invoice:
    """Devuelve la factura normalizada o lanza FiscalRuleError con el primer dato inválido."""
    cliente, concepto = invoice.cliente.strip(), invoice.concepto.strip()
    pais, moneda = invoice.cliente_pais.strip().upper(), invoice.moneda.strip().upper()
    checks = (
        (invoice.numero < 1, "El número de factura debe ser 1 o mayor."),
        (not cliente, "Falta el cliente."),
        (not concepto, "Falta el concepto."),
        (len(pais) != 2 or not pais.isalpha(), "El país del cliente va en código de dos letras (ES, IT, US…)."),
        (len(moneda) != 3 or not moneda.isalpha(), "La moneda va en código de tres letras (EUR, USD…)."),
        (invoice.importe <= 0, "El importe debe ser mayor que cero."),
        (invoice.tipo_cambio <= 0, "El tipo de cambio debe ser mayor que cero."),
        (moneda == "EUR" and invoice.tipo_cambio != 1, "Una factura en euros no lleva tipo de cambio."),
        (not Decimal("0") <= invoice.tipo_iva <= IVA_GENERAL, "El tipo de IVA debe estar entre 0 y 21."),
        (invoice.retencion_pct not in RETENCIONES, "La retención de IRPF debe ser 0, 7 o 15."),
        (invoice.fecha > today or invoice.fecha_devengo > today, "La factura no puede tener fecha futura."),
    )
    for failed, message in checks:
        if failed:
            raise FiscalRuleError(message)
    return replace(
        invoice,
        serie=invoice.serie.strip().upper(),
        cliente=cliente,
        concepto=concepto,
        cliente_pais=pais,
        moneda=moneda,
        cliente_tax_id=(invoice.cliente_tax_id or "").strip().upper() or None,
        mencion=invoice.mencion.strip(),
    )


def _mention_issue(invoice: Invoice) -> str | None:
    mention = _fold(invoice.mencion)
    if invoice.operacion == "intracomunitaria" and "inversion del sujeto pasivo" not in mention:
        return f'Mención incorrecta: debe decir "{MENCION_INTRACOMUNITARIA}".'
    if invoice.operacion == "extracomunitaria" and "no sujeta" not in mention:
        return f'Mención incorrecta: debe decir "{MENCION_EXTRACOMUNITARIA}".'
    return None


def invoice_issues(invoice: Invoice) -> tuple[str, ...]:
    """Problemas formales de una factura. Lista vacía = sin observaciones."""
    issues: list[str] = []
    foreign = invoice.operacion != "nacional"
    if mention := _mention_issue(invoice):
        issues.append(mention)
    if foreign and invoice.tipo_iva != 0:
        issues.append("No debería llevar IVA español: la operación no está sujeta en España.")
    if foreign and invoice.retencion_pct != 0:
        issues.append("No debería llevar retención de IRPF: el cliente no es español.")
    if not foreign and invoice.tipo_iva == 0:
        issues.append("Sin IVA en una operación interior: revisar si corresponde el 21%.")
    if invoice.cliente_pais in EU_COUNTRIES and invoice.operacion == "nacional":
        issues.append("Cliente de la UE sin VAT de empresa: se trata como operación interior. Revisar con un asesor.")
    if invoice.moneda != "EUR" and invoice.tipo_cambio == 1:
        issues.append(f"Falta el tipo de cambio oficial {invoice.moneda}/EUR de la fecha de devengo.")
    return tuple(issues)


def numbering_issues(invoices: Sequence[Invoice]) -> tuple[str, ...]:
    """Huecos, duplicados y fechas fuera de orden, por serie y año de expedición."""
    issues: list[str] = []
    series: dict[tuple[str, int], list[Invoice]] = {}
    for inv in invoices:
        if not inv.anulada:
            series.setdefault((inv.serie, inv.fecha.year), []).append(inv)
    for (serie, year), group in sorted(series.items()):
        label = f"Serie {serie or 'única'} {year}"
        group.sort(key=lambda i: (i.numero, i.fecha))
        numbers = [i.numero for i in group]
        for n in sorted({n for n in numbers if numbers.count(n) > 1}):
            issues.append(f"{label}: el número {n} está repetido.")
        missing = sorted(set(range(1, max(numbers) + 1)) - set(numbers))
        if missing:
            issues.append(f"{label}: faltan los números {', '.join(map(str, missing))}.")
        for prev, cur in zip(group, group[1:], strict=False):
            if cur.numero > prev.numero and cur.fecha < prev.fecha:
                issues.append(
                    f"{label}: la factura {cur.numero} ({cur.fecha:%d/%m/%Y}) tiene fecha anterior "
                    f"a la {prev.numero} ({prev.fecha:%d/%m/%Y})."
                )
    return tuple(issues)


@dataclass(frozen=True)
class OperationTotal:
    operacion: Operation
    casillas: str
    base: Decimal
    cuota_iva: Decimal
    retencion: Decimal
    facturas: tuple[str, ...]
    """Traza: número y cliente de cada factura que compone la base."""


@dataclass(frozen=True)
class EuClientTotal:
    tax_id: str
    cliente: str
    base: Decimal


@dataclass(frozen=True)
class QuarterSummary:
    ejercicio: int
    trimestre: int
    operaciones: tuple[OperationTotal, ...]
    clientes_ue: tuple[EuClientTotal, ...]
    """Entrada del modelo 349: base del trimestre por cliente intracomunitario."""
    con_observaciones: int


def quarter_summary(invoices: Sequence[Invoice], ejercicio: int, trimestre: int) -> QuarterSummary:
    if trimestre not in (1, 2, 3, 4):
        raise FiscalRuleError("El trimestre debe ser 1, 2, 3 o 4.")
    selected = sorted(
        (i for i in invoices if not i.anulada and i.fecha_devengo.year == ejercicio and i.trimestre == trimestre),
        key=lambda i: (i.fecha_devengo, i.numero),
    )
    totals: list[OperationTotal] = []
    for operacion, casillas in CASILLAS.items():
        group = [i for i in selected if i.operacion == operacion]
        totals.append(
            OperationTotal(
                operacion,
                casillas,
                sum((i.base for i in group), Decimal("0.00")),
                sum((i.cuota_iva for i in group), Decimal("0.00")),
                sum((i.retencion for i in group), Decimal("0.00")),
                tuple(f"{i.numero}/{i.fecha.year} {i.cliente}" for i in group),
            )
        )
    by_client: dict[str, EuClientTotal] = {}
    for i in selected:
        if i.operacion == "intracomunitaria" and i.cliente_tax_id:
            current = by_client.get(i.cliente_tax_id)
            base = i.base + (current.base if current else Decimal("0.00"))
            by_client[i.cliente_tax_id] = EuClientTotal(i.cliente_tax_id, i.cliente, base)
    return QuarterSummary(
        ejercicio,
        trimestre,
        tuple(totals),
        tuple(sorted(by_client.values(), key=lambda c: c.tax_id)),
        sum(1 for i in selected if invoice_issues(i)),
    )
