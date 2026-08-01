// @/lib/types/anomalies.ts
import type { FlagSeverity } from "@/lib/anomalyDetection";

export type FlagType = "rate_change" | "velocity" | "off_pattern_hour" | "new_account_burst";
export type ReviewerStatus = "pending" | "reviewed" | "dismissed" | "whitelisted";

export interface AnomalySparklinePoint {
  date: string;
  count: number;
}

export interface AnomalyAlert {
  id: string;
  licensePlate: string;
  fullName: string | null;
  flagType: FlagType;
  flagTypeLabel: string;
  severity: FlagSeverity;
  flaggedAt: string;
  reason: string;
  reviewerStatus: ReviewerStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  sparkline: AnomalySparklinePoint[];
  /** The specific date (if any) within the sparkline window to mark, "YYYY-MM-DD". */
  markedDate: string | null;
}

export interface AnomaliesResponse {
  alerts: AnomalyAlert[];
}
