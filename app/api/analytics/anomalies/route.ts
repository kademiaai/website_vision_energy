// app/api/analytics/anomalies/route.ts
// Dashboard 3: runs all 4 anomaly detectors over the full check-in history
// (no scheduled-job infra in this app, so detection runs lazily on page
// load — same precedent as evoucherService.expireOverdueVouchers), upserts
// any newly-found flags into checkin_flags (deduped by
// license_plate+flag_type+flagged_at so re-running never creates
// duplicates or disturbs an already-reviewed flag), then reads back the
// flag list joined with reviewer state for display.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { enumerateDateKeys, getCurrentVietnamDateISO, getVietnamDateKey, getVietnamHour } from "@/lib/timezone";
import {
  detectNewAccountBurstFlags,
  detectOffPatternHourFlags,
  detectRateChangeFlags,
  detectVelocityFlags,
  type CustomerRateInput,
  type DailyCount,
  type FlagSeverity,
} from "@/lib/anomalyDetection";
import { ANALYTICS_THRESHOLDS } from "@/lib/analyticsThresholds";
import type { AnomaliesResponse, AnomalyAlert, FlagType } from "@/lib/types/anomalies";

const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  rate_change: "Tăng đột biến",
  velocity: "Check-in quá nhanh",
  off_pattern_hour: "Giờ bất thường",
  new_account_burst: "Tài khoản mới hoạt động mạnh",
};

interface CandidateFlag {
  license_plate: string;
  flag_type: FlagType;
  flagged_at: string;
  severity: FlagSeverity;
  detail: Record<string, number>;
}

function buildReason(flagType: FlagType, detail: Record<string, number>): string {
  switch (flagType) {
    case "rate_change": {
      const pct = detail.baseline > 0 ? Math.round(((detail.count - detail.baseline) / detail.baseline) * 100) : null;
      return pct !== null
        ? `${detail.count} lượt/ngày so với mức thường lệ ${detail.baseline} lượt/ngày (+${pct}%)`
        : `${detail.count} lượt/ngày — tăng đột biến so với mức thường lệ gần như bằng 0`;
    }
    case "velocity":
      return `${detail.countInWindow} lượt check-in trong vòng ${detail.windowMinutes} phút`;
    case "off_pattern_hour":
      return `Check-in lúc ${String(detail.hour).padStart(2, "0")}:00, lệch ${detail.distanceHours}h so với khung giờ quen thuộc (~${Math.round(detail.typicalHour)}:00)`;
    case "new_account_burst":
      return `Tài khoản mới ${detail.accountAgeDays} ngày, tần suất ${detail.dailyRate} lượt/ngày (ngưỡng top 5%: ${detail.thresholdRate} lượt/ngày)`;
  }
}

export async function GET() {
  const [{ data: sessionsData, error: sessionsError }, { data: customersData, error: customersError }] = await Promise.all([
    supabaseServer.from("charging_sessions").select("license_plate, start_time").order("start_time", { ascending: true }).limit(20000),
    supabaseServer.from("customers").select("license_plate, created_at"),
  ]);

  if (sessionsError || customersError) {
    console.error("Lỗi truy vấn dữ liệu cảnh báo bất thường:", sessionsError || customersError);
    return NextResponse.json({ error: "Không thể tải dữ liệu." }, { status: 500 });
  }

  const sessions: { license_plate: string; start_time: string }[] = sessionsData || [];
  const customers: { license_plate: string; created_at: string }[] = customersData || [];

  const byPlate = new Map<string, { iso: string; ms: number; hour: number; dateKey: string }[]>();
  sessions.forEach((s) => {
    const list = byPlate.get(s.license_plate) || [];
    list.push({ iso: s.start_time, ms: new Date(s.start_time).getTime(), hour: getVietnamHour(s.start_time), dateKey: getVietnamDateKey(s.start_time) });
    byPlate.set(s.license_plate, list);
  });

  const nowMs = Date.now();
  const todayKey = getCurrentVietnamDateISO();
  const candidates: CandidateFlag[] = [];

  byPlate.forEach((events, plate) => {
    const isoTimes = events.map((e) => e.iso);
    const msTimes = events.map((e) => e.ms);
    const hours = events.map((e) => e.hour);

    // --- Rate-change: zero-filled daily counts from this customer's first check-in to today ---
    const dayKeys = enumerateDateKeys(events[0].dateKey, todayKey).slice(-400); // defensive cap for very old accounts
    const countByDate = new Map<string, number>();
    events.forEach((e) => countByDate.set(e.dateKey, (countByDate.get(e.dateKey) || 0) + 1));
    const dailyCounts: DailyCount[] = dayKeys.map((d) => ({ date: d, count: countByDate.get(d) || 0 }));

    detectRateChangeFlags(dailyCounts).forEach((f) => {
      candidates.push({
        license_plate: plate,
        flag_type: "rate_change",
        flagged_at: `${f.date}T12:00:00.000Z`,
        severity: f.severity,
        detail: { count: f.count, baseline: Math.round(f.baseline * 10) / 10, madValue: Math.round(f.madValue * 10) / 10 },
      });
    });

    // --- Velocity ---
    detectVelocityFlags(msTimes).forEach((f) => {
      candidates.push({
        license_plate: plate,
        flag_type: "velocity",
        flagged_at: new Date(f.timestampMs).toISOString(),
        severity: f.severity,
        detail: { countInWindow: f.countInWindow, windowMinutes: ANALYTICS_THRESHOLDS.anomalies.velocity.windowMinutes },
      });
    });

    // --- Off-pattern hour ---
    detectOffPatternHourFlags(hours).forEach((f) => {
      candidates.push({
        license_plate: plate,
        flag_type: "off_pattern_hour",
        flagged_at: isoTimes[f.index],
        severity: f.severity,
        detail: { hour: f.hour, typicalHour: Math.round(f.typicalHour * 10) / 10, distanceHours: Math.round(f.distanceHours * 10) / 10 },
      });
    });
  });

  // --- New-account burst (evaluated once, globally, across all customers) ---
  const customerRateInputs: CustomerRateInput[] = customers
    .filter((c) => (byPlate.get(c.license_plate)?.length || 0) > 0)
    .map((c) => {
      const events = byPlate.get(c.license_plate) || [];
      const accountAgeDays = Math.max(0, (nowMs - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const dailyRate = events.length / Math.max(1, accountAgeDays);
      return {
        licensePlate: c.license_plate,
        accountAgeDays: Math.round(accountAgeDays * 10) / 10,
        dailyRate: Math.round(dailyRate * 100) / 100,
      };
    });

  detectNewAccountBurstFlags(customerRateInputs).forEach((f) => {
    candidates.push({
      license_plate: f.licensePlate,
      flag_type: "new_account_burst",
      flagged_at: `${todayKey}T12:00:00.000Z`, // stable per-day anchor so re-running today never duplicates
      severity: f.severity,
      detail: { accountAgeDays: f.accountAgeDays, dailyRate: f.dailyRate, thresholdRate: Math.round(f.thresholdRate * 100) / 100 },
    });
  });

  if (candidates.length > 0) {
    const { error: upsertError } = await supabaseServer
      .from("checkin_flags")
      .upsert(candidates, { onConflict: "license_plate,flag_type,flagged_at", ignoreDuplicates: true });
    if (upsertError) {
      // Best-effort: still show whatever's already in the table rather than failing the whole page.
      console.error("Lỗi lưu cảnh báo bất thường:", upsertError);
    }
  }

  const { data: flagsData, error: flagsError } = await supabaseServer
    .from("checkin_flags")
    .select("id, license_plate, flag_type, flagged_at, severity, detail, reviewer_status, reviewed_by, reviewed_at, customers ( full_name )")
    .order("flagged_at", { ascending: false })
    .limit(200);

  if (flagsError) {
    console.error("Lỗi đọc danh sách cảnh báo:", flagsError);
    return NextResponse.json({ error: "Không thể tải danh sách cảnh báo." }, { status: 500 });
  }

  const sparklineStartMs = new Date(`${todayKey}T00:00:00Z`).getTime() - 29 * 24 * 60 * 60 * 1000;
  const sparklineStartKey = new Date(sparklineStartMs).toISOString().slice(0, 10);
  const sparklineDates = enumerateDateKeys(sparklineStartKey, todayKey);

  const alerts: AnomalyAlert[] = (flagsData || []).map((row: any) => {
    const events = byPlate.get(row.license_plate) || [];
    const countByDate = new Map<string, number>();
    events.forEach((e) => countByDate.set(e.dateKey, (countByDate.get(e.dateKey) || 0) + 1));
    const sparkline = sparklineDates.map((d) => ({ date: d, count: countByDate.get(d) || 0 }));

    const flaggedDateKey = getVietnamDateKey(row.flagged_at);
    const markedDate = sparklineDates.includes(flaggedDateKey) ? flaggedDateKey : null;

    return {
      id: row.id,
      licensePlate: row.license_plate,
      fullName: row.customers?.full_name ?? null,
      flagType: row.flag_type,
      flagTypeLabel: FLAG_TYPE_LABELS[row.flag_type as FlagType],
      severity: row.severity,
      flaggedAt: row.flagged_at,
      reason: buildReason(row.flag_type, row.detail),
      reviewerStatus: row.reviewer_status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      sparkline,
      markedDate,
    };
  });

  const response: AnomaliesResponse = { alerts };
  return NextResponse.json(response);
}
