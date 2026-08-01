"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { Download, Info, Sparkles, TrendingUp, Clock, Calendar, Moon, Loader2 } from "lucide-react";
import MetricTooltip from "@/components/analytics/MetricTooltip";
import { exportSheetToExcel } from "@/lib/exportExcel";
import type { CheckinTrendsResponse } from "@/lib/types/checkinTrends";

/** "YYYY-MM-DD" -> "DD/MM/YYYY", for display in the export/table only. */
function formatDateKeyDisplay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

const COLOR_COUNT = "#3b82f6";
const COLOR_WEEKDAY = "#10b981";
const COLOR_MOVING_AVG = "#f59e0b";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function InsufficientData({ message = "Chưa đủ dữ liệu để phân tích" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground text-sm gap-2">
      <Info size={20} />
      <p>{message}</p>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  tooltip,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="admin-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="p-1.5 bg-primary/10 rounded-lg text-primary">{icon}</div>
        <span>{label}</span>
        <MetricTooltip text={tooltip} />
      </div>
      <p className="text-2xl font-bold text-foreground mt-2">{value}</p>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}

function Heatmap({ data }: { data: NonNullable<CheckinTrendsResponse["heatmap"]> }) {
  const maxCount = Math.max(1, ...data.map((c) => c.count));
  const weekdayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex gap-0.5 ml-8">
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="w-6 text-center text-[9px] text-muted-foreground">
              {hour % 3 === 0 ? hour : ""}
            </div>
          ))}
        </div>
        {weekdayLabels.map((label, weekdayIndex) => (
          <div key={label} className="flex items-center gap-0.5 mt-0.5">
            <div className="w-7 text-xs text-muted-foreground text-right pr-1">{label}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = data.find((c) => c.weekdayIndex === weekdayIndex && c.hour === hour);
              const count = cell?.count || 0;
              const intensity = count === 0 ? 0.05 : 0.15 + 0.85 * (count / maxCount);
              return (
                <div
                  key={hour}
                  title={`${label} ${String(hour).padStart(2, "0")}:00 — ${count} lượt check-in`}
                  className="w-6 h-6 rounded-sm flex items-center justify-center text-[9px] text-foreground/80"
                  style={{ backgroundColor: `rgba(59, 130, 246, ${intensity})` }}
                >
                  {count > 0 ? count : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckinTrendsContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<CheckinTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    ["range", "start", "end"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) qs.set(key, value);
    });

    fetch(`/api/analytics/checkin-trends?${qs.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Không thể tải dữ liệu.");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Lỗi hệ thống");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleExport = () => {
    if (!data) return;
    const rows = data.dailyLine.map((point) => ({
      Ngày: formatDateKeyDisplay(point.date),
      "Số lượt check-in": point.count,
      "Trung bình động 7 ngày": point.movingAvg7 ?? "",
    }));
    exportSheetToExcel(rows, "XuHuongCheckIn", `Xu_huong_checkin_${data.range.type}.xlsx`);
  };

  if (loading) {
    return (
      <div className="admin-card py-16 text-center">
        <Loader2 className="animate-spin mx-auto text-primary" size={28} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-card py-16 text-center text-red-500 text-sm">
        {error || "Không thể tải dữ liệu."}
      </div>
    );
  }

  const { kpis, heatmap, hourBar, weekdayBar, dailyLine, summaryText } = data;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          disabled={kpis.total === 0}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Download size={18} />
          <span>Xuất Excel</span>
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<TrendingUp size={16} />}
          label="Tổng lượt check-in"
          tooltip="Tổng số lượt check-in trong khoảng thời gian đã chọn."
          value={String(kpis.total)}
        />
        <KpiCard
          icon={<Calendar size={16} />}
          label="Trung bình/ngày"
          tooltip="Tổng lượt check-in chia cho số ngày trong khoảng thời gian đã chọn."
          value={kpis.dailyAverage !== null ? kpis.dailyAverage.toString() : "—"}
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="Giờ cao điểm"
          tooltip="Giờ trong ngày (giờ Việt Nam) có nhiều lượt check-in nhất."
          value={kpis.peakHour ? `${String(kpis.peakHour.hour).padStart(2, "0")}:00` : "—"}
          description={kpis.peakHour ? `${kpis.peakHour.count} lượt (${kpis.peakHour.pct}%)` : "Chưa đủ dữ liệu"}
        />
        <KpiCard
          icon={<Calendar size={16} />}
          label="Ngày cao điểm"
          tooltip="Ngày trong tuần có nhiều lượt check-in nhất."
          value={kpis.peakWeekday ? kpis.peakWeekday.label : "—"}
          description={kpis.peakWeekday ? `${kpis.peakWeekday.count} lượt (${kpis.peakWeekday.pct}%)` : "Chưa đủ dữ liệu"}
        />
        <KpiCard
          icon={<Moon size={16} />}
          label="Giờ thấp điểm"
          tooltip="Giờ trong ngày (giờ Việt Nam) có ít lượt check-in nhất."
          value={kpis.quietestHour ? `${String(kpis.quietestHour.hour).padStart(2, "0")}:00` : "—"}
          description={kpis.quietestHour ? `${kpis.quietestHour.count} lượt` : "Chưa đủ dữ liệu"}
        />
      </div>

      {/* Auto summary */}
      <div className="admin-card bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="text-primary shrink-0 mt-0.5" />
          {summaryText ? (
            <p className="text-sm text-foreground">{summaryText}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa đủ dữ liệu để phân tích.</p>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="admin-card">
        <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
          Bản đồ nhiệt check-in
          <MetricTooltip text="Số lượt check-in theo từng cặp (ngày trong tuần, giờ trong ngày). Màu càng đậm, lượt check-in càng nhiều." />
        </h2>
        <p className="text-muted-foreground text-sm mb-4">Ngày trong tuần × Giờ trong ngày</p>
        {heatmap ? <Heatmap data={heatmap} /> : <InsufficientData />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hour bar chart */}
        <div className="admin-card">
          <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
            Lượt check-in theo giờ
            <MetricTooltip text="Tổng số lượt check-in cho từng giờ trong ngày (0-23h), cộng dồn trên toàn bộ khoảng thời gian đã chọn." />
          </h2>
          {hourBar ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourBar} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "var(--foreground)", fontSize: 11 }}
                  tickFormatter={(h) => `${h}h`}
                  interval={1}
                />
                <YAxis tick={{ fill: "var(--foreground)", fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Lượt check-in" radius={[4, 4, 0, 0]}>
                  {hourBar.map((entry) => (
                    <Cell key={entry.hour} fill={COLOR_COUNT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <InsufficientData />
          )}
        </div>

        {/* Weekday bar chart */}
        <div className="admin-card">
          <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
            Lượt check-in theo ngày trong tuần
            <MetricTooltip text="Tổng số lượt check-in cho từng ngày trong tuần, cộng dồn trên toàn bộ khoảng thời gian đã chọn." />
          </h2>
          {weekdayBar ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weekdayBar} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--foreground)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--foreground)", fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Lượt check-in" radius={[4, 4, 0, 0]}>
                  {weekdayBar.map((entry) => (
                    <Cell key={entry.weekdayIndex} fill={COLOR_WEEKDAY} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <InsufficientData />
          )}
        </div>
      </div>

      {/* Daily line chart */}
      <div className="admin-card">
        <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
          Lượt check-in theo ngày
          <MetricTooltip text="Số lượt check-in mỗi ngày trong khoảng thời gian đã chọn. Đường trung bình động 7 ngày chỉ hiển thị khi khoảng thời gian có từ 7 ngày trở lên." />
        </h2>
        {dailyLine.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyLine} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--foreground)", fontSize: 10 }}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis tick={{ fill: "var(--foreground)", fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="count" name="Lượt check-in" stroke={COLOR_COUNT} strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="movingAvg7"
                name="TB động 7 ngày"
                stroke={COLOR_MOVING_AVG}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <InsufficientData />
        )}
      </div>
    </div>
  );
}

export default function CheckinTrendsPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-card py-16 text-center">
          <Loader2 className="animate-spin mx-auto text-primary" size={28} />
        </div>
      }
    >
      <CheckinTrendsContent />
    </Suspense>
  );
}
