// @/lib/types/reward.ts
// TypeScript interfaces for the Monthly Rewards feature

export interface Reward {
  id: string;
  license_plate: string;
  month: number;
  year: number;
  checkin_count: number;
  id_card_photo_url: string | null;
  id_full_name: string | null;
  id_number: string | null;
  rewarded_at: string | null;
  admin_notes: string | null;
  is_ocr_verified: boolean;
  status: RewardStatus;
  token: string;
  selection_seen_at: string | null;
  completion_seen_at: string | null;
  created_at: string;
}

export type RewardStatus = 'eligible' | 'processing' | 'completed' | 'rejected';

/**
 * Data submitted by the customer via the reward portal
 */
export interface RewardClaimInput {
  token: string;
  id_full_name: string;
  id_number: string;
  id_card_photo_url: string;
  is_ocr_verified: boolean;
}

/**
 * Data used by admin to generate a reward entry
 */
export interface RewardCreateInput {
  license_plate: string;
  month: number;
  year: number;
  checkin_count: number;
}

/**
 * Extended reward data with customer info for admin views
 */
export interface RewardWithCustomer extends Reward {
  customer_name: string | null;
  customer_phone: string | null;
  total_rewards_lifetime: number;
}

/**
 * Leaderboard entry combining ranking + reward status
 */
export interface LeaderboardEntry {
  license_plate: string;
  full_name: string | null;
  phone_number: string | null;
  total_sessions: number;
  rank: number;
  reward_status: RewardStatus | null; // null = not yet issued
  total_rewards_lifetime: number;
}
