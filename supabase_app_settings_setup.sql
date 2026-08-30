-- ========================================================
-- URBAN TROUT APP_SETTINGS TABLE SETUP
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ========================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to settings
CREATE POLICY "Allow public read access to app_settings" 
ON public.app_settings FOR SELECT USING (true);

-- Allow authenticated/service role insert/update
CREATE POLICY "Allow all access to app_settings" 
ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('delivery_radius_km', '3', 'Deliverable radius in KM from Urban Trout Farm base for free live harvest dispatch'),
    ('farm_latitude', '34.144709', 'Latitude coordinate of Urban Trout Farm Hub'),
    ('farm_longitude', '74.824525', 'Longitude coordinate of Urban Trout Farm Hub'),
    ('farm_address_label', 'Urban Trout Farm (Malabagh, Naseem Bagh, Srinagar)', 'Label and physical landmark of Urban Trout Farm Center'),
    ('delivery_fee_outside_5km', '40', 'Delivery fee surcharge for orders beyond deliverable radius in Srinagar'),
    ('allow_outside_radius_delivery', 'false', 'Whether customer checkout permits orders outside delivery radius with fee'),
    ('max_dispatch_mins', '60', 'Target live dispatch delivery turnaround time in minutes'),
    ('upi_id', 'urbantrout@ybl', 'Primary UPI ID for customer QR code payments'),
    ('primary_phone', '+918491006127', 'Primary customer support and WhatsApp order hotline'),
    ('alternate_phone', '+917006604148', 'Alternate staff emergency contact phone'),
    ('email', 'info.urbantrout@gmail.com', 'Official farm customer support email')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();
