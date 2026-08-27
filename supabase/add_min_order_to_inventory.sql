-- Run this in Supabase SQL Editor:
-- Go to https://supabase.com → Your Project → SQL Editor → New Query → Paste & Run

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS min_order_kg NUMERIC DEFAULT 1;

-- Update existing records to default 1 kg min order if null
UPDATE inventory SET min_order_kg = 1 WHERE min_order_kg IS NULL;
