-- Run this in Supabase SQL Editor:
-- Go to https://supabase.com → Your Project → SQL Editor → New Query → Paste & Run

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours')
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon key) to INSERT invoices (billing staff at counter)
CREATE POLICY "Allow public invoice insert" ON invoices
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow anyone to READ invoices (customers clicking the link)
CREATE POLICY "Allow public invoice select" ON invoices
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow invoice deletion after expiry (cleanup, optional)
CREATE POLICY "Allow public invoice delete" ON invoices
  FOR DELETE TO anon, authenticated
  USING (expires_at < NOW());
