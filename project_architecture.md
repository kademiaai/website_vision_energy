# 🏗️ Vision Energy — Project Architecture

## 1. Project Identity
**Vision Energy** is a modern, mobile-first management system for vehicle charging stations. It enables efficient tracking of charging sessions through license plate recognition/entry and provides a comprehensive dashboard for station administrators.

---

## 2. Technology Stack
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Runtime**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend-as-a-Service**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, SSR)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 3. High-Level Architecture
The project follows a **Service-Oriented Architecture** within a Next.js App Router structure. Business logic is decoupled from UI components and resides in a dedicated service layer.

### Directory Structure
```text
/
├── app/                  # Next.js App Router (Routes & Pages)
│   ├── admin/            # Protected Admin Dashboard & Management
│   ├── login/            # Authentication Pages
│   └── page.tsx          # Public Customer Check-in (Landing Page)
├── services/             # Business Logic Layer (Supabase Interactions)
│   ├── checkinService.ts # Core check-in & cooldown logic
│   ├── customerService.ts# Customer CRUD & points management
│   └── sessionService.ts # Charging session tracking & analytics
├── components/           # UI Components
│   ├── forms/            # Complex forms (CheckInForm, etc.)
│   ├── layout/           # Global Header, Footer, Providers
│   ├── sections/         # Page sections (Amenities, Hero)
│   └── ui/               # Base UI components (Buttons, Inputs)
├── lib/                  # Core Utilities & Configurations
│   └── supabase.ts       # Supabase client initialization
├── constants/            # Application Constants & Translations
├── public/               # Static Assets
└── Instructions/         # Project Guidelines & Master Prompts
```

---

## 4. Domain Model & Database
The application relies on two primary entities in the PostgreSQL database:

### `customers`
Tracks unique vehicle owners.
- `license_plate` (Primary Key, Normalized)
- `full_name`
- `phone_number`
- `total_points` (Lifetime charging sessions)

### `charging_sessions`
Records every individual charging event.
- `id` (UUID)
- `license_plate` (Foreign Key)
- `start_time`
- `status` (completed, active)
- `station_id`

---

## 5. Core Workflows

### 🏎️ Customer Check-in
1. **Plate Normalization**: Inputs like `51H-123.45` are stripped of special characters and capitalized to `51H12345` for data integrity.
2. **Cooldown Check**: The system enforces a **30-minute cooldown** between sessions for the same vehicle to prevent accidental double-entries.
3. **Upsert Logic**: New plates trigger customer registration; existing plates increment the `total_points` counter.
4. **Session Logging**: A new entry is created in `charging_sessions` for every successful check-in.

### 📊 Admin Monitoring
- **Stats Calculation**: Aggregates data for total sessions, unique customers, and average sessions per day.
- **Real-time Updates**: (Planned/Ongoing) Leveraging Supabase Realtime to push new check-ins to the dashboard without page refreshes.

---

## 6. Coding Standards & Guidelines
As defined in `Instructions/CLAUDE.md`, the following rules apply:
- **Surgical Changes**: Modify only what is requested. Maintain existing code style and formatting.
- **Simplicity First**: Avoid speculative abstractions. Focus on readable, maintainable code.
- **Type Safety**: No usage of `any`. All interfaces and types must be explicitly defined.
- **Mobile-First UX**: The customer-facing check-in form must be optimized for field usage (large touch targets, clear feedback).

---

## 7. Roadmap (Based on FieldOps Instructions)
Future enhancements inspired by the `FieldOps` roadmap include:
- [ ] **Leaderboard**: Ranking customers based on charging frequency.
- [ ] **Zalo Integration**: Real-time notifications and support via Zalo.
- [ ] **Advanced Maps**: Mapbox integration for station discovery.
- [ ] **Reporting**: Exporting session data to Excel/CSV for business analysis.
