from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from app.core.config import get_settings


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutboundEmail:
    to_email: str
    subject: str
    text_body: str
    from_email: str | None = None


def send_email(message: OutboundEmail) -> bool:
    settings = get_settings()
    from_email = (message.from_email or settings.email_from or "").strip()
    to_email = (message.to_email or "").strip()
    if not from_email or not to_email:
        logger.warning("email_delivery_skipped reason=missing_sender_or_recipient subject=%s", message.subject)
        return False
    if not settings.smtp_host:
        logger.warning("email_delivery_skipped reason=smtp_not_configured to=%s subject=%s", to_email, message.subject)
        return False

    email = EmailMessage()
    email["From"] = from_email
    email["To"] = to_email
    email["Subject"] = message.subject
    email.set_content(message.text_body)

    with smtplib.SMTP(settings.smtp_host, int(settings.smtp_port), timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password or "")
        smtp.send_message(email)
    logger.info("email_delivery_sent to=%s subject=%s", to_email, message.subject)
    return True
