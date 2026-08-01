import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAnalyticsRange } from "./analyticsRange";

// Frozen "now": 2026-01-15T10:00:00Z -> 2026-01-15T17:00:00 in Vietnam time.
const FROZEN_NOW = "2026-01-15T10:00:00.000Z";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FROZEN_NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resolveAnalyticsRange", () => {
  it('"today" starts at Vietnam midnight and ends now', () => {
    const result = resolveAnalyticsRange("today", null, null);
    expect(result.startISO).toBe("2026-01-14T17:00:00.000Z"); // 2026-01-15 00:00 +7
    expect(result.endISO).toBe(FROZEN_NOW);
  });

  it('"7d" starts 6 Vietnam calendar days before today', () => {
    const result = resolveAnalyticsRange("7d", null, null);
    // 2026-01-09 00:00 Vietnam = 2026-01-08T17:00:00Z
    expect(result.startISO).toBe("2026-01-08T17:00:00.000Z");
    expect(result.endISO).toBe(FROZEN_NOW);
  });

  it('"month" starts on the 1st of the current Vietnam month', () => {
    const result = resolveAnalyticsRange("month", null, null);
    // 2026-01-01 00:00 Vietnam = 2025-12-31T17:00:00Z
    expect(result.startISO).toBe("2025-12-31T17:00:00.000Z");
    expect(result.endISO).toBe(FROZEN_NOW);
  });

  it('"90d" starts 89 Vietnam calendar days before today', () => {
    const result = resolveAnalyticsRange("90d", null, null);
    const start = new Date(result.startISO);
    const todayStart = new Date("2026-01-14T17:00:00.000Z");
    const diffDays = (todayStart.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(89);
  });

  it('"custom" spans full Vietnam calendar days, inclusive of both endpoints', () => {
    const result = resolveAnalyticsRange("custom", "2026-01-01", "2026-01-03");
    expect(result.startISO).toBe("2025-12-31T17:00:00.000Z"); // Jan 1 00:00 +7
    expect(result.endISO).toBe("2026-01-03T16:59:59.999Z"); // Jan 3 23:59:59.999 +7
  });

  it('falls back to "7d" when custom start is after end', () => {
    const result = resolveAnalyticsRange("custom", "2026-01-10", "2026-01-01");
    expect(result.type).toBe("7d");
  });

  it('falls back to "7d" for an unrecognized range param', () => {
    const result = resolveAnalyticsRange("not-a-real-range", null, null);
    expect(result.type).toBe("7d");
  });

  it('falls back to "7d" when custom is selected without start/end', () => {
    const result = resolveAnalyticsRange("custom", null, null);
    expect(result.type).toBe("7d");
  });
});
