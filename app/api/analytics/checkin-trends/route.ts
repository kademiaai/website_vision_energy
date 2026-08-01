// app/api/analytics/checkin-trends/route.ts
// Dashboard 1 aggregation: fetches charging_sessions in the requested range
// and computes everything server-side (KPIs, 7x24 heatmap, hour/weekday
// bars, daily line + moving average, auto-summary text) — the browser only
// ever receives the aggregated result, never the raw rows. Protected by
// middleware.ts's /api/analytics/:path* auth guard.
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveAnalyticsRange } from "@/lib/analyticsRange";
import {
  enumerateDateKeys,
  getVietnamDateKey,
  getVietnamHour,
  getVietnamWeekday,
  VIETNAM_WEEKDAY_LABELS,
} from "@/lib/timezone";
import { findExtremeWindow, modalBucket } from "@/lib/stats";
import { ANALYTICS_THRESHOLDS } from "@/lib/analyticsThresholds";
import type { CheckinTrendsResponse, DailyLinePoint, HeatmapCell } from "@/lib/types/checkinTrends";

const T = ANALYTICS_THRESHOLDS.checkinTrends;

function argMinIndex(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[best]) best = i;
  }
  return best;
}

function formatHourBand(startHour: number, windowSize: number): string {
  const endHour = (startHour + windowSize) % 24;
  const pad = (h: number) => String(h).padStart(2, "0");
  return `${pad(startHour)}:00–${pad(endHour)}:00`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const range = resolveAnalyticsRange(
    searchParams.get("range"),
    searchParams.get("start"),
    searchParams.get("end")
  );

  const { data, error } = await supabaseServer
    .from("charging_sessions")
    .select("start_time")
    .gte("start_time", range.startISO)
    .lte("start_time", range.endISO)
    .order("start_time", { ascending: true })
    .limit(20000);

  if (error) {
    console.error("Lỗi truy vấn charging_sessions cho analytics:", error);
    return NextResponse.json({ error: "Không thể tải dữ liệu check-in." }, { status: 500 });
  }

  const rows: { start_time: string }[] = data || [];
  const total = rows.length;

  const hours = rows.map((r) => getVietnamHour(r.start_time));
  const weekdays = rows.map((r) => getVietnamWeekday(r.start_time));
  const dateKeys = rows.map((r) => getVietnamDateKey(r.start_time));

  const hourCounts = new Array(24).fill(0);
  hours.forEach((h) => hourCounts[h]++);

  const weekdayCounts = new Array(7).fill(0);
  weekdays.forEach((w) => weekdayCounts[w]++);

  const rangeStartKey = getVietnamDateKey(range.startISO);
  const rangeEndKey = getVietnamDateKey(range.endISO);
  const { daysInRange } = range;

  // --- KPIs ---
  const dailyAverage = daysInRange > 0 ? Math.round((total / daysInRange) * 10) / 10 : null;

  let peakHour: CheckinTrendsResponse["kpis"]["peakHour"] = null;
  let peakWeekday: CheckinTrendsResponse["kpis"]["peakWeekday"] = null;
  let quietestHour: CheckinTrendsResponse["kpis"]["quietestHour"] = null;

  if (total >= T.minForPeakStats) {
    const peakHourValue = modalBucket(hours);
    if (peakHourValue !== null) {
      const count = hourCounts[peakHourValue];
      peakHour = { hour: peakHourValue, count, pct: Math.round((count / total) * 100) };
    }

    const peakWeekdayValue = modalBucket(weekdays);
    if (peakWeekdayValue !== null) {
      const count = weekdayCounts[peakWeekdayValue];
      peakWeekday = {
        weekdayIndex: peakWeekdayValue,
        label: VIETNAM_WEEKDAY_LABELS[peakWeekdayValue],
        count,
        pct: Math.round((count / total) * 100),
      };
    }

    const quietestHourValue = argMinIndex(hourCounts);
    quietestHour = { hour: quietestHourValue, count: hourCounts[quietestHourValue] };
  }

  // --- Heatmap (7 weekdays x 24 hours) ---
  let heatmap: HeatmapCell[] | null = null;
  if (total >= T.minForHeatmap) {
    const grid = new Map<string, number>();
    for (let i = 0; i < total; i++) {
      const key = `${weekdays[i]}-${hours[i]}`;
      grid.set(key, (grid.get(key) || 0) + 1);
    }
    heatmap = [];
    for (let weekdayIndex = 0; weekdayIndex < 7; weekdayIndex++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmap.push({ weekdayIndex, hour, count: grid.get(`${weekdayIndex}-${hour}`) || 0 });
      }
    }
  }

  // --- Hour / weekday bar charts ---
  const hourBar =
    total >= T.minForHourWeekdayCharts
      ? hourCounts.map((count, hour) => ({ hour, count }))
      : null;
  const weekdayBar =
    total >= T.minForHourWeekdayCharts
      ? weekdayCounts.map((count, weekdayIndex) => ({
          weekdayIndex,
          label: VIETNAM_WEEKDAY_LABELS[weekdayIndex],
          count,
        }))
      : null;

  // --- Daily line + 7-day moving average ---
  const countByDate = new Map<string, number>();
  dateKeys.forEach((k) => countByDate.set(k, (countByDate.get(k) || 0) + 1));
  const orderedDateKeys = enumerateDateKeys(rangeStartKey, rangeEndKey);
  const rawSeries = orderedDateKeys.map((date) => ({ date, count: countByDate.get(date) || 0 }));

  const showMovingAverage = daysInRange >= T.minDaysForMovingAverage;
  const dailyLine: DailyLinePoint[] = rawSeries.map((point, i) => {
    if (!showMovingAverage || i < 6) return { ...point, movingAvg7: null };
    const window = rawSeries.slice(i - 6, i + 1).map((p) => p.count);
    const avg = window.reduce((sum, v) => sum + v, 0) / 7;
    return { ...point, movingAvg7: Math.round(avg * 10) / 10 };
  });

  // --- Auto-generated summary text ---
  let summaryText: string | null = null;
  if (total >= T.minForSummaryText) {
    const peakWindow = findExtremeWindow(hourCounts, 3, "max");
    const quietWindow = findExtremeWindow(hourCounts, 3, "min");
    const peakPct = Math.round((peakWindow.sum / total) * 100);
    summaryText = `Giờ cao điểm: ${formatHourBand(peakWindow.startIndex, 3)} (chiếm ${peakPct}% lượt sạc). Khung giờ thấp điểm: ${formatHourBand(quietWindow.startIndex, 3)}.`;
  }

  const response: CheckinTrendsResponse = {
    range: { type: range.type, startISO: range.startISO, endISO: range.endISO, daysInRange },
    kpis: { total, dailyAverage, peakHour, peakWeekday, quietestHour },
    heatmap,
    hourBar,
    weekdayBar,
    dailyLine,
    summaryText,
  };

  return NextResponse.json(response);
}
