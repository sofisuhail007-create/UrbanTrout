-- Run this in Supabase SQL Editor to fix leads not appearing in admin panel
-- Go to: https://supabase.com → Your Project → SQL Editor → New Query → Paste & Run

-- 1. Create leads table if it doesn't exist
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_locality TEXT,
  customer_address TEXT,
  customer_pincode TEXT,
  cart_items JSONB,
  estimated_total NUMERIC,
  status TEXT DEFAULT 'abandoned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 3. Allow public (anon key) to INSERT leads (checkout page creates them)
DROP POLICY IF EXISTS "Allow public lead insert" ON leads;
CREATE POLICY "Allow public lead insert" ON leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 4. Allow public to SELECT leads (checkout page reads its own lead by phone)
DROP POLICY IF EXISTS "Allow public lead select" ON leads;
CREATE POLICY "Allow public lead select" ON leads
  FOR SELECT TO anon, authenticated
  USING (true);

-- 5. Allow public to UPDATE leads (checkout updates status, e.g. abandoned → converted)
DROP POLICY IF EXISTS "Allow public lead update" ON leads;
CREATE POLICY "Allow public lead update" ON leads
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Done! Leads should now appear in the admin panel.
