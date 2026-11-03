"""Tools de NEO como constructor del dashboard: qué módulos existen y lectura directa de la base.

Spec: docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md. La seguridad de
`consultar_bd` la pone Postgres (usuario `neo_reader`, solo SELECT, RLS por dueño), no este código.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from fiscal.application.agent_types import Handler, ToolOutput, to_json


@dataclass(frozen=True)
class QueryResult:
    columnas: tuple[str, ...]
    filas: tuple[tuple[object, ...], ...]
    truncado: bool


class NeoReader(Protocol):
    async def query(self, owner_id: str, sql: str) -> QueryResult:
        """Corre un SELECT como `neo_reader`, acotado a las filas del dueño. Error de la base → `Invalid`."""
        ...


@dataclass(frozen=True)
class Modulo:
    nombre: str
    ruta: str
    que_guarda: str
    tablas: tuple[str, ...]


MODULOS: tuple[Modulo, ...] = (
    Modulo(
        "Impuestos",
        "/dashboard/impuestos",
        "Perfil fiscal, calendario de obligaciones con su estado, facturas emitidas y documentos subidos.",
        ("fiscal.tax_profiles", "fiscal.obligation_status", "fiscal.invoices", "fiscal.documents", "fiscal.holidays"),
    ),
    Modulo(
        "Ingresos y gastos",
        "/dashboard/ingresos-y-gastos",
        "Movimientos bancarios importados con su categoría.",
        ("fiscal.movements",),
    ),
    Modulo("Clientes", "/dashboard/clientes", "Clientes a los que se factura.", ("fiscal.clients",)),
)

_COLUMNAS = (
    "Para ver las columnas de una tabla: SELECT table_name, column_name, data_type FROM "
    "information_schema.columns WHERE table_schema = 'fiscal' ORDER BY table_name, ordinal_position"
)

SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "ver_modulos",
        "description": "Lista los módulos que ya existen en el dashboard (nombre, ruta, qué guardan y sus tablas). "
        "Usala antes de decidir si un pedido es un módulo nuevo o una instancia de uno que ya existe.",
        "strict": True,
        "input_schema": {"type": "object", "properties": {}, "required": [], "additionalProperties": False},
    },
    {
        "name": "consultar_bd",
        "description": "Corre una consulta SELECT de PostgreSQL de solo lectura sobre las tablas de los módulos "
        "(las de ver_modulos) y devuelve las filas. Solo ve los datos del usuario y nunca el NIF. Una sola "
        "sentencia, sin punto y coma; devuelve como mucho 200 filas. Usala para responder con datos en vez de "
        "mandar al usuario a revisar algo.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {"sql": {"type": "string", "description": "Una sentencia SELECT."}},
            "required": ["sql"],
            "additionalProperties": False,
        },
    },
]


class BuilderTools:
    def __init__(self, reader: NeoReader | None) -> None:
        self._reader = reader

    def handlers(self) -> dict[str, Handler]:
        return {"ver_modulos": self._ver_modulos, "consultar_bd": self._consultar_bd}

    async def _ver_modulos(self, _owner_id: str, _args: Mapping[str, Any]) -> ToolOutput:
        modulos = [
            {"nombre": m.nombre, "ruta": m.ruta, "que_guarda": m.que_guarda, "tablas": list(m.tablas)} for m in MODULOS
        ]
        return ToolOutput(to_json({"modulos": modulos, "columnas": _COLUMNAS}))

    async def _consultar_bd(self, owner_id: str, args: Mapping[str, Any]) -> ToolOutput:
        if self._reader is None:
            return ToolOutput("La lectura directa de la base no está disponible en este entorno.", is_error=True)
        sql = str(args.get("sql", "")).strip().strip(";").strip()
        if not sql:
            return ToolOutput("Falta la consulta: mandá una sentencia SELECT.", is_error=True)
        result = await self._reader.query(owner_id, sql)
        data: dict[str, Any] = {
            "filas": [dict(zip(result.columnas, fila, strict=True)) for fila in result.filas],
            "total": len(result.filas),
            "truncado": result.truncado,
        }
        if result.truncado:
            data["aviso"] = "Hay más filas de las que se muestran: acotá la consulta con WHERE o agregá con COUNT/SUM."
        return ToolOutput(to_json(data))
