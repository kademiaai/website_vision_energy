# Vision Energy — Sequence Diagrams

> Mermaid-based sequence diagrams visualizing the two core business flows.

---

## Flow A: Customer Check-in with Reward Notification

```mermaid
sequenceDiagram
    participant Customer as Customer (Browser)
    participant Form as CheckInForm.tsx
    participant CheckIn as checkinService.ts
    participant DB as Supabase DB
    participant Reward as rewardService.ts
    participant Voucher as evoucherService.ts

    Customer->>Form: Enter plate (e.g. "51F-029.42")
    Customer->>Form: Select member/new-customer
    Customer->>Form: Click "Xác nhận sạc xe"
    Form->>Form: validateForm() — plate ≥ 5 chars, name+phone if new

    alt Plate not found & member mode
        Form->>Customer: Show "Xe chưa đăng ký" modal
        Customer->>Form: Click "Đăng ký khách hàng mới"
        Form->>Form: Switch to new-customer mode
    end

    Form->>CheckIn: processCheckIn(cleanPlate, name?, phone?)
    
    Note over CheckIn: Normalize: "51F-029.42" → "51F02942"

    CheckIn->>DB: SELECT checkin_settings (cooldown_minutes, max_checkins_per_day)
    DB-->>CheckIn: settings

    alt Test plate (99H99999 / 90H9999)
        CheckIn->>CheckIn: Bypass cooldown + daily limit
    else
        CheckIn->>DB: SELECT last session for plate
        DB-->>CheckIn: lastSession.start_time
        CheckIn->>CheckIn: diffMinutes < settings.cooldown_minutes?
        alt Too soon
            CheckIn-->>Form: throw COOLDOWN:X minutes
            Form->>Customer: Show cooldown modal
        end
        CheckIn->>DB: COUNT sessions today for plate
        DB-->>CheckIn: todayCount
        alt todayCount >= settings.max_checkins_per_day
            CheckIn-->>Form: throw DAILY_LIMIT:count/max
            Form->>Customer: Show daily-limit modal
        end
    end

    CheckIn->>DB: SELECT customer by license_plate
    DB-->>CheckIn: existingCustomer | null

    CheckIn->>CheckIn: calc newTotalPoints = (existing || 0) + 1
    CheckIn->>DB: UPSERT customers (license_plate unique)
    CheckIn->>DB: INSERT into charging_sessions
    CheckIn->>DB: SELECT COUNT(*) for this month
    DB-->>CheckIn: monthlyCount

    par Fetch pending notifications in parallel
        CheckIn->>Reward: getPendingNotification(plate)
        Note over Reward: Checks for unseen completion (priority)<br/>or unseen selection
        Reward->>DB: SELECT rewards WHERE status=completed<br/>AND completion_seen_at IS NULL
        DB-->>Reward: completion reward | null
        Reward->>DB: SELECT rewards WHERE status=eligible<br/>AND selection_seen_at IS NULL
        DB-->>Reward: selection reward | null
        Reward-->>CheckIn: { reward, type } | null

        CheckIn->>Voucher: getPendingVoucherNotification(plate)
        Note over Voucher: Gated by day-of-month >= 5<br/>AND matching reward.status = completed
        Voucher->>DB: expireOverdueVouchers() — reclaim past-expiry
        Voucher->>DB: SELECT assigned-but-unopened voucher for plate
        DB-->>Voucher: voucher | null
        Voucher->>Reward: getRewardByPlateAndPeriod()
        DB-->>Voucher: reward.status === completed?
        Voucher-->>CheckIn: EVoucher | null
    end

    CheckIn->>CheckIn: Compute rank from customerService rankings
    CheckIn-->>Form: CheckInResult { isNewCustomer, monthlyCount, totalCount, rank, pendingReward, pendingVoucher }

    Form->>Form: Determine modal priority

    alt pendingReward.type === "completion"
        Note over Form: celebration modal + confetti
        Form->>Customer: Show "Chúc mừng! Đã duyệt thưởng" modal
        alt pendingVoucher exists
            Form->>Customer: Show "Mở E-voucher" button in modal
        end
        Customer->>Form: Click "Đã nhận được quà"
        Form->>Reward: markNotificationAsSeen(rewardId, "completion")

    else pendingVoucher && (no completion modal shown)
        Note over Form: Standalone e-voucher notification
        Form->>Customer: Show "Bạn có một E-VOUCHER!" modal
        Customer->>Form: Click "Mở thẻ quà tặng"
        Form->>Customer: Navigate to /evouchers/{token}

    else pendingReward.type === "selection"
        Note over Form: Winner announcement
        Form->>Customer: Show "Chúc mừng! Đã đạt phần thưởng" modal
        Customer->>Form: Click "Xác minh nhận quà"
        Form->>Customer: Navigate to /rewards/{token}

    else
        Note over Form: Standard success
        Form->>Customer: Show "Check-in thành công!" modal
        Form->>Customer: Show stats (monthly, total, rank)
    end
```

---

## Flow B: Admin Reward Management + E-Voucher Assignment

```mermaid
sequenceDiagram
    participant Admin as Admin (Browser)
    participant Leaderboard as leaderboard/page.tsx
    participant RewSvc as rewardService.ts
    participant CustSvc as customerService.ts
    participant VouchSvc as evoucherService.ts
    participant DB as Supabase DB
    participant CustPortal as Customer Portal (Browser)
    participant OCR as ocrAction.ts (Server)

    %% ── LOAD LEADERBOARD ──
    Admin->>Leaderboard: Select month/year, open Monthly tab
    Leaderboard->>RewSvc: getMonthlyLeaderboard(month, year)
    RewSvc->>CustSvc: getCustomerRankings({ type: "month", month, year })
    CustSvc->>DB: SELECT from charging_sessions WITH filter
    DB-->>CustSvc: sessions grouped by plate
    CustSvc-->>RewSvc: CustomerRanking[] (sorted, ranked)
    RewSvc->>DB: SELECT rewards for period
    DB-->>RewSvc: reward status per plate
    RewSvc-->>Leaderboard: LeaderboardEntry[] (ranked + enriched)

    Leaderboard->>VouchSvc: expireOverdueVouchers()
    Leaderboard->>VouchSvc: getAssignedVouchersForPeriod()
    VouchSvc->>DB: SELECT assigned evouchers
    DB-->>VouchSvc: EVoucher[]
    VouchSvc-->>Leaderboard: Map<plate, EVoucher>

    Leaderboard->>VouchSvc: getTierRules()
    VouchSvc->>DB: SELECT evoucher_tier_rules
    DB-->>VouchSvc: EVoucherTierRule[]
    VouchSvc-->>Leaderboard: rules
    Leaderboard-->>Admin: Render table with badges + assign controls

    %% ── ASSIGN E-VOUCHER ──
    Admin->>Leaderboard: Click "Gán" for a customer
    Note over Leaderboard: Uses tier-rule default or manual denomination pick
    Leaderboard->>VouchSvc: assignVoucher(plate, denom, month, year, rank, adminEmail)
    VouchSvc->>DB: SELECT oldest available voucher with denomination
    DB-->>VouchSvc: candidate.id
    VouchSvc->>DB: UPDATE evoucher SET status="assigned", assigned_plate=...,<br/>expiry=lastDayOfCurrentMonth
    alt Race: already taken
        DB-->>VouchSvc: null (row not found — another admin grabbed it)
        VouchSvc-->>Leaderboard: error "thử lại"
    else Success
        DB-->>VouchSvc: updated EVoucher
        VouchSvc-->>Leaderboard: { success, voucher }
    end
    Leaderboard-->>Admin: Refresh table

    %% ── GENERATE REWARD LINK ──
    Admin->>Leaderboard: Select customers (checkboxes)
    Admin->>Leaderboard: Click "Tạo link nhận thưởng"
    Leaderboard->>RewSvc: generateRewardTokens([{ plate, month, year, sessions }])
    RewSvc->>DB: INSERT rewards (status="eligible", random token)
    DB-->>RewSvc: inserted rows
    RewSvc-->>Leaderboard: { token, plate }[]
    Leaderboard-->>Admin: "Đã tạo X link!" alert

    %% ── BULK ASSIGN E-VOUCHER ──
    Admin->>Leaderboard: Click "Gán E-voucher hàng loạt"
    Leaderboard->>Leaderboard: Filter unassigned customers matching tier rules
    Leaderboard->>VouchSvc: loop: assignVoucher() for each candidate
    VouchSvc-->>Leaderboard: results
    Leaderboard-->>Admin: "Đã gán X/Y e-voucher"

    %% ── CUSTOMER CLAIMS REWARD ──
    Customer->>CustPortal: Open /rewards/{token} link
    CustPortal->>RewSvc: validateToken(token)
    RewSvc->>DB: SELECT reward by token
    DB-->>RewSvc: Reward | null
    RewSvc-->>CustPortal: { valid, reward, message }

    Note over CustPortal: Step 1: Verify Identity
    Customer->>CustPortal: Enter plate + phone
    CustPortal->>RewSvc: verifyIdentity(token, plate, phone)
    RewSvc->>DB: SELECT reward (match plate to token)
    RewSvc->>DB: SELECT customer (match phone to plate)
    DB-->>RewSvc: verified
    RewSvc-->>CustPortal: { verified: true }

    Note over CustPortal: Step 2: Capture CCCD + OCR
    Customer->>CustPortal: Upload/photo of CCCD
    CustPortal->>CustPortal: downsizeImage() — resize to 1600px
    CustPortal->>OCR: performOcr(formData with image)
    OCR->>PuterAI: POST gpt-4o-mini with base64 image
    alt Success
        PuterAI-->>OCR: JSON { full_name, id_number }
        OCR-->>CustPortal: { success, full_name, id_number }
    else Fail
        PuterAI-->>OCR: error
        OCR->>PuterAI: POST mistral (fallback)
        alt Still fail
            PuterAI-->>OCR: error
            OCR-->>CustPortal: { success: false }
            Note over CustPortal: Manual input fallback
        end
    end

    Note over CustPortal: Step 3: Review & Submit
    Customer->>CustPortal: Enter bank details + consent
    CustPortal->>RewSvc: uploadIdPhoto(file) → Supabase Storage
    RewSvc->>DB: INSERT into storage bucket "verification-docs"
    DB-->>RewSvc: storage path
    CustPortal->>RewSvc: submitRewardClaim({ token, id_name, id_number, photo_url, bank... })
    RewSvc->>DB: UPDATE rewards SET status="processing", bank info, OCR flag
    DB-->>RewSvc: updated row
    RewSvc-->>CustPortal: { success: true }
    CustPortal-->>Customer: "Gửi thành công!" screen

    %% ── ADMIN APPROVES ──
    Admin->>Leaderboard: Switch to "Lịch sử thưởng" tab
    Leaderboard->>RewSvc: getRewardsByPeriod(month, year)
    RewSvc->>DB: SELECT rewards WITH customers JOIN for period
    DB-->>RewSvc: RewardWithCustomer[]
    RewSvc-->>Leaderboard: enriched list
    Leaderboard-->>Admin: Show all rewards with status badges

    Admin->>Leaderboard: Click checkmark (approve) for a reward
    Leaderboard->>RewSvc: approveReward(rewardId, notes?)
    RewSvc->>DB: UPDATE rewards SET status="completed", rewarded_at=now()
    DB-->>RewSvc: success
    RewSvc-->>Leaderboard: { success: true }
    Leaderboard->>RewSvc: loadData() — refresh
    Admin->>Admin: Customer sees "completed" on next check-in

    %% ── CUSTOMER OPENS E-VOUCHER ──
    Customer->>CustPortal: Open /evouchers/{token}
    CustPortal->>VouchSvc: getVoucherByToken(token)
    VouchSvc->>DB: RPC get_evoucher_by_token(p_token)
    DB-->>VouchSvc: EVoucher | null
    VouchSvc-->>CustPortal: voucher
    Customer->>CustPortal: Click "Mở thẻ quà tặng"
    CustPortal->>VouchSvc: logOpen(token, userAgent)
    VouchSvc->>DB: RPC open_evoucher_by_token(p_token, p_user_agent)
    Note over VouchSvc: Atomic: flip assigned→opened<br/>bump open_count<br/>write audit log<br/>stamp reward.evoucher_opened_at
    DB-->>VouchSvc: updated EVoucher
    VouchSvc-->>CustPortal: { success, voucher }
    CustPortal->>Customer: window.open(voucher.link) → UrBox
```

---

## Flow C: Admin E-Voucher Upload & Reset

```mermaid
sequenceDiagram
    participant Admin as Admin (Browser)
    participant Page as evouchers/page.tsx
    participant Parse as evoucherParseAction.ts
    participant VouchSvc as evoucherService.ts
    participant DB as Supabase DB

    %% ── UPLOAD ──
    Admin->>Page: Click "Tải lên Excel"
    Admin->>Page: Select .xlsx file + optional password
    Admin->>Page: Click "Tải lên"
    Page->>Parse: parseVoucherFile(formData)

    alt File is encrypted
        Parse->>Parse: officecrypto.decrypt(buffer, password)
        alt Wrong password
            Parse-->>Page: error "Sai mật khẩu"
        end
    end

    Parse->>Parse: XLSX.read(buffer) → parse each sheet
    Note over Parse: Expected columns: Index, Link Card, Số tiền, Hạn chi tiêu, Mã PIN
    Parse-->>Page: { success, rows: ParsedVoucherRow[] }

    Page->>VouchSvc: importParsedVouchers(rows, fileName, month, year, adminEmail)
    VouchSvc->>DB: INSERT evoucher_uploads (batch record)
    DB-->>VouchSvc: batch.id
    loop for each row
        VouchSvc->>DB: INSERT evouchers (...)
        alt Duplicate link (unique constraint)
            VouchSvc->>VouchSvc: duplicateCount++
        else Other error
            VouchSvc->>VouchSvc: errorCount++
        else Success
            VouchSvc->>VouchSvc: insertedCount++
        end
    end
    VouchSvc->>DB: UPDATE evoucher_uploads SET counts
    VouchSvc-->>Page: { success, insertedCount, duplicateCount, errorCount }
    Page-->>Admin: "Đã nhập X/Y voucher" message

    %% ── RESET ──
    Admin->>Page: Select assigned/opened vouchers (checkboxes)
    Admin->>Page: Click "Đặt lại Mới (X)"
    Page->>Admin: Confirmation modal: "Xóa lịch sử thưởng + đặt lại?" / "Chỉ đặt lại voucher?"
    Admin->>Page: Confirm with/without reward deletion

    loop for each selected voucher
        alt Delete reward history chosen
            VouchSvc->>RewardSvc: getRewardByPlateAndPeriod()
            VouchSvc->>RewardSvc: deleteReward() + audit log
        end
        VouchSvc->>DB: UPDATE evoucher SET status="available",<br/>clear assignment fields,<br/>new random token
    end

    VouchSvc->>DB: refresh inventory + voucher list
    DB-->>VouchSvc: updated data
    VouchSvc-->>Page: reloadData()
    Page-->>Admin: Table refreshed, vouchers back to "Mới"
```

---

## Legend

| Shape | Meaning |
|-------|---------|
| Solid arrow `->>` | Function/method call |
| Dashed arrow `-->>` | Return value |
| `alt / else` | Conditional branch |
| `note over X` | Description of internal logic |
| `loop` | Iterative operation |
| `par` | Parallel operations |
