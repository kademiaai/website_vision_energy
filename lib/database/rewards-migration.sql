-- ============================================================
-- Migration: Create `rewards` table for Monthly Rewards feature
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Create the rewards table
CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate TEXT NOT NULL REFERENCES public.customers(license_plate) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020),
  checkin_count INTEGER NOT NULL DEFAULT 0,
  id_card_photo_url TEXT,
  id_full_name TEXT,
  id_number TEXT,
  rewarded_at TIMESTAMPTZ,
  admin_notes TEXT,
  is_ocr_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'eligible' CHECK (status IN ('eligible', 'processing', 'completed', 'rejected')),
  token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Unique constraint: one reward per customer per month
CREATE UNIQUE INDEX IF NOT EXISTS rewards_plate_month_year_idx
  ON public.rewards (license_plate, month, year);

-- 3. Unique constraint: each token must be unique
CREATE UNIQUE INDEX IF NOT EXISTS rewards_token_idx
  ON public.rewards (token);

-- 4. Index for fast token lookups (customer portal)
CREATE INDEX IF NOT EXISTS rewards_token_lookup_idx
  ON public.rewards (token) WHERE status != 'completed';

-- 5. Index for leaderboard queries (admin dashboard)
CREATE INDEX IF NOT EXISTS rewards_period_idx
  ON public.rewards (month, year, status);

-- 6. Row Level Security
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do everything (authenticated users)
CREATE POLICY "Admin full access on rewards"
  ON public.rewards
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Public can read their own reward by token (for the portal)
CREATE POLICY "Public read own reward by token"
  ON public.rewards
  FOR SELECT
  USING (true);

-- Policy: Public can update their own reward (submit CCCD data)
CREATE POLICY "Public update own reward by token"
  ON public.rewards
  FOR UPDATE
  USING (status = 'eligible')
  WITH CHECK (status = 'processing');

-- ============================================================
-- Storage Bucket: verification-docs
-- Run this separately or create via Supabase Dashboard
-- Dashboard > Storage > New Bucket > "verification-docs" > Private
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('verification-docs', 'verification-docs', false);
