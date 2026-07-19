-- ============================================================
-- Migration: Configurable rank -> denomination tier rules for e-vouchers
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Additive: does not modify evouchers-migration.sql's tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.evoucher_tier_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_rank INTEGER NOT NULL CHECK (min_rank >= 1),
  max_rank INTEGER NOT NULL CHECK (max_rank >= min_rank),
  denomination INTEGER NOT NULL CHECK (denomination > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evoucher_tier_rules_rank_idx ON public.evoucher_tier_rules (min_rank, max_rank);

-- Admin-only: this table is never read from a public/customer-facing page.
ALTER TABLE public.evoucher_tier_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on evoucher_tier_rules"
  ON public.evoucher_tier_rules
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Seed the current defaults so the settings table isn't empty on first load.
INSERT INTO public.evoucher_tier_rules (min_rank, max_rank, denomination)
SELECT * FROM (VALUES (1, 5, 200000), (6, 15, 100000)) AS defaults(min_rank, max_rank, denomination)
WHERE NOT EXISTS (SELECT 1 FROM public.evoucher_tier_rules);
