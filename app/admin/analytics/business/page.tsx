"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Download, Upload, Loader2, TrendingUp, TrendingDown, Zap, DollarSign, Gauge, Info } from "lucide-react";
import MetricTooltip from "@/components/analytics/MetricTooltip";
import BusinessUploadModal from "@/components/analytics/BusinessUploadModal";
import { exportSheetToExcel } from "@/lib/exportExcel";
import type { BusinessDashboardResponse, BusinessPoint, BusinessView } from "@/lib/types/business";

const COLOR_CHECKINS = "#3b82f6";
const COLOR_KWH = "#10b981";
const COLOR_REVENUE = "#f59e0b";
const COLOR_ESTIMATED = "#9ca3af";

const VIEW_OPTIONS: { value: BusinessView; label: string }[] = [
  { value: "month", label: "Tháng" },
  { value: "week", label: "Tuần" },
  { value: "day", label: "Ngày" },
];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs space-y-0.5">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload
        .filter((p: any) => p.value !== null && p.value !== undefined)
        .map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {typeof p.value === "number" ? p.value.toLocaleString("vi-VN") : p.value}
          </p>
        ))}
    </div>
  );
}

function MomBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">Chưa đủ dữ liệu</span>;
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className="text-xs inline-flex items-center gap-1 text-muted-foreground">
      <Icon size={12} />
      {pct >= 0 ? "+" : ""}
      {pct}% so với kỳ trước
    </span>
  );
}

function KpiCard({
  icon,
  label,
  tooltip,
  value,
  mom,
}: {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  value: string;
  mom: number | null;
}) {
  return (
    <div className="admin-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="p-1.5 bg-primary/10 rounded-lg text-primary">{icon}</div>
        <span>{label}</span>
        <MetricTooltip text={tooltip} />
      </div>
      <p className="text-2xl font-bold text-foreground mt-2">{value}</p>
      <div className="mt-1">
        <MomBadge pct={mom} />
      </div>
    </div>
  );
}

function buildCombinedChartData(points: BusinessPoint[]) {
  return points.map((p) => ({
    label: p.label,
    checkinCount: p.checkinCount,
    kwhActual: !p.isEstimated ? p.energyKwh : null,
    kwhEstimated: p.isEstimated ? p.energyKwh : null,
    revenueActual: !p.isEstimated ? p.revenueVnd : null,
    revenueEstimated: p.isEstimated ? p.revenueVnd : null,
  }));
}

function buildRatioChartData(points: BusinessPoint[]) {
  return points.map((p) => {
    const kwhPerCheckin = p.energyKwh !== null && p.checkinCount > 0 ? Math.round((p.energyKwh / p.checkinCount) * 100) / 100 : null;
    const vndPerCheckin = p.revenueVnd !== null && p.checkinCount > 0 ? Math.round(p.revenueVnd / p.checkinCount) : null;
    return {
      label: p.label,
      kwhActual: !p.isEstimated ? kwhPerCheckin : null,
      kwhEstimated: p.isEstimated ? kwhPerCheckin : null,
      vndActual: !p.isEstimated ? vndPerCheckin : null,
      vndEstimated: p.isEstimated ? vndPerCheckin : null,
    };
  });
}

function BusinessContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = (searchParams.get("bview") as BusinessView) || "month";

  const [data, setData] = useState<BusinessDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/analytics/business?view=${view}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Không thể tải dữ liệu.");
        return res.json();
      })
      .then((json: BusinessDashboardResponse) => setData(json))
      .catch((err) => setError(err.message || "Lỗi hệ thống"))
      .finally(() => setLoading(false));
  }, [view]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setView = (v: BusinessView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("bview", v);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleExport = () => {
    if (!data) return;
    const rows = data.points.map((p) => ({
      "Kỳ báo cáo": p.label,
      "Lượt check-in": p.checkinCount,
      "Doanh thu (VNĐ)": p.revenueVnd ?? "",
      "Điện năng (kWh)": p.energyKwh ?? "",
      "Loại dữ liệu": p.hasGap ? "Chưa có dữ liệu" : p.isEstimated ? "Ước tính" : "Thực tế",
    }));
    exportSheetToExcel(rows, "HieuQuaKinhDoanh", `Hieu_qua_kinh_doanh_${view}.xlsx`);
  };

  if (loading) {
    return (
      <div className="admin-card py-16 text-center">
        <Loader2 className="animate-spin mx-auto text-primary" size={28} />
      </div>
    );
  }

  if (error || !data) {
    return <div className="admin-card py-16 text-center text-red-500 text-sm">{error || "Không thể tải dữ liệu."}</div>;
  }

  const hasAnyMetrics = data.monthlyPoints.some((p) => p.revenueVnd !== null);
  const gapPeriods = data.points.filter((p) => p.hasGap);
  const combinedData = view === "month" ? buildCombinedChartData(data.monthlyPoints) : buildCombinedChartData(data.points);
  const ratioData = buildRatioChartData(data.points);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setView(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === opt.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors"
          >
            <Upload size={16} />
            Tải lên dữ liệu
          </button>
          <button
            onClick={handleExport}
            disabled={data.points.length === 0}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Download size={18} />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {!hasAnyMetrics ? (
        <div className="admin-card py-16 text-center">
          <Info className="mx-auto mb-3 text-muted-foreground" size={28} />
          <p className="text-muted-foreground text-sm">
            Chưa có dữ liệu doanh thu/điện năng nào được tải lên. Nhấn &quot;Tải lên dữ liệu&quot; để bắt đầu.
          </p>
        </div>
      ) : (
        <>
          {view !== "month" && (
            <div className="flex items-start gap-2 bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>
                Ước tính — phân bổ theo tỉ lệ lượt sạc: số liệu theo {view === "day" ? "ngày" : "tuần"} được phân bổ từ tổng
                doanh thu/điện năng của cả tháng, theo tỉ lệ số lượt check-in. Đường nét đứt màu xám thể hiện dữ liệu ước
                tính, khác với đường liền nét (dữ liệu thực tế đã tải lên).
              </span>
            </div>
          )}

          {gapPeriods.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>Chưa có dữ liệu tài chính cho: {gapPeriods.map((p) => p.label).join(", ")}.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              icon={<Zap size={16} />}
              label="kWh / lượt sạc"
              tooltip="Điện năng tiêu thụ trung bình cho mỗi lượt check-in, tính trên kỳ báo cáo gần nhất có dữ liệu."
              value={data.kpis.kwhPerCheckin !== null ? `${data.kpis.kwhPerCheckin} kWh` : "—"}
              mom={data.kpis.momKwhPerCheckinPct}
            />
            <KpiCard
              icon={<DollarSign size={16} />}
              label="VNĐ / lượt sạc"
              tooltip="Doanh thu trung bình cho mỗi lượt check-in, tính trên kỳ báo cáo gần nhất có dữ liệu."
              value={data.kpis.vndPerCheckin !== null ? `${data.kpis.vndPerCheckin.toLocaleString("vi-VN")} đ` : "—"}
              mom={data.kpis.momVndPerCheckinPct}
            />
            <KpiCard
              icon={<Gauge size={16} />}
              label="VNĐ / kWh"
              tooltip="Doanh thu trung bình trên mỗi kWh điện năng tiêu thụ, tính trên kỳ báo cáo gần nhất có dữ liệu."
              value={data.kpis.vndPerKwh !== null ? `${data.kpis.vndPerKwh.toLocaleString("vi-VN")} đ` : "—"}
              mom={data.kpis.momVndPerKwhPct}
            />
          </div>

          <div className="admin-card">
            <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
              Lượt check-in, điện năng &amp; doanh thu
              <MetricTooltip text="Cột: số lượt check-in. Đường xanh lá: điện năng (kWh). Đường vàng: doanh thu (VNĐ). Trục trái dùng cho lượt check-in và kWh, trục phải dùng cho doanh thu." />
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={combinedData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--foreground)", fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: "var(--foreground)", fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "var(--foreground)", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="checkinCount" name="Lượt check-in" fill={COLOR_CHECKINS} radius={[4, 4, 0, 0]} />
                <Line yAxisId="left" dataKey="kwhActual" name="Điện năng (kWh)" stroke={COLOR_KWH} strokeWidth={2} dot={false} connectNulls={false} />
                <Line yAxisId="left" dataKey="kwhEstimated" name="Điện năng - ước tính" stroke={COLOR_ESTIMATED} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
                <Line yAxisId="right" dataKey="revenueActual" name="Doanh thu (VNĐ)" stroke={COLOR_REVENUE} strokeWidth={2} dot={false} connectNulls={false} />
                <Line yAxisId="right" dataKey="revenueEstimated" name="Doanh thu - ước tính" stroke={COLOR_ESTIMATED} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="admin-card">
            <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
              Xu hướng tỉ lệ trên mỗi lượt sạc
              <MetricTooltip text="kWh và doanh thu tính trên mỗi lượt check-in theo thời gian — cho biết mỗi lượt sạc đang lớn hay nhỏ dần đi." />
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={ratioData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--foreground)", fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: "var(--foreground)", fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "var(--foreground)", fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="left" dataKey="kwhActual" name="kWh/lượt sạc" stroke={COLOR_KWH} strokeWidth={2} dot={false} connectNulls={false} />
                <Line yAxisId="left" dataKey="kwhEstimated" name="kWh/lượt sạc - ước tính" stroke={COLOR_ESTIMATED} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
                <Line yAxisId="right" dataKey="vndActual" name="VNĐ/lượt sạc" stroke={COLOR_REVENUE} strokeWidth={2} dot={false} connectNulls={false} />
                <Line yAxisId="right" dataKey="vndEstimated" name="VNĐ/lượt sạc - ước tính" stroke={COLOR_ESTIMATED} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {showUpload && (
        <BusinessUploadModal
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

export default function BusinessPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-card py-16 text-center">
          <Loader2 className="animate-spin mx-auto text-primary" size={28} />
        </div>
      }
    >
      <BusinessContent />
    </Suspense>
  );
}
