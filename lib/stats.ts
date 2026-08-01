// @/lib/stats.ts
// Robust statistics for small, skewed samples (check-in counts/gaps).
// Deliberately avoids mean/std-dev — with only a handful of data points per
// customer, a single outlier check-in would dominate a mean-based measure.
// All functions return `null` for empty input so callers can render the
// "Chưa đủ dữ liệu để phân tích" empty state instead of NaN/misleading 0s.

/**
 * Linear-interpolation percentile (the "R-7"/Excel method — same convention
 * as Postgres's percentile_cont), so results stay consistent if any of this
 * is ever ported to SQL. `values` need not be pre-sorted.
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 1) return sorted[0];

  const rank = p * (n - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (upper >= n) return sorted[n - 1];
  const weight = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

/** Median (50th percentile). Robust to outliers, unlike the arithmetic mean. */
export function median(values: number[]): number | null {
  return percentile(values, 0.5);
}

/**
 * Interquartile range (Q3 - Q1). Low IQR = tightly clustered/regular values;
 * high IQR = spread out/irregular. Needs at least 2 values to be meaningful.
 */
export function iqr(values: number[]): number | null {
  if (values.length < 2) return null;
  const q1 = percentile(values, 0.25);
  const q3 = percentile(values, 0.75);
  if (q1 === null || q3 === null) return null;
  return q3 - q1;
}

/**
 * Median absolute deviation: median(|x_i - median(x)|). A robust,
 * outlier-resistant stand-in for standard deviation. Not scaled by the
 * 1.4826 normal-consistency constant — callers (e.g. the anomaly-detection
 * rate-change flag) define their own multiplier against the raw MAD.
 */
export function mad(values: number[]): number | null {
  if (values.length === 0) return null;
  const med = median(values);
  if (med === null) return null;
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations);
}

/**
 * Most frequent value in an array (mode). Ties resolve to whichever value
 * was encountered first among the tied values — deterministic for a given
 * input order, not necessarily the "smallest" or "earliest" value.
 */
export function modalBucket<T extends string | number>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  let best: T | null = null;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Circular mean of a set of hour-of-day values (0-23.999). Hours wrap around
 * a 24h clock, so 23:00 and 01:00 are 2h apart, not 22h — a plain arithmetic
 * mean would get this badly wrong (it'd average to ~12:00). Returns a value
 * in [0, 24).
 */
export function circularMeanHour(hours: number[]): number | null {
  if (hours.length === 0) return null;

  let sumSin = 0;
  let sumCos = 0;
  for (const h of hours) {
    const angle = (h / 24) * 2 * Math.PI;
    sumSin += Math.sin(angle);
    sumCos += Math.cos(angle);
  }

  const meanAngle = Math.atan2(sumSin / hours.length, sumCos / hours.length);
  let meanHour = (meanAngle / (2 * Math.PI)) * 24;
  if (meanHour < 0) meanHour += 24;
  return meanHour;
}

/**
 * Shortest distance between two hour-of-day values on a 24h clock (0-12).
 * E.g. distance(23, 1) === 2, not 22. Used for the off-pattern-hour anomaly
 * flag (how far a check-in's hour is from a customer's usual hour).
 */
export function circularDistanceHours(a: number, b: number): number {
  const diff = Math.abs(a - b) % 24;
  return Math.min(diff, 24 - diff);
}
