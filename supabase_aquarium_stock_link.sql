-- =========================================================================
-- URBAN TROUT — AQUARIUM STOCK → PRODUCT INVENTORY LINKAGE
-- Creates a view that exposes total available aquarium biomass.
-- Both "whole-trout" and "gutted-trout" products draw stock from this pool
-- since they are the same fish — one left whole, one cleaned & gutted.
--
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- View: aquarium_available_stock
-- Returns the total weight_kg logged in the aquarium_stock_log.
-- Logic: SUM of ALL weight_kg entries = total biomass procured.
-- Admin logs fresh batches whenever new fish arrive from Khyber Aquaculture.
-- The latest cumulative total is the shared pool available for both products.

CREATE OR REPLACE VIEW public.aquarium_available_stock AS
SELECT
  COALESCE(SUM(weight_kg), 0)::NUMERIC(10, 3) AS total_available_kg,
  COUNT(*)                                      AS batch_count,
  MAX(stock_date)                               AS last_stocked_date,
  MAX(created_at)                               AS last_stocked_at
FROM public.aquarium_stock_log;

-- Grant public read access (matches the table's RLS policy)
GRANT SELECT ON public.aquarium_available_stock TO anon;
GRANT SELECT ON public.aquarium_available_stock TO authenticated;

-- =========================================================================
-- OPTIONAL: If you want per-day totals (useful for admin dashboards later)
-- =========================================================================
CREATE OR REPLACE VIEW public.aquarium_stock_by_date AS
SELECT
  stock_date,
  supplier_name,
  SUM(weight_kg) AS total_kg,
  SUM(total_cost) AS total_cost,
  COUNT(*) AS batches
FROM public.aquarium_stock_log
GROUP BY stock_date, supplier_name
ORDER BY stock_date DESC;

GRANT SELECT ON public.aquarium_stock_by_date TO anon;
GRANT SELECT ON public.aquarium_stock_by_date TO authenticated;
