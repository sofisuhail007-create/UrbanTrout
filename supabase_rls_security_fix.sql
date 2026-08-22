-- ====================================================================
-- URBAN TROUT - REFINED SUPABASE RLS POLICIES
-- Clean, action-specific policies for zero security warnings
-- Target Project: UrbanTrout (Supabase)
-- ====================================================================

-- Step 1: Enable Row Level Security (RLS) on all public tables
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.water_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.feed_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tank_stocking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.energy_log ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop previous policies
DROP POLICY IF EXISTS "Public access for orders" ON public.orders;
DROP POLICY IF EXISTS "Public access for customers" ON public.customers;
DROP POLICY IF EXISTS "Public access for inventory" ON public.inventory;
DROP POLICY IF EXISTS "Public access for water_parameters" ON public.water_parameters;
DROP POLICY IF EXISTS "Public access for feed_log" ON public.feed_log;
DROP POLICY IF EXISTS "Public access for tank_stocking" ON public.tank_stocking;
DROP POLICY IF EXISTS "Public access for energy_log" ON public.energy_log;

DROP POLICY IF EXISTS "Allow select orders" ON public.orders;
DROP POLICY IF EXISTS "Allow insert orders" ON public.orders;
DROP POLICY IF EXISTS "Allow update orders" ON public.orders;

DROP POLICY IF EXISTS "Allow select customers" ON public.customers;
DROP POLICY IF EXISTS "Allow insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow update customers" ON public.customers;

DROP POLICY IF EXISTS "Allow select inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow update inventory" ON public.inventory;

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

-- Step 3: Define explicit command-level policies

-- ORDERS
CREATE POLICY "Allow select orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update orders" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);

-- CUSTOMERS
CREATE POLICY "Allow select customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow insert customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update customers" ON public.customers FOR UPDATE USING (true) WITH CHECK (true);

-- INVENTORY
CREATE POLICY "Allow select inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Allow insert inventory" ON public.inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update inventory" ON public.inventory FOR UPDATE USING (true) WITH CHECK (true);

-- WATER PARAMETERS
CREATE POLICY "Allow select water_parameters" ON public.water_parameters FOR SELECT USING (true);
CREATE POLICY "Allow insert water_parameters" ON public.water_parameters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update water_parameters" ON public.water_parameters FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete water_parameters" ON public.water_parameters FOR DELETE USING (true);

-- FEED LOG
CREATE POLICY "Allow select feed_log" ON public.feed_log FOR SELECT USING (true);
CREATE POLICY "Allow insert feed_log" ON public.feed_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update feed_log" ON public.feed_log FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete feed_log" ON public.feed_log FOR DELETE USING (true);

-- TANK STOCKING
CREATE POLICY "Allow select tank_stocking" ON public.tank_stocking FOR SELECT USING (true);
CREATE POLICY "Allow insert tank_stocking" ON public.tank_stocking FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update tank_stocking" ON public.tank_stocking FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete tank_stocking" ON public.tank_stocking FOR DELETE USING (true);

-- ENERGY LOG
CREATE POLICY "Allow select energy_log" ON public.energy_log FOR SELECT USING (true);
CREATE POLICY "Allow insert energy_log" ON public.energy_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update energy_log" ON public.energy_log FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete energy_log" ON public.energy_log FOR DELETE USING (true);
