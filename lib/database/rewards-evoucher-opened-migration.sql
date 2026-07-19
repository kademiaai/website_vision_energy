-- ============================================================
-- Migration: Track e-voucher open events on the rewards table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Records when the customer opened their assigned e-voucher for this
-- reward period — a "Đã mở quà" stage shown alongside the existing
-- rewards.status lifecycle (eligible/processing/completed/rejected).
-- Set once (first open) by evoucherService.logOpen via rewardService.markEvoucherOpened.
ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS evoucher_opened_at TIMESTAMPTZ;
