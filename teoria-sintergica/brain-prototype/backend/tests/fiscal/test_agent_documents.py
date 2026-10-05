"""Adjuntos del chat y puesta en marcha guiada por documentos."""

from __future__ import annotations

import base64
import json
from dataclasses import replace

import pytest

from fiscal.application.attachments import MAX_BYTES, MAX_FILES, Attachment, content_blocks
from fiscal.application.errors import Invalid
from fiscal.domain.onboarding import MAX_LISTED, next_step, onboarding_steps
from tests.fiscal.helpers import PILOTO
from tests.fiscal.test_application_agent import PEDRO, call, make, say

PDF = b"%PDF-1.4\n%fake\n"
PNG = b"\x89PNG\r\n\x1a\n0000"
JPG = b"\xff\xd8\xff\xe0jfif"
WEBP = b"RIFF0000WEBP"


def att(name: str, media_type: str, raw: bytes) -> Attachment:
    return Attachment(name, media_type, base64.b64encode(raw).decode())


# ── adjuntos ────────────────────────────────────────────────────────────────
def test_pdf_becomes_a_document_block_and_images_get_a_name_label() -> None:
    pdf, png = att("036.pdf", "application/pdf", PDF), att("foto.png", "image/png", PNG)
    assert content_blocks([pdf, png]) == [
        {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": pdf.data},
            "title": "036.pdf",
        },
        {"type": "text", "text": "Imagen adjunta: foto.png"},
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": png.data}},
    ]
    assert content_blocks([]) == []
    assert [
        b["type"] for b in content_blocks([att("a.jpg", "image/jpeg", JPG), att("b.webp", "image/webp", WEBP)])
    ] == [
        "text",
        "image",
        "text",
        "image",
    ]


def test_blank_name_gets_a_default() -> None:
    assert content_blocks([att("  ", "application/pdf", PDF)])[0]["title"] == "documento"


@pytest.mark.parametrize(
    ("attachment", "message"),
    [
        (att("a.exe", "application/x-msdownload", b"MZ"), "a.exe: solo se aceptan PDF e imágenes"),
        (att("a.docx", "application/msword", PDF), "solo se aceptan PDF"),
        (Attachment("roto.pdf", "application/pdf", "%%%no-es-base64"), "roto.pdf: el archivo llegó dañado"),
        (Attachment("vacio.pdf", "application/pdf", ""), "vacio.pdf: el archivo está vacío"),
        (att("falso.pdf", "application/pdf", PNG), "falso.pdf: el contenido no coincide con su tipo"),
        (att("falso.png", "image/png", PDF), "no coincide"),
        (att("grande.pdf", "application/pdf", PDF + b"0" * MAX_BYTES), "grande.pdf: pesa más de 5 MB"),
    ],
)
def test_invalid_attachments(attachment: Attachment, message: str) -> None:
    with pytest.raises(Invalid, match=message):
        content_blocks([attachment])


def test_size_and_count_limits_are_inclusive() -> None:
    exact = att("justo.pdf", "application/pdf", PDF + b"0" * (MAX_BYTES - len(PDF)))
    assert len(content_blocks([exact])) == 1
    files = [att(f"{i}.pdf", "application/pdf", PDF) for i in range(MAX_FILES + 1)]
    assert len(content_blocks(files[:MAX_FILES])) == MAX_FILES
    with pytest.raises(Invalid, match="hasta 3 archivos"):
        content_blocks(files)


# ── pasos ───────────────────────────────────────────────────────────────────
def test_without_profile_the_first_step_is_the_036() -> None:
    steps = onboarding_steps(None, [])
    assert [(s.clave, s.estado) for s in steps] == [
        ("perfil", "pendiente"),
        ("tarifa_plana", "opcional"),
        ("facturas", "pendiente"),
        ("justificantes", "pendiente"),
        ("notificaciones", "opcional"),
    ]
    first = next_step(steps)
    assert first is not None and first.clave == "perfil" and "036 o 037" in first.documento
    assert "domicilio fiscal" in first.completa and steps[3].detalle == "" and steps[2].detalle == ""


def test_with_profile_and_overdue_items_the_next_step_is_receipts() -> None:
    steps = onboarding_steps(PILOTO, ["IVA 2T 2026", "Pago fraccionado IRPF 2T 2026"], facturas=3)
    assert [(s.clave, s.estado) for s in steps][:4] == [
        ("perfil", "hecho"),
        ("tarifa_plana", "hecho"),
        ("facturas", "hecho"),
        ("justificantes", "pendiente"),
    ]
    assert steps[2].detalle.startswith("Registradas este año: 3.")
    step = next_step(steps)
    assert step is not None and step.clave == "justificantes" and "CSV" in step.documento
    # Sin facturas registradas, el siguiente paso es cargarlas.
    pending = next_step(onboarding_steps(PILOTO, ["IVA 2T 2026"]))
    assert pending is not None and pending.clave == "facturas" and "303" in pending.completa
    assert step.detalle == "Vencidas sin cerrar: IVA 2T 2026, Pago fraccionado IRPF 2T 2026."


def test_everything_done_and_flat_rate_optional_when_missing() -> None:
    steps = onboarding_steps(replace(PILOTO, tarifa_plana_hasta=None), [], facturas=1)
    assert [(s.clave, s.estado) for s in steps] == [
        ("perfil", "hecho"),
        ("tarifa_plana", "opcional"),
        ("facturas", "hecho"),
        ("justificantes", "hecho"),
        ("notificaciones", "opcional"),
    ]
    assert next_step(steps) is None and "Seguridad Social" in steps[1].documento
    assert "confirmás vos" in steps[4].detalle


def test_long_overdue_lists_are_summarized() -> None:
    titles = [f"M{i}" for i in range(MAX_LISTED + 3)]
    detalle = onboarding_steps(PILOTO, titles)[3].detalle
    assert detalle == "Vencidas sin cerrar: " + ", ".join(titles[:MAX_LISTED]) + " y 3 más."
    assert onboarding_steps(PILOTO, titles[:MAX_LISTED])[3].detalle.endswith("M9.")


# ── agente ──────────────────────────────────────────────────────────────────
async def test_attachments_travel_before_the_text_only_in_the_current_message() -> None:
    agent, model, _ = await make(say("Leí el 036."))
    pdf = att("036.pdf", "application/pdf", PDF)
    await agent.chat(PEDRO, [], "acá va mi 036", "/dashboard", [pdf])
    content = model.calls[0][-1]["content"]
    assert [b["type"] for b in content] == ["document", "text", "text"]
    assert content[0]["source"]["data"] == pdf.data
    (stored,) = await agent._documents.list(PEDRO)
    assert content[1]["text"] == f"(Documento guardado: 036.pdf, id {stored.id})"
    assert content[2]["text"].endswith("\n\nacá va mi 036") and content[2]["text"].startswith("<contexto>")


async def test_without_attachments_the_message_stays_a_plain_string() -> None:
    agent, model, _ = await make(say("ok"))
    await agent.chat(PEDRO, [], "hola")
    assert isinstance(model.calls[0][-1]["content"], str)


async def test_invalid_attachment_fails_before_calling_the_model() -> None:
    agent, model, _ = await make(say("ok"))
    with pytest.raises(Invalid, match="solo se aceptan PDF"):
        await agent.chat(PEDRO, [], "x", None, [att("a.zip", "application/zip", b"PK")])
    assert model.calls == [] and await agent._documents.list(PEDRO) == []
    with pytest.raises(Invalid, match="hasta 3 archivos"):
        await agent.chat(PEDRO, [], "x", None, [att(f"{i}.pdf", "application/pdf", PDF) for i in range(4)])
    assert await agent._documents.list(PEDRO) == []


async def test_stored_documents_can_be_listed_and_read_again_by_the_agent() -> None:
    agent, model, _ = await make(say("ok"), call("ver_documentos"), say("ok"))
    await agent.chat(PEDRO, [], "?")  # todavía no hay nada guardado
    pdf, png = att("036.pdf", "application/pdf", PDF), att("foto.png", "image/png", PNG)
    await agent._documents.save(PEDRO, pdf)
    await agent._documents.save(PEDRO, png)
    await agent._documents.save("u-ana", att("ajeno.pdf", "application/pdf", PDF + b"x"))
    await agent.chat(PEDRO, [], "?")
    listed = json.loads(model.results()[0]["content"])
    assert {d["nombre"] for d in listed} == {"036.pdf", "foto.png"}
    assert set(listed[0]) == {"id", "nombre", "tipo", "subido", "bytes"} and listed[0]["subido"] == "2026-10-01"
    ids = {d["nombre"]: d["id"] for d in listed}

    agent2, model2, _ = await make(
        call("leer_documento", id=ids["036.pdf"]),
        call("leer_documento", id=ids["foto.png"]),
        call("leer_documento", id="no-existe"),
        say("ok"),
    )
    agent2._documents = agent._documents
    await agent2.chat(PEDRO, [], "?")
    (doc,) = model2.results(1)[0]["content"]
    assert doc == {
        "type": "document",
        "source": {"type": "base64", "media_type": "application/pdf", "data": pdf.data},
        "title": "036.pdf",
        "cache_control": {"type": "ephemeral"},
    }
    label, image = model2.results(2)[0]["content"]
    assert label == {"type": "text", "text": "Imagen adjunta: foto.png"}
    assert image["type"] == "image" and image["cache_control"] == {"type": "ephemeral"}
    missing = model2.results(3)[0]
    assert missing["is_error"] is True and missing["content"] == "Ese documento no existe."


async def test_documents_tool_when_empty() -> None:
    agent, model, _ = await make(call("ver_documentos"), say("ok"))
    await agent.chat(PEDRO, [], "?")
    assert model.results()[0]["content"] == "El usuario todavía no subió ningún documento."


async def test_steps_tool_without_profile() -> None:
    agent, model, _ = await make(call("ver_pasos"), say("Subí tu 036."), with_profile=False)
    await agent.chat(PEDRO, [], "¿qué necesito?")
    data = json.loads(model.results()[0]["content"])
    assert data["siguiente"] == "perfil" and data["pasos"][0]["estado"] == "pendiente"
    assert set(data["pasos"][0]) == {"clave", "titulo", "estado", "documento", "completa", "detalle"}


async def test_steps_tool_lists_overdue_obligations_without_monthly_quotas() -> None:
    agent, model, _ = await make(call("ver_pasos"), say("ok"))
    await agent.chat(PEDRO, [], "?")
    data = json.loads(model.results()[0]["content"])
    detalle = data["pasos"][3]["detalle"]
    assert data["siguiente"] == "facturas" and data["pasos"][2]["clave"] == "facturas"
    assert "IVA 2T 2026" in detalle and "IVA 3T 2026" not in detalle and "Cuota de autónomos" not in detalle


async def test_steps_tool_when_everything_is_closed() -> None:
    agent, model, _ = await make(call("ver_pasos"), say("ok"))
    view = await agent._service.calendar(PEDRO)
    for i in view.items:
        if i.aviso == "vencida":
            await agent._service.set_status(PEDRO, i.obligation.key, "presentado", "CSV")
    await agent.chat(PEDRO, [], "?")
    data = json.loads(model.results()[0]["content"])
    assert data["siguiente"] == "facturas" and data["pasos"][3]["estado"] == "hecho"
