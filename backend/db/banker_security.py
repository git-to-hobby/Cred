"""Secure banker ID/password generation and validation."""
import hashlib
import os
import re
import secrets

PASSWORD_SALT = os.getenv("BANKER_PASSWORD_SALT", "credflow-banker-salt-v1")
BANKER_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{12,48}$")
LEGACY_BANKER_IDS = ("900000000", "900000001", "900000002", "900000003")


def hash_password(password: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), PASSWORD_SALT.encode(), 120_000
    ).hex()


def generate_banker_id() -> str:
    """Random ID — not guessable; must not contain ':' (used in auth tokens)."""
    while True:
        candidate = f"BK{secrets.token_hex(12).upper()}"
        if ":" not in candidate and BANKER_ID_PATTERN.match(candidate):
            return candidate


def generate_password(length: int = 20) -> str:
    return secrets.token_urlsafe(length)


def is_valid_banker_id(banker_id: str) -> bool:
    if not banker_id or ":" in banker_id:
        return False
    return bool(BANKER_ID_PATTERN.match(banker_id))
