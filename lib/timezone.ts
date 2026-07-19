// @/lib/timezone.ts
// Timezone utility for Vietnam (UTC+7) date calculations

const VIETNAM_OFFSET_HOURS = 7;

/**
 * Get the start and end of a specific month in Vietnam timezone (UTC+7).
 * This ensures monthly boundaries align with local business days,
 * not UTC midnight.
 * 
 * Example: April 2026 in Vietnam = 
 *   Start: 2026-03-31T17:00:00.000Z (April 1 00:00 +7)
 *   End:   2026-04-30T16:59:59.999Z (April 30 23:59 +7)
 */
export function getVietnamMonthRange(month: number, year: number): {
  start: string;
  end: string;
} {
  // First day of month at 00:00:00 Vietnam time
  // = previous day at 17:00:00 UTC
  const startUTC = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  startUTC.setUTCHours(startUTC.getUTCHours() - VIETNAM_OFFSET_HOURS);

  // Last day of month at 23:59:59.999 Vietnam time
  const lastDay = new Date(year, month, 0).getDate(); // get last day of month
  const endUTC = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));
  endUTC.setUTCHours(endUTC.getUTCHours() - VIETNAM_OFFSET_HOURS);

  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString(),
  };
}

/**
 * Get the current month and year in Vietnam timezone.
 */
export function getCurrentVietnamPeriod(): { month: number; year: number } {
  const now = new Date();
  // Shift to Vietnam time by adding offset
  const vietnamNow = new Date(now.getTime() + VIETNAM_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    month: vietnamNow.getUTCMonth() + 1, // 1-indexed
    year: vietnamNow.getUTCFullYear(),
  };
}

/**
 * Get the current day, month and year in Vietnam timezone.
 * Used to gate date-based UI (e.g. reminders that only start on a given day).
 */
export function getCurrentVietnamDate(): { day: number; month: number; year: number } {
  const now = new Date();
  const vietnamNow = new Date(now.getTime() + VIETNAM_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    day: vietnamNow.getUTCDate(),
    month: vietnamNow.getUTCMonth() + 1,
    year: vietnamNow.getUTCFullYear(),
  };
}

/**
 * Today's date in Vietnam timezone as an ISO date string (YYYY-MM-DD).
 * Comparable directly against Postgres DATE columns.
 */
export function getCurrentVietnamDateISO(): string {
  const { day, month, year } = getCurrentVietnamDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Last calendar day of a given month, as an ISO date string (YYYY-MM-DD).
 * Used to cap e-voucher expiry to the end of the month it was assigned for,
 * regardless of the (much later) expiry printed on the original gift card.
 */
export function getLastDayOfMonthISO(month: number, year: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Format a UTC timestamp string to Vietnam local display.
 * Returns format: "DD/MM/YYYY HH:mm"
 */
export function formatVietnamTime(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
