import os
import smtplib
import ssl
from email.message import EmailMessage


def send_email(to_email: str, subject: str, text_body: str) -> None:
    """Send an email via SMTP.

    Env vars:
      - SMTP_HOST (required)
      - SMTP_PORT (optional, default 587)
      - SMTP_USERNAME (optional)
      - SMTP_PASSWORD (optional)
      - SMTP_FROM (required)
      - SMTP_USE_TLS (optional, default true)
    """

    host = os.getenv("SMTP_HOST")
    if not host:
        raise RuntimeError("SMTP_HOST is not set")

    from_email = os.getenv("SMTP_FROM")
    if not from_email:
        raise RuntimeError("SMTP_FROM is not set")

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() in ("1", "true", "yes", "y", "on")

    msg = EmailMessage()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text_body)

    if use_tls:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            if username and password:
                server.login(username, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port) as server:
            if username and password:
                server.login(username, password)
            server.send_message(msg)
