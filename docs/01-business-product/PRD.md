# DataHub — Product Requirements Document (PRD)

## Document control

| Field | Value |
|---|---|
| Document | PRD: Product Requirements Document (mandatory doc #2) |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | Product Manager |
| Approvers | Owner (SKAI Technology); CTO role; Senior UI/UX Designer |
| Canonical source | [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) |

## Header block

**Purpose.** Describe *what* DataHub v1 offers each user group and *why*: vision, personas, roles, features, dashboards, workflows, prioritisation and product metrics. It bridges the BRD (business needs BR-xx) and the SRS (testable requirements FR/NFR/SEC). Detailed, testable behaviour lives in [SRS.md](SRS.md). This PRD cites SRS ID ranges and does not restate them.

**Scope.** DataHub v1 (MVP) for all roles (contributor, annotator, reviewer, admin, super_admin), plus the future releases needed to show what v1 must not block. Visual design is in UI_UX_DESIGN.md / DESIGN_SYSTEM.md.

**Assumptions.** A-01 (single buyer, no external buyers in v1), A-02 (Khmer/English content; English UI, catalogue-ready for Khmer), A-03 (scale), A-04/A-06/A-07 (money units, withdrawal limits, hold period), A-08/A-09 (verification and upload gates), A-11 (no LibreOffice previews), A-14 (annotation rewards), A-15 (retention).

**Decisions.**
- **Web-first responsive app.** There are no native apps. The annotation editor and review workspace are desktop-optimised (≥ 1280 px ideal, ≥ 1024 px minimum).
- **Claim-based review queues** (pull) for datasets and annotations. **Push assignment** for annotation tasks.
- **One wallet per user** combines dataset earnings and annotation rewards, with separate journal kinds and separate reporting.
- **Earnings estimate** is shown before review but clearly labelled as not guaranteed.
- **Reviewer identity** is hidden from contributors ("DataHub reviewer").
- Prioritisation uses MoSCoW (§13).
- Future items (external buyer marketplace, bounding boxes, audio transcription, automatic payouts) are excluded from MVP (§14).

**Dependencies.** BRD.md, SRS.md, ENGINEERING_BASELINE.md, MASTER_PROMPT Parts 2–4 and 8–15. Downstream: USER_STORIES.md, UI_UX_DESIGN.md, WIREFRAMES/, USER_FLOWS.md, PRODUCT_ROADMAP.md.

**Acceptance criteria for this document.**
1. Contains all sections required by MASTER_PROMPT doc #2.
2. Every feature maps to at least one BR and one SRS range.
3. Every one of the 64 pages in MASTER_PROMPT Part 8 is assigned to a role area (§7.6).
4. MVP versus future scope is explicit, and future items are not required by any Must requirement.
5. Product metrics are measurable from DataHub data.

---

## 1. Product vision

> **DataHub makes it simple and fair for Cambodians to turn the documents and data they rightfully hold into income, and turns that data into high-quality Khmer AI training material.**

Positioning: *the trusted Khmer data exchange*. Contributors get a transparent per-GB price, file-level feedback and dependable manual payouts. SKAI gets a lawful, provenance-tracked corpus and an annotation pipeline in one place. Product principles:

1. **Pay for accepted value only.** No payment for duplicates, containers or rejected bytes, and every cent can be traced in the ledger.
2. **Transparency over surprise.** Estimates, statuses, reasons and timelines are always visible to the person they concern.
3. **Khmer-first.** Khmer text is stored exactly as typed and displayed correctly. The interface is ready for Khmer translation.
4. **Safe by default.** Data is private, uploads are never executed, money moves only with human confirmation, and admins use MFA.
5. **Built for low bandwidth.** Resumable uploads, small pages and mobile-friendly contributor screens.
6. **Operator efficiency.** Reviewers and admins work from queues with bulk actions, because review labour is the largest cost after purchase price (BRD §10.3).

## 2. Personas

| Persona | Profile | Goals | Frustrations | Primary role(s) |
|---|---|---|---|---|
| **Sophea**, 21, university student (Phnom Penh) | Android phone + shared laptop, 4G, Facebook/Telegram native, English intermediate. | Earn pocket money from her own typed lecture notes and photographed handwritten notes; withdraw to ABA Pay. | Unclear rules, slow payment, uploads failing on mobile data. | contributor |
| **Dara**, 46, archivist (provincial pagoda library / NGO) | Desktop + flatbed scanner, large TIFF and PDF scans (100 MB–3 GB each), limited tech support. | Fund digitisation by selling a licence for scans of works he has rights to; keep provenance. | Large files, ZIP sets of thousands of pages, fear of losing ownership. | contributor |
| **Bopha**, 30, freelance Khmer typist | Fast Khmer Unicode typist, uses a laptop, has done outsourced transcription. | Steady paid transcription work with clear instructions; quick feedback. | Losing work to crashes, legacy-font habits flagged without explanation, late pay. | annotator (+ contributor) |
| **Vichea**, 34, linguist reviewer (SKAI staff) | Desktop, dual monitor, reviews 6+ hours/day. | Decide fast and correctly with previews, duplicates and size totals in one place. | Opening files one by one, recalculating payment by hand, unclear rights. | reviewer |
| **Sokha**, 29, operations admin (SKAI) | Desktop, handles users, payouts and support. | Clear queues, safe financial actions, quick answers to contributors. | Double-paying, chasing payment proofs, scattered chats. | admin |
| **Kosal**, 40, CTO / owner (SKAI) | Oversees cost, security and pricing. | Control pricing and policy, see liabilities and data volume, audit everything. | Surprises in liabilities, security incidents. | super_admin |
| **Chenda**, 52, diaspora contributor (Long Beach, USA) | Laptop, holds community newspaper archives. | Contribute archives safely; get paid via Wise/PayPal. | Time zones, international transfer fees. | contributor |

## 3. User roles

Roles and permissions are defined in **BL §6**. A user may hold several roles, and every registered user is a `contributor`.

| Role | Product summary | Granted by |
|---|---|---|
| contributor | Uploads datasets, sees own data, feedback, wallet and payouts, messages support. | Automatic at registration |
| annotator | Works assigned annotation tasks, sees task rewards. Must be a verified contributor to be assigned work. | admin |
| reviewer | Reviews datasets (claim from queue) and annotations, records quality scores. Cannot review own work. | admin |
| admin | Operates the platform: users, verification, datasets, takedowns, annotation projects, payouts, support, exports, analytics. MFA required. | super_admin |
| super_admin | Admin plus pricing, settings, roles, audit/security logs, ledger adjustments, payout reversal. MFA required. | super_admin (first via `scripts/create-admin`) |

## 4. Core features

| # | Feature | Summary | BR | SRS |
|---|---|---|---|---|
| F1 | Accounts & security | Register, verify email, login, reset password, sessions, admin TOTP MFA | BR-01, BR-30 | FR-AUTH-01…14, SEC-01…06 |
| F2 | Onboarding & profile | Contributor Agreement + rights declaration, profile, payout methods, notification preferences, deletion | BR-01, BR-28 | FR-USER-01…08 |
| F3 | Contributor verification | Identity/age/payout eligibility review gating withdrawals and annotation | BR-02 | FR-VER-01…07 |
| F4 | Datasets | Create, describe, submit, withdraw, view status, files and feedback | BR-07…10 | FR-DS-01…14 |
| F5 | Resumable uploads | Multi-file/folder/drag-drop, multipart direct-to-storage, resume, retry, cancel | BR-05 | FR-UPL-01…12, NFR-UPL-01…05 |
| F6 | Safe processing | Type sniffing, SHA-256, ClamAV, ZIP expansion, previews, duplicates | BR-06, BR-12 | FR-PROC-01…13 |
| F7 | Dataset review | Queue, claim, workspace, file decisions, bulk, checklist, scores, finalize | BR-09, BR-10 | FR-REV-01…14 |
| F8 | Earnings & ledger | Versioned pricing, per-file earnings, wallet balances, transactions, reconciliation | BR-11…14 | FR-FIN-01…15 |
| F9 | Manual payouts | Request, reserve, approve (dual ≥ $100), mark paid with reference/proof, fail, cancel, reverse | BR-15…17 | FR-PAY-01…14 |
| F10 | Annotation | Projects, task generation, assignment, three-panel editor, autosave, versions, review, rewards | BR-18…21 | FR-ANN-01…18 |
| F11 | Messaging | Support conversations, dataset-linked threads, attachments, real-time | BR-22 | FR-MSG-01…08 |
| F12 | Notifications | In-app + email via outbox, preferences | BR-23 | FR-NOTIF-01…06 |
| F13 | Exports | Filtered background exports with manifest, annotations, expiring downloads | BR-24 | FR-EXP-01…07 |
| F14 | Administration | Users, roles, datasets search, takedowns, analytics, settings, jobs | BR-03, BR-25, BR-27, BR-28 | FR-ADM-01…12 |
| F15 | Audit | Append-only audit trail and security events | BR-26 | FR-AUD-01…05 |

## 5. Functional requirements summary

The full catalogue of 227 requirements is in [SRS.md](SRS.md). This table summarises the product-level expectations per module.

| Module | Product-level expectation | SRS range | Count |
|---|---|---|---:|
| AUTH | Users sign up in < 2 min, verify by email link (24 h), stay signed in for 7 days idle on their own device; admins re-verify with MFA, with 12 h max sessions. | FR-AUTH-01…14 | 14 |
| USER | Onboarding is one screen: agreement + rights declaration. Up to 5 payout methods. Users control non-essential email. | FR-USER-01…08 | 8 |
| VER | A single verification form; admins decide approved / needs info / rejected with reasons. | FR-VER-01…07 | 7 |
| DS | A dataset is a draft until submitted. Status, files, estimate and feedback are always visible. | FR-DS-01…14 | 14 |
| UPL | Uploads of files up to 5 GB survive network drops and browser restarts for 24 h. | FR-UPL-01…12 | 12 |
| PROC | Every file is typed, hashed, scanned, previewed and duplicate-checked automatically. Unsafe files never become payable. | FR-PROC-01…13 | 13 |
| REV | Reviewers claim, decide per file or in bulk, see the payable amount, and finalize once (idempotent). | FR-REV-01…14 | 14 |
| FIN | Earnings follow the formula exactly, every cent is traceable in the ledger, and reconciliation runs nightly. | FR-FIN-01…15 | 15 |
| PAY | Withdrawals of $10–$5,000 with full status timeline. Admin actions follow separation of duties. | FR-PAY-01…14 | 14 |
| ANN | Editor never loses work (autosave, local recovery, conflict detection) and keeps Khmer text byte-exact. | FR-ANN-01…18 | 18 |
| MSG | Support chat with history, attachments and real-time delivery. | FR-MSG-01…08 | 8 |
| NOTIF | Users learn about every important event in-app and by email. | FR-NOTIF-01…06 | 6 |
| EXP | Admins export accepted/approved data with manifest; links expire. | FR-EXP-01…07 | 7 |
| ADM | Admins run everything from queues and dashboards. Super_admin controls policy. | FR-ADM-01…12 | 12 |
| AUD | Every sensitive action is logged immutably. | FR-AUD-01…05 | 5 |

## 6. Non-functional requirements summary

| Area | Target | SRS |
|---|---|---|
| Performance | API p95 < 300 ms at 200 concurrent users; processing ≥ 2 GB/min/worker; LCP ≤ 2.5 s on 4G; WS events ≤ 2 s | NFR-PERF-01…06 |
| Availability & recovery | 99.5 % monthly; RPO 24 h; RTO 4 h; quarterly restore drill | NFR-AVL-01…05 |
| Accessibility & Khmer | WCAG 2.2 AA; keyboard-complete; 360 px+; Noto Sans Khmer, `lang="km"`, line-height ≥ 1.6; catalogue-ready UI | NFR-ACC-01…07 |
| Integrity | Integer micro-USD; balanced append-only ledger; single-transaction commands; error envelope; OpenAPI contract | NFR-INT-01…10 |
| Upload reliability | ≥ 99 % completion ≤ 5 GB; resume within 24 h; hash-verified | NFR-UPL-01…05 |
| Observability | JSON logs with request_id; Prometheus metrics; alerts; no secrets in logs | NFR-OBS-01…05 |
| Security | Argon2id, secure cookies, CSRF, admin MFA, rate limits, RBAC deny-by-default, private storage, CSP, scans | SEC-01…22 |

## 7. Dashboard requirements per role

Every dashboard loads in ≤ 2.5 s (LCP p75), has empty, loading and error states, and keeps the sidebar navigation for authenticated areas. Figures come from real backend endpoints, and estimates are labelled.

### 7.1 Contributor dashboard (`/dashboard`)
- **Onboarding checklist** until complete: verify email → accept agreement → add payout method → submit verification. Each step shows its status and links to the screen that completes it.
- **Wallet cards:** Available, Pending, Reserved, Paid (lifetime), and Estimated (labelled "estimate, not guaranteed"). Data from `GET /wallet`.
- **Datasets panel:** counts by status (draft, processing, submitted, in review, needs changes, approved/partial, rejected) and the 5 most recently updated datasets, each with status badge and next action.
- **Primary call to action:** "Upload dataset". If the agreement is outdated, a banner asks for re-acceptance.
- **Recent activity:** last 10 notifications. **Support:** unread conversations count.
- **Withdraw button:** enabled only when verified, available ≥ $10 and no open payout. Otherwise the reason is shown in a tooltip.

### 7.2 Annotator dashboard (`/annotate`)
- Counts of assigned, in progress, returned for correction, submitted/in review, approved this month.
- "Continue where you left off" (last edited task), plus tasks due within 48 h highlighted (overdue in red with icon and text).
- Rewards: approved this month, lifetime annotation rewards, link to wallet.
- Latest reviewer feedback (3 items).

### 7.3 Reviewer dashboard (`/review`)
- Dataset queue: number submitted, oldest age, total GB waiting. "Claim next" button.
- My in-progress reviews with age; warning after 3 days.
- Annotation review queue size and oldest age.
- Personal stats for the last 30 days: datasets finalized, GB decided, acceptance rate, annotation reviews, average score given.

### 7.4 Admin dashboard (`/admin`)
- **Action queues** (FR-ADM-07): pending verifications, submitted datasets, stale reviews (> 3 days), payouts requested / approved-unpaid, conversations awaiting admin, failed jobs (24 h), takedown requests open.
- **KPIs for a selectable period:** registrations, accepted GB, acceptance rate, earnings credited, payouts paid, outstanding liability, annotation pages approved.
- **Health tile:** last reconciliation result, last backup time, queue backlog, storage usage versus budget.
- **Charts** (Recharts, each with a table alternative): accepted GB per week (raw vs labeled), payouts per week, annotation throughput.

### 7.5 Super-admin additions
Pricing rules history and "schedule new rate"; settings; roles; audit log and security events; adjustments; reversal actions.

### 7.6 Page inventory by area (MASTER_PROMPT Part 8)
| Area | Pages (Part 8 numbering) |
|---|---|
| Public | 1 Home, 2 How It Works, 3 Pricing, 4 Supported Data Types, 5 Contact/Help, 6 Terms, 7 Privacy, 8 Contributor Agreement |
| Auth | 9 Login, 10 Registration, 11 Email Verification, 12 Forgot Password, 13 Reset Password, 14 Contributor Onboarding |
| Contributor | 15 Dashboard, 16 Upload Dataset, 17 Upload Progress, 18 My Datasets, 19 Dataset Details, 20 Earnings, 21 Withdrawals, 22 Withdrawal Details, 23 Messages, 24 Notifications, 25 Profile, 26 Account Settings (sessions, MFA, password, preferences, deletion) |
| Admin | 27 Dashboard, 28 Users, 29 User Details, 30 Verification, 31 All Datasets, 32 Dataset Details, 33 Review Workspace, 34 Review Queue, 35 Annotation Projects, 36 Create Project, 37 Project Details, 38 Assignments, 39 Annotation Review Queue, 40 Payment Overview, 41 Payout Requests, 42 Payout Details, 43 Pricing, 44 Messaging, 45 Export Center, 46 Analytics, 47 Audit Logs, 48 Settings |
| Annotator | 49 Dashboard, 50 My Tasks, 51 Task Details, 52 Editor, 53 Submitted Tasks, 54 Feedback, 55 Earnings |
| Reviewer | 56 Dashboard, 57 Dataset Review Tasks, 58 Annotation Review Tasks, 59 Annotation Comparison, 60 Review History |
| Global | 61 Access Denied, 62 Not Found, 63 Server Error, 64 Maintenance |

## 8. Dataset submission features

**Flow:** Create dataset (metadata form) → add files (picker, folder, drag-drop, ZIP) → watch upload and processing → fix issues (remove failed files, add more) → confirm rights → submit → track review → receive decision → (if changes requested) edit and resubmit.

| Capability | Product detail | SRS |
|---|---|---|
| Metadata | Title, description, languages (Khmer and English offered first), category, raw/labeled class with an explanation of what counts as "labeled" (clean text, transcriptions, structured labels), provenance, licence, personal-data flag, tags | FR-DS-01 |
| Upload | Up to 2,000 files and 50 GB per dataset, 5 GB per file. Per-file and overall progress, speed, ETA. Pause/resume via cancel + resume. Retry failed parts automatically 5×. | FR-UPL-01…12 |
| Resume | After reload, a banner "3 uploads can be resumed – re-select the files" matches files by name, size and modification time. | FR-UPL-11 |
| Processing status | Per file: Uploaded → Processing → Ready / Failed (reason in plain language: "File type does not match its extension", "Archive exceeds safety limits") / Quarantined ("Security scan found a threat"). | FR-PROC-01…09 |
| Duplicates | Badges: "Already accepted elsewhere – will not earn", "Duplicate within this dataset", "Similar to another file". | FR-PROC-11, 12 |
| Estimate | "Estimated earnings if accepted: $X.XX". The tooltip explains the formula and that only accepted unique files earn. | FR-DS-10 |
| Submit gate | Button disabled with a checklist: all files finished processing, ≥ 1 ready, metadata complete, rights confirmed. | FR-DS-08 |
| Feedback | Per-file decisions with reason and comment, quality scores (1–5, five dimensions), overall feedback, accepted vs rejected GB, amount credited. | FR-DS-11 |
| Withdraw | Allowed before a reviewer claims the dataset. | FR-DS-09 |

## 9. Annotation requirements

| Capability | Product detail | SRS |
|---|---|---|
| Project setup | Wizard: name & instructions (Markdown preview) → source datasets (approved only) → annotation types (transcription, text correction, classification, metadata, page label) → label set / metadata schema → task unit (file or page) → rewards (per task and/or per page) → deadline → review. Then "Generate tasks". | FR-ANN-01…03 |
| Assignment | Table of tasks with filters. Assign one, bulk-assign round-robin up to 500, reassign/unassign. Only verified annotators appear in the picker. | FR-ANN-05…07 |
| Editor layout | Three panels. **Left:** task list, pages, progress, instructions. **Centre:** page image, zoom 25–400 %, pan, fit, rotate, page nav. **Right:** transcription, correction, metadata, labels, notes, reviewer comments. | FR-ANN-13 |
| Never lose work | Autosave 5 s after typing stops and on blur. Status chip (Saved / Saving… / Offline – kept locally / Conflict). Local draft recovery. Version history with restore. | FR-ANN-10, 11, 13 |
| Conflicts | If another session saved first, the user sees both versions side by side and chooses which to keep. | FR-ANN-10; SRS §9 |
| Khmer | Noto Sans Khmer at a comfortable size (≥ 18 px in editor) and line-height ≥ 1.6. Text is stored byte-exact (COENG, ZWSP preserved). Character count and hidden-character toggle show ZWSP/ZWNJ. | FR-ANN-12; NFR-ACC-06 |
| Keyboard | Shortcuts: next/previous page (Alt+→/←), save now (Ctrl+S), submit (Ctrl+Enter with confirm), zoom (Ctrl+ +/−), toggle instructions (Alt+I), show hidden characters (Alt+H). A shortcut help dialog opens with `?`. | FR-ANN-13 |
| Submission | Validation lists missing items per page before submit. | FR-ANN-14 |
| Review | Claim from queue, source document beside annotation, character-level diff between versions, score 1–5, comments, approve or request changes. | FR-ANN-15…17 |
| Rewards | Shown on each task before starting ("$0.08 per page × 12 pages = $0.96"). Credited automatically on approval. | FR-ANN-16; FR-FIN-15 |

## 10. Financial workflows

### 10.1 Earnings
- Earnings are created **only** when a dataset review is finalized as approved or partially approved, or when an annotation is approved.
- The amount is computed by the server: per file `floor(bytes × rate / 10⁹)` in micro-USD, shown rounded down to cents.
- The contributor sees five balances (BL §8.6) and a transaction history where each line links to its dataset review or annotation task.

### 10.2 Withdrawal (contributor)
1. Click **Withdraw** → the form shows available balance, min $10 / max $5,000, the payout method selector and an amount field (whole cents).
2. Confirm dialog: "You are requesting $X to ABA Pay ••••1234. This amount will be reserved until processed."
3. Status timeline: Requested → Approved → Paid (with reference and date). The contributor may cancel while Requested.
4. Notifications and email at every step.

### 10.3 Payout processing (admin)
1. The queue is sorted oldest first, with risk flags (new payout method < 24 h, first payout, ≥ $100 dual approval, verification changed).
2. **Approve** (confirm dialog). For amounts ≥ $100 the UI shows "1 of 2 approvals" and blocks the same admin from giving the second approval.
3. The admin makes the transfer **outside** DataHub.
4. **Mark paid**: payment reference (required), paid date, optional proof upload, note. The confirm dialog repeats the amount and destination.
5. Exceptions: **Reject** (reason), **Cancel** (approved, reason), **Mark failed** (reason; funds return to available), **Reverse** (super_admin, after a bounced payment).
6. Corrections: super_admin **Adjustment** credit/debit with reason; it is visible to the user as an "Adjustment" line.

### 10.4 Finance oversight
Finance overview (liabilities, credited, paid), ledger explorer, reconciliation status (nightly, mismatches alert), and pricing rules with scheduled future rates (HA-06).

## 11. Messaging requirements

- **Contributor side:** a "Messages" page with conversation list (unread badges) and a "New conversation" form (subject, message, optional dataset or payout link, attachments up to 5 × 10 MB: PDF, JPEG, PNG, TXT, DOCX). Contextual "Ask support about this dataset/payout" buttons pre-link the conversation.
- **Admin support inbox:** filters (status open / awaiting user / closed, assignee, unread, linked dataset), search, assign to self, close and reopen. Reply templates are post-MVP. Each conversation shows a side panel with user summary (verification, datasets, wallet) for context.
- **Real-time:** new messages appear without refresh (WebSocket), with 30 s polling fallback. An email follows if the message is unread after 15 min.
- **Safety:** plain text only (links auto-linked), attachments scanned before they appear, and participants only.
- SRS: FR-MSG-01…08, FR-NOTIF-01…06.

## 12. Administrative controls

| Control | Who | SRS |
|---|---|---|
| Search/filter users; view details; suspend/reactivate; revoke sessions | admin | FR-ADM-01, 02, 04 |
| Grant annotator/reviewer | admin | FR-ADM-03 |
| Grant/revoke admin, super_admin | super_admin | FR-ADM-03 |
| Verification decisions | admin (`user.verify`) | FR-VER-03…05 |
| Dataset search, details, takedown, rescan | admin | FR-ADM-05, FR-DS-12, FR-PROC-04 |
| Annotation projects and assignments | admin | FR-ANN-01…07, 18 |
| Payout approve/reject/mark paid/failed/cancel | admin (≠ recipient) | FR-PAY-07…11 |
| Payout reverse; ledger adjustments | super_admin | FR-PAY-12, FR-FIN-12 |
| Pricing rules | super_admin | FR-FIN-01 |
| Settings | super_admin | FR-ADM-08 |
| Exports | admin | FR-EXP-01…07 |
| Analytics | admin | FR-ADM-06 |
| Audit log, security events | super_admin | FR-AUD-03 |
| Takedown and deletion requests | admin | FR-ADM-10, 11 |
| Background job monitor | admin | FR-ADM-12 |

All destructive or financial actions use a confirmation dialog that restates the impact (amount, recipient, dataset). Reasons are mandatory where the SRS specifies, and every action is audit-logged (FR-AUD-01).

## 13. Feature prioritisation (MoSCoW)

| Priority | Features |
|---|---|
| **Must** | F1 accounts & admin MFA; F2 onboarding, payout methods, deletion request; F3 verification; F4 datasets; F5 resumable uploads; F6 processing incl. ClamAV fail-closed, ZIP safety, previews, exact duplicates; F7 review incl. bulk and idempotent finalize; F8 pricing, ledger, wallet, reconciliation; F9 manual payouts incl. dual approval, failure, reversal, adjustments; F10 annotation incl. editor autosave, versions, conflict detection, review, rewards; F11 messaging core + attachments + WS; F12 notifications + email outbox; F13 exports; F14 admin users/roles/datasets/analytics/settings/takedown; F15 audit; WCAG 2.2 AA; backups/restore |
| **Should** | Near-duplicate flags (FR-PROC-12); Khmer ratio metadata (FR-PROC-10); new-payout-method flag (FR-USER-05); verification re-review on identity change (FR-USER-08); admin notifications (FR-NOTIF-06); support inbox metrics (FR-MSG-08); export concurrency cap & hash re-verification (FR-EXP-07, NFR-INT-09); job monitor re-enqueue (FR-ADM-12); low-bandwidth adaptive concurrency (NFR-UPL-05); LCP budget (NFR-PERF-04); Sentry (NFR-OBS-03) |
| **Could** (v1.1 candidates) | Reply templates for support; saved admin filters; CSV export of admin tables; per-user annual earnings statement PDF; contributor satisfaction survey; in-app Khmer UI translation toggle (strings ready) |
| **Won't (v1)** | External buyer marketplace & orders; automatic payouts / payment APIs; bounding boxes & image regions; audio/video transcription; OCR pre-labeling; LibreOffice previews for DOC/DOCX page rendering; native mobile apps; multi-currency; third-party KYC; public dataset catalogue |

## 14. MVP versus future releases

| Capability | MVP (v1.0) | v1.1 | v1.2 | v2.0 | v2.x |
|---|:-:|:-:|:-:|:-:|:-:|
| Registration, verification, uploads, review, ledger, manual payouts | ✓ | | | | |
| Annotation: transcription, correction, classification, metadata, page labels | ✓ | | | | |
| Messaging, notifications, exports, analytics, audit | ✓ | | | | |
| Khmer UI translation, support reply templates, annual statements, survey | | ✓ | | | |
| Telegram notification channel (popular in Cambodia) | | ✓ | | | |
| Bounding boxes / image regions (`bbox` reserved in data model) | | | ✓ | | |
| OCR-assisted pre-transcription and inter-annotator agreement | | | ✓ | | |
| DOC/DOCX page rendering (LibreOffice in sandbox) | | | ✓ | | |
| **External buyer marketplace** (`buyer` role, catalogue, `orders`, licences, invoices) | | | | ✓ | |
| Contributor revenue share on resale (needs HA-02 licence terms) | | | | ✓ | |
| **Automatic payouts** via provider APIs (e.g. Wise, bank APIs) with approval gates | | | | | ✓ |
| Audio transcription and speech datasets | | | | | ✓ |
| Third-party KYC provider; multi-currency (KHR) | | | | | ✓ |

MVP must not block these. The `buyer` role and `orders` module names are reserved (A-01). The `system_payouts_settled` wallet exists for v2 cash accounting. `annotation_types` reserves `bbox` and page data reserves `regions: []` (BL §11). Payout records keep method and reference fields that a provider integration can populate.

## 15. Product success metrics

| Metric | Definition | MVP target (first 6 months after public launch) | Data source |
|---|---|---|---|
| Activation rate | Registered users who verify email and complete onboarding within 7 days | ≥ 60 % | users, agreement_acceptances |
| First-dataset rate | Onboarded users who submit ≥ 1 dataset within 30 days | ≥ 40 % | datasets |
| Upload completion | Sessions completed ÷ sessions started (not user-cancelled) | ≥ 99 % | upload_sessions |
| Time to decision | Median submit → finalize | ≤ 5 business days | dataset_reviews |
| Acceptance rate (bytes) | Accepted ÷ processed ready bytes | ≥ 60 % | dataset_file_reviews |
| Resubmission success | Changes-requested datasets later approved/partial | ≥ 50 % | datasets |
| Payout turnaround | Median requested → paid | ≤ 5 business days | payout_requests |
| Payout accuracy | Reversals + corrections ÷ payouts paid | ≤ 1 % | ledger |
| Double-credit incidents | Duplicate earning or reward journals | 0 | ledger idempotency audit |
| Reviewer throughput | Accepted GB decided per reviewer-hour | ≥ 10 GB/h raw equivalent | reviews + timesheets |
| Annotation first-pass approval | Approved without changes ÷ reviewed | ≥ 80 % | annotation_reviews |
| Annotation data-loss incidents | Reports of lost editor work | 0 | support + audit |
| Support responsiveness | Median first admin reply | ≤ 1 business day | messages |
| Accessibility | axe serious/critical violations | 0 | CI |
| Monthly active contributors | Users with an upload, submission or withdrawal in the month | ≥ 300 by month 6 | analytics |
