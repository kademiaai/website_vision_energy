// @/lib/analyticsRange.ts
// Resolves the analytics section's shared URL filter params (range/start/end)
// into concrete UTC ISO boundaries, computed against Vietnam calendar days —
// shared by the client FilterBar and every /api/analytics/* route so the
// two never disagree about what "7 ngày" or "Tháng này" actually means.
import { getCurrentVietnamDate } from "./timezone";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export type AnalyticsRangeType = "today" | "7d" | "month" | "90d" | "custom";

export interface AnalyticsRange {
  type: AnalyticsRangeType;
  /** Inclusive lower bound, UTC ISO. */
  startISO: string;
  /** Upper bound, UTC ISO — "now" for quick ranges, end-of-day for custom. */
  endISO: string;
}

/** Start of a given Vietnam calendar day (00:00:00 local), as a UTC Date. */
function vietnamDateStartUTC(year: number, month: number, day: number): Date {
  const startUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  startUTC.setTime(startUTC.getTime() - VIETNAM_OFFSET_MS);
  return startUTC;
}

function parseDateParam(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

const VALID_RANGE_TYPES: AnalyticsRangeType[] = ["today", "7d", "month", "90d", "custom"];

/**
 * Resolve the `range` (+ optional `start`/`end` for "custom") URL params
 * into concrete UTC ISO boundaries. Falls back to "7d" for a missing/unknown
 * range value, and falls back to "7d" if "custom" is selected without valid
 * start/end dates.
 */
export function resolveAnalyticsRange(
  rangeParam: string | null,
  startParam: string | null,
  endParam: string | null
): AnalyticsRange {
  const now = new Date();
  const { day, month, year } = getCurrentVietnamDate();
  const todayStart = vietnamDateStartUTC(year, month, day);

  const requestedType = VALID_RANGE_TYPES.includes(rangeParam as AnalyticsRangeType)
    ? (rangeParam as AnalyticsRangeType)
    : "7d";

  if (requestedType === "custom" && startParam && endParam) {
    const startDate = parseDateParam(startParam);
    const endDate = parseDateParam(endParam);
    if (startDate && endDate) {
      const startUTC = vietnamDateStartUTC(startDate.year, startDate.month, startDate.day);
      const endDayStartUTC = vietnamDateStartUTC(endDate.year, endDate.month, endDate.day);
      const endUTC = new Date(endDayStartUTC.getTime() + 24 * 60 * 60 * 1000 - 1);
      // A start date after the end date is a malformed filter — fall back
      // rather than return an inverted (empty) range silently.
      if (startUTC.getTime() <= endUTC.getTime()) {
        return { type: "custom", startISO: startUTC.toISOString(), endISO: endUTC.toISOString() };
      }
    }
  }

  if (requestedType === "today") {
    return { type: "today", startISO: todayStart.toISOString(), endISO: now.toISOString() };
  }

  if (requestedType === "month") {
    const monthStart = vietnamDateStartUTC(year, month, 1);
    return { type: "month", startISO: monthStart.toISOString(), endISO: now.toISOString() };
  }

  const daysBack = requestedType === "90d" ? 89 : 6; // inclusive of today
  const startUTC = new Date(todayStart.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { type: requestedType === "90d" ? "90d" : "7d", startISO: startUTC.toISOString(), endISO: now.toISOString() };
}
