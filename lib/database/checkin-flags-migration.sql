-- ============================================================
-- Migration: Anomaly-detection flags for the "Cảnh báo bất thường" dashboard
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Additive: does not modify charging_sessions / customers.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.checkin_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate TEXT NOT NULL REFERENCES public.customers(license_plate) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('rate_change', 'velocity', 'off_pattern_hour', 'new_account_burst')),
  flagged_at TIMESTAMPTZ NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('cao', 'trung_binh', 'thap')),
  -- Flag-type-specific numbers backing the one-line reason (each flag type
  -- has different fields, so JSONB avoids a wide mostly-null table).
  detail JSONB NOT NULL,
  reviewer_status TEXT NOT NULL DEFAULT 'pending' CHECK (reviewer_status IN ('pending', 'reviewed', 'dismissed', 'whitelisted')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Re-running detection must not create duplicate flags for the same event.
  UNIQUE (license_plate, flag_type, flagged_at)
);

CREATE INDEX IF NOT EXISTS checkin_flags_flagged_at_idx ON public.checkin_flags (flagged_at DESC);
CREATE INDEX IF NOT EXISTS checkin_flags_status_idx ON public.checkin_flags (reviewer_status);

-- Admin-only: never read from a public/customer-facing page.
ALTER TABLE public.checkin_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on checkin_flags"
  ON public.checkin_flags
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
