"""Documentos adjuntos al chat del agente (036, resoluciones, justificantes, notificaciones).

Validación y formato para el modelo. Guardarlos es trabajo de `documents.DocumentService`.
"""

from __future__ import annotations

import base64
import binascii
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from fiscal.application.errors import Invalid

MAX_FILES = 3
MAX_BYTES = 5 * 1024 * 1024
_PDF = "application/pdf"
_MARKDOWN = "text/markdown"
_ACCEPTED = "solo se aceptan PDF, Markdown e imágenes (PNG, JPG o WebP)."
# Tipo declarado → firma con la que debe empezar el archivo.
_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    _PDF: (b"%PDF-",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/webp": (b"RIFF",),
}


@dataclass(frozen=True)
class Attachment:
    name: str
    media_type: str
    data: str
    """Contenido en base64, sin saltos de línea."""


def decode(a: Attachment) -> bytes:
    """Contenido validado: tipo admitido, base64 correcto, tamaño y firma del archivo."""
    name = a.name.strip() or "documento"
    signatures = _SIGNATURES.get(a.media_type)
    if signatures is None and a.media_type != _MARKDOWN:
        raise Invalid(f"{name}: {_ACCEPTED}")
    try:
        raw = base64.b64decode(a.data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise Invalid(f"{name}: el archivo llegó dañado. Volvé a adjuntarlo.") from exc
    if not raw:
        raise Invalid(f"{name}: el archivo está vacío.")
    if len(raw) > MAX_BYTES:
        raise Invalid(f"{name}: pesa más de {MAX_BYTES // (1024 * 1024)} MB.")
    if signatures is None:  # Markdown: no tiene firma; tiene que ser texto UTF-8 sin bytes nulos.
        _text(raw, name)
    elif not raw.startswith(signatures):
        raise Invalid(f"{name}: el contenido no coincide con su tipo ({a.media_type}).")
    return raw


def _text(raw: bytes, name: str) -> str:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise Invalid(f"{name}: no es texto UTF-8.") from exc
    if "\x00" in text:
        raise Invalid(f"{name}: no es texto UTF-8.")
    return text


def block_for(name: str, media_type: str, data: str) -> list[dict[str, Any]]:
    """Bloques de un documento ya validado, en el formato de la Messages API."""
    if media_type == _MARKDOWN:
        text = _text(base64.b64decode(data), name)
        return [
            {"type": "document", "source": {"type": "text", "media_type": "text/plain", "data": text}, "title": name}
        ]
    source = {"type": "base64", "media_type": media_type, "data": data}
    if media_type == _PDF:
        return [{"type": "document", "source": source, "title": name}]
    return [{"type": "text", "text": f"Imagen adjunta: {name}"}, {"type": "image", "source": source}]


def check_count(attachments: Sequence[Attachment]) -> None:
    if len(attachments) > MAX_FILES:
        raise Invalid(f"Podés adjuntar hasta {MAX_FILES} archivos por mensaje.")


def content_blocks(attachments: Sequence[Attachment]) -> list[dict[str, Any]]:
    """Bloques de contenido para el mensaje del usuario. Valida cada adjunto."""
    check_count(attachments)
    blocks: list[dict[str, Any]] = []
    for a in attachments:
        decode(a)
        blocks.extend(block_for(a.name.strip() or "documento", a.media_type, a.data))
    return blocks
