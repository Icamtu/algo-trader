
import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add the workspace root to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)
sys.path.append(os.path.join(BASE_DIR, "algo-trader"))

from fastapi_app import app
from core.context import app_context
from unittest.mock import MagicMock

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_context():
    # Populate context to avoid 503s
    app_context["order_manager"] = MagicMock()
    app_context["order_manager"].risk_manager = MagicMock()
    app_context["order_manager"].risk_manager.get_status.return_value = {"status": "ok"}
    app_context["strategy_runner"] = MagicMock()
    app_context["strategy_runner"].get_telemetry.return_value = {"regime": "bullish"}

def test_risk_status_works():
    # After our fix, this should be at the correct path and return 200 (if context is set)
    response = client.get("/api/v1/risk/status")
    assert response.status_code == 200

def test_intel_regime_works():
    response = client.get("/api/v1/regime")
    assert response.status_code == 200

def test_health_works():
    # Was /api/v1/health/health, now should be /api/v1/health
    response = client.get("/api/v1/health")
    assert response.status_code == 200
