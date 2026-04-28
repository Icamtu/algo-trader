import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from execution.order_manager import OrderManager

@pytest.fixture
def mock_client():
    client = MagicMock()
    # Mocking sync methods as they are called via asyncio.to_thread
    client.place_order.return_value = {"status": "success", "order_id": "test1234"}
    client.cancel_order.return_value = {"status": "success"}
    client.get_positions.return_value = {"status": "success", "data": [{"symbol": "RELIANCE", "quantity": "10", "avg_price": "2500.0"}]}
    client.get_quote.return_value = {"status": "success", "last_price": "2505.0"}
    return client

@pytest.fixture
def mock_dependencies():
    with patch('execution.order_manager.get_trade_logger') as m_logger, \
         patch('execution.order_manager.RiskManager') as m_risk, \
         patch('execution.order_manager.PositionManager') as m_pos, \
         patch('execution.order_manager.AsyncTokenBucket') as m_limit:

        m_logger_inst = MagicMock()
        m_logger_inst.log_trade = AsyncMock()
        m_logger_inst.log_drift_event = AsyncMock()
        m_logger.return_value = m_logger_inst

        m_risk_inst = m_risk.return_value
        m_risk_inst.validate_order.return_value = MagicMock(allowed=True)
        m_risk_inst.get_status.return_value = {"status": "healthy"}

        m_limit_inst = m_limit.return_value
        m_limit_inst.wait = AsyncMock()

        m_pos_inst = m_pos.return_value
        m_pos_inst.get_quantity.return_value = 0
        m_pos_inst.all_positions.return_value = {}

        yield {
            "logger": m_logger_inst,
            "risk": m_risk_inst,
            "pos": m_pos_inst,
            "limit": m_limit_inst
        }

@pytest.fixture
def order_manager(mock_client, mock_dependencies):
    om = OrderManager(
        client=mock_client,
        risk_manager=mock_dependencies["risk"],
        position_manager=mock_dependencies["pos"]
    )
    return om

@pytest.mark.asyncio
async def test_place_order_success(order_manager, mock_client):
    res = await order_manager.place_order(
        strategy_name="test_strat",
        symbol="RELIANCE",
        action="BUY",
        quantity=10,
        price=100.0,
        product="CNC"
    )
    assert res["status"] == "success"
    assert res["order_id"] == "test1234"
    mock_client.place_order.assert_called_once()

@pytest.mark.asyncio
async def test_place_order_rate_limiting(order_manager, mock_dependencies):
    order_manager.mode = "live"
    await order_manager.place_order(
        strategy_name="test_strat",
        symbol="RELIANCE",
        action="BUY",
        quantity=10,
        price=100.0
    )
    mock_dependencies["limit"].wait.assert_called_once()

@pytest.mark.asyncio
async def test_place_order_pricing_fallback(order_manager, mock_client):
    # Mock broker returning 0.0 price
    mock_client.place_order.return_value = {"status": "success", "order_id": "test1234", "price": 0.0}

    await order_manager.place_order(
        strategy_name="test_strat",
        symbol="RELIANCE",
        action="BUY",
        quantity=10,
        price=0.0
    )
    mock_client.get_quote.assert_called_once_with("RELIANCE", "NSE")

@pytest.mark.asyncio
async def test_check_drift_detection(order_manager, mock_client, mock_dependencies):
    # Mock broker has 10, local has 0
    mock_client.get_positions.return_value = {"data": [{"symbol": "RELIANCE", "quantity": "10"}]}
    mock_dependencies["pos"].get_quantity.return_value = 0

    drift = await order_manager.check_drift()
    assert drift is True

@pytest.mark.asyncio
async def test_sync_with_broker_reconciliation(order_manager, mock_client, mock_dependencies):
    mock_client.get_positions.return_value = {"data": [{"symbol": "RELIANCE", "quantity": "10", "avg_price": "2500.0"}]}
    mock_dependencies["pos"].get_quantity.return_value = 0
    mock_dependencies["pos"].all_positions.return_value = {}

    # Mock session service to avoid real network calls
    with patch('services.session_service.get_session_service') as m_ss:
        m_ss.return_value.check_health = AsyncMock(return_value=True)
        await order_manager.sync_with_broker()

    mock_dependencies["pos"].set_position.assert_called_with("RELIANCE", 10, 2500.0)
    mock_dependencies["logger"].log_drift_event.assert_called()

@pytest.mark.asyncio
async def test_cancel_order(order_manager, mock_client):
    res = await order_manager.cancel_order("test1234")
    assert res["status"] == "success"
    mock_client.cancel_order.assert_called_once_with("test1234")
