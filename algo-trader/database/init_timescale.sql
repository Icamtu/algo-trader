-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 1. Market Ticks Table
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

-- 2. Strategy Signals Table
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
    pnl DOUBLE PRECISION DEFAULT 0.0,
    mode TEXT DEFAULT 'sandbox'
);

SELECT create_hypertable('trade_registry', 'timestamp', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS ix_trade_id ON trade_registry (trade_id, timestamp DESC);

-- Continuous Aggregates (Example: 1m OHLC from Ticks)
-- CREATE MATERIALIZED VIEW candle_1m
-- WITH (timescaledb.continuous) AS
-- SELECT time_bucket('1 minute', timestamp) AS bucket,
--        symbol,
--        first(price, timestamp) as open,
--        max(price) as high,
--        min(price) as low,
--        last(price, timestamp) as close,
--        sum(quantity) as volume
-- FROM market_ticks
-- GROUP BY bucket, symbol;
