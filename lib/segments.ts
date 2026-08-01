// @/lib/segments.ts
// Pure classification of a customer's check-in regularity into one of 5
// mutually-exclusive segments, driven entirely by ANALYTICS_THRESHOLDS.customerHabits
// so the rules can be tuned in one place without touching this logic.
import { ANALYTICS_THRESHOLDS } from "./analyticsThresholds";

export type CustomerSegment = "daily" | "weekly" | "irregular" | "single" | "at_risk";

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  daily: "Đều đặn hàng ngày",
  weekly: "Đều đặn hàng tuần",
  irregular: "Không đều",
  single: "Chỉ 1 lần",
  at_risk: "Có nguy cơ rời bỏ",
};

export interface SegmentInput {
  checkinCount: number;
  frequencyPerWeek: number;
  /** Median gap between consecutive check-ins, in hours. null if fewer than 2 check-ins. */
  medianGapHours: number | null;
  /** IQR of the gap distribution, in hours. null if fewer than 2 gap values (i.e. < 3 check-ins). */
  iqrGapHours: number | null;
  /** Days since the customer's most recent check-in, relative to now. */
  daysSinceLast: number;
}

export interface SegmentThresholds {
  minCheckinsForRegularity: number;
  segments: {
    dailyMinPerWeek: number;
    dailyMaxIqrHours: number;
    weeklyMinPerWeek: number;
    weeklyMaxPerWeek: number;
    weeklyMaxIqrRatio: number;
    churnRiskGapMultiplier: number;
  };
}

export function classifyCustomerSegment(
  input: SegmentInput,
  thresholds: SegmentThresholds = ANALYTICS_THRESHOLDS.customerHabits
): CustomerSegment {
  const { checkinCount, frequencyPerWeek, medianGapHours, iqrGapHours, daysSinceLast } = input;
  const t = thresholds.segments;

  if (checkinCount <= 1) return "single";

  // Churn risk takes priority over regularity classification — a customer
  // who was extremely regular but has since gone quiet needs the warning,
  // not a stale "Đều đặn hàng ngày" badge.
  if (medianGapHours !== null) {
    const medianGapDays = medianGapHours / 24;
    if (daysSinceLast > medianGapDays * t.churnRiskGapMultiplier) return "at_risk";
  }

  if (checkinCount < thresholds.minCheckinsForRegularity || iqrGapHours === null || medianGapHours === null) {
    return "irregular";
  }

  if (frequencyPerWeek >= t.dailyMinPerWeek && iqrGapHours <= t.dailyMaxIqrHours) {
    return "daily";
  }

  if (
    frequencyPerWeek >= t.weeklyMinPerWeek &&
    frequencyPerWeek <= t.weeklyMaxPerWeek &&
    iqrGapHours <= medianGapHours * t.weeklyMaxIqrRatio
  ) {
    return "weekly";
  }

  return "irregular";
}
