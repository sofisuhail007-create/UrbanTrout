-- ==============================================================================
-- AQUARIUM LIVE FISH MORTALITY & WASTAGE LOG TABLE
-- ==============================================================================
-- Run this script in your Supabase SQL Editor if you wish to maintain a dedicated
-- relational table for aquarium fish mortality records.
-- Note: The system operates safely even without this table via automatic app_settings fallback.

CREATE TABLE IF NOT EXISTS public.aquarium_mortality_log (
  id TEXT PRIMARY KEY,
  mortality_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mortality_time TEXT NOT NULL DEFAULT '',
  weight_kg NUMERIC(8, 3) NOT NULL CHECK (weight_kg > 0),
  fish_count INTEGER NOT NULL DEFAULT 1 CHECK (fish_count > 0),
  reason TEXT NOT NULL DEFAULT 'Natural Mortality',
  notes TEXT,
  logged_by TEXT DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast date querying
CREATE INDEX IF NOT EXISTS idx_aquarium_mortality_date ON public.aquarium_mortality_log(mortality_date DESC);
CREATE INDEX IF NOT EXISTS idx_aquarium_mortality_created ON public.aquarium_mortality_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.aquarium_mortality_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users and service roles full access
CREATE POLICY "Allow full access to aquarium_mortality_log"
  ON public.aquarium_mortality_log
  FOR ALL
  USING (true)
  WITH CHECK (true);
