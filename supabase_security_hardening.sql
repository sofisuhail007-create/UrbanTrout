-- ====================================================================
-- URBAN TROUT - COMPREHENSIVE PRODUCTION SECURITY HARDENING (RLS)
-- Run this entire script in Supabase Dashboard -> SQL Editor
-- ====================================================================

-- STEP 1: CREATE THE ADMIN VERIFICATION FUNCTION FIRST
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- 1. Always allow server-side service role operations (Next.js backend API)
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  -- 2. Check authenticated Supabase user session
  IF auth.role() = 'authenticated' THEN
    user_email := lower(coalesce(auth.jwt() ->> 'email', ''));

    -- Check hardcoded owner emails
    IF user_email IN (
      'sofisuhail007@gmail.com',
      'info.urbantrout@gmail.com',
      'work.suhail007@gmail.com',
      'worksuhail007@gmail.com'
    ) THEN
      RETURN true;
    END IF;

    -- Check database whitelist if app_settings table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'app_settings'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM public.app_settings
        WHERE key = 'admin_whitelist'
        AND lower(value) LIKE '%' || user_email || '%'
      ) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- STEP 2: ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
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

-- STEP 3: DROP ALL OLD PERMISSIVE POLICIES
DROP POLICY IF EXISTS "Public access for orders" ON public.orders;
DROP POLICY IF EXISTS "Allow select orders" ON public.orders;
DROP POLICY IF EXISTS "Allow insert orders" ON public.orders;
DROP POLICY IF EXISTS "Allow update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow delete orders" ON public.orders;
DROP POLICY IF EXISTS "Admins and service_role can select orders" ON public.orders;
DROP POLICY IF EXISTS "Admins and service_role can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins and service_role can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins and service_role can delete orders" ON public.orders;

DROP POLICY IF EXISTS "Public access for customers" ON public.customers;
DROP POLICY IF EXISTS "Allow select customers" ON public.customers;
DROP POLICY IF EXISTS "Allow insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow update customers" ON public.customers;
DROP POLICY IF EXISTS "Allow delete customers" ON public.customers;
DROP POLICY IF EXISTS "Admins and service_role can select customers" ON public.customers;
DROP POLICY IF EXISTS "Admins and service_role can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admins and service_role can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins and service_role can delete customers" ON public.customers;

DROP POLICY IF EXISTS "Allow select inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow delete inventory" ON public.inventory;
DROP POLICY IF EXISTS "Public read inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admins and service_role can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admins and service_role can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admins and service_role can delete inventory" ON public.inventory;

DROP POLICY IF EXISTS "Allow select leads" ON public.leads;
DROP POLICY IF EXISTS "Allow insert leads" ON public.leads;
DROP POLICY IF EXISTS "Allow update leads" ON public.leads;
DROP POLICY IF EXISTS "Allow delete leads" ON public.leads;
DROP POLICY IF EXISTS "Public insert leads" ON public.leads;
DROP POLICY IF EXISTS "Admins and service_role can select leads" ON public.leads;
DROP POLICY IF EXISTS "Admins and service_role can update leads" ON public.leads;
DROP POLICY IF EXISTS "Admins and service_role can delete leads" ON public.leads;

DROP POLICY IF EXISTS "Allow select app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins and service_role can manage app_settings" ON public.app_settings;

DROP POLICY IF EXISTS "Admins and service_role can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins and service_role can manage customer_balances" ON public.customer_balances;

DROP POLICY IF EXISTS "Allow select water_parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Allow insert water_parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Allow update water_parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Allow delete water_parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Admins manage water_parameters" ON public.water_parameters;

DROP POLICY IF EXISTS "Allow select feed_log" ON public.feed_log;
DROP POLICY IF EXISTS "Allow insert feed_log" ON public.feed_log;
DROP POLICY IF EXISTS "Allow update feed_log" ON public.feed_log;
DROP POLICY IF EXISTS "Allow delete feed_log" ON public.feed_log;
DROP POLICY IF EXISTS "Admins manage feed_log" ON public.feed_log;

DROP POLICY IF EXISTS "Allow select tank_stocking" ON public.tank_stocking;
DROP POLICY IF EXISTS "Allow insert tank_stocking" ON public.tank_stocking;
DROP POLICY IF EXISTS "Allow update tank_stocking" ON public.tank_stocking;
DROP POLICY IF EXISTS "Allow delete tank_stocking" ON public.tank_stocking;
DROP POLICY IF EXISTS "Admins manage tank_stocking" ON public.tank_stocking;

DROP POLICY IF EXISTS "Allow select energy_log" ON public.energy_log;
DROP POLICY IF EXISTS "Allow insert energy_log" ON public.energy_log;
DROP POLICY IF EXISTS "Allow update energy_log" ON public.energy_log;
DROP POLICY IF EXISTS "Allow delete energy_log" ON public.energy_log;
DROP POLICY IF EXISTS "Admins manage energy_log" ON public.energy_log;

DROP POLICY IF EXISTS "Admins manage vending_sales_entries" ON public.vending_sales_entries;

-- STEP 4: APPLY SECURE PRODUCTION POLICIES

-- ── ORDERS (Zero Public Read/Write) ──────────────────────────────
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

-- ── CUSTOMERS (Zero Public Read/Write) ───────────────────────────
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

-- ── INVOICES & BALANCES ──────────────────────────────────────────
CREATE POLICY "Admins and service_role can manage invoices"
  ON public.invoices FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins and service_role can manage customer_balances"
  ON public.customer_balances FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ── INVENTORY (Public Read, Admin-only Write) ─────────────────────
CREATE POLICY "Public read inventory"
  ON public.inventory FOR SELECT
  USING (true);

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

-- ── LEADS ────────────────────────────────────────────────────────
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

-- ── APP SETTINGS (Public Read, Admin-only Write) ─────────────────
CREATE POLICY "Public read app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins and service_role can manage app_settings"
  ON public.app_settings FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ── FARM METRICS (Internal Only) ─────────────────────────────────
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
