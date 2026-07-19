-- ============================================================
-- Migration: Lock down public access to evouchers via RPC functions
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
--
-- Why: the original policies in evouchers-migration.sql were
--   CREATE POLICY "Public read own evoucher by token" ... USING (true);
--   CREATE POLICY "Public update own evoucher by token" ... USING (status IN ('assigned','opened')) WITH CHECK (status = 'opened');
-- RLS filters rows, not query predicates — USING (true) makes every row
-- visible to the anon role regardless of what .eq('token', ...) filter the
-- app happens to apply, so anyone with the public anon key (visible in the
-- browser bundle) can run an unfiltered `select * from evouchers` and dump
-- every customer's redeemable link + PIN, or update ANY voucher by id
-- (reassign/hijack it) — not just the one row their token was meant to grant
-- access to. This migration removes those two policies and replaces the
-- public access paths with narrow SECURITY DEFINER functions that only ever
-- touch the single row matching the token/plate+period the caller supplied.
-- ============================================================

DROP POLICY IF EXISTS "Public read own evoucher by token" ON public.evouchers;
DROP POLICY IF EXISTS "Public update own evoucher by token" ON public.evouchers;

-- No longer needed: the open-log insert now happens inside open_evoucher_by_token
-- (SECURITY DEFINER, bypasses RLS) instead of a direct client-side insert.
DROP POLICY IF EXISTS "Public insert evoucher open log" ON public.evoucher_open_logs;

-- Look up a single voucher by its public token (used by /evouchers/[token] on load).
CREATE OR REPLACE FUNCTION public.get_evoucher_by_token(p_token TEXT)
RETURNS SETOF public.evouchers
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.evouchers WHERE token = p_token;
$$;

-- Look up the voucher assigned to a plate for a specific period (used by
-- the /rewards/[token] claim portal to also surface an assigned e-voucher).
CREATE OR REPLACE FUNCTION public.get_evoucher_for_plate_period(p_plate TEXT, p_month INTEGER, p_year INTEGER)
RETURNS SETOF public.evouchers
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.evouchers
  WHERE assigned_license_plate = p_plate AND assigned_month = p_month AND assigned_year = p_year;
$$;

-- Records a click on "open voucher": atomically flips assigned->opened (or
-- bumps open_count on re-open), writes the audit log row, and stamps the
-- matching reward's evoucher_opened_at — all as the function owner, so it
-- isn't blocked by the rewards table's own restrictive UPDATE policy
-- (which only allows the eligible->processing transition, not this one).
CREATE OR REPLACE FUNCTION public.open_evoucher_by_token(p_token TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS SETOF public.evouchers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_plate TEXT;
  v_month INTEGER;
  v_year INTEGER;
  v_reward_id UUID;
BEGIN
  SELECT id, assigned_license_plate, assigned_month, assigned_year
    INTO v_id, v_plate, v_month, v_year
    FROM public.evouchers WHERE token = p_token;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.evouchers
  SET status = 'opened',
      first_opened_at = COALESCE(first_opened_at, now()),
      open_count = open_count + 1
  WHERE id = v_id AND status IN ('assigned', 'opened');

  IF FOUND THEN
    INSERT INTO public.evoucher_open_logs (evoucher_id, license_plate, user_agent)
    VALUES (v_id, COALESCE(v_plate, ''), p_user_agent);

    IF v_plate IS NOT NULL AND v_month IS NOT NULL AND v_year IS NOT NULL THEN
      SELECT id INTO v_reward_id FROM public.rewards
        WHERE license_plate = v_plate AND month = v_month AND year = v_year;

      IF v_reward_id IS NOT NULL THEN
        UPDATE public.rewards SET evoucher_opened_at = now()
        WHERE id = v_reward_id AND evoucher_opened_at IS NULL;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM public.evouchers WHERE id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_evoucher_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_evoucher_for_plate_period(TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_evoucher_by_token(TEXT, TEXT) TO anon, authenticated;
