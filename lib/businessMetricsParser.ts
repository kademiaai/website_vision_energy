// @/lib/businessMetricsParser.ts
// Pure parsing + validation for the Dashboard 4 monthly (or daily/weekly)
// business-metrics Excel upload. Deliberately has no dependency on the
// `xlsx` package itself — it takes a plain array-of-arrays (as produced by
// XLSX.utils.sheet_to_json(sheet, { header: 1 })) so this logic is testable
// without spinning up a real workbook.

export type BusinessGranularity = "day" | "week" | "month";

export interface ParsedBusinessRow {
  /** 1-based row number among data rows (excluding the header), for display. */
  rowNumber: number;
  periodRaw: string;
  /** "YYYY-MM-DD" — first day of the period. null if unparseable. */
  period: string | null;
  granularity: BusinessGranularity | null;
  revenueRaw: string;
  revenue: number | null;
  energyRaw: string;
  energy: number | null;
  errors: string[];
}

export interface ParseBusinessFileResult {
  rows: ParsedBusinessRow[];
  /** "period|granularity" keys that appear more than once among rows with a valid period. */
  duplicateKeys: string[];
  missingPeriods: { granularity: BusinessGranularity; period: string }[];
  /** Non-empty only when a required column couldn't be found at all — nothing else runs in that case. */
  headerErrors: string[];
  /** True when the file cannot be saved as-is: header errors, any row error, or zero data rows. */
  hasBlockingErrors: boolean;
}

const PERIOD_HEADER_CANDIDATES = ["thang", "period", "month", "ngay", "date", "tuan", "week"];
const REVENUE_HEADER_CANDIDATES = ["doanh thu", "revenue"];
const ENERGY_HEADER_CANDIDATES = ["dien nang", "energy", "kwh"];

function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d");
}

function normalizeHeader(h: unknown): string {
  return stripDiacritics((h ?? "").toString().trim().toLowerCase());
}

function findColumnIndex(headerRow: unknown[], candidates: string[]): number {
  const normalized = headerRow.map(normalizeHeader);
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Monday (UTC) of a given ISO 8601 week — week 1 is the week containing Jan 4th. */
export function isoWeekToMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = jan4.getUTCDay() || 7; // Mon=1 ... Sun=7
  const week1Monday = new Date(jan4.getTime() - (jan4Weekday - 1) * 24 * 60 * 60 * 1000);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
}

/** Detects granularity from the period cell's format and normalizes to a "YYYY-MM-DD" period start. */
export function parsePeriodCell(raw: string): { period: string; granularity: BusinessGranularity } | null {
  const trimmed = raw.trim();

  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dayMatch) {
    const [, y, m, d] = dayMatch;
    const month = Number(m);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { period: trimmed, granularity: "day" };
  }

  const weekMatch = /^(\d{4})-W(\d{1,2})$/i.exec(trimmed);
  if (weekMatch) {
    const year = Number(weekMatch[1]);
    const week = Number(weekMatch[2]);
    if (week < 1 || week > 53) return null;
    return { period: isoWeekToMonday(year, week).toISOString().slice(0, 10), granularity: "week" };
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (monthMatch) {
    const [, y, m] = monthMatch;
    const month = Number(m);
    if (month < 1 || month > 12) return null;
    return { period: `${y}-${m}-01`, granularity: "month" };
  }

  return null;
}

/** VNĐ has no fractional sub-unit in practice — "." and "," are treated purely as thousand separators. */
export function parseRevenueCell(raw: string): number | null {
  const cleaned = raw.toString().trim().replace(/[.,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^-?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** kWh may have a fractional part — a lone comma is treated as a decimal separator, otherwise as a thousand separator. */
export function parseEnergyCell(raw: string): number | null {
  const trimmed = raw.toString().trim();
  if (trimmed === "") return null;
  let normalized = trimmed;
  if (/^-?\d+,\d+$/.test(normalized)) {
    normalized = normalized.replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Every period start ("YYYY-MM-DD") from minPeriod to maxPeriod inclusive, stepped by the given granularity. */
export function enumeratePeriods(minPeriod: string, maxPeriod: string, granularity: BusinessGranularity): string[] {
  const result: string[] = [];

  if (granularity === "month") {
    let [y, m] = minPeriod.split("-").map(Number);
    const [maxY, maxM] = maxPeriod.split("-").map(Number);
    while (y < maxY || (y === maxY && m <= maxM)) {
      result.push(`${y}-${String(m).padStart(2, "0")}-01`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return result;
  }

  const stepDays = granularity === "week" ? 7 : 1;
  let cursor = new Date(`${minPeriod}T00:00:00Z`).getTime();
  const end = new Date(`${maxPeriod}T00:00:00Z`).getTime();
  while (cursor <= end) {
    result.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += stepDays * 24 * 60 * 60 * 1000;
  }
  return result;
}

export function parseBusinessMetricsSheet(aoa: unknown[][]): ParseBusinessFileResult {
  if (aoa.length === 0) {
    return { rows: [], duplicateKeys: [], missingPeriods: [], headerErrors: ["File trống."], hasBlockingErrors: true };
  }

  const header = aoa[0];
  const periodCol = findColumnIndex(header, PERIOD_HEADER_CANDIDATES);
  const revenueCol = findColumnIndex(header, REVENUE_HEADER_CANDIDATES);
  const energyCol = findColumnIndex(header, ENERGY_HEADER_CANDIDATES);

  const headerErrors: string[] = [];
  if (periodCol === -1) headerErrors.push('Không tìm thấy cột kỳ báo cáo ("Tháng").');
  if (revenueCol === -1) headerErrors.push('Không tìm thấy cột "Doanh thu (VNĐ)".');
  if (energyCol === -1) headerErrors.push('Không tìm thấy cột "Điện năng (kWh)".');

  if (headerErrors.length > 0) {
    return { rows: [], duplicateKeys: [], missingPeriods: [], headerErrors, hasBlockingErrors: true };
  }

  const dataRows = aoa.slice(1).filter((r) => r.some((c) => (c ?? "").toString().trim() !== ""));

  const rows: ParsedBusinessRow[] = dataRows.map((r, i) => {
    const periodRaw = (r[periodCol] ?? "").toString().trim();
    const revenueRaw = (r[revenueCol] ?? "").toString().trim();
    const energyRaw = (r[energyCol] ?? "").toString().trim();

    const errors: string[] = [];
    const parsedPeriod = parsePeriodCell(periodRaw);
    if (!parsedPeriod) errors.push(`Không nhận dạng được kỳ báo cáo: "${periodRaw}"`);

    const revenue = parseRevenueCell(revenueRaw);
    if (revenue === null) errors.push(`Doanh thu không hợp lệ: "${revenueRaw}"`);
    else if (revenue < 0) errors.push("Doanh thu không được âm.");

    const energy = parseEnergyCell(energyRaw);
    if (energy === null) errors.push(`Điện năng không hợp lệ: "${energyRaw}"`);
    else if (energy < 0) errors.push("Điện năng không được âm.");

    return {
      rowNumber: i + 1,
      periodRaw,
      period: parsedPeriod?.period ?? null,
      granularity: parsedPeriod?.granularity ?? null,
      revenueRaw,
      revenue,
      energyRaw,
      energy,
      errors,
    };
  });

  const keyCounts = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.period || !row.granularity) return;
    const key = `${row.period}|${row.granularity}`;
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  });
  const duplicateKeys = Array.from(keyCounts.entries())
    .filter(([, c]) => c > 1)
    .map(([k]) => k);
  rows.forEach((row) => {
    if (row.period && row.granularity && duplicateKeys.includes(`${row.period}|${row.granularity}`)) {
      row.errors.push("Trùng kỳ báo cáo với dòng khác trong file.");
    }
  });

  const missingPeriods: { granularity: BusinessGranularity; period: string }[] = [];
  const byGranularity = new Map<BusinessGranularity, string[]>();
  rows.forEach((row) => {
    if (row.period && row.granularity && row.errors.length === 0) {
      const list = byGranularity.get(row.granularity) || [];
      list.push(row.period);
      byGranularity.set(row.granularity, list);
    }
  });
  byGranularity.forEach((periods, granularity) => {
    if (periods.length < 2) return;
    const sorted = [...periods].sort();
    const expected = enumeratePeriods(sorted[0], sorted[sorted.length - 1], granularity);
    const present = new Set(sorted);
    expected.forEach((p) => {
      if (!present.has(p)) missingPeriods.push({ granularity, period: p });
    });
  });

  const hasBlockingErrors = rows.length === 0 || rows.some((r) => r.errors.length > 0);

  return { rows, duplicateKeys, missingPeriods, headerErrors: [], hasBlockingErrors };
}
