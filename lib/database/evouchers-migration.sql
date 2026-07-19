-- ============================================================
-- Migration: Create e-voucher tables for the Reward Bank feature
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. One row per monthly admin upload (audit trail for the Excel import)
CREATE TABLE IF NOT EXISTS public.evoucher_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  uploaded_by TEXT,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020),
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. One row per individual voucher (a link + amount parsed from the Excel file)
CREATE TABLE IF NOT EXISTS public.evouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denomination INTEGER NOT NULL CHECK (denomination > 0),
  voucher_code TEXT,
  row_index INTEGER,
  link TEXT NOT NULL,
  pin TEXT,
  expiry_date DATE,
  upload_batch_id UUID NOT NULL REFERENCES public.evoucher_uploads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'opened')),
  assigned_license_plate TEXT REFERENCES public.customers(license_plate) ON DELETE SET NULL,
  assigned_month INTEGER CHECK (assigned_month >= 1 AND assigned_month <= 12),
  assigned_year INTEGER CHECK (assigned_year >= 2020),
  assigned_rank INTEGER,
  assigned_at TIMESTAMPTZ,
  assigned_by TEXT,
  token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  first_opened_at TIMESTAMPTZ,
  open_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS evouchers_link_idx ON public.evouchers (link);
CREATE UNIQUE INDEX IF NOT EXISTS evouchers_token_idx ON public.evouchers (token);

-- One voucher per customer per period
CREATE UNIQUE INDEX IF NOT EXISTS evouchers_plate_month_year_idx
  ON public.evouchers (assigned_license_plate, assigned_month, assigned_year)
  WHERE assigned_license_plate IS NOT NULL;

-- 4. Query indexes
CREATE INDEX IF NOT EXISTS evouchers_inventory_idx ON public.evouchers (status, denomination);
CREATE INDEX IF NOT EXISTS evouchers_upload_batch_idx ON public.evouchers (upload_batch_id);

-- 5. Open-event audit log — every click on the "open voucher" link
CREATE TABLE IF NOT EXISTS public.evoucher_open_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evoucher_id UUID NOT NULL REFERENCES public.evouchers(id) ON DELETE CASCADE,
  license_plate TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS evoucher_open_logs_voucher_idx ON public.evoucher_open_logs (evoucher_id, opened_at DESC);

-- 6. Row Level Security
ALTER TABLE public.evoucher_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evoucher_open_logs ENABLE ROW LEVEL SECURITY;

-- evoucher_uploads: admin only (no customer-facing use)
CREATE POLICY "Admin full access on evoucher_uploads"
  ON public.evoucher_uploads
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- evouchers: admin full access
CREATE POLICY "Admin full access on evouchers"
  ON public.evouchers
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- evoucher_open_logs: admin full access (view logs)
CREATE POLICY "Admin full access on evoucher_open_logs"
  ON public.evoucher_open_logs
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- NOTE: there is deliberately no public/anon policy on evouchers or
-- evoucher_open_logs here. RLS filters rows, not query predicates, so a
-- "public read/update by token" policy shaped like USING (true) or
-- USING (status IN (...)) would make EVERY row visible/writable to anyone
-- holding the public anon key, regardless of which token they queried with
-- — evouchers holds real redeemable gift-card links + PINs, so that's a
-- direct data leak / hijack path, not just a theoretical one. Instead, run
-- evouchers-secure-token-access-migration.sql, which grants the public
-- (anon) role EXECUTE on three narrow SECURITY DEFINER functions
-- (get_evoucher_by_token, get_evoucher_for_plate_period,
-- open_evoucher_by_token) that only ever touch the single row matching the
-- token/plate+period the caller actually supplied as a function argument.
