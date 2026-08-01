// @/app/services/checkinSettingsService.ts
import { supabase } from "@/lib/supabase";

export interface CheckinSettings {
  id: number;
  cooldown_minutes: number;
  max_checkins_per_day: number | null;
  updated_at: string;
}

// Fallback used if the settings row/table can't be read (e.g. transient
// network error). Matches today's pre-feature hardcoded behavior so a
// settings-read failure never blocks the physical check-in kiosk.
const DEFAULT_SETTINGS: CheckinSettings = {
  id: 1,
  cooldown_minutes: 180,
  max_checkins_per_day: null,
  updated_at: new Date(0).toISOString(),
};

export const checkinSettingsService = {
  async getSettings(): Promise<CheckinSettings> {
    const { data, error } = await supabase
      .from("checkin_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      console.error("Lỗi lấy cấu hình check-in, dùng giá trị mặc định:", error?.message);
      return DEFAULT_SETTINGS;
    }
    return data as CheckinSettings;
  },

  async updateSettings(fields: {
    cooldownMinutes: number;
    maxCheckinsPerDay: number | null;
  }): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase
      .from("checkin_settings")
      .update({
        cooldown_minutes: fields.cooldownMinutes,
        max_checkins_per_day: fields.maxCheckinsPerDay,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      console.error("Lỗi cập nhật cấu hình check-in:", error);
      return { success: false, message: "Không thể lưu cấu hình." };
    }
    return { success: true, message: "Đã lưu cấu hình check-in." };
  },
};
