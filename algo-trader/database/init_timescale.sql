-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 1. Market Ticks Table (Raw Tick Data)
CREATE TABLE IF NOT EXISTS market_ticks (
    timestamp TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    quantity INTEGER DEFAULT 0,
    side TEXT DEFAULT 'TRADE'
);

-- Convert to hypertable
SELECT create_hypertable('market_ticks', 'timestamp', if_not_exists => TRUE);

-- Add index for symbol-based lookups
CREATE INDEX IF NOT EXISTS ix_symbol_timestamp ON market_ticks (symbol, timestamp DESC);

-- 2. Strategy Signals Table (AI Reasonings & Convictions)
CREATE TABLE IF NOT EXISTS strategy_signals (
    timestamp TIMESTAMPTZ NOT NULL,
    strategy_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    indicators JSONB DEFAULT '{}',
    ai_reasoning TEXT,
    conviction DOUBLE PRECISION DEFAULT 0.0
);

SELECT create_hypertable('strategy_signals', 'timestamp', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS ix_strat_symbol ON strategy_signals (strategy_id, symbol, timestamp DESC);

-- 3. Trade Registry (Canonical Execution Log)
CREATE TABLE IF NOT EXISTS trade_registry (
    timestamp TIMESTAMPTZ NOT NULL,
    trade_id INTEGER,
    strategy_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    charges DOUBLE PRECISION DEFAULT 0.0,
    pnl DOUBLE PRECISION DEFAULT 0.0,
    mode TEXT DEFAULT 'sandbox'
);

SELECT create_hypertable('trade_registry', 'timestamp', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS ix_trade_id ON trade_registry (trade_id, timestamp DESC);

-- --- RETENTION POLICIES ---

-- Prune raw market ticks older than 30 days to save space
SELECT add_retention_policy('market_ticks', INTERVAL '30 days', if_not_exists => TRUE);

-- Signals and Trades are permanent unless manually purged (Institutional record keeping)

-- --- COMPRESSION ---

-- Enable compression for old ticks (older than 7 days)
ALTER TABLE market_ticks SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol'
);

SELECT add_compression_policy('market_ticks', INTERVAL '7 days', if_not_exists => TRUE);
