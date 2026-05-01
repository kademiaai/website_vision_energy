# 🏗️ Vision Energy — Project Architecture

## 1. Project Identity
**Vision Energy** is a modern, mobile-first management system for vehicle charging stations. It enables efficient tracking of charging sessions through license plate entry and provides a comprehensive dashboard for station administrators, including an AI-powered reward system.

---

## 2. Technology Stack
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Runtime**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend-as-a-Service**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, SSR, Storage)
- **AI / OCR**: [Puter AI](https://puter.com/ai) via OpenAI-compatible REST API (Claude 3 Haiku/GPT-4o-mini, Zero-popup)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 3. High-Level Architecture
The project follows a **Service-Oriented Architecture** within a Next.js App Router structure. Business logic is decoupled from UI components and resides in a dedicated service layer within the `app` directory.

### Directory Structure
```text
/
├── app/                  # Next.js App Router (Routes & Pages)
│   ├── admin/            # Dashboard, Session History, Customer Management
│   │   └── leaderboard/  # Reward management & rankings
│   ├── login/            # Authentication
│   ├── rewards/          # [Public] Customer Reward Portal (OCR)
│   ├── services/         # Business Logic Layer (Supabase Interactions)
│   │   ├── checkinService.ts
│   │   ├── customerService.ts
│   │   ├── rewardService.ts
│   │   └── sessionService.ts
│   └── page.tsx          # Public Customer Check-in (Landing Page)
├── features/             # Feature Design Documents
│   └── top-10-monthly-rewards.md
├── components/           # UI Components
│   ├── forms/            # Complex forms (CheckInForm, etc.)
│   ├── layout/           # Global Sidebar, Header, Providers
│   └── ui/               # Base UI components (Buttons, Inputs, etc.)
├── lib/                  # Core Utilities & Configurations
│   ├── supabase.ts       # Supabase client
│   ├── imageUtils.ts     # Client-side image resizing for OCR
│   └── timezone.ts       # Vietnam (UTC+7) date utilities
├── constants/            # Application Constants & Translations
├── public/               # Static Assets
└── Instructions/         # Project Guidelines & Master Prompts
```

---

## 4. Domain Model & Database
The application relies on three primary entities in the PostgreSQL database:

### `customers`
Tracks unique vehicle owners.
- `license_plate` (Primary Key, Normalized)
- `full_name`, `phone_number`
- `total_points` (Lifetime charging sessions)

### `charging_sessions`
Records every individual charging event.
- `id` (UUID), `license_plate` (FK)
- `start_time`, `status` (completed, active)

### `rewards`
Manages monthly ranking rewards and ID verification.
- `id` (UUID), `license_plate` (FK)
- `month`, `year` (Integer)
- `id_full_name`, `id_number` (Extracted via OCR)
- `id_card_photo_url` (Storage Path)
- `token` (Unique portal access token)
- `status` (eligible, processing, completed, rejected)

---

## 5. Core Workflows

### 🏎️ Customer Check-in
1. **Plate Normalization**: Inputs like `51H-123.45` are stripped to `51H12345` for data integrity.
2. **Cooldown Check**: Enforces a **30-minute cooldown** per vehicle.
3. **Session Logging**: Each check-in increments the customer's `total_points`.

### 🏆 Monthly Rewards & OCR
1. **Leaderboard**: Admin identifies top users for a specific month (Vietnam UTC+7).
2. **Token Generation**: Admin generates unique links for selected winners.
3. **Identity Verification**: Winners verify their plate + phone on a public portal.
4. **AI OCR**: Users scan their CCCD. Images are resized client-side to < 1MB, then processed server-side via Puter's REST API using Claude 3 Haiku or GPT-4o-Mini for precision extraction.
5. **Approval**: Admin reviews extracted data and ID photos before marking as `completed`.

---

## 6. Coding Standards & Guidelines
- **Surgical Changes**: Modify only what is requested. Maintain existing code style and formatting.
- **Timezone Enforcement**: All period calculations use **UTC+7 (ICT)** via `lib/timezone.ts`.
- **Security**: ID photos are stored in private buckets; admin views them via short-lived signed URLs.
- **Type Safety**: Zero usage of `any`. Explicit interfaces for all data structures.
- **Robustness**: OCR parsing handles AI-generated Markdown JSON blocks.

---

## 7. Roadmap
- [x] **Leaderboard & Rewards**: Ranking customers and AI-powered ID verification.
- [ ] **Zalo Integration**: Real-time notifications via Zalo.
- [ ] **Advanced Maps**: Mapbox integration for station discovery.
- [ ] **Reporting**: Exporting session data to Excel/CSV.
