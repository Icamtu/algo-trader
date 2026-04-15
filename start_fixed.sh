#!/bin/bash
set -e

echo "[OpenAlgo] Starting up with BUGFIX (gthread worker)..."

# Ensure Python can create directories at runtime if needed
export PYTHONDONTWRITEBYTECODE=1

cd /app

# ============================================
# DATABASE MIGRATIONS
# ============================================
if [ -f "/app/upgrade/migrate_all.py" ]; then
    echo "[OpenAlgo] Running database migrations..."
    /app/.venv/bin/python /app/upgrade/migrate_all.py || echo "[OpenAlgo] Migration completed (some may have been skipped)"
else
    echo "[OpenAlgo] No migrations found, skipping..."
fi

# ============================================
# WEBSOCKET PROXY SERVER
# ============================================
echo "[OpenAlgo] Starting WebSocket proxy server on port 8765..."
/app/.venv/bin/python -m websocket_proxy.server &
WEBSOCKET_PID=$!

# ============================================
# CLEANUP HANDLER
# ============================================
cleanup() {
    echo "[OpenAlgo] Shutting down..."
    if [ ! -z "$WEBSOCKET_PID" ]; then
        kill $WEBSOCKET_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# ============================================
# START MAIN APPLICATION
# ============================================
APP_PORT="${PORT:-5000}"

echo "[OpenAlgo] Starting application on port ${APP_PORT} with gthread..."

# Create gunicorn worker temp directory
mkdir -p /tmp/gunicorn_workers

exec /app/.venv/bin/gunicorn \
    --worker-class gthread \
    --workers 1 \
    --threads 4 \
    --bind 0.0.0.0:${APP_PORT} \
    --timeout 300 \
    --graceful-timeout 30 \
    --worker-tmp-dir /tmp/gunicorn_workers \
    --no-control-socket \
    --log-level info \
    app:app
