import { describe, expect, it } from "vitest";
import { classifyCustomerSegment } from "./segments";

describe("classifyCustomerSegment", () => {
  it('classifies a single check-in as "single"', () => {
    const result = classifyCustomerSegment({
      checkinCount: 1,
      frequencyPerWeek: 1,
      medianGapHours: null,
      iqrGapHours: null,
      daysSinceLast: 0,
    });
    expect(result).toBe("single");
  });

  it('flags "at_risk" when the current gap far exceeds 2x the median gap, overriding regularity', () => {
    // A customer who used to check in daily (median gap ~24h) but hasn't
    // been seen in 60 days — was regular, but now at risk.
    const result = classifyCustomerSegment({
      checkinCount: 20,
      frequencyPerWeek: 6,
      medianGapHours: 24,
      iqrGapHours: 4,
      daysSinceLast: 60,
    });
    expect(result).toBe("at_risk");
  });

  it('classifies high frequency + tight gap spread as "daily"', () => {
    const result = classifyCustomerSegment({
      checkinCount: 20,
      frequencyPerWeek: 6,
      medianGapHours: 24,
      iqrGapHours: 6,
      daysSinceLast: 1,
    });
    expect(result).toBe("daily");
  });

  it('classifies weekly-ish frequency + tight gap spread relative to median as "weekly"', () => {
    const result = classifyCustomerSegment({
      checkinCount: 8,
      frequencyPerWeek: 1,
      medianGapHours: 168, // ~7 days
      iqrGapHours: 20, // well under 0.5 * 168 = 84
      daysSinceLast: 2,
    });
    expect(result).toBe("weekly");
  });

  it('classifies wide gap spread relative to median as "irregular"', () => {
    const result = classifyCustomerSegment({
      checkinCount: 10,
      frequencyPerWeek: 1.2,
      medianGapHours: 100,
      iqrGapHours: 200, // huge spread relative to median
      daysSinceLast: 3,
    });
    expect(result).toBe("irregular");
  });

  it('falls back to "irregular" below the minimum check-in count for regularity, even with only 2 check-ins', () => {
    const result = classifyCustomerSegment({
      checkinCount: 2,
      frequencyPerWeek: 3,
      medianGapHours: 48,
      iqrGapHours: null, // only 1 gap value -> no IQR
      daysSinceLast: 1,
    });
    expect(result).toBe("irregular");
  });

  it("respects custom thresholds passed explicitly", () => {
    const looseThresholds = {
      minCheckinsForRegularity: 3,
      segments: {
        dailyMinPerWeek: 1, // much looser than default 5
        dailyMaxIqrHours: 999,
        weeklyMinPerWeek: 0.1,
        weeklyMaxPerWeek: 10,
        weeklyMaxIqrRatio: 10,
        churnRiskGapMultiplier: 2,
      },
    };
    const result = classifyCustomerSegment(
      { checkinCount: 5, frequencyPerWeek: 1.5, medianGapHours: 100, iqrGapHours: 50, daysSinceLast: 1 },
      looseThresholds
    );
    expect(result).toBe("daily");
  });
});
