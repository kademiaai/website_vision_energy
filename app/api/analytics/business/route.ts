// app/api/analytics/business/route.ts
// Dashboard 4 aggregation: joins admin-uploaded business_metrics against
// actual check-in counts. The primary (and only "measured") series is
// monthly. Day/week views use an ACTUAL business_metrics row for that exact
// period if one was uploaded; otherwise they ESTIMATE by distributing the
// containing month's total in proportion to that day/week's share of the
// month's check-ins (isEstimated: true) — never presented as measured. A
// month with check-ins but no uploaded financial row is surfaced as an
// explicit gap (hasGap: true), never silently plotted as zero.
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getVietnamDateKey } from "@/lib/timezone";
import { enumeratePeriods, type BusinessGranularity } from "@/lib/businessMetricsParser";
import type { BusinessDashboardResponse, BusinessKpis, BusinessPoint, BusinessView } from "@/lib/types/business";

interface MetricRow {
  period: string;
  granularity: BusinessGranularity;
  revenue_vnd: number;
  energy_kwh: number;
}

function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return Math.round((a / b) * 100) / 100;
}

function pctChange(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

const EMPTY_KPIS: BusinessKpis = {
  latestPeriod: null,
  kwhPerCheckin: null,
  vndPerCheckin: null,
  vndPerKwh: null,
  momKwhPerCheckinPct: null,
  momVndPerCheckinPct: null,
  momVndPerKwhPct: null,
};

export async function GET(request: NextRequest) {
  const viewParam = request.nextUrl.searchParams.get("view");
  const view: BusinessView = viewParam === "day" || viewParam === "week" ? viewParam : "month";

  const [{ data: metricsData, error: metricsError }, { data: sessionData, error: sessionError }] = await Promise.all([
    supabaseServer.from("business_metrics").select("period, granularity, revenue_vnd, energy_kwh"),
    supabaseServer.from("charging_sessions").select("start_time").order("start_time", { ascending: true }).limit(20000),
  ]);

  if (metricsError || sessionError) {
    console.error("Lỗi truy vấn dữ liệu hiệu quả kinh doanh:", metricsError || sessionError);
    return NextResponse.json({ error: "Không thể tải dữ liệu." }, { status: 500 });
  }

  const metrics: MetricRow[] = metricsData || [];
  const sessions: { start_time: string }[] = sessionData || [];

  if (sessions.length === 0 && metrics.length === 0) {
    const empty: BusinessDashboardResponse = { view, monthlyPoints: [], points: [], kpis: EMPTY_KPIS };
    return NextResponse.json(empty);
  }

  // --- Check-in counts by day and by month (Vietnam calendar) ---
  const monthlyCheckinCounts = new Map<string, number>();
  const dailyCheckinCounts = new Map<string, number>();
  for (const s of sessions) {
    const dateKey = getVietnamDateKey(s.start_time);
    const monthKey = `${dateKey.slice(0, 7)}-01`;
    monthlyCheckinCounts.set(monthKey, (monthlyCheckinCounts.get(monthKey) || 0) + 1);
    dailyCheckinCounts.set(dateKey, (dailyCheckinCounts.get(dateKey) || 0) + 1);
  }

  const monthlyMetrics = new Map<string, { revenue_vnd: number; energy_kwh: number }>();
  const dayMetrics = new Map<string, { revenue_vnd: number; energy_kwh: number }>();
  const weekMetrics = new Map<string, { revenue_vnd: number; energy_kwh: number }>();
  metrics.forEach((m) => {
    const target = m.granularity === "month" ? monthlyMetrics : m.granularity === "day" ? dayMetrics : weekMetrics;
    target.set(m.period, { revenue_vnd: m.revenue_vnd, energy_kwh: m.energy_kwh });
  });

  const allMonthKeys = new Set<string>([...monthlyCheckinCounts.keys(), ...monthlyMetrics.keys()]);
  if (allMonthKeys.size === 0) {
    const empty: BusinessDashboardResponse = { view, monthlyPoints: [], points: [], kpis: EMPTY_KPIS };
    return NextResponse.json(empty);
  }

  const sortedMonthKeys = Array.from(allMonthKeys).sort();
  const fullMonthRange = enumeratePeriods(sortedMonthKeys[0], sortedMonthKeys[sortedMonthKeys.length - 1], "month");

  const monthlyPoints: BusinessPoint[] = fullMonthRange.map((monthKey) => {
    const checkinCount = monthlyCheckinCounts.get(monthKey) || 0;
    const metric = monthlyMetrics.get(monthKey);
    const [y, m] = monthKey.split("-");
    return {
      period: monthKey,
      label: `${m}/${y}`,
      checkinCount,
      revenueVnd: metric ? metric.revenue_vnd : null,
      energyKwh: metric ? metric.energy_kwh : null,
      isEstimated: false,
      hasGap: !metric && checkinCount > 0,
    };
  });

  // --- Derived KPIs: latest month with real data vs. the nearest prior month with real data ---
  const actualMonths = monthlyPoints.filter((p) => p.revenueVnd !== null && p.energyKwh !== null && p.checkinCount > 0);
  const latest = actualMonths[actualMonths.length - 1] ?? null;
  const previous = actualMonths.length >= 2 ? actualMonths[actualMonths.length - 2] : null;

  const latestKwhPerCheckin = latest ? ratio(latest.energyKwh, latest.checkinCount) : null;
  const latestVndPerCheckin = latest ? ratio(latest.revenueVnd, latest.checkinCount) : null;
  const latestVndPerKwh = latest ? ratio(latest.revenueVnd, latest.energyKwh) : null;
  const prevKwhPerCheckin = previous ? ratio(previous.energyKwh, previous.checkinCount) : null;
  const prevVndPerCheckin = previous ? ratio(previous.revenueVnd, previous.checkinCount) : null;
  const prevVndPerKwh = previous ? ratio(previous.revenueVnd, previous.energyKwh) : null;

  const kpis: BusinessKpis = {
    latestPeriod: latest?.period ?? null,
    kwhPerCheckin: latestKwhPerCheckin,
    vndPerCheckin: latestVndPerCheckin,
    vndPerKwh: latestVndPerKwh,
    momKwhPerCheckinPct: pctChange(latestKwhPerCheckin, prevKwhPerCheckin),
    momVndPerCheckinPct: pctChange(latestVndPerCheckin, prevVndPerCheckin),
    momVndPerKwhPct: pctChange(latestVndPerKwh, prevVndPerKwh),
  };

  // --- View-specific points (day/week are estimated unless an actual upload exists for that exact period) ---
  let points: BusinessPoint[] = monthlyPoints;

  if (view === "day" || view === "week") {
    const lastMonthKey = fullMonthRange[fullMonthRange.length - 1];
    const [lastY, lastM] = lastMonthKey.split("-").map(Number);
    const lastDayOfLastMonth = new Date(Date.UTC(lastY, lastM, 0)).getUTCDate();
    const rangeEndDateKey = `${lastMonthKey.slice(0, 7)}-${String(lastDayOfLastMonth).padStart(2, "0")}`;
    const allDayKeys = enumeratePeriods(fullMonthRange[0], rangeEndDateKey, "day");

    const estimateFromMonth = (checkinCount: number, monthKey: string) => {
      const monthMetric = monthlyMetrics.get(monthKey);
      if (!monthMetric) return { revenueVnd: null, energyKwh: null, isEstimated: false, hasGap: checkinCount > 0 };
      const monthCheckinTotal = monthlyCheckinCounts.get(monthKey) || 0;
      const share = monthCheckinTotal > 0 ? checkinCount / monthCheckinTotal : 0;
      return {
        revenueVnd: Math.round(monthMetric.revenue_vnd * share),
        energyKwh: Math.round(monthMetric.energy_kwh * share * 100) / 100,
        isEstimated: true,
        hasGap: false,
      };
    };

    if (view === "day") {
      points = allDayKeys.map((dayKey) => {
        const checkinCount = dailyCheckinCounts.get(dayKey) || 0;
        const actual = dayMetrics.get(dayKey);
        const monthKey = `${dayKey.slice(0, 7)}-01`;
        const computed = actual
          ? { revenueVnd: actual.revenue_vnd, energyKwh: actual.energy_kwh, isEstimated: false, hasGap: false }
          : estimateFromMonth(checkinCount, monthKey);
        const [, m, d] = dayKey.split("-");
        return { period: dayKey, label: `${d}/${m}`, checkinCount, ...computed };
      });
    } else {
      const weekBuckets = new Map<string, { checkinCount: number }>();
      allDayKeys.forEach((dayKey) => {
        const d = new Date(`${dayKey}T00:00:00Z`);
        const weekdayIdx = (d.getUTCDay() + 6) % 7; // 0 = Monday
        d.setUTCDate(d.getUTCDate() - weekdayIdx);
        const weekKey = d.toISOString().slice(0, 10);
        const bucket = weekBuckets.get(weekKey) || { checkinCount: 0 };
        bucket.checkinCount += dailyCheckinCounts.get(dayKey) || 0;
        weekBuckets.set(weekKey, bucket);
      });

      points = Array.from(weekBuckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekKey, bucket]) => {
          const actual = weekMetrics.get(weekKey);
          // A week is attributed to the month containing its Monday, for estimation purposes.
          const monthKey = `${weekKey.slice(0, 7)}-01`;
          const computed = actual
            ? { revenueVnd: actual.revenue_vnd, energyKwh: actual.energy_kwh, isEstimated: false, hasGap: false }
            : estimateFromMonth(bucket.checkinCount, monthKey);
          const [, m, d] = weekKey.split("-");
          return { period: weekKey, label: `${d}/${m}`, checkinCount: bucket.checkinCount, ...computed };
        });
    }
  }

  const response: BusinessDashboardResponse = { view, monthlyPoints, points, kpis };
  return NextResponse.json(response);
}
