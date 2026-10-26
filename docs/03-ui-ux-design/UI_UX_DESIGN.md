# DataHub — UI/UX Design Document

| Field | Value |
|---|---|
| Document | #15 — UI/UX Design Document |
| Path | `docs/03-ui-ux-design/UI_UX_DESIGN.md` |
| Version | v1.0 |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | Design lead (CTO role) |
| Related | [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), [`USER_FLOWS.md`](USER_FLOWS.md), [`WIREFRAMES/`](WIREFRAMES/README.md), [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) |

## 0. Document header

**Purpose.** Define how DataHub is organised and how people move through it: the information architecture and **canonical route map for all 64 required pages**, personas, the page inventory with the API endpoints each page uses, navigation per role, dashboards, interaction principles, state patterns (empty/loading/error/success), confirmation rules for destructive and financial actions, accessibility, responsive behaviour and measurable usability requirements. The frontend implementation follows the routes in §3 exactly.

**Scope.** The Next.js web application `apps/web` (public site, authentication, contributor, annotator, reviewer, admin and super-admin workspaces, global error views). Visual tokens and components are specified in `DESIGN_SYSTEM.md`; page sketches in `WIREFRAMES/`; step-by-step flows in `USER_FLOWS.md`.

**Assumptions.**
- Roles, permissions, statuses, API contract and money rules are exactly as in `ENGINEERING_BASELINE.md` (§6, §8, §9, §12).
- Every registered user holds `contributor`; other roles are added by admins (admin roles only by super_admin).
- UI language is English (strings in a message catalogue); content is frequently Khmer.
- Contributors are often on mobile; annotators, reviewers and admins work on ≥ 1280 px screens.
- Same-origin API via Next.js rewrites (`/api/v1/*`), cookie session + CSRF header (baseline §3).

**Decisions.**
- D-UX-01 One application, four role **workspaces** (Contribute, Annotate, Review, Admin) sharing one shell; multi-role users switch via a workspace switcher. Shared personal pages (messages, notifications, profile, settings, withdrawals) are reachable from every workspace.
- D-UX-02 Route prefixes encode the workspace: none (contributor/personal), `/annotate`, `/review`, `/admin`. Public and auth pages live at the root without the app shell.
- D-UX-03 The dataset review workspace (#33) and annotation comparison (#59) are shared by reviewers and admins under `/review/...`; admin sidebar entries link to them.
- D-UX-04 Annotation editor (#52) and dataset review workspace (#33) use a **focus layout** (no sidebar, compact top bar) and are desktop-optimised; below their minimum widths they show a read-only notice.
- D-UX-05 All list state (filters, sort, page, selected tab, open sheet) is in the URL so views are shareable and survive reload.
- D-UX-06 Financial and destructive actions follow the four-level confirmation model (DESIGN_SYSTEM §8.7); **mark-paid requires typing the exact amount**.
- D-UX-07 Entities are shown with a short reference (`DS-3F9A1C`, `PO-7F3A2B`…, DESIGN_SYSTEM §8.12) in UI; URLs always use full UUIDs.
- D-UX-08 Unknown/forbidden resources: a resource the user may not access returns the Not Found view (#62) rather than revealing existence, except whole-section role denials, which show Access Denied (#61).

**Dependencies.** Baseline §6 (permissions), §7 (formats), §8 (money), §9 (states), §11 (annotation), §12 (API), §14 (WCAG 2.2 AA). Master prompt Parts 8–15.

**Acceptance criteria.**
1. Each of the 64 pages in §3 exists at the listed route (or, for #62/#63, as the listed Next.js special file) and is reachable from navigation or from a linked parent page.
2. Each page calls only the endpoints listed in §4 for its data (additional endpoints require updating this document).
3. Navigation shows only items the user's roles permit (§5); direct URL access to a forbidden section renders #61 and the API independently returns 403.
4. Every list page implements the empty, loading, error and (for mutations) success patterns in §11.
5. Every action in §12 uses the specified confirmation level; mark-paid cannot be submitted until the typed amount matches.
6. Axe-core automated checks report zero serious/critical violations on all pages in both themes; keyboard-only walkthroughs of flows in `USER_FLOWS.md` succeed (§13).
7. At 375 px width every page except #33/#52 is fully usable; #33/#52 show the read-only notice (§10).

---

## 1. Personas

| Persona | Role(s) | Context | Goals | Frustrations to avoid | Design implications |
|---|---|---|---|---|---|
| **Sophea, 22 — student contributor** (Siem Reap) | contributor | Android phone (mid-range, 4G, intermittent), occasionally a shared laptop at university; reads English well, prefers Khmer for content | Upload scanned Khmer lecture notes and old documents, know how much she will earn, withdraw to ABA Pay | Uploads failing at 80 % on mobile data; unclear why files were rejected; not knowing when money arrives | Resumable uploads with plain-language progress; earnings shown as Estimated/Pending/Available with explanations; rejection reasons per file; mobile-first card layouts |
| **Dara, 34 — Khmer linguist annotator** | contributor, annotator | Full-time from home, 24" monitor, Khmer NiDA keyboard + English, long sessions | Transcribe/correct pages fast, never lose work, understand reviewer feedback, track rewards | Lost text after timeouts; mouse-heavy UIs; diacritics clipped or normalised | Three-panel editor, autosave every 5 s idle, keyboard shortcuts that never fire during IME composition, verbatim text storage, version history |
| **Vannak, 29 — QA reviewer** | reviewer | SKAI staff, dual monitors | Clear review queue quickly and fairly; accept/reject per file; consistent quality scores | Opening files one by one; losing a half-finished review | Split review workspace with file list keyboard navigation, bulk decisions, checklist, auto-saved decisions, payable summary before finalize |
| **Lina, 38 — operations & finance admin** | admin (+ reviewer) | Laptop, works with bank portal and ABA business app in other tabs; MFA on phone | Verify contributors, approve payouts, record transfers correctly, answer support | Paying the wrong amount or twice; unclear audit trail | Payout detail shows method details, reserved amount, approvals; mark-paid with typed amount + reference uniqueness check; full timeline per payout |
| **Rithy, 41 — CTO / super admin** | super_admin | Desktop | Configure pricing, roles, settings; audit; export data for model training | Accidental pricing changes; untraceable exports | Pricing changes as new versioned rules with effective date and typed confirmation; audit log with diffs; export center with job history |

Secondary audience: prospective contributors browsing the public site (any device), who need to understand what data is bought, at what price, and on what terms before registering.

## 2. Information architecture

### 2.1 Top-level structure

```
DataHub
├── Public site (no shell, marketing header/footer)
│   ├── Home · How it works · Pricing · Supported data types · Help/Contact
│   └── Legal: Terms · Privacy · Contributor Agreement
├── Auth (centered card layout)
│   └── Login(+MFA) · Register · Verify email · Forgot · Reset · Onboarding (stepper)
├── App shell (sidebar + top bar) ─ workspaces
│   ├── Contribute (all users)  → /dashboard, /datasets…, /earnings
│   ├── Annotate (annotator)    → /annotate…
│   ├── Review (reviewer, admin, super_admin) → /review…
│   ├── Admin (admin, super_admin) → /admin…
│   └── Personal (every workspace) → /withdrawals, /messages, /notifications, /profile, /settings
├── Focus layout (no sidebar)
│   ├── Annotation editor  /annotate/tasks/[id]/edit
│   └── Dataset review workspace  /review/datasets/[reviewId]
└── System views: Access denied · Not found · Server error · Maintenance
```

### 2.2 Next.js App Router structure

```
apps/web/src/app/
├── (public)/            layout: MarketingHeader + MarketingFooter
│   ├── page.tsx                         /
│   ├── how-it-works/  pricing/  data-types/  help/
│   └── legal/{terms,privacy,contributor-agreement}/
├── (auth)/              layout: AuthCard (logo, theme toggle, footer links)
│   ├── login/  register/  verify-email/  forgot-password/  reset-password/
│   └── onboarding/                      (requires session; status active)
├── (app)/               layout: AppShell (session required → /auth/me)
│   ├── dashboard/  datasets/{,new,[id],[id]/upload}  earnings/
│   ├── withdrawals/{,[id]}  messages/{,[id]}  notifications/  profile/  settings/
│   ├── annotate/{,tasks,tasks/[id],submitted,feedback,earnings}   (role: annotator)
│   ├── review/{,datasets,annotations,history}                     (role: reviewer|admin|super_admin)
│   └── admin/…                                                     (role: admin|super_admin + MFA)
├── (focus)/             layout: FocusShell (compact top bar, no sidebar)
│   ├── annotate/tasks/[id]/edit/
│   ├── review/datasets/[reviewId]/
│   └── review/annotations/[taskId]/
├── access-denied/  maintenance/
├── not-found.tsx  error.tsx  global-error.tsx
```

Route groups do not appear in URLs. `(focus)` pages are siblings of `(app)` pages with the same URL prefix; the URL is what this document fixes.

### 2.3 Access gates (evaluated in this order by `middleware.ts` + layout server components)

1. **Maintenance flag** (`system_settings.maintenance_mode`; the API answers `503` with error code `maintenance`) → `/maintenance` for everyone except super_admin sessions.
2. **No session** on an app/focus route → `/login?next=<path>`.
3. `users.status = pending_email` → only `/verify-email` (with resend/logout) is reachable.
4. `users.status = suspended` → app shell renders a full-width danger `Alert` "Your account is suspended" with a link to `/messages` (messaging remains available) — all other pages render read-only; mutations are blocked by API.
5. Onboarding not completed → `/onboarding` after login; user may choose "Finish later" and use the dashboard, but `/datasets/new` and `/datasets/[id]/upload` redirect to `/onboarding?next=…` (baseline A-09).
6. Role check per workspace (§5) → `/access-denied` content rendered in place (HTTP 403 status) when the role is missing.
7. Admin workspace additionally requires `mfa_verified_at` on the session → `/login?step=mfa&next=…`; admins without MFA enabled are redirected to `/settings?tab=security&setup=mfa` and only that page is reachable until MFA is enabled.

## 3. Route map — all 64 required pages (canonical)

| # | Page | Route | Layout | Access |
|---|---|---|---|---|
| 1 | Home / Landing | `/` | Public | Anyone |
| 2 | How It Works | `/how-it-works` | Public | Anyone |
| 3 | Pricing | `/pricing` | Public | Anyone |
| 4 | Supported Data Types | `/data-types` | Public | Anyone |
| 5 | Contact / Help | `/help` | Public | Anyone |
| 6 | Terms of Service | `/legal/terms` | Public | Anyone |
| 7 | Privacy Policy | `/legal/privacy` | Public | Anyone |
| 8 | Contributor Agreement | `/legal/contributor-agreement` | Public | Anyone |
| 9 | Login (incl. MFA step) | `/login` (`?step=mfa`, `?next=`) | Auth | Guests (signed-in users redirect to their home workspace) |
| 10 | Registration | `/register` | Auth | Guests |
| 11 | Email Verification | `/verify-email` (`?token=` to confirm; no token = "check your inbox" + resend) | Auth | Anyone with link; `pending_email` sessions |
| 12 | Forgot Password | `/forgot-password` | Auth | Guests |
| 13 | Reset Password | `/reset-password?token=` | Auth | Anyone with token |
| 14 | Contributor Onboarding | `/onboarding` (`?step=profile\|agreement\|rights\|verification`) | Auth (stepper) | Signed-in, `active` |
| 15 | Contributor Dashboard | `/dashboard` | App | contributor |
| 16 | Upload Dataset | `/datasets/new` | App | contributor, onboarding complete |
| 17 | Upload Progress | `/datasets/[id]/upload` | App | dataset owner; dataset `draft` or `changes_requested` |
| 18 | My Datasets | `/datasets` | App | contributor |
| 19 | Dataset Details (contributor) | `/datasets/[id]` (`?tab=files\|feedback\|history`, `?file=<fileId>` opens preview sheet) | App | dataset owner |
| 20 | Earnings | `/earnings` (`?tab=summary\|transactions`) | App | contributor/annotator (own wallet) |
| 21 | Withdrawals | `/withdrawals` (`?request=1` opens request dialog) | App (personal) | contributor/annotator (`payout.request`) |
| 22 | Withdrawal Details | `/withdrawals/[id]` | App (personal) | owner of payout |
| 23 | Messages | `/messages`, `/messages/[id]` (conversation selected) | App (personal) | all signed-in users |
| 24 | Notifications | `/notifications` (`?filter=unread`) | App (personal) | all signed-in users |
| 25 | Profile | `/profile` (`?tab=personal\|verification\|payout-methods`) | App (personal) | all signed-in users |
| 26 | Account Settings | `/settings` (`?tab=security\|notifications\|appearance\|accessibility\|privacy`) | App (personal) | all signed-in users |
| 27 | Admin Dashboard | `/admin` | App | admin, super_admin |
| 28 | User Management | `/admin/users` | App | admin, super_admin |
| 29 | User Details | `/admin/users/[id]` (`?tab=overview\|datasets\|finance\|roles\|sessions\|activity`) | App | admin, super_admin |
| 30 | Contributor Verification | `/admin/verifications` (`?status=pending`, `?case=<verificationId>` opens sheet) | App | admin, super_admin |
| 31 | All Datasets | `/admin/datasets` | App | admin, super_admin |
| 32 | Dataset Details (admin) | `/admin/datasets/[id]` (`?tab=files\|reviews\|duplicates\|activity`) | App | admin, super_admin |
| 33 | Dataset Review Workspace | `/review/datasets/[reviewId]` (`?file=<fileId>&page=<n>`) | Focus | reviewer (assignee), admin, super_admin (assignee) |
| 34 | Review Queue (admin) | `/admin/reviews` (`?status=submitted\|in_review`) | App | admin, super_admin |
| 35 | Annotation Projects | `/admin/annotation/projects` | App | admin, super_admin |
| 36 | Create Annotation Project | `/admin/annotation/projects/new` (`?step=basics\|sources\|schema\|rewards\|review`) | App | admin, super_admin |
| 37 | Annotation Project Details | `/admin/annotation/projects/[id]` (`?tab=overview\|tasks\|settings`) | App | admin, super_admin |
| 38 | Annotation Assignments | `/admin/annotation/assignments` (`?project=<id>&status=`) | App | admin, super_admin |
| 39 | Annotation Review Queue (admin) | `/admin/annotation/reviews` | App | admin, super_admin |
| 40 | Payment Overview | `/admin/finance` (`?tab=overview\|ledger\|reconciliation\|adjustments`) | App | admin, super_admin (`finance.read`) |
| 41 | Payout Requests | `/admin/payouts` (`?status=requested`) | App | admin, super_admin |
| 42 | Payout Details | `/admin/payouts/[id]` | App | admin, super_admin |
| 43 | Pricing Management | `/admin/pricing` | App | admin (read), super_admin (edit) |
| 44 | Admin Messaging (support inbox) | `/admin/messages`, `/admin/messages/[id]` | App | admin, super_admin (`message.support`) |
| 45 | Dataset Export Center | `/admin/exports` (`?new=1` opens builder, `?job=<id>` opens detail sheet) | App | admin, super_admin |
| 46 | Analytics | `/admin/analytics` (`?from=&to=`) | App | admin, super_admin |
| 47 | Audit Logs | `/admin/audit-logs` (`?tab=audit\|security`) | App | super_admin (`audit.read`) |
| 48 | System Settings | `/admin/settings` (`?tab=general\|uploads\|finance\|annotation\|roles`) | App | super_admin |
| 49 | Annotator Dashboard | `/annotate` | App | annotator |
| 50 | My Annotation Tasks | `/annotate/tasks` | App | annotator |
| 51 | Annotation Task Details | `/annotate/tasks/[id]` | App | assigned annotator |
| 52 | Annotation Editor | `/annotate/tasks/[id]/edit` (`?page=<n>`) | Focus | active assignee |
| 53 | Submitted Tasks | `/annotate/submitted` | App | annotator |
| 54 | Annotation Feedback | `/annotate/feedback` | App | annotator |
| 55 | Annotation Earnings | `/annotate/earnings` | App | annotator |
| 56 | Reviewer Dashboard | `/review` | App | reviewer, admin, super_admin |
| 57 | Dataset Review Tasks | `/review/datasets` (`?tab=queue\|mine`) | App | reviewer, admin, super_admin |
| 58 | Annotation Review Tasks | `/review/annotations` (`?tab=queue\|mine`) | App | reviewer, admin, super_admin |
| 59 | Annotation Comparison | `/review/annotations/[taskId]` (`?compare=<versionA>..<versionB>`) | Focus | review claimant (reviewer/admin/super_admin) |
| 60 | Review History | `/review/history` (`?type=datasets\|annotations`) | App | reviewer, admin, super_admin |
| 61 | Unauthorized / Access Denied | `/access-denied` (also rendered in place with HTTP 403 by role-gated layouts) | Minimal | Anyone |
| 62 | Not Found | `app/not-found.tsx` — any unmatched URL or inaccessible resource (HTTP 404) | Minimal | Anyone |
| 63 | Server Error | `app/error.tsx` (segment) + `app/global-error.tsx` (root); static `500.html` fallback served by Caddy when web is down | Minimal | Anyone |
| 64 | Maintenance / Service Unavailable | `/maintenance` (HTTP 503 when maintenance active); static `maintenance.html` fallback served by Caddy | Minimal | Anyone |

Supporting (non-numbered) routes that are part of the pages above: `/messages/[id]` (#23), `/admin/messages/[id]` (#44). No other routes exist in v1. Signed-in "home" per primary role: admin/super_admin → `/admin`; reviewer → `/review`; annotator → `/annotate`; otherwise `/dashboard`. The last-used workspace (stored in `localStorage`) overrides this default.

## 4. Page inventory with data sources

All endpoints are relative to `/api/v1` (baseline §12). "WS" = WebSocket `/api/v1/ws` events. Query filters used below that baseline §12 does not enumerate explicitly — `role` on `/admin/users`, `user` on `/admin/payouts`, `entity_id` on `/admin/audit-logs`, comma-separated multi-value `status` on list endpoints — are UI requirements to be specified in the API documentation (#19/#20). The maintenance gate (§2.3) requires a `maintenance_mode` key in `system_settings`.

| # | Page | Primary content | API endpoints |
|---|---|---|---|
| 1 | Home | Value proposition, live rates, how payment works, supported formats summary, CTA register | `GET /public/pricing`, `GET /public/formats` |
| 2 | How It Works | 5-step process (register → onboard → upload → review → get paid), annotation work explanation, FAQs | — (static) |
| 3 | Pricing | Raw/labeled rates per GB, worked examples, eligibility rules, payout limits & methods | `GET /public/pricing` |
| 4 | Supported Data Types | Table of formats: allowed/preview/annotatable/payable, size limits, ZIP rules | `GET /public/formats` |
| 5 | Contact / Help | FAQ accordion, contact form (name, email, topic, message) | `POST /public/contact` |
| 6–8 | Legal pages | Versioned markdown documents with table of contents, effective date, version | — (static, versioned in repo) |
| 9 | Login | Email/password, MFA code step, "remember device" not offered | `GET /auth/csrf`, `POST /auth/login`, `POST /auth/mfa/verify`, `GET /auth/me` |
| 10 | Registration | Display name, email, password + strength, accept Terms & Privacy | `GET /auth/csrf`, `POST /auth/register` |
| 11 | Email Verification | Token confirmation result or inbox prompt + resend (60 s cooldown) | `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/logout` |
| 12 | Forgot Password | Email field; always-same confirmation message | `POST /auth/forgot-password` |
| 13 | Reset Password | New password + confirm | `POST /auth/reset-password` |
| 14 | Onboarding | Stepper: profile → agreement → rights declaration → verification (optional now) | `GET /auth/me`, `GET\|PATCH /me/profile`, `POST /me/onboarding`, `GET\|POST /me/verification`, `GET\|POST /me/payout-methods` |
| 15 | Contributor Dashboard | Wallet KPIs, verification/onboarding banners, recent datasets, active uploads, notifications, annotation shortcut | `GET /wallet`, `GET /datasets?page_size=5&sort=-updated_at`, `GET /notifications?page_size=5`, `GET /me/verification`, `GET /auth/me` |
| 16 | Upload Dataset | Metadata form (title, description, language, category, data_class, licence, source/rights) + file selection | `POST /datasets`, `POST /datasets/{id}/uploads`, `POST /uploads/{id}/part-urls`, `POST /uploads/{id}/complete`, `GET /public/formats` |
| 17 | Upload Progress | Per-file & overall progress, speed, pause/resume/cancel/retry, processing status, submit | `GET /datasets/{id}`, `GET /datasets/{id}/files`, `POST /datasets/{id}/uploads`, `POST /uploads/{id}/part-urls`, `GET /uploads/{id}`, `POST /uploads/{id}/complete`, `DELETE /uploads/{id}`, `DELETE /datasets/{id}/files/{file_id}`, `GET /datasets/{id}/estimate`, `POST /datasets/{id}/submit`, WS `notification.created` |
| 18 | My Datasets | Table/cards of own datasets with status, size, files, estimate/earned | `GET /datasets?status=&q=&sort=&page=` |
| 19 | Dataset Details | Header + status timeline, files table with processing/scan/review status, feedback, estimate/earned, edit metadata (draft/changes_requested), withdraw | `GET\|PATCH\|DELETE /datasets/{id}`, `GET /datasets/{id}/files`, `GET /datasets/{id}/reviews`, `GET /datasets/{id}/estimate`, `POST /datasets/{id}/withdraw`, `POST /datasets/{id}/submit`, `GET /files/{id}`, `GET /files/{id}/preview/{page}`, `GET /files/{id}/text`, `POST /files/{id}/download-url` |
| 20 | Earnings | Estimated/Pending/Available/Reserved/Paid/Adjustments/Approved KPIs, earnings by dataset & annotation, transactions ledger | `GET /wallet`, `GET /earnings`, `GET /wallet/transactions` |
| 21 | Withdrawals | Eligibility checklist, available balance, request dialog, history table | `GET /wallet`, `GET /payouts`, `POST /payouts` (+ `Idempotency-Key`), `GET /me/payout-methods`, `GET /me/verification` |
| 22 | Withdrawal Details | Status timeline, amount, method (masked), reference & paid date when paid, cancel (requested only) | `GET /payouts/{id}`, `POST /payouts/{id}/cancel` |
| 23 | Messages | Conversation list (search, status), thread, composer with attachments, "New conversation" (optionally linked to a dataset) | `GET\|POST /conversations`, `GET\|PATCH /conversations/{id}`, `GET\|POST /conversations/{id}/messages`, `POST /conversations/{id}/read`, `POST /conversations/{id}/attachments`, `GET /attachments/{id}/download-url`, WS `message.created`, `conversation.updated` |
| 24 | Notifications | Grouped list, unread filter, mark read/all read | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, WS `notification.created` |
| 25 | Profile | Personal details, verification status & submission, payout methods | `GET\|PATCH /me/profile`, `GET\|POST /me/verification`, `GET\|POST /me/payout-methods`, `DELETE /me/payout-methods/{id}` |
| 26 | Account Settings | Password, MFA, sessions, notification preferences, theme, accessibility (shortcut toggles, density), privacy (deletion request) | `POST /auth/change-password`, `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `POST /auth/sessions/revoke-others`, `POST /auth/mfa/setup`, `POST /auth/mfa/enable`, `POST /auth/mfa/disable`, `GET\|PATCH /me/notification-preferences`, `POST /me/deletion-request` |
| 27 | Admin Dashboard | Ops KPIs, work queues (verifications, reviews, payouts, support), charts, recent activity | `GET /admin/analytics/overview?from&to`, `GET /admin/finance/overview`, `GET /reviews/queue?page_size=5`, `GET /admin/verifications?status=pending&page_size=5`, `GET /admin/payouts?status=requested&page_size=5`, `GET /conversations?status=open&page_size=5` |
| 28 | User Management | Users table: name/email, roles, status, verification, joined, last active; filters | `GET /admin/users` |
| 29 | User Details | Profile, roles, status actions, verification history, datasets, wallet & payouts, sessions, activity | `GET /admin/users/{id}`, `POST /admin/users/{id}/suspend`, `POST /admin/users/{id}/reactivate`, `PUT /admin/users/{id}/roles`, `POST /admin/users/{id}/revoke-sessions`, `GET /admin/datasets?owner={id}`, `GET /admin/payouts?user={id}`, `POST /admin/adjustments` (super_admin), `GET /admin/audit-logs?entity_id={id}` (super_admin) |
| 30 | Contributor Verification | Queue table + case sheet: submitted details, ID document preview, history, decision | `GET /admin/verifications`, `POST /admin/verifications/{id}/decision`, `GET /admin/users/{id}` |
| 31 | All Datasets | Search & filter (q, status, data_class, language, category, min_quality, owner, date range) | `GET /admin/datasets` |
| 32 | Dataset Details (admin) | Full metadata, files with processing/scan, duplicates, reviews, earnings, takedown, rescan, message owner | `GET /admin/datasets/{id}`, `GET /datasets/{id}/files`, `GET /datasets/{id}/reviews`, `GET /files/{id}`, `POST /files/{id}/download-url`, `POST /admin/datasets/{id}/takedown`, `POST /admin/files/{id}/rescan`, `POST /datasets/{id}/claim-review`, `POST /conversations` |
| 33 | Dataset Review Workspace | File list with decisions, preview, metadata, duplicates, checklist, quality scores, accepted/rejected size, payable summary, finalize | `GET /reviews/{id}`, `PUT /reviews/{id}/files/{file_id}`, `POST /reviews/{id}/files/bulk`, `PATCH /reviews/{id}`, `GET /reviews/{id}/summary`, `POST /reviews/{id}/finalize` (+ `Idempotency-Key`), `POST /reviews/{id}/release`, `GET /files/{id}`, `GET /files/{id}/preview/{page}`, `GET /files/{id}/text`, `POST /files/{id}/download-url`, `GET /datasets/{id}/reviews` |
| 34 | Review Queue (admin) | All submitted / in-review datasets with age, size, claimant; claim | `GET /reviews/queue`, `POST /datasets/{id}/claim-review` |
| 35 | Annotation Projects | Projects table with progress bars, deadline, rewards, state | `GET /annotation/projects` |
| 36 | Create Annotation Project | Wizard: basics & instructions → source datasets → annotation types/labels/metadata schema → task unit & rewards & deadline → review & create, generate tasks | `POST /annotation/projects`, `GET /admin/datasets?status=approved,partially_approved`, `POST /annotation/projects/{id}/generate-tasks` |
| 37 | Annotation Project Details | Progress by status, tasks table, settings edit, close project | `GET\|PATCH /annotation/projects/{id}`, `GET /annotation/projects/{id}/tasks`, `POST /annotation/projects/{id}/generate-tasks`, `POST /annotation/projects/{id}/close` |
| 38 | Annotation Assignments | Task table across a selected project, bulk assign/unassign/reassign, annotator workload | `GET /annotation/projects`, `GET /annotation/projects/{id}/tasks`, `POST /annotation/tasks/{id}/assign`, `POST /annotation/tasks/bulk-assign`, `POST /annotation/tasks/{id}/unassign`, `GET /admin/users?role=annotator` |
| 39 | Annotation Review Queue (admin) | Submitted tasks awaiting review across projects; claim | `GET /annotation/review-queue`, `POST /annotation/tasks/{id}/claim-review` |
| 40 | Payment Overview | Liabilities (available + reserved), paid this period, pending payouts, ledger explorer, reconciliation status, adjustments | `GET /admin/finance/overview`, `GET /admin/ledger`, `GET /admin/finance/reconciliation`, `POST /admin/adjustments` (super_admin) |
| 41 | Payout Requests | Table by status, amount, method, approvals, age; filters | `GET /admin/payouts` |
| 42 | Payout Details | Recipient, verification, method details, wallet context, approvals, actions (approve, reject, mark paid, mark failed, cancel, reverse), proof upload, timeline | `GET /admin/payouts/{id}`, `POST /admin/payouts/{id}/approve\|reject\|mark-paid\|mark-failed\|cancel\|reverse`, `POST /admin/payouts/{id}/proof`, `GET /admin/users/{id}` |
| 43 | Pricing Management | Current rules, history timeline, new rule (super_admin) | `GET /pricing-rules`, `POST /admin/pricing-rules` |
| 44 | Admin Messaging | Support inbox: filters (status, assigned, linked dataset), thread with user context panel | `GET /conversations` (support inbox scope implied by `message.support`; filters `status`, `q`), `GET\|PATCH /conversations/{id}`, `GET\|POST /conversations/{id}/messages`, `POST /conversations/{id}/read`, `POST /conversations/{id}/attachments`, `GET /attachments/{id}/download-url`, WS events |
| 45 | Dataset Export Center | Export builder (datasets, filters, raw/labeled, metadata, annotations, format), job list with progress, download | `POST /admin/exports`, `GET /admin/exports`, `GET /admin/exports/{id}`, `POST /admin/exports/{id}/download-url`, `GET /admin/datasets` |
| 46 | Analytics | Uploads, accepted bytes, acceptance rate, earnings vs payouts, annotation throughput, reviewer throughput, languages/categories | `GET /admin/analytics/overview?from&to` |
| 47 | Audit Logs | Audit table with diff viewer; security events tab | `GET /admin/audit-logs`, `GET /admin/security-events` |
| 48 | System Settings | Grouped settings with typed editors, roles & permissions (read-only matrix) | `GET /admin/settings`, `PUT /admin/settings/{key}`, `GET /admin/roles` |
| 49 | Annotator Dashboard | Assigned/in-progress/returned counts, continue-working card, rewards KPIs, deadlines | `GET /annotation/my-tasks`, `GET /annotation/my-rewards`, `GET /notifications?page_size=5` |
| 50 | My Annotation Tasks | Tasks table (status, project, unit, reward, deadline) | `GET /annotation/my-tasks` |
| 51 | Annotation Task Details | Instructions, source file info, reward, deadline, status history, reviewer feedback, start/continue | `GET /annotation/tasks/{id}`, `POST /annotation/tasks/{id}/start`, `GET /annotation/tasks/{id}/versions` |
| 52 | Annotation Editor | Three-panel editor (§9) | `GET /annotation/tasks/{id}`, `POST /annotation/tasks/{id}/start`, `PUT /annotation/tasks/{id}/draft` (`If-Match`), `POST /annotation/tasks/{id}/submit`, `GET /annotation/tasks/{id}/versions`, `GET /files/{id}`, `GET /files/{id}/preview/{page}`, `GET /files/{id}/text`, `GET /annotation/my-tasks` |
| 53 | Submitted Tasks | Tasks in `submitted`/`in_review`/`approved` with outcome & reward | `GET /annotation/my-tasks?status=submitted,in_review,approved` |
| 54 | Annotation Feedback | Reviewer comments & scores per task, changes requested first | `GET /annotation/my-tasks?status=changes_requested,approved`, `GET /annotation/tasks/{id}` |
| 55 | Annotation Earnings | Reward KPIs, rewards per task/project, link to withdrawals | `GET /annotation/my-rewards`, `GET /wallet` |
| 56 | Reviewer Dashboard | My claimed reviews, queue sizes, SLA ages, throughput this week | `GET /reviews/queue`, `GET /annotation/review-queue`, `GET /reviews/history?page_size=5`, `GET /annotation/reviews/history?page_size=5` |
| 57 | Dataset Review Tasks | Queue (unclaimed submitted) + My reviews (in progress); claim, continue | `GET /reviews/queue`, `POST /datasets/{id}/claim-review` |
| 58 | Annotation Review Tasks | Queue + mine; claim, continue | `GET /annotation/review-queue`, `POST /annotation/tasks/{id}/claim-review` |
| 59 | Annotation Comparison | Source page, submitted annotation, diff vs previous version, labels/metadata, comments, score, decision | `GET /annotation/tasks/{id}`, `GET /annotation/tasks/{id}/versions`, `GET /files/{id}/preview/{page}`, `GET /files/{id}/text`, `POST /annotation/tasks/{id}/review` |
| 60 | Review History | Finalized dataset reviews and annotation reviews by me (admins: filter by reviewer) | `GET /reviews/history`, `GET /annotation/reviews/history` |
| 61 | Access Denied | Explanation, current roles, links: go to my workspace, contact support | `GET /auth/me` |
| 62 | Not Found | Message, search, go home | — |
| 63 | Server Error | Message, request ID (from error payload or `X-Request-ID`), retry, status page link | — |
| 64 | Maintenance | Message, expected end time (if provided), status link | `GET /readyz` (poll every 30 s, auto-return when ready) |

## 5. Navigation patterns

### 5.1 App shell

```
┌────────────┬──────────────────────────────────────────────────────────┐
│ Workspace ▾│ Breadcrumbs              [Search… Ctrl K] 🔔 💬 ◐  (Avatar)│  ← TopBar 56px
│────────────│──────────────────────────────────────────────────────────│
│ GROUP      │                                                          │
│  Item      │   PageHeader (title · description · actions · tabs)      │
│  Item  12  │                                                          │
│ GROUP      │   Content                                                │
│  Item      │                                                          │
│            │                                                          │
│ ─────────  │                                                          │
│ Help       │                                                          │
│ « Collapse │                                                          │
└────────────┴──────────────────────────────────────────────────────────┘
```

- **Workspace switcher** (top of sidebar) appears only when the user has ≥ 2 workspaces. Lists Contribute / Annotate / Review / Admin with icons and one-line descriptions; current workspace checked. Switching navigates to the workspace home and stores the choice.
- **Personal pages** (`/withdrawals`, `/messages`, `/notifications`, `/profile`, `/settings`) keep the sidebar of the workspace the user came from (stored in session storage); reached via sidebar "Personal" group (Contribute/Annotate) or the user menu and top-bar icons (all workspaces).
- **User menu**: name, email, role chips; Profile; Account settings; Theme (Light/Dark/System); Keyboard shortcuts; Help; Sign out.
- **Command menu** (`Ctrl/⌘ K`): navigate to any permitted page by name; admins can also jump to a record by full UUID or user email (resolved through the relevant admin list endpoint with `q=`).
- **Counts** in sidebar: unread messages, returned annotation tasks, pending verifications, unclaimed reviews, payouts awaiting action — refreshed every 60 s and on WS events.

### 5.2 Sidebar groups per workspace

**Contribute** (everyone)
| Group | Items |
|---|---|
| Overview | Dashboard `/dashboard` |
| Data | My datasets `/datasets` · Upload dataset `/datasets/new` |
| Money | Earnings `/earnings` · Withdrawals `/withdrawals` |
| Personal | Messages `/messages` · Notifications `/notifications` · Profile `/profile` · Settings `/settings` |

**Annotate** (annotator)
| Group | Items |
|---|---|
| Overview | Dashboard `/annotate` |
| Work | My tasks `/annotate/tasks` (badge: returned count) · Submitted `/annotate/submitted` · Feedback `/annotate/feedback` |
| Money | Annotation earnings `/annotate/earnings` · Withdrawals `/withdrawals` |
| Personal | Messages · Notifications · Profile · Settings |

**Review** (reviewer, admin, super_admin)
| Group | Items |
|---|---|
| Overview | Dashboard `/review` |
| Queues | Dataset reviews `/review/datasets` · Annotation reviews `/review/annotations` |
| Records | Review history `/review/history` |

**Admin** (admin, super_admin)
| Group | Items |
|---|---|
| Overview | Dashboard `/admin` · Analytics `/admin/analytics` |
| People | Users `/admin/users` · Verifications `/admin/verifications` |
| Data | All datasets `/admin/datasets` · Review queue `/admin/reviews` · Exports `/admin/exports` |
| Annotation | Projects `/admin/annotation/projects` · Assignments `/admin/annotation/assignments` · Review queue `/admin/annotation/reviews` |
| Finance | Overview `/admin/finance` · Payouts `/admin/payouts` · Pricing `/admin/pricing` |
| Support | Inbox `/admin/messages` |
| System (super_admin only) | Audit logs `/admin/audit-logs` · Settings `/admin/settings` |

### 5.3 Public navigation

Header: logo · How it works · Pricing · Data types · Help · [Log in] [Get started] (signed-in: [Open DataHub] → home workspace). Mobile: hamburger sheet. Footer: product links, legal links, operator line, theme toggle.

### 5.4 Focus layout (editor, review workspace, annotation comparison)

Compact 48 px top bar: back link (to the originating queue), entity title + short ref + status badge, save/progress indicator, shortcuts button (`?`), primary actions (Submit / Finalize / Decide). No sidebar; panels are resizable and collapsible; panel sizes persisted per user in `localStorage`.

### 5.5 Within-page navigation

Tabs (underline) for sibling views of the same entity; tab key in URL. Detail pages have "Back to <list>" in breadcrumbs, preserving the list's query string. Prev/next record arrows on detail pages opened from a list (admin payouts, verifications, datasets) using the list's current filter.

## 6. Dashboard layouts per role

### 6.1 Contributor (`/dashboard`)
1. **Gate banners** (only when relevant, in priority order): finish onboarding (warning) · verification needed to withdraw (info, CTA "Verify identity") · verification needs info/rejected (warning/danger) · changes requested on N datasets (warning).
2. **Wallet strip** (StatCardGroup): Available (money) · Pending · Reserved · Paid (lifetime) — plus "Estimated from datasets in review ≈ $X" line under the strip. CTA "Withdraw" (disabled with reason if not eligible).
3. **Two columns (8/4):** left — "Recent datasets" table (5 rows: title, status, size, estimate/earned, updated) + "Continue uploading" card when a draft has incomplete uploads; right — "Notifications" (5) and "Annotation work" card (only for annotators: N assigned, link to `/annotate`).
4. **Empty first-run state:** 3-step checklist (Complete onboarding ✓/✗, Upload your first dataset, Get verified for withdrawals) with primary "Upload dataset".

### 6.2 Annotator (`/annotate`)
"Continue where you left off" hero card (last in-progress task, page N of M, last saved) → KPI row (Assigned · In progress · Changes requested · Approved this month · Rewards available) → "Due soon" table (deadline ascending) → "Recent feedback" list.

### 6.3 Reviewer (`/review`)
KPI row (Datasets awaiting review · My dataset reviews in progress · Annotations awaiting review · My annotation reviews in progress · Reviewed this week) → "My in-progress reviews" table with continue buttons → two queue previews (oldest first, with age chips: amber > 3 days, red > 7 days).

### 6.4 Admin (`/admin`)
1. **Action queues row** (four compact cards with counts and "Open" links): Verifications pending · Datasets awaiting review · Payouts awaiting action (requested + approved-unpaid) · Open support conversations.
2. **KPI strip** (period selector 7d/30d/90d): Data received (bytes) · Accepted (bytes, acceptance %) · Earnings credited ($) · Payouts paid ($) · Liability (available + reserved $).
3. **Charts (2-up):** Uploaded vs accepted bytes per day (area); Earnings credited vs payouts paid per week (bar).
4. **Bottom row:** Reconciliation status card (last nightly run, OK/mismatch) · Background job failures (from analytics overview) · Recent audit events (super_admin only).

## 7. Interaction principles

1. **Show state, not just actions.** Every entity shows its status badge and a timeline of transitions with actor and time.
2. **Explain money.** Every amount links to its derivation: dataset earnings show accepted GB × rate = amount (with rate version); wallet figures show tooltip definitions (baseline §8.6 wording).
3. **Progressive disclosure.** Lists show essentials; detail sheets/pages show the rest; advanced filters collapse behind "More filters".
4. **Optimistic only when safe.** Non-financial toggles (mark notification read, file decision in review workspace) update optimistically with rollback on error. Financial actions and state transitions wait for the server and then refetch.
5. **Idempotent by design.** Financial POSTs generate an `Idempotency-Key` (UUID) when the dialog opens and reuse it on retry; buttons disable while in flight; double-clicks never create duplicates.
6. **Never lose work.** Forms with > 3 fields warn on navigation with unsaved changes; the editor autosaves; review decisions persist per file immediately; uploads resume.
7. **Server is the authority.** UI hides actions the user cannot perform but always handles 403/409/422 gracefully with the server's message.
8. **Real-time where it matters.** WS events update messages, notifications, unread counts and processing status; everything else refreshes on focus (TanStack Query `refetchOnWindowFocus`) and after mutations.
9. **Consistent placement.** Primary action top-right of PageHeader (desktop) or sticky bottom bar (mobile); destructive actions grouped in a "More" menu or at the bottom of settings sections ("Danger zone").
10. **Plain language.** Error messages say what happened and what to do ("This file is a ZIP inside a ZIP. Extract it and upload the inner files."); reason codes are mapped to human text.

## 8. Upload experience (pages #16–#17)

- **Two-step creation:** #16 collects metadata and files in one screen; "Create dataset & start upload" calls `POST /datasets` then navigates to #17 where transfers run. Files selected in #16 are passed through the client upload store (React context mounted in the `(app)` layout), so client navigation keeps the `File` handles.
- **Selection:** drag-and-drop, "Choose files", "Choose folder" (`webkitdirectory`, relative paths preserved in metadata), ZIP allowed. Client pre-checks: extension in allowed list, size ≤ 4,000,000,000 bytes, dataset total ≤ 50 GB, ≤ 2,000 files; violations listed before upload starts (server re-validates).
- **Transfer:** per file `POST /datasets/{id}/uploads` → presigned part URLs in batches of 20 → 3 files and 4 parts per file in parallel → `POST /uploads/{id}/complete`. Progress per file and overall; speed = rolling 5 s average; ETA shown after 10 s.
- **Controls:** pause/resume per file and all; cancel file (`DELETE /uploads/{id}`, L2 confirm when > 50 % done); retry failed (resumes from missing parts).
- **Resume after disconnect:** progress is persisted in `localStorage` (`dh-upload-sessions`: upload_id, dataset_id, name, size, lastModified, relative path, part_size). Offline (`navigator.onLine=false` or network errors) auto-pauses all with banner "You're offline — uploads will resume automatically"; on `online` resumes. After a reload/browser restart, #17 lists interrupted files with "Re-select files to resume"; re-selected files are matched by name + size + lastModified, `GET /uploads/{id}` returns uploaded parts, and only missing parts are sent. Sessions older than 24 h show "Upload expired — start this file again" (baseline A-15).
- **Leaving:** `beforeunload` warning while transfers run; in-app navigation keeps uploads going and shows the global `UploadTray` (bottom-right, collapsible) on every page.
- **After upload:** processing status per file updates (poll `GET /datasets/{id}/files` every 5 s while any file is `uploaded`/`processing`, stop when terminal; WS notification "processing finished" triggers a refetch). Failed/quarantined files show reason and "Remove file". The estimate card updates. **Submit for review** is enabled when all files are terminal and ≥ 1 is `ready`; L2 confirm summarises file count, accepted-eligible size and estimate.

## 9. Annotation editor (page #52) and review workspace (page #33) layout rules

### 9.1 Editor panels

| Panel | Default width (≥ 1440) | Min | Content |
|---|---|---|---|
| Left — Navigator | 280 px | 240 px (collapsible to 48 px rail) | Task switcher (my assigned tasks in this project), page list with per-page completion ticks, progress (pages done / total), Instructions (markdown, collapsible) |
| Center — Document | fluid | 480 px | Page image viewer: zoom (fit width, fit page, 25–400 %), pan (drag, Space+drag, arrow keys when focused), rotate 90°, page navigation, extracted-text view for text-only formats (DOCX/ODT/RTF/TXT). Text-region selection is not rendered in v1: `regions` stays `[]` and `bbox` is reserved (baseline §11); the viewer exposes a region-layer slot so it can be added without layout change |
| Right — Annotation | 420 px | 360 px | Tabs/sections by project `annotation_types`: Transcription (per page) · Correction (original extracted text read-only + corrected text) · Page label (select) · Classification (label chips) · Metadata (schema-driven form) · Notes · Reviewer comments (read-only, latest first) · Version history |

Bottom status bar (28 px): save state, last saved time, version number, character count for current field, "Show invisible characters" toggle, Khmer/English input hint.

### 9.2 Editor behaviour

- **Start:** opening an `assigned` task calls `POST /annotation/tasks/{id}/start` (→ `in_progress`).
- **Autosave:** after 5 s of idle typing and on blur/page change → `PUT /annotation/tasks/{id}/draft` with `If-Match: <version>`. A local draft copy is written to IndexedDB on every change (key task id + version) for **draft recovery** after crash/offline; on open, if the local copy is newer than the server copy, a dialog offers "Restore unsaved local changes" / "Discard".
- **Conflict (409):** non-dismissable banner "This task was changed elsewhere"; side-by-side diff of server copy vs your copy per field with "Keep mine (overwrite)", "Use server copy", or copy-paste; resolving re-saves with the new version.
- **Undo/redo:** native per text field; editor-level undo stack for labels/metadata/page labels (50 steps).
- **Validation:** required metadata fields, every page in task unit has transcription (when type enabled), label chosen when classification required. Issues listed in a "Checks" popover; Submit opens a summary dialog (pages complete, warnings) and blocks on errors.
- **Submit:** `POST /annotation/tasks/{id}/submit` → read-only mode with "Submitted for review" banner. `changes_requested` tasks reopen editable with reviewer comments pinned at top of the right panel and per-page comment markers in the navigator.
- **Version history:** list (time, saved by, kind draft/submitted); select to view read-only; "Restore this version" copies content into the current draft (new save).
- **Khmer:** transcription fields 16 px, line-height 1.9, `lang` from dataset language, `spellcheck=false`; no normalisation; IME-safe shortcuts.

### 9.3 Editor keyboard shortcuts

Shortcuts are listed in a dialog (`?` or `Ctrl /`). Single-key shortcuts act only when focus is in the document viewer or navigator (never in text fields) and can be turned off in Settings → Accessibility (WCAG 2.1.4). All shortcuts ignore events with `isComposing`.

| Action | Shortcut |
|---|---|
| Save now | `Ctrl/⌘ S` |
| Submit (opens summary) | `Ctrl/⌘ Enter` |
| Next / previous page | `Alt PageDown` / `Alt PageUp` (anywhere); `]` / `[` (viewer/navigator) |
| Next / previous task | `Alt Shift →` / `Alt Shift ←` |
| Focus navigator / document / annotation panel | `F6` cycles; `Alt 1` / `Alt 2` / `Alt 3` |
| Zoom in / out / fit width / fit page | `+` / `-` / `0` / `Shift 0` (viewer) |
| Rotate clockwise | `R` (viewer) |
| Pan | Arrow keys (viewer) / Space + drag |
| Undo / redo (labels & metadata) | `Ctrl/⌘ Z` / `Ctrl/⌘ Shift Z` |
| Toggle classification label n | `Alt 1…9` while label group focused |
| Toggle invisible characters | `Ctrl/⌘ Shift I` |
| Toggle instructions | `Ctrl/⌘ Shift H` |
| Version history | `Ctrl/⌘ Shift V` |
| Close dialog / exit fullscreen viewer | `Esc` |

### 9.4 Dataset review workspace (#33)

Three panels: **Files** (left, 320 px: filterable list — undecided/accepted/rejected/flagged duplicates/failed; each row: type icon, name, size, decision badge; bulk-select) · **Preview** (center: same viewer as editor; text/CSV/JSON/XLSX tabular preview; download button with L2 "Download original" note) · **Decision** (right, 380 px: file metadata, processing & scan status, duplicate warnings with links to matched file/dataset, decision Accept/Reject + reason code + comment, labeled-upgrade checkbox when applicable; below: dataset tabs Checklist · Quality scores · Dataset metadata · Comments · History). A sticky **Summary bar** at the bottom: files decided N/M · accepted size (GB, 3 dp) · rejected size · data class · payable amount (floor) · [Release] [Finalize…].

Shortcuts (file list focused, toggleable): `J`/`K` next/previous file, `A` accept, `X` reject (focuses reason), `U` clear decision, `D` show duplicates, `Shift A` accept all selected, `Ctrl/⌘ Enter` open finalize dialog.

Finalize dialog: decision radio (Approve / Partially approve / Reject / Request changes — options constrained by decisions: all accepted → Approve; mix → Partial; none accepted → Reject or Request changes), contributor feedback (required for partial/reject/request changes), data class confirm, summary table, and **type-to-confirm the payable amount** when > $0.00.

## 10. Responsive strategy

| Breakpoint | Shell | Tables | Forms | Workspaces |
|---|---|---|---|---|
| < 640 (phone) | Sidebar in left sheet (hamburger in top bar); top bar shows title + bell + avatar | `ResponsiveCardList` (priority fields) with sticky filter button opening a bottom sheet | Single column, sticky bottom action bar | Editor/review: **read-only notice** |
| 640–767 | Same as phone; 2-col KPI grid | Cards | Single column | Read-only notice |
| 768–1023 (tablet portrait) | Sheet sidebar | Table with priority-1/2 columns; others in row expansion | Single column (max 640) | Read-only notice |
| 1024–1279 (tablet landscape / small laptop) | Icon rail (56 px), expands as overlay on hover/focus, pin option | Full table, horizontal scroll for overflow with sticky first column | 2-col where natural (name pairs) | Review workspace: 2 panels (file list as drawer); editor: 2 panels (navigator as drawer) |
| ≥ 1280 | Full sidebar 248 px (collapsible) | Full | As above | Full three panels |

**Read-only notice** (< 1024 for #52 and #33, < 768 for #59): banner "The annotation editor is designed for screens at least 1024 px wide. You can read the task, instructions and feedback here; open it on a computer to edit." Below the banner the page shows task details, instructions, reviewer comments and a page-image carousel (view only). Annotators can still reach #51 fully on mobile.

Other rules: touch targets 44 px under `pointer: coarse`; horizontal scrolling never required for text content at 320 px CSS width (WCAG 1.4.10) except 2-D data tables (scroll region labelled and keyboard focusable) and document viewers; images and previews lazy-load; mobile upload uses the same resumable engine (folder selection hidden where unsupported).

## 11. State patterns

### 11.1 Loading
- Route transitions: `loading.tsx` per segment renders page-shaped skeletons (PageHeader skeleton + 5 table-row skeletons or KPI skeletons). No full-page spinners.
- In-place refetch: thin 2 px progress bar under the top bar; existing data stays visible (stale-while-revalidate).
- Buttons: inline spinner, label kept, disabled.
- Long jobs (processing, exports): status badge + progress where measurable (`running` exports show percentage when the API provides `progress`), otherwise indeterminate bar and "This can take a few minutes; you can leave this page."
- Skeletons respect reduced motion (static `muted` blocks).

### 11.2 Empty
Component `EmptyState`: 48 px muted icon circle, title (what this is), one sentence (why it's empty / what happens next), primary action if the user can create something. Distinguish:
- **First-use empty** — e.g., My datasets: "No datasets yet. Upload documents you own the rights to — we pay $1.00 per accepted GB of raw data." [Upload dataset].
- **Filtered empty** — "No datasets match these filters." [Clear filters].
- **Caught-up empty** (queues) — "Queue is clear. New submissions will appear here." (success tone icon).
- **Not yet available** — e.g., Withdrawals when unverified: checklist of requirements with links.

### 11.3 Error
- **Field errors**: inline under field, summary for long forms, focus first invalid.
- **Action errors**: toast (8 s) + inline `Alert` near the action when it blocks progress; messages mapped from `error.code`; include `request_id` in a "Details" disclosure with copy button.
- **Section errors**: a failing card/table shows `ErrorState` inside its container ("Couldn't load payouts." [Retry]) without breaking the rest of the page.
- **Page errors**: `error.tsx` (#63) with retry and request ID; 404 → #62; 403 → #61.
- **Specific codes**: 401 → redirect to login with `next`; 409 (conflict/state changed) → refetch and show "This item changed since you opened it" with the new state; 422 → field mapping; 429 → "Too many attempts. Try again in N s" with countdown from `Retry-After`; 503 → maintenance page if `maintenance` code, else retry banner.
- **Offline**: global top banner "You're offline. Changes will be saved when you reconnect." (editor/upload handle their own queues).

### 11.4 Success
- Toast for completed mutations ("Withdrawal requested · $25.00 reserved"), with a link to the result where useful.
- State transitions also update the page's status badge and timeline immediately after refetch.
- Milestones use an inline success panel instead of a toast: dataset submitted (next steps + expected review time), email verified, onboarding complete, payout marked paid (summary with reference).

## 12. Confirmation dialogs (destructive and financial)

| Action | Page | Level (DESIGN_SYSTEM §8.7) | Dialog content |
|---|---|---|---|
| Submit dataset for review | #17, #19 | L2 | File count, eligible size, estimate, "You can't add files after submitting unless changes are requested." |
| Withdraw dataset | #19 | L2 | "Withdrawn datasets aren't reviewed or paid. Files are deleted after 30 days." |
| Remove file from draft | #17, #19 | L2 | File name, size |
| Request withdrawal | #21 | L2 + summary | Amount, method (masked), "This amount will be reserved until the request is paid, rejected or cancelled." |
| Cancel withdrawal request | #22 | L2 | Amount returns to Available |
| Approve payout | #42 | L2 (shows whether this is 1st or 2nd approval) | Recipient, amount, method, "You are not the recipient" check implicitly enforced (button hidden for own payout) |
| Reject payout | #42 | L3 | Reason sent to user; amount released to available |
| **Mark payout as paid** | #42 | **L4: type exact amount** (`125.00`) | Recipient, method details, amount, payment reference (unique per method, required), paid-at date-time (required, ≤ now), proof file (optional), "Confirm you completed this transfer outside DataHub." |
| Mark payout failed | #42 | L3 | Reason; reserved amount returns to available |
| Cancel approved payout | #42 | L3 | Reason |
| Reverse paid payout (super_admin) | #42 | L4: type amount | Reason; paid → available |
| Create adjustment (super_admin) | #40, #29 | L4: type amount | Credit/debit, user, reason, resulting available balance preview |
| Publish pricing rule (super_admin) | #43 | L4: type rate | Data class, new rate, effective from, "Applies to reviews finalized after this time." |
| Finalize dataset review | #33 | L4 when payable > $0 (type payable amount), else L3 | Decision, accepted/rejected sizes, payable, feedback |
| Release review claim | #33, #57 | L2 | "The dataset returns to the queue. Your file decisions stay in this review's history; the next reviewer starts a new review." |
| Take down dataset | #32 | L4: type dataset short ref | Reason (required); effect on exports/annotation |
| Suspend user | #29 | L3 | Reason; sessions revoked |
| Revoke all sessions | #29, #26 | L2 | — |
| Change roles granting admin/super_admin | #29 | L4: type user email | Roles before/after |
| Verification decision reject / needs info | #30 | L3 | Message to user |
| Unassign / reassign task | #37, #38 | L2 | Annotator draft is kept as a version; new assignee continues from it |
| Close annotation project | #37 | L3 | Non-approved tasks become cancelled; count shown |
| Disable MFA | #26 | L4: type `DISABLE` + current TOTP | Admins cannot disable while holding admin role |
| Request account deletion | #26 | L4: type `DELETE` | Retention notes (financial records kept 7 years) |
| Close conversation | #23, #44 | L2 | "The user can reopen it by replying." |

## 13. Accessibility (WCAG 2.2 AA)

- **Semantics:** landmarks (`header`, `nav` with `aria-label` per sidebar, `main`, `aside`), one `h1` per page, logical heading order, tables with `<th scope>` and captions (visually hidden where redundant), status badges as text.
- **Keyboard:** all interactive elements reachable in DOM order; skip link "Skip to main content" first in tab order; Radix primitives provide menu/dialog/tab keyboard patterns; focus trapped in dialogs/sheets and restored to trigger on close; resizable panel handles operable with arrow keys; drag-and-drop always has a button alternative (upload, label ordering).
- **Focus:** 2 px `ring` outline with offset on `:focus-visible`; sticky headers/footers add `scroll-padding-top/bottom` so focused elements are not obscured (2.4.11); after route change focus moves to the `h1` (`tabIndex=-1`) and the title is announced.
- **Live regions:** toasts `role=status` (errors `role=alert`); upload progress announces at 25 % increments and on completion/error; editor save state in a polite live region (announces "Saved" at most once per 30 s, conflicts assertively).
- **Forms:** visible labels, `autocomplete` attributes (name, email, new-password, current-password, one-time-code, tel, country, bday), errors linked by `aria-describedby`, no placeholder-only labels; accessible authentication (3.3.8): paste allowed in password and OTP fields, password managers supported, no cognitive tests.
- **Redundant entry (3.3.7):** onboarding pre-fills from registration; payout method pre-selected from saved methods; resubmitted verification pre-fills previous answers.
- **Target size (2.5.8):** ≥ 24 × 24 px everywhere; 44 × 44 on touch.
- **Dragging (2.5.7):** pan in viewer has arrow-key and button alternatives; panel resize has keyboard support and collapse buttons.
- **Colour:** contrast per DESIGN_SYSTEM §15; status never colour-only; charts have table views.
- **Motion:** reduced-motion honoured; no auto-advancing carousels.
- **Language:** `<html lang="en">`; content containers set `lang="km"` when dataset/task language is Khmer, so screen readers switch voice.
- **Timeouts:** sessions warn 2 minutes before idle expiry with "Stay signed in"; editor drafts persist locally so no data loss on expiry (2.2.1, 2.2.5).
- **Consistent help (3.2.6):** Help link in the same place (sidebar footer / public header) on every page.
- **Testing:** axe-core in Vitest component tests and Playwright E2E (both themes); manual NVDA + Firefox and VoiceOver + Safari passes on flows: register, upload, withdraw, annotate, review, mark paid.

## 14. Usability requirements

| ID | Requirement | Measure |
|---|---|---|
| UX-01 | A first-time contributor completes registration → verify email → onboarding → first upload submitted | ≤ 10 min median in moderated test (5 participants, 4 of 5 without assistance) |
| UX-02 | Contributor can state their available balance and why an amount is pending after viewing Earnings | 5 of 5 participants answer correctly |
| UX-03 | Every rejected file shows a human-readable reason and, where applicable, a fix | 100 % of reason codes mapped to messages (unit-tested map) |
| UX-04 | Upload interrupted by network loss resumes without re-sending completed parts | E2E test: kill network at 60 %, restore, completion with ≤ 1 duplicate part |
| UX-05 | Annotator loses no more than the last 5 s of typing on crash/close | IndexedDB local draft test + autosave interval test |
| UX-06 | Reviewer can decide a 50-file dataset using only the keyboard | Keyboard-only E2E: claim → decide all → finalize |
| UX-07 | Admin cannot mark a payout paid with a mismatching amount, missing reference or for own payout | E2E negative tests; button disabled until typed amount matches |
| UX-08 | Key list pages render first meaningful content quickly | LCP ≤ 2.5 s on 4G throttling (Lighthouse mobile) for #15, #18, #20; INP ≤ 200 ms |
| UX-09 | Every list page supports search/filter state in the URL and back-button restoration | E2E: filter → open detail → back → same filters/page |
| UX-10 | Khmer content renders without clipping in every component that displays user content | Visual regression snapshots with Khmer fixtures (stacked coeng + vowel signs) in light/dark |
| UX-11 | Status labels are consistent across pages | Single `StatusBadge` map; lint rule forbids ad-hoc status strings |
| UX-12 | Users always know the next step | Every non-terminal status on contributor pages displays a "What happens next" line |

## 15. Content and copy rules

- Sentence case for all UI text; buttons are verbs ("Submit for review", "Mark as paid").
- Money always with `$` and 2 decimals (DESIGN_SYSTEM §12); sizes in decimal units (§13); dates "26 Oct 2026, 14:05" in the browser time zone with UTC in tooltip.
- Use "withdrawal" for the contributor-facing concept and "payout" in admin finance screens; both refer to `payout_requests`.
- Estimated figures always labelled "Estimate" and prefixed `≈`.
- Legal pages show version and effective date; the Contributor Agreement page links to the user's accepted version when signed in.
