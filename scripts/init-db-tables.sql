-- AetherDesk Prime: UI Core Tables Initialization

-- 1. Broker Configurations
CREATE TABLE IF NOT EXISTS broker_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
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

-- Enable RLS for broker_configs
ALTER TABLE broker_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own configs
DROP POLICY IF EXISTS "Users can only see their own configs" ON broker_configs;
CREATE POLICY "Users can only see their own configs" ON broker_configs 
FOR ALL USING (auth.uid() = user_id);

-- 2. Backtest Results
CREATE TABLE IF NOT EXISTS backtest_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    instrument TEXT,
    side TEXT,
    entry_price NUMERIC,
    exit_price NUMERIC,
    pnl NUMERIC,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Enable RLS for backtest_results
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own results
DROP POLICY IF EXISTS "Users can only see their own results" ON backtest_results;
CREATE POLICY "Users can only see their own results" ON backtest_results 
FOR ALL USING (auth.uid() = user_id);

-- 3. Live Positions
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    qty NUMERIC NOT NULL,
    entry_price NUMERIC NOT NULL,
    ltp NUMERIC NOT NULL DEFAULT entry_price,
    strategy TEXT,
    inserted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for positions
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own positions
DROP POLICY IF EXISTS "Users can only see their own positions" ON positions;
CREATE POLICY "Users can only see their own positions" ON positions 
FOR ALL USING (auth.uid() = user_id);

-- 4. Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    alert_type TEXT NOT NULL,
    symbol TEXT,
    condition TEXT NOT NULL,
    value NUMERIC,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    channel TEXT DEFAULT 'telegram',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own alerts
DROP POLICY IF EXISTS "Users can only see their own alerts" ON alerts;
CREATE POLICY "Users can only see their own alerts" ON alerts 
FOR ALL USING (auth.uid() = user_id);

-- 5. Trade Journal
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
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

-- Enable RLS for trades
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own trades
DROP POLICY IF EXISTS "Users can only see their own trades" ON trades;
CREATE POLICY "Users can only see their own trades" ON trades 
FOR ALL USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
