#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/logs"
mkdir -p "$LOGS"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[ASSBI]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()    { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ── Step 1: PostgreSQL ────────────────────────────────────────────────────────
info "Starting PostgreSQL..."
docker compose -f "$ROOT/docker/docker-compose.yml" up -d

info "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 20); do
    if docker exec assbi-postgres pg_isready -U assbi -d assbi -q 2>/dev/null; then
        info "PostgreSQL ready."
        break
    fi
    sleep 1
    if [ "$i" -eq 20 ]; then
        fail "PostgreSQL did not become ready in 20s. Check: docker logs assbi-postgres"
    fi
done

# ── Step 2: Spring Boot backend ───────────────────────────────────────────────
info "Starting Spring Boot backend..."
cd "$ROOT/backend"
mvn spring-boot:run > "$LOGS/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$LOGS/backend.pid"

info "Waiting for Spring Boot on :8080..."
for i in $(seq 1 40); do
    if curl -s http://localhost:8080/actuator/health -o /dev/null 2>/dev/null; then
        info "Spring Boot ready. (log: logs/backend.log)"
        break
    fi
    sleep 2
    if [ "$i" -eq 40 ]; then
        fail "Spring Boot did not start in 80s. Check: logs/backend.log"
    fi
done

# ── Step 3: React frontend ────────────────────────────────────────────────────
info "Starting React frontend..."
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
    info "node_modules not found — running npm install..."
    npm install --silent || fail "npm install failed. Is Node.js installed?"
fi
npm run dev > "$LOGS/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$LOGS/frontend.pid"

info "Waiting for React dev server on :3000..."
for i in $(seq 1 20); do
    if curl -s http://localhost:3000 -o /dev/null 2>/dev/null; then
        info "Frontend ready. (log: logs/frontend.log)"
        break
    fi
    sleep 1
    if [ "$i" -eq 20 ]; then
        fail "Frontend did not start in 20s. Check: logs/frontend.log"
    fi
done

# ── Step 4: Open browser ──────────────────────────────────────────────────────
info "Opening Web UI..."
URL="http://localhost:3000"
if command -v xdg-open &>/dev/null; then
    xdg-open "$URL" &>/dev/null &
elif command -v open &>/dev/null; then
    open "$URL" &
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Services running:"
info "  PostgreSQL  :5432"
info "  Backend     :8080   logs/backend.log"
info "  Frontend    :3000   logs/frontend.log"
info "  Python      :5000   (started from Web UI)"
info ""
info "  Web UI → http://localhost:3000"
info ""
info "Stop:   ./stop.sh"
info "Status: ./status.sh"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
