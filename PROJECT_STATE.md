# 🚀 Vision Energy — Project State & Handover

This document summarizes the current state of the Vision Energy project for continued development.

## 1. Project Overview
Vision Energy is a mobile-first management system for vehicle charging stations. It tracks charging sessions via license plates and rewards top users through an AI-powered verification system.

## 2. Current Progress (Completed)
- [x] **Core Infrastructure**: Next.js 15 (App Router), Supabase integration, Tailwind CSS v4.
- [x] **Customer Check-in**:
    - Plate normalization logic (`51H-123.45` → `51H12345`).
    - 45-minute cooldown enforcement (prevents rapid duplicate check-ins).
    - New customer registration flow.
    - Test plate bypass logic (starts with `99H` or `90H`).
- [x] **Leaderboard System**:
    - Monthly rankings based on charging sessions (ICT UTC+7).
    - All-time leaderboard based on lifetime points.
- [x] **Monthly Reward System**:
    - Admin-generated unique reward tokens.
    - In-app winner notifications (displayed upon next check-in).
    - Confirmation/Celebration popups with confetti.
    - **Gift Received Confirmation**: Users can confirm receipt, and admins can track the exact confirmation timestamp in the leaderboard history.
- [x] **AI-Powered Identity Verification**:
    - Token-protected public reward portal.
    - Identity cross-check (Plate + Phone) before OCR.
    - **Puter AI Integration**: OCR extraction of Name and ID number from CCCD photos using `gpt-4o-mini`.
    - Client-side image resizing (< 1MB) for performance.
    - Private storage for ID photos with short-lived signed URLs for admins.

## 3. Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind 4.
- **Backend**: Supabase (Postgres, Auth, SSR, Storage).
- **AI**: Puter AI (OpenAI-compatible REST API).
- **Animation**: Framer Motion, Canvas Confetti.
- **Timezone**: `Asia/Ho_Chi_Minh` (UTC+7) handled via `lib/timezone.ts`.

## 4. Key Directory Structure
- `app/services/`: Core business logic (Checkin, Reward, OCR, Customer).
- `app/rewards/[token]/`: Public portal for reward claiming.
- `app/admin/leaderboard/`: Admin dashboard for rankings and rewards.
- `components/forms/CheckInForm.tsx`: The primary interaction point for customers.
- `features/`: Detailed documentation for individual features.
- `lib/`: Utilities for Supabase, Timezones, and Image processing.

## 5. Database Schema (Supabase)
- **`customers`**: `license_plate` (PK), `full_name`, `phone_number`, `total_points`.
- **`charging_sessions`**: `id`, `license_plate` (FK), `start_time`, `status`.
- **`rewards`**: `id`, `license_plate` (FK), `month`, `year`, `token`, `status` (`eligible`, `processing`, `completed`, `rejected`), `id_card_photo_url`, `id_full_name`, `id_number`.

## 6. Pending / Roadmap
- [ ] **Zalo Integration**: Real-time notifications for rewards and check-ins.
- [ ] **Station Maps**: Integration with Mapbox/Google Maps for station discovery.
- [ ] **Advanced Reporting**: Exporting session data to CSV/Excel for business analysis.
- [ ] **Email Auth**: Transition from simple login to full Supabase Auth.

## 7. Developer Notes
- **Time Handling**: Always use `lib/timezone.ts` to get month ranges or current periods. Avoid `new Date().getMonth()` directly for database queries.
- **OCR Fallback**: The OCR service has a built-in fallback to `mistral` if `gpt-4o-mini` fails.
- **Surgical Edits**: Maintain the premium design aesthetic (Glassmorphism, smooth transitions) when adding new components.
