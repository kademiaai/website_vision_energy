// @/lib/types/checkinTrends.ts
// Shared response shape for GET /api/analytics/checkin-trends, imported by
// both the route handler and the dashboard page so they can't drift apart.

export interface CheckinTrendsRange {
  type: string;
  startISO: string;
  endISO: string;
  daysInRange: number;
}

export interface CheckinTrendsKpis {
  total: number;
  dailyAverage: number | null;
  peakHour: { hour: number; count: number; pct: number } | null;
  peakWeekday: { weekdayIndex: number; label: string; count: number; pct: number } | null;
  quietestHour: { hour: number; count: number } | null;
}

export interface HeatmapCell {
  weekdayIndex: number;
  hour: number;
  count: number;
}

export interface HourBarPoint {
  hour: number;
  count: number;
}

export interface WeekdayBarPoint {
  weekdayIndex: number;
  label: string;
  count: number;
}

export interface DailyLinePoint {
  date: string;
  count: number;
  movingAvg7: number | null;
}

export interface CheckinTrendsResponse {
  range: CheckinTrendsRange;
  kpis: CheckinTrendsKpis;
  /** null when total check-ins is below ANALYTICS_THRESHOLDS.checkinTrends.minForHeatmap. */
  heatmap: HeatmapCell[] | null;
  /** null when below minForHourWeekdayCharts. */
  hourBar: HourBarPoint[] | null;
  /** null when below minForHourWeekdayCharts. */
  weekdayBar: WeekdayBarPoint[] | null;
  /** Always present (zero-filled), but movingAvg7 stays null on every point when daysInRange < minDaysForMovingAverage. */
  dailyLine: DailyLinePoint[];
  /** null when total check-ins is below minForSummaryText. */
  summaryText: string | null;
}
