"""Ingresos y gastos: categorías, resumen mensual, importación de la planilla, lector de xlsx, HTTP y Postgres.

La planilla de prueba imita la distribución real (gastos en A/B, hogar en E/F, ingresos en I/J, totales y
apuntes viejos al pie) con datos inventados.
"""

from __future__ import annotations

import base64
import io
import os
import zipfile
from collections.abc import AsyncIterator
from dataclasses import replace
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

import asyncpg
import pytest

from fiscal.application.errors import Invalid
from fiscal.application.movements import MovementService
from fiscal.domain.movements import Movement, categorize, month_range, monthly_by_category
from fiscal.domain.sheet_import import assign_months, import_sheets
from fiscal.infrastructure.pg_movements import PgMovementRepository
from fiscal.infrastructure.wiring import build_movements
from fiscal.infrastructure.xlsx import XlsxError, read_xlsx
from tests.fiscal.test_agent_infra import World

D = Decimal
NOW = datetime(2026, 10, 3, 10, tzinfo=UTC)


# ── categorías ──────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("concepto", "categoria"),
    [
        ("renta + servicios ", "Vivienda (tu parte)"),
        ("Renta", "Vivienda"),
        ("departamento + parking", "Vivienda"),
        ("IRPF 2025", "Impuestos y Seguridad Social"),
        ("SS", "Impuestos y Seguridad Social"),
        ("Seguridad Social", "Impuestos y Seguridad Social"),
        ("devolucion a Romi x prestamo", "Préstamos y devoluciones"),
        ("internet + 2 lineas movil + play", "Suministros"),
        ("luz (energia)", "Suministros"),
        ("parking", "Transporte"),
        ("pasaje argentina cuota 6/09", "Viajes"),
        ("arenita para gatos", "Mascotas"),
        ("veterinario montjuic", "Mascotas"),
        ("Aldi", "Supermercado"),
        ("youtube ", "Suscripciones y software"),
        ("Copilot", "Suscripciones y software"),
        ("Portatil Mc cuota 3/20", "Tecnología"),
        ("PC", "Tecnología"),
        ("yoga", "Salud y deporte"),
        ("threejs journey curso", "Formación"),
        ("ropa (zapa + buzo)", "Ropa"),
        ("regalo emma", "Ocio y regalos"),
        ("emma ", "Otros"),
        ("", "Otros"),
    ],
)
def test_categorize(concepto: str, categoria: str) -> None:
    assert categorize(concepto) == categoria


def test_short_keywords_only_match_whole_words_and_income_has_its_own_category() -> None:
    assert categorize("massage") == "Otros"  # "ss" dentro de otra palabra no es Seguridad Social
    assert categorize("calavera sur", "ingreso") == "Ingresos"


# ── resumen ─────────────────────────────────────────────────────────────────
def mv(mes: date, concepto: str, importe: str, persona: str = "Pedro", tipo: str = "gasto") -> Movement:
    return Movement(mes, tipo, persona, concepto, categorize(concepto, tipo), D(importe))  # type: ignore[arg-type]


AGO, SEP, OCT = date(2026, 8, 1), date(2026, 9, 1), date(2026, 10, 1)


def test_month_range_crosses_years() -> None:
    assert month_range(date(2026, 2, 1), 4) == [
        date(2025, 11, 1),
        date(2025, 12, 1),
        date(2026, 1, 1),
        date(2026, 2, 1),
    ]
    assert month_range(OCT, 1) == [OCT]


def test_monthly_by_category_builds_the_table_with_totals_and_variation() -> None:
    movements = [
        mv(AGO, "luz", "34"), mv(SEP, "luz", "62"), mv(OCT, "luz", "62"), mv(OCT, "agua", "66"),
        mv(SEP, "yoga", "55"), mv(OCT, "yoga", "55"),
        mv(OCT, "aldi", "100"),
        mv(OCT, "renta", "420", persona="Emma"),
        mv(OCT, "calavera", "1739", tipo="ingreso"),
        mv(date(2026, 7, 1), "luz", "999"),  # fuera del rango
    ]  # fmt: skip
    s = monthly_by_category(movements, [AGO, SEP, OCT], personas=["Pedro"])
    assert s.meses == (AGO, SEP, OCT)
    assert [r.categoria for r in s.filas] == ["Suministros", "Salud y deporte", "Supermercado"]
    sumi = s.filas[0]
    assert sumi.valores == (D("34"), D("62"), D("128")) and sumi.total == D("224")
    assert sumi.promedio == D("74.67") and sumi.variacion == D("106.5") and sumi.conceptos == ("agua", "luz")
    assert s.filas[2].variacion is None  # el mes anterior fue 0
    assert s.totales == (D("34"), D("117"), D("283")) and s.total == D("434")


def test_monthly_by_category_filters_people_and_type() -> None:
    movements = [
        mv(OCT, "renta", "420", persona="Emma"),
        mv(OCT, "luz", "62"),
        mv(OCT, "calavera", "1739", tipo="ingreso"),
    ]
    assert [r.categoria for r in monthly_by_category(movements, [OCT]).filas] == ["Vivienda", "Suministros"]
    one = monthly_by_category(movements, [OCT], personas=["Emma"])
    assert [(r.categoria, r.variacion) for r in one.filas] == [("Vivienda", None)]
    income = monthly_by_category(movements, [OCT], tipo="ingreso")
    assert [(r.categoria, r.total) for r in income.filas] == [("Ingresos", D("1739"))]
    empty = monthly_by_category([], [])
    assert empty.filas == () and empty.total == 0


# ── importación de la planilla ──────────────────────────────────────────────
OCTUBRE = {
    "A1": "gastos Pedro ", "E1": "servicios", "G1": "dia", "I1": "ingresos - Pedro",
    "A2": "renta + servicios ", "B2": "890.0", "E2": "renta", "F2": "1215.0", "G2": "1.0",
    "C3": "45659.0",
    "E4": "luz", "F4": "62.0", "G4": "13.0",
    "A5": "youtube ", "B5": "14.0", "E5": "internet", "F5": "150.0",
    "I6": "calavera sur", "J6": "1739.0", "K6": "2000 USD",
    "A7": "sin importe", "I7": "Coliseo", "K7": "1000.0",
    "A8": "SS", "B8": "88.0", "J10": "1739", "I11": "ingresos - Emma", "J11": "1792.0",
    "E13": "total servicios", "F13": "1427",
    "A15": "Gastos Emma", "A16": "Renta", "B16": "420.0", "A17": "Aldi", "B17": "200.0",
    "A21": "Gastos Pedro ", "B21": "992", "I21": "gastos - ingresos Pedro", "J21": "747",
    "B32": "0", "A36": "regalos", "B36": "25.0",
}  # fmt: skip
SEPTIEMBRE = {
    "A1": "gastos", "E1": "servicios", "I1": "ingresos",
    "A3": "departamento", "B3": "1187.0",
    "E2": "renta", "F2": "1187.0", "E9": "Viaje", "E10": "pasaje Corsica", "F10": "466.0",
    "I3": "HCG", "J3": "1988.0", "I4": "Touristcheck", "K4": "1000",
    "B15": "1187", "A16": "renta ", "B16": "464.0",
}  # fmt: skip


def test_months_are_read_from_tab_names_and_inferred_when_missing() -> None:
    names = [
        "octubre-2026",
        "Septiembre 2026",
        "enero 2026",
        "Diciembre",
        "noviembre",
        "Viaje Corsica",
        "Octubre",
        "Notas",
    ]
    assert assign_months(names) == {
        "octubre-2026": date(2026, 10, 1),
        "Septiembre 2026": date(2026, 9, 1),
        "enero 2026": date(2026, 1, 1),
        "Diciembre": date(2025, 12, 1),
        "noviembre": date(2025, 11, 1),
        "Octubre": date(2025, 10, 1),
    }
    assert assign_months(["Octubre", "septiembre-2026"]) == {"septiembre-2026": date(2026, 9, 1)}


def test_import_reads_each_block_and_skips_totals_and_old_notes() -> None:
    report = import_sheets([("octubre-2026", OCTUBRE), ("Viaje Corsica", {"A1": "Gasto"}), ("Septiembre", SEPTIEMBRE)])
    # "Septiembre" sin año, después de octubre de 2026: es septiembre de 2026.
    assert report.meses == [date(2026, 9, 1), date(2026, 10, 1)] and report.omitidas == ["Viaje Corsica"]
    octubre = [
        (m.tipo, m.persona, m.concepto, m.importe, m.categoria, m.fuente_ref)
        for m in report.movimientos
        if m.mes == OCT
    ]
    assert octubre == [
        ("gasto", "Pedro", "renta + servicios", D("890.0"), "Vivienda (tu parte)", "octubre-2026!A2"),
        ("gasto", "Pedro", "youtube", D("14.0"), "Suscripciones y software", "octubre-2026!A5"),
        ("gasto", "Pedro", "SS", D("88.0"), "Impuestos y Seguridad Social", "octubre-2026!A8"),
        ("gasto", "Emma", "Renta", D("420.0"), "Vivienda", "octubre-2026!A16"),
        ("gasto", "Emma", "Aldi", D("200.0"), "Supermercado", "octubre-2026!A17"),
        ("gasto", "Hogar", "renta", D("1215.0"), "Vivienda", "octubre-2026!E2"),
        ("gasto", "Hogar", "luz", D("62.0"), "Suministros", "octubre-2026!E4"),
        ("gasto", "Hogar", "internet", D("150.0"), "Suministros", "octubre-2026!E5"),
        ("ingreso", "Pedro", "calavera sur", D("1739.0"), "Ingresos", "octubre-2026!I6"),
        ("ingreso", "Emma", "Ingresos Emma", D("1792.0"), "Ingresos", "octubre-2026!I11"),
    ]
    assert report.dudosos == [
        "octubre-2026!I7: «Coliseo» sin importe en euros (nota: 1000.0).",
        "Septiembre!I4: «Touristcheck» sin importe en euros (nota: 1000).",
    ]
    assert all(m.fuente == "planilla" for m in report.movimientos)
    septiembre = {(m.persona, m.concepto) for m in report.movimientos if m.mes == SEP}
    # Lo de abajo del total (renta 464) y el bloque de viajes ya pagados no entran.
    assert septiembre == {("Pedro", "departamento"), ("Hogar", "renta"), ("Pedro", "HCG")}


def test_import_reports_months_whose_sum_does_not_match_the_written_total() -> None:
    report = import_sheets([("octubre-2026", {**OCTUBRE, "B21": "1000"})])
    assert report.descuadres == ["octubre-2026: gastos de Pedro suman 992.0 y la planilla dice 1000 (fila 21)."]
    assert import_sheets([("octubre-2026", OCTUBRE)]).descuadres == []
    no_total = import_sheets([("octubre-2026", {k: v for k, v in OCTUBRE.items() if k not in ("B21",)})])
    # Sin su fila de total, el corte cae en el primer número sin rótulo del pie y el descuadre lo deja a la vista.
    assert no_total.descuadres == ["octubre-2026: gastos de Pedro suman 992.0 y la planilla dice 0 (fila 32)."]
    assert len([m for m in no_total.movimientos if m.persona == "Pedro"]) == 4


def test_numbers_with_comma_and_garbage() -> None:
    report = import_sheets([("enero 2026", {"A2": "luz", "B2": "12,5", "A3": "raro", "B3": "doce", "B15": "12.5"})])
    assert [(m.concepto, m.importe) for m in report.movimientos] == [("luz", D("12.5"))]


# ── lector de xlsx ──────────────────────────────────────────────────────────
def make_xlsx(sheets: list[tuple[str, dict[str, str]]], *, inline: bool = False) -> bytes:
    strings: list[str] = []

    def cell(ref: str, value: str) -> str:
        try:
            float(value)
            return f'<c r="{ref}"><v>{value}</v></c>'
        except ValueError:
            if inline:
                return f'<c r="{ref}" t="inlineStr"><is><t>{escape(value)}</t></is></c>'
            strings.append(value)
            return f'<c r="{ref}" t="s"><v>{len(strings) - 1}</v></c>'

    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    rel_ns = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        sheet_tags, rels = [], []
        for i, (name, cells) in enumerate(sheets, 1):
            body = "".join(cell(r, v) for r, v in cells.items())
            z.writestr(
                f"xl/worksheets/sheet{i}.xml", f"<worksheet {ns}><sheetData><row>{body}</row></sheetData></worksheet>"
            )
            sheet_tags.append(f'<sheet name="{escape(name)}" sheetId="{i}" r:id="rId{i}"/>')
            rels.append(f'<Relationship Id="rId{i}" Target="worksheets/sheet{i}.xml"/>')
        z.writestr("xl/workbook.xml", f"<workbook {ns} {rel_ns}><sheets>{''.join(sheet_tags)}</sheets></workbook>")
        z.writestr("xl/_rels/workbook.xml.rels", f"<Relationships>{''.join(rels)}</Relationships>")
        if strings:
            items = "".join(f"<si><t>{escape(s)}</t></si>" for s in strings)
            z.writestr("xl/sharedStrings.xml", f"<sst {ns}>{items}</sst>")
    return buf.getvalue()


def test_xlsx_reader_reads_shared_and_inline_strings_in_tab_order() -> None:
    data = make_xlsx([("octubre-2026", {"A2": "luz", "B2": "62.5"}), ("Viaje", {"A1": "Gasto"})])
    assert read_xlsx(data) == [("octubre-2026", {"A2": "luz", "B2": "62.5"}), ("Viaje", {"A1": "Gasto"})]
    assert read_xlsx(make_xlsx([("enero", {"A1": "ñandú"})], inline=True)) == [("enero", {"A1": "ñandú"})]
    assert read_xlsx(make_xlsx([("vacía", {})])) == [("vacía", {})]


def test_xlsx_reader_rejects_broken_files() -> None:
    with pytest.raises(XlsxError, match="no es un Excel"):
        read_xlsx(b"%PDF-1.4")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("otra/cosa.txt", "x")
    with pytest.raises(XlsxError, match="No se pudo leer"):
        read_xlsx(buf.getvalue())


def test_xlsx_reader_refuses_zip_bombs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("fiscal.infrastructure.xlsx._MAX_UNCOMPRESSED", 10)
    with pytest.raises(XlsxError, match="demasiado grande"):
        read_xlsx(make_xlsx([("enero", {"A1": "algo largo"})]))


# ── servicio ────────────────────────────────────────────────────────────────
class FakeMovementRepo:
    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], Movement] = {}

    async def upsert_movements(self, owner_id: str, movements: Any) -> tuple[int, int]:
        new = sum(1 for m in movements if (owner_id, m.fuente_ref) not in self.rows)
        for m in movements:
            self.rows[(owner_id, m.fuente_ref)] = m
        return new, len(movements) - new

    async def list_movements(self, owner_id: str) -> list[Movement]:
        return [m for (o, _), m in self.rows.items() if o == owner_id]


def service() -> tuple[MovementService, FakeMovementRepo]:
    repo = FakeMovementRepo()
    return MovementService(repo, read_xlsx, clock=lambda: NOW), repo


async def test_import_is_idempotent_and_updates_changed_cells() -> None:
    svc, repo = service()
    data = make_xlsx([("octubre-2026", OCTUBRE)])
    first = await svc.import_sheet("u1", data)
    assert (first.nuevos, first.actualizados, len(first.report.movimientos)) == (10, 0, 10)
    again = await svc.import_sheet("u1", make_xlsx([("octubre-2026", {**OCTUBRE, "B5": "15.0"})]))
    assert (again.nuevos, again.actualizados) == (0, 10)
    assert repo.rows[("u1", "octubre-2026!A5")].importe == D("15.0")


async def test_import_errors() -> None:
    svc, repo = service()
    with pytest.raises(Invalid, match="no es un Excel"):
        await svc.import_sheet("u1", b"basura")
    with pytest.raises(Invalid, match="No encontré pestañas de meses"):
        await svc.import_sheet("u1", make_xlsx([("Notas", {"A1": "x"})]))
    assert repo.rows == {}


async def test_summary_ends_in_the_last_month_with_data_and_lists_people() -> None:
    svc, _ = service()
    await svc.import_sheet("u1", make_xlsx([("octubre-2026", OCTUBRE), ("Septiembre 2026", SEPTIEMBRE)]))
    view = await svc.summary("u1", meses=2)
    assert view.summary.meses == (SEP, OCT) and view.personas == ("Emma", "Hogar", "Pedro")
    pedro = await svc.summary("u1", personas=["Pedro"], meses=2)
    assert pedro.summary.totales == (D("1187.0"), D("992.0"))
    income = await svc.summary("u1", tipo="ingreso", meses=2)
    assert income.personas == ("Emma", "Pedro") and income.summary.total == D("5519.0")
    empty = await svc.summary("u2", meses=3)
    assert empty.summary.meses[-1] == OCT and empty.summary.filas == ()  # sin datos: termina en el mes actual
    for bad in (0, 37):
        with pytest.raises(Invalid, match="entre 1 y 36"):
            await svc.summary("u1", meses=bad)


def test_wiring() -> None:
    svc = build_movements(object())
    assert isinstance(svc._repo, PgMovementRepository) and svc._read is read_xlsx


# ── HTTP ────────────────────────────────────────────────────────────────────
@pytest.fixture
def world(monkeypatch: pytest.MonkeyPatch) -> World:
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "0")
    w = World()
    w.app.state.fiscal_movements = service()[0]
    return w


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def test_movement_endpoints_require_access(world: World) -> None:
    body = {"name": "cuentas.xlsx", "data": b64(make_xlsx([("octubre-2026", OCTUBRE)]))}
    for method, url, kwargs in (
        ("post", "/fiscal/movements/import", {"json": body}),
        ("get", "/fiscal/movements/summary", {}),
    ):
        assert getattr(world.client(), method)(url, **kwargs).status_code == 401
        assert getattr(world.client("ana@x.com"), method)(url, **kwargs).status_code == 403


def test_import_and_summary_over_http(world: World) -> None:
    c = world.client("pedro@x.com")
    data = make_xlsx([("octubre-2026", OCTUBRE), ("Septiembre 2026", SEPTIEMBRE), ("Viaje", {"A1": "x"})])
    r = c.post("/fiscal/movements/import", json={"name": "cuentas.xlsx", "data": b64(data)})
    assert r.status_code == 200
    assert r.json() == {
        "nuevos": 13,
        "actualizados": 0,
        "movimientos": 13,
        "desde": "2026-09-01",
        "hasta": "2026-10-01",
        "meses": 2,
        "omitidas": ["Viaje"],
        "dudosos": [
            "octubre-2026!I7: «Coliseo» sin importe en euros (nota: 1000.0).",
            "Septiembre 2026!I4: «Touristcheck» sin importe en euros (nota: 1000).",
        ],
        "descuadres": [],
    }
    s = c.get("/fiscal/movements/summary?persona=Pedro&meses=2").json()
    assert s["meses"] == ["2026-09-01", "2026-10-01"] and s["personas"] == ["Emma", "Hogar", "Pedro"]
    assert s["filas"][0] == {
        "categoria": "Vivienda",
        "valores": ["1187.00", "0.00"],
        "total": "1187.00",
        "promedio": "593.50",
        "variacion": "-100.0",
        "conceptos": ["departamento"],
    }
    assert s["totales"] == ["1187.00", "992.00"] and s["total"] == "2179.00"
    both = c.get("/fiscal/movements/summary?persona=Pedro&persona=Emma&meses=1").json()
    assert both["total"] == "1612.00"
    assert c.get("/fiscal/movements/summary?tipo=ingreso").json()["filas"][0]["categoria"] == "Ingresos"


def test_import_rejections_over_http(world: World) -> None:
    c = world.client("pedro@x.com")
    assert c.post("/fiscal/movements/import", json={"name": "x", "data": "%%%"}).status_code == 422
    r = c.post("/fiscal/movements/import", json={"name": "x", "data": b64(b"no es excel")})
    assert r.status_code == 422 and "no es un Excel" in r.json()["detail"]
    assert c.get("/fiscal/movements/summary?meses=0").status_code == 422
    assert c.get("/fiscal/movements/summary?tipo=otro").status_code == 422


def test_import_size_limit(world: World, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("fiscal.infrastructure.api_movements.MAX_BYTES", 10)
    r = world.client("pedro@x.com").post("/fiscal/movements/import", json={"name": "x", "data": b64(b"x" * 11)})
    assert r.status_code == 422 and "5 MB" in r.json()["detail"]


# ── PostgreSQL ──────────────────────────────────────────────────────────────
DSN = os.getenv("FUTBOL_TEST_DSN")
BACKEND = Path(__file__).parents[2]


@pytest.fixture
async def pool() -> AsyncIterator[asyncpg.Pool]:
    if not DSN:
        pytest.skip("FUTBOL_TEST_DSN no configurado")
    assert "test" in DSN
    p = await asyncpg.create_pool(DSN, min_size=1, max_size=2)
    for folder in ("futbol", "fiscal"):
        for m in sorted((BACKEND / folder / "migrations").glob("*.sql")):
            await p.execute(m.read_text(encoding="utf-8"))
    await p.execute("TRUNCATE futbol.app_users CASCADE")
    yield p
    await p.close()


async def test_movements_against_postgres(pool: asyncpg.Pool) -> None:
    owner = str(await pool.fetchval("INSERT INTO futbol.app_users (email) VALUES ('p@x.com') RETURNING id"))
    other = str(await pool.fetchval("INSERT INTO futbol.app_users (email) VALUES ('a@x.com') RETURNING id"))
    repo = PgMovementRepository(pool)
    a = replace(mv(OCT, "luz", "62.00"), fuente="planilla", fuente_ref="oct!E4")
    b = replace(mv(SEP, "calavera", "1739.00", tipo="ingreso"), fuente_ref="sep!I6")
    assert await repo.upsert_movements(owner, [a, b]) == (2, 0)
    assert await repo.upsert_movements(owner, [replace(a, importe=D("70.00"))]) == (0, 1)
    assert await repo.upsert_movements(other, [a]) == (1, 0)
    stored = await repo.list_movements(owner)
    assert [(m.mes, m.concepto, m.importe, m.tipo) for m in stored] == [
        (SEP, "calavera", D("1739.00"), "ingreso"),
        (OCT, "luz", D("70.00"), "gasto"),
    ]
    assert stored[1] == replace(a, importe=D("70.00"), id=stored[1].id)
    assert len(await repo.list_movements(other)) == 1
    with pytest.raises(asyncpg.CheckViolationError):
        await repo.upsert_movements(owner, [replace(a, mes=date(2026, 10, 2), fuente_ref="x")])
