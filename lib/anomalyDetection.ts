// @/lib/anomalyDetection.ts
// Pure statistical detectors for Dashboard 3 (Cảnh báo bất thường). Each
// function takes plain data in and returns candidate flags out — no
// Supabase/React dependency, so every rule can be unit tested directly.
// These are STATISTICAL SIGNALS for human review, not proof of misuse.
import { circularDistanceHours, circularMeanHour, mad, median, percentile } from "./stats";
import { ANALYTICS_THRESHOLDS } from "./analyticsThresholds";

export type FlagSeverity = "cao" | "trung_binh" | "thap";

// ------------------------------------------------------------------
// 1. Rate-change: today's count far exceeds this customer's own rolling
//    baseline (median + MAD of their trailing daily counts).
// ------------------------------------------------------------------
export interface DailyCount {
  date: string;
  count: number;
}

export interface RateChangeFlag {
  date: string;
  count: number;
  baseline: number;
  madValue: number;
  severity: FlagSeverity;
}

export interface RateChangeThresholds {
  minPriorDaysForBaseline: number;
  windowDays: number;
  madMultiplier: number;
  minRatioMultiplier: number;
  minAbsoluteCount: number;
}

/**
 * @param dailyCounts ascending by date, zero-filled (no missing days) —
 * one customer's daily check-in counts.
 */
export function detectRateChangeFlags(
  dailyCounts: DailyCount[],
  thresholds: RateChangeThresholds = ANALYTICS_THRESHOLDS.anomalies.rateChange
): RateChangeFlag[] {
  const flags: RateChangeFlag[] = [];

  for (let i = 0; i < dailyCounts.length; i++) {
    const windowStart = Math.max(0, i - thresholds.windowDays);
    const priorWindow = dailyCounts.slice(windowStart, i).map((d) => d.count);
    if (priorWindow.length < thresholds.minPriorDaysForBaseline) continue;

    const baseline = median(priorWindow);
    const madValue = mad(priorWindow);
    if (baseline === null || madValue === null) continue;

    const today = dailyCounts[i];
    const madThreshold = baseline + thresholds.madMultiplier * madValue;
    const ratioThreshold = baseline * thresholds.minRatioMultiplier;

    if (today.count >= madThreshold && today.count >= ratioThreshold && today.count >= thresholds.minAbsoluteCount) {
      const overshoot = madValue > 0 ? (today.count - baseline) / madValue : Infinity;
      const severity: FlagSeverity = overshoot >= 6 ? "cao" : overshoot >= 4 ? "trung_binh" : "thap";
      flags.push({ date: today.date, count: today.count, baseline, madValue, severity });
    }
  }

  return flags;
}

// ------------------------------------------------------------------
// 2. Velocity: too many check-ins within a window too short for a real
//    charge (e.g. 3+ within 60 minutes).
// ------------------------------------------------------------------
export interface VelocityFlag {
  windowStartMs: number;
  timestampMs: number;
  countInWindow: number;
  severity: FlagSeverity;
}

/** @param sortedTimestampsMs ascending, milliseconds since epoch — one customer's check-in times. */
export function detectVelocityFlags(
  sortedTimestampsMs: number[],
  windowMinutes: number = ANALYTICS_THRESHOLDS.anomalies.velocity.windowMinutes,
  minCount: number = ANALYTICS_THRESHOLDS.anomalies.velocity.minCount
): VelocityFlag[] {
  const flags: VelocityFlag[] = [];
  const windowMs = windowMinutes * 60 * 1000;

  let i = 0;
  while (i < sortedTimestampsMs.length) {
    let j = i;
    while (j < sortedTimestampsMs.length && sortedTimestampsMs[j] - sortedTimestampsMs[i] <= windowMs) j++;
    const countInWindow = j - i;

    if (countInWindow >= minCount) {
      const severity: FlagSeverity = countInWindow >= minCount + 3 ? "cao" : countInWindow >= minCount + 1 ? "trung_binh" : "thap";
      flags.push({
        windowStartMs: sortedTimestampsMs[i],
        timestampMs: sortedTimestampsMs[j - 1],
        countInWindow,
        severity,
      });
      i = j; // skip past this whole burst so one cluster produces one flag
    } else {
      i++;
    }
  }

  return flags;
}

// ------------------------------------------------------------------
// 3. Off-pattern hour: a check-in far from this customer's own usual hour,
//    only meaningful once they have an established pattern (>=20 check-ins).
// ------------------------------------------------------------------
export interface OffPatternHourFlag {
  index: number;
  hour: number;
  typicalHour: number;
  distanceHours: number;
  severity: FlagSeverity;
}

export function detectOffPatternHourFlags(
  hours: number[],
  minPriorCheckins: number = ANALYTICS_THRESHOLDS.anomalies.offPatternHour.minPriorCheckins,
  maxDistanceHours: number = ANALYTICS_THRESHOLDS.anomalies.offPatternHour.maxDistanceHours
): OffPatternHourFlag[] {
  if (hours.length < minPriorCheckins) return [];

  const typicalHour = circularMeanHour(hours);
  if (typicalHour === null) return [];

  const flags: OffPatternHourFlag[] = [];
  hours.forEach((hour, index) => {
    const distanceHours = circularDistanceHours(hour, typicalHour);
    if (distanceHours > maxDistanceHours) {
      const severity: FlagSeverity = distanceHours >= 10 ? "cao" : distanceHours >= 8 ? "trung_binh" : "thap";
      flags.push({ index, hour, typicalHour, distanceHours, severity });
    }
  });

  return flags;
}

// ------------------------------------------------------------------
// 4. New-account burst: a very young account with a daily rate in the top
//    slice of ALL customers.
// ------------------------------------------------------------------
export interface CustomerRateInput {
  licensePlate: string;
  accountAgeDays: number;
  dailyRate: number;
}

export interface NewAccountBurstFlag {
  licensePlate: string;
  accountAgeDays: number;
  dailyRate: number;
  thresholdRate: number;
  severity: FlagSeverity;
}

export interface NewAccountThresholds {
  maxAccountAgeDays: number;
  topPercentile: number;
  minCustomersForPercentile: number;
}

export function detectNewAccountBurstFlags(
  customers: CustomerRateInput[],
  thresholds: NewAccountThresholds = ANALYTICS_THRESHOLDS.anomalies.newAccountBurst
): NewAccountBurstFlag[] {
  if (customers.length < thresholds.minCustomersForPercentile) return [];

  const allRates = customers.map((c) => c.dailyRate);
  const thresholdRate = percentile(allRates, thresholds.topPercentile);
  if (thresholdRate === null) return [];

  return customers
    .filter((c) => c.accountAgeDays < thresholds.maxAccountAgeDays && c.dailyRate > thresholdRate)
    .map((c) => {
      const ratio = thresholdRate > 0 ? c.dailyRate / thresholdRate : Infinity;
      const severity: FlagSeverity = ratio >= 2 ? "cao" : ratio >= 1.5 ? "trung_binh" : "thap";
      return { licensePlate: c.licensePlate, accountAgeDays: c.accountAgeDays, dailyRate: c.dailyRate, thresholdRate, severity };
    });
}
