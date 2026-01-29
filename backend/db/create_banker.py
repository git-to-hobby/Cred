"""
Register a pending bank officer (super admin must approve before login).

  cd backend/db && python create_banker.py --bank BANK_HDFC --name "New Officer"
"""
import argparse
import os

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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bank", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--role", default="Loan Officer")
    parser.add_argument("--email", default="")
    args = parser.parse_args()

    if args.bank == "BANK_CREDFLOW":
        raise SystemExit("Cannot create another super admin via CLI")

    conn = psycopg2.connect(**DATABASE_CONFIG)
    cur = conn.cursor()
    try:
        cur.execute("SELECT bank_name FROM banks WHERE bank_id = %s", (args.bank,))
        row = cur.fetchone()
        if not row:
            raise SystemExit(f"Unknown bank: {args.bank}")

        banker_id = generate_banker_id()
        cur.execute(
            """
            INSERT INTO bankers (banker_id, bank_id, name, password_hash, role, email,
                                 approval_status, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, 'pending', FALSE)
            """,
            (
                banker_id,
                args.bank,
                args.name,
                hash_password(generate_password(24)),
                args.role,
                args.email.strip() or None,
            ),
        )
        conn.commit()
        print(f"Pending officer registered: {banker_id}")
        print("Approve in Bank Monitor to issue login credentials.")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
