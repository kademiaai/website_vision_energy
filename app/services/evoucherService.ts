// @/app/services/evoucherService.ts
import { supabase } from "@/lib/supabase";
import { rewardService } from "./rewardService";
import { getCurrentVietnamDate, getCurrentVietnamDateISO, getLastDayOfMonthISO } from "@/lib/timezone";
import type {
  EVoucher,
  EVoucherOpenLog,
  EVoucherTierRule,
  ImportVoucherResult,
  ParsedVoucherRow,
  VoucherInventorySummary,
} from "@/lib/types/evoucher";

// ============================================================
// Plate normalization — must match checkinService.ts exactly
// ============================================================
const normalizePlate = (plate: string): string =>
  plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const evoucherService = {
  // ----------------------------------------------------------
  // UPLOAD / IMPORT
  // ----------------------------------------------------------

  /**
   * Persist rows already decrypted + parsed by evoucherParseAction.
   * Creates one evoucher_uploads batch row, then inserts each voucher,
   * skipping duplicates (same link already imported in a previous month).
   */
  async importParsedVouchers(
    rows: ParsedVoucherRow[],
    fileName: string,
    month: number,
    year: number,
    uploadedBy?: string
  ): Promise<ImportVoucherResult> {
    const { data: batch, error: batchError } = await supabase
      .from("evoucher_uploads")
      .insert({
        file_name: fileName,
        uploaded_by: uploadedBy || null,
        month,
        year,
        total_rows: rows.length,
      })
      .select()
      .single();

    if (batchError || !batch) {
      console.error("Lỗi tạo batch upload:", batchError);
      return {
        success: false,
        message: "Không thể tạo phiên tải lên.",
        totalRows: rows.length,
        insertedCount: 0,
        duplicateCount: 0,
        errorCount: rows.length,
      };
    }

    let insertedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const { error } = await supabase.from("evouchers").insert({
        denomination: row.denomination,
        voucher_code: row.voucher_code,
        row_index: row.row_index,
        link: row.link,
        pin: row.pin,
        expiry_date: row.expiry_date,
        upload_batch_id: batch.id,
        status: "available",
      });

      if (error) {
        if (error.code === "23505") {
          duplicateCount++;
        } else {
          console.error("Lỗi thêm voucher:", error);
          errorCount++;
        }
        continue;
      }

      insertedCount++;
    }

    await supabase
      .from("evoucher_uploads")
      .update({ inserted_count: insertedCount, duplicate_count: duplicateCount, error_count: errorCount })
      .eq("id", batch.id);

    return {
      success: true,
      message: `Đã nhập ${insertedCount}/${rows.length} voucher (${duplicateCount} trùng, ${errorCount} lỗi).`,
      uploadId: batch.id,
      totalRows: rows.length,
      insertedCount,
      duplicateCount,
      errorCount,
    };
  },

  /**
   * Whether an e-voucher file has already been uploaded for this period —
   * used to drive the admin reminder banner.
   */
  async hasUploadForPeriod(month: number, year: number): Promise<boolean> {
    const { count, error } = await supabase
      .from("evoucher_uploads")
      .select("*", { count: "exact", head: true })
      .eq("month", month)
      .eq("year", year);

    if (error) {
      console.warn("Lỗi kiểm tra upload e-voucher:", error.message);
      return true; // fail closed: don't nag if we can't tell
    }

    return (count || 0) > 0;
  },

  // ----------------------------------------------------------
  // INVENTORY
  // ----------------------------------------------------------

  async getInventorySummary(): Promise<VoucherInventorySummary[]> {
    const { data, error } = await supabase.from("evouchers").select("denomination, status");

    if (error) {
      console.error("Lỗi lấy tồn kho e-voucher:", error);
      return [];
    }

    const map = new Map<number, VoucherInventorySummary>();
    (data || []).forEach((row: { denomination: number; status: string }) => {
      if (!map.has(row.denomination)) {
        map.set(row.denomination, { denomination: row.denomination, available: 0, assigned: 0, opened: 0 });
      }
      const entry = map.get(row.denomination)!;
      if (row.status === "available") entry.available++;
      else if (row.status === "assigned") entry.assigned++;
      else if (row.status === "opened") entry.opened++;
    });

    return Array.from(map.values()).sort((a, b) => b.denomination - a.denomination);
  },

  /** Full voucher list (every status) for the admin detail table. */
  async getAllVouchers(): Promise<EVoucher[]> {
    const { data, error } = await supabase
      .from("evouchers")
      .select("*")
      .order("denomination", { ascending: false })
      .order("row_index", { ascending: true });

    if (error) {
      console.error("Lỗi lấy danh sách e-voucher:", error);
      return [];
    }

    return (data || []) as EVoucher[];
  },

  /**
   * Admin correction: reset a voucher back to a clean "available" state,
   * regardless of its current status (assigned or opened) — clears the
   * assignment and open counters so it can be reassigned as if new.
   * The evoucher_open_logs audit trail is left untouched.
   */
  async resetVoucherToAvailable(voucherId: string): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase
      .from("evouchers")
      .update({
        status: "available",
        assigned_license_plate: null,
        assigned_month: null,
        assigned_year: null,
        assigned_rank: null,
        assigned_at: null,
        assigned_by: null,
        first_opened_at: null,
        open_count: 0,
        // New token: the old one may already be in a customer's hands (check-in
        // modal, saved link) — reusing it would let that stale link resolve to
        // whoever this voucher gets reassigned to next.
        token: crypto.randomUUID(),
      })
      .eq("id", voucherId);

    if (error) {
      console.error("Lỗi đặt lại trạng thái e-voucher:", error);
      return { success: false, message: "Không thể đặt lại trạng thái." };
    }

    return { success: true, message: "Đã đặt lại voucher về trạng thái mới." };
  },

  // ----------------------------------------------------------
  // TIER RULES (rank -> denomination settings)
  // ----------------------------------------------------------

  async getTierRules(): Promise<EVoucherTierRule[]> {
    const { data, error } = await supabase
      .from("evoucher_tier_rules")
      .select("*")
      .order("min_rank", { ascending: true });

    if (error) {
      console.error("Lỗi lấy quy tắc gán e-voucher:", error);
      return [];
    }

    return (data || []) as EVoucherTierRule[];
  },

  async addTierRule(
    minRank: number,
    maxRank: number,
    denomination: number
  ): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase
      .from("evoucher_tier_rules")
      .insert({ min_rank: minRank, max_rank: maxRank, denomination });

    if (error) {
      console.error("Lỗi thêm quy tắc:", error);
      return { success: false, message: "Không thể thêm quy tắc." };
    }
    return { success: true, message: "Đã thêm quy tắc." };
  },

  async updateTierRule(
    id: string,
    fields: { minRank: number; maxRank: number; denomination: number }
  ): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase
      .from("evoucher_tier_rules")
      .update({
        min_rank: fields.minRank,
        max_rank: fields.maxRank,
        denomination: fields.denomination,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Lỗi cập nhật quy tắc:", error);
      return { success: false, message: "Không thể lưu quy tắc." };
    }
    return { success: true, message: "Đã lưu quy tắc." };
  },

  async deleteTierRule(id: string): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase.from("evoucher_tier_rules").delete().eq("id", id);
    if (error) {
      console.error("Lỗi xóa quy tắc:", error);
      return { success: false, message: "Không thể xóa quy tắc." };
    }
    return { success: true, message: "Đã xóa quy tắc." };
  },

  // ----------------------------------------------------------
  // EXPIRY
  // ----------------------------------------------------------

  /**
   * Reclaims any assigned-but-never-opened voucher whose expiry has passed
   * (end of its assigned month) back into the available pool. There's no
   * cron/scheduled-job infra in this app, so this runs lazily — called
   * whenever a customer or admin touches voucher data — rather than on a
   * timer. Best-effort: failures are logged, never thrown, since it's a
   * background reconciliation, not the primary action of any caller.
   */
  async expireOverdueVouchers(): Promise<void> {
    try {
      await supabase
        .from("evouchers")
        .update({
          status: "available",
          assigned_license_plate: null,
          assigned_month: null,
          assigned_year: null,
          assigned_rank: null,
          assigned_at: null,
          assigned_by: null,
        })
        .eq("status", "assigned")
        .lt("expiry_date", getCurrentVietnamDateISO());
    } catch (e) {
      console.warn("Lỗi thu hồi e-voucher hết hạn (không chặn):", e);
    }
  },

  // ----------------------------------------------------------
  // ASSIGNMENT
  // ----------------------------------------------------------

  /**
   * Assign the next available voucher of the given denomination to a
   * customer. Denomination is always explicit here — callers decide it,
   * whether pre-filled from a tier rule or picked manually by the admin.
   */
  async assignVoucher(
    plate: string,
    denomination: number,
    month: number,
    year: number,
    rank: number,
    adminEmail?: string
  ): Promise<{ success: boolean; message: string; voucher?: EVoucher }> {
    const cleanPlate = normalizePlate(plate);

    const { data: candidate } = await supabase
      .from("evouchers")
      .select("id")
      .eq("status", "available")
      .eq("denomination", denomination)
      .order("row_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!candidate) {
      return { success: false, message: `Đã hết e-voucher mệnh giá ${denomination.toLocaleString("vi-VN")}đ trong kho.` };
    }

    const { data: updated, error } = await supabase
      .from("evouchers")
      .update({
        status: "assigned",
        assigned_license_plate: cleanPlate,
        assigned_month: month,
        assigned_year: year,
        assigned_rank: rank,
        assigned_at: new Date().toISOString(),
        assigned_by: adminEmail || null,
        // Cap expiry to the end of the CURRENT month (when the voucher is
        // actually handed out), not the reward period's month — admins
        // typically assign after the period has already ended (e.g.
        // reviewing July's winners in early August), so anchoring to the
        // reward period would make the voucher expire before it's even
        // opened once, and the auto-reclaim sweep would revert it instantly.
        expiry_date: getLastDayOfMonthISO(getCurrentVietnamDate().month, getCurrentVietnamDate().year),
      })
      .eq("id", candidate.id)
      .eq("status", "available")
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return { success: false, message: "Khách hàng này đã có e-voucher cho kỳ này." };
      }
      console.error("Lỗi gán e-voucher:", error);
      return { success: false, message: "Lỗi hệ thống khi gán e-voucher." };
    }

    if (!updated) {
      return { success: false, message: "Voucher vừa được gán cho người khác. Vui lòng thử lại." };
    }

    return { success: true, message: "Đã gán e-voucher thành công.", voucher: updated as EVoucher };
  },

  /**
   * Undo an assignment (admin correction) — returns the voucher to the pool.
   */
  async unassignVoucher(voucherId: string): Promise<{ success: boolean; message: string }> {
    const { data: updated, error } = await supabase
      .from("evouchers")
      .update({
        status: "available",
        assigned_license_plate: null,
        assigned_month: null,
        assigned_year: null,
        assigned_rank: null,
        assigned_at: null,
        assigned_by: null,
        // New token: the old one may already be in a customer's hands (check-in
        // modal, saved link) — reusing it would let that stale link resolve to
        // whoever this voucher gets reassigned to next.
        token: crypto.randomUUID(),
      })
      .eq("id", voucherId)
      .eq("status", "assigned") // only undo before it's been opened
      .select()
      .maybeSingle();

    if (error) {
      console.error("Lỗi hủy gán e-voucher:", error);
      return { success: false, message: "Không thể hủy gán." };
    }

    if (!updated) {
      return { success: false, message: "Không thể hủy gán — voucher có thể đã được mở hoặc trạng thái đã thay đổi." };
    }

    return { success: true, message: "Đã hủy gán e-voucher." };
  },

  /**
   * Assigned vouchers for a period, keyed by license plate — used to enrich
   * the leaderboard table with e-voucher status alongside the cash reward status.
   */
  async getAssignedVouchersForPeriod(month: number, year: number): Promise<Map<string, EVoucher>> {
    const { data, error } = await supabase
      .from("evouchers")
      .select("*")
      .eq("assigned_month", month)
      .eq("assigned_year", year);

    if (error) {
      console.error("Lỗi lấy e-voucher đã gán:", error);
      return new Map();
    }

    return new Map((data || []).map((v: EVoucher) => [v.assigned_license_plate as string, v]));
  },

  // ----------------------------------------------------------
  // CUSTOMER-FACING (check-in notification + open page)
  // ----------------------------------------------------------

  /**
   * An assigned-but-unopened voucher for this plate, if any — surfaced as
   * a check-in notification (gated by day-of-month in checkinService).
   *
   * Only surfaces the voucher once the admin has approved the matching cash
   * reward for that plate/period (rewards.status = 'completed') — the
   * e-voucher is revealed together with the "you've been approved"
   * celebration, not before. If no reward row exists for that period at
   * all, the voucher stays hidden (nothing to approve yet).
   */
  async getPendingVoucherNotification(licensePlate: string): Promise<EVoucher | null> {
    try {
      await this.expireOverdueVouchers();

      const cleanPlate = normalizePlate(licensePlate);

      const { data, error } = await supabase
        .from("evouchers")
        .select("*")
        .eq("assigned_license_plate", cleanPlate)
        .eq("status", "assigned")
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("⚠️ Truy vấn e-voucher chờ thông báo thất bại:", error.message);
        return null;
      }

      const voucher = (data as EVoucher) || null;
      if (!voucher || !voucher.assigned_month || !voucher.assigned_year) return null;

      const reward = await rewardService.getRewardByPlateAndPeriod(cleanPlate, voucher.assigned_month, voucher.assigned_year);
      if (!reward || reward.status !== "completed") return null;

      return voucher;
    } catch (err) {
      console.error("💥 Lỗi nghiêm trọng khi lấy e-voucher chờ thông báo:", err);
      return null;
    }
  },

  /**
   * The voucher assigned to a specific plate for a specific period, if any.
   * Used by the cash-reward claim portal to also surface an assigned e-voucher.
   *
   * Goes through a SECURITY DEFINER RPC (not a direct table read) because
   * this runs from the public, unauthenticated claim portal — direct table
   * RLS can't scope a SELECT to "only the row matching this plate+period"
   * without exposing every voucher to every anon caller. See
   * lib/database/evouchers-secure-token-access-migration.sql.
   */
  async getAssignedVoucherForPlate(licensePlate: string, month: number, year: number): Promise<EVoucher | null> {
    const cleanPlate = normalizePlate(licensePlate);

    const { data, error } = await supabase.rpc("get_evoucher_for_plate_period", {
      p_plate: cleanPlate,
      p_month: month,
      p_year: year,
    });

    if (error || !data || data.length === 0) return null;
    return data[0] as EVoucher;
  },

  /**
   * Look up a voucher by its public token — used by the open page on load.
   * Via RPC for the same reason as getAssignedVoucherForPlate above.
   */
  async getVoucherByToken(token: string): Promise<EVoucher | null> {
    const { data, error } = await supabase.rpc("get_evoucher_by_token", { p_token: token });
    if (error || !data || data.length === 0) return null;
    return data[0] as EVoucher;
  },

  /**
   * Records a click on "open voucher": atomically flips assigned->opened
   * (or bumps open_count on re-open), writes the audit log row, and stamps
   * the matching reward's "Đã mở quà" marker — all inside a single
   * SECURITY DEFINER RPC call (open_evoucher_by_token) run as the function
   * owner, so it isn't blocked by RLS on either table and there's no
   * read-then-write race on open_count between concurrent opens.
   */
  async logOpen(
    token: string,
    userAgent?: string
  ): Promise<{ success: boolean; message: string; voucher?: EVoucher }> {
    const { data, error } = await supabase.rpc("open_evoucher_by_token", {
      p_token: token,
      p_user_agent: userAgent || null,
    });

    if (error) {
      console.error("Lỗi mở e-voucher:", error);
      return { success: false, message: "Lỗi hệ thống." };
    }

    const voucher = data?.[0] as EVoucher | undefined;
    if (!voucher) {
      return { success: false, message: "Link không hợp lệ." };
    }

    if (voucher.status === "available") {
      return { success: false, message: "E-voucher này chưa được gán cho tài khoản nào." };
    }

    return { success: true, message: "Đã mở e-voucher.", voucher };
  },

  // ----------------------------------------------------------
  // ADMIN VIEWS
  // ----------------------------------------------------------

  /** Recent open events, enriched with voucher context, for the admin page. */
  async getOpenLogs(limitCount: number = 100): Promise<(EVoucherOpenLog & { evoucher: EVoucher | null })[]> {
    const { data, error } = await supabase
      .from("evoucher_open_logs")
      .select(`*, evoucher:evoucher_id ( id, denomination, assigned_license_plate, link, status )`)
      .order("opened_at", { ascending: false })
      .limit(limitCount);

    if (error) {
      console.error("Lỗi lấy log mở e-voucher:", error);
      return [];
    }

    return (data || []) as unknown as (EVoucherOpenLog & { evoucher: EVoucher | null })[];
  },
};
