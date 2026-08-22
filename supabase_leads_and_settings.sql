-- ====================================================================
-- URBAN TROUT - LEADS & APP SETTINGS TABLES
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/wotrwssjjmptivzazoxm/sql
-- ====================================================================

-- 1. Create LEADS table for capturing abandoned checkouts
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_locality TEXT,
    customer_address TEXT,
    customer_pincode TEXT,
    cart_items JSONB DEFAULT '[]'::jsonb,
    estimated_total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'abandoned', -- 'abandoned', 'contacted', 'converted', 'lost'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create APP_SETTINGS table for configurable UPI ID & store settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default UPI ID
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('upi_id', 'sofisuhail007@ybl', 'Primary UPI ID for customer direct checkout payments'),
    ('primary_phone', '+918491006127', 'Primary WhatsApp and contact phone number'),
    ('delivery_fee_outside_5km', '40', 'Delivery fee for orders beyond 5km in Srinagar')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = now();

-- 3. Enable RLS on newly created tables
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_settings ENABLE ROW LEVEL SECURITY;

-- 4. Create action-specific RLS policies for LEADS
DROP POLICY IF EXISTS "Allow select leads" ON public.leads;
DROP POLICY IF EXISTS "Allow insert leads" ON public.leads;
DROP POLICY IF EXISTS "Allow update leads" ON public.leads;
DROP POLICY IF EXISTS "Allow delete leads" ON public.leads;

CREATE POLICY "Allow select leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Allow insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update leads" ON public.leads FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete leads" ON public.leads FOR DELETE USING (true);

-- 5. Create action-specific RLS policies for APP_SETTINGS
DROP POLICY IF EXISTS "Allow select app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow update app_settings" ON public.app_settings;

CREATE POLICY "Allow select app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow insert app_settings" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update app_settings" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true);
