import { describe, expect, it } from "vitest";
import { getVietnamHour, getVietnamWeekday, VIETNAM_WEEKDAY_LABELS } from "./timezone";

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
