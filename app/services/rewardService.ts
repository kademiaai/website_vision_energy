// @/app/services/rewardService.ts
import { supabase } from "@/lib/supabase";
import { customerService, type CustomerRanking } from "./customerService";
import { getVietnamMonthRange, getCurrentVietnamPeriod } from "@/lib/timezone";
import { recordEvent } from "@/lib/telemetry";
import type {
  Reward,
  RewardClaimInput,
  RewardCreateInput,
  RewardWithCustomer,
  LeaderboardEntry,
} from "@/lib/types/reward";

// ============================================================
// Plate normalization — must match checkinService.ts exactly
// ============================================================
const normalizePlate = (plate: string): string =>
  plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const rewardService = {
  // ----------------------------------------------------------
  // LEADERBOARD QUERIES
  // ----------------------------------------------------------

  /**
   * Get monthly leaderboard by reusing customerService rankings.
   * Enriches each entry with reward status for the given period.
   */
  async getMonthlyLeaderboard(
    month: number,
    year: number
  ): Promise<LeaderboardEntry[]> {
    // Reuse existing ranking logic (no duplication)
    const rankings = await customerService.getCustomerRankings({
      type: "month",
      month,
      year,
    });

    // Fetch existing rewards for this period
    const { data: rewards } = await supabase
      .from("rewards")
      .select("license_plate, status")
      .eq("month", month)
      .eq("year", year);

    const rewardMap = new Map(
      (rewards || []).map((r: { license_plate: string; status: string }) => [
        r.license_plate,
        r.status,
      ])
    );

    // Fetch lifetime reward counts for all ranked users
    const plates = rankings.map((r: CustomerRanking) => r.license_plate);
    const lifetimeCounts = await this.getLifetimeRewardCounts(plates);

    return rankings.map((r: CustomerRanking) => ({
      license_plate: r.license_plate,
      full_name: r.full_name,
      phone_number: r.phone_number,
      total_sessions: r.total_sessions,
      rank: r.rank,
      reward_status:
        (rewardMap.get(r.license_plate) as LeaderboardEntry["reward_status"]) ||
        null,
      total_rewards_lifetime: lifetimeCounts.get(r.license_plate) || 0,
    }));
  },

  /**
   * Get all-time leaderboard from customers table (lifetime points).
   */
  async getAllTimeLeaderboard(): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from("customers")
      .select("license_plate, full_name, phone_number, total_points")
      .order("total_points", { ascending: false });

    if (error) throw error;

    const plates = (data || []).map(
      (c: { license_plate: string }) => c.license_plate
    );
    const lifetimeCounts = await this.getLifetimeRewardCounts(plates);

    return (data || []).map(
      (
        c: {
          license_plate: string;
          full_name: string | null;
          phone_number: string | null;
          total_points: number;
        },
        index: number
      ) => ({
        license_plate: c.license_plate,
        full_name: c.full_name,
        phone_number: c.phone_number,
        total_sessions: c.total_points || 0,
        rank: index + 1,
        reward_status: null,
        total_rewards_lifetime: lifetimeCounts.get(c.license_plate) || 0,
      })
    );
  },

  // ----------------------------------------------------------
  // REWARD LIFECYCLE
  // ----------------------------------------------------------

  /**
   * Generate reward entries for selected customers.
   * Called by admin when selecting users from the leaderboard.
   */
  async generateRewardTokens(
    entries: RewardCreateInput[]
  ): Promise<{ token: string; license_plate: string }[]> {
    const results: { token: string; license_plate: string }[] = [];

    for (const entry of entries) {
      const token = crypto.randomUUID();

      const { error } = await supabase.from("rewards").insert({
        license_plate: entry.license_plate,
        month: entry.month,
        year: entry.year,
        checkin_count: entry.checkin_count,
        token,
        status: "eligible",
      });

      if (error) {
        // If unique constraint violation, skip (already has a reward)
        if (error.code === "23505") {
          console.warn(
            `Reward already exists for ${entry.license_plate} (${entry.month}/${entry.year})`
          );
          continue;
        }
        throw error;
      }

      results.push({ token, license_plate: entry.license_plate });
    }

    return results;
  },

  /**
   * Validate a reward token and return the reward record.
   * Used by the customer portal on page load.
   *
   * Returns `alreadySubmitted: true` when the user has already submitted
   * (status = processing or completed), so the UI can show a re-submission prompt.
   */
  async validateToken(
    token: string
  ): Promise<{
    valid: boolean;
    reward: Reward | null;
    message: string;
    alreadySubmitted?: boolean;
  }> {
    const { data, error } = await supabase
      .from("rewards")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error || !data) {
      return { valid: false, reward: null, message: "Link không hợp lệ." };
    }

    // Already completed — show re-submission prompt (user may want to update)
    if (data.status === "completed") {
      return {
        valid: true,
        reward: data as Reward,
        message: "Bạn đã nhận quà cho kỳ thưởng này rồi.",
        alreadySubmitted: true,
      };
    }

    // Already submitted (processing) — show re-submission prompt
    if (data.status === "processing") {
      return {
        valid: true,
        reward: data as Reward,
        message: "Bạn đã gửi thông tin. Bạn có muốn cập nhật lại không?",
        alreadySubmitted: true,
      };
    }

    return { valid: true, reward: data as Reward, message: "OK" };
  },

  /**
   * Verify customer identity by checking plate + phone against the record.
   */
  async verifyIdentity(
    token: string,
    plate: string,
    phone: string
  ): Promise<{ verified: boolean; message: string }> {
    const cleanPlate = normalizePlate(plate);

    // Get the reward record
    const { data: reward } = await supabase
      .from("rewards")
      .select("license_plate")
      .eq("token", token)
      .maybeSingle();

    if (!reward || reward.license_plate !== cleanPlate) {
      return {
        verified: false,
        message: "Biển số xe không khớp với tài khoản nhận thưởng.",
      };
    }

    // Check phone against customers table
    const { data: customer } = await supabase
      .from("customers")
      .select("phone_number")
      .eq("license_plate", cleanPlate)
      .maybeSingle();

    if (!customer) {
      return {
        verified: false,
        message: "Thông tin khách hàng không tồn tại.",
      };
    }

    // Normalize both for robust comparison
    const cleanDbPhone = (customer.phone_number || "").replace(/\s/g, "");
    const cleanInputPhone = phone.replace(/\s/g, "");

    if (cleanDbPhone !== cleanInputPhone) {
      return {
        verified: false,
        message: "Số điện thoại không khớp với thông tin đã đăng ký.",
      };
    }

    return { verified: true, message: "Xác minh thành công." };
  },

  /**
   * Submit reward claim from the customer portal.
   * Allows re-submission for processing, rejected, and completed statuses.
   */
  async submitRewardClaim(
    data: RewardClaimInput
  ): Promise<{ success: boolean; message: string }> {
    // Allow update for eligible, processing, rejected, and completed (re-submission)
    const { data: updated, error } = await supabase
      .from("rewards")
      .update({
        id_full_name: data.id_full_name.trim(),
        id_number: data.id_number.trim(),
        id_card_photo_url: data.id_card_photo_url,
        is_ocr_verified: data.is_ocr_verified,
        status: "processing",
      })
      .eq("token", data.token)
      .in("status", ["eligible", "processing", "rejected", "completed"])
      .select()
      .maybeSingle();

    if (error) {
      console.error("Lỗi gửi thông tin nhận thưởng:", error);
      return { success: false, message: "Lỗi hệ thống. Vui lòng thử lại." };
    }

    if (!updated) {
      return {
        success: false,
        message: "Bạn đã gửi thông tin rồi hoặc link không hợp lệ.",
      };
    }

    return { success: true, message: "Gửi thông tin thành công!" };
  },

  /**
   * Check for any rewards that need an in-app notification for a customer.
   * Priority: 'completed' (celebration) > 'eligible' (winner announcement)
   */
  async getPendingNotification(licensePlate: string): Promise<{
    reward: Reward;
    type: "selection" | "completion";
  } | null> {
    try {
      const cleanPlate = normalizePlate(licensePlate);

      // 1. Check for unseen completions (Celebration)
      const { data: completion, error: cError } = await supabase
        .from("rewards")
        .select("*")
        .eq("license_plate", cleanPlate)
        .eq("status", "completed")
        .is("completion_seen_at", null)
        .maybeSingle();

      if (cError) {
        console.warn("⚠️ Reward completion query failed:", cError.message);
        // If column doesn't exist, this will fail. We log but continue to selection check.
      } else if (completion) {
        return { reward: completion as Reward, type: "completion" };
      }

      // 2. Check for unseen selections (Winner Announcement)
      const { data: selection, error: sError } = await supabase
        .from("rewards")
        .select("*")
        .eq("license_plate", cleanPlate)
        .eq("status", "eligible")
        .is("selection_seen_at", null)
        .maybeSingle();

      if (sError) {
        console.warn("⚠️ Reward selection query failed:", sError.message);
      } else if (selection) {
        return { reward: selection as Reward, type: "selection" };
      }

      return null;
    } catch (err) {
      console.error("💥 Critical error in getPendingNotification:", err);
      return null;
    }
  },

  /**
   * Mark a notification as seen so it doesn't pop up again.
   */
  async markNotificationAsSeen(
    rewardId: string,
    type: "selection" | "completion"
  ): Promise<void> {
    const updateData =
      type === "selection"
        ? { selection_seen_at: new Date().toISOString() }
        : { completion_seen_at: new Date().toISOString() };

    await supabase.from("rewards").update(updateData).eq("id", rewardId);
  },

  // ----------------------------------------------------------
  // ADMIN ACTIONS
  // ----------------------------------------------------------

  /**
   * Approve a reward (admin marks as completed).
   */
  async approveReward(
    rewardId: string,
    adminNotes?: string
  ): Promise<{ success: boolean; message: string }> {
    const { data: updated, error } = await supabase
      .from("rewards")
      .update({
        status: "completed",
        rewarded_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
      })
      .eq("id", rewardId)
      // Allow admin to approve rewards that are in 'processing' or still 'eligible'
      .in("status", ["processing", "eligible"]) // Guard: only certain statuses
      .select()
      .maybeSingle();

    if (error) {
      console.error("Lỗi duyệt thưởng:", error);
      return { success: false, message: "Lỗi hệ thống." };
    }

    if (!updated) {
      return {
        success: false,
        message: "Không thể duyệt. Trạng thái đã thay đổi.",
      };
    }

    console.info(`Reward ${rewardId} approved by admin; updated status: ${updated.status}`);

    return { success: true, message: "Đã duyệt thưởng thành công." };
  },

  /**
   * Reject a reward (admin marks as rejected).
   */
  async rejectReward(
    rewardId: string,
    adminNotes?: string
  ): Promise<{ success: boolean; message: string }> {
    const { data: updated, error } = await supabase
      .from("rewards")
      .update({
        status: "rejected",
        admin_notes: adminNotes || null,
      })
      .eq("id", rewardId)
      .eq("status", "processing")
      .select()
      .maybeSingle();

    if (error) {
      console.error("Lỗi từ chối thưởng:", error);
      return { success: false, message: "Lỗi hệ thống." };
    }

    if (!updated) {
      return {
        success: false,
        message: "Không thể từ chối. Trạng thái đã thay đổi.",
      };
    }

    return { success: true, message: "Đã từ chối yêu cầu." };
  },

  /**
   * Get all rewards for a specific period (admin view).
   */
  async getRewardsByPeriod(
    month: number,
    year: number
  ): Promise<RewardWithCustomer[]> {
    const { data, error } = await supabase
      .from("rewards")
      .select(
        `
        *,
        customers (
          full_name,
          phone_number
        )
      `
      )
      .eq("month", month)
      .eq("year", year)
      .order("checkin_count", { ascending: false });

    if (error) throw error;

    // Enrich with lifetime reward counts
    const plates = (data || []).map(
      (r: { license_plate: string }) => r.license_plate
    );
    const lifetimeCounts = await this.getLifetimeRewardCounts(plates);

    return (data || []).map(
      (r: Reward & { customers: { full_name: string | null; phone_number: string | null } | null }) => ({
        ...r,
        customer_name: r.customers?.full_name || null,
        customer_phone: r.customers?.phone_number || null,
        total_rewards_lifetime: lifetimeCounts.get(r.license_plate) || 0,
      })
    );
  },

  /**
   * Get full reward history for a specific customer.
   */
  async getRewardHistory(licensePlate: string): Promise<(Reward & { monthly_rank?: number | null; monthly_sessions?: number | null })[]> {
    const cleanPlate = normalizePlate(licensePlate);

    const { data, error } = await supabase
      .from("rewards")
      .select("*")
      .eq("license_plate", cleanPlate)
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) throw error;

    const rewards = (data || []) as Reward[];

    // If there are no rewards, attempt a defensive fallback (match variants)
    if (rewards.length === 0) {
      try {
        console.warn(`No rewards found for plate ${cleanPlate}, retrying with ILIKE fallback`);
        const { data: altData, error: altError } = await supabase
          .from("rewards")
          .select("*")
          .ilike("license_plate", `%${cleanPlate}%`)
          .order("year", { ascending: false })
          .order("month", { ascending: false });

        if (altError) {
          console.warn("Fallback reward history query failed:", altError.message || altError);
        } else if (altData && altData.length > 0) {
          // Emit telemetry for the fallback case so we can monitor frequency
          try {
            await recordEvent("reward_history_fallback", {
              plate: cleanPlate,
              found: altData.length,
            });
          } catch (e) {
            // ignore telemetry errors
          }

          // use the fallback results
          return (altData as Reward[]).map((r) => ({ ...r, monthly_rank: null, monthly_sessions: null }));
        }
      } catch (err) {
        console.warn("Error during fallback reward history lookup:", err);
      }

      return [];
    }

    // Group unique month/year pairs so we only fetch rankings once per period
    const periods = Array.from(
      new Set(rewards.map((r) => `${r.month}-${r.year}`))
    ).map((s) => {
      const [m, y] = s.split("-").map(Number);
      return { month: m, year: y };
    });

    // For each period fetch rankings and build a lookup map of plate -> { rank, sessions }
    const periodRankMaps: Map<string, Map<string, { rank: number; sessions: number }>> = new Map();

    for (const p of periods) {
      try {
        const rankings = await customerService.getCustomerRankings({
          type: "month",
          month: p.month,
          year: p.year,
        });

        const map = new Map<string, { rank: number; sessions: number }>();
        rankings.forEach((r) => {
          map.set(r.license_plate, { rank: r.rank, sessions: r.total_sessions });
        });

        periodRankMaps.set(`${p.month}-${p.year}`, map);
      } catch (err) {
        console.warn("Unable to fetch rankings for period", p.month, p.year, err);
        periodRankMaps.set(`${p.month}-${p.year}`, new Map());
      }
    }

    // Enrich each reward with the monthly_rank and monthly_sessions where available
    return rewards.map((r) => {
      const lookup = periodRankMaps.get(`${r.month}-${r.year}`);
      const info = lookup?.get(r.license_plate) || null;
      return {
        ...r,
        monthly_rank: info ? info.rank : null,
        monthly_sessions: info ? info.sessions : null,
      };
    });
  },

  // ----------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------

  /**
   * Get count of completed rewards per license plate.
   * Used to show "Total times rewarded" in the admin dashboard.
   */
  async getLifetimeRewardCounts(
    plates: string[]
  ): Promise<Map<string, number>> {
    if (plates.length === 0) return new Map();

    const { data, error } = await supabase
      .from("rewards")
      .select("license_plate")
      .in("license_plate", plates)
      .eq("status", "completed");

    if (error) {
      console.error("Lỗi đếm reward lifetime:", error);
      return new Map();
    }

    const counts = new Map<string, number>();
    (data || []).forEach((r: { license_plate: string }) => {
      counts.set(r.license_plate, (counts.get(r.license_plate) || 0) + 1);
    });

    return counts;
  },

  /**
   * Upload CCCD photo to private storage bucket.
   * Returns the storage path (not a public URL).
   */
  async uploadIdPhoto(
    file: File,
    licensePlate: string,
    month: number,
    year: number
  ): Promise<string> {
    const cleanPlate = normalizePlate(licensePlate);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${cleanPlate}/${year}-${String(month).padStart(2, "0")}/cccd.${ext}`;

    const { error } = await supabase.storage
      .from("verification-docs")
      .upload(path, file, {
        upsert: true, 
      });

    if (error) {
      console.error("Lỗi upload ảnh CCCD:", error);
      throw new Error("Không thể tải ảnh lên. Vui lòng thử lại.");
    }

    return path;
  },

  /**
   * Get a short-lived signed URL for viewing a CCCD photo (admin only).
   */
  async getIdPhotoUrl(storagePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from("verification-docs")
      .createSignedUrl(storagePath, 300); // 5 minutes

    if (error) {
      console.error("Lỗi tạo signed URL:", error);
      return null;
    }

    return data.signedUrl;
  },

  /**
   * Delete a reward record (admin).
   */
  async deleteReward(rewardId: string, actor?: string): Promise<{ success: boolean; message: string }> {
    // Perform deletion
    const { error } = await supabase.from('rewards').delete().eq('id', rewardId);
    if (error) {
      console.error('Lỗi xóa reward:', error);
      return { success: false, message: 'Xóa thất bại. Vui lòng thử lại.' };
    }

    // Best-effort: insert an audit log for admin actions. This is non-blocking.
    try {
      await supabase.from('admin_audit_logs').insert({
        action: 'delete_reward',
        target_table: 'rewards',
        target_id: rewardId,
        actor: actor || null,
        details: JSON.stringify({}),
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      // If the audit table doesn't exist or insert fails, log and continue.
      console.warn('Audit log insert failed (non-fatal):', e);
    }

    return { success: true, message: 'Đã xóa reward.' };
  },
};
