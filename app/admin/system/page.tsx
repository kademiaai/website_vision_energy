"use client";
import { useCallback, useEffect, useState } from "react";
import { Settings, Save, Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";
import { checkinSettingsService, CheckinSettings } from "@/app/services/checkinSettingsService";

type TabType = "checkin"; // Thêm key mới ở đây khi có thêm mục cấu hình khác trong tương lai

export default function SystemManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>("checkin");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [cooldownDraft, setCooldownDraft] = useState("180");
  const [unlimited, setUnlimited] = useState(true);
  const [maxPerDayDraft, setMaxPerDayDraft] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const data: CheckinSettings = await checkinSettingsService.getSettings();
    setCooldownDraft(String(data.cooldown_minutes));
    setUnlimited(data.max_checkins_per_day === null);
    setMaxPerDayDraft(data.max_checkins_per_day ? String(data.max_checkins_per_day) : "");
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    const cooldownMinutes = Number(cooldownDraft);
    if (!Number.isFinite(cooldownMinutes) || cooldownMinutes < 0) {
      setFeedback({ type: "error", text: "Thời gian chờ không hợp lệ." });
      return;
    }

    let maxCheckinsPerDay: number | null = null;
    if (!unlimited) {
      const n = Number(maxPerDayDraft);
      if (!Number.isFinite(n) || n < 1) {
        setFeedback({ type: "error", text: "Số lượt tối đa/ngày không hợp lệ." });
        return;
      }
      maxCheckinsPerDay = n;
    }

    setSaving(true);
    setFeedback(null);
    const result = await checkinSettingsService.updateSettings({ cooldownMinutes, maxCheckinsPerDay });
    setSaving(false);
    setFeedback({ type: result.success ? "success" : "error", text: result.message });
    if (result.success) await loadSettings();
  };

  const cooldownNum = Number(cooldownDraft) || 0;
  const hours = Math.floor(cooldownNum / 60);
  const mins = cooldownNum % 60;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings size={24} className="text-primary" />
          Quản lý hệ thống
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cấu hình các quy tắc vận hành của hệ thống check-in và các tính năng liên quan.
        </p>
      </div>

      {/* Tab bar + tab content */}
      <div className="admin-card p-0">
        <div className="flex gap-1 px-4 md:px-6 pt-4 border-b border-border overflow-x-auto">
          {[{ key: "checkin" as TabType, label: "Quản lý check-in", icon: <Settings size={16} /> }].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap " +
                (activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "checkin" && (
          <div className="p-4 md:p-6 space-y-8">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="animate-spin mx-auto text-primary" size={28} />
              </div>
            ) : (
              <>
                {/* Cooldown giữa 2 lần check-in */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/90">
                    Thời gian chờ giữa 2 lần check-in (phút)
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Đây là khoảng thời gian tối thiểu một xe phải chờ giữa 2 lần check-in liên tiếp, dùng để ngăn
                    khách bấm check-in nhiều lần liên tục cho cùng một lượt sạc. Giá trị tính bằng phút — ví dụ
                    180 = 3 tiếng, 120 = 2 tiếng. Đặt về 0 để tắt hoàn toàn quy tắc này.
                  </p>
                  <input
                    type="number"
                    min={0}
                    value={cooldownDraft}
                    onChange={(e) => setCooldownDraft(e.target.value)}
                    className="admin-input max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info size={12} />
                    {`Tương đương ${hours} giờ ${mins} phút.`}
                  </p>
                </div>

                {/* Giới hạn số lần check-in trong ngày */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/90">
                    Số lượt check-in tối đa mỗi ngày (theo từng biển số)
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Giới hạn số lần một biển số xe được check-in trong một ngày (tính theo giờ Việt Nam), áp dụng
                    riêng cho từng xe — không tính gộp toàn hệ thống. Dùng để chặn các trường hợp bất thường vượt
                    quá số lượt sạc hợp lý trong ngày. Tick &quot;Không giới hạn&quot; nếu không muốn áp dụng giới
                    hạn này.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      value={maxPerDayDraft}
                      disabled={unlimited}
                      onChange={(e) => setMaxPerDayDraft(e.target.value)}
                      placeholder="VD: 3"
                      className="admin-input max-w-[140px] disabled:opacity-50"
                    />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={unlimited}
                        onChange={(e) => setUnlimited(e.target.checked)}
                      />
                      Không giới hạn
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info size={12} />
                    Tính theo ngày dương lịch (giờ Việt Nam), áp dụng riêng cho từng biển số xe.
                  </p>
                </div>

                {feedback && (
                  <div
                    className={
                      "flex items-center gap-2 text-sm rounded-lg px-3 py-2 " +
                      (feedback.type === "success" ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-600")
                    }
                  >
                    {feedback.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {feedback.text}
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Lưu cấu hình
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
