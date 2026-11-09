-- =========================================================================
-- FIX: Supabase Database Linter — Security Definer Views Warning
-- Converts public.aquarium_available_stock and public.aquarium_stock_by_date
-- from SECURITY DEFINER (default) to SECURITY INVOKER (Postgres 15+).
--
-- Why: Views without `security_invoker = true` run under the privileges
-- of the view creator/superuser, bypassing the caller's RLS policies.
-- Setting `security_invoker = true` ensures queries on the view enforce
-- the RLS policies and permissions of the user making the query.
--
-- Instructions: Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wotrwssjjmptivzazoxm/sql
-- =========================================================================

-- In-place instant fix:
ALTER VIEW IF EXISTS public.aquarium_available_stock SET (security_invoker = true);
ALTER VIEW IF EXISTS public.aquarium_stock_by_date SET (security_invoker = true);

-- Re-verify explicit grants
GRANT SELECT ON public.aquarium_available_stock TO anon, authenticated;
GRANT SELECT ON public.aquarium_stock_by_date TO anon, authenticated;

-- Verification query (Both should return security_invoker = true)
SELECT
  c.relname AS view_name,
  c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('aquarium_available_stock', 'aquarium_stock_by_date');
