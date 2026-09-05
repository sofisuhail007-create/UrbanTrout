-- =========================================================================
-- URBAN TROUT VENDING CENTER SALES DATA LOGGER TABLE
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.vending_sales_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_time TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM'),
    weight_kg NUMERIC(10, 3) NOT NULL,
    product_type TEXT NOT NULL DEFAULT 'Gutted', -- 'Gutted', 'Non Gutted', etc.
    rate_per_kg NUMERIC(10, 2) NOT NULL DEFAULT 580.00,
    expected_amount NUMERIC(10, 2),
    amount_paid NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    payment_mode TEXT NOT NULL DEFAULT 'Cash', -- 'Cash', 'Online Payment'
    custom_fields JSONB DEFAULT '{}'::jsonb, -- Flexible key-value store for user-added columns
    logged_by TEXT DEFAULT 'Counter Staff',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes for Day / Week / Month KPI aggregations
CREATE INDEX IF NOT EXISTS idx_vending_sales_date ON public.vending_sales_log(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_vending_sales_created ON public.vending_sales_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vending_sales_type ON public.vending_sales_log(product_type);
CREATE INDEX IF NOT EXISTS idx_vending_sales_payment ON public.vending_sales_log(payment_mode);

-- Enable Row Level Security
ALTER TABLE public.vending_sales_log ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to vending_sales_log"
ON public.vending_sales_log FOR SELECT USING (true);

-- Allow full access for insert/update/delete
CREATE POLICY "Allow full access to vending_sales_log"
ON public.vending_sales_log FOR ALL USING (true) WITH CHECK (true);

-- Settings record for dynamic custom column schemas
INSERT INTO public.app_settings (key, value, description)
VALUES (
    'vending_custom_columns',
    '[]',
    'Schema configuration for user-defined dynamic columns in Vending Center Logger'
)
ON CONFLICT (key) DO NOTHING;
