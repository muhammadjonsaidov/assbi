#!/usr/bin/env bash
# Restart individual components without full stop/start.
# Usage:
#   ./refresh.sh              — restart backend + worker (keep DB + frontend)
#   ./refresh.sh backend      — restart Spring Boot only
#   ./refresh.sh frontend     — restart React dev server only
#   ./refresh.sh worker       — restart detection worker only
#   ./refresh.sh all          — full stop then start

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/logs"
mkdir -p "$LOGS"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[REFRESH]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}    $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}    $*"; exit 1; }

TARGET="${1:-}"

# ── Helpers ───────────────────────────────────────────────────────────────────

kill_pid_file() {
    local name="$1" pidfile="$LOGS/$2.pid"
    if [ -f "$pidfile" ]; then
        PID=$(cat "$pidfile")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null
            # Wait up to 5s for clean exit
            for i in $(seq 1 10); do
                kill -0 "$PID" 2>/dev/null || break
                sleep 0.5
            done
            kill -9 "$PID" 2>/dev/null || true
            info "$name stopped."
        fi
        rm -f "$pidfile"
    fi
}

# ── Backend refresh ───────────────────────────────────────────────────────────

refresh_backend() {
    info "Restarting Spring Boot backend..."
    kill_pid_file "Spring Boot" "backend"
    pkill -f AssbiApplication 2>/dev/null || true
    sleep 1

    cd "$ROOT/backend"
    mvn spring-boot:run > "$LOGS/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$LOGS/backend.pid"

    info "Waiting for Spring Boot on :8080..."
    for i in $(seq 1 40); do
        if curl -s http://localhost:8080/actuator/health -o /dev/null 2>/dev/null; then
            info "Spring Boot ready. (pid $BACKEND_PID)"
            return
        fi
        sleep 2
    done
    fail "Spring Boot did not start in 80s. Check: logs/backend.log"
}

# ── Frontend refresh ──────────────────────────────────────────────────────────

refresh_frontend() {
    info "Restarting React frontend..."
    kill_pid_file "React frontend" "frontend"
    pkill -f "vite.*3000" 2>/dev/null || true
    sleep 1

    cd "$ROOT/frontend"
    npm run dev > "$LOGS/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$LOGS/frontend.pid"

    info "Waiting for React dev server on :3000..."
    for i in $(seq 1 20); do
        if curl -s http://localhost:3000 -o /dev/null 2>/dev/null; then
            info "Frontend ready. (pid $FRONTEND_PID)"
            return
        fi
        sleep 1
    done
    fail "Frontend did not start in 20s. Check: logs/frontend.log"
}

# ── Worker refresh ────────────────────────────────────────────────────────────

refresh_worker() {
    info "Restarting detection worker..."
    kill_pid_file "Detection worker" "worker"
    pkill -f "main.py --source" 2>/dev/null || true
    info "Worker stopped. Use Web UI to start a new source."
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

case "$TARGET" in
    all)
        info "Full restart..."
        bash "$ROOT/stop.sh"
        sleep 2
        bash "$ROOT/start.sh"
        ;;
    backend)
        refresh_backend
        ;;
    frontend)
        refresh_frontend
        ;;
    worker)
        refresh_worker
        ;;
    "")
        refresh_backend
        refresh_worker
        ;;
    *)
        fail "Unknown target: '$TARGET'. Use: backend | frontend | worker | all (or no arg for backend+worker)"
        ;;
esac

echo ""
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Refresh done. PostgreSQL untouched."
info "  ./refresh.sh backend   — backend only"
info "  ./refresh.sh frontend  — frontend only"
info "  ./refresh.sh worker    — worker only"
info "  ./refresh.sh all       — full restart"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
