-- ==============================================================================
-- URBAN TROUT - VENDING CENTER OPERATIONAL EXPENSES SCHEMA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.vending_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_time TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL, -- 'Ice & Cold Storage', 'Packaging & Bags', 'Cleaning & Sanitation', 'Transport & Fuel', 'Electricity & Utilities', 'Refreshments & Tea', 'Equipment & Maintenance', 'Other'
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'Cash', -- 'Cash', 'UPI', 'Bank', 'Other'
  logged_by TEXT NOT NULL DEFAULT 'Staff',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy period filtering (today, week, month, range)
CREATE INDEX IF NOT EXISTS idx_vending_expenses_date ON public.vending_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_vending_expenses_created ON public.vending_expenses(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.vending_expenses ENABLE ROW LEVEL SECURITY;

-- Drop any previous conflicting policies
DROP POLICY IF EXISTS "Allow select vending_expenses" ON public.vending_expenses;
DROP POLICY IF EXISTS "Allow insert vending_expenses" ON public.vending_expenses;
DROP POLICY IF EXISTS "Allow update vending_expenses" ON public.vending_expenses;
DROP POLICY IF EXISTS "Allow delete vending_expenses" ON public.vending_expenses;

-- Permissive policies for authenticated admin/service role
CREATE POLICY "Allow select vending_expenses" ON public.vending_expenses FOR SELECT USING (true);
CREATE POLICY "Allow insert vending_expenses" ON public.vending_expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update vending_expenses" ON public.vending_expenses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete vending_expenses" ON public.vending_expenses FOR DELETE USING (true);
