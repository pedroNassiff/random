"""Puesta en marcha: arma los pasos pendientes con el estado real de la persona.

Lo usan el agente (tool `ver_pasos`) y el dashboard (guía de primer ingreso y aviso de siguiente paso).
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fiscal.application.invoices import InvoiceService
from fiscal.application.service import FiscalService
from fiscal.domain.onboarding import next_step, onboarding_steps


async def onboarding_state(service: FiscalService, invoices: InvoiceService, owner_id: str) -> dict[str, Any]:
    profile = await service.get_profile(owner_id)
    vencidas: list[str] = []
    if profile is not None:
        view = await service.calendar(owner_id)
        vencidas = [
            i.obligation.titulo
            for i in view.items
            if i.aviso == "vencida" and (i.obligation.modelo != "RETA" or i.obligation.periodo == "tarifa-plana")
        ]
    registradas = len((await invoices.overview(owner_id, service.today().year)).invoices)
    steps = onboarding_steps(profile, vencidas, registradas)
    siguiente = next_step(steps)
    return {"pasos": [asdict(s) for s in steps], "siguiente": siguiente.clave if siguiente else None}
