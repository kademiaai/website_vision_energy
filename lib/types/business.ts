// @/lib/types/business.ts
export type BusinessView = "month" | "week" | "day";

export interface BusinessPoint {
  /** "YYYY-MM-DD" — start of the period. */
  period: string;
  label: string;
  checkinCount: number;
  /** null when there's no actual or estimable financial data for this period at all. */
  revenueVnd: number | null;
  energyKwh: number | null;
  /** True when this point's revenue/energy was distributed from a coarser (monthly) upload rather than directly uploaded for this exact period. */
  isEstimated: boolean;
  /** True when checkins exist for this period but no financial data (actual or estimable) is available — render as a visible gap, not a silent zero. */
  hasGap: boolean;
}

export interface BusinessKpis {
  latestPeriod: string | null;
  kwhPerCheckin: number | null;
  vndPerCheckin: number | null;
  vndPerKwh: number | null;
  /** Month-over-month % change vs. the nearest prior month that also has actual (non-gap) data. */
  momKwhPerCheckinPct: number | null;
  momVndPerCheckinPct: number | null;
  momVndPerKwhPct: number | null;
}

export interface BusinessDashboardResponse {
  view: BusinessView;
  /** Always the monthly series — backs the combined chart and KPIs regardless of `view`. */
  monthlyPoints: BusinessPoint[];
  /** The series matching the requested `view` (same as monthlyPoints when view === "month"). */
  points: BusinessPoint[];
  kpis: BusinessKpis;
}
