-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 1. Asset Vault Schema
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- strategy, dataset, result, model
    description TEXT,
    tags TEXT[],
    version TEXT DEFAULT '1.0.0',
    file_path TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_tags ON assets USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets (asset_type);

-- 2. Time-Series Data Registry (Market Data)
CREATE TABLE IF NOT EXISTS market_ticks (
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    symbol TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    quantity INTEGER,
    side TEXT, -- BID, ASK, TRADE
    exchange TEXT DEFAULT 'NSE'
);

-- Convert to Hypertable
SELECT create_hypertable('market_ticks', 'timestamp', if_not_exists => TRUE);

-- 3. Strategy Outputs (Signals & Decisions)
CREATE TABLE IF NOT EXISTS strategy_signals (
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    strategy_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    signal_type TEXT NOT NULL, -- BUY, SELL, HOLD, REBAL
    price DOUBLE PRECISION NOT NULL,
    indicators JSONB DEFAULT '{}',
    ai_reasoning TEXT,
    conviction DOUBLE PRECISION
);

-- Convert to Hypertable
SELECT create_hypertable('strategy_signals', 'timestamp', if_not_exists => TRUE);

-- 4. Trade Registry (Sync from SQLite for long-term depth analysis)
CREATE TABLE IF NOT EXISTS trade_registry (
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    trade_id INTEGER,
    strategy_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    pnl DOUBLE PRECISION,
    mode TEXT DEFAULT 'sandbox'
);

SELECT create_hypertable('trade_registry', 'timestamp', if_not_exists => TRUE);
