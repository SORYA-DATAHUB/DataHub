# Wireframes 08 — Messaging, notifications, settings & system pages

| Field | Value |
|---|---|
| Document | #16 Wireframes — part 08 (messaging, settings, errors) |
| Version | v1.0 · 2026-10-26 · Baseline |
| Pages | #23, #44, #24, #26, #61, #62, #63, #64 |

**Purpose.** Layouts for user and admin messaging, the notification centre, account settings and the global system views. **Scope.** `/messages`, `/messages/[id]`, `/admin/messages`, `/admin/messages/[id]`, `/notifications`, `/settings`, `/access-denied`, not-found, error boundary, `/maintenance`. **Assumptions.** Real-time updates arrive over `WS /api/v1/ws` (`message.created`, `notification.created`, `conversation.updated`); attachments ≤ 10 MB are virus-scanned before becoming downloadable. **Decisions.** Messaging uses a two-pane layout (list + thread) on desktop and a stacked list → thread navigation on mobile; admins get a third context pane. System pages use a minimal layout (logo, message, actions) without the app shell so they render even when the API is down. **Dependencies.** Baseline §9 (conversation states), §12 (messaging, notifications, auth/session endpoints); UI_UX_DESIGN §11 (states), §13 (accessibility); USER_FLOWS §12. **Acceptance criteria.** Unread state, timestamps, conversation status, search and attachments are visible; system pages show request IDs where available and never expose stack traces.

---

## #23 Messages — `/messages` and `/messages/[id]`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Messages                                                         [+ New conversation]        │
│ ┌ Conversations ───────────────────┐ ┌ Payment for PO-7F3A2B ───────────── [● Reply needed]┐ │
│ │ ⌕ {Search messages}              │ │ Linked: Withdrawal PO-7F3A2B →          [⋯ Close]  │ │
│ │ [All] [Unread 1] [Closed]        │ │ ─────────────────────────── 24 Oct ──────────────  │ │
│ │ ┌──────────────────────────────┐ │ │ (SC) You · 09:20                                   │ │
│ │ │● Payment for PO-7F3A2B   2h  │ │ │  ┌──────────────────────────────────────────────┐  │ │
│ │ │  Support: Please confirm your│ │ │  │ Hello, I haven't received my withdrawal yet. │  │ │
│ │ │  ABA account name…           │ │ │  └──────────────────────────────────────────────┘  │ │
│ │ ├──────────────────────────────┤ │ │                     Support (Lina) · 11:02 (LH)    │ │
│ │ │  ឯកសារប្រវត្តិសាស្ត្រ ១៩៦០  1d │ │ │  ┌──────────────────────────────────────────────┐  │ │
│ │ │  Dataset · You: អរគុណ…        │ │ │  │ Please confirm your ABA account name matches │  │ │
│ │ ├──────────────────────────────┤ │ │  │ your legal name.                              │  │ │
│ │ │  Upload question     Closed  │ │ │  │ 📎 aba-name-guide.pdf · 220 KB  [Download]    │  │ │
│ │ └──────────────────────────────┘ │ │  └──────────────────────────────────────────────┘  │ │
│ │                                  │ │                                  Read ✓✓ 11:05     │ │
│ │                                  │ │ ──────────────────────────────────────────────────  │ │
│ │                                  │ │ {Write a message… (Khmer & English supported)    } │ │
│ │                                  │ │ [📎 Attach]  Enter = new line · Ctrl Enter = send  │ │
│ │                                  │ │                                          [Send]    │ │
│ └──────────────────────────────────┘ └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Attachment while scanning: "📎 scan.jpg · Scanning for viruses…" (not downloadable until clean;
 infected → "Removed: failed security scan").
 New conversation dialog: Subject · Related to [None ▾ / dataset / withdrawal] · Message · Attach.
 Mobile: list view → tap → full-screen thread with back arrow; composer sticky at bottom.
 Empty: ✉ "No conversations yet. Questions about uploads, reviews or payments? Start one."
```

## #44 Admin Messaging — `/admin/messages` and `/admin/messages/[id]`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Support inbox                                                                                                │
│ ┌ Inbox ───────────────────────┐ ┌ Payment for PO-7F3A2B · Sophea Chan ──── [● Open] ┐ ┌ Context ──────────┐ │
│ │ ⌕ {Search subject, user}     │ │                                         [Status ▾] │ │ (SC) Sophea Chan  │ │
│ │ [Open 3] [Awaiting user 5]   │ │ … thread (same component as #23) …                 │ │ [● Active]        │ │
│ │ [Closed] [All]               │ │                                                    │ │ [● Verified]      │ │
│ │ Linked [Any ▾]               │ │                                                    │ │ Wallet avail $42.17│ │
│ │ ┌──────────────────────────┐ │ │                                                    │ │ Open payout       │ │
│ │ │● Sophea C. · PO-7F3A2B 2h│ │ │                                                    │ │ PO-7F3A2B $25.00  │ │
│ │ │  Payment for PO-7F3A2B   │ │ │                                                    │ │ [● Approved]      │ │
│ │ │● Kosal R. · dataset   5h │ │ │                                                    │ │ Recent datasets   │ │
│ │ │  Why rejected?    ⚠ 24h+ │ │ │ ────────────────────────────────────────────────── │ │ · Newspapers 1998 │ │
│ │ │  Dara K.         1d      │ │ │ {Reply…}                                           │ │ [Open user →]     │ │
│ │ │  Annotation access       │ │ │ [📎 Attach]              After sending: (•) Await  │ │                   │ │
│ │ └──────────────────────────┘ │ │                          user ( ) Keep open        │ │                   │ │
│ │                              │ │                                     [Send reply]   │ │                   │ │
│ └──────────────────────────────┘ └────────────────────────────────────────────────────┘ └───────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 Status menu: Open · Awaiting user · Closed (L2 for Close). Age chip warns when a user message is
 unanswered > 24 h. Every message in the thread is visible to the user (no internal notes in v1).
```

## #24 Notifications — `/notifications`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Notifications                                       [All] [Unread 3]     [Mark all as read]  │
│ TODAY                                                                                        │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ● ✓ Dataset approved                                                          2h ago     │ │
│ │     "Newspapers 1998" was approved. $2.40 credited to your balance.  → Open dataset      │ │
│ ├──────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ ● ▣ Earnings credited                                                         2h ago     │ │
│ │     +$2.40 from Newspapers 1998.                                     → View earnings     │ │
│ ├──────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ ● ⚠ Changes requested                                                         5h ago     │ │
│ │     "ឯកសារប្រវត្តិសាស្ត្រ ១៩៦០": please remove blank pages and resubmit.  → Review feedback │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ YESTERDAY                                                                                    │
│ │ ○ ¤ Withdrawal approved — PO-7F3A2B for $25.00                              → View       │ │
│ │ ○ ⇪ Dataset received — "សៀវភៅសិក្សា ថ្នាក់ទី៩" (38 files)                        → View       │ │
│ [Load more]                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Clicking an item marks it read and navigates. Bell popover (top bar) shows latest 8 + "View all".
 Empty: 🔔 "You're all caught up."
```

## #26 Account Settings — `/settings`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Settings                                                                                     │
│ [Security] [Notifications] [Appearance] [Accessibility] [Privacy]                            │
│ ┌ Password ───────────────────────────────────────────────────────────────────────────────┐  │
│ │ Current password {……}   New password {……}   Confirm {……}           [Change password]   │  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Two-step verification ──────────────────────────────────────────────────────────────────┐  │
│ │ Status: Off   (Required for admin accounts)                          [Set up]           │  │
│ │ Setup sheet: 1 Scan QR (+ manual key) → 2 Enter 6-digit code → 3 Save 10 recovery codes │  │
│ │ [Download codes] [Copy] · "I've saved my recovery codes" [x] → [Finish]                 │  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Active sessions ────────────────────────────────────────────────────────────────────────┐  │
│ │ Chrome on Windows · Phnom Penh · this device            now                             │  │
│ │ Chrome on Android · Siem Reap                           2 days ago        [Revoke]      │  │
│ │                                                            [Sign out all other sessions]│  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Notifications tab: matrix of events × [In-app ✓ (always)] [Email ☐/☑]; security & payment emails
 can't be turned off (shown checked + disabled with explanation).
 Appearance tab: Theme (•) System ( ) Light ( ) Dark · Table density (•) Comfortable ( ) Compact ·
 "Dim document pages in dark mode" switch.
 Accessibility tab: Single-key shortcuts [On/Off] · Reduce motion (follows OS / force on) ·
 Show focus outline always [On/Off].
 Privacy tab: Download my data (via support request) · "Danger zone" card: Request account deletion
 → L4 type DELETE; explains financial records are kept 7 years and pending payouts must be resolved.
 Admin without MFA (redirected with ?tab=security&setup=mfa): warning Alert at top "Set up two-step
 verification to access the admin workspace." Setup sheet opens automatically.
```

## #61 Unauthorized / Access Denied — `/access-denied` (also rendered in place, HTTP 403)

```
                 ┌──────────────────────────────────────────────────────────────┐
                 │ ▤ DataHub                                                    │
                 │                                                              │
                 │      ⛨ (48px)                                                │
                 │      You don't have access to this page                      │
                 │      This area needs the Admin role. You're signed in as     │
                 │      sophea@example.com with: Contributor, Annotator.        │
                 │                                                              │
                 │      [Go to my dashboard]   [Contact support]                │
                 │      Signed in with the wrong account?  Log out              │
                 └──────────────────────────────────────────────────────────────┘
```

## #62 Not Found — `app/not-found.tsx` (HTTP 404)

```
                 ┌──────────────────────────────────────────────────────────────┐
                 │ ▤ DataHub                                                    │
                 │      404                                                     │
                 │      We can't find that page                                 │
                 │      The link may be wrong, or the item may have been        │
                 │      removed or isn't shared with you.                       │
                 │      [Go home]   [Help center]                               │
                 └──────────────────────────────────────────────────────────────┘
 Signed-in users: "Go home" → their workspace home; guests → "/".
```

## #63 Server Error — `app/error.tsx` / `app/global-error.tsx` / static `500.html`

```
                 ┌──────────────────────────────────────────────────────────────┐
                 │ ▤ DataHub                                                    │
                 │      Something went wrong on our side                        │
                 │      Your work is saved where autosave applies. Try again in │
                 │      a moment.                                               │
                 │      [Try again]   [Go home]                                 │
                 │      ▸ Details   Request ID 7c1e…a90 [Copy]                  │
                 │      Include this ID if you contact support.                 │
                 └──────────────────────────────────────────────────────────────┘
 Segment error.tsx keeps the app shell (sidebar/top bar) and replaces only the page body.
 global-error.tsx and Caddy's static 500.html render this minimal layout with inline CSS.
```

## #64 Maintenance / Service Unavailable — `/maintenance` (HTTP 503) / static `maintenance.html`

```
                 ┌──────────────────────────────────────────────────────────────┐
                 │ ▤ DataHub                                                    │
                 │      ⚙ Scheduled maintenance                                 │
                 │      DataHub is being updated. Expected back by              │
                 │      26 Oct 2026, 22:00 (your time).                         │
                 │      Uploads in progress will resume when we're back.        │
                 │      This page checks again automatically every 30 seconds.  │
                 │      [Check now]                                             │
                 └──────────────────────────────────────────────────────────────┘
 Without a configured end time: "We'll be back shortly." Super admins see "Continue as super admin →".
```
