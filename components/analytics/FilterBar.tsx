"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronDown } from "lucide-react";
import type { AnalyticsRangeType } from "@/lib/analyticsRange";

const RANGE_OPTIONS: { value: AnalyticsRangeType; label: string }[] = [
  { value: "today", label: "Hôm nay" },
  { value: "7d", label: "7 ngày" },
  { value: "month", label: "Tháng này" },
  { value: "90d", label: "90 ngày" },
  { value: "custom", label: "Tùy chọn" },
];

/**
 * Shared date-range + customer-search bar for the /admin/analytics section.
 * Filter state lives entirely in the URL query string (range/start/end/q) so
 * every dashboard page independently reads it via its own useSearchParams()
 * and views stay shareable/bookmarkable — this app has no existing
 * URL-synced filter precedent, so this is the first of its kind here.
 */
export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = (searchParams.get("range") as AnalyticsRangeType) || "7d";
  const start = searchParams.get("start") || "";
  const end = searchParams.get("end") || "";
  const q = searchParams.get("q") || "";

  const [searchDraft, setSearchDraft] = useState(q);

  // Keep the input in sync if the URL changes from elsewhere (back/forward nav).
  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleRangeChange = (value: AnalyticsRangeType) => {
    updateParams(value === "custom" ? { range: value } : { range: value, start: null, end: null });
  };

  // Debounce free-text search before pushing it into the URL.
  useEffect(() => {
    if (searchDraft === q) return;
    const timeout = setTimeout(() => updateParams({ q: searchDraft || null }), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  return (
    <div className="admin-card flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select
            value={range}
            onChange={(e) => handleRangeChange(e.target.value as AnalyticsRangeType)}
            className="admin-select pr-8"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>

        {range === "custom" && (
          <>
            <input
              type="date"
              value={start}
              onChange={(e) => updateParams({ start: e.target.value || null })}
              className="admin-input w-auto"
            />
            <span className="text-muted-foreground text-sm">đến</span>
            <input
              type="date"
              value={end}
              onChange={(e) => updateParams({ end: e.target.value || null })}
              className="admin-input w-auto"
            />
          </>
        )}
      </div>

      <div className="relative flex-1 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Tìm khách hàng (biển số, tên)..."
          className="admin-input pl-10"
        />
      </div>
    </div>
  );
}
