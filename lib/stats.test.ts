import { describe, expect, it } from "vitest";
import {
  circularDistanceHours,
  circularMeanHour,
  findExtremeWindow,
  iqr,
  mad,
  median,
  modalBucket,
  percentile,
  slidingWindowSum,
} from "./stats";

describe("median", () => {
  it("returns the middle value for an odd-length array", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the two middle values for an even-length array", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("returns null for an empty array (insufficient-data guardrail)", () => {
    expect(median([])).toBeNull();
  });

  it("is robust to a single large outlier, unlike a mean", () => {
    // Mean of [1,2,3,4,1000] is 202 — wildly misleading. Median stays sane.
    expect(median([1, 2, 3, 4, 1000])).toBe(3);
  });
});

describe("percentile", () => {
  it("matches known quartile values for 1..9", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(percentile(values, 0.25)).toBe(3);
    expect(percentile(values, 0.75)).toBe(7);
  });

  it("does not require pre-sorted input", () => {
    expect(percentile([9, 1, 5, 3, 7, 2, 8, 4, 6], 0.5)).toBe(5);
  });
});

describe("iqr", () => {
  it("computes Q3 - Q1", () => {
    expect(iqr([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(4);
  });

  it("returns null with fewer than 2 values", () => {
    expect(iqr([5])).toBeNull();
    expect(iqr([])).toBeNull();
  });
});

describe("mad", () => {
  it("computes the median absolute deviation from the median", () => {
    expect(mad([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(2);
  });

  it("is near-zero for a tightly clustered sample even with one outlier", () => {
    // MAD should stay small; a std-dev based measure would be dragged up.
    expect(mad([3, 3, 3, 3, 100])).toBe(0);
  });

  it("returns null for an empty array", () => {
    expect(mad([])).toBeNull();
  });
});

describe("modalBucket", () => {
  it("returns the most frequent value", () => {
    expect(modalBucket(["a", "b", "a", "c", "a"])).toBe("a");
  });

  it("works with numbers", () => {
    expect(modalBucket([17, 17, 18, 19])).toBe(17);
  });

  it("returns null for an empty array", () => {
    expect(modalBucket([])).toBeNull();
  });
});

describe("circularMeanHour", () => {
  it("treats 23:00 and 01:00 as 2h apart, averaging to ~00:00 (not 12:00)", () => {
    const result = circularMeanHour([23, 1]);
    expect(result).not.toBeNull();
    // Circular mean should be ~0 (wrapping midpoint), a plain arithmetic
    // mean would wrongly give 12.
    const normalized = result! > 12 ? result! - 24 : result!;
    expect(Math.abs(normalized)).toBeLessThan(0.001);
  });

  it("returns the same hour when all values match", () => {
    expect(circularMeanHour([9, 9, 9])).toBeCloseTo(9, 6);
  });

  it("returns null for an empty array", () => {
    expect(circularMeanHour([])).toBeNull();
  });
});

describe("circularDistanceHours", () => {
  it("wraps around midnight — 23:00 and 01:00 are 2h apart", () => {
    expect(circularDistanceHours(23, 1)).toBe(2);
    expect(circularDistanceHours(1, 23)).toBe(2);
  });

  it("returns the max possible distance (12h) for opposite hours", () => {
    expect(circularDistanceHours(0, 12)).toBe(12);
  });

  it("returns 0 for identical hours", () => {
    expect(circularDistanceHours(5, 5)).toBe(0);
  });
});

describe("slidingWindowSum", () => {
  it("sums a plain in-bounds window", () => {
    const counts = [1, 2, 3, 4, 5];
    expect(slidingWindowSum(counts, 3, 0)).toBe(1 + 2 + 3);
    expect(slidingWindowSum(counts, 3, 2)).toBe(3 + 4 + 5);
  });

  it("wraps around the end of the array (24h clock)", () => {
    const counts = [10, 0, 0, 0, 0, 20]; // hours 0..5
    // window starting at hour 4, size 3 -> hours 4,5,0
    expect(slidingWindowSum(counts, 3, 4)).toBe(0 + 20 + 10);
  });
});

describe("findExtremeWindow", () => {
  it("finds the 3-hour band with the highest total (peak window)", () => {
    // 24 hourly buckets, all zero except a cluster at hours 17-19.
    const counts = new Array(24).fill(0);
    counts[17] = 5;
    counts[18] = 8;
    counts[19] = 4;
    const peak = findExtremeWindow(counts, 3, "max");
    expect(peak.startIndex).toBe(17);
    expect(peak.sum).toBe(17);
  });

  it("finds the quiet window, wrapping past midnight", () => {
    // Busy all day except hours 23,0,1 (wraps around midnight).
    const counts = new Array(24).fill(10);
    counts[23] = 0;
    counts[0] = 1;
    counts[1] = 0;
    const quiet = findExtremeWindow(counts, 3, "min");
    expect(quiet.startIndex).toBe(23);
    expect(quiet.sum).toBe(1);
  });

  it("resolves ties to the earliest window", () => {
    const counts = [5, 5, 5, 5];
    const peak = findExtremeWindow(counts, 2, "max");
    expect(peak.startIndex).toBe(0);
  });
});
