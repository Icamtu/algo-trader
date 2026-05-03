
import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add the app directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "algo-trader"))

from fastapi_app import app

client = TestClient(app)

def test_risk_status_404():
    # This should currently fail with 404 because it's actually at /api/v1/api/v1/risk/status
    response = client.get("/api/v1/risk/status")
    assert response.status_code == 404

def test_intel_regime_404():
    response = client.get("/api/v1/regime")
    assert response.status_code == 404

def test_actual_double_prefix_works():
    # This should currently work (or at least not 404 if it exists)
    response = client.get("/api/v1/api/v1/risk/status")
    # It might return 503 or 500 depending on app_context, but not 404
    assert response.status_code != 404
