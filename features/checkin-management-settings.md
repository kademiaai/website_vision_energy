# Feature: Check-in Management Settings (Admin)

## 1. Objective
Give the admin visibility and control over the rules that gate customer check-ins — the cooldown between check-ins and a per-plate daily check-in cap — without needing a code deploy to change them. Previously the cooldown was a hardcoded constant in `checkinService.ts`; there was no daily-limit concept at all.

## 2. Core Logic
- **Cooldown (`cooldown_minutes`)**: minimum minutes a plate must wait between check-ins. Default `180` (3 hours). `0` disables the cooldown entirely.
- **Daily limit (`max_checkins_per_day`)**: maximum check-ins allowed for a single license plate within one Vietnam calendar day (00:00–23:59 UTC+7). `NULL` means unlimited (default).
- Both values live in a single-row Supabase table, `checkin_settings` (`id = 1`), enforced as a singleton via a `CHECK (id = 1)` constraint.
- Test plates starting with `99H` or `90H` bypass **both** rules, same as before.
- `processCheckIn` (`app/services/checkinService.ts`) reads the settings fresh on every call — no caching — so an admin's saved change takes effect on the very next check-in.

## 3. Admin UI
- **Location**: Admin > "Quản lý hệ thống" (System Management) > "Quản lý check-in" (Check-in management) tab — `app/admin/system/page.tsx`, route `/admin/system`.
- Each setting is shown with an explanatory paragraph (what the rule does, what value to enter) above its input, plus a smaller live hint (e.g. "Tương đương 3 giờ 0 phút").
- The daily limit has an "Không giới hạn" (Unlimited) checkbox; checking it disables the number input and saves `NULL`.
- Protected automatically by the existing `/admin/*` auth middleware — no extra auth code.

## 4. Technical Details
- **Database**: `lib/database/checkin-settings-migration.sql` — creates `checkin_settings`, enables RLS with a public `SELECT` policy (the anon check-in flow needs to read it) and an `authenticated`-only `UPDATE` policy, and seeds row `id=1` with the pre-existing defaults (180 min, unlimited) so behavior is unchanged until an admin edits it.
- **Service**: `app/services/checkinSettingsService.ts` — `getSettings()` / `updateSettings(...)`. `getSettings()` falls back to the same hardcoded defaults if the table is unreachable, so a settings-read failure never blocks the physical check-in kiosk.
- **Timezone**: `lib/timezone.ts` — new `getVietnamDayStartISO()` helper, used to compute "start of today" in Vietnam time for the daily-limit count query, mirroring the existing `getVietnamMonthRange` pattern.

## 5. Error Handling
- **Cooldown**: `COOLDOWN:X` (X = remaining minutes) — unchanged format, now driven by the configurable value.
- **Daily limit**: `DAILY_LIMIT:count/max` (e.g. `DAILY_LIMIT:3/3`) — new error, parsed by `components/forms/CheckInForm.tsx` and shown in the same modal as the cooldown error (branched by a `blockReason` state), with copy explaining the plate has reached today's limit.
- A failed daily-count query fails open (logs, doesn't throw) so a transient DB error never blocks a legitimate check-in.

## 6. Related
- [customer-checkin.md](./customer-checkin.md) — the check-in flow these settings govern.
