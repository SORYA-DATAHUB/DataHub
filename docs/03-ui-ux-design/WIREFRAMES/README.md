# DataHub — Wireframes & Mockups (index)

| Field | Value |
|---|---|
| Document | #16 — Wireframes & Mockups |
| Path | `docs/03-ui-ux-design/WIREFRAMES/` |
| Version | v1.0 |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | Design lead (CTO role) |
| Related | [`../UI_UX_DESIGN.md`](../UI_UX_DESIGN.md) (routes §3, behaviour), [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) (tokens, components), [`../USER_FLOWS.md`](../USER_FLOWS.md) |

## 0. Document header

**Purpose.** Provide low-fidelity structural wireframes for every significant page of DataHub so that layout, content hierarchy, component choice and actions are agreed before implementation, and define how high-fidelity visuals are produced.

**Scope.** All 64 required pages (`UI_UX_DESIGN.md` §3). Significant pages have their own wireframe; pages that share a layout with another page (e.g. legal pages, list pages of the same pattern) are covered by a shared wireframe with the differences listed.

**Assumptions.** Wireframes are ASCII in Markdown code blocks — reviewable in any diff, versioned with the code. Desktop width is drawn at ~1280–1440 px unless marked "Mobile (375 px)". Content strings are representative English UI copy; Khmer content appears where real content would be Khmer.

**Decisions.**
- **High-fidelity visuals are produced as screenshots of the implemented UI**, not as separate design-tool mockups. During Phase H (production hardening) Playwright captures every route in light and dark themes at 1440 px and 375 px into `WIREFRAMES/screenshots/` using the naming `NN-route-slug.{light|dark}.{desktop|mobile}.png` (e.g. `42-admin-payouts-id.dark.desktop.png`). This guarantees the hi-fi designs never drift from the product.
- Hi-fi styling is fully defined by the tokens and component specs in [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md); wireframes deliberately carry no colour. Where a wireframe marks a tone (e.g. `[● Paid]`), the badge mapping in DESIGN_SYSTEM §9 applies.
- Route and page number are given in each wireframe heading and must match `UI_UX_DESIGN.md` §3.

**Dependencies.** UI_UX_DESIGN §3 (routes), §5 (navigation), §6 (dashboards), §9 (editor/review workspace), §10 (responsive), §11 (states), §12 (confirmations); DESIGN_SYSTEM §8–§9.

**Acceptance criteria.**
1. Every page 1–64 is covered by at least one wireframe (coverage table below).
2. Every wireframe heading cites page number(s) and route(s) that exist in UI_UX_DESIGN §3.
3. The Phase H screenshot set contains one light and one dark desktop capture, and one light mobile capture, for every routable page (#1–#61, #64); #62/#63 captured via test routes that trigger them.

## Legend

```
┌──┐ panel / card            [Button]  primary or secondary button   (•) radio   [x] checkbox
│  │                         [Button▾] dropdown / menu button        ‹ › pagination / prev-next
└──┘                         [● Status] status badge (tone per DS §9) ⌕ search   ▤ filter
═══ sticky bar / divider     {Input............} text input           ⋯ row action menu
░░░ skeleton / image area    ▓▓▓▓▓░░░ progress bar                   ↕ sortable column
```

## Files and coverage

| File | Pages covered |
|---|---|
| [`01-public.md`](01-public.md) | #1 Home, #2 How It Works, #3 Pricing, #4 Supported Data Types, #5 Contact/Help, #6–#8 Legal (shared template) |
| [`02-auth-onboarding.md`](02-auth-onboarding.md) | #9 Login (+MFA), #10 Registration, #11 Email Verification, #12 Forgot Password, #13 Reset Password, #14 Contributor Onboarding (4 steps) |
| [`03-contributor.md`](03-contributor.md) | App shell, #15 Dashboard, #16 Upload Dataset, #17 Upload Progress (+ resume state, mobile), #18 My Datasets (+ mobile cards), #19 Dataset Details, #20 Earnings, #21 Withdrawals (+ request dialog), #22 Withdrawal Details, #25 Profile |
| [`04-admin-core.md`](04-admin-core.md) | #27 Admin Dashboard, #28 User Management, #29 User Details, #30 Contributor Verification, #31 All Datasets, #32 Dataset Details (admin), #34 Review Queue, #35 Annotation Projects, #36 Create Annotation Project, #37 Project Details, #38 Assignments, #39 Annotation Review Queue, #45 Export Center, #46 Analytics, #47 Audit Logs, #48 System Settings |
| [`05-admin-finance.md`](05-admin-finance.md) | #40 Payment Overview, #41 Payout Requests, #42 Payout Details (+ approve, mark-paid type-to-confirm, reject dialogs), #43 Pricing Management, adjustment dialog |
| [`06-annotation-editor.md`](06-annotation-editor.md) | #49 Annotator Dashboard, #50 My Tasks, #51 Task Details, #52 Annotation Editor (three-panel detail, conflict, recovery, submit, versions, read-only notice), #53 Submitted, #54 Feedback, #55 Annotation Earnings |
| [`07-reviewer.md`](07-reviewer.md) | #56 Reviewer Dashboard, #57 Dataset Review Tasks, #33 Dataset Review Workspace (+ finalize dialog), #58 Annotation Review Tasks, #59 Annotation Comparison, #60 Review History |
| [`08-messaging-settings-errors.md`](08-messaging-settings-errors.md) | #23 Messages, #44 Admin Messaging, #24 Notifications, #26 Account Settings, #61 Access Denied, #62 Not Found, #63 Server Error, #64 Maintenance |
| `screenshots/` | Hi-fi captures of the implemented UI (added in Phase H) |
