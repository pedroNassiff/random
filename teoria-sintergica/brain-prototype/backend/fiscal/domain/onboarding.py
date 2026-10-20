"""Puesta en marcha guiada: qué falta cargar y qué documento lo completa.

Lo decide el código, no el modelo: el agente solo lee esta lista y pide el documento del siguiente paso.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from fiscal.domain.profile import TaxProfile

StepState = Literal["hecho", "pendiente", "opcional"]
MAX_LISTED = 10


@dataclass(frozen=True)
class Step:
    clave: str
    titulo: str
    estado: StepState
    documento: str
    completa: str
    detalle: str = ""


def onboarding_steps(profile: TaxProfile | None, vencidas: Sequence[str], facturas: int = 0) -> tuple[Step, ...]:
    """`vencidas` = títulos de las obligaciones pasadas de fecha y sin cerrar (sin cuotas mensuales).
    `facturas` = facturas emitidas ya registradas en el ejercicio en curso."""
    listed = ", ".join(vencidas[:MAX_LISTED]) + (
        f" y {len(vencidas) - MAX_LISTED} más" if len(vencidas) > MAX_LISTED else ""
    )
    return (
        Step(
            "perfil",
            "Perfil fiscal",
            "hecho" if profile else "pendiente",
            "Modelo 036 o 037 presentado (o el certificado de situación censal de la AEAT)",
            "NIF, fecha de alta, epígrafe IAE, régimen de IVA y de IRPF, alta en el ROI y domicilio fiscal",
        ),
        Step(
            "tarifa_plana",
            "Tarifa plana de autónomos",
            "hecho" if profile and profile.tarifa_plana_hasta else "opcional",
            "Resolución de alta en el RETA de la Seguridad Social",
            "fecha de fin de la tarifa plana, para avisar a tiempo de la prórroga",
            "Solo si tenés tarifa plana.",
        ),
        Step(
            "facturas",
            "Facturas emitidas",
            "hecho" if facturas else "pendiente",
            "Cada factura emitida en el año (PDF o foto), o el listado con número, fecha, cliente e importe",
            "el registro de ingresos por tipo de operación, del que salen las bases del 303, el 130 y el 349",
            f"Registradas este año: {facturas}. Subí las que falten para completar cada trimestre." if facturas else "",
        ),
        Step(
            "justificantes",
            "Obligaciones vencidas sin cerrar",
            "pendiente" if not profile or vencidas else "hecho",
            "Justificante de presentación o de pago de cada modelo (el PDF de la AEAT con su CSV)",
            "el estado de cada obligación vencida, con su justificante",
            f"Vencidas sin cerrar: {listed}." if vencidas else "",
        ),
        Step(
            "notificaciones",
            "Notificaciones abiertas",
            "opcional",
            "PDF de la notificación (providencia de apremio, requerimiento, liquidación)",
            "el último día del plazo, con los festivos de tu domicilio",
            "La fecha en que fuiste notificado la confirmás vos: el PDF no siempre la trae.",
        ),
    )


def next_step(steps: Sequence[Step]) -> Step | None:
    return next((s for s in steps if s.estado == "pendiente"), None)
