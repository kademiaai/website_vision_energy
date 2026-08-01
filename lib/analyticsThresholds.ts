// @/lib/analyticsThresholds.ts
// Minimum-sample-size guardrails for every widget across the analytics
// section, in one place so they're easy to find and tune. Below its
// threshold, a widget renders "Chưa đủ dữ liệu để phân tích" instead of a
// chart/statistic computed from too few points to be meaningful.
export const ANALYTICS_THRESHOLDS = {
  checkinTrends: {
    /** KPI cards: peak hour / peak weekday / quietest hour. */
    minForPeakStats: 10,
    /** 7x24 heatmap. */
    minForHeatmap: 20,
    /** Hour-of-day and weekday bar charts. */
    minForHourWeekdayCharts: 15,
    /** Daily line chart's 7-day moving-average overlay needs this many distinct days in range. */
    minDaysForMovingAverage: 7,
    /** Auto-generated text summary. */
    minForSummaryText: 10,
  },
  customerHabits: {
    /** Below this many check-ins in range, gap-based stats (median/IQR) are too thin to classify regularity — falls back to "irregular" rather than "daily"/"weekly". */
    minCheckinsForRegularity: 3,
    segments: {
      /** "Đều đặn hàng ngày": >= this many check-ins/week AND gap IQR <= dailyMaxIqrHours. */
      dailyMinPerWeek: 5,
      dailyMaxIqrHours: 12,
      /** "Đều đặn hàng tuần": frequency within [weeklyMinPerWeek, weeklyMaxPerWeek] AND gap IQR <= weeklyMaxIqrRatio * median gap. */
      weeklyMinPerWeek: 0.7,
      weeklyMaxPerWeek: 2.5,
      weeklyMaxIqrRatio: 0.5,
      /** "Có nguy cơ rời bỏ": days since last check-in > this multiplier x their own median gap (in days). Overrides the frequency-based segments above. */
      churnRiskGapMultiplier: 2,
    },
  },
  anomalies: {
    rateChange: {
      /** Need this many days of prior daily-count history before a baseline is trusted enough to flag against. */
      minPriorDaysForBaseline: 7,
      /** Rolling window (days) the baseline median/MAD is computed over. */
      windowDays: 28,
      madMultiplier: 3,
      minRatioMultiplier: 1.5,
      /** Absolute floor so e.g. 1 -> 2 check-ins never flags, even if that's technically +3 MAD for a near-zero baseline. */
      minAbsoluteCount: 3,
    },
    velocity: {
      windowMinutes: 60,
      minCount: 3,
    },
    offPatternHour: {
      minPriorCheckins: 20,
      maxDistanceHours: 6,
    },
    newAccountBurst: {
      maxAccountAgeDays: 7,
      topPercentile: 0.95,
      /** Need at least this many customers for a "top 5%" percentile to mean anything. */
      minCustomersForPercentile: 10,
    },
  },
} as const;
