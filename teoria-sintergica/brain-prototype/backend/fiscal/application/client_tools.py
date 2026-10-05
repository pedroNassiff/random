"""Tools del agente para clientes: consultar y proponer altas o cambios."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from decimal import Decimal, InvalidOperation
from typing import Any

from fiscal.application.agent_types import PROPOSED, Handler, Proposal, ToolOutput, to_json
from fiscal.application.clients import ClientService
from fiscal.application.errors import Invalid
from fiscal.domain.clients import Client, client_issues

_NULLABLE_STRING = {"type": ["string", "null"]}
EDITABLE = (
    "nombre",
    "pais",
    "tipo",
    "tax_id",
    "direccion",
    "email",
    "moneda",
    "retencion_pct",
    "dias_pago",
    "vinculada",
    "notas",
)

SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "ver_clientes",
        "description": "Lista los clientes con su id, código, país, tipo, NIF/VAT, tipo de operación, mención legal "
        "que deben llevar sus facturas, estado de la comprobación VIES y observaciones. Usala antes de proponer "
        "una factura (para tomar los datos del cliente) o un cliente nuevo (para no duplicarlo).",
        "strict": True,
        "input_schema": {"type": "object", "properties": {}, "required": [], "additionalProperties": False},
    },
    {
        "name": "proponer_cliente",
        "description": "Propone dar de alta un cliente o cambiar uno existente. No guarda nada: el usuario ve la "
        "propuesta y decide. Para modificar, pasá su `id` (de ver_clientes) y todos los datos como deben quedar.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": ["string", "null"], "description": "id del cliente a modificar; null para uno nuevo."},
                "nombre": {"type": "string", "description": "Razón social o nombre completo."},
                "pais": {"type": "string", "description": "Código ISO de dos letras: ES, IT, US…"},
                "tipo": {"type": "string", "enum": ["empresa", "autonomo", "particular"]},
                "tax_id": {**_NULLABLE_STRING, "description": "NIF o VAT; null si no tiene o no se conoce."},
                "direccion": {"type": "string", "description": "Domicilio completo; vacío si no se conoce."},
                "email": _NULLABLE_STRING,
                "moneda": {"type": "string", "description": "Moneda en que se le factura: EUR, USD…"},
                "retencion_pct": {"type": "string", "description": "Retención de IRPF que aplica: 0, 7 o 15."},
                "dias_pago": {"type": ["integer", "null"], "description": "Plazo de pago en días; null si no hay."},
                "vinculada": {"type": "boolean", "description": "true si es una sociedad propia o de un familiar."},
                "notas": {"type": "string"},
            },
            "required": ["id", *EDITABLE],
            "additionalProperties": False,
        },
    },
]


def client_dict(c: Client) -> dict[str, Any]:
    """Cliente con lo que de él se deriva para facturarle."""
    return {
        "id": c.id,
        "codigo": c.codigo,
        "nombre": c.nombre,
        "pais": c.pais,
        "tipo": c.tipo,
        "tax_id": c.tax_id,
        "direccion": c.direccion,
        "email": c.email,
        "moneda": c.moneda,
        "retencion_pct": str(c.retencion_pct),
        "dias_pago": c.dias_pago,
        "vinculada": c.vinculada,
        "notas": c.notas,
        "activo": c.activo,
        "vies_ok": c.vies_ok,
        "vies_checked_at": c.vies_checked_at.isoformat() if c.vies_checked_at else None,
        "vies_nombre": c.vies_nombre,
        "operacion": c.operacion,
        "mencion": c.mencion,
        "casillas": c.casillas,
        "requiere_vies": c.requiere_vies,
        "observaciones": list(client_issues(c)),
    }


def client_from(args: Mapping[str, Any]) -> Client:
    """Arma un cliente desde un dict (tool del agente o cuerpo HTTP)."""
    try:
        retencion = Decimal(str(args.get("retencion_pct") or 0))
    except InvalidOperation as exc:
        raise Invalid("retencion_pct debe ser un número.") from exc
    dias = args.get("dias_pago")
    return Client(
        nombre=str(args.get("nombre") or ""),
        pais=str(args.get("pais") or ""),
        tipo=args.get("tipo") or "empresa",
        tax_id=args.get("tax_id") or None,
        direccion=str(args.get("direccion") or ""),
        email=args.get("email") or None,
        moneda=str(args.get("moneda") or "EUR"),
        retencion_pct=retencion,
        dias_pago=dias if isinstance(dias, int) else None,
        vinculada=bool(args.get("vinculada", False)),
        notas=str(args.get("notas") or ""),
    )


def _show(value: object) -> str:
    if value is None or value == "":
        return "—"
    if isinstance(value, bool):
        return "sí" if value else "no"
    return str(value)


class ClientTools:
    def __init__(self, clients: ClientService, new_id: Callable[[], str]) -> None:
        self._clients = clients
        self._new_id = new_id

    def handlers(self) -> dict[str, Handler]:
        return {"ver_clientes": self._ver_clientes, "proponer_cliente": self._proponer_cliente}

    async def _ver_clientes(self, owner_id: str, _args: Mapping[str, Any]) -> ToolOutput:
        clients = await self._clients.list(owner_id)
        if not clients:
            return ToolOutput("Todavía no hay clientes cargados.")
        return ToolOutput(to_json([client_dict(c) for c in clients]))

    async def _proponer_cliente(self, owner_id: str, args: Mapping[str, Any]) -> ToolOutput:
        client_id = args.get("id") or None
        current = await self._clients.get(owner_id, str(client_id)) if client_id else None
        clean = self._clients.check(client_from(args))
        after = client_dict(clean)
        before = client_dict(current) if current else {}
        detalle = [
            f"{name}: {_show(before.get(name))} → {_show(after[name])}"
            for name in EDITABLE
            if before.get(name) != after[name] and (current or after[name] not in (None, "", False))
        ]
        if not detalle:
            return ToolOutput("La propuesta es igual al cliente actual: no hay nada que cambiar.", is_error=True)
        detalle.append(f"operación: {clean.operacion} ({clean.casillas})")
        if clean.mencion:
            detalle.append(f"mención en sus facturas: {clean.mencion}")
        payload = {"id": current.id if current else None, **{name: after[name] for name in EDITABLE}}
        titulo = f"Actualizar cliente {current.nombre}" if current else f"Nuevo cliente: {clean.nombre}"
        return ToolOutput(PROPOSED, proposal=Proposal(self._new_id(), "client", titulo, tuple(detalle), payload))
