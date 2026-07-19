// @/lib/types/evoucher.ts
// TypeScript interfaces for the E-voucher (Reward Bank) feature

export type VoucherStatus = 'available' | 'assigned' | 'opened';

export interface EVoucher {
  id: string;
  denomination: number;
  voucher_code: string | null;
  row_index: number | null;
  link: string;
  pin: string | null;
  expiry_date: string | null;
  upload_batch_id: string;
  status: VoucherStatus;
  assigned_license_plate: string | null;
  assigned_month: number | null;
  assigned_year: number | null;
  assigned_rank: number | null;
  assigned_at: string | null;
  assigned_by: string | null;
  token: string;
  first_opened_at: string | null;
  open_count: number;
  created_at: string;
}

export interface EVoucherUpload {
  id: string;
  file_name: string;
  uploaded_by: string | null;
  month: number;
  year: number;
  total_rows: number;
  inserted_count: number;
  duplicate_count: number;
  error_count: number;
  created_at: string;
}

export interface EVoucherOpenLog {
  id: string;
  evoucher_id: string;
  license_plate: string;
  opened_at: string;
  user_agent: string | null;
}

/**
 * A single row parsed out of the uploaded Excel file, before it's
 * persisted to the database.
 */
export interface ParsedVoucherRow {
  denomination: number;
  voucher_code: string;
  row_index: number;
  link: string;
  pin: string | null;
  expiry_date: string | null; // ISO date (YYYY-MM-DD), or null if unparsable
}

/**
 * Result of decrypting + parsing an uploaded Excel file (no DB writes yet).
 */
export interface ParseVoucherFileResult {
  success: boolean;
  message: string;
  fileName?: string;
  rows?: ParsedVoucherRow[];
}

/**
 * Result of persisting parsed rows into the evouchers table.
 */
export interface ImportVoucherResult {
  success: boolean;
  message: string;
  uploadId?: string;
  totalRows: number;
  insertedCount: number;
  duplicateCount: number;
  errorCount: number;
}

/**
 * Inventory summary per denomination, shown on the admin e-vouchers page.
 */
export interface VoucherInventorySummary {
  denomination: number;
  available: number;
  assigned: number;
  opened: number;
}

/**
 * Admin-configurable rank -> denomination assignment rule, stored in
 * evoucher_tier_rules. Global (not per-month) — editable anytime.
 */
export interface EVoucherTierRule {
  id: string;
  min_rank: number;
  max_rank: number;
  denomination: number;
  created_at: string;
  updated_at: string;
}

/** Seed values only — the migration inserts these as the initial rows. Runtime code reads evoucher_tier_rules from the DB. */
export const DEFAULT_EVOUCHER_RANK_TIERS: { minRank: number; maxRank: number; denomination: number }[] = [
  { minRank: 1, maxRank: 5, denomination: 200000 },
  { minRank: 6, maxRank: 15, denomination: 100000 },
];

export function getVoucherTierForRank(rank: number, tiers: EVoucherTierRule[]): { denomination: number } | null {
  const tier = tiers.find((t) => rank >= t.min_rank && rank <= t.max_rank);
  return tier ? { denomination: tier.denomination } : null;
}
