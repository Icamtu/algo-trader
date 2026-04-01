# --- DOCKER CONTROLS ---

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build --no-cache

status:
	docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# --- LOGS & MONITORING ---

logs-engine:
	docker logs -f algo_engine

logs-bridge:
	docker logs -f openalgo_bridge

stats:
	docker stats --no-stream

# --- DATABASE & SECURITY ---

backup:
	@mkdir -p ./data/backups
	docker exec trading_db pg_dump -U admin_trader trading_db > ./data/backups/db_backup_$(shell date +%F_%H%M).sql
	@echo "Backup saved to ./data/backups/"

# --- GIT MANAGEMENT ---

update:
	@echo "Updating Custom Engine..."
	cd algo-trader && git pull
	@echo "Rebuilding and restarting..."
	docker compose up -d --build
