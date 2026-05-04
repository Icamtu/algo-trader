-- Migration: Add AI settings to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{}'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN public.profiles.ai_settings IS 'Stored AI provider credentials and model preferences';
