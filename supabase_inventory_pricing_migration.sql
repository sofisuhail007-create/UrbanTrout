-- ========================================================
-- URBAN TROUT INVENTORY PRICING & MRP MIGRATION
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ========================================================

-- 1. Add original_price_per_kg (strikethrough / MRP price)
ALTER TABLE IF EXISTS inventory 
ADD COLUMN IF NOT EXISTS original_price_per_kg NUMERIC DEFAULT 650;

-- 2. Add min_order_kg (minimum order quantity) if not already present
ALTER TABLE IF EXISTS inventory 
ADD COLUMN IF NOT EXISTS min_order_kg NUMERIC DEFAULT 2;

-- 3. Update existing records with default original prices and min order quantities
UPDATE inventory 
SET original_price_per_kg = 650, min_order_kg = 2 
WHERE product_id = 'gutted-trout';

UPDATE inventory 
SET original_price_per_kg = 600, min_order_kg = 2 
WHERE product_id = 'whole-trout';
