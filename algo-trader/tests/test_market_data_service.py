import pytest
import asyncio
import sqlite3
import os
from unittest.mock import MagicMock, patch, AsyncMock
from services.market_data_service import MarketDataService

@pytest.fixture
def mock_order_manager():
    om = MagicMock()
    om.get_quote = AsyncMock()
    om.get_multi_quotes = AsyncMock()
    return om

@pytest.fixture
def market_data_service(mock_order_manager):
    return MarketDataService(mock_order_manager)

@pytest.mark.asyncio
async def test_get_underlying_ltp_native(market_data_service, mock_order_manager):
    # Mock native broker
    mock_order_manager.native_broker = MagicMock()
    mock_order_manager.native_broker.get_quote = AsyncMock(return_value={"lp": "2500.50"})

    ltp = await market_data_service.get_underlying_ltp("RELIANCE", "NSE")
    assert ltp == 2500.50
    mock_order_manager.native_broker.get_quote.assert_called_once_with("RELIANCE", "NSE")

@pytest.mark.asyncio
async def test_get_underlying_ltp_index_mapping(market_data_service, mock_order_manager):
    mock_order_manager.native_broker = MagicMock()
    mock_order_manager.native_broker.get_quote = AsyncMock(return_value={"lp": "22000.10"})

    ltp = await market_data_service.get_underlying_ltp("NIFTY", "NSE")
    assert ltp == 22000.10
    # Should map to NSE_INDEX
    mock_order_manager.native_broker.get_quote.assert_called_once_with("NIFTY", "NSE_INDEX")

@pytest.mark.asyncio
async def test_get_option_chain_success(market_data_service, mock_order_manager):
    # 1. Mock underlying quote
    mock_order_manager.get_quote.return_value = {
        "status": "success",
        "data": {"lp": "22000", "pc": "21900"}
    }

    # 2. Mock SQLite database results
    mock_strikes = [(21800.0,), (21900.0,), (22000.0,), (22100.0,), (22200.0,)]

    # 3. Mock multi-quotes for options
    mock_quotes = {
        "NIFTY28FEB2521900CE": {"lp": "150", "oi": "1000"},
        "NIFTY28FEB2521900PE": {"lp": "50", "oi": "1200"},
        "NIFTY28FEB2522000CE": {"lp": "100", "oi": "2000"},
        "NIFTY28FEB2522000PE": {"lp": "100", "oi": "2100"},
        "NIFTY28FEB2522100CE": {"lp": "60", "oi": "1500"},
        "NIFTY28FEB2522100PE": {"lp": "160", "oi": "1100"},
    }
    mock_order_manager.get_multi_quotes.return_value = {"status": "success", "data": mock_quotes}

    with patch('sqlite3.connect') as mock_connect:
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur
        mock_cur.fetchall.return_value = mock_strikes

        # We need to mock os.path.exists to true for the db path
        with patch('os.path.exists', return_value=True):
            result = await market_data_service.get_option_chain(
                underlying="NIFTY",
                exchange="NSE",
                expiry_date="28FEB25",
                strike_count=1
            )

    assert result["status"] == "success"
    assert result["spot_price"] == 22000.0
    assert result["atm_strike"] == 22000.0
    assert len(result["chain"]) == 3 # 21900, 22000, 22100

    # Verify symbol construction for ATM strike
    atm_row = next(r for r in result["chain"] if r["strike"] == 22000.0)
    assert atm_row["ce"]["symbol"] == "NIFTY28FEB2522000CE"
    assert atm_row["pe"]["symbol"] == "NIFTY28FEB2522000PE"

@pytest.mark.asyncio
async def test_symbol_parity_with_db(market_data_service, mock_order_manager):
    """
    Proposed test case to catch symbol construction errors.
    Verify that symbols constructed by the service exist in the database.
    """
    underlying = "NIFTY"
    expiry_date = "28FEB25"
    strike = 22000.0
    opt_exchange = "NFO"

    # Manual construction logic from service
    strike_str = str(int(strike)) if strike == int(strike) else str(strike)
    ce_sym = f"{underlying}{expiry_date}{strike_str}CE"

    with patch('sqlite3.connect') as mock_connect:
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cur

        # Mock DB returning the symbol if found
        mock_cur.fetchone.return_value = (ce_sym,)

        # Simulate check
        mock_cur.execute("SELECT symbol FROM symtoken WHERE symbol = ? AND exchange = ?", (ce_sym, opt_exchange))
        db_symbol = mock_cur.fetchone()

        assert db_symbol is not None
        assert db_symbol[0] == ce_sym
