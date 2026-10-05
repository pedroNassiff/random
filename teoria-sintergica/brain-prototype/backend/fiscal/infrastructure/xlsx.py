"""Lector mínimo de .xlsx con la librería estándar: valores de cada celda por pestaña, en orden.

Solo lee valores (los de fórmulas, tal como quedaron calculados al guardar). Sin dependencias nuevas.
"""

from __future__ import annotations

import io
import zipfile
from xml.etree import ElementTree as ET  # nosec B405 - el archivo lo sube la propia persona; ver _MAX_BYTES

_NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
_MAX_UNCOMPRESSED = 50 * 1024 * 1024


class XlsxError(ValueError):
    pass


def _text(node: ET.Element) -> str:
    return "".join(t.text or "" for t in node.iter(f"{{{_NS['m']}}}t"))


def read_xlsx(data: bytes) -> list[tuple[str, dict[str, str]]]:
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise XlsxError("El archivo no es un Excel (.xlsx) válido.") from exc
    if sum(i.file_size for i in z.infolist()) > _MAX_UNCOMPRESSED:
        raise XlsxError("El Excel es demasiado grande.")  # evita una "bomba zip"
    try:
        names = set(z.namelist())
        shared = []
        if "xl/sharedStrings.xml" in names:
            shared = [_text(si) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", _NS)]  # nosec B314
        workbook = ET.fromstring(z.read("xl/workbook.xml"))  # nosec B314
        rels = {r.get("Id"): r.get("Target", "") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}  # nosec B314
        out: list[tuple[str, dict[str, str]]] = []
        sheets = workbook.find("m:sheets", _NS)
        for sheet in sheets if sheets is not None else []:
            target = rels.get(sheet.get(_REL), "").lstrip("/").removeprefix("xl/")
            out.append((sheet.get("name", ""), _cells(ET.fromstring(z.read(f"xl/{target}")), shared)))  # nosec B314
        return out
    except (KeyError, ET.ParseError, ValueError, IndexError) as exc:
        raise XlsxError("No se pudo leer el Excel.") from exc


def _cells(sheet: ET.Element, shared: list[str]) -> dict[str, str]:
    cells: dict[str, str] = {}
    for c in sheet.iter(f"{{{_NS['m']}}}c"):
        value = c.find("m:v", _NS)
        if value is not None and value.text is not None:
            text = shared[int(value.text)] if c.get("t") == "s" else value.text
        else:
            inline = c.find("m:is", _NS)
            text = _text(inline) if inline is not None else ""
        if text != "":
            cells[c.get("r", "")] = text
    return cells
