#!/usr/bin/env bash

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/logs"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✔${NC}  $*"; }
fail() { echo -e "  ${RED}✘${NC}  $*"; }
warn() { echo -e "  ${YELLOW}~${NC}  $*"; }

echo ""
echo "  ASSBI — Component Status"
echo "  ─────────────────────────────────────"

# PostgreSQL
if docker exec assbi-postgres pg_isready -U assbi -q 2>/dev/null; then
    ok "PostgreSQL     :5432   running"
else
    fail "PostgreSQL     :5432   NOT running   → docker compose -f docker/docker-compose.yml up -d"
fi

# Spring Boot
if curl -s http://localhost:8080/actuator/health -o /dev/null 2>/dev/null; then
    ok "Spring Boot    :8080   running"
else
    fail "Spring Boot    :8080   NOT running   → cd backend && mvn spring-boot:run"
fi

# Python worker
if curl -s http://localhost:5000/health -o /dev/null 2>/dev/null; then
    ok "Python worker  :5000   running"
else
    fail "Python worker  :5000   NOT running   → cd detection-worker && venv/bin/python main.py --source 0"
fi

# React frontend
if curl -s http://localhost:3000 -o /dev/null 2>/dev/null; then
    ok "React frontend :3000   running"
else
    fail "React frontend :3000   NOT running   → cd frontend && npm run dev"
fi

echo "  ─────────────────────────────────────"
echo ""

# Recent log tails
if [ -f "$LOGS/backend.log" ]; then
    echo "  Last backend log line:"
    echo "    $(tail -1 "$LOGS/backend.log")"
fi
if [ -f "$LOGS/worker.log" ]; then
    echo "  Last worker log line:"
    echo "    $(tail -1 "$LOGS/worker.log")"
fi
if [ -f "$LOGS/frontend.log" ]; then
    echo "  Last frontend log line:"
    echo "    $(tail -1 "$LOGS/frontend.log")"
fi
echo ""
