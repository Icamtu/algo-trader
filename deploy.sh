#!/bin/bash

# --- DEPLOYMENT AUTOMATION SCRIPT ---
# This script builds the algo-trader image and redeploys it to Kubernetes.

set -e

echo "🚀 Starting build and deploy process..."

# 1. Build the image using Docker
# This creates the image locally but does not start any containers permanently.
echo "📦 Step 1: Building algo-trader image..."
docker compose build algo-trader

# 2. Sync credentials from .env to Kubernetes (Optional but Recommended)
echo "🔑 Step 2: Syncing environment variables from .env to Kubernetes..."
kubectl create secret generic aetherdesk-env --from-env-file=.env -n aetherdesk --dry-run=client -o yaml | kubectl apply -f -

# 3. Import image into K3s (Local environment fix)
echo "📥 Step 3: Importing image into K3s image store..."
docker save docker.io/library/trading-workspace-algo-trader:latest | sudo k3s ctr images import -

# 4. Restart the Kubernetes deployment to pick up the new image/env
echo "🔄 Step 4: Rolling out update to Kubernetes (aetherdesk namespace)..."
kubectl rollout restart deployment/algo-trader -n aetherdesk

# 5. Success check
echo "⏳ Step 5: Waiting for rollout to complete..."
kubectl rollout status deployment/algo-trader -n aetherdesk

echo "✅ Deployment finished successfully! K3s is now running the latest image version."

