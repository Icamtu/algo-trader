import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pytest
import os
from unittest.mock import MagicMock, patch
from risk.risk_manager import RiskManager, RiskCheckResult
from datetime import datetime
import pytz

@pytest.fixture
def mock_db():
    with patch('risk.risk_manager.get_trade_logger') as mock:
        db_instance = MagicMock()
        db_instance.get_risk_settings.return_value = {}
        mock.return_value = db_instance
        yield db_instance

@pytest.fixture
def risk_manager(mock_db):
    return RiskManager(
        max_order_quantity=100,
        max_order_notional=100000.0,
        max_position_quantity_per_symbol=200,
        max_open_positions=5,
        max_daily_trades=10,
        max_daily_loss=5000.0,
        risk_per_trade=500.0
    )

def test_risk_manager_defaults(mock_db):
    rm = RiskManager()
    assert rm.max_order_quantity > 0
    assert rm.max_daily_loss > 0

def test_check_order_allowed(risk_manager):
    res = risk_manager.validate_order(
        strategy_id="test",
        symbol="RELIANCE",
        action="BUY",
        quantity=50,
        price=1000.0,
        current_position=0,
        product="CNC"
    )
    assert res.allowed is True

def test_check_order_max_qty_breach(risk_manager):
    res = risk_manager.validate_order(
        strategy_id="test",
        symbol="RELIANCE",
        action="BUY",
        quantity=150,
        price=100.0,
        current_position=0
    )
    assert res.allowed is False
    assert "quantity" in res.reason.lower()

def test_check_order_max_notional_breach(risk_manager):
    res = risk_manager.validate_order(
        strategy_id="test",
        symbol="RELIANCE",
        action="BUY",
        quantity=50,
        price=3000.0,
        current_position=0
    )
    assert res.allowed is False
    assert "notional" in res.reason.lower()

def test_check_order_max_position_breach(risk_manager):
    res = risk_manager.validate_order(
        strategy_id="test",
        symbol="RELIANCE",
        action="BUY",
        quantity=50,
        price=100.0,
        current_position=160,
        product="CNC"
    )
    assert res.allowed is False
    assert "position" in res.reason.lower()

def test_daily_trades_limit(risk_manager):
    for _ in range(10):
        risk_manager.record_trade()
    res = risk_manager.validate_order(
        strategy_id="test",
        symbol="RELIANCE",
        action="BUY",
        quantity=10,
        price=100.0,
        current_position=0,
        product="CNC"
    )
    assert res.allowed is False
    assert "trade" in res.reason.lower()

def test_daily_loss_limit(risk_manager):
    risk_manager.record_trade(pnl=-6000.0)
    res = risk_manager.validate_order(
        strategy_id="test",
        symbol="RELIANCE",
        action="BUY",
        quantity=10,
        price=100.0,
        current_position=0
    )
    assert res.allowed is False
    assert "loss" in res.reason.lower()

def test_strategy_daily_loss_limit(risk_manager):
    risk_manager.strategy_max_daily_loss = 2000.0
    risk_manager.record_trade(strategy_id="scalper", pnl=-2500.0)
    res = risk_manager.validate_order(
        strategy_id="scalper",
        symbol="RELIANCE",
        action="BUY",
        quantity=10,
        price=100.0,
        current_position=0
    )
    assert res.allowed is False
    assert "strategy" in res.reason.lower()
    assert "loss" in res.reason.lower()

def test_symbol_notional_concentration_breach(risk_manager):
    risk_manager.max_symbol_notional = 50000.0
    res = risk_manager.validate_order(
        strategy_id="test",
        symbol="RELIANCE",
        action="BUY",
        quantity=100,
        price=600.0,
        current_position=0
    )
    assert res.allowed is False
    assert "concentration" in res.reason.lower()

def test_mis_market_hours_check(risk_manager):
    # Mocking is_mis_allowed to return False
    with patch.object(RiskManager, 'is_mis_allowed', return_value=False):
        res = risk_manager.validate_order(
            strategy_id="test",
            symbol="RELIANCE",
            action="BUY",
            quantity=10,
            price=100.0,
            current_position=0,
            product="MIS"
        )
        assert res.allowed is False
        assert "market hours" in res.reason.lower()

def test_global_halt(risk_manager):
    risk_manager.global_halt = True
    res = risk_manager.validate_order(
        strategy_id="test",
        symbol="RELIANCE",
        action="BUY",
        quantity=10,
        price=100.0,
        current_position=0,
        product="CNC"
    )
    assert res.allowed is False
    assert "halt" in res.reason.lower()
