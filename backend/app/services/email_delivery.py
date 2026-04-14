"""
Отправка писем через SMTP (опционально).

Если SMTP_HOST не задан, отправка пропускается — приглашение всё равно создаётся в БД.
"""
from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def smtp_is_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST", "").strip())


def _is_console_mode(host: str) -> bool:
    return host.lower() in ("console", "log", "stdout")


def try_send_html_email(
    *,
    to_address: str,
    subject: str,
    html_body: str,
    text_body: str,
) -> bool:
    """
    Отправляет multipart/alternative письмо. Возвращает True при успехе.
    Без SMTP_HOST — False, без исключения.
    """
    host = os.environ.get("SMTP_HOST", "").strip()
    if not host:
        logger.warning(
            "SMTP_HOST не задан — письмо на %s не отправляется (только ссылка в API).",
            to_address,
        )
        return False

    if _is_console_mode(host):
        from_dummy = (
            os.environ.get("SMTP_FROM", "").strip() or "noreply@localhost"
        )
        logger.info(
            "[email console] письмо не уходит в сеть — смотрите лог ниже\n"
            "  To: %s\n  From: %s\n  Subject: %s\n--- text ---\n%s\n--- html (начало) ---\n%s",
            to_address,
            from_dummy,
            subject,
            text_body,
            html_body[:4000] + ("…" if len(html_body) > 4000 else ""),
        )
        return True

    port_str = os.environ.get("SMTP_PORT", "587").strip()
    try:
        port = int(port_str)
    except ValueError:
        port = 587

    user = os.environ.get("SMTP_USER", "").strip()
    # Gmail показывает пароль приложения с пробелами — убираем для логина SMTP
    password = (os.environ.get("SMTP_PASSWORD", "") or "").replace(" ", "")
    from_addr = os.environ.get("SMTP_FROM", "").strip() or user
    if not from_addr:
        logger.error("Задайте SMTP_FROM или SMTP_USER для отправки почты.")
        return False

    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() in (
        "1",
        "true",
        "yes",
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_address
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    payload = msg.as_string()

    try:
        if port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                if user:
                    server.login(user, password)
                server.sendmail(from_addr, [to_address], payload)
        else:
            with smtplib.SMTP(host, port, timeout=30) as server:
                server.ehlo()
                if use_tls:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                    server.ehlo()
                if user:
                    server.login(user, password)
                server.sendmail(from_addr, [to_address], payload)
        logger.info("Письмо отправлено на %s", to_address)
        return True
    except OSError as exc:
        logger.exception("SMTP ошибка сети при отправке на %s: %s", to_address, exc)
        return False
    except smtplib.SMTPException as exc:
        logger.exception("SMTP отказ при отправке на %s: %s", to_address, exc)
        return False
