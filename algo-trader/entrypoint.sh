#!/bin/bash
set -e

# Start Tailscale daemon in the background
echo "Starting tailscaled..."
tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/var/run/tailscale/tailscaled.sock &

# Wait for tailscaled to start
sleep 2

# Authenticate with Tailscale if a key is provided
if [ -n "$TAILSCALE_AUTH_KEY" ]; then
    echo "Authenticating with Tailscale..."
    tailscale up --authkey="$TAILSCALE_AUTH_KEY" --hostname="${TAILSCALE_HOSTNAME:-algo-engine}" --accept-routes --accept-dns=false
else
    echo "TAILSCALE_AUTH_KEY not set. Skipping automatic Tailscale authentication."
fi

# Start the main application
echo "Starting AetherDesk Algo Engine..."
exec python -u main.py
