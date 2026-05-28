-- =====================================================
-- Farm Energy & Utilities Log
-- Run this SQL in Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS energy_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL DEFAULT CURRENT_DATE,
  expense_type text NOT NULL, -- 'Diesel' or 'Electricity'
  quantity numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_el_date ON energy_log(date);
CREATE INDEX IF NOT EXISTS idx_el_type ON energy_log(expense_type);
