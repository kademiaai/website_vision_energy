# Vision Energy — Code Architecture

> **Project**: Vision Energy EV Charging Station Check-in & Reward System  
> **Stack**: Next.js 16 (App Router), TypeScript, Supabase (PostgreSQL), Tailwind CSS 4, Framer Motion, Recharts, Lucide React  
> **Backend-as-a-Service**: Supabase (Auth, Database, Storage)  
> **AI OCR**: Puter.ai (GPT-4o-mini / Mistral)  
> **Auth**: Supabase SSR (middleware-based route protection)

---

## 1. Directory Structure

```
website_vision_energy/
├── app/                    # Next.js App Router — pages & services
│   ├── admin/              # Admin dashboard (protected by middleware)
│   ├── evouchers/[token]/  # Public e-voucher open page
│   ├── login/              # Admin login page
│   ├── rewards/[token]/    # Public reward claim portal
│   └── services/           # Server-action & service modules
├── components/             # Reusable UI components
│   ├── forms/              # Check-in form
│   ├── layout/             # Header, Footer
│   ├── sections/           # Amenities section
│   └── ui/                 # Switch (Radix), SettingsPopover
├── constants/              # i18n translations (vi/en)
├── docs/                   # Documentation
│   └── architecture/       # This file + sequence diagrams
├── features/               # Feature requirement docs
├── Instructions/           # Dev instructions & skills
├── lib/                    # Shared utilities & types
│   ├── database/           # SQL migration files
│   └── types/              # TypeScript interfaces
├── public/                 # Static assets
└── scratch/                # Dev/test scripts
```

---

## 2. File-by-File Feature Breakdown

### 2.1. Customer Check-in Flow

| File | Role |
|------|------|
| `app/page.tsx` | **Home page** — renders Header, CheckInForm, Amenities, Footer. Manages language state (`vi`/`en`). Uses Framer Motion for entrance animations. |
| `components/forms/CheckInForm.tsx` | **~600-line check-in form** — the most complex component. Handles: plate formatting (auto-dash), member/new-customer toggle, cooldown enforcement, success/reward/voucher modals. Manages 5+ concurrent modal states with priority (completion > selection > voucher > success). Calls `processCheckIn`, then fetches pending notifications. |
| `app/services/checkinService.ts` | **Core check-in logic** — normalizes plate (`toUpperCase` + strip non-alphanumeric), enforces an admin-configurable cooldown (default 180-min, read from `checkin_settings` via `checkinSettingsService`) plus an optional per-plate daily limit, upserts customer, inserts charging_session, calculates monthly count, fetches pending reward + e-voucher notifications in parallel, computes rank. |
| `app/services/checkinSettingsService.ts` | Reads/writes the singleton `checkin_settings` row (`cooldown_minutes`, `max_checkins_per_day`) backing Admin > Quản lý hệ thống > Quản lý check-in (`/admin/system`). |

**Data flow**:  
`CheckInForm.submit()` → `processCheckIn(plate, name?, phone?)` →  
1. Fetch `checkin_settings` (cooldown minutes + daily limit)
2. Check cooldown, then check daily limit (test plates bypass both)
3. Upsert `customers` table (license_plate unique)  
4. Insert `charging_sessions` row  
5. Count monthly sessions  
6. `Promise.all([rewardService.getPendingNotification, evoucherService.getPendingVoucherNotification])`  
7. Return `CheckInResult` → render appropriate modal

**Priority stacking**:  
- If `pendingReward.type === "completion"` → show celebration modal with e-voucher button embedded  
- Else if `pendingVoucher` → show e-voucher modal  
- Else if `pendingReward.type === "selection"` → show winner announcement  
- Else → show standard success modal

---

### 2.2. Customer Service

| File | Role |
|------|------|
| `app/services/customerService.ts` | **Customer data access** — queries `customers` + `charging_sessions`. Key functions: `getAllCustomers()`, `getCustomerByPlate()`, `getAllCustomersWithStats()`, `getCustomerRankings(filter)` (groups sessions by plate, sorts by count), `getQuickStats()`, `searchCustomers(keyword)`. |

**Ranking logic**:  
- Queries `charging_sessions` with a date filter  
- Groups by `license_plate`  
- Counts sessions per plate  
- Sorts descending → assigns 1-based rank  
- Flags `is_vip` for >= 10 sessions  
- Used by both `sessionService` (Top Customers chart) and `rewardService` (leaderboard)

---

### 2.3. Session Service

| File | Role |
|------|------|
| `app/services/sessionService.ts` | **Session query + stats** — `getSessions(filter)` supports 8 filter types (today, yesterday, 7d, 30d, month, lastMonth, custom). `getTopCustomers()` groups sessions. `getTopCustomersChartData()` returns chart-ready data with colors. `getSessionsChartData()` groups by day. `calculateStats()` computes totals/unique/hourly. |

---

### 2.4. Reward System

| File | Role |
|------|------|
| `app/services/rewardService.ts` | **Full reward lifecycle** (~400 lines). Core functions: |
| | • `getMonthlyLeaderboard(month, year)` — wraps `customerService.getCustomerRankings()` + enriches with reward status + lifetime reward counts |
| | • `getAllTimeLeaderboard()` — from `customers.total_points` |
| | • `generateRewardTokens(entries)` — creates reward rows with `status: "eligible"`, returns tokens |
| | • `validateToken(token)` — checks reward exists; returns `alreadySubmitted` flag for re-submission |
| | • `verifyIdentity(token, plate, phone)` — matches plate to reward, phone to customers |
| | • `verifyCustomerByPlate(plate, phone)` — direct lookup (used by reward history lookup) |
| | • `submitRewardClaim(data)` — updates reward with CCCD info + bank details, sets `status: "processing"` |
| | • `approveReward(id)` / `rejectReward(id)` — admin actions |
| | • `getRewardHistory(plate)` — fetches + enriches with monthly rank/sessions; includes ILIKE fallback |
| | • `getPendingNotification(plate)` — checks for unseen completions (priority) or selections |
| | • `uploadIdPhoto()` → Supabase Storage (`verification-docs` bucket) |
| | • `getIdPhotoUrl()` → signed URL (5 min expiry) |
| | • `deleteReward()` + audit log |

| `lib/types/reward.ts` | TypeScript interfaces: `Reward`, `RewardClaimInput`, `RewardCreateInput`, `RewardWithCustomer`, `RewardHistoryEntry`, `LeaderboardEntry`. |

**Reward lifecycle**:  
`eligible` → `processing` (customer submits CCCD + bank) → `completed` (admin approves) or `rejected`

---

### 2.5. E-Voucher System

| File | Role |
|------|------|
| `app/services/evoucherParseAction.ts` | **Excel parser** (Server Action). Decrypts password-protected UrBox Excel files via `officecrypto-tool`, parses sheets with XLSX. Extracts: denomination, voucher_code, row_index, link, pin, expiry_date. Returns `ParseVoucherFileResult`. |
| `app/services/evoucherService.ts` | **Full voucher lifecycle** (~350 lines). Core functions: |
| | • `importParsedVouchers(rows, fileName, month, year)` — batch insert with duplicate detection |
| | • `hasUploadForPeriod()` — checks if file uploaded for current month |
| | • `getInventorySummary()` — groups by denomination, counts available/assigned/opened |
| | • `getAllVouchers()` — full list for admin detail table |
| | • `expireOverdueVouchers()` — lazy reclaim of assigned-but-unopened vouchers past expiry |
| | • `assignVoucher(plate, denomination, month, year, rank)` — picks oldest available, updates + sets expiry to end of current month |
| | • `unassignVoucher(id)` — returns to pool with new token |
| | • `resetVoucherToAvailable(id)` — clears assignment + counters + regenerates token |
| | • `getPendingVoucherNotification(plate)` — checks assigned-but-unopened voucher, gated by completed reward |
| | • `getAssignedVoucherForPlate(plate, month, year)` — via SECURITY DEFINER RPC |
| | • `getVoucherByToken(token)` — via SECURITY DEFINER RPC |
| | • `logOpen(token, userAgent)` — atomic open via RPC (avoids race conditions on open_count) |
| | • `getTierRules()` / `addTierRule()` / `updateTierRule()` / `deleteTierRule()` — admin-configurable rank→denomination mapping |
| `lib/types/evoucher.ts` | TypeScript interfaces: `EVoucher`, `EVoucherUpload`, `EVoucherOpenLog`, `ParsedVoucherRow`, `VoucherInventorySummary`, `EVoucherTierRule`. Plus `getVoucherTierForRank()` helper. |

**Voucher lifecycle**:  
`available` → `assigned` (admin assigns to plate) → `opened` (customer clicks open link)  
**Lazy expiry**: assigned vouchers past `expiry_date` are reclaimed on any read operation.

---

### 2.6. AI OCR

| File | Role |
|------|------|
| `app/services/ocrAction.ts` | **Server Action** — sends CCCD photo to Puter.ai OpenAI-compatible API. Primary model: GPT-4o-mini. Fallback: Mistral. Detects Puter auth expiry (`reauth_required`) for clear error messages. Returns `OcrResult` with `full_name` + `id_number`. |
| `lib/imageUtils.ts` | Client-side image downsizer — resizes to max 1600px, converts to JPEG 80% quality, keeps payload under ~10MB. |

---

### 2.7. Admin Pages

| Page | File | Key Features |
|------|------|-------------|
| **Dashboard** | `app/admin/page.tsx` | 3 stat cards (sessions, customers, avg/day). Filter dropdown (7 presets + custom date). Recent sessions table (top 8). Refresh button. |
| **Sessions** | `app/admin/sessions/page.tsx` | Full session list with search + 7 filter presets + custom date range. Pagination (15/page). Export to Excel (XLSX). Embedded `TopCustomersChart` (bar/pie/table views via Recharts). 4 stat cards. |
| **Customers** | `app/admin/customers/page.tsx` | Grid of customer cards. Search by plate/name/phone. Sort by recency/loyalty/name/plate. VIP badge (≥10 sessions). Stat cards (active customers, VIP count, total sessions). |
| **Leaderboard** | `app/admin/leaderboard/page.tsx` | **Most complex admin page** (~500 lines). 3 tabs: Monthly / All-Time / History. Filterable columns (COLS toggles persisted to localStorage). Search + Top-N filter. Multi-select + bulk reward link generation. E-voucher assignment per row (dropdown + assign button). Bulk e-voucher assignment modal. Reward approval/rejection per row. Delete reward with confirmation modal. Inline reward history popup. Export to Excel (per tab). |
| **E-Vouchers** | `app/admin/evouchers/page.tsx` | Inventory summary cards (by denomination). Full voucher detail table (checkbox multi-select → bulk reset to "available" with optional reward history deletion). Upload modal (password-protected Excel). Tier rule settings (CRUD for rank→denomination mapping). Open logs table. Upload reminder banner for current period. |

**Admin Layout** (`app/admin/layout.tsx`):  
- Sidebar with logo + user info + 5 nav items  
- Mobile hamburger overlay  
- Dark mode toggle (localStorage)  
- Logout button  
- Responsive: sidebar slides in/out on mobile

---

### 2.8. Customer Portals

| Page | File | Features |
|------|------|----------|
| **Reward Claim** | `app/rewards/[token]/page.tsx` | Multi-step form: (1) Verify identity (plate + phone) → (2) Capture CCCD photo + Auto OCR → (3) Review & Consent → Submit. Handles re-submission for processing/completed rewards. Shows e-voucher link if available. Step indicator. Bank dropdown (15 Vietnamese banks). |
| **E-Voucher Open** | `app/evouchers/[token]/page.tsx` | Single-page: loads voucher by token via RPC, shows denomination + expiry, handles first open (atomic via `open_evoucher_by_token` RPC), opens UrBox link in new tab. Includes "Sao chép link để mở sau" copy-to-clipboard button for saving the UrBox link to use in an external browser. Handles error states (invalid token, not assigned). |

---

### 2.9. Supporting Modules

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout — Geist fonts, ThemeProvider, global CSS |
| `middleware.ts` | Supabase SSR auth — protects `/admin/*` routes, redirects authenticated users away from `/login` |
| `lib/supabase.ts` | Supabase client singleton (browser client via `@supabase/ssr`). Graceful stub if env vars missing. |
| `lib/timezone.ts` | Vietnam (UTC+7) utilities: `getVietnamMonthRange()`, `getCurrentVietnamPeriod()`, `getCurrentVietnamDate()`, `getCurrentVietnamDateISO()`, `getLastDayOfMonthISO()`, `formatVietnamTime()`. Used for reward period boundary calculation + e-voucher expiry. |
| `lib/telemetry.ts` | Lightweight event logger — console + file append (server-side only, best-effort). |
| `lib/utils.ts` | `cn()` — Tailwind class merge utility (clsx + tailwind-merge). |
| `components/ThemeProvider.tsx` | Wraps `next-themes` ThemeProvider with hydration guard. |
| `components/ui/switch.tsx` | Radix UI Switch primitive (used in column visibility toggles). |
| `components/ui/SettingsPopover.tsx` | Click-outside-to-close popover for column toggles. |
| `constants/translations.ts` | i18n map — `vi` and `en` keys covering all UI strings. |

---

## 3. Key Design Decisions

1. **No cron jobs** — e-voucher expiry runs lazily on any read operation (`expireOverdueVouchers()` called at the beginning of inventory/leaderboard reads).

2. **Atomic e-voucher open** — `open_evoucher_by_token` is a SECURITY DEFINER Postgres RPC that handles read-then-write in a single transaction, preventing race conditions on `open_count` or duplicate `first_opened_at`.

3. **Secure token access** — both `get_evoucher_for_plate_period` and `get_evoucher_by_token` are SECURITY DEFINER RPCs that bypass RLS for authenticated access only, preventing anon users from enumerating vouchers.

4. **Reward notification priority** — `completion` (admin approved) > `selection` (announced but not yet submitted). E-voucher is only shown when matching reward is `completed`.

5. **Cooldown bypass** — test plates (`99H99999`, `90H9999`) skip both the cooldown (default 180-min, admin-configurable) and the daily check-in limit, for testing.

6. **Client-side OCR downsizing** — images are resized client-side before upload to avoid Puter's 10MB base64 payload limit.

7. **Fallback chains**:
   - OCR: GPT-4o-mini → Mistral → manual input
   - Reward history: exact match → ILIKE fallback (for variant plate formats)
   - Admin audit logs: best-effort (failures silently ignored)
