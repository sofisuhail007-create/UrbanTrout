-- =========================================================================
-- URBAN TROUT AQUARIUM BIOMASS STOCK LOG TABLE
-- Tracks biomass procured from external suppliers (e.g. Khyber Aquaculture)
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.aquarium_stock_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_date DATE NOT NULL DEFAULT CURRENT_DATE,
    stock_time TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM'),
    supplier_name TEXT NOT NULL DEFAULT 'Khyber Aquaculture',
    product_type TEXT NOT NULL DEFAULT 'Non Gutted', -- 'Gutted' | 'Non Gutted'
    weight_kg NUMERIC(10, 3) NOT NULL,
    cost_per_kg NUMERIC(10, 2) NOT NULL DEFAULT 350.00,
    total_cost NUMERIC(10, 2) GENERATED ALWAYS AS (weight_kg * cost_per_kg) STORED,
    batch_notes TEXT,
    logged_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_aq_stock_date ON public.aquarium_stock_log(stock_date DESC);
CREATE INDEX IF NOT EXISTS idx_aq_stock_supplier ON public.aquarium_stock_log(supplier_name);
CREATE INDEX IF NOT EXISTS idx_aq_stock_type ON public.aquarium_stock_log(product_type);

-- Enable Row Level Security
ALTER TABLE public.aquarium_stock_log ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to aquarium_stock_log"
ON public.aquarium_stock_log FOR SELECT USING (true);

-- Allow full access for insert/update/delete
CREATE POLICY "Allow full access to aquarium_stock_log"
ON public.aquarium_stock_log FOR ALL USING (true) WITH CHECK (true);
