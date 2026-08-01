// @/app/services/businessMetricsService.ts
// CRUD for the admin-uploaded business_metrics table — mirrors the
// evoucher_tier_rules pattern (direct client-side Supabase calls, RLS locked
// to authenticated) since this is a small admin-editable settings-like
// table, not a statistical-aggregation concern (that lives in
// /api/analytics/business).
import { supabase } from "@/lib/supabase";
import type { BusinessGranularity } from "@/lib/businessMetricsParser";

export interface BusinessMetricRecord {
  id: string;
  period: string;
  granularity: BusinessGranularity;
  revenue_vnd: number;
  energy_kwh: number;
  source_file_name: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessMetricUpsertInput {
  period: string;
  granularity: BusinessGranularity;
  revenue_vnd: number;
  energy_kwh: number;
  source_file_name?: string | null;
  uploaded_by?: string | null;
}

export const businessMetricsService = {
  async getAll(): Promise<BusinessMetricRecord[]> {
    const { data, error } = await supabase.from("business_metrics").select("*").order("period", { ascending: true });
    if (error) {
      console.error("Lỗi lấy dữ liệu hiệu quả kinh doanh:", error);
      return [];
    }
    return (data || []) as BusinessMetricRecord[];
  },

  /** Upsert on (period, granularity) — a re-upload of the same period overwrites it. */
  async upsertMany(rows: BusinessMetricUpsertInput[]): Promise<{ success: boolean; message: string; count: number }> {
    if (rows.length === 0) return { success: true, message: "Không có dòng nào để lưu.", count: 0 };

    const { error } = await supabase
      .from("business_metrics")
      .upsert(
        rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: "period,granularity" }
      );

    if (error) {
      console.error("Lỗi lưu dữ liệu hiệu quả kinh doanh:", error);
      return { success: false, message: "Không thể lưu dữ liệu.", count: 0 };
    }
    return { success: true, message: `Đã lưu ${rows.length} kỳ báo cáo.`, count: rows.length };
  },

  async deleteById(id: string): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase.from("business_metrics").delete().eq("id", id);
    if (error) {
      console.error("Lỗi xóa kỳ báo cáo:", error);
      return { success: false, message: "Không thể xóa." };
    }
    return { success: true, message: "Đã xóa." };
  },
};
