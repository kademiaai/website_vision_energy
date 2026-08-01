import { describe, expect, it } from "vitest";
import {
  daysBetweenDateKeys,
  enumerateDateKeys,
  getVietnamDateKey,
  getVietnamHour,
  getVietnamWeekday,
  VIETNAM_WEEKDAY_LABELS,
} from "./timezone";

describe("getVietnamHour", () => {
  it("converts a plain daytime UTC timestamp to Vietnam local hour (+7h)", () => {
    // 2026-06-15T05:30:00Z -> 12:30 in Vietnam (UTC+7)
    expect(getVietnamHour("2026-06-15T05:30:00.000Z")).toBe(12);
  });

  it("rolls over into the next calendar day when the +7h shift crosses UTC midnight", () => {
    // 2026-01-01T20:00:00Z -> 2026-01-02T03:00:00 in Vietnam: a different
    // calendar day in UTC vs. Vietnam time — the exact bug class this
    // module exists to avoid (see sessionsByHour's browser-local .getHours()).
    expect(getVietnamHour("2026-01-01T20:00:00.000Z")).toBe(3);
  });

  it("lands on Vietnam midnight (hour 0) exactly 17h before UTC midnight", () => {
    // 2026-03-09T17:00:00Z -> 2026-03-10T00:00:00 in Vietnam.
    expect(getVietnamHour("2026-03-09T17:00:00.000Z")).toBe(0);
  });
});

describe("getVietnamWeekday", () => {
  it("returns 0 (T2/Monday) for a Monday in Vietnam time", () => {
    // 2026-01-05 is a Monday; midday UTC stays within the same Vietnam day.
    expect(getVietnamWeekday("2026-01-05T04:00:00.000Z")).toBe(0);
  });

  it("returns 6 (CN/Sunday) for a Sunday in Vietnam time", () => {
    // 2026-01-04 is a Sunday.
    expect(getVietnamWeekday("2026-01-04T04:00:00.000Z")).toBe(6);
  });

  it("shifts the weekday across the UTC/Vietnam day boundary", () => {
    // 2026-01-01 is a Thursday (UTC). At 20:00 UTC, Vietnam local time is
    // already 2026-01-02 03:00 — a Friday. Must report Friday, not Thursday.
    expect(getVietnamWeekday("2026-01-01T20:00:00.000Z")).toBe(4); // T6/Friday
  });
});

describe("VIETNAM_WEEKDAY_LABELS", () => {
  it("is indexed T2 (Monday) through CN (Sunday), matching getVietnamWeekday", () => {
    expect(VIETNAM_WEEKDAY_LABELS).toEqual(["T2", "T3", "T4", "T5", "T6", "T7", "CN"]);
  });
});

describe("getVietnamDateKey", () => {
  it("returns the Vietnam calendar date for a plain daytime timestamp", () => {
    expect(getVietnamDateKey("2026-06-15T05:30:00.000Z")).toBe("2026-06-15");
  });

  it("rolls to the next calendar day across the UTC/Vietnam boundary", () => {
    // Same instant used in the getVietnamHour boundary test above.
    expect(getVietnamDateKey("2026-01-01T20:00:00.000Z")).toBe("2026-01-02");
  });
});

describe("daysBetweenDateKeys", () => {
  it("returns 1 for the same date", () => {
    expect(daysBetweenDateKeys("2026-01-15", "2026-01-15")).toBe(1);
  });

  it("is inclusive of both endpoints", () => {
    expect(daysBetweenDateKeys("2026-01-01", "2026-01-07")).toBe(7);
  });

  it("handles a month boundary", () => {
    expect(daysBetweenDateKeys("2026-01-28", "2026-02-02")).toBe(6);
  });
});

describe("enumerateDateKeys", () => {
  it("lists every date inclusive of both endpoints", () => {
    expect(enumerateDateKeys("2026-01-01", "2026-01-03")).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("returns a single-element array for the same date", () => {
    expect(enumerateDateKeys("2026-01-15", "2026-01-15")).toEqual(["2026-01-15"]);
  });

  it("crosses a month boundary correctly", () => {
    expect(enumerateDateKeys("2026-01-30", "2026-02-01")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01"]);
  });
});
