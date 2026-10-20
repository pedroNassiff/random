"""Facturas emitidas: clasificación, controles formales, numeración y bases por trimestre.

Los casos reproducen el patrón del caso piloto (cliente español, empresa italiana con VAT, empresa de
EE.UU. en dólares) con nombres de ejemplo.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from fiscal.application.errors import Invalid, NotFound
from fiscal.domain.errors import FiscalRuleError
from fiscal.domain.invoices import (
    Invoice,
    invoice_issues,
    money,
    numbering_issues,
    quarter_summary,
    validated,
)
from tests.fiscal.fakes import fake_invoices

TODAY = date(2026, 10, 1)
NOW = datetime(2026, 10, 1, 10, tzinfo=UTC)
D = Decimal


def inv(numero: int, fecha: date, **kw: object) -> Invoice:
    base = Invoice(
        serie="",
        numero=numero,
        fecha=fecha,
        fecha_devengo=fecha,
        cliente="Cliente Español SL",
        cliente_pais="ES",
        cliente_tax_id="B12345678",
        cliente_empresa=True,
        concepto="Desarrollo de software",
        moneda="EUR",
        importe=D("1000.00"),
        tipo_cambio=D("1"),
        tipo_iva=D("21"),
        retencion_pct=D("15"),
        mencion="",
    )
    return replace(base, **kw)  # type: ignore[arg-type]


def italia(numero: int, fecha: date, importe: str = "975.00", **kw: object) -> Invoice:
    defaults: dict[str, object] = {
        "cliente": "Cliente Italia SRL",
        "cliente_pais": "IT",
        "cliente_tax_id": "IT01234567890",
        "importe": D(importe),
        "tipo_iva": D("0"),
        "retencion_pct": D("0"),
        "mencion": "Inversión del sujeto pasivo (art. 84.Uno.2º LIVA)",
    }
    return inv(numero, fecha, **{**defaults, **kw})


def usa(numero: int, fecha: date, **kw: object) -> Invoice:
    defaults: dict[str, object] = {
        "cliente": "Client USA Corp",
        "cliente_pais": "US",
        "cliente_tax_id": "88-0000000",
        "moneda": "USD",
        "importe": D("2000.00"),
        "tipo_cambio": D("0.92"),
        "tipo_iva": D("0"),
        "retencion_pct": D("0"),
        "mencion": "Operación no sujeta, art. 69.Uno.1º LIVA",
    }
    return inv(numero, fecha, **{**defaults, **kw})


# ── importes y clasificación ────────────────────────────────────────────────
def test_national_invoice_amounts() -> None:
    i = inv(4, date(2026, 3, 10))
    assert (i.base, i.cuota_iva, i.retencion, i.total) == (D("1000.00"), D("210.00"), D("150.00"), D("1060.00"))
    assert i.operacion == "nacional" and i.trimestre == 1


def test_foreign_currency_base_is_the_invoiced_amount_converted() -> None:
    i = usa(11, date(2026, 6, 29))
    # 2000 USD × 0,92: el ingreso es lo facturado, no lo que llega al banco tras comisiones.
    assert (i.base, i.cuota_iva, i.retencion, i.total) == (D("1840.00"), D("0.00"), D("0.00"), D("1840.00"))
    assert i.operacion == "extracomunitaria"
    assert money(D("0.005")) == D("0.01") and money(D("0.004")) == D("0.00")


@pytest.mark.parametrize(
    ("change", "operacion"),
    [
        ({}, "intracomunitaria"),
        ({"cliente_pais": "EL"}, "intracomunitaria"),
        ({"cliente_tax_id": None}, "nacional"),
        ({"cliente_empresa": False}, "nacional"),
        ({"cliente_pais": "GB"}, "extracomunitaria"),
        ({"cliente_pais": "ES"}, "nacional"),
    ],
)
def test_operation_type(change: dict[str, object], operacion: str) -> None:
    assert replace(italia(1, date(2026, 4, 2)), **change).operacion == operacion  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("devengo", "trimestre"),
    [
        (date(2026, 3, 31), 1),
        (date(2026, 4, 1), 2),
        (date(2026, 6, 30), 2),
        (date(2026, 7, 1), 3),
        (date(2026, 12, 31), 4),
    ],
)
def test_quarter_follows_the_accrual_date_not_the_invoice_date(devengo: date, trimestre: int) -> None:
    assert inv(1, date(2026, 9, 1), fecha_devengo=devengo).trimestre == trimestre


# ── validación ──────────────────────────────────────────────────────────────
def test_validated_normalizes() -> None:
    v = validated(
        italia(12, date(2026, 7, 2), serie=" a ", cliente=" Cliente ", cliente_pais="it", cliente_tax_id=" it0123 ",
               concepto=" x ", moneda="eur", mencion=" m "),
        TODAY,
    )  # fmt: skip
    assert (v.serie, v.cliente, v.cliente_pais, v.cliente_tax_id, v.concepto, v.moneda, v.mencion) == (
        "A", "Cliente", "IT", "IT0123", "x", "EUR", "m",
    )  # fmt: skip
    assert validated(inv(1, TODAY, cliente_tax_id="  "), TODAY).cliente_tax_id is None


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"numero": 0}, "1 o mayor"),
        ({"cliente": " "}, "Falta el cliente"),
        ({"concepto": ""}, "Falta el concepto"),
        ({"cliente_pais": "ESP"}, "dos letras"),
        ({"cliente_pais": "E1"}, "dos letras"),
        ({"moneda": "EU"}, "tres letras"),
        ({"moneda": "E1R"}, "tres letras"),
        ({"importe": D("0")}, "mayor que cero"),
        ({"importe": D("-5")}, "mayor que cero"),
        ({"tipo_cambio": D("0")}, "tipo de cambio debe ser mayor"),
        ({"tipo_cambio": D("0.9")}, "en euros no lleva tipo de cambio"),
        ({"tipo_iva": D("-1")}, "entre 0 y 21"),
        ({"tipo_iva": D("21.01")}, "entre 0 y 21"),
        ({"retencion_pct": D("10")}, "0, 7 o 15"),
        ({"fecha": date(2026, 10, 2), "fecha_devengo": TODAY}, "fecha futura"),
        ({"fecha_devengo": date(2026, 10, 2)}, "fecha futura"),
    ],
)
def test_invalid_invoices(change: dict[str, object], message: str) -> None:
    with pytest.raises(FiscalRuleError, match=message):
        validated(replace(inv(1, date(2026, 9, 1)), **change), TODAY)  # type: ignore[arg-type]


def test_boundaries_are_valid() -> None:
    validated(inv(1, TODAY, tipo_iva=D("0"), retencion_pct=D("7")), TODAY)
    validated(inv(1, TODAY, tipo_iva=D("21"), retencion_pct=D("0")), TODAY)


# ── observaciones formales ──────────────────────────────────────────────────
def test_correct_invoices_have_no_issues() -> None:
    assert invoice_issues(inv(1, date(2026, 3, 10))) == ()
    assert invoice_issues(italia(2, date(2026, 4, 2))) == ()
    assert invoice_issues(italia(2, date(2026, 4, 2), mencion="INVERSION DEL SUJETO PASIVO")) == ()
    assert invoice_issues(usa(3, date(2026, 4, 5))) == ()


def test_wrong_mentions_like_the_pilot_case() -> None:
    eu = invoice_issues(italia(12, date(2026, 7, 2), mencion="Operación exenta de IVA en virtud del art. 69"))
    assert eu == ('Mención incorrecta: debe decir "Inversión del sujeto pasivo (art. 84.Uno.2º LIVA)".',)
    us = invoice_issues(usa(11, date(2026, 6, 29), mencion="OPERACIÓN EXENTA DE IVA - EXPORTACIÓN DE SERVICIOS"))
    assert us == ('Mención incorrecta: debe decir "Operación no sujeta, art. 69.Uno.1º LIVA".',)
    assert len(invoice_issues(italia(1, date(2026, 4, 2), mencion=""))) == 1


def test_tax_and_currency_issues() -> None:
    issues = invoice_issues(usa(1, date(2026, 4, 5), tipo_iva=D("21"), retencion_pct=D("15"), tipo_cambio=D("1")))
    assert issues == (
        "No debería llevar IVA español: la operación no está sujeta en España.",
        "No debería llevar retención de IRPF: el cliente no es español.",
        "Falta el tipo de cambio oficial USD/EUR de la fecha de devengo.",
    )
    assert invoice_issues(inv(1, date(2026, 3, 10), tipo_iva=D("0"))) == (
        "Sin IVA en una operación interior: revisar si corresponde el 21%.",
    )
    consumer = invoice_issues(italia(1, date(2026, 4, 2), cliente_tax_id=None, tipo_iva=D("21"), mencion=""))
    assert consumer == (
        "Cliente de la UE sin VAT de empresa: se trata como operación interior. Revisar con un asesor.",
    )


# ── numeración ──────────────────────────────────────────────────────────────
def test_clean_series_has_no_numbering_issues() -> None:
    series = [inv(1, date(2026, 1, 5)), inv(2, date(2026, 1, 5)), inv(3, date(2026, 2, 1))]
    assert numbering_issues(series) == () and numbering_issues([]) == ()


def test_gaps_duplicates_and_dates_out_of_order() -> None:
    series = [
        inv(4, date(2026, 10, 1)),  # número bajo con fecha posterior a la 11 y la 12
        usa(11, date(2026, 6, 29)),
        italia(12, date(2026, 7, 2)),
        italia(12, date(2026, 7, 3)),
    ]
    assert numbering_issues(series) == (
        "Serie única 2026: el número 12 está repetido.",
        "Serie única 2026: faltan los números 1, 2, 3, 5, 6, 7, 8, 9, 10.",
        "Serie única 2026: la factura 11 (29/06/2026) tiene fecha anterior a la 4 (01/10/2026).",
    )


def test_numbering_is_checked_per_series_and_year_and_ignores_voided() -> None:
    series = [
        inv(1, date(2025, 12, 10)),
        inv(1, date(2026, 1, 5)),
        inv(1, date(2026, 1, 9), serie="R"),
        inv(2, date(2026, 1, 9), anulada=True),
        inv(3, date(2026, 1, 9), serie="R"),
    ]
    assert numbering_issues(series) == ("Serie R 2026: faltan los números 2.",)


# ── resumen por trimestre ───────────────────────────────────────────────────
PILOTO_2T = [
    usa(5, date(2026, 4, 3)),
    italia(6, date(2026, 4, 10), importe="1260.00"),
    usa(7, date(2026, 5, 4)),
    usa(9, date(2026, 6, 3)),
    inv(10, date(2026, 6, 15), cliente="Web España SL", importe=D("500.00"), retencion_pct=D("0")),
    # Factura fechada en julio por un anticipo cobrado en junio: devenga en el 2T.
    italia(12, date(2026, 7, 2), fecha_devengo=date(2026, 6, 20), mencion="exenta"),
    italia(13, date(2026, 7, 20)),  # 3T
    inv(14, date(2026, 6, 28), anulada=True),
]


def test_quarter_summary_splits_bases_by_operation_with_trace() -> None:
    s = quarter_summary(PILOTO_2T, 2026, 2)
    nacional, intra, extra = s.operaciones
    assert (nacional.operacion, nacional.base, nacional.cuota_iva, nacional.retencion) == (
        "nacional", D("500.00"), D("105.00"), D("0.00"),
    )  # fmt: skip
    assert nacional.casillas == "303: casillas 07 (base) y 09 (cuota)"
    assert nacional.facturas == ("10/2026 Web España SL",)
    assert (intra.base, intra.cuota_iva, intra.casillas) == (D("2235.00"), D("0.00"), "303: casilla 59 · modelo 349")
    assert intra.facturas == ("6/2026 Cliente Italia SRL", "12/2026 Cliente Italia SRL")
    assert (extra.base, extra.casillas) == (D("5520.00"), "303: casilla 120")
    assert len(extra.facturas) == 3
    assert [(c.tax_id, c.cliente, c.base) for c in s.clientes_ue] == [
        ("IT01234567890", "Cliente Italia SRL", D("2235.00"))
    ]
    assert (s.ejercicio, s.trimestre, s.con_observaciones) == (2026, 2, 1)


def test_quarter_summary_other_quarters_and_empty() -> None:
    q3 = quarter_summary(PILOTO_2T, 2026, 3)
    assert [o.base for o in q3.operaciones] == [D("0.00"), D("975.00"), D("0.00")]
    empty = quarter_summary(PILOTO_2T, 2025, 2)
    assert all(o.base == 0 and o.facturas == () for o in empty.operaciones) and empty.clientes_ue == ()
    two = quarter_summary([italia(1, date(2026, 4, 1)), italia(2, date(2026, 4, 2), cliente_tax_id="FR1")], 2026, 2)
    assert [c.tax_id for c in two.clientes_ue] == ["FR1", "IT01234567890"]
    for bad in (0, 5):
        with pytest.raises(FiscalRuleError, match="1, 2, 3 o 4"):
            quarter_summary([], 2026, bad)


# ── servicio ────────────────────────────────────────────────────────────────
async def test_service_adds_lists_by_year_and_voids_per_owner() -> None:
    svc, repo = fake_invoices(NOW)
    a = await svc.add("u1", usa(11, date(2026, 6, 29), cliente=" Client USA Corp "))
    await svc.add("u1", inv(1, date(2025, 12, 20)))
    await svc.add("u1", italia(12, date(2026, 7, 2)))
    await svc.add("u2", inv(1, date(2026, 1, 5)))
    assert a.id and a.cliente == "Client USA Corp"

    view = await svc.overview("u1", 2026)
    assert [i.numero for i in view.invoices] == [11, 12] and view.ejercicio == 2026
    assert view.numeracion == ("Serie única 2026: faltan los números 1, 2, 3, 4, 5, 6, 7, 8, 9, 10.",)
    assert [i.numero for i in (await svc.overview("u1", 2025)).invoices] == [1]

    with pytest.raises(NotFound, match="no existe"):
        await svc.void("u2", a.id)
    await svc.void("u1", a.id)
    assert (await svc.overview("u1", 2026)).invoices[0].anulada
    assert (await svc.summary("u1", 2026, 2)).operaciones[2].base == D("0.00")
    assert (await svc.summary("u1", 2026, 3)).operaciones[1].base == D("975.00")


async def test_service_rejects_invalid_input() -> None:
    svc, repo = fake_invoices(NOW)
    with pytest.raises(Invalid, match="fecha futura"):
        await svc.add("u1", inv(1, date(2026, 10, 2)))
    with pytest.raises(Invalid, match="1, 2, 3 o 4"):
        await svc.summary("u1", 2026, 9)
    assert repo.invoices == {}
    assert svc.check(inv(1, date(2026, 10, 1))).numero == 1  # hoy (hora de Madrid) es válido
