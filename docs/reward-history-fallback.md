# Reward history fallback

When `rewardService.getRewardHistory(licensePlate)` is called it first attempts an exact lookup using the normalized license plate.

If no rows are found, the service performs a defensive fallback using an ILIKE search on `license_plate` to match potential formatting mismatches (e.g. stored values with or without separators).

Why
- Defensive: protects against inconsistent stored formats or data imported from external sources.
- Helps surface cases where normalization didn't match stored values.

Telemetry
- When the ILIKE fallback returns results, the service records a telemetry event `reward_history_fallback` via `lib/telemetry.recordEvent`.
- The event payload includes:
  - `plate`: the normalized plate that triggered the fallback
  - `found`: number of rows returned by the fallback

Where to look
- Console logs will include a `[telemetry]` JSON line for each fallback event.
- A local log is appended to `logs/telemetry.log` (best-effort; file writes are non-blocking and errors are swallowed).

If you see frequent fallback events, investigate the stored `rewards.license_plate` values and migrate to a normalized format (uppercase, no separators). Consider adding a migration script to normalize existing rows.
