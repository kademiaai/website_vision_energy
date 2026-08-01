// @/lib/types/customerHabits.ts
import type { CustomerSegment } from "@/lib/segments";

export interface CustomerHabitRow {
  licensePlate: string;
  fullName: string | null;
  phoneNumber: string | null;
  checkinCount: number;
  frequencyPerWeek: number;
  /** Modal (most frequent) check-in hour, 0-23. null if no clear mode (shouldn't happen with >=1 check-in, but defensive). */
  modalHour: number | null;
  /** Circular mean of check-in hours, 0-23.999. */
  circularMeanHour: number | null;
  modalWeekdayIndex: number | null;
  modalWeekdayLabel: string | null;
  /** null when fewer than 2 check-ins (no gaps to compute). */
  medianGapHours: number | null;
  /** null when fewer than 3 check-ins (fewer than 2 gap values). */
  iqrGapHours: number | null;
  daysSinceLast: number;
  segment: CustomerSegment;
  segmentLabel: string;
}

export interface CustomerHabitsResponse {
  range: { type: string; startISO: string; endISO: string; daysInRange: number };
  customers: CustomerHabitRow[];
}

export interface CustomerTimelinePoint {
  date: string;
  hour: number;
}

export interface GapHistogramBin {
  label: string;
  count: number;
}

export interface CustomerHabitDetail extends CustomerHabitRow {
  timeline: CustomerTimelinePoint[];
  gapHistogram: GapHistogramBin[];
  summarySentence: string;
}
