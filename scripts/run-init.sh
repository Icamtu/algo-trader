#!/bin/bash
echo "Running database initialization..."

# Wait for database to be ready
until docker exec supabase-db pg_isready -U postgres; do
  echo "Waiting for database..."
  sleep 2
done

echo "Database ready. Creating tables..."

# Run the SQL
docker exec -i supabase-db psql -U postgres << 'SQL'
-- Broker Configurations
CREATE TABLE IF NOT EXISTS broker_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    broker_name TEXT,
    enc_password TEXT,
    enc_totp TEXT,
    enc_api_key TEXT,
    vendor_code TEXT,
    imei TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backtest Results
CREATE TABLE IF NOT EXISTS backtest_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    instrument TEXT,
    side TEXT,
    entry_price NUMERIC,
    exit_price NUMERIC,
    pnl NUMERIC,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Live Positions
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    qty NUMERIC NOT NULL,
    entry_price NUMERIC NOT NULL,
    ltp NUMERIC NOT NULL DEFAULT entry_price,
    strategy TEXT,
    inserted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    alert_type TEXT NOT NULL,
    symbol TEXT,
    condition TEXT NOT NULL,
    value NUMERIC,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    channel TEXT DEFAULT 'telegram',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    qty NUMERIC NOT NULL,
    entry_price NUMERIC NOT NULL,
    exit_price NUMERIC,
    pnl NUMERIC,
    pnl_pct NUMERIC,
    strategy TEXT,
    entry_time TIMESTAMPTZ NOT NULL,
    exit_time TIMESTAMPTZ,
    hold_time TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
SQL

echo "Done!"
