"""Small mail adapter so services never talk to SMTP directly and tests can capture messages."""

import smtplib
import threading
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

import structlog

log = structlog.get_logger("datahub.mail")


@dataclass(frozen=True)
class MailMessage:
    to: str
    subject: str
    body: str
    kind: str  # machine-readable template name, e.g. "email_verification"


class MailAdapter(Protocol):
    def send(self, message: MailMessage) -> None: ...


class SmtpMailer:
    """Plain SMTP (Mailpit in development). Failures are logged, never raised to the caller."""

    def __init__(self, host: str, port: int, sender: str, timeout: float = 5.0) -> None:
        self._host = host
        self._port = port
        self._sender = sender
        self._timeout = timeout

    def send(self, message: MailMessage) -> None:
        mime = EmailMessage()
        mime["From"] = self._sender
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime.set_content(message.body)
        try:
            with smtplib.SMTP(self._host, self._port, timeout=self._timeout) as smtp:
                smtp.send_message(mime)
        except (OSError, smtplib.SMTPException):
            # Never log the body: it can contain single-use tokens.
            log.error("mail_send_failed", kind=message.kind)


class InMemoryMailer:
    """Test double that records outgoing messages."""

    def __init__(self) -> None:
        self.sent: list[MailMessage] = []
        self._lock = threading.Lock()

    def send(self, message: MailMessage) -> None:
        with self._lock:
            self.sent.append(message)

    def to(self, address: str, kind: str | None = None) -> list[MailMessage]:
        return [m for m in self.sent if m.to == address and (kind is None or m.kind == kind)]
