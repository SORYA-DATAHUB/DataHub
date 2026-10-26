# Wireframes 05 — Admin finance

| Field | Value |
|---|---|
| Document | #16 Wireframes — part 05 (admin finance) |
| Version | v1.0 · 2026-10-26 · Baseline |
| Pages | #40–#43 (+ approval, rejection, mark-paid, failure, reversal and adjustment dialogs) |

**Purpose.** Layouts for the financial back office: overview/ledger, payout queue, payout detail and every payout action dialog, pricing management. **Scope.** `/admin/finance`, `/admin/payouts`, `/admin/payouts/[id]`, `/admin/pricing`. **Assumptions.** All amounts come from the API in micros and are formatted per DESIGN_SYSTEM §12 (floor to cents; exact micros shown as secondary text in ledger views). Separation of duties is enforced by the API and reflected in the UI by hiding actions on one's own payout. **Decisions.** Mark-paid uses the L4 type-to-confirm-amount dialog; reversal and adjustments also type the amount; pricing changes create a new versioned rule (never edit in place) and type the new rate. Each financial action generates an `Idempotency-Key` when its dialog opens. **Dependencies.** Baseline §8.5–§8.7, §9 (payout states), §12 (finance endpoints), HA-07 (dual approval threshold); USER_FLOWS §5–§7; UI_UX_DESIGN §12. **Acceptance criteria.** Mark-paid cannot submit until reference, paid-at and the exact typed amount are provided; actions not allowed in the current status are not rendered; every action appends to the payout timeline.

---

## #40 Payment Overview — `/admin/finance`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Finance                                                    Period [This month ▾]             │
│ [Overview] [Ledger] [Reconciliation] [Adjustments]                                           │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐                 │
│ │ AVAILABLE    │ RESERVED     │ PENDING      │ PAID (PERIOD)│ CREDITED     │                 │
│ │ (owed)       │ (in payouts) │ (hold)       │              │ (PERIOD)     │                 │
│ │ $96.42       │ $209.50      │ $0.00        │ $210.00      │ $331.42      │                 │
│ │ 214 users    │ 4 payouts    │              │ 11 payouts   │ data $301.00 │                 │
│ │              │              │              │              │ annot. $30.42│                 │
│ └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘                 │
│ ┌ Payouts needing action ─────────────────────────────┐ ┌ Reconciliation ──────────────────┐ │
│ │ 3 requested (1 needs 2nd approval) · 1 approved,    │ │ ✓ Balanced · last run 02:00      │ │
│ │ unpaid > 3 days ⚠                [Open payouts →]   │ │ Σ journals = 0 · 0 mismatches    │ │
│ └─────────────────────────────────────────────────────┘ └──────────────────────────────────┘ │
│ ┌ Credited vs paid per week ─────────────────────────────────────────────────────────────┐   │
│ │ bars chart-2 credited / chart-1 paid             [View as table]                       │   │
│ └────────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### #40 — Ledger tab (`?tab=ledger`, compact density by default)

```
│ Kind [Any ▾]  User [Any ▾]  Source {…}  [From – To]                                          │
│ ┌──────────────────┬──────────────────────┬──────────────────┬───────────────────┬──────────┐│
│ │ Time             │ Journal kind         │ Idempotency key  │ Lines             │ Amount   ││
│ │ 26 Oct 11:31:07  │ [Reserved for withdr]│ payout:PO-7F3A2B:│ Sophea available  │ −$25.00  ││
│ │                  │                      │ reserve          │ Sophea reserved   │ +$25.00  ││
│ │ 25 Oct 14:05:33  │ [Dataset earning]    │ dataset_review:  │ Sophea available  │ +$2.40   ││
│ │                  │                      │ RV-1C9F02:earning│ sys purchases main│ −$2.40   ││
│ └──────────────────┴──────────────────────┴──────────────────┴───────────────────┴──────────┘│
│ Row → sheet with exact micros per line ($2.400000), source link, created_by, request id.    │
```

Reconciliation tab: last 30 nightly runs (time, result badge, mismatches count) with mismatch detail (wallet, bucket, cached vs computed). Adjustments tab: list of adjustments (user, credit/debit, amount, reason, by, time) and, for super admin, **[+ New adjustment]** (dialog below).

## #41 Payout Requests — `/admin/payouts`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Payouts                                                                                      │
│ [Requested 3] [Approved 1] [Paid] [Rejected] [Cancelled] [Failed] [Reversed] [All]           │
│ Method [Any ▾]  Amount [Any ▾]  ⌕ {User, email, PO ref}                  Sort [Oldest ▾]     │
│ ┌──────────┬─────────────────────┬──────────┬────────────────┬──────────────────┬──────────┐ │
│ │ Request  │ Recipient           │ Amount   │ Method         │ Status           │ Age      │ │
│ │ PO-7F3A2B│ Sophea Chan ✓       │ $25.00   │ ABA Pay ••456  │[● Approved · aw.]│ 4 d ⚠    │ │
│ │ PO-81C0D9│ Kosal Ros ✓         │ $140.00  │ Bank ••0031    │[● 1 of 2 approv.]│ 1 d      │ │
│ │ PO-81C1E2│ Dara Keo ✓          │ $14.50   │ ABA Pay ••771  │[● Requested]     │ 3 h      │ │
│ │ PO-81C2A0│ Lina Hong (you)     │ $30.00   │ Wise ••lina    │[● Requested]     │ 2 h      │ │
│ └──────────┴─────────────────────┴──────────┴────────────────┴──────────────────┴──────────┘ │
│ "(you)" rows: actions unavailable — "Another admin must handle your own payout."             │
│ Totals footer for current filter: 4 requests · $209.50                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #42 Payout Details — `/admin/payouts/[id]`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Payouts › PO-81C0D9                                                              ‹ prev next ›│
│ $140.00 to Kosal Ros                     [● 1 of 2 approvals]                                │
│ Requested 25 Oct 2026, 16:02 · Idempotency key ⧉        [Reject]  [Approve (2nd approval)]   │
│ ┌ Recipient ──────────────────────────────────┐ ┌ Payout method (admin-only details) ───────┐│
│ │ (KR) Kosal Ros  kosal@example.com           │ │ Bank transfer                              ││
│ │ [● Active] [● Verified 12 Sep 2026]         │ │ Bank        ACLEDA Bank Plc.               ││
│ │ Wallet: available $3.12 · reserved $140.00  │ │ Account     Kosal Ros                      ││
│ │ Lifetime paid $260.00 · 4 payouts           │ │ Number      0001-22-334455-0031     ⧉      ││
│ │ [Open user →]                               │ │ Currency    USD                            ││
│ └─────────────────────────────────────────────┘ └────────────────────────────────────────────┘│
│ ┌ Approvals ──────────────────────────────────┐ ┌ Timeline ──────────────────────────────────┐│
│ │ Threshold $100.00 → 2 approvals required    │ │ ● Requested  25 Oct 16:02  by Kosal        ││
│ │ ✓ Lina Hong   26 Oct 09:10                  │ │   payout_reserve $140.00                   ││
│ │ ○ Second approver (not Lina, not Kosal)     │ │ ● Approved (1/2) 26 Oct 09:10 by Lina      ││
│ └─────────────────────────────────────────────┘ └────────────────────────────────────────────┘│
│ ┌ Source of funds (earning journals that built the balance, latest 10) ───────────────────┐  │
│ │ 24 Oct Dataset earning "Market price lists" $1.40 · 20 Oct Annotation rewards $12.30 …   │  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Header actions by status (and never for own payout):
   requested → [Reject] [Approve]          approved → [Cancel] [Mark failed] [Mark as paid]
   paid → [Reverse] (super admin only)     rejected/cancelled/failed/reversed → none
 Approved state also shows: "Transfer $140.00 to the account above, then record it."
```

### #42 — Approve dialog (L2)

```
┌ Approve payout PO-81C0D9? ────────────────────────────────────┐
│ $140.00 to Kosal Ros · Bank transfer ••0031                   │
│ This is the 2nd of 2 required approvals. After approving, the │
│ payout is ready to be paid.                                   │
│                                  [Cancel]  [Approve payout]   │
└───────────────────────────────────────────────────────────────┘
```

### #42 — Mark as paid dialog (L4, type-to-confirm amount)

```
┌ Record payment for PO-81C0D9 ─────────────────────────────────────────────┐
│ Confirm you have already transferred the money outside DataHub.           │
│ ┌ Transfer ─────────────────────────────────────────────────────────────┐ │
│ │ To        Kosal Ros · ACLEDA · 0001-22-334455-0031                    │ │
│ │ Amount    $140.00                                                     │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│ Payment reference (required, unique for Bank transfer)                    │
│ {ACL-TRX-2026102600781.....................................}             │
│ Paid at (required, not in the future)                                     │
│ {26/10/2026} {14:20}  (Asia/Phnom_Penh)                                   │
│ Proof of payment (optional · PDF/PNG/JPG ≤ 10 MB · stored privately)      │
│ [Choose file]  receipt-0781.pdf ✓                                         │
│ Note (optional)                                                           │
│ {.......................................................................} │
│ ─────────────────────────────────────────────────────────────────────────  │
│ Type the amount to confirm:  ⟦140.00⟧                                     │
│ {140.00..........}  ✓ matches                                             │
│                                                                           │
│ This moves $140.00 from reserved to paid and notifies Kosal by email.     │
│                                    [Cancel]  [Mark $140.00 as paid]       │
└───────────────────────────────────────────────────────────────────────────┘
 Button (money variant) disabled until: reference non-empty, paid-at valid, typed amount matches.
 409 duplicate reference → inline error on reference: "This reference is already recorded on
 PO-19B0C4. Check you haven't paid twice."
 Proof is uploaded first (POST /admin/payouts/{id}/proof), then POST …/mark-paid.
```

### #42 — Reject / Mark failed / Cancel dialogs (L3)

```
┌ Reject payout PO-81C1E2? ─────────────────────────────────────┐
│ $14.50 will return to Dara Keo's available balance.           │
│ Reason (sent to the user, required)                           │
│ {Payout method name doesn't match verified legal name.......} │
│                                 [Cancel]  [Reject payout]     │
└───────────────────────────────────────────────────────────────┘
 Mark failed: same layout, title "Mark payment as failed?", reason required, copy:
 "Use this if the transfer was attempted and did not go through. Reserved $25.00 returns to available."
 Cancel (approved): "Cancel this approved payout? Reserved amount returns to available." reason required.
```

### #42 — Reverse dialog (super admin, L4)

```
┌ Reverse paid payout PO-19B0C4? ───────────────────────────────┐
│ Use only when a completed transfer was returned by the bank.  │
│ $20.00 moves from Paid back to Sophea Chan's available balance│
│ Reason (required) {Bank returned transfer 28 Oct, ref R-221..}│
│ Type the amount to confirm: ⟦20.00⟧  {........}               │
│                                  [Cancel]  [Reverse payout]   │
└───────────────────────────────────────────────────────────────┘
```

### #40 / #29 — New adjustment dialog (super admin, L4)

```
┌ New balance adjustment ───────────────────────────────────────┐
│ User        [Sophea Chan · sophea@example.com ▾]              │
│ Type        (•) Credit  ( ) Debit                             │
│ Amount      $ {5.00......}                                    │
│ Reason      {Compensation for mis-classified dataset DS-…...} │
│ ┌ Result preview ───────────────────────────────────────────┐ │
│ │ Available $42.17 → $47.17                                 │ │
│ │ Journal adjustment_credit · system_adjustments −$5.00     │ │
│ └───────────────────────────────────────────────────────────┘ │
│ Type the amount to confirm: ⟦5.00⟧  {........}                │
│                                  [Cancel]  [Create adjustment]│
└───────────────────────────────────────────────────────────────┘
 Debit that would make available negative → blocked: "Available is $42.17; debit can't exceed it."
```

## #43 Pricing Management — `/admin/pricing`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Pricing                                                         [+ New pricing rule] (SA)    │
│ Rates apply when a review is finalized. Past earnings keep the rate in force at that time.   │
│ ┌ Current rates ────────────────────────────────────────────────────────────────────────────┐│
│ │ Raw            $1.00 / GB     rule v1 · effective 01 Nov 2026 00:00 UTC                   ││
│ │ Clean/labeled  $1.50 / GB     rule v1 · effective 01 Nov 2026 00:00 UTC                   ││
│ └───────────────────────────────────────────────────────────────────────────────────────────┘│
│ History                                                                                      │
│ ┌──────────┬──────────────┬────────────┬──────────────────────┬──────────────┬────────────┐  │
│ │ Class    │ Rate         │ Version    │ Effective from       │ Effective to │ Created by │  │
│ │ Labeled  │ $1.50 / GB   │ v1         │ 01 Nov 2026 00:00    │ —            │ Rithy S.   │  │
│ │ Raw      │ $1.00 / GB   │ v1         │ 01 Nov 2026 00:00    │ —            │ Rithy S.   │  │
│ └──────────┴──────────────┴────────────┴──────────────────────┴──────────────┴────────────┘  │
│ Admins see this page read-only; the New rule button is absent.                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 New pricing rule dialog (L4):
 ┌ New pricing rule ─────────────────────────────────────────────┐
 │ Data class   (•) Raw  ( ) Clean/labeled                       │
 │ Rate         $ {1.20} per GB                                  │
 │ Effective    {01/01/2027} {00:00} UTC  (must be in the future)│
 │ Note         {Q1 2027 rate review..........................}  │
 │ Raw changes from $1.00 to $1.20 per GB for reviews finalized  │
 │ on or after 01 Jan 2027 00:00 UTC. Public pricing page updates│
 │ at that time.                                                 │
 │ Type the new rate to confirm: ⟦1.20⟧ {........}               │
 │                                  [Cancel]  [Publish rule]     │
 └───────────────────────────────────────────────────────────────┘
```
