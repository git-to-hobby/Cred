#!/usr/bin/env bash
# Run all loan agents + mock services (macOS/Linux)
set -euo pipefail

BASE_PATH="$(cd "$(dirname "$0")" && pwd)"
VENV_ACTIVATE="$BASE_PATH/venv/bin/activate"
LOG_DIR="$BASE_PATH/logs"
mkdir -p "$LOG_DIR"

if [[ ! -f "$VENV_ACTIVATE" ]]; then
  echo "Virtual environment not found. Run: python3.11 -m venv venv && source venv/bin/activate && pip install -r requirements.txt -r master_agent/requirements.txt"
  exit 1
fi

start_agent() {
  local agent_path="$1"
  local port="$2"
  local title="$3"
  local app="${4:-main:app}"
  local log_file="$LOG_DIR/${title// /_}.log"

  echo "Launching $title on port $port..."
  (
    source "$VENV_ACTIVATE"
    cd "$agent_path"
    set -a
    [[ -f "$BASE_PATH/.env" ]] && source "$BASE_PATH/.env"
    set +a
    exec python -m uvicorn "$app" --host 127.0.0.1 --port "$port"
  ) >"$log_file" 2>&1 &
  echo "$!" >"$LOG_DIR/${title// /_}.pid"
}

echo "Starting all services..."

start_agent "$BASE_PATH/master_agent" 8000 "Master Agent"
start_agent "$BASE_PATH/agents/sales_agent" 8001 "Sales Agent"
start_agent "$BASE_PATH/agents/verification_agent" 8002 "Verification Agent"
start_agent "$BASE_PATH/agents/underwriting_agent" 8003 "Underwriting Agent"
start_agent "$BASE_PATH/agents/sanction_generator" 8004 "Sanction Agent"
start_agent "$BASE_PATH/agents/doc_processor" 8005 "Doc Processor Agent"
start_agent "$BASE_PATH/mock_services/crm" 9001 "Mock CRM"
start_agent "$BASE_PATH/mock_services/credit_bureau" 9002 "Mock Credit Bureau"
start_agent "$BASE_PATH/mock_services/offer_mart" 9003 "Mock Offer Mart"

echo ""
echo "All 9 backend services are starting."
echo "Logs: $LOG_DIR"
echo "Stop all: kill \$(cat $LOG_DIR/*.pid 2>/dev/null) 2>/dev/null || true"
