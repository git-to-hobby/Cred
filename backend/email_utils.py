import logging
import os

import aiosmtplib
from dotenv import load_dotenv
from email.message import EmailMessage

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

_SMTP_PLACEHOLDERS = {"your_email@gmail.com", "your_app_password", ""}


def is_smtp_configured() -> bool:
    """True when real SMTP credentials are set in backend/.env."""
    _load_smtp_env()
    user = (os.getenv("SMTP_USERNAME") or "").strip()
    pwd = (os.getenv("SMTP_PASSWORD") or "").strip()
    return (
        user not in _SMTP_PLACEHOLDERS
        and pwd not in _SMTP_PLACEHOLDERS
        and "your_gmail_app_password" not in pwd
    )


def smtp_config_hint() -> str:
    if is_smtp_configured():
        return ""
    return (
        "Email is not configured on the server. Set SMTP_USERNAME and SMTP_PASSWORD "
        "(Gmail App Password) in backend/.env, then restart the backend."
    )


def _load_smtp_env() -> None:
    """Load SMTP vars from backend/.env and master_agent/.env."""
    load_dotenv(os.path.join(BACKEND_DIR, ".env"))
    load_dotenv(os.path.join(BACKEND_DIR, "master_agent", ".env"), override=False)


async def send_customer_id_email(email: str, customer_id: str, name: str) -> bool:
    """Send customer ID to the user's email address."""
    _load_smtp_env()

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = (os.getenv("SMTP_USERNAME") or "").strip()
    smtp_password = (os.getenv("SMTP_PASSWORD") or "").strip()
    smtp_from = (os.getenv("SMTP_FROM") or smtp_username or "noreply@credflow.com").strip()

    placeholders = _SMTP_PLACEHOLDERS
    if smtp_username in placeholders or smtp_password in placeholders or "your_gmail_app_password" in smtp_password:
        logger.warning(
            "SMTP credentials not configured — set SMTP_USERNAME and SMTP_PASSWORD in backend/.env"
        )
        return False

    # Gmail requires the From address to match the authenticated account
    if "gmail" in smtp_host.lower():
        smtp_from = smtp_username

    try:
        message = EmailMessage()
        message["From"] = f"CredFlow Finance <{smtp_from}>"
        message["To"] = email
        message["Subject"] = "Your CredFlow Customer ID"

        body = f"""Dear {name},

Thank you for registering with CredFlow Finance!

Your Customer ID: {customer_id}

Please save this Customer ID for future logins. You will need it to access your account and apply for loans.

If you have any questions, please contact our support team.

Best regards,
CredFlow Finance Team
"""
        message.set_content(body.strip())

        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_username,
            password=smtp_password,
            start_tls=True,
        )

        logger.info("Customer ID email sent to %s", email)
        return True
    except Exception as e:
        logger.error("Failed to send customer ID email to %s: %s", email, e)
        return False


async def send_admin_otp_email(email: str, otp: str, name: str) -> bool:
    """Send one-time login code to the platform super admin."""
    _load_smtp_env()

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = (os.getenv("SMTP_USERNAME") or "").strip()
    smtp_password = (os.getenv("SMTP_PASSWORD") or "").strip()
    smtp_from = (os.getenv("SMTP_FROM") or smtp_username or "noreply@credflow.com").strip()

    placeholders = _SMTP_PLACEHOLDERS
    if smtp_username in placeholders or smtp_password in placeholders or "your_gmail_app_password" in smtp_password:
        logger.warning("SMTP credentials not configured — cannot send admin OTP")
        return False

    if "gmail" in smtp_host.lower():
        smtp_from = smtp_username

    try:
        message = EmailMessage()
        message["From"] = f"CredFlow Admin <{smtp_from}>"
        message["To"] = email
        message["Subject"] = "CredFlow Super Admin Login Code"

        body = f"""Hello {name},

Your CredFlow super admin login verification code is:

{otp}

This code expires in 10 minutes. Do not share it with anyone.

If you did not request this login, ignore this email.

CredFlow Platform Security
"""
        message.set_content(body.strip())

        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_username,
            password=smtp_password,
            start_tls=True,
        )

        logger.info("Admin OTP email sent to %s", email)
        return True
    except Exception as e:
        logger.error("Failed to send admin OTP email to %s: %s", email, e)
        return False


async def send_banker_credentials_email(
    email: str,
    name: str,
    banker_id: str,
    password: str,
    bank_name: str,
    role: str,
) -> bool:
    """Send bank officer login credentials after super admin approval."""
    _load_smtp_env()

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = (os.getenv("SMTP_USERNAME") or "").strip()
    smtp_password = (os.getenv("SMTP_PASSWORD") or "").strip()
    smtp_from = (os.getenv("SMTP_FROM") or smtp_username or "noreply@credflow.com").strip()

    placeholders = _SMTP_PLACEHOLDERS
    if smtp_username in placeholders or smtp_password in placeholders or "your_gmail_app_password" in smtp_password:
        logger.warning("SMTP credentials not configured — cannot send banker credentials")
        return False

    if "gmail" in smtp_host.lower():
        smtp_from = smtp_username

    try:
        message = EmailMessage()
        message["From"] = f"CredFlow Admin <{smtp_from}>"
        message["To"] = email
        message["Subject"] = "Your CredFlow Bank Officer Login"

        body = f"""Dear {name},

Your CredFlow bank officer account has been approved by the platform administrator.

Bank: {bank_name}
Role: {role}

Your login credentials:

Banker ID: {banker_id}
Password: {password}

Login at your organization's CredFlow admin portal (/admin/login).

Keep these credentials confidential. Do not share them with anyone.

If you did not expect this account, contact CredFlow platform support immediately.

CredFlow Platform Security
"""
        message.set_content(body.strip())

        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_username,
            password=smtp_password,
            start_tls=True,
        )

        logger.info("Banker credentials email sent to %s", email)
        return True
    except Exception as e:
        logger.error("Failed to send banker credentials email to %s: %s", email, e)
        return False


async def send_customer_password_reset_otp(email: str, otp: str, name: str) -> bool:
    """Send password reset OTP to a registered customer email."""
    _load_smtp_env()

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = (os.getenv("SMTP_USERNAME") or "").strip()
    smtp_password = (os.getenv("SMTP_PASSWORD") or "").strip()
    smtp_from = (os.getenv("SMTP_FROM") or smtp_username or "noreply@credflow.com").strip()

    placeholders = _SMTP_PLACEHOLDERS
    if smtp_username in placeholders or smtp_password in placeholders or "your_gmail_app_password" in smtp_password:
        logger.warning("SMTP credentials not configured — cannot send password reset OTP")
        return False

    if "gmail" in smtp_host.lower():
        smtp_from = smtp_username

    try:
        message = EmailMessage()
        message["From"] = f"CredFlow Finance <{smtp_from}>"
        message["To"] = email
        message["Subject"] = "CredFlow Password Reset Code"

        body = f"""Dear {name},

Your CredFlow password reset verification code is:

{otp}

This code expires in 10 minutes. Do not share it with anyone.

If you did not request a password reset, ignore this email.

CredFlow Finance Team
"""
        message.set_content(body.strip())

        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_username,
            password=smtp_password,
            start_tls=True,
        )

        logger.info("Customer password reset OTP sent to %s", email)
        return True
    except Exception as e:
        logger.error("Failed to send password reset OTP to %s: %s", email, e)
        return False
