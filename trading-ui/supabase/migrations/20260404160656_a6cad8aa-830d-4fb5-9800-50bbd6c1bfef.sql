
-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create broker status enum
CREATE TYPE public.broker_status AS ENUM ('connected', 'degraded', 'disconnected');

-- Create broker_connections table
CREATE TABLE public.broker_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_id TEXT NOT NULL,
  broker_name TEXT NOT NULL,
  status public.broker_status NOT NULL DEFAULT 'disconnected',
  credentials_encrypted BYTEA,
  latency_ms INTEGER DEFAULT 0,
  uptime_percent NUMERIC(5,2) DEFAULT 0,
  orders_today INTEGER DEFAULT 0,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, broker_id)
);

-- Enable Row Level Security
ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own broker connections
CREATE POLICY "Users can view their own broker connections"
  ON public.broker_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own broker connections"
  ON public.broker_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own broker connections"
  ON public.broker_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own broker connections"
  ON public.broker_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Encryption helper: encrypt credentials JSON
CREATE OR REPLACE FUNCTION public.encrypt_broker_credentials(
  p_credentials JSONB,
  p_encryption_key TEXT
)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgp_sym_encrypt(p_credentials::TEXT, p_encryption_key);
END;
$$;

-- Decryption helper: decrypt credentials back to JSON
CREATE OR REPLACE FUNCTION public.decrypt_broker_credentials(
  p_encrypted BYTEA,
  p_encryption_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgp_sym_decrypt(p_encrypted, p_encryption_key)::JSONB;
END;
$$;

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_broker_connections_updated_at
  BEFORE UPDATE ON public.broker_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_broker_connections_user_id ON public.broker_connections(user_id);
CREATE INDEX idx_broker_connections_broker_id ON public.broker_connections(broker_id);
