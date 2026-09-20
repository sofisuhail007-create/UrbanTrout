-- ====================================================================
-- URBAN TROUT - ZERO-ERROR PRODUCTION SECURITY HARDENING (RLS)
-- Dynamically checks table existence so it never fails on missing tables.
-- Run this entire script in Supabase Dashboard -> SQL Editor.
-- ====================================================================

-- ── STEP 1: CREATE THE ADMIN VERIFICATION FUNCTION ──────────────────
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
  -- 1. Always allow server-side service role operations (Next.js backend APIs)
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

-- ── STEP 2: DYNAMICALLY APPLY RLS ONLY TO EXISTING TABLES ───────────
DO $$
DECLARE
  tbl text;
BEGIN
  -- 1. ORDERS (CRITICAL PRIVACY: No Public Read)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public access for orders" ON public.orders;
    DROP POLICY IF EXISTS "Allow select orders" ON public.orders;
    DROP POLICY IF EXISTS "Allow insert orders" ON public.orders;
    DROP POLICY IF EXISTS "Allow update orders" ON public.orders;
    DROP POLICY IF EXISTS "Allow delete orders" ON public.orders;
    DROP POLICY IF EXISTS "Admins and service_role can select orders" ON public.orders;
    DROP POLICY IF EXISTS "Admins and service_role can insert orders" ON public.orders;
    DROP POLICY IF EXISTS "Admins and service_role can update orders" ON public.orders;
    DROP POLICY IF EXISTS "Admins and service_role can delete orders" ON public.orders;

    CREATE POLICY "Admins and service_role can select orders" ON public.orders FOR SELECT USING (public.is_admin_user());
    CREATE POLICY "Admins and service_role can insert orders" ON public.orders FOR INSERT WITH CHECK (public.is_admin_user());
    CREATE POLICY "Admins and service_role can update orders" ON public.orders FOR UPDATE USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
    CREATE POLICY "Admins and service_role can delete orders" ON public.orders FOR DELETE USING (public.is_admin_user());
  END IF;

  -- 2. CUSTOMERS (CRITICAL PRIVACY: No Public Read)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public access for customers" ON public.customers;
    DROP POLICY IF EXISTS "Allow select customers" ON public.customers;
    DROP POLICY IF EXISTS "Allow insert customers" ON public.customers;
    DROP POLICY IF EXISTS "Allow update customers" ON public.customers;
    DROP POLICY IF EXISTS "Allow delete customers" ON public.customers;
    DROP POLICY IF EXISTS "Admins and service_role can select customers" ON public.customers;
    DROP POLICY IF EXISTS "Admins and service_role can insert customers" ON public.customers;
    DROP POLICY IF EXISTS "Admins and service_role can update customers" ON public.customers;
    DROP POLICY IF EXISTS "Admins and service_role can delete customers" ON public.customers;

    CREATE POLICY "Admins and service_role can select customers" ON public.customers FOR SELECT USING (public.is_admin_user());
    CREATE POLICY "Admins and service_role can insert customers" ON public.customers FOR INSERT WITH CHECK (public.is_admin_user());
    CREATE POLICY "Admins and service_role can update customers" ON public.customers FOR UPDATE USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
    CREATE POLICY "Admins and service_role can delete customers" ON public.customers FOR DELETE USING (public.is_admin_user());
  END IF;

  -- 3. INVENTORY (Public Read, Admin-Only Write)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory') THEN
    ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow select inventory" ON public.inventory;
    DROP POLICY IF EXISTS "Allow insert inventory" ON public.inventory;
    DROP POLICY IF EXISTS "Allow update inventory" ON public.inventory;
    DROP POLICY IF EXISTS "Allow delete inventory" ON public.inventory;
    DROP POLICY IF EXISTS "Public read inventory" ON public.inventory;
    DROP POLICY IF EXISTS "Admins and service_role can insert inventory" ON public.inventory;
    DROP POLICY IF EXISTS "Admins and service_role can update inventory" ON public.inventory;
    DROP POLICY IF EXISTS "Admins and service_role can delete inventory" ON public.inventory;

    CREATE POLICY "Public read inventory" ON public.inventory FOR SELECT USING (true);
    CREATE POLICY "Admins and service_role can insert inventory" ON public.inventory FOR INSERT WITH CHECK (public.is_admin_user());
    CREATE POLICY "Admins and service_role can update inventory" ON public.inventory FOR UPDATE USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
    CREATE POLICY "Admins and service_role can delete inventory" ON public.inventory FOR DELETE USING (public.is_admin_user());
  END IF;

  -- 4. LEADS (Public Insert via Checkout, Admin-Only Read/Modify)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow select leads" ON public.leads;
    DROP POLICY IF EXISTS "Allow insert leads" ON public.leads;
    DROP POLICY IF EXISTS "Allow update leads" ON public.leads;
    DROP POLICY IF EXISTS "Allow delete leads" ON public.leads;
    DROP POLICY IF EXISTS "Public insert leads" ON public.leads;
    DROP POLICY IF EXISTS "Admins and service_role can select leads" ON public.leads;
    DROP POLICY IF EXISTS "Admins and service_role can update leads" ON public.leads;
    DROP POLICY IF EXISTS "Admins and service_role can delete leads" ON public.leads;

    CREATE POLICY "Public insert leads" ON public.leads FOR INSERT WITH CHECK (true);
    CREATE POLICY "Admins and service_role can select leads" ON public.leads FOR SELECT USING (public.is_admin_user());
    CREATE POLICY "Admins and service_role can update leads" ON public.leads FOR UPDATE USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
    CREATE POLICY "Admins and service_role can delete leads" ON public.leads FOR DELETE USING (public.is_admin_user());
  END IF;

  -- 5. APP SETTINGS (Public Read, Admin-Only Write)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow select app_settings" ON public.app_settings;
    DROP POLICY IF EXISTS "Allow insert app_settings" ON public.app_settings;
    DROP POLICY IF EXISTS "Allow update app_settings" ON public.app_settings;
    DROP POLICY IF EXISTS "Public read app_settings" ON public.app_settings;
    DROP POLICY IF EXISTS "Admins and service_role can manage app_settings" ON public.app_settings;

    CREATE POLICY "Public read app_settings" ON public.app_settings FOR SELECT USING (true);
    CREATE POLICY "Admins and service_role can manage app_settings" ON public.app_settings FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
  END IF;

  -- 6. INVOICES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admins and service_role can manage invoices" ON public.invoices;
    CREATE POLICY "Admins and service_role can manage invoices" ON public.invoices FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
  END IF;

  -- 7. CUSTOMER BALANCES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_balances') THEN
    ALTER TABLE public.customer_balances ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admins and service_role can manage customer_balances" ON public.customer_balances;
    CREATE POLICY "Admins and service_role can manage customer_balances" ON public.customer_balances FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
  END IF;

  -- 8. FARM & OPTIONAL TABLES (water_parameters, feed_log, tank_stocking, energy_log, vending_sales_entries)
  FOREACH tbl IN ARRAY ARRAY['water_parameters', 'feed_log', 'tank_stocking', 'energy_log', 'vending_sales_entries'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Public access for %s" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow select %s" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow insert %s" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow update %s" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow delete %s" ON public.%I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Admins manage %s" ON public.%I', tbl, tbl);
      EXECUTE format('CREATE POLICY "Admins manage %s" ON public.%I FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user())', tbl, tbl);
    END IF;
  END LOOP;
END $$;
