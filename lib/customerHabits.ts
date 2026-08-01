// @/lib/customerHabits.ts
// Per-customer metric computation shared by the customer-habits list and
// drill-down API routes, so the two never compute the same numbers two
// different ways.
import { getVietnamHour, getVietnamWeekday, VIETNAM_WEEKDAY_LABELS } from "./timezone";
import { circularMeanHour, iqr, median, modalBucket } from "./stats";
import { classifyCustomerSegment, SEGMENT_LABELS } from "./segments";

/** Hours between each consecutive pair of (ascending-sorted) UTC ISO timestamps. */
export function computeGapsHours(sortedStartTimes: string[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < sortedStartTimes.length; i++) {
    const diffMs = new Date(sortedStartTimes[i]).getTime() - new Date(sortedStartTimes[i - 1]).getTime();
    gaps.push(diffMs / (1000 * 60 * 60));
  }
  return gaps;
}

export interface ComputedCustomerMetrics {
  checkinCount: number;
  frequencyPerWeek: number;
  modalHour: number | null;
  circularMeanHour: number | null;
  modalWeekdayIndex: number | null;
  modalWeekdayLabel: string | null;
  medianGapHours: number | null;
  iqrGapHours: number | null;
  daysSinceLast: number;
  segment: ReturnType<typeof classifyCustomerSegment>;
  segmentLabel: string;
}

/**
 * @param sortedStartTimes UTC ISO timestamps, ascending order, all for one customer.
 * @param daysInRange the analytics range's day count (for frequency/week).
 * @param nowMs injectable for tests; defaults to the real current time.
 */
export function computeCustomerMetrics(
  sortedStartTimes: string[],
  daysInRange: number,
  nowMs: number = Date.now()
): ComputedCustomerMetrics {
  const count = sortedStartTimes.length;
  const hours = sortedStartTimes.map(getVietnamHour);
  const weekdays = sortedStartTimes.map(getVietnamWeekday);

  const modalHour = modalBucket(hours);
  const meanHour = circularMeanHour(hours);
  const modalWeekdayIndex = modalBucket(weekdays);
  const modalWeekdayLabel = modalWeekdayIndex !== null ? VIETNAM_WEEKDAY_LABELS[modalWeekdayIndex] : null;

  const gapsHours = computeGapsHours(sortedStartTimes);
  const medianGapHours = median(gapsHours);
  const iqrGapHours = iqr(gapsHours);

  const lastTime = new Date(sortedStartTimes[count - 1]).getTime();
  const daysSinceLast = Math.round(((nowMs - lastTime) / (1000 * 60 * 60 * 24)) * 10) / 10;

  const frequencyPerWeek = daysInRange > 0 ? Math.round((count / (daysInRange / 7)) * 10) / 10 : 0;

  const segment = classifyCustomerSegment({
    checkinCount: count,
    frequencyPerWeek,
    medianGapHours,
    iqrGapHours,
    daysSinceLast,
  });

  return {
    checkinCount: count,
    frequencyPerWeek,
    modalHour,
    circularMeanHour: meanHour !== null ? Math.round(meanHour * 10) / 10 : null,
    modalWeekdayIndex,
    modalWeekdayLabel,
    medianGapHours: medianGapHours !== null ? Math.round(medianGapHours * 10) / 10 : null,
    iqrGapHours: iqrGapHours !== null ? Math.round(iqrGapHours * 10) / 10 : null,
    daysSinceLast,
    segment,
    segmentLabel: SEGMENT_LABELS[segment],
  };
}
