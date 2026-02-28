#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1

echo "Stopping old processes on 8000 / 8005 / 8080..."
lsof -ti :8000 | xargs kill -9 2>/dev/null
lsof -ti :8005 | xargs kill -9 2>/dev/null
lsof -ti :8080 | xargs kill -9 2>/dev/null
sleep 1

cd "$ROOT/backend/master_agent" || exit 1
source venv/bin/activate

echo "Starting document processor (port 8005)..."
cd "$ROOT/backend/agents/doc_processor" || exit 1
python -m uvicorn main:app --host 127.0.0.1 --port 8005 &
DOC_PID=$!

sleep 2

echo "Starting backend (port 8000)..."
cd "$ROOT/backend/master_agent" || exit 1
python main.py &
BACKEND_PID=$!

sleep 3

echo "Starting frontend (port 8080)..."
cd "$ROOT/frontend/credflow-portal" || exit 1
npm run dev &
FRONTEND_PID=$!

sleep 2

echo ""
echo "============================================"
echo "  CredFlow is running!"
echo "  App:     http://127.0.0.1:8080"
echo "  Login:   http://127.0.0.1:8080/login"
echo "  Admin:   http://127.0.0.1:8080/admin/login"
echo "  Backend: http://127.0.0.1:8000"
echo "  Doc AI:  http://127.0.0.1:8005"
echo "============================================"
echo ""
echo "Customer login: 711007500 / Sonu@123"
echo "Press Ctrl+C to stop both servers."
echo ""

open "http://127.0.0.1:8080/login" 2>/dev/null || true

wait $DOC_PID $BACKEND_PID $FRONTEND_PID
