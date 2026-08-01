# Feature: Phân tích & Insights (Analytics & Insights)

## 1. Objective
A new admin section with 4 dashboards giving visibility into check-in volume/timing, per-customer behavior, business performance (revenue/kWh), and anomalous check-in patterns — built server-side-aggregated (never pulling raw session rows to the client) with explicit small-sample guardrails, since this system currently has very few check-ins.

## 2. Structure
- **Route**: `/admin/analytics`, nav entry "Phân tích & Insights" in `app/admin/layout.tsx`.
- **Shared layout** (`app/admin/analytics/layout.tsx`): secondary tab bar (4 dashboards) + the shared `FilterBar` (date range + customer search, URL-synced via `range`/`start`/`end`/`q` query params — the first URL-synced filter state in this app, so views are shareable).
- **First-ever API route layer** (`app/api/analytics/*`): all statistical aggregation runs server-side in TypeScript (not raw SQL/RPC — chosen for testability of the robust statistics involved), reading via `lib/supabaseServer.ts` and protected by `middleware.ts`'s `/api/analytics/:path*` matcher (401 JSON, not a redirect, since callers are `fetch()`).
- **Shared utilities**: `lib/timezone.ts` (Vietnam-time hour/weekday/date-key bucketing — see `sessionsByHour`'s pre-existing browser-local-time bug this was built to avoid), `lib/stats.ts` (median/MAD/IQR/circular-mean — robust statistics, not mean±stddev, deliberately), `lib/analyticsRange.ts` (URL range params → UTC boundaries), `lib/analyticsThresholds.ts` (every widget's minimum-sample-size guardrail, in one tunable place), `lib/exportExcel.ts` (extracted from previously-duplicated per-page export code).
- **Testing**: Vitest (first test runner in this repo) — `npm test`. 101 tests cover every piece of numeric/date logic (timezone bucketing across the UTC/Vietnam boundary, robust stats, segment classification, business-metrics parsing, anomaly detectors).

## 3. Dashboard 1 — Xu hướng check-in (`checkin-trends`)
- API: `GET /api/analytics/checkin-trends?range=&start=&end=`.
- KPIs (total, daily average, peak/quietest hour, peak weekday), 7×24 heatmap, hour/weekday bar charts, daily line + 7-day moving average, auto-generated Vietnamese summary (peak/quiet 3-hour bands via `findExtremeWindow` sliding-window search).
- Every non-trivial widget gated by `ANALYTICS_THRESHOLDS.checkinTrends` — below threshold, renders "Chưa đủ dữ liệu để phân tích" instead of a noisy chart.

## 4. Dashboard 2 — Thói quen khách hàng (`customer-habits`)
- APIs: `GET /api/analytics/customer-habits` (table) and `GET /api/analytics/customer-habits/[plate]` (drill-down).
- Per-customer: frequency/week, modal hour + circular mean hour, modal weekday, **median** gap between check-ins (not mean — outlier-resistant), IQR of gaps (regularity), days since last check-in.
- Segments (`lib/segments.ts`, thresholds in `ANALYTICS_THRESHOLDS.customerHabits`): Đều đặn hàng ngày / Đều đặn hàng tuần / Không đều / Chỉ 1 lần / Có nguy cơ rời bỏ (> 2× own median gap since last check-in — overrides the others).
- Drill-down modal: timeline scatter (date × hour), gap histogram, auto-generated Vietnamese summary sentence.

## 5. Dashboard 3 — Cảnh báo bất thường (`anomalies`)
- API: `GET /api/analytics/anomalies` (runs detection lazily on load — no scheduled-job infra in this app, same precedent as `evoucherService.expireOverdueVouchers`) + `PATCH /api/analytics/anomalies/[id]` (review actions).
- 4 detectors in `lib/anomalyDetection.ts`, thresholds in `ANALYTICS_THRESHOLDS.anomalies`:
  1. **Rate-change**: today's count ≥ (rolling 28-day median baseline + 3×MAD) AND ≥ 1.5× baseline AND ≥ 3 absolute (floor prevents 1→2 flagging).
  2. **Velocity**: ≥3 check-ins within 60 minutes (one flag per burst, not per overlapping window).
  3. **Off-pattern hour**: circular distance from the customer's own circular-mean hour > 6h, only once they have ≥20 check-ins.
  4. **New-account burst**: account < 7 days old with daily rate above the 95th percentile across all customers (needs ≥10 customers for the percentile to be meaningful).
- Flags persisted in `checkin_flags` (`lib/database/checkin-flags-migration.sql`), deduped on `(license_plate, flag_type, flagged_at)` so re-detection never duplicates or disturbs an already-reviewed flag.
- UI: severity badges, one-line reason with real numbers, 30-day sparkline with the flagged day marked, review actions (Đã xem xét / Bỏ qua / Thêm vào danh sách trắng). Prominent disclaimer: these are statistical signals for human review, not proof of misuse.

## 6. Dashboard 4 — Hiệu quả kinh doanh (`business`)
- Admin-uploaded monthly (or day/week) revenue+kWh via `.xlsx`, parsed **client-side** (unlike the e-voucher upload flow, which parses server-side for password-protected files — this data has no such need).
- `lib/businessMetricsParser.ts`: fuzzy Vietnamese/English header matching (diacritics-insensitive), day/week/month granularity auto-detection from the period cell format, locale-aware number parsing (VNĐ has no decimals; kWh treats a lone comma as decimal per Vietnamese convention), duplicate-period and negative-value blocking, missing-period gap warnings (non-blocking).
- Preview-before-save: nothing is written to `business_metrics` (`lib/database/business-metrics-migration.sql`, admin-only RLS) until the admin confirms.
- API: `GET /api/analytics/business?view=month|week|day` — derived KPIs (kWh/check-in, VNĐ/check-in, VNĐ/kWh + month-over-month %), combined chart (check-ins + kWh + revenue, dual Y-axis), ratio-trend chart. Day/week views use an actual uploaded row for that exact period if one exists, otherwise **estimate** by distributing the containing month's total in proportion to that day/week's share of the month's check-ins — visually distinct (grey dashed line) and explicitly labeled "Ước tính — phân bổ theo tỉ lệ lượt sạc", never presented as measured. A month with check-ins but no uploaded financial row is surfaced as an explicit gap, never a silent zero.

## 7. New database tables
- `checkin_settings` (pre-existing, unrelated) is not touched by this feature.
- `business_metrics`: `(period, granularity)` unique, admin-only RLS (never read from a public page, unlike `checkin_settings`).
- `checkin_flags`: `(license_plate, flag_type, flagged_at)` unique, admin-only RLS, FK to `customers.license_plate`.

Neither migration has been run against the live Supabase project yet — both must be applied manually via the Supabase SQL Editor before these dashboards will show real data (same manual-migration precedent as every other table in `lib/database/`).
