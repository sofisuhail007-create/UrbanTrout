-- =====================================================
-- Farm Management Tables for Urban Trout Admin Panel
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- 1. Water Parameters - Daily water quality readings per tank
CREATE TABLE IF NOT EXISTS water_parameters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tank_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  dissolved_oxygen numeric NOT NULL DEFAULT 0,
  ammonia numeric NOT NULL DEFAULT 0,
  ph numeric NOT NULL DEFAULT 0,
  temperature numeric NOT NULL DEFAULT 0,
  nitrite numeric NOT NULL DEFAULT 0,
  nitrate numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 2. Feed Log - Daily feeding records
CREATE TABLE IF NOT EXISTS feed_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tank_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  feed_type text NOT NULL DEFAULT 'Grower',
  quantity_kg numeric NOT NULL DEFAULT 0,
  feeding_time text NOT NULL DEFAULT 'Morning',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 3. Tank Stocking - Stocking records per tank
CREATE TABLE IF NOT EXISTS tank_stocking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tank_id text NOT NULL,
  stocking_date date NOT NULL DEFAULT CURRENT_DATE,
  fish_count integer NOT NULL DEFAULT 0,
  avg_size_grams numeric NOT NULL DEFAULT 0,
  current_avg_size_grams numeric NOT NULL DEFAULT 0,
  mortality_count integer NOT NULL DEFAULT 0,
  feed_percentage numeric NOT NULL DEFAULT 0,
  batch_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wp_date ON water_parameters(date);
CREATE INDEX IF NOT EXISTS idx_wp_tank ON water_parameters(tank_id);
CREATE INDEX IF NOT EXISTS idx_fl_date ON feed_log(date);
CREATE INDEX IF NOT EXISTS idx_fl_tank ON feed_log(tank_id);
CREATE INDEX IF NOT EXISTS idx_ts_tank ON tank_stocking(tank_id);
CREATE INDEX IF NOT EXISTS idx_ts_status ON tank_stocking(status);
