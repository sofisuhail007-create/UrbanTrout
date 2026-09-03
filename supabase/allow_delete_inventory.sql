-- ========================================================
-- URBAN TROUT - ALLOW DELETE INVENTORY POLICY
-- Run this in your Supabase SQL Editor if direct client RLS is active:
-- https://supabase.com/dashboard/project/_/sql
-- ========================================================

ALTER TABLE IF EXISTS public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow delete inventory" ON public.inventory;
CREATE POLICY "Allow delete inventory" ON public.inventory FOR DELETE USING (true);
