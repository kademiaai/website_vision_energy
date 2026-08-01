-- ============================================================
-- Migration: Admin-uploaded business metrics (revenue + kWh per period)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Additive: does not modify charging_sessions / customers.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.business_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period DATE NOT NULL,
  granularity TEXT NOT NULL CHECK (granularity IN ('day', 'week', 'month')),
  revenue_vnd NUMERIC NOT NULL CHECK (revenue_vnd >= 0),
  energy_kwh NUMERIC NOT NULL CHECK (energy_kwh >= 0),
  source_file_name TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period, granularity)
);

CREATE INDEX IF NOT EXISTS business_metrics_period_idx ON public.business_metrics (period, granularity);

-- Admin-only: never read from a public/customer-facing page (unlike
-- checkin_settings), so RLS is locked to authenticated for everything,
-- matching the evoucher_tier_rules precedent.
ALTER TABLE public.business_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on business_metrics"
  ON public.business_metrics
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
