# CRITICAL: Compatibility shim MUST be at the very top, before any other imports
import sys
import types
import langchain_core

if not hasattr(langchain_core, 'pydantic_v1'):
    import pydantic
    from pydantic import field_validator, model_validator
    
    pydantic_v1_module = types.ModuleType('pydantic_v1')
    pydantic_v1_module.SecretStr = pydantic.SecretStr
    
    if hasattr(pydantic, 'PrivateAttr'):
        pydantic_v1_module.PrivateAttr = pydantic.PrivateAttr
    else:
        class PrivateAttr:
            def __init__(self, default=None, **kwargs):
                self.default = default
        pydantic_v1_module.PrivateAttr = PrivateAttr
    
    def root_validator(*fields, **kwargs):
        def decorator(func):
            return model_validator(mode='before')(func)
        return decorator
    
    pydantic_v1_module.root_validator = root_validator
    pydantic_v1_module.BaseModel = pydantic.BaseModel
    pydantic_v1_module.Field = pydantic.Field
    pydantic_v1_module.validator = field_validator
    
    langchain_core.pydantic_v1 = pydantic_v1_module
    sys.modules['langchain_core.pydantic_v1'] = pydantic_v1_module

import uvicorn
import httpx
import logging
import json
import re
import asyncio
import os
import random
import uuid
import hmac
import hashlib
from collections import defaultdict
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Header
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import time
from pymongo import MongoClient
import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import sys

_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_backend_root, ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=False)

sys.path.append(_backend_root)
sys.path.append(os.path.join(_backend_root, "db"))
from email_utils import (
    send_customer_id_email,
    send_admin_otp_email,
    send_banker_credentials_email,
    send_customer_password_reset_otp,
    is_smtp_configured,
    smtp_config_hint,
)
from banker_security import is_valid_banker_id, generate_banker_id, generate_password

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph.message import add_messages
from typing import TypedDict, List, Annotated, Any, Optional
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

user_locks = defaultdict(asyncio.Lock)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "loan_archives")
mongo_client = None

# === POSTGRES CONFIG ===
PG_DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "loan_chatbot_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "mehrasonu044"),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432")
}

# === RATE LIMITING FOR FREE TIER ===
request_times = defaultdict(list)
MAX_REQUESTS_PER_MINUTE = 10
CHAT_LLM_TIMEOUT = float(os.getenv("CHAT_LLM_TIMEOUT", "18"))
_fast_default = "true" if os.getenv("RENDER") else ""
USE_FAST_CHAT = os.getenv("USE_FAST_CHAT", _fast_default).lower() in ("1", "true", "yes")

# === BANKER ADMIN AUTH (multi-bank, DB-backed) ===
ADMIN_BANKER_ID = os.getenv("ADMIN_BANKER_ID", "").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_NAME = os.getenv("ADMIN_NAME", "CredFlow Admin").strip()
ADMIN_ROLE = os.getenv("ADMIN_ROLE", "Platform Admin").strip()
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "") or os.getenv("GOOGLE_API_KEY", "") or "credflow-admin-dev-secret"
ADMIN_TOKEN_TTL_SEC = int(os.getenv("ADMIN_TOKEN_TTL_SEC", "86400"))
BANKER_PASSWORD_SALT = os.getenv("BANKER_PASSWORD_SALT", "credflow-banker-salt-v1")
ADMIN_LOGIN_MAX_ATTEMPTS = int(os.getenv("ADMIN_LOGIN_MAX_ATTEMPTS", "5"))
ADMIN_LOGIN_LOCKOUT_SEC = int(os.getenv("ADMIN_LOGIN_LOCKOUT_SEC", "900"))
PLATFORM_ADMIN_EMAIL = os.getenv("PLATFORM_ADMIN_EMAIL", "").strip() or os.getenv("SMTP_USERNAME", "").strip()
ADMIN_OTP_TTL_SEC = int(os.getenv("ADMIN_OTP_TTL_SEC", "600"))

_admin_login_failures: dict[str, list[float]] = defaultdict(list)
_admin_otp_sessions: dict[str, dict] = {}

CUSTOMER_OTP_TTL_SEC = int(os.getenv("CUSTOMER_OTP_TTL_SEC", "600"))
_customer_otp_sessions: dict[str, dict] = {}
_forgot_attempts: dict[str, list[float]] = defaultdict(list)
FORGOT_MAX_ATTEMPTS = 5
FORGOT_LOCKOUT_SEC = 900


def _normalize_phone(phone: str) -> str:
    return "".join(ch for ch in phone if ch.isdigit())[-10:]


def _aadhaar_last4(aadhaar: str | None) -> str:
    if not aadhaar:
        return ""
    digits = "".join(ch for ch in aadhaar if ch.isdigit())
    return digits[-4:] if len(digits) >= 4 else ""


def _forgot_locked(key: str) -> bool:
    cutoff = time.time() - FORGOT_LOCKOUT_SEC
    attempts = [t for t in _forgot_attempts.get(key, []) if t > cutoff]
    _forgot_attempts[key] = attempts
    return len(attempts) >= FORGOT_MAX_ATTEMPTS


def _record_forgot_failure(key: str) -> None:
    _forgot_attempts[key].append(time.time())


def _clear_forgot_failures(key: str) -> None:
    _forgot_attempts.pop(key, None)


def _create_customer_otp_session(cust_id: str, email: str) -> tuple[str, str]:
    session_id = str(uuid.uuid4())
    otp = _generate_otp()
    _customer_otp_sessions[session_id] = {
        "custId": cust_id,
        "email": email.lower(),
        "otp_hash": _hash_banker_password(otp),
        "exp": time.time() + CUSTOMER_OTP_TTL_SEC,
    }
    return session_id, otp


def _consume_customer_otp_session(session_id: str, cust_id: str, email: str, otp: str) -> bool:
    session = _customer_otp_sessions.get(session_id)
    if not session:
        return False
    if (
        session["custId"] != cust_id.strip()
        or session["email"] != email.strip().lower()
        or session["exp"] < time.time()
    ):
        _customer_otp_sessions.pop(session_id, None)
        return False
    if not _verify_banker_password(otp.strip(), session["otp_hash"]):
        return False
    _customer_otp_sessions.pop(session_id, None)
    return True


def _admin_login_configured() -> bool:
    return bool(
        ADMIN_BANKER_ID
        and ADMIN_PASSWORD
        and len(ADMIN_PASSWORD) >= 12
        and is_valid_banker_id(ADMIN_BANKER_ID)
    )


def _admin_login_locked(banker_id: str) -> bool:
    cutoff = time.time() - ADMIN_LOGIN_LOCKOUT_SEC
    attempts = [t for t in _admin_login_failures.get(banker_id, []) if t > cutoff]
    _admin_login_failures[banker_id] = attempts
    return len(attempts) >= ADMIN_LOGIN_MAX_ATTEMPTS


def _record_admin_login_failure(banker_id: str) -> None:
    _admin_login_failures[banker_id].append(time.time())


def _clear_admin_login_failures(banker_id: str) -> None:
    _admin_login_failures.pop(banker_id, None)


def _hash_banker_password(password: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), BANKER_PASSWORD_SALT.encode(), 120_000
    ).hex()


def _verify_banker_password(password: str, stored_hash: str) -> bool:
    return hmac.compare_digest(_hash_banker_password(password), stored_hash)


def _get_banker_record_raw(banker_id: str) -> dict | None:
    conn = get_pg_connection()
    if not conn:
        return None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            SELECT b.banker_id, b.bank_id, b.name, b.role, b.password_hash,
                   b.is_active, b.approval_status, b.email,
                   bk.bank_name, bk.bank_code
            FROM bankers b
            JOIN banks bk ON bk.bank_id = b.bank_id
            WHERE b.banker_id = %s AND bk.is_active = TRUE
            """,
            (banker_id,),
        )
        return cursor.fetchone()
    except Exception as e:
        logger.warning(f"Banker lookup failed (run db/seed_bankers.py): {e}")
        return None
    finally:
        conn.close()


def _get_banker_record(banker_id: str) -> dict | None:
    row = _get_banker_record_raw(banker_id)
    if not row or not row.get("is_active"):
        return None
    if row.get("bank_id") == "BANK_CREDFLOW":
        if (row.get("approval_status") or "approved") != "approved":
            return None
        return row
    if (row.get("approval_status") or "pending") != "approved":
        return None
    return row


def _is_platform_admin(profile: dict) -> bool:
    role = (profile.get("role") or "").lower()
    return profile.get("bankId") == "BANK_CREDFLOW" or "platform admin" in role


def _profile_from_row(row: dict) -> dict:
    profile = {
        "bankerId": row["banker_id"],
        "bankId": row["bank_id"],
        "bankName": row["bank_name"],
        "bankCode": row["bank_code"],
        "name": row["name"],
        "role": row["role"],
    }
    profile["isPlatformAdmin"] = _is_platform_admin(profile)
    return profile


def _authenticate_banker(banker_id: str, password: str) -> tuple[dict | None, str | None]:
    """Returns (profile, error_detail). error_detail hints at pending/disabled states."""
    row = _get_banker_record_raw(banker_id)
    if row and _verify_banker_password(password, row["password_hash"]):
        if _is_platform_admin(_profile_from_row(row)):
            if (row.get("approval_status") or "approved") != "approved":
                return None, "Account not approved"
            return _profile_from_row(row), None
        if (row.get("approval_status") or "pending") != "approved":
            return None, "Account pending platform admin approval"
        if not row.get("is_active"):
            return None, "Account disabled by platform admin"
        return _profile_from_row(row), None
    if _admin_login_configured() and banker_id == ADMIN_BANKER_ID and password == ADMIN_PASSWORD:
        profile = {
            "bankerId": banker_id,
            "bankId": "BANK_CREDFLOW",
            "bankName": "CredFlow Platform",
            "bankCode": "CFLOW",
            "name": ADMIN_NAME,
            "role": ADMIN_ROLE,
        }
        profile["isPlatformAdmin"] = _is_platform_admin(profile)
        return profile, None
    return None, None


def _generate_otp() -> str:
    return f"{random.randint(100000, 999999)}"


def _create_otp_session(profile: dict) -> tuple[str, str]:
    session_id = str(uuid.uuid4())
    otp = _generate_otp()
    _admin_otp_sessions[session_id] = {
        "bankerId": profile["bankerId"],
        "bankId": profile["bankId"],
        "profile": profile,
        "otp_hash": _hash_banker_password(otp),
        "exp": time.time() + ADMIN_OTP_TTL_SEC,
    }
    return session_id, otp


def _consume_otp_session(session_id: str, banker_id: str, otp: str) -> dict | None:
    session = _admin_otp_sessions.get(session_id)
    if not session:
        return None
    if session["bankerId"] != banker_id or session["exp"] < time.time():
        _admin_otp_sessions.pop(session_id, None)
        return None
    if not _verify_banker_password(otp.strip(), session["otp_hash"]):
        return None
    _admin_otp_sessions.pop(session_id, None)
    return session["profile"]


def create_admin_token(banker_id: str, bank_id: str) -> str:
    exp = int(time.time()) + ADMIN_TOKEN_TTL_SEC
    payload = f"{banker_id}:{bank_id}:{exp}"
    sig = hmac.new(ADMIN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def verify_admin_token(token: str) -> tuple[str, str] | None:
    try:
        banker_id, bank_id, exp_str, sig = token.split(":", 3)
        if int(exp_str) < time.time():
            return None
        payload = f"{banker_id}:{bank_id}:{exp_str}"
        expected = hmac.new(ADMIN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        return banker_id, bank_id
    except (ValueError, TypeError):
        return None


def require_admin(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    parsed = verify_admin_token(authorization[7:].strip())
    if not parsed:
        raise HTTPException(status_code=401, detail="Invalid or expired admin session")
    banker_id, bank_id = parsed
    row = _get_banker_record(banker_id)
    if row and row["bank_id"] == bank_id:
        profile = {
            "bankerId": row["banker_id"],
            "bankId": row["bank_id"],
            "bankName": row["bank_name"],
            "bankCode": row["bank_code"],
            "name": row["name"],
            "role": row["role"],
        }
        profile["isPlatformAdmin"] = _is_platform_admin(profile)
        return profile
    if _admin_login_configured() and banker_id == ADMIN_BANKER_ID and bank_id == "BANK_CREDFLOW":
        profile = {
            "bankerId": banker_id,
            "bankId": bank_id,
            "bankName": "CredFlow Platform",
            "bankCode": "CFLOW",
            "name": ADMIN_NAME,
            "role": ADMIN_ROLE,
        }
        profile["isPlatformAdmin"] = _is_platform_admin(profile)
        return profile
    raise HTTPException(status_code=401, detail="Invalid or expired admin session")


def require_platform_admin(admin: dict = Depends(require_admin)) -> dict:
    if not admin.get("isPlatformAdmin"):
        raise HTTPException(status_code=403, detail="Platform admin access required")
    return admin


def _log_loan_audit(
    cursor,
    *,
    loan_id: int,
    cust_id: str,
    customer_name: str,
    action: str,
    admin: dict,
    requested_amount,
    approved_amount,
    note: str,
):
    cursor.execute(
        """
        INSERT INTO loan_audit_log (
            loan_id, cust_id, customer_name, action,
            banker_id, banker_name, bank_id, bank_name,
            requested_amount, approved_amount, note
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            loan_id,
            cust_id,
            customer_name,
            action,
            admin["bankerId"],
            admin["name"],
            admin["bankId"],
            admin["bankName"],
            requested_amount,
            approved_amount,
            note,
        ),
    )

# === AGENT URLS ===
AGENT_URLS = {
    "sales": os.getenv("SALES_AGENT_URL", "http://127.0.0.1:8001/sales"),
    "verification": os.getenv("VERIFICATION_AGENT_URL", "http://127.0.0.1:8002/verify"),
    "verification_statement": os.getenv(
        "VERIFICATION_STATEMENT_URL", "http://127.0.0.1:8002/analyze-statement"
    ),
    "underwriting": os.getenv("UNDERWRITING_AGENT_URL", "http://127.0.0.1:8003/underwrite"),
    "sanction": os.getenv("SANCTION_AGENT_URL", "http://127.0.0.1:8004/sanction"),
    "doc_processor": os.getenv("DOC_PROCESSOR_URL", "http://127.0.0.1:8005/verify_salary"),
}

# === GEMINI API CONFIG ===
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
if not GOOGLE_API_KEY:
    logger.warning("GOOGLE_API_KEY not set. Please create a .env file with your API key.")

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=GOOGLE_API_KEY,
    convert_system_message_to_human=True,
    temperature=0.7,
    max_retries=1,
)

app_http_client = None
app_graph = None
memory_saver = None

# === PYDANTIC MODELS ===
class ChatRequest(BaseModel):
    customer_id: str
    message: str
    language: str = "en"

LANGUAGE_INSTRUCTIONS = {
    "en": (
        "LANGUAGE RULE: Respond ONLY in English. All steps, questions, and explanations "
        "must be in clear professional English."
    ),
    "hi": (
        "LANGUAGE RULE: सभी उत्तर केवल हिंदी (देवनागरी लिपि) में दें। "
        "सरल, स्पष्ट और विनम्र हिंदी का प्रयोग करें। "
        "Roman script / Hinglish का प्रयोग बिल्कुल न करें। "
        "केवल तकनीकी शब्दों के लिए अंग्रेज़ी रखें: EMI, KYC, PAN, PDF, NOC।"
    ),
}

class LoginRequest(BaseModel):
    custId: str
    password: str

class ForgotCustomerIdEmailRequest(BaseModel):
    email: str

class ForgotCustomerIdPhoneRequest(BaseModel):
    phone: str
    aadhaarLast4: str

class ForgotPasswordRequestRequest(BaseModel):
    custId: str
    email: str

class ForgotPasswordPhoneRequest(BaseModel):
    custId: str
    phone: str
    aadhaarLast4: str
    newPassword: str

class ForgotPasswordResetRequest(BaseModel):
    otpSessionId: str
    custId: str
    email: str
    otp: str
    newPassword: str

class AdminLoginRequest(BaseModel):
    bankerId: str
    password: str

class AdminOtpVerifyRequest(BaseModel):
    otpSessionId: str
    bankerId: str
    otp: str

class CreateBankerRequest(BaseModel):
    name: str
    bankId: str
    role: str = "Loan Officer"
    email: str | None = None

class LoanDecisionRequest(BaseModel):
    action: str
    note: str = ""

class BankerStatusRequest(BaseModel):
    is_active: bool

# === TOOLS DEFINITION ===
@tool
async def tool_get_sales_offer(customer_id: str) -> dict:
    """Get pre-approved loan offer. Call this FIRST. Returns pre_approved_limit and interest_rate_str."""
    logger.info(f"Tool: Getting sales offer for {customer_id}")
    try:
        response = await app_http_client.post(AGENT_URLS["sales"], json={"customer_id": customer_id})
        response.raise_for_status()
        result = response.json()
        
        normalized = {
            "pre_approved_limit": result.get('pre_approved_limit', 0),
            "interest_rate": float(result.get('interest_options', ['8.5'])[0].replace('%', '')) if result.get('interest_options') else 8.5,
            "message": result.get('message', ''),
            "status": "success"
        }
        logger.info(f"Sales offer result: {normalized}")
        return normalized
    except Exception as e:
        logger.error(f"Sales agent error: {e}")
        return {"error": str(e), "status": "failed"}

@tool
async def tool_sales_conversation(customer_id: str, user_message: str) -> dict:
    """Engage with sales agent for ANY questions about loan products, schemes, government programs, interest rates, or loan details. 
    The sales agent has expert knowledge about government schemes like MUDRA, PMEGP, PMAY-U, Solar financing, etc.
    Use this tool when user asks about: what loans are available, government schemes, subsidies, eligibility, comparisons, or any product information."""
    logger.info(f"Tool: Sales conversation for {customer_id}: {user_message}")
    try:
        payload = {"customer_id": customer_id, "user_message": user_message}
        response = await app_http_client.post(AGENT_URLS["sales"], json=payload)
        response.raise_for_status()
        result = response.json()
        
        # Extract the detailed message from sales agent
        sales_message = result.get('message', '')
        
        sales_response = {
            "message": sales_message,  # This contains the detailed scheme information
            "pre_approved_limit": result.get('pre_approved_limit'),
            "interest_options": result.get('interest_options'),
            "response_type": result.get('response_type', 'info'),
            "status": "success"
        }
        logger.info(f"Sales conversation result (truncated): {sales_message[:200]}...")
        return sales_response
    except Exception as e:
        logger.error(f"Sales conversation error: {e}")
        return {"error": str(e), "message": "Sorry, I couldn't reach the sales agent.", "status": "failed"}

@tool
async def tool_verify_kyc(customer_id: str) -> dict:
    """Verify customer KYC status. Call BEFORE underwriting. Returns kyc_status."""
    logger.info(f"Tool: Verifying KYC for {customer_id}")
    try:
        response = await app_http_client.post(AGENT_URLS["verification"], json={"customer_id": customer_id})
        response.raise_for_status()
        result = response.json()
        logger.info(f"KYC verification result: {result}")
        return result
    except Exception as e:
        logger.error(f"Verification agent error: {e}")
        return {"error": str(e), "kyc_status": "failed"}

@tool
async def tool_analyze_bank_statement(file_path: str) -> dict:
    """Analyze bank statement PDF to calculate financial health score. Extract income, expenses, and account balance. Returns score (0-100), insights, and transaction preview."""
    logger.info(f"Tool: Analyzing bank statement: {file_path}")
    try:
        # Read the file
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f, 'application/pdf')}
            response = await app_http_client.post(
                AGENT_URLS["verification_statement"],
                files=files
            )
        
        response.raise_for_status()
        result = response.json()
        
        logger.info(f"Bank statement analysis result: {result}")
        return {
            "status": result.get('status', 'failed'),
            "score": result.get('score', 0),
            "insights": result.get('insights', {}),
            "transactions_preview": result.get('transactions_preview', []),
            "filename": result.get('filename', ''),
            "message": result.get('message', '')
        }
    except Exception as e:
        logger.error(f"Bank statement analysis error: {e}")
        return {"status": "failed", "error": str(e), "score": 0}

@tool
async def tool_run_underwriting(
    customer_id: str, 
    requested_loan_amount: int, 
    pre_approved_limit: int, 
    monthly_salary: int, 
    interest_rate: float, 
    loan_tenure_months: int
) -> dict:
    """Run underwriting check with risk engine. Returns approval status with risk-adjusted terms."""
    logger.info(f"Tool: Running underwriting for {customer_id}")
    try:
        payload = {
            "customer_id": customer_id,
            "requested_loan_amount": requested_loan_amount,
            "pre_approved_limit": pre_approved_limit,
            "monthly_salary": monthly_salary,
            "interest_rate": interest_rate,
            "loan_tenure_months": loan_tenure_months
        }
        response = await app_http_client.post(AGENT_URLS["underwriting"], json=payload)
        response.raise_for_status()
        result = response.json()
        logger.info(f"Underwriting result: {result}")
        return result
    except Exception as e:
        logger.error(f"Underwriting agent error: {e}")
        return {"error": str(e), "status": "failed"}

@tool
async def tool_generate_sanction(
    customer_id: str, 
    loan_id: int,
    loan_amount: int, 
    interest_rate: float, 
    tenure_months: int
) -> dict:
    """Generate sanction letter PDF. Only call after user is approved."""
    logger.info(f"Tool: Generating sanction letter for {customer_id}, loan_id: {loan_id}")
    try:
        payload = {
            "customer_id": customer_id,
            "loan_id": loan_id,
            "loan_amount": loan_amount,
            "interest_rate": interest_rate,
            "tenure_months": tenure_months
        }
        logger.info(f"Sending to sanction agent: {payload}")
        response = await app_http_client.post(AGENT_URLS["sanction"], json=payload)
        
        logger.info(f"Sanction agent response status: {response.status_code}")
        response.raise_for_status()
        result = response.json()
        file_path = result.get('file_path', 'N/A')
        if file_path != 'N/A':
            file_path = file_path.replace("../../", "")
        return {"status": "success", "file_path": file_path}
    except Exception as e:
        logger.error(f"Sanction agent error: {e}")
        return {"error": str(e), "status": "failed"}

@tool
async def tool_verify_salary_document(customer_id: str, file_path: str) -> dict:
    """Verify salary from salary slip or income document. Returns verified salary amount."""
    logger.info(f"Tool: Verifying salary document for {customer_id}: {file_path}")
    try:
        payload = {"file_path": file_path}
        response = await app_http_client.post(AGENT_URLS["doc_processor"], json=payload)
        response.raise_for_status()
        result = response.json()
        
        salary_result = {
            "status": result.get('status', 'failed'),
            "monthly_salary": result.get('monthly_salary'),
            "salary_source": result.get('salary_source'),
            "document_type": result.get('document_type'),
            "confidence": result.get('confidence', 0),
            "error": result.get('error')
        }
        
        logger.info(f"Salary verification result: {salary_result}")
        return salary_result
    except Exception as e:
        logger.error(f"Salary verification error: {e}")
        return {"status": "failed", "error": str(e)}

@tool
async def tool_archive_rejection(
    customer_id: str,
    loan_id: int,
    requested_loan_amount: int,
    interest_rate: float,
    rejection_reason: str
) -> dict:
    """Archive a rejected loan application to MongoDB."""
    logger.info(f"Tool: Archiving rejection for loan {loan_id}")
    try:
        payload = {
            "customer_id": customer_id,
            "loan_id": loan_id,
            "status": "rejected",
            "loan_amount": requested_loan_amount,
            "interest_rate": interest_rate,
            "reason": rejection_reason
        }
        response = await app_http_client.post(
            f"{AGENT_URLS['sanction'].replace('/sanction', '')}/archive/rejection",
            json=payload
        )
        response.raise_for_status()
        result = response.json()
        
        logger.info(f"Rejection archived: {result}")
        return {"status": "archived", "message": result.get('message')}
    except Exception as e:
        logger.error(f"Rejection archival error: {e}")
        return {"status": "failed", "error": str(e)}

tools = [
    tool_get_sales_offer, 
    tool_sales_conversation, 
    tool_verify_kyc, 
    tool_analyze_bank_statement,  # NEW
    tool_run_underwriting, 
    tool_generate_sanction, 
    tool_verify_salary_document, 
    tool_archive_rejection
]

# === SYSTEM PROMPT ===
SYSTEM_PROMPT = """You are a friendly and professional loan sales assistant for CredFlow Finance. Your name is CredFlow Assistant.

CRITICAL RULES - FOLLOW EXACTLY:
1. FIRST - Always call tool_get_sales_offer with customer_id to get their pre_approved_limit 
2. SALES QUERIES - If user asks about:
   - Loan options, product details, interest rates
   - Government schemes, subsidies, or benefits
   - Specific loan purposes (business, Medical,tractor, home, etc.)
   - Comparisons between loan types
   - ANY question about loan products or schemes
   → IMMEDIATELY call tool_sales_conversation with their EXACT message,at first present only the offer he is eligible for based on pre_approved_limit then ask questions on what they want based what he/she intially asked
   → The sales agent has expert knowledge about government schemes and will provide detailed information
   → Present the sales agent's response to the user
   → Dont use special characters like * or - for bullet points instead use simple text formatting
   → DO NOT make up information about schemes or products
   → The goal is to be persevacive on what schemes to recommend & don't bombard them with question at the sametime ask one at a time and keep the msg short like the data in first and the questioning part if the user queries more present him so based on the needs
   - Ask more about what they want like Why they need the loan & Scenario they are in based on that give structered response
   - The response should be sympathetic and more of sales oriented connecting with user's needs and emotions
3. ASK AMOUNT - After answering their questions, ask: "How much would you like to apply for?"
4. CHECK AMOUNT - When user gives amount:
   - IF amount > (2 * pre_approved_limit): REJECT. Call tool_archive_rejection. Do NOT proceed.
   - IF pre_approved_limit < amount <= (2 * pre_approved_limit): ASK monthly_salary
   - IF amount <= pre_approved_limit: Skip salary, continue to step 6
5. CONTINUE SALES CONVERSATION:
   - If user has follow-up questions about schemes, eligibility, or loan details
   - Call tool_sales_conversation again with their question
   - The sales agent maintains conversation context
6. SALARY/DOCUMENT VERIFICATION:
   - If user mentions "salary slip", "bank statement", "upload document", ask for file path
   - For SALARY SLIP: Call tool_verify_salary_document
   - For BANK STATEMENT: Call tool_analyze_bank_statement (provides financial health score)
   - Bank statement analysis gives insights into income stability and spending patterns
7. VERIFY KYC - Call tool_verify_kyc with customer_id
8. UNDERWRITING - Only if kyc_status is "verified":
   - Call tool_run_underwriting with all parameters
   - The underwriting engine uses a RISK-BASED pricing model:
     * Credit score 800+: Gets 0.5% DISCOUNT + 72 months max tenure
     * Credit score 750-799: Standard rate + 60 months max
     * Credit score 700-749: +1.5% rate + 48 months max
     * Credit score 650-699: +3.5% rate + 24 months max
     * Below 650: Automatic rejection
   - Always use: loan_tenure_months=36 initially (will be adjusted by risk engine)
   - CRITICAL: If the requested amount is > 4x monthly_salary, you MUST ask for a bank statement and call tool_analyze_bank_statement to validate financial health before proceeding to underwriting.
   - If user provides a bank statement file path, IMMEDIATELY call tool_analyze_bank_statement.
9. DECISION - Based on underwriting status:
   - IF REJECTED: Explain the reason clearly (credit score, EMI affordability, etc.)
     * Call tool_archive_rejection with rejection reason
   - IF APPROVED: Inform user of their FINAL terms:
     * Show: final_interest_rate (risk-adjusted)
     * Show: final_tenure (risk-adjusted)
     * Show: final_emi
     * Show: risk_category (Excellent/Low/Medium/High Risk)
     * Explain how their credit profile affected the terms
10. SANCTION - Only if approved, ask: "Would you like the sanction letter?"
   - If yes: Call tool_generate_sanction with FINAL (risk-adjusted) rate and tenure
   - Dont metntion the path where the file is stored just say the sanction letter has been generated and will be sent to your registered email address
11. ALWAYS be polite, empathetic, and professional. Guide the user step-by-step.
12. If the application is rejected at any step, provide clear reasons and tell them to contact customer support and phone number 180067664 for further assistance with instructions on to provide bankstatements,kyc slips & salary slips.
IMPORTANT NOTES:
- ALWAYS use tool_sales_conversation for product questions, scheme inquiries, or loan details
-Dont use special characters like * or - for bullet points instead use simple text formatting
- The sales agent has specialized knowledge about government schemes (MUDRA, PMEGP, PMAY, etc.)
- DO NOT try to answer scheme-related questions yourself - use the sales agent tool
- The interest rate and tenure CAN CHANGE based on credit score
- Always present the FINAL terms from underwriting, not the initial offer
- Bank statements provide additional financial health insights (score 0-100)
- Handle natural language amounts: "fifty thousand" = 50000
- Be transparent about how risk-based pricing works

Be polite, guide step-by-step, and ALWAYS use the correct tools for their expertise.

EXAMPLES:
User: "I need 10 Lakhs but my salary is 50k."
Agent: "That is a high amount compared to your income. To proceed, I need to analyze your financial health. Please upload your last 6 months' bank statement."
User: "Here is the file: C:/docs/statement.pdf"
Agent: [Calls tool_analyze_bank_statement(file_path="C:/docs/statement.pdf")]"""

# === STATE DEFINITION ===
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    customer_id: str
    loan_id: int
    pre_approved_limit: int
    interest_rate: float
    requested_amount: int
    monthly_salary: int
    kyc_status: str
    underwriting_status: str
    bank_statement_score: Optional[int]  # NEW
    final_interest_rate: Optional[float]  # NEW - risk-adjusted rate
    final_tenure: Optional[int]  # NEW - risk-adjusted tenure
    final_emi: Optional[int]  # NEW
    risk_category: Optional[str]  # NEW

# === GRAPH NODES ===
async def call_model(state: AgentState):
    """Call the LLM with tools."""
    messages = state.get('messages', [])
    
    if not messages:
        error_msg = AIMessage(content="No messages in state.")
        return {"messages": [error_msg]}
    
    try:
        llm_with_tools = llm.bind_tools(tools)
        
        # Enhanced system context
        system_context = f"""Customer ID: {state.get('customer_id', 'unknown')}
Loan ID: {state.get('loan_id', 'unknown')}
Current State:
- Pre-approved limit: ${state.get('pre_approved_limit', 0)}
- Initial interest rate: {state.get('interest_rate', 0)}%
- Requested amount: ${state.get('requested_amount', 0)}
- Monthly salary: ${state.get('monthly_salary', 0)}
- KYC Status: {state.get('kyc_status', 'not_verified')}
- Underwriting Status: {state.get('underwriting_status', 'pending')}
- Bank Statement Score: {state.get('bank_statement_score', 'N/A')}
- Final Interest Rate: {state.get('final_interest_rate', 'N/A')}%
- Final Tenure: {state.get('final_tenure', 'N/A')} months
- Final EMI: ${state.get('final_emi', 'N/A')}
- Risk Category: {state.get('risk_category', 'N/A')}

CRITICAL INSTRUCTION: 
- When you receive a response from tool_sales_conversation, you MUST present the Necessary message to the user
- At first keep the response concise and to the point if the user asks more questions based on that provide detailed information at the same time dont overwhelm the customer by asking everthing at once.
-Remember to not give to big of a response at once be medium and be more interactive with the user
- Summarize  the sales agent's detailed scheme information if the user asks more based on how many times he asks give more detailed information.
- The sales agent provides comprehensive government scheme details that are valuable to the customer"""
        
        response = await llm_with_tools.ainvoke(messages)
        
        logger.info(f"LLM response: tool_calls={hasattr(response, 'tool_calls') and len(response.tool_calls) > 0}")
        return {"messages": [response]}
        
    except Exception as e:
        logger.error(f"Error calling LLM: {e}", exc_info=True)
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
            error_msg = AIMessage(
                content="__FALLBACK__"
            )
        else:
            error_msg = AIMessage(content=f"Error: {err}")
        return {"messages": [error_msg]}

async def call_tool(state: AgentState):
    """Execute tool calls from the LLM."""
    messages = state.get('messages', [])
    
    if not messages:
        return {"messages": []}
    
    last_message = messages[-1]
    
    if not isinstance(last_message, AIMessage) or not hasattr(last_message, 'tool_calls') or not last_message.tool_calls:
        return {"messages": []}
    
    tool_messages = []
    state_updates = {}
    
    for tool_call in last_message.tool_calls:
        tool_name = tool_call.get("name")
        tool_input = tool_call.get("args", {})
        tool_id = tool_call.get("id")
        
        logger.info(f"Executing tool: {tool_name} with input: {tool_input}")
        
        tool_func = next((t for t in tools if t.name == tool_name), None)
        
        if not tool_func:
            tool_messages.append(ToolMessage(
                content=f"Error: Unknown tool {tool_name}",
                tool_call_id=tool_id
            ))
            continue
        
        try:
            result = await tool_func.ainvoke(tool_input)
            
            logger.info(f"Tool {tool_name} result: {result}")
            
            # Update state based on tool results
            if tool_name == "tool_get_sales_offer":
                state_updates['pre_approved_limit'] = result.get('pre_approved_limit', 0)
                state_updates['interest_rate'] = result.get('interest_rate', 0)
            elif tool_name == "tool_verify_kyc":
                state_updates['kyc_status'] = result.get('kyc_status', 'failed')
            elif tool_name == "tool_analyze_bank_statement":
                state_updates['bank_statement_score'] = result.get('score', 0)
            elif tool_name == "tool_run_underwriting":
                state_updates['underwriting_status'] = result.get('status', 'failed')
                # Capture risk-adjusted terms
                if result.get('status') == 'approved':
                    state_updates['final_interest_rate'] = result.get('final_interest_rate')
                    state_updates['final_tenure'] = result.get('final_tenure')
                    state_updates['final_emi'] = result.get('final_emi')
                    state_updates['risk_category'] = result.get('risk_category')
            
            tool_messages.append(ToolMessage(
                content=json.dumps(result),
                tool_call_id=tool_id
            ))
            
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}", exc_info=True)
            tool_messages.append(ToolMessage(
                content=f"Error executing tool: {str(e)}",
                tool_call_id=tool_id
            ))
    
    return {"messages": tool_messages, **state_updates}

def should_continue(state: AgentState):
    """Route to tools or end based on last message."""
    messages = state.get('messages', [])

    if not messages:
        return END

    last_message = messages[-1]

    if isinstance(last_message, AIMessage) and hasattr(last_message, 'tool_calls') and last_message.tool_calls:
        logger.info(f"Routing to tools: {len(last_message.tool_calls)} tool calls found")
        return "tools"

    logger.info("No tool calls detected, routing to END")
    return END

async def get_fallback_reply(customer_id: str, message: str, language: str = "en") -> str:
    """Use sales agent directly when Gemini/LangGraph is unavailable."""
    try:
        offer = await tool_get_sales_offer.ainvoke({"customer_id": customer_id})
        limit = offer.get("pre_approved_limit", 0)
        rate = offer.get("interest_rate", 8.5)

        lang_prefix = "[केवल हिंदी (देवनागरी) में उत्तर दें]" if language == "hi" else "[Reply in English only]"
        sales = await tool_sales_conversation.ainvoke(
            {"customer_id": customer_id, "user_message": f"{lang_prefix} {message}"}
        )
        sales_msg = (sales.get("message") or "").strip()
        bad_fragments = (
            "Found offer for",
            "Sorry, I encountered an error",
            "Sorry, I had trouble",
            "No response generated",
            "__FALLBACK__",
        )
        if sales_msg and sales.get("status") != "failed":
            if not any(fragment in sales_msg for fragment in bad_fragments):
                return sales_msg

        return build_static_reply(message, limit, rate, language)
    except Exception as e:
        logger.error(f"Fallback reply failed: {e}")
        return build_static_reply(message, 0, 8.5, language)


def build_static_reply(message: str, limit: int, rate: float, language: str = "en") -> str:
    """Rule-based reply when AI APIs are unavailable."""
    q = message.lower()
    hi = language == "hi"

    if any(w in q for w in ("document", "paper", "kyc", "require", "दस्तावेज", "दस्तावेज़")):
        if hi:
            return (
                "गृह / व्यक्तिगत ऋण के लिए सामान्यतः ये दस्तावेज़ चाहिए:\n"
                "1. पैन कार्ड\n2. आधार कार्ड\n3. वेतन पर्ची (3 महीने)\n"
                "4. बैंक विवरण (6 महीने)\n5. पता प्रमाण\n\n"
                "सटीक सूची ऋण प्रकार पर निर्भर करती है।"
            )
        return (
            "For Home / Personal Loan you generally need:\n"
            "1. PAN Card\n2. Aadhaar Card\n3. Salary slips (last 3 months)\n"
            "4. Bank statement (6 months)\n5. Address proof\n\n"
            "The exact list depends on your loan type."
        )

    if any(w in q for w in ("emi", "calculate", "monthly", "गणना")):
        if hi:
            return (
                "EMI सूत्र: EMI = P × r × (1+r)^n / ((1+r)^n − 1)\n"
                "P = ऋण राशि, r = मासिक ब्याज दर, n = महीनों की संख्या।\n"
                "सटीक EMI के लिए EMI कैलकुलेटर का उपयोग करें।"
            )
        return (
            "EMI formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1)\n"
            "P = loan amount, r = monthly interest rate, n = tenure in months.\n"
            "Use the EMI Calculator page for exact amounts."
        )

    if any(w in q for w in ("eligibility", "eligible", "qualify", "check", "पात्र")):
        if limit > 0:
            if hi:
                return (
                    f"आप पात्र हैं! पूर्व-अनुमोदित सीमा: ₹{limit:,} @ {rate}%।\n"
                    "अंतिम अनुमोदन KYC और वेतन सत्यापन के बाद होता है।"
                )
            return (
                f"You are eligible! Pre-approved limit: ₹{limit:,} @ {rate}% interest.\n"
                "Final approval happens after KYC and salary verification."
            )
        if hi:
            return "पात्रता आय और क्रेडिट स्कोर पर निर्भर करती है। अपना प्रस्ताव देखने के लिए लॉगिन करें।"
        return "Eligibility depends on income and credit score. Login to check your pre-approved offer."

    if limit > 0:
        if hi:
            return (
                f"आपके लिए पूर्व-अनुमोदित सीमा ₹{limit:,} है @ {rate}%।\n"
                "व्यक्तिगत, गृह, व्यवसाय और शिक्षा ऋण उपलब्ध हैं।"
            )
        return (
            f"Your pre-approved limit is ₹{limit:,} @ {rate}% interest.\n"
            "Personal, Home, Business and Education loans are available."
        )

    if hi:
        return "एआई अभी व्यस्त है। 30–60 सेकंड बाद पुनः प्रयास करें। सहायता: 180067664"
    return "AI is busy right now. Please try again in 30–60 seconds. Support: 180067664"

def save_chat_message_to_mongo(customer_id: str, loan_id: int, sender: str, message_text: str):
    """Save chat message to MongoDB"""
    if not mongo_client:
        return
    
    try:
        db = mongo_client[MONGO_DB_NAME]
        collection = db["chat_messages"]
        
        doc = {
            "customer_id": customer_id,
            "loan_id": loan_id,
            "sender": sender,
            "message_text": message_text,
            "timestamp": datetime.datetime.utcnow()
        }
        collection.insert_one(doc)
    except Exception as e:
        logger.error(f"Error saving chat message: {e}")


# === HTTP CLIENT & GRAPH LIFECYCLE ===
@asynccontextmanager
async def lifespan(app: FastAPI):
    global app_http_client, app_graph, memory_saver, mongo_client
    
    app_http_client = httpx.AsyncClient(timeout=90.0)
    memory_saver = MemorySaver()
    
    # Setup MongoDB (short timeout — optional on Render)
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        mongo_client.admin.command("ping")
        logger.info("Connected to MongoDB")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        mongo_client = None
    
    # Setup LangGraph workflow
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", call_tool)
    
    workflow.set_entry_point("agent")
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            END: END,
        },
    )
    workflow.add_edge("tools", "agent")
    
    app_graph = workflow.compile(checkpointer=memory_saver)
    logger.info("LangGraph workflow compiled successfully")
    
    yield
    
    await app_http_client.aclose()
    if mongo_client:
        mongo_client.close()

# === FASTAPI APP ===
app = FastAPI(title="Loan Chatbot - LangGraph", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "LangGraph Loan Chatbot is running"}

@app.get("/reset/{customer_id}")
async def reset_conversation(customer_id: str):
    """Reset conversation state for a customer."""
    global memory_saver
    try:
        if memory_saver and hasattr(memory_saver, '_storage'):
            memory_saver._storage.pop(customer_id, None)
            logger.info(f"Reset conversation for {customer_id}")
            return {"message": f"Conversation reset for {customer_id}"}
        return {"message": "Reset failed"}
    except Exception as e:
        logger.error(f"Error resetting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(request: ChatRequest):
    """Chat endpoint with LangGraph."""
    
    global app_graph
    customer_id = request.customer_id
    message = request.message
    language = request.language if request.language in LANGUAGE_INSTRUCTIONS else "en"
    
    config = {"configurable": {"thread_id": customer_id}}
    lock = user_locks[customer_id]
    
    # Rate limiting
    now = time.time()
    request_times[customer_id] = [t for t in request_times[customer_id] if now - t < 60]
    
    if len(request_times[customer_id]) >= MAX_REQUESTS_PER_MINUTE:
        wait_time = 60 - (now - request_times[customer_id][0])
        return {
            "reply": f"Rate limit reached. Please wait {int(wait_time)} seconds."
        }
    
    request_times[customer_id].append(now)
    
    async with lock:
        try:
            # Check if first message
            try:
                current_state = await app_graph.aget_state(config)
                is_first = not (current_state and current_state.values and current_state.values.get('messages'))
            except:
                is_first = True
            
            # Define loan_id early so it's available for save_chat_message_to_mongo
            try:
                loan_id = int(customer_id)
            except ValueError:
                loan_id = abs(hash(customer_id)) % 1000000
            
            if is_first:
                user_content = (
                    f"{SYSTEM_PROMPT}\n\n{LANGUAGE_INSTRUCTIONS[language]}\n\n"
                    f"Customer ID: {customer_id}\n\nUser: {message}"
                )
            else:
                if language == "hi":
                    user_content = f"[केवल हिंदी (देवनागरी) में उत्तर दें — Roman/Hinglish नहीं]\n{message}"
                else:
                    user_content = f"[Respond in English only]\n{message}"
            
            user_message = HumanMessage(content=user_content)
            save_chat_message_to_mongo(customer_id, loan_id, "user", message)

            if USE_FAST_CHAT or not GOOGLE_API_KEY:
                ai_reply = await get_fallback_reply(customer_id, message, language)
                save_chat_message_to_mongo(customer_id, loan_id, "bot", ai_reply)
                return {"reply": ai_reply}

            input_state = {"messages": [user_message]}
            if is_first:
                
                input_state.update({
                    "customer_id": customer_id,
                    "loan_id": loan_id,
                    "pre_approved_limit": 0,
                    "interest_rate": 0.0,
                    "requested_amount": 0,
                    "monthly_salary": 0,
                    "kyc_status": "not_verified",
                    "underwriting_status": "pending",
                    "bank_statement_score": None,
                    "final_interest_rate": None,
                    "final_tenure": None,
                    "final_emi": None,
                    "risk_category": None
                })
            
            try:
                final_state = await asyncio.wait_for(
                    app_graph.ainvoke(
                        input_state, config={**config, "recursion_limit": 12}
                    ),
                    timeout=CHAT_LLM_TIMEOUT,
                )
            except asyncio.TimeoutError:
                logger.warning(f"Chat graph timed out for {customer_id}, using fallback")
                ai_reply = await get_fallback_reply(customer_id, message, language)
                save_chat_message_to_mongo(customer_id, loan_id, "bot", ai_reply)
                return {"reply": ai_reply}

            if final_state and final_state.get('messages'):
                last_msg = final_state['messages'][-1]
                content = last_msg.content if hasattr(last_msg, 'content') else str(last_msg)

                ai_reply = ""
                if isinstance(content, str):
                    ai_reply = content
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict):
                            if 'text' in block:
                                ai_reply += block['text']
                        elif isinstance(block, str):
                            ai_reply += block
                elif isinstance(content, dict):
                    if 'text' in content:
                        ai_reply = content['text']
                else:
                    ai_reply = str(content)

                needs_fallback = (
                    not ai_reply.strip()
                    or ai_reply.strip() == "__FALLBACK__"
                    or ai_reply.startswith("Error:")
                    or "429" in ai_reply
                    or "RESOURCE_EXHAUSTED" in ai_reply
                    or "Sorry, I encountered an error" in ai_reply
                    or ai_reply.startswith("Found offer for")
                )
                if needs_fallback:
                    logger.warning(f"Using sales-agent fallback for {customer_id}")
                    ai_reply = await get_fallback_reply(customer_id, message, language)

                save_chat_message_to_mongo(customer_id, loan_id, "bot", ai_reply)
                logger.info(f"Response to {customer_id}: {ai_reply[:100]}...")
                return {"reply": ai_reply}

            fallback = await get_fallback_reply(customer_id, message, language)
            save_chat_message_to_mongo(customer_id, loan_id, "bot", fallback)
            return {"reply": fallback}

        except Exception as e:
            logger.error(f"Chat error for {customer_id}: {e}", exc_info=True)
            fallback = await get_fallback_reply(customer_id, message, language)
            save_chat_message_to_mongo(customer_id, loan_id, "bot", fallback)
            return {"reply": fallback}

# === ADMIN & AUTH API ENDPOINTS ===

def get_pg_connection():
    try:
        conn = psycopg2.connect(**PG_DB_CONFIG)
        return conn
    except Exception as e:
        logger.error(f"Postgres connection error: {e}")
        return None

@app.post("/login")
async def login_user(creds: LoginRequest):
    """Customer login — same DB as CRM, routed via master agent for reliable deploy."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection error")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT cust_id, name, credit_score FROM customers WHERE cust_id = %s AND password = %s",
            (creds.custId, creds.password),
        )
        user = cursor.fetchone()
        if user:
            return {
                "status": "success",
                "name": user["name"],
                "custId": user["cust_id"],
                "credit_score": user["credit_score"],
            }
        raise HTTPException(status_code=401, detail="Invalid credentials")
    finally:
        conn.close()


@app.post("/forgot/customer-id/email")
async def forgot_customer_id_email(body: ForgotCustomerIdEmailRequest):
    """Email registered Customer ID to the user's inbox."""
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")

    if not is_smtp_configured():
        raise HTTPException(status_code=503, detail=smtp_config_hint())

    rate_key = f"cid-email:{email}"
    if _forgot_locked(rate_key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT cust_id, name, email FROM customers WHERE LOWER(email) = %s",
            (email,),
        )
        row = cursor.fetchone()
        if row and row.get("email"):
            sent = await send_customer_id_email(row["email"], row["cust_id"], row["name"])
            if not sent:
                raise HTTPException(
                    status_code=503,
                    detail="Could not send email. Verify SMTP_PASSWORD (Gmail App Password) in backend/.env.",
                )
            _clear_forgot_failures(rate_key)
        else:
            _record_forgot_failure(rate_key)

        return {
            "success": True,
            "message": "If an account with this email exists, your Customer ID has been sent.",
        }
    finally:
        conn.close()


@app.post("/forgot/customer-id/phone")
async def forgot_customer_id_phone(body: ForgotCustomerIdPhoneRequest):
    """Recover Customer ID using registered phone + Aadhaar last 4 digits."""
    phone = _normalize_phone(body.phone)
    last4 = body.aadhaarLast4.strip()
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Valid phone number is required")
    if len(last4) != 4 or not last4.isdigit():
        raise HTTPException(status_code=400, detail="Enter last 4 digits of Aadhaar")

    rate_key = f"cid-phone:{phone}"
    if _forgot_locked(rate_key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT cust_id, name, phone, aadhaar FROM customers WHERE phone LIKE %s",
            (f"%{phone[-10:]}",),
        )
        matches = [
            r for r in cursor.fetchall()
            if _normalize_phone(r.get("phone") or "") == phone
            and _aadhaar_last4(r.get("aadhaar")) == last4
        ]
        if not matches:
            _record_forgot_failure(rate_key)
            raise HTTPException(status_code=401, detail="Phone or Aadhaar details do not match our records")

        _clear_forgot_failures(rate_key)
        row = matches[0]
        return {
            "success": True,
            "custId": row["cust_id"],
            "name": row["name"],
            "message": "Customer ID verified. Use it to log in.",
        }
    finally:
        conn.close()


@app.post("/forgot/password/request")
async def forgot_password_request(body: ForgotPasswordRequestRequest):
    """Send password reset OTP to registered email."""
    cust_id = body.custId.strip()
    email = body.email.strip().lower()
    if not cust_id or not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Customer ID and valid email are required")

    rate_key = f"pwd-req:{cust_id}:{email}"
    if _forgot_locked(rate_key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT cust_id, name, email FROM customers WHERE cust_id = %s AND LOWER(email) = %s",
            (cust_id, email),
        )
        row = cursor.fetchone()
        if not row or not row.get("email"):
            _record_forgot_failure(rate_key)
            raise HTTPException(status_code=401, detail="Customer ID and email do not match our records")

        session_id, otp = _create_customer_otp_session(row["cust_id"], row["email"])
        sent = await send_customer_password_reset_otp(row["email"], otp, row["name"])
        if not sent:
            _customer_otp_sessions.pop(session_id, None)
            raise HTTPException(status_code=503, detail="Could not send reset email. Check SMTP settings.")

        _clear_forgot_failures(rate_key)
        masked = row["email"][:3] + "***@" + row["email"].split("@")[-1]
        return {
            "success": True,
            "otpSessionId": session_id,
            "message": f"Verification code sent to {masked}",
        }
    finally:
        conn.close()


@app.post("/forgot/password/reset")
async def forgot_password_reset(body: ForgotPasswordResetRequest):
    """Complete password reset after email OTP verification."""
    cust_id = body.custId.strip()
    email = body.email.strip().lower()
    new_password = body.newPassword
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    rate_key = f"pwd-reset:{cust_id}"
    if _forgot_locked(rate_key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    if not _consume_customer_otp_session(body.otpSessionId.strip(), cust_id, email, body.otp.strip()):
        _record_forgot_failure(rate_key)
        raise HTTPException(status_code=401, detail="Invalid or expired verification code")

    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE customers SET password = %s WHERE cust_id = %s AND LOWER(email) = %s",
            (new_password, cust_id, email),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        conn.commit()
        _clear_forgot_failures(rate_key)
        return {"success": True, "message": "Password updated. You can log in now."}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Password reset failed: {e}")
        raise HTTPException(status_code=500, detail="Could not reset password")
    finally:
        conn.close()


@app.post("/forgot/password/phone")
async def forgot_password_phone(body: ForgotPasswordPhoneRequest):
    """Reset password using phone + Aadhaar verification (no email on file)."""
    cust_id = body.custId.strip()
    phone = _normalize_phone(body.phone)
    last4 = body.aadhaarLast4.strip()
    new_password = body.newPassword
    if not cust_id:
        raise HTTPException(status_code=400, detail="Customer ID is required")
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Valid phone number is required")
    if len(last4) != 4 or not last4.isdigit():
        raise HTTPException(status_code=400, detail="Enter last 4 digits of Aadhaar")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    rate_key = f"pwd-phone:{cust_id}"
    if _forgot_locked(rate_key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT cust_id, phone, aadhaar FROM customers WHERE cust_id = %s",
            (cust_id,),
        )
        row = cursor.fetchone()
        if (
            not row
            or _normalize_phone(row.get("phone") or "") != phone
            or _aadhaar_last4(row.get("aadhaar")) != last4
        ):
            _record_forgot_failure(rate_key)
            raise HTTPException(status_code=401, detail="Details do not match our records")

        cursor.execute(
            "UPDATE customers SET password = %s WHERE cust_id = %s",
            (new_password, cust_id),
        )
        conn.commit()
        _clear_forgot_failures(rate_key)
        return {"success": True, "message": "Password updated. You can log in now."}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Phone password reset failed: {e}")
        raise HTTPException(status_code=500, detail="Could not reset password")
    finally:
        conn.close()


@app.post("/admin/login")
async def admin_login(creds: AdminLoginRequest):
    """Bank officer login. Super admin must complete email OTP verification."""
    banker_id = creds.bankerId.strip()
    if not is_valid_banker_id(banker_id):
        raise HTTPException(status_code=400, detail="Invalid banker ID format")

    if _admin_login_locked(banker_id):
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Try again in 15 minutes.",
        )

    profile, detail = _authenticate_banker(banker_id, creds.password)
    if not profile:
        _record_admin_login_failure(banker_id)
        if detail:
            raise HTTPException(status_code=403, detail=detail)
        raise HTTPException(status_code=401, detail="Invalid banker credentials")

    if profile.get("isPlatformAdmin"):
        if not PLATFORM_ADMIN_EMAIL or PLATFORM_ADMIN_EMAIL in ("your_email@gmail.com", ""):
            raise HTTPException(
                status_code=503,
                detail="Super admin email not configured. Set PLATFORM_ADMIN_EMAIL in backend/.env",
            )
        session_id, otp = _create_otp_session(profile)
        sent = await send_admin_otp_email(PLATFORM_ADMIN_EMAIL, otp, profile["name"])
        if not sent:
            _admin_otp_sessions.pop(session_id, None)
            raise HTTPException(status_code=503, detail="Could not send OTP email. Check SMTP settings.")
        return {
            "status": "otp_required",
            "requiresOtp": True,
            "otpSessionId": session_id,
            "message": f"Verification code sent to {PLATFORM_ADMIN_EMAIL[:3]}***",
        }

    _clear_admin_login_failures(banker_id)
    token = create_admin_token(profile["bankerId"], profile["bankId"])
    return {"status": "success", "token": token, **profile}


@app.post("/admin/login/verify-otp")
async def admin_login_verify_otp(body: AdminOtpVerifyRequest):
    """Complete super admin login after email OTP verification."""
    banker_id = body.bankerId.strip()
    if not is_valid_banker_id(banker_id):
        raise HTTPException(status_code=400, detail="Invalid banker ID format")

    if _admin_login_locked(banker_id):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")

    profile = _consume_otp_session(body.otpSessionId.strip(), banker_id, body.otp.strip())
    if not profile or not profile.get("isPlatformAdmin"):
        _record_admin_login_failure(banker_id)
        raise HTTPException(status_code=401, detail="Invalid or expired verification code")

    _clear_admin_login_failures(banker_id)
    token = create_admin_token(profile["bankerId"], profile["bankId"])
    return {"status": "success", "token": token, **profile}

@app.get("/admin/customers")
async def get_all_customers(_admin: dict = Depends(require_admin)):
    """Fetch all customers with their latest loan status."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        # Fetch customers and join with latest loan status if available
        query = """
            SELECT 
                c.cust_id, c.name, c.age, c.gender, c.phone, c.address, 
                c.credit_score, c.pre_approved_limit, c.interest_options, 
                c.category, c.aadhaar,
                l.status as loan_status, l.approved_amount as loan_amount
            FROM customers c
            LEFT JOIN (
                SELECT DISTINCT ON (cust_id) cust_id, status, approved_amount 
                FROM loans 
                ORDER BY cust_id, created_at DESC
            ) l ON c.cust_id = l.cust_id
        """
        cursor.execute(query)
        customers = cursor.fetchall()
        return customers
    except Exception as e:
        logger.error(f"Error fetching customers: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/admin/customer/{cust_id}")
async def get_customer_detail(cust_id: str, _admin: dict = Depends(require_admin)):
    """Fetch single customer details (admin)."""
    return _fetch_customer_with_loans(cust_id)


@app.get("/customer/{cust_id}")
async def get_customer_portal_detail(cust_id: str):
    """Fetch customer profile + loans for the customer dashboard."""
    return _fetch_customer_with_loans(cust_id)


def _fetch_customer_with_loans(cust_id: str):
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM customers WHERE cust_id = %s", (cust_id,))
        customer = cursor.fetchone()

        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        cursor.execute(
            """
            SELECT *
            FROM loans WHERE cust_id = %s ORDER BY created_at DESC NULLS LAST, loan_id DESC
            """,
            (cust_id,),
        )
        loans = cursor.fetchall()
        customer["loans"] = loans
        return customer
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching customer detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/admin/chat/{cust_id}")
async def get_chat_history(cust_id: str, _admin: dict = Depends(require_admin)):
    """Fetch chat history from MongoDB."""
    if not mongo_client:
        raise HTTPException(status_code=500, detail="MongoDB not connected")
    
    try:
        db = mongo_client[MONGO_DB_NAME]
        collection = db["chat_messages"]
        
        # Determine loan_id (using the simple hashing logic from chat endpoint for consistency if needed, 
        # but ideally we should query by cust_id directly if possible. 
        # The save function uses cust_id, so we can query by it.)
        
        chats = list(collection.find({"customer_id": cust_id}).sort("timestamp", 1))
        
        # Convert ObjectId and datetime to string
        formatted_chats = []
        for chat in chats:
            formatted_chats.append({
                "id": str(chat.get("_id")),
                "cust_id": chat.get("customer_id"),
                "sender": chat.get("sender"),
                "message": chat.get("message_text"),
                "timestamp": chat.get("timestamp").isoformat() if chat.get("timestamp") else None
            })
            
        return formatted_chats
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/loans/{loan_id}/decision")
async def decide_loan(
    loan_id: int,
    body: LoanDecisionRequest,
    admin: dict = Depends(require_admin),
):
    """Bank officer approves or rejects a pending loan application."""
    if admin.get("isPlatformAdmin"):
        raise HTTPException(
            status_code=403,
            detail="Platform admin cannot approve loans — use a bank officer account",
        )
    action = body.action.strip().lower()
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM loans WHERE loan_id = %s", (loan_id,))
        loan = cursor.fetchone()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        current_status = (loan.get("status") or "").lower()
        if current_status in ("approved", "rejected"):
            raise HTTPException(
                status_code=400,
                detail=f"Loan already {loan.get('status')}",
            )

        new_status = "Approved" if action == "approve" else "Rejected"
        approved_amount = loan.get("requested_amount") or 0 if action == "approve" else 0
        note = body.note.strip() or (
            f"Approved by {admin['name']} ({admin['bankName']})"
            if action == "approve"
            else f"Rejected by {admin['name']} ({admin['bankName']})"
        )

        cursor.execute(
            """
            UPDATE loans
            SET status = %s,
                approved_amount = %s,
                bank_id = %s,
                reviewed_by_banker_id = %s,
                review_note = %s,
                reason = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE loan_id = %s
            RETURNING loan_id, cust_id, status, approved_amount, bank_id, reviewed_by_banker_id
            """,
            (
                new_status,
                approved_amount,
                admin["bankId"],
                admin["bankerId"],
                note,
                note,
                loan_id,
            ),
        )
        updated = cursor.fetchone()

        cursor.execute("SELECT name FROM customers WHERE cust_id = %s", (loan.get("cust_id"),))
        cust_row = cursor.fetchone()
        customer_name = (cust_row or {}).get("name") or loan.get("cust_id")

        _log_loan_audit(
            cursor,
            loan_id=loan_id,
            cust_id=loan.get("cust_id"),
            customer_name=customer_name,
            action=action,
            admin=admin,
            requested_amount=loan.get("requested_amount"),
            approved_amount=approved_amount,
            note=note,
        )
        conn.commit()
        return {
            "status": "success",
            "loan": updated,
            "bankName": admin["bankName"],
            "bankerName": admin["name"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Loan decision failed: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/admin/monitor/overview")
async def monitor_overview(_admin: dict = Depends(require_platform_admin)):
    """Platform admin — stats across all banks and recent activity."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT bk.bank_id, bk.bank_name, bk.bank_code,
                   COUNT(DISTINCT b.banker_id) AS officer_count,
                   COUNT(DISTINCT CASE WHEN b.is_active THEN b.banker_id END) AS active_officers
            FROM banks bk
            LEFT JOIN bankers b ON b.bank_id = bk.bank_id AND b.bank_id != 'BANK_CREDFLOW'
            WHERE bk.bank_id != 'BANK_CREDFLOW'
            GROUP BY bk.bank_id, bk.bank_name, bk.bank_code
            ORDER BY bk.bank_name
        """)
        banks = cursor.fetchall()

        cursor.execute("""
            SELECT bank_name,
                   COUNT(*) FILTER (WHERE action = 'approve') AS approvals,
                   COUNT(*) FILTER (WHERE action = 'reject') AS rejections
            FROM loan_audit_log
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY bank_name
            ORDER BY bank_name
        """)
        activity_by_bank = cursor.fetchall()

        cursor.execute("""
            SELECT audit_id, loan_id, cust_id, customer_name, action,
                   banker_id, banker_name, bank_name, requested_amount,
                   approved_amount, note, created_at
            FROM loan_audit_log
            ORDER BY created_at DESC
            LIMIT 20
        """)
        recent_audit = cursor.fetchall()

        cursor.execute("SELECT COUNT(*) AS total FROM loan_audit_log")
        total_actions = cursor.fetchone()["total"]

        return {
            "banks": banks,
            "activityByBank": activity_by_bank,
            "recentAudit": recent_audit,
            "totalAuditEvents": total_actions,
        }
    except Exception as e:
        logger.error(f"Monitor overview failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/admin/monitor/audit")
async def monitor_audit(
    limit: int = 50,
    _admin: dict = Depends(require_platform_admin),
):
    """Full audit trail of bank officer loan decisions."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            SELECT audit_id, loan_id, cust_id, customer_name, action,
                   banker_id, banker_name, bank_id, bank_name,
                   requested_amount, approved_amount, note, created_at
            FROM loan_audit_log
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (min(limit, 200),),
        )
        return cursor.fetchall()
    except Exception as e:
        logger.error(f"Monitor audit failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/admin/monitor/bankers")
async def monitor_bankers(_admin: dict = Depends(require_platform_admin)):
    """List all bank officers — platform admin can review and disable."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT b.banker_id, b.name, b.role, b.is_active, b.approval_status,
                   b.email, b.created_at, b.approved_at,
                   bk.bank_id, bk.bank_name, bk.bank_code,
                   COUNT(a.audit_id) AS total_decisions,
                   COUNT(a.audit_id) FILTER (
                       WHERE a.created_at >= NOW() - INTERVAL '7 days'
                   ) AS decisions_last_7_days
            FROM bankers b
            JOIN banks bk ON bk.bank_id = b.bank_id
            LEFT JOIN loan_audit_log a ON a.banker_id = b.banker_id
            WHERE b.bank_id != 'BANK_CREDFLOW'
            GROUP BY b.banker_id, b.name, b.role, b.is_active, b.approval_status,
                     b.email, b.created_at, b.approved_at,
                     bk.bank_id, bk.bank_name, bk.bank_code
            ORDER BY
                CASE b.approval_status WHEN 'pending' THEN 0 ELSE 1 END,
                bk.bank_name, b.name
        """)
        return cursor.fetchall()
    except Exception as e:
        logger.error(f"Monitor bankers failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.patch("/admin/monitor/bankers/{banker_id}")
async def update_banker_status(
    banker_id: str,
    body: BankerStatusRequest,
    admin: dict = Depends(require_platform_admin),
):
    """Enable or disable a bank officer (fraud prevention)."""
    if banker_id == admin["bankerId"]:
        raise HTTPException(status_code=400, detail="Cannot change your own account")
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT banker_id, bank_id, name FROM bankers WHERE banker_id = %s",
            (banker_id,),
        )
        banker = cursor.fetchone()
        if not banker:
            raise HTTPException(status_code=404, detail="Banker not found")
        if banker["bank_id"] == "BANK_CREDFLOW":
            raise HTTPException(status_code=400, detail="Cannot modify platform admin")

        cursor.execute(
            "UPDATE bankers SET is_active = %s WHERE banker_id = %s RETURNING banker_id, is_active",
            (body.is_active, banker_id),
        )
        updated = cursor.fetchone()
        conn.commit()
        return {
            "status": "success",
            "bankerId": updated["banker_id"],
            "isActive": updated["is_active"],
            "message": "Bank officer enabled" if body.is_active else "Bank officer disabled",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update banker status failed: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post("/admin/monitor/bankers")
async def create_banker_request(
    body: CreateBankerRequest,
    admin: dict = Depends(require_platform_admin),
):
    """Register a new bank officer — pending until super admin approves. Only one super admin exists."""
    if body.bankId == "BANK_CREDFLOW":
        raise HTTPException(status_code=400, detail="Cannot create another super admin account")

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    email = (body.email or "").strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid officer email is required")

    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT bank_id, bank_name FROM banks WHERE bank_id = %s AND is_active = TRUE",
            (body.bankId,),
        )
        bank = cursor.fetchone()
        if not bank:
            raise HTTPException(status_code=400, detail="Invalid bank")

        banker_id = generate_banker_id()
        placeholder_hash = _hash_banker_password(generate_password(24))
        cursor.execute(
            """
            INSERT INTO bankers (banker_id, bank_id, name, password_hash, role, email,
                                 approval_status, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, 'pending', FALSE)
            RETURNING banker_id, name, role, approval_status, created_at
            """,
            (
                banker_id,
                body.bankId,
                name,
                placeholder_hash,
                body.role.strip() or "Loan Officer",
                email,
            ),
        )
        created = cursor.fetchone()
        conn.commit()
        return {
            "status": "success",
            "message": "Bank officer registered — approve to email login credentials",
            "banker": {
                **created,
                "bankId": body.bankId,
                "bankName": bank["bank_name"],
                "email": email,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create banker request failed: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post("/admin/monitor/bankers/{banker_id}/approve")
async def approve_banker(
    banker_id: str,
    admin: dict = Depends(require_platform_admin),
):
    """Approve pending bank officer and issue one-time login credentials."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            SELECT b.*, bk.bank_name FROM bankers b
            JOIN banks bk ON bk.bank_id = b.bank_id
            WHERE b.banker_id = %s
            """,
            (banker_id,),
        )
        banker = cursor.fetchone()
        if not banker:
            raise HTTPException(status_code=404, detail="Banker not found")
        if banker["bank_id"] == "BANK_CREDFLOW":
            raise HTTPException(status_code=400, detail="Cannot approve super admin this way")
        if banker.get("approval_status") == "approved":
            raise HTTPException(status_code=400, detail="Bank officer already approved")
        if banker.get("approval_status") == "rejected":
            raise HTTPException(status_code=400, detail="Bank officer was rejected — create a new request")

        password = generate_password()
        cursor.execute(
            """
            UPDATE bankers
            SET password_hash = %s,
                approval_status = 'approved',
                is_active = TRUE,
                approved_by = %s,
                approved_at = CURRENT_TIMESTAMP
            WHERE banker_id = %s
            RETURNING banker_id, name, role, bank_id, approval_status
            """,
            (_hash_banker_password(password), admin["bankerId"], banker_id),
        )
        updated = cursor.fetchone()
        conn.commit()

        officer_email = (banker.get("email") or "").strip()
        email_sent = False
        if officer_email:
            email_sent = await send_banker_credentials_email(
                officer_email,
                updated["name"],
                updated["banker_id"],
                password,
                banker["bank_name"],
                updated["role"],
            )

        if email_sent:
            message = f"Bank officer approved — credentials emailed to {officer_email}"
        elif officer_email:
            message = "Bank officer approved — email delivery failed; copy credentials below"
        else:
            message = "Bank officer approved — no email on file; share credentials manually"

        return {
            "status": "success",
            "message": message,
            "bankerId": updated["banker_id"],
            "password": password if not email_sent else None,
            "name": updated["name"],
            "role": updated["role"],
            "bankName": banker["bank_name"],
            "emailSent": email_sent,
            "emailTo": officer_email if officer_email else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Approve banker failed: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.post("/admin/monitor/bankers/{banker_id}/reject")
async def reject_banker(
    banker_id: str,
    admin: dict = Depends(require_platform_admin),
):
    """Reject a pending bank officer registration."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT banker_id, bank_id, approval_status FROM bankers WHERE banker_id = %s",
            (banker_id,),
        )
        banker = cursor.fetchone()
        if not banker:
            raise HTTPException(status_code=404, detail="Banker not found")
        if banker["bank_id"] == "BANK_CREDFLOW":
            raise HTTPException(status_code=400, detail="Cannot reject super admin")
        if banker.get("approval_status") != "pending":
            raise HTTPException(status_code=400, detail="Only pending officers can be rejected")

        cursor.execute(
            """
            UPDATE bankers
            SET approval_status = 'rejected', is_active = FALSE, approved_by = %s,
                approved_at = CURRENT_TIMESTAMP
            WHERE banker_id = %s
            RETURNING banker_id, approval_status
            """,
            (admin["bankerId"], banker_id),
        )
        updated = cursor.fetchone()
        conn.commit()
        return {
            "status": "success",
            "bankerId": updated["banker_id"],
            "approvalStatus": updated["approval_status"],
            "message": "Bank officer registration rejected",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reject banker failed: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    age: int | None = None
    gender: str | None = None
    current_password: str | None = None
    new_password: str | None = None

@app.put("/customer/{cust_id}/profile")
async def update_customer_profile(cust_id: str, request: ProfileUpdateRequest):
    """Update customer profile fields from dashboard settings."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM customers WHERE cust_id = %s", (cust_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Customer not found")

        if request.new_password:
            if not request.current_password:
                raise HTTPException(status_code=400, detail="Current password is required to set a new password")
            if existing.get("password") != request.current_password:
                raise HTTPException(status_code=400, detail="Current password is incorrect")

        if request.email and request.email != existing.get("email"):
            cursor.execute(
                "SELECT cust_id FROM customers WHERE email = %s AND cust_id != %s",
                (request.email, cust_id),
            )
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Email already in use")

        if request.phone and request.phone != existing.get("phone"):
            cursor.execute(
                "SELECT cust_id FROM customers WHERE phone = %s AND cust_id != %s",
                (request.phone, cust_id),
            )
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Phone number already in use")

        updates = []
        values = []

        field_map = {
            "name": request.name,
            "email": request.email,
            "phone": request.phone,
            "address": request.address,
            "age": request.age,
            "gender": request.gender,
        }
        for column, value in field_map.items():
            if value is not None:
                updates.append(f"{column} = %s")
                values.append(value)

        if request.new_password:
            updates.append("password = %s")
            values.append(request.new_password)

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(cust_id)
        cursor.execute(
            f"UPDATE customers SET {', '.join(updates)} WHERE cust_id = %s RETURNING cust_id, name, email, phone, address, age, gender, credit_score, aadhaar",
            values,
        )
        updated = cursor.fetchone()
        conn.commit()
        return {"success": True, "customer": updated}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile for {cust_id}: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

def _resolve_sanction_file(stored_path: str):
    """Locate sanction PDF on disk from DB path."""
    from pathlib import Path

    if not stored_path:
        return None

    backend_root = Path(_backend_root)
    raw = Path(stored_path)
    candidates = [
        raw if raw.is_absolute() else None,
        backend_root / stored_path,
        backend_root / "sanction_letters" / raw.name,
        backend_root / raw.name,
    ]
    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate
    return None

@app.get("/customer/{cust_id}/loans/{loan_id}/sanction-letter")
async def download_sanction_letter(cust_id: str, loan_id: int):
    """Download sanction letter PDF for an approved loan."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT sanction_letter_path, status FROM loans WHERE loan_id = %s AND cust_id = %s",
            (loan_id, cust_id),
        )
        loan = cursor.fetchone()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        if not loan.get("sanction_letter_path"):
            raise HTTPException(status_code=404, detail="Sanction letter not available yet")

        file_path = _resolve_sanction_file(loan["sanction_letter_path"])
        if not file_path:
            raise HTTPException(status_code=404, detail="Sanction letter file not found on server")

        return FileResponse(
            path=str(file_path),
            media_type="application/pdf",
            filename=f"sanction_letter_{cust_id}_{loan_id}.pdf",
        )
    finally:
        conn.close()

@app.get("/customer/{cust_id}/loans/{loan_id}/statement")
async def download_loan_statement(cust_id: str, loan_id: int):
    """Generate a simple loan statement text file for download."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT name, phone, email FROM customers WHERE cust_id = %s", (cust_id,))
        customer = cursor.fetchone()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        cursor.execute(
            "SELECT * FROM loans WHERE loan_id = %s AND cust_id = %s",
            (loan_id, cust_id),
        )
        loan = cursor.fetchone()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")

        amount = loan.get("approved_amount") or loan.get("requested_amount") or 0
        rate = loan.get("interest_rate") or 0
        tenure = loan.get("tenure_months") or 0
        emi = 0
        if amount and rate and tenure:
            monthly_rate = rate / 12 / 100
            emi = round(
                (amount * monthly_rate * (1 + monthly_rate) ** tenure)
                / ((1 + monthly_rate) ** tenure - 1)
            )

        statement = f"""CredFlow Finance — Loan Statement
Generated: {datetime.datetime.now().strftime('%d-%b-%Y %H:%M')}

Customer: {customer.get('name')}
Customer ID: {cust_id}
Phone: {customer.get('phone') or 'N/A'}
Email: {customer.get('email') or 'N/A'}

Loan ID: {loan_id}
Status: {loan.get('status', 'N/A')}
Principal: Rs. {amount:,}
Interest Rate: {rate}% p.a.
Tenure: {tenure} months
Estimated EMI: Rs. {emi:,}

This is a system-generated statement for reference purposes.
For official documents, contact CredFlow support.
"""
        return PlainTextResponse(
            content=statement,
            headers={
                "Content-Disposition": f'attachment; filename="loan_statement_{cust_id}_{loan_id}.txt"'
            },
        )
    finally:
        conn.close()

UPLOAD_DIR = os.path.join(_backend_root, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
DOC_PROCESSOR_BASE = os.getenv("DOC_PROCESSOR_BASE_URL", "http://127.0.0.1:8005")

async def _save_customer_upload(cust_id: str, file: UploadFile, prefix: str) -> str:
    _, ext = os.path.splitext(file.filename or "")
    ext = ext or ".pdf"
    cust_dir = os.path.join(UPLOAD_DIR, cust_id)
    os.makedirs(cust_dir, exist_ok=True)
    saved_path = os.path.join(cust_dir, f"{prefix}_{uuid.uuid4().hex[:10]}{ext}")
    contents = await file.read()
    with open(saved_path, "wb") as f:
        f.write(contents)
    return saved_path

def _customer_exists(cust_id: str) -> bool:
    conn = get_pg_connection()
    if not conn:
        return False
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM customers WHERE cust_id = %s", (cust_id,))
        return cursor.fetchone() is not None
    finally:
        conn.close()

def _save_salary_slip_record(cust_id: str, file_path: str) -> None:
    """Attach uploaded salary slip to the customer's latest loan application."""
    conn = get_pg_connection()
    if not conn:
        return
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE loans
            SET salary_slip_path = %s, updated_at = CURRENT_TIMESTAMP
            WHERE loan_id = (
                SELECT loan_id FROM loans
                WHERE cust_id = %s
                ORDER BY created_at DESC NULLS LAST, loan_id DESC
                LIMIT 1
            )
            """,
            (file_path, cust_id),
        )
        conn.commit()
    except Exception as e:
        logger.warning(f"Could not save salary slip record for {cust_id}: {e}")
    finally:
        conn.close()

@app.post("/customer/{cust_id}/verify/salary-slip")
async def verify_salary_slip_upload(cust_id: str, file: UploadFile = File(...)):
    """Upload salary slip — proxies to doc processor when available."""
    if not _customer_exists(cust_id):
        raise HTTPException(status_code=404, detail="Customer not found")

    saved_path = await _save_customer_upload(cust_id, file, "salary")

    try:
        with open(saved_path, "rb") as f:
            files = {
                "file": (
                    os.path.basename(saved_path),
                    f,
                    file.content_type or "application/octet-stream",
                )
            }
            resp = await app_http_client.post(
                f"{DOC_PROCESSOR_BASE}/verify_salary_upload",
                files=files,
                timeout=120.0,
            )
        if resp.is_success:
            data = resp.json()
            data["file_path"] = saved_path
            if data.get("status") == "failed":
                _save_salary_slip_record(cust_id, saved_path)
                return {
                    "status": "manual_review",
                    "monthly_salary": None,
                    "salary_source": None,
                    "document_type": file.filename,
                    "confidence": None,
                    "file_path": saved_path,
                    "message": data.get("error") or "Document saved for manual review.",
                }
            _save_salary_slip_record(cust_id, saved_path)
            return data
    except Exception as e:
        logger.warning(f"Salary upload proxy failed: {e}")

    try:
        resp = await app_http_client.post(
            AGENT_URLS["doc_processor"],
            json={"file_path": saved_path},
            timeout=120.0,
        )
        if resp.is_success:
            data = resp.json()
            data["file_path"] = saved_path
            _save_salary_slip_record(cust_id, saved_path)
            return data
    except Exception as e:
        logger.warning(f"Salary path verify failed: {e}")

    _save_salary_slip_record(cust_id, saved_path)
    return {
        "status": "manual_review",
        "monthly_salary": None,
        "salary_source": None,
        "document_type": file.filename,
        "confidence": None,
        "file_path": saved_path,
        "message": "Document saved. Verification team will review shortly.",
    }

@app.post("/customer/{cust_id}/verify/bank-statement")
async def verify_bank_statement_upload(cust_id: str, file: UploadFile = File(...)):
    """Upload bank statement PDF for financial health analysis."""
    if not _customer_exists(cust_id):
        raise HTTPException(status_code=404, detail="Customer not found")

    saved_path = await _save_customer_upload(cust_id, file, "statement")

    try:
        with open(saved_path, "rb") as f:
            files = {
                "file": (
                    os.path.basename(saved_path),
                    f,
                    file.content_type or "application/pdf",
                )
            }
            resp = await app_http_client.post(
                AGENT_URLS["verification_statement"],
                files=files,
                timeout=120.0,
            )
        if resp.is_success:
            data = resp.json()
            data["file_path"] = saved_path
            data["status"] = data.get("status", "success")
            return data
    except Exception as e:
        logger.warning(f"Bank statement analysis failed: {e}")

    return {
        "status": "manual_review",
        "score": 0,
        "file_path": saved_path,
        "message": "Bank statement saved. Analysis pending — our team will review it.",
        "insights": {},
    }

@app.post("/customer/{cust_id}/verify/kyc")
async def verify_customer_kyc(cust_id: str):
    """Verify KYC from customer profile or verification agent."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM customers WHERE cust_id = %s", (cust_id,))
        customer = cursor.fetchone()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        aadhaar = customer.get("aadhaar")
        if aadhaar and len(str(aadhaar).strip()) >= 10:
            return {
                "status": "verified",
                "kyc_status": "verified",
                "name": customer.get("name"),
                "message": "KYC verified from your registered profile.",
            }

        try:
            resp = await app_http_client.post(
                AGENT_URLS["verification"],
                json={"customer_id": cust_id},
                timeout=30.0,
            )
            if resp.is_success:
                data = resp.json()
                return {
                    "status": "verified",
                    "kyc_status": "verified",
                    "name": customer.get("name"),
                    "message": "KYC verified successfully.",
                    "details": data,
                }
        except Exception as e:
            logger.warning(f"Verification agent KYC failed: {e}")

        return {
            "status": "pending",
            "kyc_status": "not_verified",
            "message": "KYC incomplete. Please upload Aadhaar or PAN document.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"KYC verification failed for {cust_id}: {e}")
        raise HTTPException(status_code=500, detail="KYC verification failed")
    finally:
        conn.close()

@app.post("/customer/{cust_id}/verify/kyc-document")
async def verify_kyc_document_upload(cust_id: str, file: UploadFile = File(...)):
    """Upload Aadhaar/PAN and attach to customer profile."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    saved_path = await _save_customer_upload(cust_id, file, "kyc")
    result = {
        "status": "manual_review",
        "kyc_status": "pending",
        "file_path": saved_path,
        "message": "KYC document received. Verification in progress.",
    }

    try:
        resp = await app_http_client.post(
            f"{DOC_PROCESSOR_BASE}/process_kyc_doc",
            json={"file_path": saved_path},
            timeout=120.0,
        )
        if resp.is_success:
            data = resp.json()
            aadhaar = data.get("aadhaar")
            if aadhaar:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE customers SET aadhaar = %s WHERE cust_id = %s",
                    (str(aadhaar), cust_id),
                )
                conn.commit()
            result = {
                "status": "verified",
                "kyc_status": "verified",
                "file_path": saved_path,
                "name": data.get("name"),
                "aadhaar": data.get("aadhaar"),
                "pan": data.get("pan"),
                "message": "KYC document verified and linked to your profile.",
            }
        else:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE customers SET aadhaar = COALESCE(aadhaar, %s) WHERE cust_id = %s",
                (f"DOC-{cust_id}", cust_id),
            )
            conn.commit()
    except Exception as e:
        logger.warning(f"KYC document processing failed: {e}")
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE customers SET aadhaar = COALESCE(aadhaar, %s) WHERE cust_id = %s",
                (f"DOC-{cust_id}", cust_id),
            )
            conn.commit()
        except Exception as db_err:
            logger.error(f"KYC fallback update failed: {db_err}")
            conn.rollback()
    finally:
        conn.close()

    return result

class RegisterRequest(BaseModel):
    name: str
    email: str
    phone: str
    password: str

@app.post("/register")
async def register_customer(request: RegisterRequest):
    """Register a new customer and send customer ID via email."""
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if email already exists
        cursor.execute("SELECT cust_id FROM customers WHERE email = %s", (request.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Check if phone already exists
        cursor.execute("SELECT cust_id FROM customers WHERE phone = %s", (request.phone,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Phone number already registered")
        
        # Generate unique customer ID (more secure format: TK + 8 alphanumeric characters)
        import string
        chars = string.ascii_uppercase + string.digits
        
        # Ensure uniqueness
        max_attempts = 10
        for attempt in range(max_attempts):
            customer_id = "TK" + ''.join(random.choices(chars, k=8))
            cursor.execute("SELECT cust_id FROM customers WHERE cust_id = %s", (customer_id,))
            if not cursor.fetchone():
                break
        else:
            raise HTTPException(status_code=500, detail="Failed to generate unique customer ID")
        
        # Insert new customer
        insert_query = """
            INSERT INTO customers (cust_id, name, email, phone, password, age, gender, address, credit_score, pre_approved_limit, interest_options, category, aadhaar)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(insert_query, (
            customer_id,
            request.name,
            request.email,
            request.phone,
            request.password,  # In production, hash this password
            None,  # age
            None,  # gender
            None,  # address
            None,  # credit_score
            None,  # pre_approved_limit
            None,  # interest_options
            None,  # category
            None   # aadhaar
        ))
        
        conn.commit()
        
        # Send email with customer ID
        email_sent = await send_customer_id_email(request.email, customer_id, request.name)

        if email_sent:
            message = "Registration successful. Your Customer ID has been sent to your email."
        else:
            message = (
                "Registration successful, but we could not send your Customer ID email. "
                "Please contact support with your registered email address."
            )
            logger.warning("Registration completed for %s but email was not sent", request.email)

        return {
            "success": True,
            "email": request.email,
            "email_sent": email_sent,
            "message": message,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering customer: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)