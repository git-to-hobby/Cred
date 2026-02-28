#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/frontend/credflow-portal" || exit 1
echo ""
echo "  CredFlow → http://127.0.0.1:8080/"
echo "  (project root se chalao: ./start-frontend.sh)"
echo ""
npm run dev
