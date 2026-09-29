"""Mailer y wiring (sin red ni BBDD)."""

from __future__ import annotations

import logging
import smtplib
from typing import Any

import pytest

from futbol.infrastructure.mailer import ConsoleMailer, SmtpMailer
from futbol.infrastructure.wiring import build_services


async def test_console_mailer_logs_the_link(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="futbol.mailer"):
        await ConsoleMailer().send_magic_link("a@x.com", "https://x/entrar?token=abc")
    assert "https://x/entrar?token=abc" in caplog.text


async def test_smtp_mailer_sends_message_with_link(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: dict[str, Any] = {}

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: int) -> None:
            sent["server"] = (host, port)

        def __enter__(self) -> FakeSMTP:
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def starttls(self) -> None:
            sent["tls"] = True

        def login(self, user: str, password: str) -> None:
            sent["login"] = (user, password)

        def send_message(self, msg: Any) -> None:
            sent["msg"] = msg

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    await SmtpMailer("smtp.x", 587, "u", "p", "futbol@x.com").send_magic_link("a@x.com", "https://x/l")
    assert sent["server"] == ("smtp.x", 587) and sent["tls"] and sent["login"] == ("u", "p")
    assert sent["msg"]["To"] == "a@x.com" and "https://x/l" in sent["msg"].get_content()


def test_build_services_uses_console_mailer_without_smtp_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FUTBOL_SMTP_HOST", raising=False)
    monkeypatch.setenv("FUTBOL_ADMIN_EMAILS", "a@x.com, ,b@x.com")
    svc = build_services(object())
    assert isinstance(svc.auth._mailer, ConsoleMailer)
    assert svc.auth._admin_emails == {"a@x.com", "b@x.com"}


def test_build_services_uses_smtp_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FUTBOL_SMTP_HOST", "smtp.x")
    svc = build_services(object())
    assert isinstance(svc.auth._mailer, SmtpMailer)
