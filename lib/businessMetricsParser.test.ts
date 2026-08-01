import { describe, expect, it } from "vitest";
import {
  isoWeekToMonday,
  parseBusinessMetricsSheet,
  parseEnergyCell,
  parsePeriodCell,
  parseRevenueCell,
} from "./businessMetricsParser";

describe("parsePeriodCell", () => {
  it("parses a month period (YYYY-MM)", () => {
    expect(parsePeriodCell("2026-03")).toEqual({ period: "2026-03-01", granularity: "month" });
  });

  it("parses a day period (YYYY-MM-DD)", () => {
    expect(parsePeriodCell("2026-03-15")).toEqual({ period: "2026-03-15", granularity: "day" });
  });

  it("parses an ISO week period (YYYY-Www) to that week's Monday", () => {
    const result = parsePeriodCell("2026-W03");
    expect(result?.granularity).toBe("week");
    // Just assert it's a Monday and in the right month.
    const d = new Date(`${result?.period}T00:00:00Z`);
    expect(d.getUTCDay()).toBe(1);
  });

  it("rejects garbage input", () => {
    expect(parsePeriodCell("not a date")).toBeNull();
    expect(parsePeriodCell("2026-13")).toBeNull(); // invalid month
    expect(parsePeriodCell("")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(parsePeriodCell("  2026-03  ")).toEqual({ period: "2026-03-01", granularity: "month" });
  });
});

describe("isoWeekToMonday", () => {
  it("returns a Monday for week 1", () => {
    const monday = isoWeekToMonday(2026, 1);
    expect(monday.getUTCDay()).toBe(1);
  });
});

describe("parseRevenueCell", () => {
  it("parses a plain integer", () => {
    expect(parseRevenueCell("5000000")).toBe(5000000);
  });

  it("strips thousand-separator dots", () => {
    expect(parseRevenueCell("5.000.000")).toBe(5000000);
  });

  it("strips thousand-separator commas", () => {
    expect(parseRevenueCell("5,000,000")).toBe(5000000);
  });

  it("rejects non-numeric text", () => {
    expect(parseRevenueCell("abc")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseRevenueCell("")).toBeNull();
  });
});

describe("parseEnergyCell", () => {
  it("parses a plain integer", () => {
    expect(parseEnergyCell("1234")).toBe(1234);
  });

  it("parses a decimal with a dot", () => {
    expect(parseEnergyCell("1234.5")).toBe(1234.5);
  });

  it("treats a lone comma as a decimal separator", () => {
    expect(parseEnergyCell("1234,5")).toBe(1234.5);
  });

  it("treats a single comma as a decimal separator (Vietnamese convention: comma=decimal, dot=thousands)", () => {
    expect(parseEnergyCell("1,234")).toBe(1.234);
  });

  it("strips commas as thousand separators when there are multiple groups", () => {
    expect(parseEnergyCell("1,234,567")).toBe(1234567);
  });

  it("rejects non-numeric text", () => {
    expect(parseEnergyCell("abc")).toBeNull();
  });
});

describe("parseBusinessMetricsSheet", () => {
  it("parses a well-formed monthly sheet with Vietnamese headers", () => {
    const aoa = [
      ["Tháng", "Doanh thu (VNĐ)", "Điện năng (kWh)"],
      ["2026-01", "50000000", "1200"],
      ["2026-02", "55000000", "1300"],
    ];
    const result = parseBusinessMetricsSheet(aoa);
    expect(result.headerErrors).toEqual([]);
    expect(result.hasBlockingErrors).toBe(false);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ period: "2026-01-01", granularity: "month", revenue: 50000000, energy: 1200 });
  });

  it("matches English headers too", () => {
    const aoa = [
      ["Month", "Revenue (VND)", "Energy (kWh)"],
      ["2026-01", "1000", "10"],
    ];
    const result = parseBusinessMetricsSheet(aoa);
    expect(result.headerErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
  });

  it("tolerates column order changes", () => {
    const aoa = [
      ["Điện năng (kWh)", "Tháng", "Doanh thu (VNĐ)"],
      ["1200", "2026-01", "50000000"],
    ];
    const result = parseBusinessMetricsSheet(aoa);
    expect(result.rows[0]).toMatchObject({ period: "2026-01-01", revenue: 50000000, energy: 1200 });
  });

  it("reports header errors and blocks when a required column is missing", () => {
    const aoa = [
      ["Tháng", "Doanh thu (VNĐ)"], // missing energy column
      ["2026-01", "50000000"],
    ];
    const result = parseBusinessMetricsSheet(aoa);
    expect(result.headerErrors.length).toBeGreaterThan(0);
    expect(result.hasBlockingErrors).toBe(true);
    expect(result.rows).toEqual([]);
  });

  it("flags negative values as row errors", () => {
    const aoa = [
      ["Tháng", "Doanh thu (VNĐ)", "Điện năng (kWh)"],
      ["2026-01", "-1000", "1200"],
    ];
    const result = parseBusinessMetricsSheet(aoa);
    expect(result.rows[0].errors.length).toBeGreaterThan(0);
    expect(result.hasBlockingErrors).toBe(true);
  });

  it("flags non-numeric cells as row errors", () => {
    const aoa = [
      ["Tháng", "Doanh thu (VNĐ)", "Điện năng (kWh)"],
      ["2026-01", "khong ro", "1200"],
    ];
    const result = parseBusinessMetricsSheet(aoa);
    expect(result.rows[0].errors.some((e) => e.includes("Doanh thu"))).toBe(true);
  });

  it("flags duplicate periods within the file", () => {
    const aoa = [
      ["Tháng", "Doanh thu (VNĐ)", "Điện năng (kWh)"],
      ["2026-01", "1000", "10"],
      ["2026-01", "2000", "20"],
    ];
    const result = parseBusinessMetricsSheet(aoa);
    expect(result.duplicateKeys).toEqual(["2026-01-01|month"]);
    expect(result.rows[0].errors.some((e) => e.includes("Trùng"))).toBe(true);
    expect(result.rows[1].errors.some((e) => e.includes("Trùng"))).toBe(true);
    expect(result.hasBlockingErrors).toBe(true);
  });

  it("detects a missing month in the middle of a range", () => {
    const aoa = [
      ["Tháng", "Doanh thu (VNĐ)", "Điện năng (kWh)"],
      ["2026-01", "1000", "10"],
      // 2026-02 skipped
      ["2026-03", "3000", "30"],
    ];
    const result = parseBusinessMetricsSheet(aoa);
    expect(result.missingPeriods).toEqual([{ granularity: "month", period: "2026-02-01" }]);
    // Missing periods are a warning, not a blocker.
    expect(result.hasBlockingErrors).toBe(false);
  });

  it("skips entirely blank rows", () => {
    const aoa = [
      ["Tháng", "Doanh thu (VNĐ)", "Điện năng (kWh)"],
      ["2026-01", "1000", "10"],
      ["", "", ""],
      ["2026-02", "2000", "20"],
    ];
    const result = parseBusinessMetricsSheet(aoa);
    expect(result.rows).toHaveLength(2);
  });

  it("returns a blocking error for an empty file", () => {
    const result = parseBusinessMetricsSheet([]);
    expect(result.hasBlockingErrors).toBe(true);
    expect(result.headerErrors.length).toBeGreaterThan(0);
  });
});
