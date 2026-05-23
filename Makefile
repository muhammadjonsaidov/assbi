.PHONY: start stop status logs build refresh install

start:
	@bash start.sh

stop:
	@bash stop.sh

refresh:
	@bash refresh.sh $(filter-out $@,$(MAKECMDGOALS))

status:
	@bash status.sh

# Tail all logs live
logs:
	@tail -f logs/backend.log logs/frontend.log logs/worker.log 2>/dev/null || echo "No logs yet. Run: make start"

# Install frontend deps (run once after clone)
install:
	@echo "[INSTALL] Frontend npm deps..."
	@cd frontend && npm install
	@echo "[INSTALL] Done."

# Build all without starting
build:
	@echo "[BUILD] Spring Boot..."
	@cd backend && mvn package -q -DskipTests
	@echo "[BUILD] Frontend..."
	@cd frontend && npm run build
	@echo "[BUILD] Done."
