// app/api/analytics/customer-habits/[plate]/route.ts
// Dashboard 2 drill-down: personal timeline, gap histogram, and a
// plain-Vietnamese summary sentence for one customer within the range.
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveAnalyticsRange } from "@/lib/analyticsRange";
import { computeCustomerMetrics, computeGapsHours } from "@/lib/customerHabits";
import { getVietnamDateKey, getVietnamHour, getVietnamWeekday } from "@/lib/timezone";
import type { CustomerHabitDetail, GapHistogramBin } from "@/lib/types/customerHabits";

const GAP_BINS: { label: string; maxHours: number }[] = [
  { label: "< 1 ngày", maxHours: 24 },
  { label: "1-2 ngày", maxHours: 48 },
  { label: "2-3 ngày", maxHours: 72 },
  { label: "3-5 ngày", maxHours: 120 },
  { label: "5-7 ngày", maxHours: 168 },
  { label: "> 7 ngày", maxHours: Infinity },
];

function buildGapHistogram(gapsHours: number[]): GapHistogramBin[] {
  const counts = new Array(GAP_BINS.length).fill(0);
  for (const gap of gapsHours) {
    const idx = GAP_BINS.findIndex((b) => gap <= b.maxHours);
    counts[idx === -1 ? GAP_BINS.length - 1 : idx]++;
  }
  return GAP_BINS.map((b, i) => ({ label: b.label, count: counts[i] }));
}

function timeOfDayLabel(hour: number): string {
  if (hour >= 5 && hour < 11) return "sáng";
  if (hour >= 11 && hour < 13) return "trưa";
  if (hour >= 13 && hour < 18) return "chiều";
  if (hour >= 18 && hour < 22) return "tối";
  return "đêm";
}

const WEEKDAY_FULL_VN = ["thứ 2", "thứ 3", "thứ 4", "thứ 5", "thứ 6", "thứ 7", "chủ nhật"];

function buildSummarySentence(
  checkinCount: number,
  modalHour: number | null,
  medianGapHours: number | null,
  weekdays: number[]
): string {
  if (checkinCount <= 1) {
    return "Chỉ có 1 lượt check-in trong khoảng thời gian đã chọn, chưa đủ dữ liệu để mô tả thói quen.";
  }

  const weekdayCounts = new Array(7).fill(0);
  weekdays.forEach((w) => weekdayCounts[w]++);
  const ranked = weekdayCounts
    .map((count, idx) => ({ idx, count }))
    .filter((w) => w.count > 0)
    .sort((a, b) => b.count - a.count);

  let dayPhrase = ranked.length > 0 ? WEEKDAY_FULL_VN[ranked[0].idx] : "";
  if (ranked.length > 1 && ranked[1].count >= ranked[0].count * 0.7) {
    dayPhrase = `${WEEKDAY_FULL_VN[ranked[0].idx]} và ${WEEKDAY_FULL_VN[ranked[1].idx]}`;
  }

  const timeLabel = modalHour !== null ? timeOfDayLabel(modalHour) : "";
  const leadIn = [timeLabel, dayPhrase].filter(Boolean).join(" ");
  const sentenceParts = [`Thường sạc vào ${leadIn}`.trim()];

  if (medianGapHours !== null) {
    const gapDays = (medianGapHours / 24).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
    sentenceParts.push(`trung bình ${gapDays} ngày/lần`);
  }

  return sentenceParts.join(", ") + ".";
}

export async function GET(request: NextRequest, context: { params: Promise<{ plate: string }> }) {
  const { plate } = await context.params;
  const cleanPlate = decodeURIComponent(plate).toUpperCase().replace(/[^A-Z0-9]/g, "");

  const searchParams = request.nextUrl.searchParams;
  const range = resolveAnalyticsRange(
    searchParams.get("range"),
    searchParams.get("start"),
    searchParams.get("end")
  );

  const { data, error } = await supabaseServer
    .from("charging_sessions")
    .select("start_time, customers ( full_name, phone_number )")
    .eq("license_plate", cleanPlate)
    .gte("start_time", range.startISO)
    .lte("start_time", range.endISO)
    .order("start_time", { ascending: true })
    .limit(5000);

  if (error) {
    console.error("Lỗi truy vấn charging_sessions cho drill-down:", error);
    return NextResponse.json({ error: "Không thể tải dữ liệu." }, { status: 500 });
  }

  const rows: { start_time: string; customers: { full_name: string | null; phone_number: string | null } | null }[] =
    data || [];

  if (rows.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy lượt check-in nào cho biển số này trong khoảng thời gian đã chọn." }, { status: 404 });
  }

  const times = rows.map((r) => r.start_time);
  const metrics = computeCustomerMetrics(times, range.daysInRange);
  const gapsHours = computeGapsHours(times);
  const weekdays = times.map(getVietnamWeekday);

  const detail: CustomerHabitDetail = {
    licensePlate: cleanPlate,
    fullName: rows[0].customers?.full_name ?? null,
    phoneNumber: rows[0].customers?.phone_number ?? null,
    ...metrics,
    timeline: times.map((t) => ({ date: getVietnamDateKey(t), hour: getVietnamHour(t) })),
    gapHistogram: buildGapHistogram(gapsHours),
    summarySentence: buildSummarySentence(metrics.checkinCount, metrics.modalHour, metrics.medianGapHours, weekdays),
  };

  return NextResponse.json(detail);
}
