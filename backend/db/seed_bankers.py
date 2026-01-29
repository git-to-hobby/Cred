"""
Create banks + single super admin with secure credentials.
Bank officers are registered as PENDING — super admin must approve before login.

Run:
  cd backend/db && python seed_bankers.py
  cd backend/db && python seed_bankers.py --rotate
"""
import argparse
import json
import os
from datetime import datetime, timezone

import psycopg2
from dotenv import load_dotenv

from banker_security import generate_banker_id, generate_password, hash_password

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATABASE_CONFIG = {
    "dbname": os.getenv("DB_NAME", "loan_chatbot_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
}

CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), ".banker_credentials.local.json")
PLATFORM_ADMIN_EMAIL = os.getenv("PLATFORM_ADMIN_EMAIL", "").strip() or os.getenv("SMTP_USERNAME", "").strip()

PENDING_OFFICER_STUBS = [
    ("BANK_HDFC", "Rajesh Sharma", "Senior Loan Officer"),
    ("BANK_SBI", "Priya Verma", "Loan Approver"),
    ("BANK_ICICI", "Amit Patel", "Branch Manager"),
]


def ensure_schema(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS banks (
            bank_id TEXT PRIMARY KEY,
            bank_name TEXT NOT NULL,
            bank_code TEXT NOT NULL UNIQUE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS bankers (
            banker_id TEXT PRIMARY KEY,
            bank_id TEXT NOT NULL REFERENCES banks(bank_id),
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'Loan Officer',
            email TEXT,
            approval_status TEXT DEFAULT 'pending',
            approved_by TEXT,
            approved_at TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("""
        ALTER TABLE bankers ADD COLUMN IF NOT EXISTS email TEXT;
        ALTER TABLE bankers ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
        ALTER TABLE bankers ADD COLUMN IF NOT EXISTS approved_by TEXT;
        ALTER TABLE bankers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
    """)
    cur.execute("""
        ALTER TABLE loans ADD COLUMN IF NOT EXISTS bank_id TEXT;
        ALTER TABLE loans ADD COLUMN IF NOT EXISTS reviewed_by_banker_id TEXT;
        ALTER TABLE loans ADD COLUMN IF NOT EXISTS review_note TEXT;
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS loan_audit_log (
            audit_id SERIAL PRIMARY KEY,
            loan_id INTEGER NOT NULL,
            cust_id TEXT,
            customer_name TEXT,
            action TEXT NOT NULL,
            banker_id TEXT NOT NULL,
            banker_name TEXT,
            bank_id TEXT,
            bank_name TEXT,
            requested_amount NUMERIC,
            approved_amount NUMERIC,
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rotate", action="store_true")
    args = parser.parse_args()

    if os.path.exists(CREDENTIALS_FILE) and not args.rotate:
        print(f"Already provisioned. Super admin credentials: {CREDENTIALS_FILE}")
        print("Use --rotate to reset (invalidates all admin logins).")
        return

    conn = psycopg2.connect(**DATABASE_CONFIG)
    cur = conn.cursor()
    try:
        ensure_schema(cur)

        banks = [
            ("BANK_CREDFLOW", "CredFlow Platform", "CFLOW"),
            ("BANK_HDFC", "HDFC Bank", "HDFC"),
            ("BANK_SBI", "State Bank of India", "SBI"),
            ("BANK_ICICI", "ICICI Bank", "ICICI"),
        ]
        for bank_id, bank_name, bank_code in banks:
            cur.execute(
                """
                INSERT INTO banks (bank_id, bank_name, bank_code)
                VALUES (%s, %s, %s)
                ON CONFLICT (bank_id) DO UPDATE SET bank_name = EXCLUDED.bank_name
                """,
                (bank_id, bank_name, bank_code),
            )

        cur.execute("DELETE FROM bankers")

        super_id = generate_banker_id()
        super_password = generate_password()
        cur.execute(
            """
            INSERT INTO bankers (banker_id, bank_id, name, password_hash, role, email,
                                 approval_status, is_active, approved_at)
            VALUES (%s, 'BANK_CREDFLOW', %s, %s, 'Platform Admin', %s, 'approved', TRUE, CURRENT_TIMESTAMP)
            """,
            (
                super_id,
                os.getenv("ADMIN_NAME", "CredFlow Super Admin"),
                hash_password(super_password),
                PLATFORM_ADMIN_EMAIL or None,
            ),
        )

        issued = [{
            "bankerId": super_id,
            "password": super_password,
            "name": os.getenv("ADMIN_NAME", "CredFlow Super Admin"),
            "role": "Platform Admin",
            "bankId": "BANK_CREDFLOW",
            "bankName": "CredFlow Platform",
            "note": "Login requires email OTP sent to PLATFORM_ADMIN_EMAIL",
        }]

        for bank_id, name, role in PENDING_OFFICER_STUBS:
            stub_id = generate_banker_id()
            cur.execute(
                """
                INSERT INTO bankers (banker_id, bank_id, name, password_hash, role,
                                     approval_status, is_active)
                VALUES (%s, %s, %s, %s, %s, 'pending', FALSE)
                """,
                (stub_id, bank_id, name, hash_password(generate_password(24)), role),
            )

        conn.commit()

        payload = {
            "issuedAt": datetime.now(timezone.utc).isoformat(),
            "warning": "Super admin only. Bank officers need approval in Bank Monitor before login.",
            "platformAdminEmail": PLATFORM_ADMIN_EMAIL,
            "accounts": issued,
        }
        with open(CREDENTIALS_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        print("Setup complete.")
        print(f"Super admin credentials: {CREDENTIALS_FILE}")
        print(f"OTP email: {PLATFORM_ADMIN_EMAIL or '(set PLATFORM_ADMIN_EMAIL in .env)'}")
        print(f"Super admin ID: {super_id}")
        print("Pending bank officers created — approve in Bank Monitor to issue login.")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
