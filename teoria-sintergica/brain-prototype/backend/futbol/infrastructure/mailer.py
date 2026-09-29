"""Envío del magic link: SMTP si está configurado, consola en desarrollo."""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

logger = logging.getLogger("futbol.mailer")


class ConsoleMailer:
    """Dev: imprime el link en el log del backend. Nunca usar en producción."""

    async def send_magic_link(self, email: str, link: str) -> None:
        logger.warning("[futbol] magic link para %s: %s", email, link)


class SmtpMailer:
    def __init__(self, host: str, port: int, user: str, password: str, sender: str) -> None:
        self._host, self._port, self._user, self._password, self._sender = host, port, user, password, sender

    def _send(self, email: str, link: str) -> None:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = self._sender, email, "Tu link para entrar a Fútbol Vaquero"
        msg.set_content(f"Entrá con este link (vale 15 minutos y se usa una sola vez):\n\n{link}\n")
        with smtplib.SMTP(self._host, self._port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(self._user, self._password)
            smtp.send_message(msg)

    async def send_magic_link(self, email: str, link: str) -> None:
        await asyncio.to_thread(self._send, email, link)
