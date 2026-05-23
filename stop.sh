#!/usr/bin/env bash

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/logs"

GREEN='\033[0;32m'
NC='\033[0m'
info() { echo -e "${GREEN}[ASSBI]${NC} $*"; }

kill_pid_file() {
    local name="$1"
    local pidfile="$LOGS/$2.pid"
    if [ -f "$pidfile" ]; then
        PID=$(cat "$pidfile")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null && info "$name stopped (pid $PID)."
        else
            info "$name already stopped."
        fi
        rm -f "$pidfile"
    else
        info "$name: no pid file found."
    fi
}

info "Stopping React frontend..."
kill_pid_file "React frontend" "frontend"
pkill -f "vite.*3000" 2>/dev/null || true

info "Stopping Spring Boot..."
kill_pid_file "Spring Boot" "backend"
pkill -f AssbiApplication 2>/dev/null || true

info "Stopping Python detection worker..."
kill_pid_file "Detection worker" "worker"
pkill -f "main.py --source" 2>/dev/null || true

info "Stopping PostgreSQL..."
docker stop assbi-postgres 2>/dev/null && docker rm assbi-postgres 2>/dev/null || true
info "PostgreSQL stopped."

echo ""
info "All components stopped."
