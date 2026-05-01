# 🚀 Vision Energy — Project State & Handover

> **Last Updated:** April 30, 2026
> This is the **single source of truth** for the Vision Energy project. All key information is consolidated here.

---

## 1. Project Overview
Vision Energy is a mobile-first management system for a physical EV charging station at **85 Nguyễn Văn Quỳ, P. Tân Thuận, TPHCM**. It tracks charging sessions via license plates and rewards top users through an AI-powered verification system.

---

## 2. Technology Stack
| Category | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.4 |
| UI Library | React | 19.2.3 |
| Language | TypeScript (Strict) | 5.x |
| Styling | Tailwind CSS | 4.x |
| Backend-as-a-Service | Supabase (Postgres, Auth, SSR, Storage) | Latest |
| AI / OCR | Puter AI (OpenAI-compatible REST API) | — |
| Animations | Framer Motion | 12.27.5 |
| Celebrations | Canvas Confetti | 1.9.4 |
| Charts | Recharts | 3.8.0 |
| Icons | Lucide React | 0.562.0 |
| Excel Export | xlsx | 0.18.5 |
| Theme | next-themes | 0.4.6 |
| UI Primitives | Radix UI (Switch) | 1.2.6 |
| Utilities | clsx, tailwind-merge, class-variance-authority | — |

---

## 3. Current Progress (All Completed ✅)

### 3.1 Core Infrastructure
- Next.js 15+ App Router with `src/`-less structure
- Supabase SSR client (`@supabase/ssr`) for both browser and server
- Tailwind CSS v4 with `tailwindcss-animate`
- Dark/light theme via `next-themes` with `ThemeProvider`
- Middleware-based auth guard for `/admin/*` routes

### 3.2 Customer Check-in (`app/page.tsx` → `CheckInForm.tsx` → `checkinService.ts`)
- **Plate normalization**: `51H-123.45` → `51H12345` (strip all non-alphanumeric, uppercase)
- **45-minute cooldown** enforcement per plate (prevents rapid duplicate check-ins)
- **Test plate bypass**: Plates starting with `99H` or `90H` skip cooldown
- **New customer registration**: Prompts for name + phone on first visit
- **Masked inputs**: Auto-formats `51H12345` → `51H-12345` visually
- **Points tracking**: Each check-in increments `customers.total_points` and logs to `charging_sessions`
- **Winner detection**: After check-in, checks for pending rewards and shows notification popup

### 3.3 Leaderboard System (`app/admin/leaderboard/` → `rewardService.ts`)
- **Tab 1 — Monthly Rankings**: Filter by month/year, shows sessions count + rank
- **Tab 2 — All-Time Rankings**: Lifetime `total_points` from `customers` table
- **Tab 3 — Reward History**: Full reward lifecycle with status, dates, lifetime counts
- **Admin actions**: Generate reward tokens, approve/reject submissions, view ID photos

### 3.4 Monthly Reward System
- Admin generates unique reward tokens (`crypto.randomUUID()`) for selected winners
- **In-app winner notifications**: Popup on next check-in with "Claim Now" button
- **Celebration popups**: Confetti animation when reward is marked completed
- **Gift Received Confirmation**: Users confirm receipt; admins see exact timestamp
- **Notification tracking**: `selection_seen_at` and `completion_seen_at` timestamps

### 3.5 AI-Powered Identity Verification (`app/rewards/[token]/` → `ocrAction.ts`)
- **Token-protected public portal** (no login required)
- **3-step process**: Verify Identity → Capture CCCD → Review & Submit
- **Identity cross-check**: Plate + Phone must match `customers` record before OCR access
- **Puter AI OCR**: `gpt-4o-mini` primary model, `mistral` fallback
- **Client-side image resizing**: `< 1MB` via `lib/imageUtils.ts` before upload
- **Private storage**: ID photos in `verification-docs` bucket with short-lived signed URLs
- **Re-submission support**: Users who already submitted can update their information

### 3.6 Admin Dashboard (`app/admin/`)
- **Dashboard** (`/admin`): Session stats with date filters, refresh, summary cards
- **Sessions** (`/admin/sessions`): Full session history with search, pagination, Excel export
- **Customers** (`/admin/customers`): Customer list with search, sort, VIP tracking
- **Leaderboard** (`/admin/leaderboard`): Rankings + reward management (see 3.3)

### 3.7 Authentication
- Supabase Auth with email/password
- Login page at `/login` with branded UI
- Middleware redirects: unauthenticated → `/login`, authenticated → `/admin`
- Logout clears session and redirects to `/login`

---

## 4. Directory Structure (Complete)
```
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (fonts, ThemeProvider)
│   ├── page.tsx                # Public check-in landing page
│   ├── globals.css             # Global styles + Tailwind
│   ├── admin/
│   │   ├── layout.tsx          # Admin sidebar + nav
│   │   ├── page.tsx            # Admin dashboard
│   │   ├── customers/page.tsx  # Customer management
│   │   ├── sessions/page.tsx   # Session history + Excel export
│   │   └── leaderboard/page.tsx # Rankings + reward management
│   ├── login/page.tsx          # Admin login
│   ├── rewards/[token]/page.tsx # Public reward portal (3-step OCR)
│   └── services/               # Business logic layer
│       ├── checkinService.ts   # Check-in processing + cooldown
│       ├── customerService.ts  # Customer queries + rankings
│       ├── rewardService.ts    # Reward lifecycle + leaderboard
│       ├── sessionService.ts   # Session queries + stats
│       └── ocrAction.ts        # Server Action: Puter AI OCR
├── components/
│   ├── ThemeProvider.tsx       # next-themes wrapper
│   ├── TopCustomersChart.tsx   # Recharts bar chart
│   ├── forms/CheckInForm.tsx   # Main check-in form + modals
│   ├── layout/                 # Header, Footer
│   ├── sections/Amenities.tsx  # Station amenities display
│   └── ui/switch.tsx           # Radix Switch wrapper
├── lib/
│   ├── supabase.ts             # Browser Supabase client
│   ├── timezone.ts             # Vietnam UTC+7 utilities
│   ├── imageUtils.ts           # Client-side image downsizing
│   ├── utils.ts                # cn() classname merger
│   ├── database/rewards-migration.sql # Rewards table DDL + RLS
│   └── types/reward.ts         # Reward TypeScript interfaces
├── constants/translations.ts   # vi/en translations
├── features/                   # Feature design documents
│   ├── customer-checkin.md
│   ├── top-10-monthly-rewards.md
│   └── ai-ocr-verification.md
├── Instructions/
│   ├── CLAUDE.md               # Coding guidelines
│   └── SKILLS/ba-skills-main/skills/ # BA/SRS agent skills
├── middleware.ts               # Auth guard for /admin/*
├── package.json
└── tsconfig.json
```

---

## 5. Database Schema (Supabase)

### `customers`
| Column | Type | Notes |
|---|---|---|
| `license_plate` | TEXT (PK) | Normalized (no dashes/dots) |
| `full_name` | TEXT | Nullable for legacy imports |
| `phone_number` | TEXT | Nullable |
| `total_points` | INTEGER | Lifetime check-in count |
| `created_at` | TIMESTAMPTZ | Auto |

### `charging_sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `license_plate` | TEXT (FK → customers) | |
| `start_time` | TIMESTAMPTZ | Auto |
| `status` | TEXT | `completed` |
| `station_id` | TEXT | `station_01` |

### `rewards`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto |
| `license_plate` | TEXT (FK → customers) | |
| `month` | INTEGER | 1-12 |
| `year` | INTEGER | ≥ 2020 |
| `checkin_count` | INTEGER | Snapshot at reward time |
| `token` | TEXT (UNIQUE) | Portal access token |
| `status` | TEXT | `eligible` → `processing` → `completed` / `rejected` |
| `id_full_name` | TEXT | OCR extracted |
| `id_number` | TEXT | OCR extracted |
| `id_card_photo_url` | TEXT | Storage path |
| `is_ocr_verified` | BOOLEAN | |
| `selection_seen_at` | TIMESTAMPTZ | Winner popup seen |
| `completion_seen_at` | TIMESTAMPTZ | Celebration seen |
| `rewarded_at` | TIMESTAMPTZ | Admin approval time |
| `admin_notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | Auto |

**Constraints:**
- `UNIQUE(license_plate, month, year)` — one reward per customer per month
- `UNIQUE(token)` — each portal link is unique

---

## 6. Key Business Rules
- **Timezone**: All period calculations use **UTC+7 (Asia/Ho_Chi_Minh)** via `lib/timezone.ts`
- **Plate normalization**: `plate.toUpperCase().replace(/[^A-Z0-9]/g, "")` — must be identical across all services
- **Cooldown**: 45 minutes between check-ins for same plate (bypassed for `99H*` / `90H*` test plates)
- **Reward FK**: References `license_plate` (text), NOT a UUID `customer_id`
- **Optimistic concurrency**: Status updates use `.eq('status', 'expected_value')` guards
- **OCR fallback**: `gpt-4o-mini` → `mistral` on failure
- **Re-submission**: Users with `processing` status can update their CCCD info

---

## 7. Pending / Roadmap
- [ ] **Zalo Integration**: Real-time notifications for rewards and check-ins
- [ ] **Station Maps**: Integration with Mapbox/Google Maps for station discovery
- [ ] **Advanced Reporting**: Enhanced CSV/Excel export for business analysis
- [ ] **Email Auth**: Transition from simple login to full Supabase Auth with email verification

---

## 8. Developer Notes
- **Time Handling**: Always use `lib/timezone.ts` for month ranges or current periods. Never use `new Date().getMonth()` directly for DB queries.
- **OCR Fallback**: Built-in fallback to `mistral` if `gpt-4o-mini` fails.
- **Surgical Edits**: Maintain the premium design aesthetic (Glassmorphism, smooth transitions). Match existing code style.
- **Feature Docs**: All new features must be documented in `features/` before implementation (per `CLAUDE.md`).
- **BA/SRS Skills**: Use `brd-agent` for requirements elicitation, `srs-agent` for structured use case specs.
