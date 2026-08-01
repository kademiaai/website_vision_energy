import { describe, expect, it } from "vitest";
import {
  detectNewAccountBurstFlags,
  detectOffPatternHourFlags,
  detectRateChangeFlags,
  detectVelocityFlags,
} from "./anomalyDetection";

describe("detectRateChangeFlags", () => {
  const looseThresholds = {
    minPriorDaysForBaseline: 7,
    windowDays: 28,
    madMultiplier: 3,
    minRatioMultiplier: 1.5,
    minAbsoluteCount: 3,
  };

  it("does not flag a steady baseline", () => {
    const dailyCounts = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      count: 3,
    }));
    const flags = detectRateChangeFlags(dailyCounts, looseThresholds);
    expect(flags).toEqual([]);
  });

  it("flags a day that spikes well above baseline + 3*MAD, ratio, and absolute floor", () => {
    // 10 steady days at count=3 (MAD=0), then a spike to 10.
    const dailyCounts = [
      ...Array.from({ length: 10 }, (_, i) => ({ date: `d${i}`, count: 3 })),
      { date: "spike", count: 10 },
    ];
    const flags = detectRateChangeFlags(dailyCounts, looseThresholds);
    expect(flags).toHaveLength(1);
    expect(flags[0].date).toBe("spike");
    expect(flags[0].baseline).toBe(3);
  });

  it("does not flag with fewer than minPriorDaysForBaseline days of history", () => {
    const dailyCounts = [
      { date: "d1", count: 3 },
      { date: "d2", count: 3 },
      { date: "d3", count: 10 }, // only 2 days of prior history — too thin
    ];
    const flags = detectRateChangeFlags(dailyCounts, looseThresholds);
    expect(flags).toEqual([]);
  });

  it("respects the absolute floor so 1 -> 2 never flags even against a near-zero baseline", () => {
    const dailyCounts = [
      ...Array.from({ length: 10 }, (_, i) => ({ date: `d${i}`, count: 0 })),
      { date: "d10", count: 2 }, // ratio and MAD conditions might pass, but absolute floor is 3
    ];
    const flags = detectRateChangeFlags(dailyCounts, looseThresholds);
    expect(flags).toEqual([]);
  });
});

describe("detectVelocityFlags", () => {
  const HOUR = 60 * 60 * 1000;
  const MIN = 60 * 1000;

  it("does not flag check-ins spread well apart", () => {
    const timestamps = [0, 2 * HOUR, 4 * HOUR];
    expect(detectVelocityFlags(timestamps, 60, 3)).toEqual([]);
  });

  it("flags 3+ check-ins within the window", () => {
    const timestamps = [0, 10 * MIN, 20 * MIN];
    const flags = detectVelocityFlags(timestamps, 60, 3);
    expect(flags).toHaveLength(1);
    expect(flags[0].countInWindow).toBe(3);
  });

  it("produces one flag per burst, not one per overlapping window", () => {
    // 5 check-ins all within a 30-minute span -> should be a single flag, not 3.
    const timestamps = [0, 5 * MIN, 10 * MIN, 15 * MIN, 20 * MIN];
    const flags = detectVelocityFlags(timestamps, 60, 3);
    expect(flags).toHaveLength(1);
    expect(flags[0].countInWindow).toBe(5);
  });

  it("separates two distinct bursts far apart in time", () => {
    const timestamps = [0, 5 * MIN, 10 * MIN, 5 * HOUR, 5 * HOUR + 5 * MIN, 5 * HOUR + 10 * MIN];
    const flags = detectVelocityFlags(timestamps, 60, 3);
    expect(flags).toHaveLength(2);
  });
});

describe("detectOffPatternHourFlags", () => {
  it("does not flag below the minimum prior check-in count", () => {
    const hours = [9, 9, 9, 23]; // only 4 check-ins, need 20
    expect(detectOffPatternHourFlags(hours, 20, 6)).toEqual([]);
  });

  it("flags a check-in far outside the customer's usual hour once they have enough history", () => {
    const hours = [...Array(20).fill(9), 22]; // usual hour ~9am, one at 10pm
    const flags = detectOffPatternHourFlags(hours, 20, 6);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[flags.length - 1].hour).toBe(22);
  });

  it("does not flag hours within the tolerance band", () => {
    const hours = [...Array(20).fill(9), 12]; // 3h away, within 6h tolerance
    const flags = detectOffPatternHourFlags(hours, 20, 6);
    expect(flags).toEqual([]);
  });
});

describe("detectNewAccountBurstFlags", () => {
  const thresholds = { maxAccountAgeDays: 7, topPercentile: 0.95, minCustomersForPercentile: 10 };

  it("does not flag below the minimum customer count for a meaningful percentile", () => {
    const customers = Array.from({ length: 5 }, (_, i) => ({
      licensePlate: `P${i}`,
      accountAgeDays: 1,
      dailyRate: 10,
    }));
    expect(detectNewAccountBurstFlags(customers, thresholds)).toEqual([]);
  });

  it("flags a young account with an outlier-high daily rate", () => {
    const customers = [
      ...Array.from({ length: 15 }, (_, i) => ({ licensePlate: `OLD${i}`, accountAgeDays: 100, dailyRate: 1 })),
      { licensePlate: "NEW1", accountAgeDays: 2, dailyRate: 20 },
    ];
    const flags = detectNewAccountBurstFlags(customers, thresholds);
    expect(flags.some((f) => f.licensePlate === "NEW1")).toBe(true);
  });

  it("does not flag an old account even with a high rate", () => {
    const customers = [
      ...Array.from({ length: 15 }, (_, i) => ({ licensePlate: `OLD${i}`, accountAgeDays: 100, dailyRate: 1 })),
      { licensePlate: "ESTABLISHED", accountAgeDays: 30, dailyRate: 20 },
    ];
    const flags = detectNewAccountBurstFlags(customers, thresholds);
    expect(flags.some((f) => f.licensePlate === "ESTABLISHED")).toBe(false);
  });

  it("does not flag a young account with an unremarkable rate", () => {
    const customers = Array.from({ length: 15 }, (_, i) => ({ licensePlate: `P${i}`, accountAgeDays: 100, dailyRate: 1 }));
    customers.push({ licensePlate: "NEW1", accountAgeDays: 2, dailyRate: 1 });
    const flags = detectNewAccountBurstFlags(customers, thresholds);
    expect(flags.some((f) => f.licensePlate === "NEW1")).toBe(false);
  });
});
