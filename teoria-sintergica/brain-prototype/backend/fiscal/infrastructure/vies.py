"""Comprobación de VAT en VIES (servicio REST de la Comisión Europea)."""

from __future__ import annotations

import re

import httpx

from fiscal.application.clients import VatCheck
from fiscal.application.errors import Invalid

_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{country}/vat/{number}"
_SAFE = re.compile(r"^[A-Z0-9+*]{2,14}$")
_UNAVAILABLE = "VIES no respondió. Probá de nuevo en unos minutos."


class ViesClient:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client

    async def check(self, country: str, number: str) -> VatCheck:
        # Ambos valores van en la URL: solo se aceptan con la forma de un VAT.
        if not re.fullmatch(r"[A-Z]{2}", country) or not _SAFE.match(number):
            raise Invalid("El VAT no tiene un formato que VIES pueda comprobar.")
        client = self._client or httpx.AsyncClient(timeout=15.0)
        try:
            response = await client.get(_URL.format(country=country, number=number))
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise Invalid(_UNAVAILABLE) from exc
        finally:
            if self._client is None:
                await client.aclose()
        # Con el servicio de un país caído, VIES contesta 200 con userError distinto de VALID/INVALID.
        if data.get("userError") not in ("VALID", "INVALID"):
            raise Invalid(_UNAVAILABLE)
        name = str(data.get("name") or "").strip()
        return VatCheck(bool(data.get("isValid")), name if name and name != "---" else None)
