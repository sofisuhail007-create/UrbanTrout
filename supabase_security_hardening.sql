-- ====================================================================
-- URBAN TROUT - COMPREHENSIVE PRODUCTION SECURITY HARDENING (RLS)
-- Run this script in the Supabase Dashboard -> SQL Editor.
-- Target: Zero Public Data Exposure, Protection against Price & Data Tampering
-- ====================================================================

-- 1. Enable Row Level Security (RLS) across all tables
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.water_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.feed_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tank_stocking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.energy_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vending_sales_entries ENABLE ROW LEVEL SECURITY;

-- 2. Drop all previous permissive policies
DROP POLICY IF EXISTS "Public access for orders" ON public.orders;
DROP POLICY IF EXISTS "Allow select orders" ON public.orders;
DROP POLICY IF EXISTS "Allow insert orders" ON public.orders;
DROP POLICY IF EXISTS "Allow update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow delete orders" ON public.orders;

DROP POLICY IF EXISTS "Public access for customers" ON public.customers;
DROP POLICY IF EXISTS "Allow select customers" ON public.customers;
DROP POLICY IF EXISTS "Allow insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow update customers" ON public.customers;
DROP POLICY IF EXISTS "Allow delete customers" ON public.customers;

DROP POLICY IF EXISTS "Allow select inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow delete inventory" ON public.inventory;

DROP POLICY IF EXISTS "Allow select leads" ON public.leads;
DROP POLICY IF EXISTS "Allow insert leads" ON public.leads;
DROP POLICY IF EXISTS "Allow update leads" ON public.leads;
DROP POLICY IF EXISTS "Allow delete leads" ON public.leads;

DROP POLICY IF EXISTS "Allow select app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow update app_settings" ON public.app_settings;

DROP POLICY IF EXISTS "Allow select water_parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Allow insert water_parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Allow update water_parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Allow delete water_parameters" ON public.water_parameters;

DROP POLICY IF EXISTS "Allow select feed_log" ON public.feed_log;
DROP POLICY IF EXISTS "Allow insert feed_log" ON public.feed_log;
DROP POLICY IF EXISTS "Allow update feed_log" ON public.feed_log;
DROP POLICY IF EXISTS "Allow delete feed_log" ON public.feed_log;

DROP POLICY IF EXISTS "Allow select tank_stocking" ON public.tank_stocking;
DROP POLICY IF EXISTS "Allow insert tank_stocking" ON public.tank_stocking;
DROP POLICY IF EXISTS "Allow update tank_stocking" ON public.tank_stocking;
DROP POLICY IF EXISTS "Allow delete tank_stocking" ON public.tank_stocking;

DROP POLICY IF EXISTS "Allow select energy_log" ON public.energy_log;
DROP POLICY IF EXISTS "Allow insert energy_log" ON public.energy_log;
DROP POLICY IF EXISTS "Allow update energy_log" ON public.energy_log;
DROP POLICY IF EXISTS "Allow delete energy_log" ON public.energy_log;

-- Helper function: verify if current authenticated user is an authorized admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND (
        lower(coalesce(auth.jwt() ->> 'email', '')) IN (
          'sofisuhail007@gmail.com',
          'info.urbantrout@gmail.com',
          'work.suhail007@gmail.com',
          'worksuhail007@gmail.com'
        )
        OR EXISTS (
          SELECT 1 FROM public.app_settings
          WHERE key = 'admin_whitelist'
          AND lower(value) LIKE '%' || lower(coalesce(auth.jwt() ->> 'email', '')) || '%'
        )
      )
    )
  );
$$;

-- ── 3. ORDERS (CRITICAL PRIVACY: NO PUBLIC READ) ───────────────────
-- Public cannot read or modify orders; only authenticated admins or backend service_role can access.
CREATE POLICY "Admins and service_role can select orders"
  ON public.orders FOR SELECT
  USING (public.is_admin_user());

CREATE POLICY "Admins and service_role can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins and service_role can update orders"
  ON public.orders FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins and service_role can delete orders"
  ON public.orders FOR DELETE
  USING (public.is_admin_user());

-- ── 4. CUSTOMERS (CRITICAL PRIVACY: NO PUBLIC READ) ────────────────
CREATE POLICY "Admins and service_role can select customers"
  ON public.customers FOR SELECT
  USING (public.is_admin_user());

CREATE POLICY "Admins and service_role can insert customers"
  ON public.customers FOR INSERT
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins and service_role can update customers"
  ON public.customers FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins and service_role can delete customers"
  ON public.customers FOR DELETE
  USING (public.is_admin_user());

-- ── 5. INVOICES & CUSTOMER BALANCES (FINANCIAL INTEGRITY) ──────────
CREATE POLICY "Admins and service_role can manage invoices"
  ON public.invoices FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins and service_role can manage customer_balances"
  ON public.customer_balances FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ── 6. INVENTORY (PUBLIC READ, ADMIN-ONLY WRITE) ────────────────────
-- Public can view catalog and prices in shop
CREATE POLICY "Public read inventory"
  ON public.inventory FOR SELECT
  USING (true);

-- Only admins/service_role can change prices or stock
CREATE POLICY "Admins and service_role can insert inventory"
  ON public.inventory FOR INSERT
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins and service_role can update inventory"
  ON public.inventory FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins and service_role can delete inventory"
  ON public.inventory FOR DELETE
  USING (public.is_admin_user());

-- ── 7. LEADS (PUBLIC INSERT VIA CHECKOUT, ADMIN READ) ──────────────
CREATE POLICY "Public insert leads"
  ON public.leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins and service_role can select leads"
  ON public.leads FOR SELECT
  USING (public.is_admin_user());

CREATE POLICY "Admins and service_role can update leads"
  ON public.leads FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins and service_role can delete leads"
  ON public.leads FOR DELETE
  USING (public.is_admin_user());

-- ── 8. APP SETTINGS (PUBLIC READ CONFIG, ADMIN-ONLY WRITE) ──────────
CREATE POLICY "Public read app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins and service_role can manage app_settings"
  ON public.app_settings FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ── 9. FARM METRICS (INTERNAL ONLY) ─────────────────────────────────
CREATE POLICY "Admins manage water_parameters"
  ON public.water_parameters FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage feed_log"
  ON public.feed_log FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage tank_stocking"
  ON public.tank_stocking FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage energy_log"
  ON public.energy_log FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage vending_sales_entries"
  ON public.vending_sales_entries FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Verification helper: check active policies
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
