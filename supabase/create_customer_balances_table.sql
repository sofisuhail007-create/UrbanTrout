-- =========================================================================
-- CUSTOMER BALANCES & KHATA LEDGER TABLE
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.customer_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'settled', 'waived_final'
    payment_method TEXT DEFAULT 'Cash',
    settlement_note TEXT,
    items_summary TEXT,
    razorpay_payment_link_id TEXT,
    razorpay_payment_link_url TEXT,
    razorpay_qr_id TEXT,
    last_reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_customer_balances_status ON public.customer_balances(status);
CREATE INDEX IF NOT EXISTS idx_customer_balances_phone ON public.customer_balances(customer_phone);
CREATE INDEX IF NOT EXISTS idx_customer_balances_invoice ON public.customer_balances(invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_balances_created ON public.customer_balances(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.customer_balances ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to customer_balances"
ON public.customer_balances FOR SELECT USING (true);

-- Allow full access for insert/update/delete
CREATE POLICY "Allow full access to customer_balances"
ON public.customer_balances FOR ALL USING (true) WITH CHECK (true);
