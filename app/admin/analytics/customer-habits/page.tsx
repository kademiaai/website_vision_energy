"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import MetricTooltip from "@/components/analytics/MetricTooltip";
import CustomerDrillDownModal from "@/components/analytics/CustomerDrillDownModal";
import { exportSheetToExcel } from "@/lib/exportExcel";
import type { CustomerHabitRow, CustomerHabitsResponse } from "@/lib/types/customerHabits";
import type { CustomerSegment } from "@/lib/segments";

const SEGMENT_BADGE_STYLES: Record<CustomerSegment, string> = {
  daily: "bg-green-500/10 text-green-600",
  weekly: "bg-blue-500/10 text-blue-600",
  irregular: "bg-amber-500/10 text-amber-600",
  single: "bg-muted text-muted-foreground",
  at_risk: "bg-red-500/10 text-red-600",
};

type SortField = "licensePlate" | "checkinCount" | "frequencyPerWeek" | "medianGapHours" | "iqrGapHours" | "daysSinceLast";

const ITEMS_PER_PAGE = 15;

function formatHourValue(hour: number | null): string {
  return hour !== null ? `${String(Math.round(hour)).padStart(2, "0")}:00` : "—";
}

function formatGapDays(hours: number | null): string {
  if (hours === null) return "Chưa đủ dữ liệu";
  return `${(hours / 24).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ngày`;
}

function CustomerHabitsContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<CustomerHabitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("checkinCount");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    ["range", "start", "end", "q"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) qs.set(key, value);
    });
    return qs.toString();
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/analytics/customer-habits?${queryString}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Không thể tải dữ liệu.");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setCurrentPage(1);
        }
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
  }, [queryString]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedCustomers = useMemo(() => {
    if (!data) return [];
    const rows = [...data.customers];
    rows.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      // Nulls (insufficient data) always sort last, regardless of direction.
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const diff = (aVal as number) - (bVal as number);
      return sortDirection === "asc" ? diff : -diff;
    });
    return rows;
  }, [data, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedCustomers.length / ITEMS_PER_PAGE));
  const pageRows = sortedCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleExport = () => {
    if (!data) return;
    const rows = sortedCustomers.map((c: CustomerHabitRow) => ({
      "Biển số": c.licensePlate,
      "Tên khách hàng": c.fullName || "---",
      "Phân khúc": c.segmentLabel,
      "Số lượt check-in": c.checkinCount,
      "Tần suất (lượt/tuần)": c.frequencyPerWeek,
      "Giờ quen thuộc": formatHourValue(c.modalHour),
      "Ngày quen thuộc": c.modalWeekdayLabel || "—",
      "Khoảng cách trung vị (ngày)": c.medianGapHours !== null ? Math.round((c.medianGapHours / 24) * 10) / 10 : "",
      "Độ đều đặn (IQR giờ)": c.iqrGapHours ?? "",
      "Ngày kể từ lần cuối": c.daysSinceLast,
    }));
    exportSheetToExcel(rows, "ThoiQuenKhachHang", `Thoi_quen_khach_hang_${data.range.type}.xlsx`);
  };

  const SortHeader = ({ field, label, tooltip }: { field: SortField; label: string; tooltip?: string }) => (
    <th className="cursor-pointer select-none" onClick={() => handleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {tooltip && <MetricTooltip text={tooltip} />}
        {sortField === field && <span className="text-primary">{sortDirection === "asc" ? "↑" : "↓"}</span>}
      </span>
    </th>
  );

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.customers.length} khách hàng có check-in trong khoảng thời gian đã chọn</p>
        <button
          onClick={handleExport}
          disabled={data.customers.length === 0}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Download size={18} />
          <span>Xuất Excel</span>
        </button>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <SortHeader field="licensePlate" label="Biển số" />
              <th>Tên khách hàng</th>
              <th>Phân khúc</th>
              <SortHeader
                field="frequencyPerWeek"
                label="Tần suất"
                tooltip="Số lượt check-in trung bình mỗi tuần, tính trên khoảng thời gian đã chọn."
              />
              <th>
                Giờ quen thuộc
                <MetricTooltip text="Giờ xuất hiện nhiều nhất (mode) trong các lượt check-in. Tính theo giờ Việt Nam." />
              </th>
              <th>
                Ngày quen thuộc
                <MetricTooltip text="Ngày trong tuần xuất hiện nhiều nhất trong các lượt check-in." />
              </th>
              <SortHeader
                field="medianGapHours"
                label="Khoảng cách trung vị"
                tooltip="Trung vị số ngày giữa 2 lần check-in liên tiếp. Dùng trung vị thay vì trung bình vì ít bị ảnh hưởng bởi các giá trị bất thường."
              />
              <SortHeader
                field="iqrGapHours"
                label="Độ đều đặn"
                tooltip="Khoảng tứ phân vị (IQR) của khoảng cách giữa các lần check-in, tính bằng giờ. Giá trị càng thấp, thói quen càng đều đặn."
              />
              <SortHeader field="daysSinceLast" label="Lần cuối" tooltip="Số ngày kể từ lượt check-in gần nhất tính đến hôm nay." />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => (
              <tr key={c.licensePlate} className="cursor-pointer" onClick={() => setSelectedPlate(c.licensePlate)}>
                <td className="font-medium text-foreground">{c.licensePlate}</td>
                <td>{c.fullName || "---"}</td>
                <td>
                  <span className={`badge ${SEGMENT_BADGE_STYLES[c.segment]}`}>{c.segmentLabel}</span>
                </td>
                <td>{c.frequencyPerWeek}</td>
                <td>{formatHourValue(c.modalHour)}</td>
                <td>{c.modalWeekdayLabel || "—"}</td>
                <td>{formatGapDays(c.medianGapHours)}</td>
                <td>{c.iqrGapHours !== null ? `${c.iqrGapHours}h` : "Chưa đủ dữ liệu"}</td>
                <td>{c.daysSinceLast} ngày</td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  Không có khách hàng nào phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-card border border-border disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-muted-foreground">
            Trang {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-card border border-border disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {selectedPlate && (
        <CustomerDrillDownModal
          licensePlate={selectedPlate}
          queryString={queryString.replace(/&?q=[^&]*/, "")}
          onClose={() => setSelectedPlate(null)}
        />
      )}
    </div>
  );
}

export default function CustomerHabitsPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-card py-16 text-center">
          <Loader2 className="animate-spin mx-auto text-primary" size={28} />
        </div>
      }
    >
      <CustomerHabitsContent />
    </Suspense>
  );
}
