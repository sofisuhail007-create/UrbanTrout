-- =====================================================
-- Farm Analytics Updates
-- Run this SQL in Supabase SQL Editor
-- =====================================================

ALTER TABLE tank_stocking
ADD COLUMN IF NOT EXISTS fingerling_cost numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS feed_cost_per_kg numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_harvest_kg numeric,
ADD COLUMN IF NOT EXISTS harvest_date date;
