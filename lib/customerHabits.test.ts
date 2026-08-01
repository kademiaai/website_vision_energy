import { describe, expect, it } from "vitest";
import { computeCustomerMetrics } from "./customerHabits";

describe("computeCustomerMetrics", () => {
  it("computes gap-based stats for a regular weekly pattern", () => {
    // 4 check-ins exactly 7 days apart -> median/IQR gap should be ~168h, IQR ~0.
    const times = [
      "2026-01-01T04:00:00.000Z",
      "2026-01-08T04:00:00.000Z",
      "2026-01-15T04:00:00.000Z",
      "2026-01-22T04:00:00.000Z",
    ];
    const now = new Date("2026-01-23T04:00:00.000Z").getTime();
    const result = computeCustomerMetrics(times, 28, now);

    expect(result.checkinCount).toBe(4);
    expect(result.medianGapHours).toBe(168);
    expect(result.iqrGapHours).toBe(0);
    expect(result.daysSinceLast).toBe(1);
    expect(result.frequencyPerWeek).toBe(1); // 4 check-ins / (28/7 weeks)
    expect(result.segment).toBe("weekly");
  });

  it("returns null gap stats for a single check-in and segments as single", () => {
    const result = computeCustomerMetrics(["2026-01-01T04:00:00.000Z"], 7, new Date("2026-01-02T04:00:00.000Z").getTime());
    expect(result.medianGapHours).toBeNull();
    expect(result.iqrGapHours).toBeNull();
    expect(result.segment).toBe("single");
  });

  it("returns null IQR (but a real median) for exactly 2 check-ins", () => {
    const result = computeCustomerMetrics(
      ["2026-01-01T04:00:00.000Z", "2026-01-02T04:00:00.000Z"],
      7,
      new Date("2026-01-02T10:00:00.000Z").getTime()
    );
    expect(result.medianGapHours).toBe(24);
    expect(result.iqrGapHours).toBeNull();
  });

  it("flags at_risk when the customer has gone quiet well past their usual gap", () => {
    const times = [
      "2025-11-01T04:00:00.000Z",
      "2025-11-02T04:00:00.000Z",
      "2025-11-03T04:00:00.000Z",
      "2025-11-04T04:00:00.000Z",
    ];
    // Daily pattern (median gap 24h), but "now" is 30 days after the last check-in.
    const now = new Date("2025-12-04T04:00:00.000Z").getTime();
    const result = computeCustomerMetrics(times, 34, now);
    expect(result.segment).toBe("at_risk");
  });
});
