# Feature: Customer Check-in System

## 1. Objective
Provide a fast, reliable, and mobile-friendly way for vehicle owners to log their charging sessions at physical stations. This system serves as the primary data source for the points and reward system.

## 2. Core Logic
- **License Plate Normalization**: 
    - Input: `51H - 123.45`, `51h 12345`, `51-H1-23.45`
    - Result: `51H12345` (Stripped of all non-alphanumeric characters, uppercase).
    - Purpose: Ensure data consistency across all database queries.
- **Cooldown (Safety Check)**:
    - Enforces a **45-minute interval** between check-ins for the same license plate.
    - Prevents accidental duplicates or system gaming.
    - **Bypass**: Test plates starting with `99H` or `90H` are exempt from cooldown.
- **Points Tracking**:
    - Each successful check-in increments the customer's `total_points`.
    - Sessions are logged in the `charging_sessions` table with a `completed` status.

## 3. User Experience (UX)
- **Component**: `components/forms/CheckInForm.tsx`
- **Masked Inputs**: Auto-formats `51H12345` to `51H-12345` visually for better readability while typing.
- **Dynamic Flows**:
    - **Known Customer**: Checks in immediately, shows monthly/total stats and rank.
    - **New Customer**: Prompts for Name and Phone Number registration.
    - **Winner Detection**: If the user has a pending reward, a special "Winner" popup is prioritized over the success message.
- **Animations**:
    - Framer Motion for smooth entry/exit of form fields and modals.
    - Confetti celebration upon detecting a "Completed" reward status.

## 4. Technical Details
- **Service**: `app/services/checkinService.ts` handles all backend interactions.
- **Database**:
    - `customers` table is updated via `upsert` on `license_plate`.
    - `charging_sessions` table records each unique event.
- **Timezone**: All sessions use Postgres `timestamptz`, with application logic filtering by Vietnam time (UTC+7).

## 5. Error Handling
- **Cooldown Error**: Returns a specific `COOLDOWN:X` message where X is the remaining minutes.
- **Validation**: Client-side regex for plate formats and minimum phone number lengths.
- **System Errors**: Graceful alerts for database connection issues.
