-- ============================================================
-- Migration: Admin-configurable check-in rules (cooldown + daily limit)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Additive: does not modify charging_sessions / customers.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.checkin_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cooldown_minutes INTEGER NOT NULL DEFAULT 180 CHECK (cooldown_minutes >= 0),
  max_checkins_per_day INTEGER CHECK (max_checkins_per_day IS NULL OR max_checkins_per_day >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT checkin_settings_singleton CHECK (id = 1)
);

-- checkin_settings is read on EVERY public check-in submission (anon role,
-- unauthenticated visitor at the kiosk), unlike evoucher_tier_rules which is
-- admin-only. So RLS must allow public SELECT but restrict writes to admins.
ALTER TABLE public.checkin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkin_settings_public_read"
  ON public.checkin_settings
  FOR SELECT
  USING (true);

CREATE POLICY "checkin_settings_admin_write"
  ON public.checkin_settings
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Seed the single settings row with the current hardcoded default
-- (180 min cooldown, unlimited daily check-ins) so behavior is unchanged
-- until an admin edits it.
INSERT INTO public.checkin_settings (id, cooldown_minutes, max_checkins_per_day)
VALUES (1, 180, NULL)
ON CONFLICT (id) DO NOTHING;
