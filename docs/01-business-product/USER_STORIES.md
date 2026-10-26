# DataHub — User Stories

## Document control

| Field | Value |
|---|---|
| Document | User Stories (mandatory product document) |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | Product Manager / Business Analyst |
| Approvers | CTO role; Senior UI/UX Designer; QA Lead |
| Canonical source | [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) incl. §16 amendments AM-01 … AM-14 (wins on conflict) |
| Requirement catalogue | [`SRS.md`](SRS.md) |
| Traceability | [`../REQUIREMENTS_TRACEABILITY.md`](../REQUIREMENTS_TRACEABILITY.md) |

## Header block

**Purpose.** Express every major DataHub v1 capability as a testable user story per role, so that design, implementation and QA share one behavioural definition. Each story cites the SRS requirements it realises, the API operations and UI routes involved, and the planned test cases.

**Scope.** DataHub v1 (MVP) for six actors: anonymous visitor (`US-PUB`), contributor (`US-CON`), annotator (`US-ANN`), reviewer (`US-REV`), administrator (`US-ADM`) and super admin (`US-SUP`). Covered areas: registration, email verification, onboarding and agreements, profile and payout methods, contributor verification, dataset drafting, resumable upload, archives, processing and scanning, duplicates, estimates, submission, review (incl. partial approval and labeled upgrade), feedback, wallet and ledger, withdrawals and manual payouts (approve, dual approval, pay, fail, cancel, reverse), adjustments, pricing versions, annotation projects, tasks, editor, autosave, conflicts, Khmer fidelity, annotation review and rewards, messaging, notifications, settings, sessions and MFA, exports, analytics, audit, takedown, account deletion, maintenance mode and operations. Future features (buyer marketplace, bounding boxes, audio, automatic payouts) are out of scope.

**Assumptions.**
- Baseline assumptions A-01 … A-15 apply; most relevant are A-04 (integer micro-USD), A-06 (withdrawal $10 – $5,000), A-07 (hold days, default 0), A-08 (verification gates payouts and annotation only), A-09 (upload prerequisites), A-10 (fail-closed scanning) and A-15 (retention).
- All API paths are relative to `/api/v1`; all unsafe calls carry `X-CSRF-Token` (SEC-04); admin calls run on an MFA-verified session (SEC-05).
- Money examples use the seeded rates: raw 1,000,000 and labeled 1,500,000 micros per GB (10⁹ bytes); earnings are floored per file.
- Example people, codes and amounts are illustrative test data.

**Decisions.**
- Story ID scheme `US-<ROLE>-nn` (baseline §15), extended with `PUB` for anonymous visitors. IDs are stable and never reused.
- Priority uses MoSCoW and is the highest priority of the Must/Should requirements a story realises.
- Per-file upload limit is **4,000,000,000 bytes** (AM-01 overrides the 5 GB in FR-UPL-02 / FR-DS-07 text).
- Error codes are quoted in the SRS §9 form (e.g. `409 invalid_state`). Where API_DOCUMENTATION.md uses a dotted catalogue code that has no SRS equivalent (e.g. `400 precondition.required`), the API form is quoted and labelled.
- **Planned test IDs** follow the shared rule: requirement `FR-<MOD>-nn` → `TC-<MOD>-0nn`; `NFR-<CAT>-nn` → `TC-<CAT>-0nn`; `SEC-nn` → `TC-SEC-0nn`. Because `NFR-UPL` would collide with `FR-UPL`, `NFR-UPL-nn` → `TC-UPLR-0nn`. A story's associated tests are the planned test IDs of the requirements it covers.
- One story may cover several requirements and one requirement may be covered by several stories; the traceability matrix is the authoritative join.

**Dependencies.** BRD.md (BR-01 … BR-34), PRD.md, SRS.md, ENGINEERING_BASELINE.md, UI_UX_DESIGN.md §3 (routes), USER_FLOWS.md, API_DOCUMENTATION.md / openapi.yaml, AUTH_AUTHORIZATION.md, FILE_UPLOAD_STORAGE.md, PRICING_PAYOUT_POLICY.md, DATA_QUALITY_REVIEW.md, ANNOTATION_GUIDELINES.md. Consumers: TEST_CASES.md, REQUIREMENTS_TRACEABILITY.md, implementation backlog.

**Acceptance criteria for this document.**
1. Every role has stories; total 95 stories (PUB 8, CON 26, ANN 12, REV 14, ADM 24, SUP 11).
2. Every story has an ID, MoSCoW priority, preconditions, a numbered main scenario, alternate scenarios, ≥ 2 Given/When/Then acceptance criteria with concrete numbers or states, API operations, UI routes, SRS IDs and planned test IDs.
3. Every functional requirement in SRS.md is realised by at least one story (167/179 FR covered; checked by script). Non-functional and security requirements without a natural user-facing story are listed in REQUIREMENTS_TRACEABILITY.md §5.
4. Every cited requirement ID exists in SRS.md and every cited route exists in UI_UX_DESIGN.md §3 (checked by script).
5. No story contradicts ENGINEERING_BASELINE.md §§1–16.

---

## 1. Story index

| ID | Title | Role | Priority | Requirements |
|---|---|---|---|---|
| [US-PUB-01](#us-pub-01) | Understand pricing, process and supported data types | visitor | Must | FR-FIN-02, FR-UPL-02, NFR-ACC-05, NFR-PERF-04 |
| [US-PUB-02](#us-pub-02) | Register an account | visitor | Must | FR-AUTH-01, FR-AUTH-02, FR-FIN-09, SEC-01, SEC-06, NFR-ACC-04 |
| [US-PUB-03](#us-pub-03) | Verify my email address | visitor | Must | FR-AUTH-03, FR-AUTH-04, FR-AUTH-05, FR-NOTIF-01 |
| [US-PUB-04](#us-pub-04) | Sign in securely | visitor | Must | FR-AUTH-05, FR-AUTH-06, FR-AUTH-07, FR-AUTH-10, FR-AUTH-14, SEC-02, SEC-03, SEC-04, SEC-12 |
| [US-PUB-05](#us-pub-05) | Reset a forgotten password | visitor | Must | FR-AUTH-12, FR-AUTH-02, FR-NOTIF-05 |
| [US-PUB-06](#us-pub-06) | Contact DataHub or report infringing content | visitor | Must | FR-ADM-10, SEC-06, SEC-17 |
| [US-PUB-07](#us-pub-07) | Use DataHub with keyboard, screen reader and Khmer text | visitor | Must | NFR-ACC-01, NFR-ACC-02, NFR-ACC-03, NFR-ACC-04, NFR-ACC-06, NFR-ACC-07 |
| [US-PUB-08](#us-pub-08) | See a clear maintenance or error page | visitor | Must | NFR-AVL-04, NFR-INT-06, NFR-INT-07, FR-ADM-08 |
| [US-CON-01](#us-con-01) | Complete onboarding and accept the Contributor Agreement | contributor | Must | FR-USER-02, FR-USER-03, FR-USER-01 |
| [US-CON-02](#us-con-02) | Maintain my profile | contributor | Must | FR-USER-01, FR-USER-08, NFR-INT-04, SEC-17 |
| [US-CON-03](#us-con-03) | Manage payout methods | contributor | Must | FR-USER-04, FR-USER-05, SEC-14, FR-AUD-05 |
| [US-CON-04](#us-con-04) | Submit and resubmit contributor verification | contributor | Must | FR-VER-01, FR-VER-02, FR-VER-05, FR-VER-06, FR-NOTIF-06 |
| [US-CON-05](#us-con-05) | Create and edit a dataset draft | contributor | Must | FR-DS-01, FR-DS-04, FR-USER-02 |
| [US-CON-06](#us-con-06) | Upload many files and folders with progress | contributor | Must | FR-UPL-01, FR-UPL-03, FR-UPL-05, FR-UPL-08, FR-UPL-09, FR-UPL-10, SEC-09, SEC-16, NFR-UPL-01, NFR-UPL-04 |
| [US-CON-07](#us-con-07) | Get clear rejection of uploads that break limits | contributor | Must | FR-UPL-02, FR-DS-07 |
| [US-CON-08](#us-con-08) | Resume or cancel an interrupted upload | contributor | Must | FR-UPL-04, FR-UPL-06, FR-UPL-07, FR-UPL-11, FR-UPL-12, NFR-UPL-02, NFR-UPL-03, NFR-UPL-05 |
| [US-CON-09](#us-con-09) | Follow file processing status | contributor | Must | FR-DS-06, FR-PROC-01, FR-PROC-02, FR-PROC-03, FR-PROC-08, FR-PROC-09, FR-PROC-10, FR-PROC-13, NFR-PERF-02, SEC-11 |
| [US-CON-10](#us-con-10) | Preview and download my own files | contributor | Must | FR-DS-13, FR-DS-14, SEC-10, FR-PROC-08 |
| [US-CON-11](#us-con-11) | Upload a ZIP archive safely | contributor | Should | FR-PROC-05, FR-PROC-06, FR-PROC-07 |
| [US-CON-12](#us-con-12) | See duplicate warnings | contributor | Must | FR-PROC-11, FR-PROC-12, FR-FIN-05, FR-FIN-06 |
| [US-CON-13](#us-con-13) | See an earnings estimate before submitting | contributor | Must | FR-DS-10, FR-FIN-04 |
| [US-CON-14](#us-con-14) | Submit a dataset for review | contributor | Must | FR-DS-08, FR-NOTIF-01 |
| [US-CON-15](#us-con-15) | Withdraw or delete a dataset | contributor | Must | FR-DS-05, FR-DS-09 |
| [US-CON-16](#us-con-16) | List my datasets privately | contributor | Must | FR-DS-02, FR-DS-03, SEC-08, NFR-PERF-03 |
| [US-CON-17](#us-con-17) | Read review feedback, including partial approvals | contributor | Must | FR-DS-11, FR-REV-12, FR-REV-06 |
| [US-CON-18](#us-con-18) | Fix and resubmit after changes are requested | contributor | Must | FR-REV-13, FR-DS-08, FR-DS-04 |
| [US-CON-19](#us-con-19) | See my wallet balances and transactions | contributor | Must | FR-FIN-11, FR-FIN-08, FR-FIN-10, FR-FIN-04, NFR-INT-01, NFR-INT-05 |
| [US-CON-20](#us-con-20) | Request a withdrawal | contributor | Must | FR-PAY-01, FR-PAY-02, FR-PAY-03, FR-PAY-04, FR-PAY-05, FR-VER-06 |
| [US-CON-21](#us-con-21) | Track or cancel my withdrawal | contributor | Must | FR-PAY-06, FR-PAY-13 |
| [US-CON-22](#us-con-22) | Message support about my dataset or payout | contributor | Must | FR-MSG-01, FR-MSG-03, FR-MSG-05, SEC-18, SEC-15 |
| [US-CON-23](#us-con-23) | Read and reply to conversations in real time | contributor | Must | FR-MSG-02, FR-MSG-04, FR-MSG-06, FR-MSG-07, NFR-PERF-05 |
| [US-CON-24](#us-con-24) | Manage notifications and email preferences | contributor | Must | FR-NOTIF-01, FR-NOTIF-02, FR-NOTIF-03, FR-NOTIF-04, FR-NOTIF-05, FR-USER-06, NFR-AVL-05 |
| [US-CON-25](#us-con-25) | Secure my account: sessions and password | contributor | Must | FR-AUTH-11, FR-AUTH-13, SEC-01, SEC-21 |
| [US-CON-26](#us-con-26) | Request deletion of my account | contributor | Must | FR-USER-07 |
| [US-ANN-01](#us-ann-01) | See my assigned annotation tasks | annotator | Must | FR-ANN-08, SEC-08 |
| [US-ANN-02](#us-ann-02) | Get notified of assignments and deadlines | annotator | Must | FR-ANN-05, FR-ANN-18, FR-VER-06, FR-NOTIF-04 |
| [US-ANN-03](#us-ann-03) | Start a task and read the instructions | annotator | Must | FR-ANN-09, SEC-18 |
| [US-ANN-04](#us-ann-04) | Annotate in the three-panel editor | annotator | Must | FR-ANN-13, FR-DS-13, NFR-ACC-05 |
| [US-ANN-05](#us-ann-05) | Never lose work: autosave and draft recovery | annotator | Must | FR-ANN-10, FR-ANN-13, FR-ANN-11, FR-ANN-09 |
| [US-ANN-06](#us-ann-06) | Resolve an edit conflict | annotator | Must | FR-ANN-10 |
| [US-ANN-07](#us-ann-07) | Transcribe Khmer text exactly as typed | annotator | Must | FR-ANN-12, NFR-ACC-06, NFR-INT-04 |
| [US-ANN-08](#us-ann-08) | Browse and restore earlier versions | annotator | Must | FR-ANN-11 |
| [US-ANN-09](#us-ann-09) | Submit a completed task | annotator | Must | FR-ANN-14 |
| [US-ANN-10](#us-ann-10) | Correct a task returned for changes | annotator | Must | FR-ANN-16, FR-ANN-09, FR-NOTIF-01 |
| [US-ANN-11](#us-ann-11) | See my annotation rewards | annotator | Must | FR-ANN-17, FR-FIN-15, FR-FIN-09 |
| [US-ANN-12](#us-ann-12) | Lose access cleanly when unassigned or the project closes | annotator | Must | FR-ANN-07, FR-ANN-18 |
| [US-REV-01](#us-rev-01) | Claim a dataset from the review queue | reviewer | Must | FR-REV-01, FR-REV-02 |
| [US-REV-02](#us-rev-02) | Inspect files in the review workspace | reviewer | Must | FR-REV-03, FR-DS-13, FR-DS-14, FR-PROC-12 |
| [US-REV-03](#us-rev-03) | Decide per file with reason codes | reviewer | Must | FR-REV-04, FR-REV-06 |
| [US-REV-04](#us-rev-04) | Apply bulk decisions | reviewer | Must | FR-REV-05, NFR-PERF-06 |
| [US-REV-05](#us-rev-05) | Record checklist, scores and comments | reviewer | Must | FR-REV-07 |
| [US-REV-06](#us-rev-06) | Check the payable summary before finalizing | reviewer | Must | FR-REV-08, FR-FIN-03, FR-FIN-04 |
| [US-REV-07](#us-rev-07) | Approve a dataset and credit earnings exactly once | reviewer | Must | FR-REV-09, FR-REV-10, FR-REV-12, FR-FIN-03, NFR-INT-02, NFR-INT-03, FR-AUD-01 |
| [US-REV-08](#us-rev-08) | Partially approve a dataset | reviewer | Must | FR-REV-09, FR-REV-10, FR-FIN-05, FR-FIN-06 |
| [US-REV-09](#us-rev-09) | Reject a dataset or request changes | reviewer | Must | FR-REV-09, FR-REV-13, FR-REV-12 |
| [US-REV-10](#us-rev-10) | Pay only the differential for a labeled upgrade | reviewer | Must | FR-REV-04, FR-FIN-07 |
| [US-REV-11](#us-rev-11) | Release a review I cannot finish | reviewer | Must | FR-REV-11 |
| [US-REV-12](#us-rev-12) | See my review history | reviewer | Must | FR-REV-14, FR-ANN-17 |
| [US-REV-13](#us-rev-13) | Claim annotation tasks for review | reviewer | Must | FR-ANN-15 |
| [US-REV-14](#us-rev-14) | Compare versions and approve or return an annotation | reviewer | Must | FR-ANN-16, FR-ANN-17, FR-FIN-15 |
| [US-ADM-01](#us-adm-01) | Enrol and use MFA for admin access | admin | Must | FR-AUTH-08, FR-AUTH-09, FR-AUTH-10, SEC-05, SEC-14, SEC-02 |
| [US-ADM-02](#us-adm-02) | Work from an actionable admin dashboard | admin | Must | FR-ADM-07, FR-NOTIF-06, FR-PAY-13 |
| [US-ADM-03](#us-adm-03) | Find users and see their full picture | admin | Must | FR-ADM-01, FR-AUD-05 |
| [US-ADM-04](#us-adm-04) | Suspend, reactivate or sign out a user | admin | Must | FR-ADM-02, FR-ADM-04, SEC-21, FR-AUTH-05 |
| [US-ADM-05](#us-adm-05) | Grant annotator and reviewer roles | admin | Must | FR-ADM-03, FR-ADM-09, SEC-07 |
| [US-ADM-06](#us-adm-06) | Decide contributor verifications | admin | Must | FR-VER-03, FR-VER-04, FR-VER-07, FR-AUD-04 |
| [US-ADM-07](#us-adm-07) | Search all datasets | admin | Must | FR-ADM-05, FR-DS-03, FR-AUD-04 |
| [US-ADM-08](#us-adm-08) | Take down a dataset | admin | Must | FR-DS-12, FR-NOTIF-01, FR-AUD-01 |
| [US-ADM-09](#us-adm-09) | Handle takedown and privacy requests | admin | Must | FR-ADM-10 |
| [US-ADM-10](#us-adm-10) | Rescan a file after a scanner error | admin | Must | FR-PROC-04, NFR-AVL-05 |
| [US-ADM-11](#us-adm-11) | Review payout requests with risk flags | admin | Must | FR-PAY-07, FR-USER-05 |
| [US-ADM-12](#us-adm-12) | Approve payouts with dual control | admin | Must | FR-PAY-08, FR-PAY-13 |
| [US-ADM-13](#us-adm-13) | Reject, fail or cancel a payout | admin | Must | FR-PAY-09, FR-PAY-11, FR-PAY-13 |
| [US-ADM-14](#us-adm-14) | Record a manual payment | admin | Must | FR-PAY-10, FR-PAY-14, FR-AUD-04, FR-PAY-13 |
| [US-ADM-15](#us-adm-15) | Monitor finances, ledger and reconciliation | admin | Must | FR-FIN-14, FR-FIN-13, FR-FIN-10 |
| [US-ADM-16](#us-adm-16) | Create an annotation project and generate tasks | admin | Must | FR-ANN-01, FR-ANN-02, FR-ANN-03 |
| [US-ADM-17](#us-adm-17) | Assign, bulk-assign and unassign tasks | admin | Must | FR-ANN-05, FR-ANN-06, FR-ANN-07 |
| [US-ADM-18](#us-adm-18) | Monitor and close annotation projects | admin | Must | FR-ANN-04, FR-ANN-18 |
| [US-ADM-19](#us-adm-19) | Build a dataset export | admin | Must | FR-EXP-01, FR-EXP-02, FR-EXP-03, FR-EXP-07, NFR-INT-09, FR-AUD-01 |
| [US-ADM-20](#us-adm-20) | Download exports and review export history | admin | Must | FR-EXP-04, FR-EXP-05, FR-EXP-06, FR-AUD-04 |
| [US-ADM-21](#us-adm-21) | View operational and financial analytics | admin | Must | FR-ADM-06 |
| [US-ADM-22](#us-adm-22) | Run the support inbox | admin | Must | FR-MSG-01, FR-MSG-02, FR-MSG-06, FR-MSG-08, FR-NOTIF-04 |
| [US-ADM-23](#us-adm-23) | Process account deletion requests | admin | Must | FR-ADM-11, FR-USER-07 |
| [US-ADM-24](#us-adm-24) | Inspect and retry background jobs | admin | Should | FR-ADM-12, FR-NOTIF-03, NFR-INT-03 |
| [US-SUP-01](#us-sup-01) | Publish a new pricing version | super admin | Must | FR-FIN-01, FR-FIN-03 |
| [US-SUP-02](#us-sup-02) | Post a manual balance adjustment | super admin | Must | FR-FIN-12, FR-FIN-10 |
| [US-SUP-03](#us-sup-03) | Reverse a paid payout that bounced | super admin | Must | FR-PAY-12, FR-PAY-13 |
| [US-SUP-04](#us-sup-04) | Manage system settings | super admin | Must | FR-ADM-08, FR-FIN-08 |
| [US-SUP-05](#us-sup-05) | Switch maintenance mode | super admin | Must | FR-ADM-08, NFR-AVL-04, NFR-AVL-01 |
| [US-SUP-06](#us-sup-06) | Manage admin roles safely | super admin | Must | FR-ADM-03, FR-ADM-09, SEC-21, SEC-05 |
| [US-SUP-07](#us-sup-07) | Audit actions and security events | super admin | Must | FR-AUD-01, FR-AUD-02, FR-AUD-03, FR-AUD-05, NFR-OBS-05 |
| [US-SUP-08](#us-sup-08) | Publish a new Contributor Agreement version | super admin | Must | FR-USER-03, FR-ADM-08 |
| [US-SUP-09](#us-sup-09) | Access a quarantined file for investigation | super admin | Should | FR-PROC-03, FR-AUD-04, NFR-OBS-04 |
| [US-SUP-10](#us-sup-10) | Monitor platform health and alerts | super admin | Must | NFR-OBS-01, NFR-OBS-02, NFR-OBS-03, NFR-OBS-04, NFR-OBS-05, NFR-AVL-01, NFR-PERF-01 |
| [US-SUP-11](#us-sup-11) | Restore from backup within the recovery targets | super admin | Must | NFR-AVL-02, NFR-AVL-03, SEC-13, FR-FIN-13 |

## 2. Story count by role

| Role | Prefix | Stories | Must | Should |
|---|---|---:|---:|---:|
| Visitor (anonymous) | US-PUB | 8 | 8 | 0 |
| Contributor | US-CON | 26 | 25 | 1 |
| Annotator | US-ANN | 12 | 12 | 0 |
| Reviewer | US-REV | 14 | 14 | 0 |
| Administrator | US-ADM | 24 | 23 | 1 |
| Super admin | US-SUP | 11 | 10 | 1 |
| **Total** | | **95** | **92** | **3** |

## 3. Visitor (anonymous) stories (US-PUB)

### US-PUB-01

**Understand pricing, process and supported data types** · Priority: **Must**

> As a **visitor**, I want to see how DataHub works, the current per-GB rates and which file formats are accepted before I sign up, so that I can decide whether my data is worth contributing.

**Preconditions**
- None (anonymous).

**Main scenario**
1. Visitor opens `/`, then `/how-it-works`.
2. Visitor opens `/pricing`; the page calls `GET /public/pricing` and shows raw and labeled rates per GB with the definition 1 GB = 1,000,000,000 bytes.
3. Visitor opens `/data-types`; the page calls `GET /public/formats` and lists the allowed extensions and the per-file limit.
4. Visitor follows the "Create account" call to action to `/register`.

**Alternate scenarios**
- A1: The API returns 503 → the static Maintenance page is shown (see US-PUB-08).
- A2: A new pricing version becomes effective → the page shows the new rate from its `effective_from` instant without a deploy.

**Acceptance criteria**
- **AC1** — **Given** the seeded pricing rules (raw 1,000,000 and labeled 1,500,000 micros/GB), **when** the visitor opens `/pricing`, **then** the page shows "$1.00 per GB" (raw) and "$1.50 per GB" (labeled) and states 1 GB = 10⁹ bytes.
- **AC2** — **Given** a super_admin created a labeled rule of 2,000,000 micros effective 2026-12-01T00:00Z, **when** the visitor opens `/pricing` on 2026-11-30, **then** the labeled rate still shows $1.50.
- **AC3** — **Given** the visitor uses a 360 px wide phone, **when** any public page is loaded, **then** content is readable without horizontal scrolling and LCP is ≤ 2.5 s at p75 on the 10 Mbps / 100 ms profile.
- **AC4** — **Given** the formats endpoint, **when** `/data-types` is loaded, **then** PDF, DOCX, DOC, TXT, RTF, ODT, JPG/JPEG, PNG, TIFF, BMP, CSV, JSON, JSONL, XML, XLSX and ZIP are listed and executables/HTML/SVG are listed as not accepted.

| Trace | Value |
|---|---|
| API | `GET /public/pricing`, `GET /public/formats` |
| UI routes | `/`, `/how-it-works`, `/pricing`, `/data-types` |
| SRS requirements | FR-FIN-02, FR-UPL-02, NFR-ACC-05, NFR-PERF-04 |
| Associated tests (planned) | TC-FIN-002, TC-UPL-002, TC-ACC-005, TC-PERF-004 |

### US-PUB-02

**Register an account** · Priority: **Must**

> As a **visitor**, I want to register with my email, a password and a display name and accept the Terms and Privacy Policy, so that I get a DataHub account to start contributing.

**Preconditions**
- Visitor is not signed in.
- Current Terms of Service and Privacy Policy versions are published at `/legal/terms` and `/legal/privacy`.

**Main scenario**
1. Visitor opens `/register` and enters email, display name and password.
2. Visitor ticks acceptance of the current Terms and Privacy Policy versions and submits.
3. System validates the password (12–128 chars, not equal to the email, not in the 100,000 common-password list) and hashes it with Argon2id.
4. System creates the user (`pending_email`), assigns role `contributor`, creates the user wallet and queues a verification email.
5. System responds `202` and the UI shows "Check your inbox" at `/verify-email`; the visitor is not logged in (AM-14).

**Alternate scenarios**
- A1: Email already registered → same `202` and "check your inbox" UI; the existing owner receives an "account already exists" email.
- A2: Weak password → `422 validation_error` with field detail; the error is announced and linked to the field.
- A3: More than 5 registrations per hour from one IP → `429 rate_limited` with `Retry-After`.

**Acceptance criteria**
- **AC1** — **Given** a new email and password "correct horse battery 9", **when** the visitor submits the form with both policies accepted, **then** the API returns 202, a `users` row exists with status `pending_email`, role `contributor`, one wallet of kind `user`, and one `email_outbox` row of type verification.
- **AC2** — **Given** the email `sophea@example.com` is already registered, **when** a visitor registers with that email, **then** the response is byte-for-byte the same 202 body and the existing account receives an "account already exists" email instead of a verification email.
- **AC3** — **Given** the password "password1234" (in the common-password list), **when** the form is submitted, **then** the response is `422 validation_error` with `details[0].field = "password"` and no user row is created.
- **AC4** — **Given** 5 registrations from one IP in the last hour, **when** a 6th is attempted, **then** the response is `429 rate_limited` with a `Retry-After` header.

| Trace | Value |
|---|---|
| API | `POST /auth/register`, `GET /auth/csrf` |
| UI routes | `/register`, `/legal/terms`, `/legal/privacy` |
| SRS requirements | FR-AUTH-01, FR-AUTH-02, FR-FIN-09, SEC-01, SEC-06, NFR-ACC-04 |
| Associated tests (planned) | TC-AUTH-001, TC-AUTH-002, TC-FIN-009, TC-SEC-001, TC-SEC-006, TC-ACC-004 |

### US-PUB-03

**Verify my email address** · Priority: **Must**

> As a **visitor**, I want to confirm my email with the link I received, or request a new link, so that my account becomes active and I can continue to onboarding.

**Preconditions**
- An account in `pending_email` exists.
- A verification email was sent.

**Main scenario**
1. User clicks the link `/verify-email?token=…`.
2. The page calls `POST /auth/verify-email`; the system matches the SHA-256 of the token, checks it is unused and < 24 h old.
3. System sets `status = active` and `email_verified_at`, marks the token used and creates the "email verified" notification.
4. UI shows success and links to `/login` or, if already signed in, to `/onboarding`.

**Alternate scenarios**
- A1: Token expired or already used → error state with a "Send a new link" action.
- A2: User signed in with a limited `pending_email` session clicks "Resend" → `POST /auth/resend-verification` invalidates earlier tokens.
- A3: 4th resend within one hour → `429 rate_limited`.

**Acceptance criteria**
- **AC1** — **Given** a token issued 23 h 59 min ago and unused, **when** the link is opened, **then** the user status becomes `active`, `email_verified_at` is set and a second use of the same token fails.
- **AC2** — **Given** a token issued 24 h 1 min ago, **when** the link is opened, **then** verification fails, the user stays `pending_email` and the page offers a new link.
- **AC3** — **Given** a user who already requested 3 resends in the last hour, **when** a 4th resend is requested, **then** the response is `429 rate_limited` and no new token is created.
- **AC4** — **Given** a `pending_email` session, **when** the user calls `GET /datasets`, **then** the response is `403 email_not_verified` while `GET /auth/me` succeeds.

| Trace | Value |
|---|---|
| API | `POST /auth/verify-email`, `POST /auth/resend-verification`, `GET /auth/me` |
| UI routes | `/verify-email` |
| SRS requirements | FR-AUTH-03, FR-AUTH-04, FR-AUTH-05, FR-NOTIF-01 |
| Associated tests (planned) | TC-AUTH-003, TC-AUTH-004, TC-AUTH-005, TC-NOTIF-001 |

### US-PUB-04

**Sign in securely** · Priority: **Must**

> As a **visitor**, I want to sign in with my email and password and be told clearly when I cannot, so that I can reach my workspace while attackers cannot guess accounts or passwords.

**Preconditions**
- The account exists and is `active` (or `pending_email`).

**Main scenario**
1. User opens `/login` (optionally with `?next=`), enters credentials and submits.
2. System verifies the Argon2id hash, creates a `user_sessions` row with a 256-bit token (only its SHA-256 stored) and sets `dh_session` (HttpOnly, Secure, SameSite=Lax) and `dh_csrf`.
3. UI calls `GET /auth/me` and redirects to `next` or the role home (`/admin`, `/review`, `/annotate` or `/dashboard`).

**Alternate scenarios**
- A1: Unknown email or wrong password → `401 invalid_credentials` (same message and timing).
- A2: 5 consecutive failures in 15 min → `429 login_locked` with `Retry-After` for 15 min; security event written.
- A3: Suspended account → `403 account_suspended` with a link to `/help`.
- A4: Admin/super_admin → MFA step (US-ADM-01).
- A5: Session idle 7 days or older than 30 days → `401 session_expired` and redirect to `/login?next=…`.

**Acceptance criteria**
- **AC1** — **Given** an unknown email and a registered email with a wrong password, **when** each is submitted 100 times, **then** both return `401 invalid_credentials` and their p95 latency differs by ≤ 50 ms.
- **AC2** — **Given** 4 failed logins for one account in the last 10 min, **when** a 5th wrong password is submitted, **then** the response is `429 login_locked` with `Retry-After` ≈ 900 s, a security event is stored, and a correct password is also refused until the lock ends.
- **AC3** — **Given** a successful login, **when** the response cookies are inspected, **then** `dh_session` is `HttpOnly; Secure; SameSite=Lax; Path=/` and every later POST without `X-CSRF-Token` returns `403 csrf_failed`.
- **AC4** — **Given** a contributor session last seen 7 days and 1 minute ago, **when** any authenticated call is made, **then** the response is `401 session_expired`.

| Trace | Value |
|---|---|
| API | `POST /auth/login`, `GET /auth/me`, `GET /auth/csrf` |
| UI routes | `/login` |
| SRS requirements | FR-AUTH-05, FR-AUTH-06, FR-AUTH-07, FR-AUTH-10, FR-AUTH-14, SEC-02, SEC-03, SEC-04, SEC-12 |
| Associated tests (planned) | TC-AUTH-005, TC-AUTH-006, TC-AUTH-007, TC-AUTH-010, TC-AUTH-014, TC-SEC-002, TC-SEC-003, TC-SEC-004, TC-SEC-012 |

### US-PUB-05

**Reset a forgotten password** · Priority: **Must**

> As a **visitor**, I want to receive a reset link and choose a new password, so that I can regain access without contacting support.

**Preconditions**
- Visitor knows the account email.

**Main scenario**
1. Visitor opens `/forgot-password`, enters the email and submits.
2. System always answers `202`; if the account exists and is not anonymized it sends a single-use link valid for 1 h.
3. Visitor opens `/reset-password?token=…`, enters a new valid password and submits.
4. System sets the password, revokes all sessions, records a security event and sends a "password changed" email.
5. UI redirects to `/login` with a success message.

**Alternate scenarios**
- A1: Unknown email → identical `202`, no email.
- A2: Token older than 1 h or already used → error with "request a new link".
- A3: 4th request in one hour for the same email → `429 rate_limited`.

**Acceptance criteria**
- **AC1** — **Given** an existing account with 2 active sessions, **when** the reset completes, **then** both sessions return `401` on next use, a security event `password_reset` exists and a "password changed" email is queued.
- **AC2** — **Given** an unknown email, **when** forgot-password is submitted, **then** the response is 202 with the same body as for a known email and no outbox row is created.
- **AC3** — **Given** a reset token issued 61 minutes ago, **when** it is used, **then** the reset is refused and the old password still works.
- **AC4** — **Given** a reset email in Mailpit, **when** its content is inspected, **then** it has plain-text and HTML parts and contains no token other than the single-use link.

| Trace | Value |
|---|---|
| API | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| UI routes | `/forgot-password`, `/reset-password` |
| SRS requirements | FR-AUTH-12, FR-AUTH-02, FR-NOTIF-05 |
| Associated tests (planned) | TC-AUTH-012, TC-AUTH-002, TC-NOTIF-005 |

### US-PUB-06

**Contact DataHub or report infringing content** · Priority: **Must**

> As a **visitor**, I want to send a general, privacy or account question, or a takedown request for content I own, without an account, so that DataHub can help me or remove content that infringes my rights.

**Preconditions**
- None (anonymous).

**Main scenario**
1. Visitor opens `/help` and chooses a category: `general`, `takedown`, `privacy` or `account`.
2. Visitor enters name, email, message (≤ 5,000 chars) and, for takedown, the affected dataset reference.
3. System validates, rate-limits (5/h per IP) and stores the request; `takedown` and `privacy` create a `takedown_requests` row in status `open` and notify admins.
4. UI shows a confirmation with a reference number.

**Alternate scenarios**
- A1: Rights holders may use the dedicated `POST /public/takedown-requests` form (AM-04).
- A2: 6th submission within an hour from one IP → `429 rate_limited`.
- A3: Message longer than 5,000 chars → `422 validation_error`.

**Acceptance criteria**
- **AC1** — **Given** a takedown submission naming dataset DS-2026-000123, **when** it is sent, **then** a `takedown_requests` row with status `open` linked to that dataset exists and every holder of `user.manage` gets an in-app notification.
- **AC2** — **Given** a `general` submission, **when** it is sent, **then** no `takedown_requests` row is created and an email is queued to the support inbox.
- **AC3** — **Given** 5 submissions from one IP in the last hour, **when** a 6th is sent, **then** the response is `429 rate_limited` with `Retry-After`.

| Trace | Value |
|---|---|
| API | `POST /public/contact`, `POST /public/takedown-requests` |
| UI routes | `/help` |
| SRS requirements | FR-ADM-10, SEC-06, SEC-17 |
| Associated tests (planned) | TC-ADM-010, TC-SEC-006, TC-SEC-017 |

### US-PUB-07

**Use DataHub with keyboard, screen reader and Khmer text** · Priority: **Must**

> As a **visitor**, I want every page to be keyboard-operable, screen-reader friendly and to render Khmer correctly, so that I can use DataHub regardless of disability, device or language.

**Preconditions**
- Any page.

**Main scenario**
1. User navigates with Tab/Shift+Tab; a skip-to-content link is the first focus stop.
2. Dialogs trap focus and restore it on close.
3. Form errors are summarised at the top and linked to fields via `aria-describedby`.
4. Khmer content renders in self-hosted Noto Sans Khmer with `lang="km"` and line-height ≥ 1.6.

**Alternate scenarios**
- A1: User prefers reduced motion → animations are disabled.
- A2: Dark theme selected → contrast rules still hold.

**Acceptance criteria**
- **AC1** — **Given** any route in CI, **when** axe-core runs, **then** 0 serious or critical violations are reported.
- **AC2** — **Given** a Khmer title containing COENG (U+17D2) sequences, **when** it is displayed, **then** stacked subscripts are not clipped and the element carries `lang="km"`.
- **AC3** — **Given** a focused control in light and dark theme, **when** its focus ring is measured, **then** it is ≥ 2 px with contrast ≥ 3:1, and all text has contrast ≥ 4.5:1.
- **AC4** — **Given** the web source, **when** the i18n lint runs, **then** no hard-coded user-facing strings exist in components and dates are formatted with `Intl` in the browser timezone.

| Trace | Value |
|---|---|
| API | — (no API operation; verified by inspection/operations) |
| UI routes | `/`, `/login`, `/register`, `/datasets/new`, `/annotate/tasks/[id]/edit` |
| SRS requirements | NFR-ACC-01, NFR-ACC-02, NFR-ACC-03, NFR-ACC-04, NFR-ACC-06, NFR-ACC-07 |
| Associated tests (planned) | TC-ACC-001, TC-ACC-002, TC-ACC-003, TC-ACC-004, TC-ACC-006, TC-ACC-007 |

### US-PUB-08

**See a clear maintenance or error page** · Priority: **Must**

> As a **visitor**, I want a clear Maintenance, Not Found or Server Error page when something is unavailable, so that I know whether to retry and can quote a reference to support.

**Preconditions**
- The API returns 503 (maintenance or dependency failure), 404 or 5xx.

**Main scenario**
1. Web app receives 503 `service_unavailable` (e.g. `details.reason = "maintenance"`).
2. Web renders `/maintenance` with HTTP 503; Caddy serves static `maintenance.html` if the web container is down.
3. On 5xx the Server Error page shows the `request_id`; in-flight forms keep their content.

**Alternate scenarios**
- A1: Unknown or inaccessible resource → Not Found page (HTTP 404), never revealing that the resource exists.
- A2: Admin signs in during maintenance → `/auth/*` and `/admin/*` keep working (AM-06).

**Acceptance criteria**
- **AC1** — **Given** `maintenance_mode = true`, **when** a contributor calls `GET /datasets`, **then** the response is 503 `service_unavailable` with `details.reason = "maintenance"` and the UI shows `/maintenance`.
- **AC2** — **Given** `maintenance_mode = true`, **when** `GET /healthz`, `GET /readyz` and `POST /auth/login` are called, **then** they behave normally.
- **AC3** — **Given** an unexpected server exception, **when** the API responds, **then** the body is `{"error":{"code":"internal_error",…,"request_id"}}` with no stack trace, SQL, hostname or storage key, and `X-Request-ID` is set.
- **AC4** — **Given** PostgreSQL does not answer within 2 s, **when** `GET /readyz` is called, **then** it returns 503 while `GET /healthz` returns 200.

| Trace | Value |
|---|---|
| API | `GET /healthz`, `GET /readyz` |
| UI routes | `/maintenance`, `/access-denied` |
| SRS requirements | NFR-AVL-04, NFR-INT-06, NFR-INT-07, FR-ADM-08 |
| Associated tests (planned) | TC-AVL-004, TC-INT-006, TC-INT-007, TC-ADM-008 |

## 4. Contributor stories (US-CON)

### US-CON-01

**Complete onboarding and accept the Contributor Agreement** · Priority: **Must**

> As a **contributor**, I want to complete my profile, accept the Contributor Agreement and the rights declaration, so that I am allowed to create datasets and upload files.

**Preconditions**
- Email verified (`active`).
- Onboarding not completed.

**Main scenario**
1. After first login the user is routed to `/onboarding?step=profile`.
2. User fills display name, preferred language and optional legal details.
3. User reads and accepts the current Contributor Agreement version and the rights declaration (`step=agreement`, `step=rights`).
4. System stores an `agreement_acceptances` row (document type, version, accepted_at, IP, user agent) and sets `onboarding_completed_at`.
5. Optional `step=verification` links to US-CON-04; the user lands on `/dashboard`.

**Alternate scenarios**
- A1: User tries `/datasets/new` before finishing → API `403 onboarding_required`; UI redirects to the next onboarding step.
- A2: Super_admin publishes a new agreement version → at the next dataset creation, upload or submit the user gets `403 agreement_outdated` and a re-accept dialog; existing datasets and balances are untouched.

**Acceptance criteria**
- **AC1** — **Given** an active user without onboarding, **when** `POST /datasets` is called, **then** the response is `403 onboarding_required`.
- **AC2** — **Given** the user accepts agreement version CA-2026-10, **when** onboarding is submitted, **then** `agreement_acceptances` holds that version with IP and user agent and `GET /auth/me` returns `onboarding_completed = true`.
- **AC3** — **Given** `contributor_agreement_version` changed to CA-2027-01 and the user last accepted CA-2026-10, **when** the user initiates an upload, **then** the response is `403 agreement_outdated`; after re-accepting, the same call succeeds.
- **AC4** — **Given** a user with a dataset in `in_review` when the agreement changes, **when** the review is finalized, **then** earnings are credited normally.

| Trace | Value |
|---|---|
| API | `POST /me/onboarding`, `GET /auth/me`, `PATCH /me/profile` |
| UI routes | `/onboarding`, `/legal/contributor-agreement` |
| SRS requirements | FR-USER-02, FR-USER-03, FR-USER-01 |
| Associated tests (planned) | TC-USER-002, TC-USER-003, TC-USER-001 |

### US-CON-02

**Maintain my profile** · Priority: **Must**

> As a **contributor**, I want to update my display name, legal name, phone, country, date of birth and preferred language, so that my account details are correct for verification and payouts.

**Preconditions**
- Signed in.

**Main scenario**
1. User opens `/profile?tab=personal` (`GET /me/profile`).
2. User edits fields and saves (`PATCH /me/profile`).
3. System validates (display name 2–80, legal name ≤ 200, E.164 phone, ISO country, `en`/`km`) and stores text NFC-normalised.

**Alternate scenarios**
- A1: User is verified and changes legal name, DOB or country → UI warns first; on save `verification_status` returns to `pending` and a new verification row is created for re-review.
- A2: Invalid phone → `422 validation_error` on `phone`.

**Acceptance criteria**
- **AC1** — **Given** a display name of 1 character, **when** it is saved, **then** the response is `422 validation_error` for `display_name`.
- **AC2** — **Given** a verified contributor, **when** they change `legal_name`, **then** `verification_status` becomes `pending`, a new `contributor_verifications` row exists and payout requests return `422 verification_required` until approved.
- **AC3** — **Given** a name typed in decomposed Unicode, **when** it is saved and read back, **then** the stored value is NFC-normalised.
- **AC4** — **Given** a JSON body larger than 1 MB, **when** it is sent, **then** the response is `413 payload_too_large`.

| Trace | Value |
|---|---|
| API | `GET /me/profile`, `PATCH /me/profile` |
| UI routes | `/profile` |
| SRS requirements | FR-USER-01, FR-USER-08, NFR-INT-04, SEC-17 |
| Associated tests (planned) | TC-USER-001, TC-USER-008, TC-INT-004, TC-SEC-017 |

### US-CON-03

**Manage payout methods** · Priority: **Must**

> As a **contributor**, I want to add up to 5 payout methods (bank transfer, ABA Pay, Wise, PayPal, other), choose a default and remove unused ones, so that I can receive withdrawals the way I prefer.

**Preconditions**
- Signed in, active.

**Main scenario**
1. User opens `/profile?tab=payout-methods` and clicks "Add".
2. User selects a type and fills its fields; optionally marks it default.
3. System encrypts the details (AES-256-GCM), stores the method, writes a security event and emails an alert to the account address.
4. The list shows methods masked to the last 4 characters.

**Alternate scenarios**
- A1: 6th method → refused with a validation error.
- A2: Delete a method referenced by an open payout → `409 payout_method_in_use`.
- A3: Within 24 h after adding a method, any payout to it carries the flag `new_payout_method` for approvers.

**Acceptance criteria**
- **AC1** — **Given** a user with 5 methods, **when** a 6th is added, **then** the request is refused with `422 validation_error` and no row is created.
- **AC2** — **Given** an open (`requested`) payout using method M, **when** the user deletes M, **then** the response is `409 payout_method_in_use`.
- **AC3** — **Given** a new ABA Pay method, **when** it is saved, **then** the account number is stored encrypted, an email alert and a security event are created, and the API returns only the last 4 characters.
- **AC4** — **Given** a method added 3 hours ago, **when** a payout to it is requested, **then** the admin payout list shows the flag `new_payout_method`.

| Trace | Value |
|---|---|
| API | `GET /me/payout-methods`, `POST /me/payout-methods`, `DELETE /me/payout-methods/{id}` |
| UI routes | `/profile` |
| SRS requirements | FR-USER-04, FR-USER-05, SEC-14, FR-AUD-05 |
| Associated tests (planned) | TC-USER-004, TC-USER-005, TC-SEC-014, TC-AUD-005 |

### US-CON-04

**Submit and resubmit contributor verification** · Priority: **Must**

> As a **contributor**, I want to submit my legal identity, age, phone, a payout method and optionally an ID document for verification, so that I become eligible to withdraw earnings and to be assigned annotation work.

**Preconditions**
- Active account, onboarding completed, at least 1 payout method.

**Main scenario**
1. User opens `/profile?tab=verification` (or onboarding `step=verification`).
2. User enters legal name, country, date of birth and phone, selects a payout method and optionally uploads an ID document (JPEG/PNG/PDF ≤ 10 MB).
3. System checks age ≥ 18, creates a `pending` verification, sets `users.verification_status = pending` and notifies admins with `user.verify`.
4. The ID document is malware-scanned before any admin can view it.
5. User later sees the decision in-app and by email.

**Alternate scenarios**
- A1: No payout method → `422 verification_prerequisites`.
- A2: Under 18 on the submission date → `422 underage`.
- A3: Decision `needs_info` or `rejected` → user sees the reason (≥ 10 chars) and resubmits, creating a new `pending` row; earlier rows stay visible to admins.

**Acceptance criteria**
- **AC1** — **Given** a user born 2008-10-27, **when** they submit on 2026-10-26, **then** the response is `422 underage`.
- **AC2** — **Given** an active, onboarded user with no payout method, **when** they submit, **then** the response is `422 verification_prerequisites`.
- **AC3** — **Given** a verification with decision `needs_info` and reason "Please upload a clearer ID photo", **when** the user resubmits, **then** a new row with status `pending` exists, the previous row is kept, and `users.verification_status = pending`.
- **AC4** — **Given** an unverified contributor, **when** they start an upload, **then** the upload is allowed (verification gates only payouts and annotation).

| Trace | Value |
|---|---|
| API | `GET /me/verification`, `POST /me/verification` |
| UI routes | `/profile`, `/onboarding` |
| SRS requirements | FR-VER-01, FR-VER-02, FR-VER-05, FR-VER-06, FR-NOTIF-06 |
| Associated tests (planned) | TC-VER-001, TC-VER-002, TC-VER-005, TC-VER-006, TC-NOTIF-006 |

### US-CON-05

**Create and edit a dataset draft** · Priority: **Must**

> As a **contributor**, I want to create a dataset with title, description, languages, category, data class, provenance, licence, personal-data flag and tags, and edit it while it is a draft, so that reviewers and buyers understand what the data is and where it came from.

**Preconditions**
- Email verified, onboarding complete, current agreement accepted.

**Main scenario**
1. User opens `/datasets/new` and fills the metadata form (title 3–200, description ≤ 5,000, ≥ 1 language with `km` and `en` first, category, `raw`/`labeled`, provenance ≤ 2,000, licence, personal-data flag, ≤ 20 tags of ≤ 40 chars).
2. System creates the dataset in `draft` with a human code `DS-YYYY-NNNNNN`.
3. User is taken to `/datasets/[id]/upload`.
4. While `draft` or `changes_requested` the user may edit metadata or remove files.

**Alternate scenarios**
- A1: Editing or removing a file while `submitted`, `in_review` or finalized → `409 invalid_state`.
- A2: 21 tags → `422 validation_error`.

**Acceptance criteria**
- **AC1** — **Given** valid metadata, **when** `POST /datasets` is called, **then** a dataset with status `draft` and a code matching `DS-2026-\d{6}` is returned.
- **AC2** — **Given** a dataset in `submitted`, **when** `PATCH /datasets/{id}` is called, **then** the response is `409 invalid_state`.
- **AC3** — **Given** a dataset in `changes_requested`, **when** the user deletes one file, **then** the file is removed and the dataset stays `changes_requested`.
- **AC4** — **Given** a title of 2 characters, **when** the form is submitted, **then** the response is `422 validation_error` on `title` and the error is shown next to the field.

| Trace | Value |
|---|---|
| API | `POST /datasets`, `PATCH /datasets/{id}`, `DELETE /datasets/{id}/files/{file_id}` |
| UI routes | `/datasets/new`, `/datasets/[id]` |
| SRS requirements | FR-DS-01, FR-DS-04, FR-USER-02 |
| Associated tests (planned) | TC-DS-001, TC-DS-004, TC-USER-002 |

### US-CON-06

**Upload many files and folders with progress** · Priority: **Must**

> As a **contributor**, I want to drag and drop or select multiple files and folders and see per-file and overall progress, speed and ETA, so that I can upload large collections reliably from my browser.

**Preconditions**
- Owned dataset in `draft` or `changes_requested`.

**Main scenario**
1. User drops files/folders on `/datasets/[id]/upload`; relative paths are preserved where the browser supports directories.
2. For each file the client calls `POST /datasets/{id}/uploads`; the server returns `upload_id`, `part_size` (16 MiB, raised so parts ≤ 10,000), `part_count` and `expires_at` (+24 h).
3. Client requests presigned PUT URLs (≤ 100 per call, valid 15 min) and uploads up to 4 parts per file and 3 files in parallel directly to object storage.
4. Client calls `POST /uploads/{id}/complete`; the server verifies parts and size against `ListParts`, creates the `dataset_files` row (`uploaded`) and enqueues processing.
5. UI shows per-file and overall progress, speed, ETA and a completion confirmation.

**Alternate scenarios**
- A1: A part fails → retried up to 5 times with backoff 1, 2, 4, 8, 16 s, then the file shows "failed – retry".
- A2: Complete called with a missing part → `422 upload_incomplete` listing the missing parts; the client uploads them and completes again.
- A3: Complete repeated after success → the same file id is returned.

**Acceptance criteria**
- **AC1** — **Given** a 1.2 GB file, **when** the upload is initiated, **then** `part_size` is 16,777,216 bytes, `part_count` is 72 and `expires_at` is 24 h after now.
- **AC2** — **Given** all parts uploaded, **when** complete is called twice, **then** exactly one `dataset_files` row exists and both responses carry the same file id.
- **AC3** — **Given** a filename `../../etc/passwd.pdf`, **when** the upload completes, **then** the object key consists of server-generated UUIDs only and the name is stored only in `original_filename`.
- **AC4** — **Given** 50 concurrent multipart uploads, **when** API latency is measured, **then** non-file endpoints stay within p95 < 300 ms.

| Trace | Value |
|---|---|
| API | `POST /datasets/{id}/uploads`, `POST /uploads/{id}/part-urls`, `POST /uploads/{id}/complete` |
| UI routes | `/datasets/[id]/upload` |
| SRS requirements | FR-UPL-01, FR-UPL-03, FR-UPL-05, FR-UPL-08, FR-UPL-09, FR-UPL-10, SEC-09, SEC-16, NFR-UPL-01, NFR-UPL-04 |
| Associated tests (planned) | TC-UPL-001, TC-UPL-003, TC-UPL-005, TC-UPL-008, TC-UPL-009, TC-UPL-010, TC-SEC-009, TC-SEC-016, TC-UPLR-001, TC-UPLR-004 |

### US-CON-07

**Get clear rejection of uploads that break limits** · Priority: **Must**

> As a **contributor**, I want to be told before transferring bytes when a file is too big, of an unsupported type or over my quota, so that I do not waste bandwidth on files DataHub cannot accept.

**Preconditions**
- Owned dataset in `draft` or `changes_requested`.

**Main scenario**
1. User selects files; the client calls initiation for each.
2. Server checks the per-file limit (4,000,000,000 bytes, AM-01), extension allow-list, dataset limits (2,000 files, 50 GB), the 200 GB pending quota, filename length ≤ 255 and ≤ 20 non-terminal sessions.
3. Rejected files are listed with a human-readable reason; accepted files continue.

**Alternate scenarios**
- A1: 21st concurrent session → `429 too_many_uploads`; the client queues the file and retries when a slot frees.

**Acceptance criteria**
- **AC1** — **Given** a 4,000,000,001-byte file, **when** initiation is called, **then** the response is `413 file_too_large`.
- **AC2** — **Given** a file `setup.exe`, **when** initiation is called, **then** the response is `422 unsupported_type`.
- **AC3** — **Given** a dataset with 2,000 directly uploaded files, **when** another file is initiated, **then** the response is `422 dataset_limit_exceeded`.
- **AC4** — **Given** a user with 199.5 GB in draft/submitted/in_review/changes_requested datasets, **when** a 1 GB file is initiated, **then** the response is `422 quota_exceeded`.

| Trace | Value |
|---|---|
| API | `POST /datasets/{id}/uploads` |
| UI routes | `/datasets/[id]/upload` |
| SRS requirements | FR-UPL-02, FR-DS-07 |
| Associated tests (planned) | TC-UPL-002, TC-DS-007 |

### US-CON-08

**Resume or cancel an interrupted upload** · Priority: **Must**

> As a **contributor**, I want my upload to resume from where it stopped after a network drop, reload or browser restart, and to cancel uploads I no longer want, so that I never re-send bytes already stored and slow connections still succeed.

**Preconditions**
- Upload session not `completed`, `aborted` or `expired` (< 24 h old).

**Main scenario**
1. Client persists `{upload_id, name, size, lastModified}` in IndexedDB.
2. After reload the page offers "Resume"; the user re-selects the same file.
3. Client calls `GET /uploads/{id}`; parts from `ListParts` are skipped and only missing parts are uploaded.
4. Upload completes; the server-computed SHA-256 equals the source file's SHA-256.
5. User may cancel one or all in-flight files; the client calls `DELETE /uploads/{id}` and removes the row.

**Alternate scenarios**
- A1: Re-selected file differs in name, size or lastModified → resume refused; user may start a new upload.
- A2: Session older than 24 h → `uploads.expire_sessions` (every 15 min) set it `expired` and aborted it in storage; the user starts again.
- A3: Repeated part timeouts on a 1 Mbps link → concurrency drops to 1 part with a 10 min per-part timeout.

**Acceptance criteria**
- **AC1** — **Given** a 2 GB upload interrupted after 60 of 120 parts, **when** the user reloads and re-selects the file, **then** only parts 61–120 are sent and the resulting object's SHA-256 equals the source file's.
- **AC2** — **Given** an uploading session, **when** the user clicks Cancel, **then** `DELETE /uploads/{id}` sets it `aborted`, the multipart upload is aborted and the file disappears from the list.
- **AC3** — **Given** a session whose `expires_at` passed 1 minute ago, **when** the next `uploads.expire_sessions` run executes, **then** its status is `expired` and its multipart upload is aborted.
- **AC4** — **Given** a 5 GB fixture on a throttled 1 Mbps link with injected faults over a 7-day soak, **when** uploads are measured, **then** ≥ 99 % of non-cancelled sessions reach `completed`.

| Trace | Value |
|---|---|
| API | `GET /uploads/{id}`, `POST /uploads/{id}/part-urls`, `DELETE /uploads/{id}` |
| UI routes | `/datasets/[id]/upload` |
| SRS requirements | FR-UPL-04, FR-UPL-06, FR-UPL-07, FR-UPL-11, FR-UPL-12, NFR-UPL-02, NFR-UPL-03, NFR-UPL-05 |
| Associated tests (planned) | TC-UPL-004, TC-UPL-006, TC-UPL-007, TC-UPL-011, TC-UPL-012, TC-UPLR-002, TC-UPLR-003, TC-UPLR-005 |

### US-CON-09

**Follow file processing status** · Priority: **Must**

> As a **contributor**, I want to see each file's processing and scan status, failure reasons, page count and Khmer share, so that I know which files are ready and which need fixing before I submit.

**Preconditions**
- Files uploaded to an owned dataset.

**Main scenario**
1. User opens `/datasets/[id]?tab=files`.
2. The worker hashes (SHA-256), detects type by content, scans with ClamAV, extracts metadata (page count, characters, Khmer ratio) and generates previews.
3. List shows `processing_status`, `scan_status`, failure reason, size, MIME, SHA-256 and page count, updating in real time.
4. When every file is terminal the user receives "processing finished" with ready/failed/quarantined counts.

**Alternate scenarios**
- A1: Content does not match extension → `failed` with `type_mismatch`; macro-enabled Office, scripts, HTML, SVG → `failed` with `disallowed_type`.
- A2: Malware detected → `quarantined`, owner notified, file inaccessible to everyone except super_admin.
- A3: Scanner error after 3 retries → `failed` with `scan_error` (admin may rescan, US-ADM-10).
- A4: Preview exceeds 300 s, 200 MP or memory limit → file still `ready` with `preview_status = unavailable`.

**Acceptance criteria**
- **AC1** — **Given** a PNG renamed to `.pdf`, **when** processing runs, **then** the file ends `failed` with reason `type_mismatch`.
- **AC2** — **Given** the EICAR test file, **when** processing runs, **then** the file is `quarantined`, a security event exists, the owner gets a notification, and `GET /files/{id}` returns 404 for the owner.
- **AC3** — **Given** a dataset with 10 files: 8 clean, 1 type mismatch, 1 EICAR, **when** the last file becomes terminal, **then** exactly one "processing finished" notification is created showing 8 ready, 1 failed, 1 quarantined, even if a task is redelivered.
- **AC4** — **Given** a DOCX whose text is 70 % Khmer letters, **when** processing completes, **then** `khmer_ratio` ≈ 0.70 is shown on the file row.
- **AC5** — **Given** a 100 MB PDF and an empty queue, **when** upload completes, **then** the file reaches a terminal status within 120 s (p95).

| Trace | Value |
|---|---|
| API | `GET /datasets/{id}/files`, `GET /datasets/{id}` |
| UI routes | `/datasets/[id]` |
| SRS requirements | FR-DS-06, FR-PROC-01, FR-PROC-02, FR-PROC-03, FR-PROC-08, FR-PROC-09, FR-PROC-10, FR-PROC-13, NFR-PERF-02, SEC-11 |
| Associated tests (planned) | TC-DS-006, TC-PROC-001, TC-PROC-002, TC-PROC-003, TC-PROC-008, TC-PROC-009, TC-PROC-010, TC-PROC-013, TC-PERF-002, TC-SEC-011 |

### US-CON-10

**Preview and download my own files** · Priority: **Must**

> As a **contributor**, I want to preview page images, extracted text or table rows of my files and download originals, so that I can check what I uploaded without exposing it publicly.

**Preconditions**
- Owner of a dataset that is not `taken_down`.

**Main scenario**
1. User opens `/datasets/[id]?file=<fileId>`; the preview sheet requests `GET /files/{id}/preview/{page}` or `GET /files/{id}/text`.
2. System authorises the owner and returns a presigned GET valid for 5 minutes.
3. User clicks Download; `POST /files/{id}/download-url` returns a 5-minute URL with `Content-Disposition: attachment` and the sanitised filename.

**Alternate scenarios**
- A1: Dataset `taken_down` → 404 for the owner.
- A2: DOC file → "No preview available"; download still works.
- A3: URL older than 5 minutes → storage returns 403; UI requests a new URL.

**Acceptance criteria**
- **AC1** — **Given** a PDF of 12 pages, **when** the user previews page 3, **then** a raster image (long edge ≤ 2,000 px) is returned via a URL that expires 5 minutes after issuance.
- **AC2** — **Given** an uploaded `.txt` containing `<script>`, **when** it is previewed, **then** the text is rendered escaped and no script executes.
- **AC3** — **Given** a download URL, **when** its response headers are inspected, **then** `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` are present.

| Trace | Value |
|---|---|
| API | `GET /files/{id}`, `GET /files/{id}/preview/{page}`, `GET /files/{id}/text`, `POST /files/{id}/download-url` |
| UI routes | `/datasets/[id]` |
| SRS requirements | FR-DS-13, FR-DS-14, SEC-10, FR-PROC-08 |
| Associated tests (planned) | TC-DS-013, TC-DS-014, TC-SEC-010, TC-PROC-008 |

### US-CON-11

**Upload a ZIP archive safely** · Priority: **Should**

> As a **contributor**, I want to upload a ZIP and have its members expanded into individual files, so that I can contribute many small files at once.

**Preconditions**
- Owned dataset in `draft`/`changes_requested`; ZIP ≤ 4,000,000,000 bytes.

**Main scenario**
1. User uploads `scans.zip`; it is hashed and marked `skipped_container` (never scanned as a whole, never payable).
2. `processing.expand_archive` streams each member to a new private object and creates a child file keyed by `(parent_file_id, member_path)`.
3. Each member is processed and scanned like a normal file and does not count toward the 2,000-file limit.
4. The files tab groups members under their container.

**Alternate scenarios**
- A1: > 10,000 members, > 20 GB uncompressed or a member ratio > 100:1 → expansion stops, created members are deleted and the container is `failed` (`archive_limits_exceeded`).
- A2: Nested ZIP → member `failed` (`nested_archive`); encrypted member → `failed` (`encrypted_archive`).
- A3: Absolute paths, `..`, symlinks or device files → not extracted, logged `unsafe_member`.

**Acceptance criteria**
- **AC1** — **Given** a ZIP with 3 PDFs, **when** expansion completes, **then** 3 child files exist with relative paths, the container has `scan_status = skipped_container` and the estimate excludes the container bytes.
- **AC2** — **Given** a ZIP bomb with a member ratio of 1,000:1, **when** expansion runs, **then** the container is `failed` with `archive_limits_exceeded` and no member objects remain.
- **AC3** — **Given** a member named `../../evil.pdf`, **when** expansion runs, **then** it is not extracted and a log entry `unsafe_member` exists.
- **AC4** — **Given** expansion is redelivered after a worker crash, **when** it runs again, **then** no duplicate child rows are created.

| Trace | Value |
|---|---|
| API | `POST /datasets/{id}/uploads`, `GET /datasets/{id}/files` |
| UI routes | `/datasets/[id]/upload`, `/datasets/[id]` |
| SRS requirements | FR-PROC-05, FR-PROC-06, FR-PROC-07 |
| Associated tests (planned) | TC-PROC-005, TC-PROC-006, TC-PROC-007 |

### US-CON-12

**See duplicate warnings** · Priority: **Must**

> As a **contributor**, I want to see which of my files are exact or probable duplicates and whether they can earn, so that I understand in advance why some bytes will not be paid.

**Preconditions**
- Files processed.

**Main scenario**
1. `processing.detect_duplicates` compares SHA-256 against all other files.
2. Files tab shows flags: "already accepted elsewhere — will earn $0", "duplicate within this dataset" or "similar to another file" (near-duplicate with score).
3. The estimate excludes exact duplicates of previously accepted files.

**Alternate scenarios**
- A1: Duplicate only of a file in another non-finalized dataset → flag only, no effect on estimate.
- A2: Near-duplicate → informational flag; never blocks acceptance or payment.

**Acceptance criteria**
- **AC1** — **Given** a file whose SHA-256 equals a file accepted in 2026-09, **when** processing finishes, **then** a `dataset_duplicates` row of kind `exact` exists and the file is excluded from the estimate.
- **AC2** — **Given** two identical files in the same dataset that are both accepted, **when** the review is finalized, **then** only the earlier-created file earns; the other has `amount_micros = 0` and `ineligible_reason = duplicate_in_dataset`.
- **AC3** — **Given** a re-scanned image with a near-duplicate score of 0.93, **when** the files tab is viewed, **then** a "similar" flag is shown and the file is still counted in the estimate.

| Trace | Value |
|---|---|
| API | `GET /datasets/{id}/files`, `GET /datasets/{id}/estimate` |
| UI routes | `/datasets/[id]` |
| SRS requirements | FR-PROC-11, FR-PROC-12, FR-FIN-05, FR-FIN-06 |
| Associated tests (planned) | TC-PROC-011, TC-PROC-012, TC-FIN-005, TC-FIN-006 |

### US-CON-13

**See an earnings estimate before submitting** · Priority: **Must**

> As a **contributor**, I want to see an estimate of what my dataset could earn, so that I can decide whether to submit or improve it.

**Preconditions**
- Dataset with at least 1 `ready` file.

**Main scenario**
1. Dataset page calls `GET /datasets/{id}/estimate`.
2. System sums bytes of `ready`, `clean`, non-duplicate, non-container files, applies the current rate for the data class and floors per file.
3. UI shows the amount labelled "Estimate — final amount depends on review".

**Alternate scenarios**
- A1: Data class changed from raw to labeled → estimate recalculates at the labeled rate.

**Acceptance criteria**
- **AC1** — **Given** 2 ready files of 600,000,000 and 400,000,001 bytes in a raw dataset, **when** the estimate is requested, **then** it returns 600,000 + 400,000 = 1,000,000 micros ($1.00) and `estimate: true`.
- **AC2** — **Given** any estimate request, **when** the ledger is inspected, **then** no journal or wallet line was written.
- **AC3** — **Given** a dataset with a `failed` file of 1 GB, **when** the estimate is requested, **then** that file contributes 0.

| Trace | Value |
|---|---|
| API | `GET /datasets/{id}/estimate` |
| UI routes | `/datasets/[id]`, `/datasets/[id]/upload` |
| SRS requirements | FR-DS-10, FR-FIN-04 |
| Associated tests (planned) | TC-DS-010, TC-FIN-004 |

### US-CON-14

**Submit a dataset for review** · Priority: **Must**

> As a **contributor**, I want to submit my dataset after confirming the rights declaration, so that it enters the review queue and can earn.

**Preconditions**
- Dataset `draft` or `changes_requested`; every file terminal; ≥ 1 `ready` file; required metadata present.

**Main scenario**
1. User clicks Submit on `/datasets/[id]`; a dialog asks to confirm the per-dataset rights declaration and, if `contains_personal_data`, data-subject consent.
2. System checks preconditions, sets `submitted`, inserts an immutable `dataset_versions` row (n+1) and emits "dataset received" (in-app + email).
3. Dataset appears in the reviewer queue.

**Alternate scenarios**
- A1: A file still `processing` → `422 submit_preconditions_failed` with details listing unmet conditions.
- A2: Dataset in `in_review` → `409 invalid_state`.
- A3: Agreement outdated → `403 agreement_outdated`.

**Acceptance criteria**
- **AC1** — **Given** a draft with 10 ready files and confirmed declaration, **when** it is submitted, **then** status is `submitted`, `dataset_versions` has version 1 with the 10 file ids, and a "dataset received" notification exists.
- **AC2** — **Given** a draft with 1 file in `processing`, **when** it is submitted, **then** the response is `422 submit_preconditions_failed` with `details` naming the non-terminal file.
- **AC3** — **Given** `contains_personal_data = true` and consent not confirmed, **when** it is submitted, **then** the response is `422 submit_preconditions_failed`.

| Trace | Value |
|---|---|
| API | `POST /datasets/{id}/submit` |
| UI routes | `/datasets/[id]` |
| SRS requirements | FR-DS-08, FR-NOTIF-01 |
| Associated tests (planned) | TC-DS-008, TC-NOTIF-001 |

### US-CON-15

**Withdraw or delete a dataset** · Priority: **Must**

> As a **contributor**, I want to withdraw a dataset I no longer want reviewed, or delete a never-submitted draft, so that I keep control over what I offer.

**Preconditions**
- Owner of the dataset.

**Main scenario**
1. User chooses Withdraw (allowed in `draft`, `submitted`, `changes_requested`) and confirms; status becomes `withdrawn`.
2. Or user chooses Delete on a never-submitted draft; the dataset is soft-deleted and its objects are scheduled for purge after 30 days.

**Alternate scenarios**
- A1: Withdraw while `in_review` or finalized → `409 invalid_state`.
- A2: Delete a draft that was submitted before → refused (`409 invalid_state`).

**Acceptance criteria**
- **AC1** — **Given** a `submitted` dataset, **when** the owner withdraws it, **then** status becomes `withdrawn` and it leaves the review queue.
- **AC2** — **Given** an `in_review` dataset, **when** the owner withdraws it, **then** the response is `409 invalid_state`.
- **AC3** — **Given** a never-submitted draft, **when** it is deleted, **then** it disappears from `GET /datasets` and its objects are purged by `retention.purge` 30 days later.

| Trace | Value |
|---|---|
| API | `POST /datasets/{id}/withdraw`, `DELETE /datasets/{id}` |
| UI routes | `/datasets/[id]`, `/datasets` |
| SRS requirements | FR-DS-05, FR-DS-09 |
| Associated tests (planned) | TC-DS-005, TC-DS-009 |

### US-CON-16

**List my datasets privately** · Priority: **Must**

> As a **contributor**, I want to list, filter and sort my datasets and open their details, while nobody else can see them, so that I can manage my contributions and trust that they are private.

**Preconditions**
- Signed in.

**Main scenario**
1. User opens `/datasets`; the list calls `GET /datasets` with pagination (≤ 100 per page).
2. User filters by status and data class and sorts by created, updated or title.
3. User opens a dataset: metadata, status, current version, file counts per status, total/ready bytes, estimate and latest review summary.

**Alternate scenarios**
- A1: User opens another contributor's dataset id → Not Found page (API `404 not_found`).

**Acceptance criteria**
- **AC1** — **Given** contributor A with 3 datasets and contributor B with 5, **when** A calls `GET /datasets`, **then** exactly A's 3 datasets are returned.
- **AC2** — **Given** B's dataset id, **when** A calls `GET /datasets/{id}` and `GET /files/{file_id}` for one of its files, **then** both return `404 not_found`.
- **AC3** — **Given** `page_size=500`, **when** the list is requested, **then** at most 100 items are returned.
- **AC4** — **Given** year-1 data volume, **when** the slowest list query is EXPLAINed, **then** it executes in < 100 ms.

| Trace | Value |
|---|---|
| API | `GET /datasets`, `GET /datasets/{id}` |
| UI routes | `/datasets`, `/datasets/[id]`, `/dashboard` |
| SRS requirements | FR-DS-02, FR-DS-03, SEC-08, NFR-PERF-03 |
| Associated tests (planned) | TC-DS-002, TC-DS-003, TC-SEC-008, TC-PERF-003 |

### US-CON-17

**Read review feedback, including partial approvals** · Priority: **Must**

> As a **contributor**, I want to see the review decision, per-file decisions with reasons, quality scores, accepted and rejected bytes and the amount payable, so that I understand the outcome and can improve future contributions.

**Preconditions**
- A finalized review exists.

**Main scenario**
1. User receives an in-app notification and email (approved, partially approved, rejected or changes requested) including accepted bytes and payable amount.
2. User opens `/datasets/[id]?tab=feedback` (`GET /datasets/{id}/reviews`).
3. Page shows overall feedback, five quality scores (1–5) and their mean, per-file decision with reason code and comment, accepted/rejected bytes, payable micros and the pricing rule applied.
4. The reviewer is shown as "DataHub reviewer".

**Alternate scenarios**
- A1: Several reviews (after resubmission) → all are listed in `?tab=history`.

**Acceptance criteria**
- **AC1** — **Given** a `partially_approved` dataset with 7 accepted and 3 rejected files, **when** feedback is opened, **then** the 3 rejected files show reason codes (e.g. `blank_or_near_blank`) and the payable amount equals the sum of accepted eligible file earnings.
- **AC2** — **Given** any finalized review, **when** the response is inspected, **then** no reviewer name or id is present; the reviewer is "DataHub reviewer".
- **AC3** — **Given** finalization, **when** notifications are inspected, **then** the owner has one in-app notification and one email for the decision.

| Trace | Value |
|---|---|
| API | `GET /datasets/{id}/reviews` |
| UI routes | `/datasets/[id]`, `/notifications` |
| SRS requirements | FR-DS-11, FR-REV-12, FR-REV-06 |
| Associated tests (planned) | TC-DS-011, TC-REV-012, TC-REV-006 |

### US-CON-18

**Fix and resubmit after changes are requested** · Priority: **Must**

> As a **contributor**, I want to edit metadata and files after changes are requested and resubmit, so that my dataset gets another chance without losing its history.

**Preconditions**
- Dataset in `changes_requested`.

**Main scenario**
1. User reads the feedback (≥ 20 chars) on the dataset page.
2. User edits metadata, removes or uploads files.
3. User resubmits; a new version (n+1) and later a new review are created.
4. The next reviewer sees all earlier reviews and feedback.

**Alternate scenarios**
- A1: User withdraws instead → `withdrawn`.

**Acceptance criteria**
- **AC1** — **Given** a dataset at version 1 in `changes_requested`, **when** it is resubmitted, **then** status is `submitted` and `dataset_versions` has version 2.
- **AC2** — **Given** the resubmitted dataset is claimed, **when** the reviewer opens the workspace, **then** the earlier review with its feedback is visible in history.
- **AC3** — **Given** a `changes_requested` review, **when** the ledger is inspected, **then** no earning records or journals exist for that review.

| Trace | Value |
|---|---|
| API | `POST /datasets/{id}/submit`, `PATCH /datasets/{id}` |
| UI routes | `/datasets/[id]`, `/datasets/[id]/upload` |
| SRS requirements | FR-REV-13, FR-DS-08, FR-DS-04 |
| Associated tests (planned) | TC-REV-013, TC-DS-008, TC-DS-004 |

### US-CON-19

**See my wallet balances and transactions** · Priority: **Must**

> As a **contributor**, I want to see estimated, pending, available, reserved, paid, adjustment and lifetime amounts and every transaction with its source, so that I can trust that every cent is accounted for.

**Preconditions**
- Signed in.

**Main scenario**
1. User opens `/earnings?tab=summary` (`GET /wallet`).
2. Balances are shown as USD rounded down to cents, derived from integer micros.
3. User opens `?tab=transactions` (`GET /wallet/transactions`, filter by kind and date) and `GET /earnings` (per dataset and per annotation task, with the rule applied).
4. Each line links to its source dataset, task, payout or adjustment.

**Alternate scenarios**
- A1: `earning_hold_days > 0` → earnings show as pending with a release date; the hourly `finance.release_pending` job moves them to available.
- A2: No activity → empty state with a link to `/datasets/new`.

**Acceptance criteria**
- **AC1** — **Given** an earning of 1,234,567 micros, **when** the wallet is displayed, **then** it shows $1.23 (floored) and the API returns `1234567` as an integer.
- **AC2** — **Given** `earning_hold_days = 0` and a finalized approval, **when** the wallet is opened, **then** the amount is in `available` immediately.
- **AC3** — **Given** `earning_hold_days = 7` and finalization at 2026-11-01T10:00Z, **when** `finance.release_pending` runs at 2026-11-08T11:00Z, **then** an `earning_release` journal moves the amount to `available` exactly once.
- **AC4** — **Given** a transaction list, **when** timestamps are inspected, **then** the API returns ISO 8601 UTC with `Z` and the UI shows the browser timezone.

| Trace | Value |
|---|---|
| API | `GET /wallet`, `GET /wallet/transactions`, `GET /earnings` |
| UI routes | `/earnings`, `/dashboard` |
| SRS requirements | FR-FIN-11, FR-FIN-08, FR-FIN-10, FR-FIN-04, NFR-INT-01, NFR-INT-05 |
| Associated tests (planned) | TC-FIN-011, TC-FIN-008, TC-FIN-010, TC-FIN-004, TC-INT-001, TC-INT-005 |

### US-CON-20

**Request a withdrawal** · Priority: **Must**

> As a **contributor**, I want to request a payout of part or all of my available balance to one of my payout methods, so that I receive my earnings.

**Preconditions**
- Verified contributor, `active`, available ≥ $10, no open payout.

**Main scenario**
1. User opens `/withdrawals?request=1`, enters an amount in whole cents and selects a method.
2. Client sends `POST /payouts` with an `Idempotency-Key`.
3. System locks the wallet, validates the rules, creates a `requested` payout with a code `PO-YYYY-NNNNNN` and a `payout_reserve` journal (available → reserved) in one transaction, snapshotting the method details.
4. User and admins are notified ("withdrawal requested").

**Alternate scenarios**
- A1: Not verified → `422 verification_required` with a link to verification.
- A2: Amount < $10 or > $5,000 → `422 amount_below_minimum` / `amount_above_maximum`; fractions of a cent → `422 amount_not_whole_cents`.
- A3: Amount > available → `422 insufficient_balance`.
- A4: Open payout exists → `409 open_payout_exists`.
- A5: Network retry with the same key and body → original payout returned (200); same key with a different body → `409 idempotency_key_reused`.

**Acceptance criteria**
- **AC1** — **Given** available $25.00 and a verified user, **when** they request $25.00, **then** a `requested` payout and a `payout_reserve` journal exist and the wallet shows available $0.00, reserved $25.00.
- **AC2** — **Given** available $9.99, **when** they request $9.99, **then** the response is `422 amount_below_minimum`.
- **AC3** — **Given** available $100.00, **when** two requests of $60.00 are sent in parallel with different keys, **then** exactly one succeeds and the other returns `409 open_payout_exists`; reserved never exceeds $100.00.
- **AC4** — **Given** a successful request with key K, **when** the same body is replayed with key K, **then** the original payout is returned with 200 and no new journal exists.
- **AC5** — **Given** a requested payout to method M, **when** the user later edits or deletes M, **then** the payout still shows the original destination snapshot.

| Trace | Value |
|---|---|
| API | `POST /payouts`, `GET /me/payout-methods` |
| UI routes | `/withdrawals` |
| SRS requirements | FR-PAY-01, FR-PAY-02, FR-PAY-03, FR-PAY-04, FR-PAY-05, FR-VER-06 |
| Associated tests (planned) | TC-PAY-001, TC-PAY-002, TC-PAY-003, TC-PAY-004, TC-PAY-005, TC-VER-006 |

### US-CON-21

**Track or cancel my withdrawal** · Priority: **Must**

> As a **contributor**, I want to see my withdrawal's status timeline and cancel it while it is still only requested, so that I know when to expect money and can change my mind.

**Preconditions**
- A payout exists.

**Main scenario**
1. User opens `/withdrawals` and `/withdrawals/[id]`.
2. Timeline shows requested, approvals count (without approver identities), approved, paid (reference and date), or rejected/failed/cancelled/reversed with reason.
3. Each status change produces an in-app notification and email.
4. In `requested` the user may cancel: status `cancelled`, `payout_release` journal returns funds to available.

**Alternate scenarios**
- A1: Cancel in `approved` → `409 invalid_state` (only an admin can cancel).

**Acceptance criteria**
- **AC1** — **Given** a `requested` payout of $50, **when** the owner cancels it, **then** status is `cancelled` and available increases by $50 via `payout_release`.
- **AC2** — **Given** an `approved` payout, **when** the owner cancels it, **then** the response is `409 invalid_state`.
- **AC3** — **Given** a payout marked paid with reference "ABA-778812", **when** the owner views it, **then** it shows status Paid, the reference, paid date, and an email "payment recorded" was sent showing only the last 4 characters of the account.

| Trace | Value |
|---|---|
| API | `GET /payouts`, `GET /payouts/{id}`, `POST /payouts/{id}/cancel` |
| UI routes | `/withdrawals`, `/withdrawals/[id]` |
| SRS requirements | FR-PAY-06, FR-PAY-13 |
| Associated tests (planned) | TC-PAY-006, TC-PAY-013 |

### US-CON-22

**Message support about my dataset or payout** · Priority: **Must**

> As a **contributor**, I want to start a conversation with support, optionally linked to one of my datasets or payouts, with attachments, so that I can get help on a specific item.

**Preconditions**
- Signed in.

**Main scenario**
1. User opens `/messages`, clicks New, enters a subject (3–200 chars) and first message (1–5,000 chars) and optionally links a dataset or payout they own.
2. User attaches up to 5 files (PDF, JPEG, PNG, TXT, DOCX, ≤ 10 MB each); attachments stay hidden until scanned clean.
3. Support inbox holders are notified; the conversation is `open`.

**Alternate scenarios**
- A1: Linking another user's dataset → `422 validation_error` / `404`.
- A2: Infected attachment → rejected and the sender notified.
- A3: More than 30 messages per minute → `429 rate_limited`.

**Acceptance criteria**
- **AC1** — **Given** a message body `<img src=x onerror=alert(1)> see https://ex.com`, **when** it is displayed, **then** it is shown as escaped text with only the https URL auto-linked.
- **AC2** — **Given** an attachment still `pending_scan`, **when** the recipient views the thread, **then** the attachment is not downloadable.
- **AC3** — **Given** a clean attachment, **when** a participant requests its URL, **then** a presigned URL valid 5 minutes is returned; a non-participant gets 404.
- **AC4** — **Given** a 6th attachment on one message, **when** it is uploaded, **then** it is refused with `422 validation_error`.

| Trace | Value |
|---|---|
| API | `POST /conversations`, `POST /conversations/{id}/messages`, `POST /conversations/{id}/attachments`, `GET /attachments/{id}/download-url` |
| UI routes | `/messages` |
| SRS requirements | FR-MSG-01, FR-MSG-03, FR-MSG-05, SEC-18, SEC-15 |
| Associated tests (planned) | TC-MSG-001, TC-MSG-003, TC-MSG-005, TC-SEC-018, TC-SEC-015 |

### US-CON-23

**Read and reply to conversations in real time** · Priority: **Must**

> As a **contributor**, I want to see new replies instantly with unread counts and reply in the same thread, so that I can resolve issues quickly.

**Preconditions**
- A conversation exists.

**Main scenario**
1. User opens `/messages/[id]`; the client connects to `WS /api/v1/ws` (cookie-authenticated, origin-checked).
2. A support reply arrives as `message.created`; the thread updates without reload and the conversation shows `awaiting_user`.
3. Opening the thread calls `POST /conversations/{id}/read`; the unread badge clears.
4. User replies; status becomes `open`.

**Alternate scenarios**
- A1: WebSocket unavailable → client polls every 30 s.
- A2: Conversation was `closed` → user's reply reopens it to `open`.
- A3: Non-participant opens the URL → Not Found.

**Acceptance criteria**
- **AC1** — **Given** a connected client, **when** an admin posts a reply, **then** the user receives `message.created` within 2 s (p95).
- **AC2** — **Given** WebSocket blocked by a proxy, **when** an admin replies, **then** the reply appears within 30 s via polling.
- **AC3** — **Given** a `closed` conversation, **when** the contributor posts a message, **then** its status becomes `open`.
- **AC4** — **Given** 3 unread messages, **when** the thread is opened, **then** the unread count in the list becomes 0.

| Trace | Value |
|---|---|
| API | `GET /conversations`, `GET /conversations/{id}/messages`, `POST /conversations/{id}/read`, `GET /ws` |
| UI routes | `/messages`, `/messages/[id]` |
| SRS requirements | FR-MSG-02, FR-MSG-04, FR-MSG-06, FR-MSG-07, NFR-PERF-05 |
| Associated tests (planned) | TC-MSG-002, TC-MSG-004, TC-MSG-006, TC-MSG-007, TC-PERF-005 |

### US-CON-24

**Manage notifications and email preferences** · Priority: **Must**

> As a **contributor**, I want to see all my notifications, mark them read, and switch off non-essential email categories, so that I stay informed without being flooded.

**Preconditions**
- Signed in.

**Main scenario**
1. The header bell shows `GET /notifications/unread-count`; new items arrive via `notification.created`.
2. User opens `/notifications` (filter unread), marks one or all read.
3. User opens `/settings?tab=notifications` and toggles email for `datasets`, `annotation`, `messages`, `product_updates`.
4. Emails are queued through the transactional outbox and retried up to 5 times within 1 h.

**Alternate scenarios**
- A1: User tries to disable `security`, `account` or `financial` → toggles are locked.
- A2: SMTP down → outbox rows stay queued and are delivered when it recovers.

**Acceptance criteria**
- **AC1** — **Given** `datasets` email disabled, **when** a dataset is approved, **then** an in-app notification is created but no dataset email is queued.
- **AC2** — **Given** `financial` is mandatory, **when** a PATCH tries to disable it, **then** the request is refused with `422 validation_error`.
- **AC3** — **Given** another user's notification id, **when** `POST /notifications/{id}/read` is called, **then** the response is `404 not_found`.
- **AC4** — **Given** a non-mandatory email, **when** its headers are inspected, **then** it contains `List-Unsubscribe` and plain-text and HTML parts.
- **AC5** — **Given** SMTP failing 5 times, **when** the outbox row is inspected after 1 h, **then** its status is `failed` and visible to admins.

| Trace | Value |
|---|---|
| API | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `GET /me/notification-preferences`, `PATCH /me/notification-preferences` |
| UI routes | `/notifications`, `/settings` |
| SRS requirements | FR-NOTIF-01, FR-NOTIF-02, FR-NOTIF-03, FR-NOTIF-04, FR-NOTIF-05, FR-USER-06, NFR-AVL-05 |
| Associated tests (planned) | TC-NOTIF-001, TC-NOTIF-002, TC-NOTIF-003, TC-NOTIF-004, TC-NOTIF-005, TC-USER-006, TC-AVL-005 |

### US-CON-25

**Secure my account: sessions and password** · Priority: **Must**

> As a **contributor**, I want to see my active sessions, sign out of other devices and change my password, so that I can recover control if a device is lost.

**Preconditions**
- Signed in.

**Main scenario**
1. User opens `/settings?tab=security`; `GET /auth/sessions` lists sessions with created, last seen, IP, browser and a `current` flag.
2. User revokes one session or all others.
3. User changes password with the current password; all other sessions are revoked and a "password changed" email is sent.
4. User logs out; `dh_session` and `dh_csrf` are cleared.

**Alternate scenarios**
- A1: Wrong current password → `401 invalid_credentials` (or `422`), no change.
- A2: New password breaks policy → `422 validation_error`.

**Acceptance criteria**
- **AC1** — **Given** 3 sessions, **when** "Sign out other devices" is used, **then** only the current session remains active.
- **AC2** — **Given** a successful password change, **when** the other device makes a request, **then** it receives `401`.
- **AC3** — **Given** logout, **when** cookies are inspected, **then** `dh_session` and `dh_csrf` are cleared and the session row is revoked.
- **AC4** — **Given** Argon2id parameters were raised, **when** the user logs in, **then** the stored hash is upgraded to the new parameters.

| Trace | Value |
|---|---|
| API | `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `POST /auth/sessions/revoke-others`, `POST /auth/change-password`, `POST /auth/logout` |
| UI routes | `/settings` |
| SRS requirements | FR-AUTH-11, FR-AUTH-13, SEC-01, SEC-21 |
| Associated tests (planned) | TC-AUTH-011, TC-AUTH-013, TC-SEC-001, TC-SEC-021 |

### US-CON-26

**Request deletion of my account** · Priority: **Must**

> As a **contributor**, I want to request deletion of my account and personal data, so that I can exercise my privacy rights.

**Preconditions**
- Signed in; no open payout.

**Main scenario**
1. User opens `/settings?tab=privacy` and clicks "Delete my account"; a dialog explains what is erased and what is retained for 7 years.
2. System creates a `deletion_requests` row (`pending`).
3. An admin (or the daily job) processes it: the user becomes `deactivated` with all sessions revoked, then PII is anonymized.
4. Ledger, earning, payout and audit records are retained for 7 years.

**Alternate scenarios**
- A1: Open payout exists → `409 open_payout_exists`.
- A2: Request refused by admin with a reason → user is notified.

**Acceptance criteria**
- **AC1** — **Given** a `requested` payout, **when** deletion is requested, **then** the response is `409 open_payout_exists`.
- **AC2** — **Given** a processed deletion, **when** the user row is inspected, **then** email, names, phone, DOB, payout details and ID documents are erased or replaced and status is `anonymized`.
- **AC3** — **Given** a processed deletion, **when** ledger and audit tables are inspected, **then** all of the user's journals, earnings and payouts still exist.
- **AC4** — **Given** an anonymized account, **when** its old email requests a password reset, **then** no email is sent.

| Trace | Value |
|---|---|
| API | `POST /me/deletion-request` |
| UI routes | `/settings` |
| SRS requirements | FR-USER-07 |
| Associated tests (planned) | TC-USER-007 |

## 5. Annotator stories (US-ANN)

### US-ANN-01

**See my assigned annotation tasks** · Priority: **Must**

> As a **annotator**, I want to see my active and past tasks with status, project, deadline and progress, so that I know what to work on next.

**Preconditions**
- User holds `annotator`.

**Main scenario**
1. User opens `/annotate` (dashboard) and `/annotate/tasks` (`GET /annotation/my-tasks`).
2. Tasks show project, unit (file/page), status, deadline and an overdue badge.
3. User opens `/annotate/tasks/[id]` for details and instructions.

**Alternate scenarios**
- A1: Task reassigned to someone else → it moves to past assignments and its detail page returns Not Found.
- A2: No tasks → empty state explaining that admins assign work.

**Acceptance criteria**
- **AC1** — **Given** annotators X (3 tasks) and Y (2 tasks), **when** X calls `GET /annotation/my-tasks`, **then** exactly X's 3 assignments are returned.
- **AC2** — **Given** Y's task id, **when** X calls `GET /annotation/tasks/{id}`, **then** the response is `404 not_found`.
- **AC3** — **Given** a task whose deadline passed, **when** the list is viewed, **then** it shows an Overdue badge in text, not colour only.

| Trace | Value |
|---|---|
| API | `GET /annotation/my-tasks`, `GET /annotation/tasks/{id}` |
| UI routes | `/annotate`, `/annotate/tasks`, `/annotate/tasks/[id]` |
| SRS requirements | FR-ANN-08, SEC-08 |
| Associated tests (planned) | TC-ANN-008, TC-SEC-008 |

### US-ANN-02

**Get notified of assignments and deadlines** · Priority: **Must**

> As a **annotator**, I want to be notified when a task is assigned to me and 24 h before its deadline, so that I never miss work or a deadline.

**Preconditions**
- User is a verified, active annotator.

**Main scenario**
1. Admin assigns a task; the annotator receives "annotation assigned" in-app and by email.
2. 24 h before the project deadline the assignee receives a reminder.
3. Notification links open `/annotate/tasks/[id]`.

**Alternate scenarios**
- A1: Annotator not verified → assignment refused (`422 annotator_not_eligible`), so no notification.
- A2: Email category `annotation` disabled → in-app only.

**Acceptance criteria**
- **AC1** — **Given** a verified annotator, **when** a task is assigned, **then** one in-app notification and one outbox email of type annotation assigned exist.
- **AC2** — **Given** a deadline at 2026-11-10T12:00Z, **when** the reminder job runs at 2026-11-09T12:00Z, **then** each active assignee of an unfinished task receives exactly one reminder.
- **AC3** — **Given** an annotator whose verification is `pending`, **when** an admin assigns a task, **then** the response is `422 annotator_not_eligible`.

| Trace | Value |
|---|---|
| API | `GET /notifications` |
| UI routes | `/annotate`, `/notifications` |
| SRS requirements | FR-ANN-05, FR-ANN-18, FR-VER-06, FR-NOTIF-04 |
| Associated tests (planned) | TC-ANN-005, TC-ANN-018, TC-VER-006, TC-NOTIF-004 |

### US-ANN-03

**Start a task and read the instructions** · Priority: **Must**

> As a **annotator**, I want to read sanitised project instructions and start a task, so that I know the rules before I annotate.

**Preconditions**
- Task `assigned` to me.

**Main scenario**
1. User opens `/annotate/tasks/[id]`; instructions (Markdown) are rendered through an allow-list sanitiser.
2. User clicks Start; `POST /annotation/tasks/{id}/start` moves `assigned → in_progress`.
3. Editor opens at `/annotate/tasks/[id]/edit`.

**Alternate scenarios**
- A1: Task already `in_progress` → Start is replaced by Continue.

**Acceptance criteria**
- **AC1** — **Given** instructions containing `<script>` and `[link](javascript:alert(1))`, **when** they are rendered, **then** no script runs and the javascript link is removed.
- **AC2** — **Given** an `assigned` task, **when** Start is clicked, **then** status is `in_progress` and an audit row exists.
- **AC3** — **Given** a task assigned to another user, **when** Start is called, **then** the response is `404 not_found`.

| Trace | Value |
|---|---|
| API | `GET /annotation/tasks/{id}`, `POST /annotation/tasks/{id}/start` |
| UI routes | `/annotate/tasks/[id]` |
| SRS requirements | FR-ANN-09, SEC-18 |
| Associated tests (planned) | TC-ANN-009, TC-SEC-018 |

### US-ANN-04

**Annotate in the three-panel editor** · Priority: **Must**

> As a **annotator**, I want a three-panel editor with navigation and instructions, the page image with zoom/pan/rotate, and transcription, correction, metadata and label fields, so that I can annotate efficiently beside the source document.

**Preconditions**
- Task `in_progress` or `changes_requested`; screen ≥ 1024 px.

**Main scenario**
1. Left panel: page list, progress, instructions.
2. Centre: page image served by 5-minute presigned URLs with zoom 25–400 %, pan, fit-width/fit-page, 90° rotation.
3. Right: transcription, correction, metadata fields from the project schema, classification labels, notes and reviewer comments.
4. Undo/redo and documented keyboard shortcuts are available.

**Alternate scenarios**
- A1: Screen < 1024 px → advisory banner; read-only view remains.
- A2: Page preview unavailable → message with a download link for the source file.

**Acceptance criteria**
- **AC1** — **Given** a 20-page task, **when** the annotator presses the next-page shortcut, **then** page 2 loads and the URL updates to `?page=2`.
- **AC2** — **Given** zoom at 400 %, **when** zoom-in is pressed, **then** zoom stays at 400 %.
- **AC3** — **Given** a 900 px wide viewport, **when** the editor opens, **then** an advisory is shown and inputs are read-only.
- **AC4** — **Given** the annotator's active assignment, **when** the page image is requested, **then** it is authorised; a former assignee receives 404.

| Trace | Value |
|---|---|
| API | `GET /annotation/tasks/{id}`, `GET /files/{id}/preview/{page}` |
| UI routes | `/annotate/tasks/[id]/edit` |
| SRS requirements | FR-ANN-13, FR-DS-13, NFR-ACC-05 |
| Associated tests (planned) | TC-ANN-013, TC-DS-013, TC-ACC-005 |

### US-ANN-05

**Never lose work: autosave and draft recovery** · Priority: **Must**

> As a **annotator**, I want my work to autosave after 5 s idle and on blur, and to survive a lost connection or browser crash, so that I never lose annotation work.

**Preconditions**
- Task `in_progress` or `changes_requested`.

**Main scenario**
1. After 5 s without typing (or on blur) the client sends `PUT /annotation/tasks/{id}/draft` with `If-Match: <version>`.
2. Server validates against the schema, increments `annotations.version`, and stores an `annotation_versions` row when the content hash changed.
3. Indicator shows Saved / Saving… / Offline – changes kept locally / Conflict.
4. Unsaved edits are kept in local storage and offered for recovery when the editor reopens.

**Alternate scenarios**
- A1: Offline → edits queue locally; on reconnect they are saved with the last known version.
- A2: Saving a draft on a `changes_requested` task moves it to `in_progress`.
- A3: Invalid metadata value → `422 validation_error` with the field.

**Acceptance criteria**
- **AC1** — **Given** an annotator typing then pausing for 5 s, **when** the timer fires, **then** exactly one draft save is sent and the indicator shows Saved.
- **AC2** — **Given** network disconnected, **when** the annotator types, **then** the indicator shows "Offline – changes kept locally" and after reconnect the draft is saved without loss.
- **AC3** — **Given** a browser crash with unsaved edits, **when** the editor is reopened, **then** the user is offered to restore the local draft.
- **AC4** — **Given** two saves with identical content, **when** versions are listed, **then** only one new `annotation_versions` row exists.

| Trace | Value |
|---|---|
| API | `PUT /annotation/tasks/{id}/draft` |
| UI routes | `/annotate/tasks/[id]/edit` |
| SRS requirements | FR-ANN-10, FR-ANN-13, FR-ANN-11, FR-ANN-09 |
| Associated tests (planned) | TC-ANN-010, TC-ANN-013, TC-ANN-011, TC-ANN-009 |

### US-ANN-06

**Resolve an edit conflict** · Priority: **Must**

> As a **annotator**, I want to be warned when the server copy changed since I loaded it and choose which version to keep, so that two tabs or a reassignment never silently overwrite work.

**Preconditions**
- Draft open in two tabs or the server version advanced.

**Main scenario**
1. Client saves with `If-Match: 7` while the server is at version 8.
2. Server returns `409 version_conflict` with the server copy.
3. Editor shows a conflict dialog with both versions: "Keep mine" re-saves with `If-Match: 8`; "Use server" replaces the local text.

**Alternate scenarios**
- A1: User closes the dialog → indicator stays "Conflict" and autosave pauses until resolved.

**Acceptance criteria**
- **AC1** — **Given** version 8 on the server, **when** a save with `If-Match: 7` arrives, **then** the response is `409 version_conflict` including version 8 content and nothing is overwritten.
- **AC2** — **Given** the conflict dialog, **when** "Keep mine" is chosen, **then** the local text is saved as version 9.
- **AC3** — **Given** a save without `If-Match`, **when** it is sent, **then** the response is `400 precondition.required` (API catalogue code) and nothing is stored.

| Trace | Value |
|---|---|
| API | `PUT /annotation/tasks/{id}/draft` |
| UI routes | `/annotate/tasks/[id]/edit` |
| SRS requirements | FR-ANN-10 |
| Associated tests (planned) | TC-ANN-010 |

### US-ANN-07

**Transcribe Khmer text exactly as typed** · Priority: **Must**

> As a **annotator**, I want my Khmer transcription to be stored byte-for-byte, including COENG, ZWSP and ZWNJ/ZWJ, so that the dataset faithfully represents written Khmer.

**Preconditions**
- Project includes `transcription` or `text_correction`.

**Main scenario**
1. Annotator types Khmer in the transcription field (Noto Sans Khmer, `lang="km"`, line-height ≥ 1.6).
2. Draft is saved without NFC normalisation.
3. Reloading shows identical text.

**Alternate scenarios**
- A1: Other user text fields (titles, messages) are NFC-normalised as usual.

**Acceptance criteria**
- **AC1** — **Given** a string containing U+17D2 COENG sequences, U+200B ZWSP and U+200C ZWNJ, **when** it is saved and reloaded, **then** the returned bytes are identical to the submitted bytes.
- **AC2** — **Given** a decomposed sequence that NFC would change, **when** it is saved as transcription, **then** it is stored unchanged.
- **AC3** — **Given** an export with `annotation_text_form = both`, **when** it is built, **then** both verbatim and NFC forms are present.

| Trace | Value |
|---|---|
| API | `PUT /annotation/tasks/{id}/draft`, `GET /annotation/tasks/{id}` |
| UI routes | `/annotate/tasks/[id]/edit` |
| SRS requirements | FR-ANN-12, NFR-ACC-06, NFR-INT-04 |
| Associated tests (planned) | TC-ANN-012, TC-ACC-006, TC-INT-004 |

### US-ANN-08

**Browse and restore earlier versions** · Priority: **Must**

> As a **annotator**, I want to view my earlier draft and submitted versions and restore one into the draft, so that I can undo a mistake made several saves ago.

**Preconditions**
- Task with saved versions.

**Main scenario**
1. User opens the version panel (`GET /annotation/tasks/{id}/versions`).
2. User selects a version to view, then Restore.
3. The restored content becomes the new draft (new version number).

**Alternate scenarios**
- A1: More than 50 draft versions → the oldest drafts beyond 50 are pruned; submitted versions are always kept.

**Acceptance criteria**
- **AC1** — **Given** 55 draft saves and 1 submission, **when** versions are listed, **then** the latest 50 drafts and the submitted version are present.
- **AC2** — **Given** version 12 selected, **when** Restore is clicked, **then** the draft equals version 12's content at a new version number.
- **AC3** — **Given** a former assignee, **when** they request the versions list, **then** the response is `404 not_found`.

| Trace | Value |
|---|---|
| API | `GET /annotation/tasks/{id}/versions`, `PUT /annotation/tasks/{id}/draft` |
| UI routes | `/annotate/tasks/[id]/edit` |
| SRS requirements | FR-ANN-11 |
| Associated tests (planned) | TC-ANN-011 |

### US-ANN-09

**Submit a completed task** · Priority: **Must**

> As a **annotator**, I want to submit my task and be told exactly what is incomplete, so that it goes to review only when it is complete.

**Preconditions**
- Task `in_progress`.

**Main scenario**
1. User clicks Submit; `POST /annotation/tasks/{id}/submit`.
2. Server checks required metadata, labels within `label_set`, and that every page has non-empty transcription or is flagged unreadable.
3. Task becomes `submitted`, a submitted version is frozen, and it appears in `/annotate/submitted` and the reviewer queue.

**Alternate scenarios**
- A1: Missing transcription on page 4 → `422 validation_error` listing page 4; editor jumps to it.

**Acceptance criteria**
- **AC1** — **Given** a 5-page task with page 4 empty and not flagged unreadable, **when** it is submitted, **then** the response is `422 validation_error` naming page 4.
- **AC2** — **Given** a complete task, **when** it is submitted, **then** status is `submitted` and a submitted `annotation_versions` row exists.
- **AC3** — **Given** a submitted task, **when** the annotator tries to save a draft, **then** the response is `409 invalid_state`.

| Trace | Value |
|---|---|
| API | `POST /annotation/tasks/{id}/submit` |
| UI routes | `/annotate/tasks/[id]/edit`, `/annotate/submitted` |
| SRS requirements | FR-ANN-14 |
| Associated tests (planned) | TC-ANN-014 |

### US-ANN-10

**Correct a task returned for changes** · Priority: **Must**

> As a **annotator**, I want to read reviewer comments on a returned task, fix it and resubmit, so that my work gets approved and paid.

**Preconditions**
- Task `changes_requested`.

**Main scenario**
1. Annotator receives "annotation returned for correction" in-app and by email.
2. `/annotate/feedback` lists returned tasks with comments and score.
3. Annotator opens the editor; reviewer comments show in the right panel; the first save moves the task to `in_progress`.
4. Annotator resubmits.

**Alternate scenarios**
- A1: Project closed meanwhile → task `cancelled`, editor read-only.

**Acceptance criteria**
- **AC1** — **Given** a task returned with comment "Page 2 line 3 misses a COENG", **when** the annotator opens it, **then** the comment is visible beside the field.
- **AC2** — **Given** a `changes_requested` task, **when** a draft is saved, **then** status becomes `in_progress`.
- **AC3** — **Given** a resubmitted task, **when** it is reviewed, **then** the reviewer can diff the two submitted versions.

| Trace | Value |
|---|---|
| API | `GET /annotation/tasks/{id}`, `PUT /annotation/tasks/{id}/draft`, `POST /annotation/tasks/{id}/submit` |
| UI routes | `/annotate/feedback`, `/annotate/tasks/[id]/edit` |
| SRS requirements | FR-ANN-16, FR-ANN-09, FR-NOTIF-01 |
| Associated tests (planned) | TC-ANN-016, TC-ANN-009, TC-NOTIF-001 |

### US-ANN-11

**See my annotation rewards** · Priority: **Must**

> As a **annotator**, I want to see the reward for each approved task and its effect on my wallet, so that I know what I earned from annotation separately from dataset sales.

**Preconditions**
- Signed in as annotator.

**Main scenario**
1. User opens `/annotate/earnings` (`GET /annotation/my-rewards`).
2. Each approved task shows reward = per-task + per-page × pages, the approval date and the journal link.
3. The same wallet (`/earnings`) shows annotation rewards as journal kind `annotation_reward`.

**Alternate scenarios**
- A1: Hold days > 0 → rewards appear as pending until released (AM-02).

**Acceptance criteria**
- **AC1** — **Given** a project with 500,000 micros per task and 100,000 per page and a 6-page task, **when** the task is approved, **then** a reward of 1,100,000 micros ($1.10) is listed.
- **AC2** — **Given** an approved task, **when** the ledger is inspected, **then** the reward journal debits `system_annotation_labor`, not `system_dataset_purchases`.
- **AC3** — **Given** the approve request retried, **when** rewards are listed, **then** the task has exactly one reward.

| Trace | Value |
|---|---|
| API | `GET /annotation/my-rewards`, `GET /wallet`, `GET /earnings` |
| UI routes | `/annotate/earnings`, `/earnings` |
| SRS requirements | FR-ANN-17, FR-FIN-15, FR-FIN-09 |
| Associated tests (planned) | TC-ANN-017, TC-FIN-015, TC-FIN-009 |

### US-ANN-12

**Lose access cleanly when unassigned or the project closes** · Priority: **Must**

> As a **annotator**, I want to understand immediately when a task is taken away or a project closes, so that I do not waste effort on work that cannot be paid.

**Preconditions**
- Annotator with an active assignment.

**Main scenario**
1. Admin unassigns the task or closes the project.
2. The annotator's next request returns 404 (unassigned) or the task shows `cancelled` (closed); the editor becomes read-only with an explanation.
3. Saved versions are kept for the next assignee.

**Alternate scenarios**
- A1: Project closed after approval → approved tasks and rewards are unaffected.

**Acceptance criteria**
- **AC1** — **Given** an annotator editing task T, **when** an admin unassigns T, **then** the annotator's next draft save returns `404 not_found`.
- **AC2** — **Given** a project with 10 tasks, 4 approved, **when** it is closed, **then** the 6 non-approved tasks become `cancelled` and the 4 rewards remain.
- **AC3** — **Given** an unassigned task with 3 saved versions, **when** it is assigned to another annotator, **then** the new assignee sees the latest draft.

| Trace | Value |
|---|---|
| API | `GET /annotation/tasks/{id}` |
| UI routes | `/annotate/tasks`, `/annotate/tasks/[id]/edit` |
| SRS requirements | FR-ANN-07, FR-ANN-18 |
| Associated tests (planned) | TC-ANN-007, TC-ANN-018 |

## 6. Reviewer stories (US-REV)

### US-REV-01

**Claim a dataset from the review queue** · Priority: **Must**

> As a **reviewer**, I want to see submitted datasets oldest-first and claim one exclusively, so that no two reviewers work on the same dataset.

**Preconditions**
- User holds `reviewer` (or admin).

**Main scenario**
1. User opens `/review/datasets?tab=queue` (`GET /reviews/queue`): size, file counts, data class, languages, duplicate counts and owner verification status; no file content.
2. User clicks Claim; `POST /datasets/{id}/claim-review` atomically moves `submitted → in_review` and creates an `in_progress` review.
3. User is taken to `/review/datasets/[reviewId]`.

**Alternate scenarios**
- A1: Another reviewer claimed first → `409 already_claimed`; queue refreshes.
- A2: Own dataset → excluded from the queue; direct claim returns `403 self_review_forbidden`.

**Acceptance criteria**
- **AC1** — **Given** 10 parallel claim requests for one dataset, **when** they execute, **then** exactly 1 succeeds and 9 return `409 already_claimed`.
- **AC2** — **Given** a reviewer who owns dataset D, **when** the queue is listed, **then** D is not present, and claiming D returns `403 self_review_forbidden`.
- **AC3** — **Given** an unclaimed dataset, **when** the reviewer requests one of its file previews, **then** the response is `404 not_found`.

| Trace | Value |
|---|---|
| API | `GET /reviews/queue`, `POST /datasets/{id}/claim-review` |
| UI routes | `/review`, `/review/datasets` |
| SRS requirements | FR-REV-01, FR-REV-02 |
| Associated tests (planned) | TC-REV-001, TC-REV-002 |

### US-REV-02

**Inspect files in the review workspace** · Priority: **Must**

> As a **reviewer**, I want a workspace with metadata, file list, previews, processing/scan status, duplicate warnings and earlier reviews, so that I can judge each file quickly and fairly.

**Preconditions**
- Review `in_progress` assigned to me; screen ≥ 1280 px recommended.

**Main scenario**
1. Workspace loads `GET /reviews/{id}`.
2. Reviewer selects a file (`?file=&page=`); previews load via 5-minute presigned URLs.
3. Exact and near-duplicate warnings link to matched files.
4. Earlier reviews and feedback of this dataset are shown.

**Alternate scenarios**
- A1: After finalizing, the reviewer keeps read-only access to that review's files.
- A2: A non-assigned reviewer opening the URL → Not Found.

**Acceptance criteria**
- **AC1** — **Given** a review assigned to reviewer R, **when** reviewer Q opens it, **then** the response is `404 not_found`.
- **AC2** — **Given** a file that is an exact duplicate of an accepted file, **when** it is selected, **then** a warning links to the matched file and states it will earn $0.
- **AC3** — **Given** a dataset at version 2, **when** the workspace opens, **then** the version 1 review and its feedback are visible.

| Trace | Value |
|---|---|
| API | `GET /reviews/{id}`, `GET /files/{id}/preview/{page}`, `GET /files/{id}/text` |
| UI routes | `/review/datasets/[reviewId]` |
| SRS requirements | FR-REV-03, FR-DS-13, FR-DS-14, FR-PROC-12 |
| Associated tests (planned) | TC-REV-003, TC-DS-013, TC-DS-014, TC-PROC-012 |

### US-REV-03

**Decide per file with reason codes** · Priority: **Must**

> As a **reviewer**, I want to accept or reject each file with a reason code and comment, so that contributors learn exactly why files were rejected.

**Preconditions**
- Review `in_progress`.

**Main scenario**
1. Reviewer chooses Accept or Reject for a file (`PUT /reviews/{id}/files/{file_id}`).
2. Reject requires a reason code from `review_reason_codes` (e.g. `corrupted`, `blank_or_near_blank`, `duplicate`, `personal_data`, `wrong_language`, `other`).
3. Reason `other` requires a comment (≤ 2,000 chars).

**Alternate scenarios**
- A1: Accepting a `failed` or `quarantined` file → `422 file_not_eligible`.
- A2: Changing a decision before finalize overwrites the previous decision.

**Acceptance criteria**
- **AC1** — **Given** a `ready` file, **when** it is rejected without a reason code, **then** the response is `422 validation_error`.
- **AC2** — **Given** reason `other` and no comment, **when** the decision is saved, **then** the response is `422 validation_error` on `comment`.
- **AC3** — **Given** a `failed` file, **when** it is accepted, **then** the response is `422 file_not_eligible`.
- **AC4** — **Given** the default settings, **when** the reason list is loaded, **then** it contains the 12 seeded codes.

| Trace | Value |
|---|---|
| API | `PUT /reviews/{id}/files/{file_id}` |
| UI routes | `/review/datasets/[reviewId]` |
| SRS requirements | FR-REV-04, FR-REV-06 |
| Associated tests (planned) | TC-REV-004, TC-REV-006 |

### US-REV-04

**Apply bulk decisions** · Priority: **Must**

> As a **reviewer**, I want to accept or reject up to 2,000 selected files in one action, so that large datasets can be reviewed efficiently.

**Preconditions**
- Review `in_progress`.

**Main scenario**
1. Reviewer filters files (e.g. all `ready` PDFs) and selects them.
2. Reviewer applies Accept or Reject with reason and comment (`POST /reviews/{id}/files/bulk`).
3. All decisions are stored in one transaction.

**Alternate scenarios**
- A1: One selected file violates a rule → the whole batch is rejected with per-file details.

**Acceptance criteria**
- **AC1** — **Given** 2,000 `ready` files, **when** bulk accept is applied, **then** all 2,000 decisions are stored within 3 s.
- **AC2** — **Given** 1,999 `ready` files and 1 `failed` file, **when** bulk accept is applied, **then** no decision is stored and the response lists the failed file with `file_not_eligible`.

| Trace | Value |
|---|---|
| API | `POST /reviews/{id}/files/bulk` |
| UI routes | `/review/datasets/[reviewId]` |
| SRS requirements | FR-REV-05, NFR-PERF-06 |
| Associated tests (planned) | TC-REV-005, TC-PERF-006 |

### US-REV-05

**Record checklist, scores and comments** · Priority: **Must**

> As a **reviewer**, I want to answer the checklist, give 1–5 scores on five quality dimensions, add comments and correct the data class, so that dataset quality is measured consistently.

**Preconditions**
- Review `in_progress`.

**Main scenario**
1. Reviewer completes the checklist: rights plausibility, metadata accuracy, language match, personal-data check, legibility.
2. Reviewer scores legibility, completeness, relevance, metadata accuracy and language correctness (1–5).
3. Reviewer optionally changes `data_class`; `PATCH /reviews/{id}` saves.

**Alternate scenarios**
- A1: Score 0 or 6 → `422 validation_error`.

**Acceptance criteria**
- **AC1** — **Given** scores 4, 5, 3, 4, 5, **when** they are saved, **then** the overall score stored in `dataset_quality_scores` is 4.20.
- **AC2** — **Given** a score of 6, **when** it is saved, **then** the response is `422 validation_error`.
- **AC3** — **Given** `data_class` changed from labeled to raw, **when** the summary is requested, **then** payable micros use the raw rate.

| Trace | Value |
|---|---|
| API | `PATCH /reviews/{id}` |
| UI routes | `/review/datasets/[reviewId]` |
| SRS requirements | FR-REV-07 |
| Associated tests (planned) | TC-REV-007 |

### US-REV-06

**Check the payable summary before finalizing** · Priority: **Must**

> As a **reviewer**, I want a summary of accepted, rejected and undecided files and bytes, duplicate exclusions and the exact payable amount, so that I finalize knowing the financial consequence.

**Preconditions**
- Review `in_progress`.

**Main scenario**
1. Reviewer opens the summary (`GET /reviews/{id}/summary`).
2. Server computes eligible accepted bytes and payable micros per file with `floor(bytes × rate / 10⁹)` using the rule in force now.
3. Summary shows bytes excluded as exact duplicates and labeled-upgrade bytes.

**Alternate scenarios**
- A1: Undecided ready files exist → finalize (approve/partial/reject) is disabled with the count shown.

**Acceptance criteria**
- **AC1** — **Given** accepted files of 1,000,000,000 and 499,999,999 bytes in a labeled dataset, **when** the summary is requested, **then** payable is 1,500,000 + 749,999 = 2,249,999 micros.
- **AC2** — **Given** an accepted exact duplicate of 300 MB, **when** the summary is requested, **then** 300,000,000 bytes are reported as excluded and earn 0.
- **AC3** — **Given** 3 undecided ready files, **when** the summary is shown, **then** it reports 3 undecided and the Approve button is disabled.

| Trace | Value |
|---|---|
| API | `GET /reviews/{id}/summary` |
| UI routes | `/review/datasets/[reviewId]` |
| SRS requirements | FR-REV-08, FR-FIN-03, FR-FIN-04 |
| Associated tests (planned) | TC-REV-008, TC-FIN-003, TC-FIN-004 |

### US-REV-07

**Approve a dataset and credit earnings exactly once** · Priority: **Must**

> As a **reviewer**, I want to finalize an approval that credits the contributor exactly once even if I click twice or the network retries, so that contributors are paid correctly and the ledger never double-counts.

**Preconditions**
- Every `ready` file accepted.

**Main scenario**
1. Reviewer clicks Approve (feedback optional) and confirms; the client sends `POST /reviews/{id}/finalize` with an `Idempotency-Key`.
2. In one transaction: review `finalized`, dataset `approved`, one `earning_records` row per accepted file (rule id and rate stored), one `dataset_earning` journal keyed `dataset_review:{review_id}:earning` when total > 0.
3. Wallet `available` (or `pending` if hold days > 0) increases; owner notified "dataset approved" with bytes and amount.

**Alternate scenarios**
- A1: A ready file is rejected → `422 decision_inconsistent` for approve.
- A2: Double-click / retry → original result returned, no new records.
- A3: Same SHA-256 in another review finalizing concurrently → advisory lock serialises; only one earns (AM-03).

**Acceptance criteria**
- **AC1** — **Given** a review approving 2,000 files, **when** finalize runs, **then** it completes within 5 s and creates 2,000 earning rows and 1 journal.
- **AC2** — **Given** a successful finalize, **when** the same request is replayed 3 times and also sent concurrently, **then** exactly 1 journal and one set of earning records exist and every response equals the original.
- **AC3** — **Given** two datasets containing the same SHA-256 finalized concurrently, **when** both commit, **then** at most one positive `earning_records` row exists for that SHA-256 and tier.
- **AC4** — **Given** the finalize transaction, **when** audit logs are inspected, **then** transition rows for the review and dataset exist in the same transaction.

| Trace | Value |
|---|---|
| API | `POST /reviews/{id}/finalize` |
| UI routes | `/review/datasets/[reviewId]` |
| SRS requirements | FR-REV-09, FR-REV-10, FR-REV-12, FR-FIN-03, NFR-INT-02, NFR-INT-03, FR-AUD-01 |
| Associated tests (planned) | TC-REV-009, TC-REV-010, TC-REV-012, TC-FIN-003, TC-INT-002, TC-INT-003, TC-AUD-001 |

### US-REV-08

**Partially approve a dataset** · Priority: **Must**

> As a **reviewer**, I want to accept some files and reject others in one decision, so that contributors are paid for the good part of a mixed dataset.

**Preconditions**
- ≥ 1 accepted and ≥ 1 rejected ready file; every ready file decided.

**Main scenario**
1. Reviewer chooses Partial approval and writes feedback (required).
2. Finalize sets dataset `partially_approved`; earnings are created only for accepted eligible files; ineligible accepted files get `amount_micros = 0` with `ineligible_reason`.
3. Owner sees accepted and rejected bytes and the amount payable.

**Alternate scenarios**
- A1: All accepted → `422 decision_inconsistent` (use approve).
- A2: Missing feedback → `422 decision_inconsistent`.

**Acceptance criteria**
- **AC1** — **Given** 7 accepted and 3 rejected files, **when** partial is finalized with feedback, **then** dataset is `partially_approved` and 7 earning rows exist.
- **AC2** — **Given** 10 accepted, 0 rejected, **when** partial is requested, **then** the response is `422 decision_inconsistent`.
- **AC3** — **Given** two accepted files with equal SHA-256 in this review, **when** it is finalized, **then** only the earlier-created file earns; the other records `duplicate_in_dataset`.

| Trace | Value |
|---|---|
| API | `POST /reviews/{id}/finalize` |
| UI routes | `/review/datasets/[reviewId]` |
| SRS requirements | FR-REV-09, FR-REV-10, FR-FIN-05, FR-FIN-06 |
| Associated tests (planned) | TC-REV-009, TC-REV-010, TC-FIN-005, TC-FIN-006 |

### US-REV-09

**Reject a dataset or request changes** · Priority: **Must**

> As a **reviewer**, I want to reject a dataset or send it back for changes with written feedback, so that contributors can fix problems or understand why nothing was accepted.

**Preconditions**
- Review `in_progress`.

**Main scenario**
1. Reject: every ready file decided, 0 accepted, feedback required → dataset `rejected`, no earnings.
2. Request changes: feedback ≥ 20 chars → dataset `changes_requested`, no earnings; owner can edit and resubmit (US-CON-18).
3. Owner notified in-app and by email.

**Alternate scenarios**
- A1: Request changes with 19-char feedback → `422 decision_inconsistent`.

**Acceptance criteria**
- **AC1** — **Given** feedback of 19 characters, **when** request_changes is finalized, **then** the response is `422 decision_inconsistent`.
- **AC2** — **Given** a reject finalize, **when** the ledger is inspected, **then** no earning records or journals exist for the review.
- **AC3** — **Given** a request_changes finalize, **when** the owner opens the dataset, **then** status is `changes_requested` and Edit/Upload/Resubmit are enabled.

| Trace | Value |
|---|---|
| API | `POST /reviews/{id}/finalize` |
| UI routes | `/review/datasets/[reviewId]` |
| SRS requirements | FR-REV-09, FR-REV-13, FR-REV-12 |
| Associated tests (planned) | TC-REV-009, TC-REV-013, TC-REV-012 |

### US-REV-10

**Pay only the differential for a labeled upgrade** · Priority: **Must**

> As a **reviewer**, I want to mark a file in a labeled dataset as a labeled upgrade of raw data that was already paid, so that the contributor earns only the difference and the same content is never paid twice.

**Preconditions**
- Dataset `labeled`; file's SHA-256 previously paid at the raw rate; `labeled_upgrade_enabled = true`.

**Main scenario**
1. Reviewer sets `labeled_upgrade = true` on the file decision.
2. Summary shows the differential (labeled − previously paid rate).
3. Finalize creates an earning with tier `labeled_upgrade`.

**Alternate scenarios**
- A1: Dataset is raw or no prior raw payment → `labeled_upgrade` refused (`422 validation_error`).
- A2: SHA-256 already received an upgrade → earns 0.

**Acceptance criteria**
- **AC1** — **Given** a 2 GB file previously paid 2,000,000 micros at raw, **when** it is accepted with labeled_upgrade in a labeled dataset, **then** it earns 1,000,000 micros.
- **AC2** — **Given** the same SHA-256 upgraded once already, **when** it is upgraded again, **then** it earns 0 with an ineligible reason.
- **AC3** — **Given** `labeled_upgrade_enabled = false`, **when** a reviewer sets labeled_upgrade, **then** the file earns 0.

| Trace | Value |
|---|---|
| API | `PUT /reviews/{id}/files/{file_id}`, `GET /reviews/{id}/summary` |
| UI routes | `/review/datasets/[reviewId]` |
| SRS requirements | FR-REV-04, FR-FIN-07 |
| Associated tests (planned) | TC-REV-004, TC-FIN-007 |

### US-REV-11

**Release a review I cannot finish** · Priority: **Must**

> As a **reviewer**, I want to release my claim so another reviewer can take the dataset, so that datasets do not stall in my queue.

**Preconditions**
- Review `in_progress` assigned to me (admins may release any).

**Main scenario**
1. Reviewer clicks Release and confirms; `POST /reviews/{id}/release`.
2. Review becomes `released`; dataset returns to `submitted`.
3. Decisions of the released review stay read-only in history and are not carried over.

**Alternate scenarios**
- A1: Admin releases a stalled review (> 3 days) from `/admin/reviews`.

**Acceptance criteria**
- **AC1** — **Given** an in-progress review with 40 decisions, **when** it is released, **then** dataset is `submitted` and the next claim starts with 0 decisions.
- **AC2** — **Given** reviewer Q, **when** they release R's review, **then** the response is `404 not_found` (or `403 forbidden`).
- **AC3** — **Given** an admin, **when** they release any in-progress review, **then** it succeeds and is audit-logged.

| Trace | Value |
|---|---|
| API | `POST /reviews/{id}/release` |
| UI routes | `/review/datasets/[reviewId]`, `/admin/reviews` |
| SRS requirements | FR-REV-11 |
| Associated tests (planned) | TC-REV-011 |

### US-REV-12

**See my review history** · Priority: **Must**

> As a **reviewer**, I want to list my finalized and released dataset reviews and my annotation reviews, so that I can track my work and quality.

**Preconditions**
- Reviewer role.

**Main scenario**
1. User opens `/review/history?type=datasets` (`GET /reviews/history`) and `?type=annotations` (`GET /annotation/reviews/history`).
2. Admins may filter by reviewer.

**Alternate scenarios**
- A1: Non-admin passing another reviewer filter → ignored/forbidden.

**Acceptance criteria**
- **AC1** — **Given** reviewer R with 12 finalized and 2 released reviews, **when** history is listed, **then** 14 rows are returned.
- **AC2** — **Given** an admin, **when** they filter by reviewer R, **then** R's reviews are returned.
- **AC3** — **Given** reviewer Q, **when** they filter by reviewer R, **then** only Q's own reviews are returned or `403 forbidden`.

| Trace | Value |
|---|---|
| API | `GET /reviews/history`, `GET /annotation/reviews/history` |
| UI routes | `/review/history` |
| SRS requirements | FR-REV-14, FR-ANN-17 |
| Associated tests (planned) | TC-REV-014, TC-ANN-017 |

### US-REV-13

**Claim annotation tasks for review** · Priority: **Must**

> As a **reviewer**, I want to see submitted annotation tasks and claim one exclusively, so that each task is reviewed once by someone independent.

**Preconditions**
- User holds `reviewer` with `annotation.review`.

**Main scenario**
1. User opens `/review/annotations?tab=queue` (`GET /annotation/review-queue`).
2. User claims a task (`POST /annotation/tasks/{id}/claim-review`): `submitted → in_review`.

**Alternate scenarios**
- A1: Concurrent claim → `409 already_claimed`.
- A2: Reviewer was ever assigned the task → `403 self_review_forbidden`.

**Acceptance criteria**
- **AC1** — **Given** two reviewers claim the same task at once, **when** both requests complete, **then** one succeeds and the other gets `409 already_claimed`.
- **AC2** — **Given** a reviewer who once was the task's annotator, **when** they claim it, **then** the response is `403 self_review_forbidden`.

| Trace | Value |
|---|---|
| API | `GET /annotation/review-queue`, `POST /annotation/tasks/{id}/claim-review` |
| UI routes | `/review/annotations` |
| SRS requirements | FR-ANN-15 |
| Associated tests (planned) | TC-ANN-015 |

### US-REV-14

**Compare versions and approve or return an annotation** · Priority: **Must**

> As a **reviewer**, I want to see the source beside the annotation with a character diff, score it 1–5 and approve or request changes, so that only correct annotations are paid and exported.

**Preconditions**
- Task `in_review` claimed by me.

**Main scenario**
1. Reviewer opens `/review/annotations/[taskId]`; source pages and annotation side by side; `?compare=vA..vB` shows a character-level diff.
2. Approve: score 1–5; one transaction sets `approved`, inserts `annotation_reviews`, an `annotation_rewards` row and the `annotation_reward` journal keyed `annotation_review:{review_id}:reward`.
3. Request changes: comments required; task `changes_requested`; annotator notified.

**Alternate scenarios**
- A1: Approve retried → reward credited once (unique `annotation_review_id`).
- A2: Request changes without comments → `422 validation_error`.

**Acceptance criteria**
- **AC1** — **Given** a task with 6 pages, 500,000 per task and 100,000 per page, **when** it is approved, **then** the annotator's wallet gains 1,100,000 micros once and the journal kind is `annotation_reward`.
- **AC2** — **Given** request_changes without comments, **when** it is submitted, **then** the response is `422 validation_error`.
- **AC3** — **Given** two submitted versions, **when** they are compared, **then** inserted and deleted characters are highlighted, including Khmer combining marks.
- **AC4** — **Given** a reviewer who did not claim the task, **when** they post a review, **then** the response is `403`/`404`.

| Trace | Value |
|---|---|
| API | `GET /annotation/tasks/{id}`, `GET /annotation/tasks/{id}/versions`, `POST /annotation/tasks/{id}/review` |
| UI routes | `/review/annotations/[taskId]` |
| SRS requirements | FR-ANN-16, FR-ANN-17, FR-FIN-15 |
| Associated tests (planned) | TC-ANN-016, TC-ANN-017, TC-FIN-015 |

## 7. Administrator stories (US-ADM)

### US-ADM-01

**Enrol and use MFA for admin access** · Priority: **Must**

> As a **admin**, I want to enrol TOTP MFA with recovery codes and complete an MFA step at every admin sign-in and before sensitive actions, so that a stolen password alone cannot reach admin functions.

**Preconditions**
- User holds `admin` or `super_admin`; `ADMIN_MFA_REQUIRED = true`.

**Main scenario**
1. First login: correct password returns `{"mfa_required": true}`; the session has `mfa_verified_at = NULL`.
2. If not enrolled: `POST /auth/mfa/setup` returns an otpauth URI/QR and secret (stored encrypted); `POST /auth/mfa/enable` with a valid code returns 10 single-use recovery codes.
3. On later logins the admin enters a TOTP code (`/login?step=mfa`); `POST /auth/mfa/verify` sets `mfa_verified_at` and rotates the session token.
4. Finance and privileged actions require step-up: MFA verified within the last 15 minutes (AM-08).

**Alternate scenarios**
- A1: Any `/admin/*` call before MFA → `403 mfa_required`.
- A2: 5 failed MFA attempts → session revoked.
- A3: Lost device → a recovery code works once and triggers a security email.
- A4: Disabling MFA while holding an admin role → `409 mfa_required_for_role`.
- A5: Admin session idle 30 min or older than 12 h → `401 session_expired`.

**Acceptance criteria**
- **AC1** — **Given** an admin session without MFA verification, **when** `GET /admin/users` is called, **then** the response is `403 mfa_required`.
- **AC2** — **Given** a TOTP code already used in its 30 s window, **when** it is submitted again, **then** it is refused.
- **AC3** — **Given** 5 wrong MFA codes on one session, **when** a 6th attempt is made, **then** the session is revoked and a security event exists.
- **AC4** — **Given** an admin session last used 31 minutes ago, **when** an admin call is made, **then** the response is `401 session_expired`.
- **AC5** — **Given** MFA verified 16 minutes ago, **when** the admin approves a payout, **then** a step-up prompt is required before the action proceeds.

| Trace | Value |
|---|---|
| API | `POST /auth/login`, `POST /auth/mfa/setup`, `POST /auth/mfa/enable`, `POST /auth/mfa/verify`, `POST /auth/mfa/disable` |
| UI routes | `/login`, `/settings` |
| SRS requirements | FR-AUTH-08, FR-AUTH-09, FR-AUTH-10, SEC-05, SEC-14, SEC-02 |
| Associated tests (planned) | TC-AUTH-008, TC-AUTH-009, TC-AUTH-010, TC-SEC-005, TC-SEC-014, TC-SEC-002 |

### US-ADM-02

**Work from an actionable admin dashboard** · Priority: **Must**

> As a **admin**, I want a dashboard with counts of everything waiting for action and in-app alerts for new items, so that nothing waits unnoticed.

**Preconditions**
- MFA-verified admin session.

**Main scenario**
1. Admin opens `/admin`.
2. Cards show: verifications pending, datasets submitted, reviews in progress > 3 days, payouts requested and approved-unpaid, conversations awaiting admin, failed background jobs (24 h), latest reconciliation result.
3. Admins with the relevant permission receive in-app notifications for new verification submissions, payout requests and support conversations.
4. Each card links to the filtered list.

**Alternate scenarios**
- A1: Admin lacks `finance.read` → finance cards hidden.

**Acceptance criteria**
- **AC1** — **Given** 4 pending verifications and 2 requested payouts, **when** the dashboard loads, **then** the cards show 4 and 2 and link to `/admin/verifications?status=pending` and `/admin/payouts?status=requested`.
- **AC2** — **Given** a contributor requests a payout, **when** an admin with `payout.approve` is online, **then** a notification arrives in-app within 2 s (p95).
- **AC3** — **Given** a review claimed 3 days and 1 hour ago, **when** the dashboard loads, **then** it is counted under "reviews in progress > 3 days".

| Trace | Value |
|---|---|
| API | `GET /admin/finance/overview`, `GET /notifications` |
| UI routes | `/admin` |
| SRS requirements | FR-ADM-07, FR-NOTIF-06, FR-PAY-13 |
| Associated tests (planned) | TC-ADM-007, TC-NOTIF-006, TC-PAY-013 |

### US-ADM-03

**Find users and see their full picture** · Priority: **Must**

> As a **admin**, I want to search users by email or name and filter by role, status, verification status and registration date, and open a user's details, so that I can handle support and risk cases quickly.

**Preconditions**
- `user.read`.

**Main scenario**
1. Admin opens `/admin/users` (`GET /admin/users`, filters including `role` per AM-05).
2. Admin opens `/admin/users/[id]`: profile, roles, verification history, datasets, wallet summary, payouts, active sessions and recent audit events.

**Alternate scenarios**
- A1: Comma-separated status filter (`status=active,suspended`) returns both.

**Acceptance criteria**
- **AC1** — **Given** a search for "sophea", **when** it runs, **then** users whose email or name contains it are returned, paginated ≤ 100.
- **AC2** — **Given** `role=reviewer&status=active`, **when** it runs, **then** only active reviewers are returned.
- **AC3** — **Given** a user details page, **when** it loads, **then** payout account numbers are masked to the last 4 characters.

| Trace | Value |
|---|---|
| API | `GET /admin/users`, `GET /admin/users/{id}` |
| UI routes | `/admin/users`, `/admin/users/[id]` |
| SRS requirements | FR-ADM-01, FR-AUD-05 |
| Associated tests (planned) | TC-ADM-001, TC-AUD-005 |

### US-ADM-04

**Suspend, reactivate or sign out a user** · Priority: **Must**

> As a **admin**, I want to suspend a violating account with a reason, reactivate it later, or revoke all its sessions, so that abuse stops immediately.

**Preconditions**
- `user.manage`; step-up MFA.

**Main scenario**
1. Admin clicks Suspend on `/admin/users/[id]?tab=overview`, enters a reason ≥ 10 chars and confirms.
2. System sets `suspended`, revokes all sessions and blocks login, uploads, submissions, payout requests and annotation work; emails the user.
3. Reactivate restores `active` and emails the user.
4. "Revoke sessions" on the sessions tab signs the user out everywhere without suspending.

**Alternate scenarios**
- A1: Admin targets themself or a super_admin → refused.
- A2: Payout of a suspended recipient cannot be approved (`422 recipient_suspended`).

**Acceptance criteria**
- **AC1** — **Given** an active user with 2 sessions, **when** they are suspended, **then** both sessions return `401` immediately and login returns `403 account_suspended`.
- **AC2** — **Given** a suspended user, **when** they are reactivated, **then** login works and an email was sent.
- **AC3** — **Given** an admin, **when** they try to suspend a super_admin, **then** the request is refused with `403 forbidden`.
- **AC4** — **Given** a reason of 9 characters, **when** suspend is submitted, **then** the response is `422 validation_error`.

| Trace | Value |
|---|---|
| API | `POST /admin/users/{id}/suspend`, `POST /admin/users/{id}/reactivate`, `POST /admin/users/{id}/revoke-sessions` |
| UI routes | `/admin/users/[id]` |
| SRS requirements | FR-ADM-02, FR-ADM-04, SEC-21, FR-AUTH-05 |
| Associated tests (planned) | TC-ADM-002, TC-ADM-004, TC-SEC-021, TC-AUTH-005 |

### US-ADM-05

**Grant annotator and reviewer roles** · Priority: **Must**

> As a **admin**, I want to grant or revoke `annotator` and `reviewer` and see each role's permissions, so that I can staff annotation and review work.

**Preconditions**
- `user.manage`; step-up MFA.

**Main scenario**
1. Admin opens `/admin/users/[id]?tab=roles`; `GET /admin/roles` shows roles and permission codes.
2. Admin toggles annotator/reviewer and saves (`PUT /admin/users/{id}/roles`).
3. Permissions take effect on the user's next request.

**Alternate scenarios**
- A1: Admin edits their own roles → refused.
- A2: Admin tries to grant `admin` → requires `role.manage` (super_admin) → `403 forbidden`.

**Acceptance criteria**
- **AC1** — **Given** a contributor, **when** the admin grants `reviewer`, **then** the user's next `GET /reviews/queue` succeeds without re-login.
- **AC2** — **Given** an admin, **when** they grant `admin` to someone, **then** the response is `403 forbidden`.
- **AC3** — **Given** an admin, **when** they change their own roles, **then** the request is refused.
- **AC4** — **Given** any role change, **when** audit logs are inspected, **then** a row with before/after roles exists.

| Trace | Value |
|---|---|
| API | `PUT /admin/users/{id}/roles`, `GET /admin/roles` |
| UI routes | `/admin/users/[id]`, `/admin/settings` |
| SRS requirements | FR-ADM-03, FR-ADM-09, SEC-07 |
| Associated tests (planned) | TC-ADM-003, TC-ADM-009, TC-SEC-007 |

### US-ADM-06

**Decide contributor verifications** · Priority: **Must**

> As a **admin**, I want to review pending verifications oldest-first with duplicate-identity hints and the ID document, and approve, reject or ask for more information, so that only eligible adults can withdraw or annotate.

**Preconditions**
- `user.verify`; MFA session.

**Main scenario**
1. Admin opens `/admin/verifications?status=pending` (`GET /admin/verifications`).
2. Admin opens a case: submitted data, history, hints (same phone, or same legal name + DOB as another account).
3. Admin views the ID document via a 5-minute presigned URL (audit-logged).
4. Admin decides `approved`, `rejected` or `needs_info` (reason ≥ 10 chars for the latter two).
5. Decision is mirrored to `users.verification_status`; the user gets in-app + email.

**Alternate scenarios**
- A1: Admin opens their own verification → `403 self_action_forbidden` on decision.
- A2: ID document not yet scanned clean → not viewable.

**Acceptance criteria**
- **AC1** — **Given** two pending cases submitted 09:00 and 10:00, **when** the list loads, **then** the 09:00 case is first.
- **AC2** — **Given** an ID document view, **when** audit logs are inspected, **then** an entry with viewer, verification id and time exists.
- **AC3** — **Given** decision `rejected` with reason "blurry", **when** it is submitted, **then** the response is `422 validation_error` (reason < 10 chars).
- **AC4** — **Given** an approved decision, **when** the contributor requests a payout, **then** the verification gate passes.

| Trace | Value |
|---|---|
| API | `GET /admin/verifications`, `POST /admin/verifications/{id}/decision` |
| UI routes | `/admin/verifications` |
| SRS requirements | FR-VER-03, FR-VER-04, FR-VER-07, FR-AUD-04 |
| Associated tests (planned) | TC-VER-003, TC-VER-004, TC-VER-007, TC-AUD-004 |

### US-ADM-07

**Search all datasets** · Priority: **Must**

> As a **admin**, I want to search every dataset by text and filter by status, class, language, category, quality, owner and dates, so that I can find data for operations, takedowns and exports.

**Preconditions**
- `dataset.read.any`.

**Main scenario**
1. Admin opens `/admin/datasets` (`GET /admin/datasets?q=…`).
2. Admin opens `/admin/datasets/[id]` with files, reviews, earnings, duplicates and activity tabs.
3. Admin may open `/admin/reviews` to see submitted and in-review datasets.

**Alternate scenarios**
- A1: Admin views files of any dataset → each download is audit-logged.

**Acceptance criteria**
- **AC1** — **Given** `q=khmer newspaper&status=approved&min_quality=4`, **when** the search runs, **then** only approved datasets with quality ≥ 4 matching the text are returned.
- **AC2** — **Given** an admin download of a contributor's file, **when** audit logs are inspected, **then** a non-owner file access entry exists.
- **AC3** — **Given** a dataset id, **when** the details page loads, **then** its human code `DS-YYYY-NNNNNN` is shown and the URL uses the UUID.

| Trace | Value |
|---|---|
| API | `GET /admin/datasets`, `GET /admin/datasets/{id}` |
| UI routes | `/admin/datasets`, `/admin/datasets/[id]`, `/admin/reviews` |
| SRS requirements | FR-ADM-05, FR-DS-03, FR-AUD-04 |
| Associated tests (planned) | TC-ADM-005, TC-DS-003, TC-AUD-004 |

### US-ADM-08

**Take down a dataset** · Priority: **Must**

> As a **admin**, I want to take down any dataset with a mandatory reason, so that infringing or unlawful content stops being used immediately.

**Preconditions**
- Admin or super_admin; step-up MFA.

**Main scenario**
1. Admin clicks Take down on `/admin/datasets/[id]` and enters a reason.
2. In one transaction: status `taken_down`, active review released, non-approved annotation tasks from it cancelled, linked takedown request `actioned`, owner notified (in-app + email).
3. Dataset is excluded from new projects and exports; non-admin file access returns 404.

**Alternate scenarios**
- A1: Earnings already posted are not reversed automatically; a super_admin may post an adjustment (US-SUP-02).

**Acceptance criteria**
- **AC1** — **Given** an approved dataset used by an annotation project, **when** it is taken down, **then** non-approved tasks from it are `cancelled` and approved tasks remain.
- **AC2** — **Given** a taken-down dataset, **when** its owner requests a file preview, **then** the response is `404 not_found`.
- **AC3** — **Given** a taken-down dataset, **when** an export selects it by id, **then** it is excluded.
- **AC4** — **Given** a takedown, **when** the owner's notifications are inspected, **then** a "dataset taken down" notification and email exist.

| Trace | Value |
|---|---|
| API | `POST /admin/datasets/{id}/takedown` |
| UI routes | `/admin/datasets/[id]` |
| SRS requirements | FR-DS-12, FR-NOTIF-01, FR-AUD-01 |
| Associated tests (planned) | TC-DS-012, TC-NOTIF-001, TC-AUD-001 |

### US-ADM-09

**Handle takedown and privacy requests** · Priority: **Must**

> As a **admin**, I want to triage takedown and privacy requests through `open → investigating → actioned | dismissed`, so that rights holders and data subjects get a tracked response.

**Preconditions**
- `user.manage`.

**Main scenario**
1. Admin opens the takedown request list (`GET /admin/takedown-requests`).
2. Admin sets `investigating`, inspects the linked dataset, then either takes it down (US-ADM-08) → `actioned`, or dismisses with a reason.
3. Requester receives an email with the outcome.

**Alternate scenarios**
- A1: `actioned` without a performed takedown → refused.

**Acceptance criteria**
- **AC1** — **Given** an open request, **when** the admin marks it investigating, **then** status is `investigating` and an audit row exists.
- **AC2** — **Given** a request linked to dataset D, **when** D is taken down, **then** the request becomes `actioned`.
- **AC3** — **Given** a request without takedown, **when** the admin sets `actioned`, **then** the request is refused.

| Trace | Value |
|---|---|
| API | `GET /admin/takedown-requests`, `POST /admin/takedown-requests/{id}/decision`, `POST /public/takedown-requests` |
| UI routes | `/admin/datasets/[id]`, `/admin/messages` |
| SRS requirements | FR-ADM-10 |
| Associated tests (planned) | TC-ADM-010 |

### US-ADM-10

**Rescan a file after a scanner error** · Priority: **Must**

> As a **admin**, I want to re-run malware scanning on files that failed with `scan_error`, so that files are not lost because ClamAV was temporarily unavailable.

**Preconditions**
- File `failed` with `scan_error`; admin.

**Main scenario**
1. Admin opens the file on `/admin/datasets/[id]?tab=files` and clicks Rescan (`POST /admin/files/{id}/rescan`).
2. Worker rescans; on `clean` the file continues to `ready`.

**Alternate scenarios**
- A1: File not in `scan_error` → `409 invalid_state`.
- A2: Rescan finds malware → `quarantined`.

**Acceptance criteria**
- **AC1** — **Given** a `scan_error` file and a healthy clamd, **when** rescan is triggered, **then** the file becomes `ready` with `scan_status = clean`.
- **AC2** — **Given** ClamAV down during processing, **when** files are uploaded, **then** they stay `processing` and none becomes `ready` until clamd returns.
- **AC3** — **Given** a `ready` file, **when** rescan is called, **then** the response is `409 invalid_state`.

| Trace | Value |
|---|---|
| API | `POST /admin/files/{id}/rescan` |
| UI routes | `/admin/datasets/[id]` |
| SRS requirements | FR-PROC-04, NFR-AVL-05 |
| Associated tests (planned) | TC-PROC-004, TC-AVL-005 |

### US-ADM-11

**Review payout requests with risk flags** · Priority: **Must**

> As a **admin**, I want to list payouts by status, amount, method type, user and date with risk flags, so that I pay attention to risky withdrawals first.

**Preconditions**
- `finance.read`; MFA session.

**Main scenario**
1. Admin opens `/admin/payouts?status=requested` (`GET /admin/payouts`).
2. Flags: `new_payout_method` (method added < 24 h), `first_payout`, `requires_dual_approval` (≥ $100), `recipient_verification_changed`.
3. Admin opens `/admin/payouts/[id]` with the method snapshot, wallet summary and history.

**Alternate scenarios**
- A1: Filter `user_id` (AM-05) shows one user's payouts.

**Acceptance criteria**
- **AC1** — **Given** a $150 payout to a method added 2 h ago by a first-time requester, **when** it is listed, **then** flags `new_payout_method`, `first_payout` and `requires_dual_approval` are shown.
- **AC2** — **Given** `status=requested,approved`, **when** the list is requested, **then** both statuses are returned.
- **AC3** — **Given** a payout details page, **when** it loads, **then** the account number is masked except in the destination snapshot visible to `payout.record_payment` holders.

| Trace | Value |
|---|---|
| API | `GET /admin/payouts`, `GET /admin/payouts/{id}` |
| UI routes | `/admin/payouts`, `/admin/payouts/[id]` |
| SRS requirements | FR-PAY-07, FR-USER-05 |
| Associated tests (planned) | TC-PAY-007, TC-USER-005 |

### US-ADM-12

**Approve payouts with dual control** · Priority: **Must**

> As a **admin**, I want to approve payouts, with a second different admin required at or above the threshold, so that large withdrawals cannot be approved by one person.

**Preconditions**
- `payout.approve`; step-up MFA; payout `requested`.

**Main scenario**
1. Admin clicks Approve on `/admin/payouts/[id]` and confirms.
2. Amount < `payout_dual_approval_threshold_micros` (default $100) → status `approved`.
3. Otherwise the first approval keeps `requested` with `approvals_count = 1`; a second, different admin's approval sets `approved`.
4. Recipient notified ("withdrawal approved").

**Alternate scenarios**
- A1: Approver is the recipient → `403 self_action_forbidden`.
- A2: Same admin approves twice → `409 already_approved`.
- A3: Recipient suspended → `422 recipient_suspended`.

**Acceptance criteria**
- **AC1** — **Given** a $99.99 payout, **when** one admin approves, **then** status is `approved`.
- **AC2** — **Given** a $100.00 payout, **when** admin A approves, **then** status stays `requested` with `approvals_count = 1`.
- **AC3** — **Given** A approved a $100.00 payout, **when** A approves again, **then** the response is `409 already_approved`; when B approves, status becomes `approved`.
- **AC4** — **Given** an admin who requested their own payout, **when** they approve it, **then** the response is `403 self_action_forbidden`.

| Trace | Value |
|---|---|
| API | `POST /admin/payouts/{id}/approve` |
| UI routes | `/admin/payouts/[id]` |
| SRS requirements | FR-PAY-08, FR-PAY-13 |
| Associated tests (planned) | TC-PAY-008, TC-PAY-013 |

### US-ADM-13

**Reject, fail or cancel a payout** · Priority: **Must**

> As a **admin**, I want to reject a requested payout, or mark an approved payout as failed or cancel it, with a reason, so that reserved funds return to the user when a transfer will not happen.

**Preconditions**
- `payout.approve` (reject/cancel) or `payout.record_payment` (mark failed); step-up MFA.

**Main scenario**
1. Reject (`requested` → `rejected`, reason ≥ 10 chars) posts `payout_release`.
2. Mark failed (`approved` → `failed`, reason) posts `payout_release`.
3. Cancel (`approved` → `cancelled`, reason) posts `payout_release`.
4. Recipient notified in-app and by email.

**Alternate scenarios**
- A1: Reject on an `approved` payout → `409 invalid_state` (use cancel/mark failed).

**Acceptance criteria**
- **AC1** — **Given** a requested $40 payout, **when** it is rejected with reason "Name does not match verification", **then** status is `rejected` and available increases by $40.
- **AC2** — **Given** an approved payout, **when** it is marked failed ("Bank returned: closed account"), **then** status is `failed`, a `payout_release` journal exists and an email was sent.
- **AC3** — **Given** an approved payout, **when** an admin cancels it with a reason, **then** status is `cancelled` and funds are available again.

| Trace | Value |
|---|---|
| API | `POST /admin/payouts/{id}/reject`, `POST /admin/payouts/{id}/mark-failed`, `POST /admin/payouts/{id}/cancel` |
| UI routes | `/admin/payouts/[id]` |
| SRS requirements | FR-PAY-09, FR-PAY-11, FR-PAY-13 |
| Associated tests (planned) | TC-PAY-009, TC-PAY-011, TC-PAY-013 |

### US-ADM-14

**Record a manual payment** · Priority: **Must**

> As a **admin**, I want to mark an approved payout as paid with the external transfer reference, date and proof, so that the contributor and auditors can see exactly how money was sent.

**Preconditions**
- `payout.record_payment`; not the recipient; payout `approved`; transfer done outside DataHub.

**Main scenario**
1. Admin transfers money in the bank/wallet app (DataHub never calls a payment API).
2. Admin clicks Mark paid, enters `payment_reference` (1–128 chars, unique per method type), `paid_at` (≥ approval time, ≤ now) and optional note.
3. System atomically sets `paid`, inserts `payout_records` and posts `payout_settle` (key `payout:{id}:settle`).
4. Admin uploads proof (PDF/JPEG/PNG ≤ 10 MB, scanned, private); viewing proof is audit-logged.
5. Recipient gets "payment recorded".

**Alternate scenarios**
- A1: Repeat call → original record returned.
- A2: Duplicate reference for the same method type → `409`/`422` error.
- A3: `paid_at` in the future → `422 validation_error`.

**Acceptance criteria**
- **AC1** — **Given** an approved $120 payout, **when** it is marked paid with reference "WISE-55120", **then** status `paid`, one `payout_records` row and one `payout_settle` journal exist, and reserved decreases by $120.
- **AC2** — **Given** the same mark-paid request, **when** it is repeated, **then** the original record is returned and no new journal exists.
- **AC3** — **Given** a deployment, **when** the code is inspected, **then** no outbound call to any bank, wallet or payment-provider API exists.
- **AC4** — **Given** the recipient admin, **when** they mark their own payout paid, **then** the response is `403 self_action_forbidden`.

| Trace | Value |
|---|---|
| API | `POST /admin/payouts/{id}/mark-paid`, `POST /admin/payouts/{id}/proof` |
| UI routes | `/admin/payouts/[id]` |
| SRS requirements | FR-PAY-10, FR-PAY-14, FR-AUD-04, FR-PAY-13 |
| Associated tests (planned) | TC-PAY-010, TC-PAY-014, TC-AUD-004, TC-PAY-013 |

### US-ADM-15

**Monitor finances, ledger and reconciliation** · Priority: **Must**

> As a **admin**, I want a finance overview, a searchable ledger and the nightly reconciliation result, so that I can report liabilities and detect any accounting error.

**Preconditions**
- `finance.read`.

**Main scenario**
1. Admin opens `/admin/finance?tab=overview` (`GET /admin/finance/overview?from&to`): earnings credited (dataset vs annotation), adjustments, payouts by status, outstanding liability, estimated liability of submitted/in-review datasets.
2. `?tab=ledger` lists journals with filters (user, kind, source, date).
3. `?tab=reconciliation` shows the latest `finance.reconcile` result: bucket recomputation, Σ lines = 0, earnings-to-journal match, no negative balances.

**Alternate scenarios**
- A1: Mismatch → red status, alert raised to operators.

**Acceptance criteria**
- **AC1** — **Given** a seeded ledger, **when** reconciliation runs, **then** it reports 0 mismatches.
- **AC2** — **Given** a cached balance altered directly in the test database, **when** reconciliation runs, **then** a mismatch is stored and an alert fires.
- **AC3** — **Given** a date range, **when** the overview loads, **then** outstanding liability equals Σ users' pending + available + reserved.

| Trace | Value |
|---|---|
| API | `GET /admin/finance/overview`, `GET /admin/ledger`, `GET /admin/finance/reconciliation` |
| UI routes | `/admin/finance` |
| SRS requirements | FR-FIN-14, FR-FIN-13, FR-FIN-10 |
| Associated tests (planned) | TC-FIN-014, TC-FIN-013, TC-FIN-010 |

### US-ADM-16

**Create an annotation project and generate tasks** · Priority: **Must**

> As a **admin**, I want to create a project from approved datasets with instructions, types, labels, metadata schema, task unit, rewards and deadline, then generate tasks, so that annotators have well-defined, paid work.

**Preconditions**
- `annotation.manage`; MFA session.

**Main scenario**
1. Admin opens `/admin/annotation/projects/new` and completes steps basics, sources, schema, rewards, review.
2. Types ⊆ {transcription, text_correction, classification, metadata, page_label}; label set required for classification; rewards ≥ 0 with at least one > 0.
3. Sources must be `approved`/`partially_approved`, not taken down; only accepted annotatable files are included.
4. Project is created in `draft`; Generate tasks creates one task per file or page (idempotent) and sets the project `active`.

**Alternate scenarios**
- A1: `bbox` type → `422 validation_error` (not in v1).
- A2: Rejected dataset as source → `422 source_not_eligible`.
- A3: PATCH rewards later → affects only tasks not yet approved.

**Acceptance criteria**
- **AC1** — **Given** a page-unit project over 3 PDFs of 10, 12 and 8 pages, **when** tasks are generated twice, **then** exactly 30 `unassigned` tasks exist and the project is `active`.
- **AC2** — **Given** a rejected dataset as source, **when** the project is saved, **then** the response is `422 source_not_eligible`.
- **AC3** — **Given** rewards of 0 per task and 0 per page, **when** the project is saved, **then** the response is `422 validation_error`.
- **AC4** — **Given** reward per page raised from 100,000 to 120,000, **when** a not-yet-approved task is approved, **then** it is paid at 120,000 per page while earlier approvals are unchanged.

| Trace | Value |
|---|---|
| API | `POST /annotation/projects`, `PATCH /annotation/projects/{id}`, `POST /annotation/projects/{id}/generate-tasks` |
| UI routes | `/admin/annotation/projects/new`, `/admin/annotation/projects/[id]` |
| SRS requirements | FR-ANN-01, FR-ANN-02, FR-ANN-03 |
| Associated tests (planned) | TC-ANN-001, TC-ANN-002, TC-ANN-003 |

### US-ADM-17

**Assign, bulk-assign and unassign tasks** · Priority: **Must**

> As a **admin**, I want to assign tasks to eligible annotators individually or round-robin in bulk, and take tasks back, so that work is distributed and stuck tasks can be moved.

**Preconditions**
- `annotation.manage`; active project.

**Main scenario**
1. Admin opens `/admin/annotation/assignments?project=…`.
2. Assign: annotator must hold `annotator`, be verified and active; one active assignment per task; annotator notified.
3. Bulk assign: up to 500 unassigned tasks round-robin across up to 50 annotators in one transaction.
4. Unassign: `assigned`/`in_progress` → `unassigned`; previous assignee loses access at once; versions retained.

**Alternate scenarios**
- A1: Unverified annotator → `422 annotator_not_eligible`.
- A2: 501 tasks in one bulk call → `422 validation_error`.

**Acceptance criteria**
- **AC1** — **Given** 300 tasks and 3 annotators, **when** bulk assign runs, **then** each annotator receives 100 tasks.
- **AC2** — **Given** a suspended annotator, **when** a task is assigned to them, **then** the response is `422 annotator_not_eligible`.
- **AC3** — **Given** an `in_progress` task, **when** it is unassigned, **then** the former assignee's next request returns 404 and saved versions remain.

| Trace | Value |
|---|---|
| API | `POST /annotation/tasks/{id}/assign`, `POST /annotation/tasks/bulk-assign`, `POST /annotation/tasks/{id}/unassign` |
| UI routes | `/admin/annotation/assignments` |
| SRS requirements | FR-ANN-05, FR-ANN-06, FR-ANN-07 |
| Associated tests (planned) | TC-ANN-005, TC-ANN-006, TC-ANN-007 |

### US-ADM-18

**Monitor and close annotation projects** · Priority: **Must**

> As a **admin**, I want to see progress by task status and annotator, overdue tasks and approval rate, and close finished projects, so that projects finish on time and spending stops when done.

**Preconditions**
- `annotation.manage`.

**Main scenario**
1. Admin opens `/admin/annotation/projects` and `/admin/annotation/projects/[id]?tab=tasks` (filters by status and annotator).
2. Overdue tasks (past deadline) are flagged.
3. Admin may open `/admin/annotation/reviews` to watch the review backlog.
4. Admin closes the project: `closed`; non-approved tasks `cancelled`; data retained, no further edits or rewards.

**Alternate scenarios**
- A1: Closing is irreversible → confirmation dialog states counts of tasks to be cancelled.

**Acceptance criteria**
- **AC1** — **Given** a project with 40 tasks: 10 approved, 5 submitted, 25 in progress, **when** the overview loads, **then** counts per status match and approval rate is shown.
- **AC2** — **Given** the deadline passed for 3 unfinished tasks, **when** the tasks tab loads, **then** those 3 show `overdue`.
- **AC3** — **Given** a project is closed, **when** an annotator saves a draft on a cancelled task, **then** the save is refused.

| Trace | Value |
|---|---|
| API | `GET /annotation/projects`, `GET /annotation/projects/{id}/tasks`, `POST /annotation/projects/{id}/close` |
| UI routes | `/admin/annotation/projects`, `/admin/annotation/projects/[id]`, `/admin/annotation/reviews` |
| SRS requirements | FR-ANN-04, FR-ANN-18 |
| Associated tests (planned) | TC-ANN-004, TC-ANN-018 |

### US-ADM-19

**Build a dataset export** · Priority: **Must**

> As a **admin**, I want to export selected approved datasets with accepted files, approved annotations and metadata as a background job, so that SKAI can use the data for training without manual assembly.

**Preconditions**
- `dataset.export`; step-up MFA.

**Main scenario**
1. Admin opens `/admin/exports?new=1`; selects datasets by id and/or filters (category, language, min quality, class, finalized range) and options (files, annotations, metadata, text form verbatim/NFC/both).
2. System creates an export job (`queued`, code `EX-YYYY-NNNNNN`) and runs `exports.build_export` on the `exports` queue; at most 2 run concurrently.
3. Progress percentage is shown; each file's SHA-256 is re-verified before adding.
4. Output: ZIP parts ≤ 4,000,000,000 bytes with `manifest.jsonl`, `metadata.csv` and, if selected, `annotations.jsonl`; contributors appear only as pseudonymous ids.

**Alternate scenarios**
- A1: Selection matches nothing → `422` (`export.empty_selection`).
- A2: SHA-256 mismatch → export `failed` and alert raised.

**Acceptance criteria**
- **AC1** — **Given** a selection including a rejected and a taken-down dataset, **when** the export completes, **then** neither dataset nor any rejected/quarantined/failed file is in the manifest.
- **AC2** — **Given** 3 exports requested at once, **when** workers pick them up, **then** 2 run and 1 stays `queued`.
- **AC3** — **Given** an export with annotations, **when** `annotations.jsonl` is inspected, **then** only approved annotations are present with project, task, version and reviewer score.
- **AC4** — **Given** any export, **when** all files are searched for contributor emails, legal names and phones, **then** none are found.

| Trace | Value |
|---|---|
| API | `POST /admin/exports`, `GET /admin/exports/{id}` |
| UI routes | `/admin/exports` |
| SRS requirements | FR-EXP-01, FR-EXP-02, FR-EXP-03, FR-EXP-07, NFR-INT-09, FR-AUD-01 |
| Associated tests (planned) | TC-EXP-001, TC-EXP-002, TC-EXP-003, TC-EXP-007, TC-INT-009, TC-AUD-001 |

### US-ADM-20

**Download exports and review export history** · Priority: **Must**

> As a **admin**, I want to download completed export parts via short-lived links and see who exported what, so that data leaves DataHub only in a controlled, traceable way.

**Preconditions**
- `dataset.export`; export `completed`.

**Main scenario**
1. Admin opens `/admin/exports?job=<id>`; history shows requester, time, criteria, resolved dataset ids, file count, total bytes.
2. Admin requests a URL per part (`POST /admin/exports/{id}/download-url`), valid 5 minutes; each issuance is audit-logged.
3. Seven days after completion `exports.expire` deletes objects and sets `expired`.

**Alternate scenarios**
- A1: URL for a `running` or `expired` export → `409 invalid_state`.

**Acceptance criteria**
- **AC1** — **Given** a completed export, **when** a download URL is issued, **then** it expires 5 minutes later and an audit row exists.
- **AC2** — **Given** an export completed 7 days and 1 hour ago, **when** the daily expiry ran, **then** status is `expired` and its objects are gone.
- **AC3** — **Given** the export list, **when** it loads, **then** each job shows requester, criteria, dataset ids, file count and bytes.

| Trace | Value |
|---|---|
| API | `POST /admin/exports/{id}/download-url`, `GET /admin/exports`, `GET /admin/exports/{id}` |
| UI routes | `/admin/exports` |
| SRS requirements | FR-EXP-04, FR-EXP-05, FR-EXP-06, FR-AUD-04 |
| Associated tests (planned) | TC-EXP-004, TC-EXP-005, TC-EXP-006, TC-AUD-004 |

### US-ADM-21

**View operational and financial analytics** · Priority: **Must**

> As a **admin**, I want analytics for a date range covering intake, acceptance, earnings, payouts, liability, annotation throughput, support and storage, so that management can track unit cost and throughput.

**Preconditions**
- `analytics.read`.

**Main scenario**
1. Admin opens `/admin/analytics?from=&to=` (`GET /admin/analytics/overview`).
2. Charts show registrations, verified users, datasets submitted/finalized by decision, bytes submitted/accepted/rejected, acceptance rate, median submit→finalize time, earnings, payouts, liability, tasks by status, pages approved, first-pass approval rate, open conversations, storage bytes.
3. Every chart has a table alternative.

**Alternate scenarios**
- A1: Empty range → zero values, no errors.

**Acceptance criteria**
- **AC1** — **Given** a range with 10 finalized datasets, 6 approved, **when** analytics loads, **then** the decision breakdown shows 6 approved.
- **AC2** — **Given** a screen-reader user, **when** a chart is reached, **then** a data table with the same values is available.
- **AC3** — **Given** a range, **when** accepted GB and storage bytes are shown, **then** they match the ledger and storage metrics for the same period.

| Trace | Value |
|---|---|
| API | `GET /admin/analytics/overview` |
| UI routes | `/admin/analytics` |
| SRS requirements | FR-ADM-06 |
| Associated tests (planned) | TC-ADM-006 |

### US-ADM-22

**Run the support inbox** · Priority: **Must**

> As a **admin**, I want a support inbox with unassigned and open counts, oldest waiting age, search, assignment and status control, so that every user question gets answered quickly.

**Preconditions**
- `message.support`.

**Main scenario**
1. Admin opens `/admin/messages`: filters by status, assignee, unread, linked dataset and `q` (subject and body search).
2. Header shows unassigned/open counts and the age of the oldest conversation awaiting an admin reply.
3. Admin replies (status `awaiting_user`), assigns, or closes (`PATCH`).
4. Admin may start a conversation with any user.
5. Unread support messages older than 15 min trigger an email to the recipient.

**Alternate scenarios**
- A1: User replies on a closed thread → reopened `open`.

**Acceptance criteria**
- **AC1** — **Given** `q=payout` , **when** search runs, **then** conversations whose subject or any message body contains "payout" (case-insensitive) are returned.
- **AC2** — **Given** an admin reply, **when** it is posted, **then** the conversation status is `awaiting_user`.
- **AC3** — **Given** a user message unread by them for 15 min, **when** the timer elapses, **then** one email notification is queued.
- **AC4** — **Given** the inbox header, **when** it loads, **then** it shows the oldest awaiting-admin age in hours.

| Trace | Value |
|---|---|
| API | `GET /conversations`, `PATCH /conversations/{id}`, `POST /conversations`, `POST /conversations/{id}/messages` |
| UI routes | `/admin/messages`, `/admin/messages/[id]` |
| SRS requirements | FR-MSG-01, FR-MSG-02, FR-MSG-06, FR-MSG-08, FR-NOTIF-04 |
| Associated tests (planned) | TC-MSG-001, TC-MSG-002, TC-MSG-006, TC-MSG-008, TC-NOTIF-004 |

### US-ADM-23

**Process account deletion requests** · Priority: **Must**

> As an **admin**, I want to approve or reject requested account deletions, so that privacy requests are fulfilled while financial and legal obligations are respected.

**Preconditions**
- `user.manage`, recent step-up MFA for the decision; a `deletion_requests` row `requested`.

**Main scenario**
1. Admin opens the deletion queue and sees status, grace deadline and blockers.
2. Admin records approval with a reason; approval retains `requested` until the 14-day grace expires and never bypasses blockers.
3. The daily processor rechecks balances, payouts, reviews, assignments and legal hold, then performs `requested → processing → completed`: deactivate, revoke sessions, anonymize PII and queue eligible objects for deletion.
4. Alternatively the admin rejects with a reason; status becomes `rejected` and the user is notified.
5. A retry resumes a half-processed request idempotently.

**Alternate scenarios**
- A1: Blockers exist → request stays `requested` with blockers listed; user informed.
- A2: Subject attempts to decide their own request → denied by separation of duties.

**Acceptance criteria**
- **AC1** — **Given** an approved, due request without blockers, **when** the daily processor runs, **then** status is `completed`, user is `anonymized`, and all sessions are revoked.
- **AC2** — **Given** a processing crash between deactivation and anonymization, **when** the daily job runs, **then** anonymization completes with the same values.
- **AC3** — **Given** a rejection with a mandatory reason, **when** it is saved, **then** status is `rejected` and the user is notified.
- **AC4** — **Given** an approval before the grace deadline, **when** it is saved, **then** the request remains `requested` and no anonymization occurs early.

| Trace | Value |
|---|---|
| API | `GET /admin/deletion-requests`, `POST /admin/deletion-requests/{id}/decision`, `GET /admin/users/{id}` |
| UI routes | `/admin/users/[id]`, `/admin` |
| SRS requirements | FR-ADM-11, FR-USER-07 |
| Associated tests (planned) | TC-ADM-011, TC-USER-007 |

### US-ADM-24

**Inspect and retry background jobs** · Priority: **Should**

> As an **admin**, I want to inspect background job records and safely re-enqueue failed idempotent jobs, so that transient failures do not leave work stuck.

**Preconditions**
- `user.manage`; recent step-up MFA for manual requeue.

**Main scenario**
1. Admin opens the jobs view from the dashboard "failed jobs (24 h)" card.
2. List shows task, queue, entity, status, attempts and redacted last error, filtered by status, task, queue, entity and date.
3. Admin supplies a reason and re-enqueues a `failed|dead` job in the explicit safe-requeue registry.
4. `admin.requeue_stalled` (every 5 min) re-enqueues outbox rows pending > 2 min, files uploaded > 5 min and exports queued > 5 min (AM-10).

**Alternate scenarios**
- A1: Non-idempotent or nonterminal job → retry denied.
- A2: Equivalent job already queued/running → retry denied without creating another job record.

**Acceptance criteria**
- **AC1** — **Given** a failed `processing.process_file` job, **when** it is re-enqueued, **then** the file is processed once with no duplicate rows.
- **AC2** — **Given** an email outbox row that failed 5 times, **when** the admin views it, **then** status `failed` and last error are shown.
- **AC3** — **Given** a file stuck in `uploaded` for 6 min, **when** `admin.requeue_stalled` runs, **then** processing is enqueued.
- **AC4** — **Given** an equivalent job is already in flight, **when** manual requeue is requested, **then** no duplicate is created and the API returns conflict.

| Trace | Value |
|---|---|
| API | `GET /admin/background-jobs`, `POST /admin/background-jobs/{id}/requeue` |
| UI routes | `/admin` |
| SRS requirements | FR-ADM-12, FR-NOTIF-03, NFR-INT-03 |
| Associated tests (planned) | TC-ADM-012, TC-NOTIF-003, TC-INT-003 |

## 8. Super admin stories (US-SUP)

### US-SUP-01

**Publish a new pricing version** · Priority: **Must**

> As a **super admin**, I want to create a new pricing rule for a data class effective now or in the future, with a note, so that rates change transparently without affecting past payments.

**Preconditions**
- `pricing.manage`; step-up MFA.

**Main scenario**
1. Super_admin opens `/admin/pricing`; history from `GET /pricing-rules`.
2. Super_admin enters class, `rate_micros_per_gb`, `effective_from ≥ now` and a mandatory note.
3. System inserts the rule; overlapping periods are rejected by an exclusion constraint.
4. Reviews finalized after `effective_from` use the new rule; each earning stores the rule id and rate.

**Alternate scenarios**
- A1: `effective_from` in the past → `422 validation_error`.
- A2: Admin without super_admin → read-only page, POST returns `403 forbidden`.

**Acceptance criteria**
- **AC1** — **Given** a raw rule of 1,200,000 effective 2026-12-01T00:00Z, **when** a review is finalized at 2026-11-30T23:59Z, **then** it uses 1,000,000 and stores the old rule id.
- **AC2** — **Given** the same rule, **when** a review is finalized at 2026-12-01T00:01Z, **then** it uses 1,200,000.
- **AC3** — **Given** `effective_from` = yesterday, **when** the rule is posted, **then** the response is `422 validation_error`.
- **AC4** — **Given** an admin (not super_admin), **when** they post a rule, **then** the response is `403 forbidden`.

| Trace | Value |
|---|---|
| API | `GET /pricing-rules`, `POST /admin/pricing-rules` |
| UI routes | `/admin/pricing` |
| SRS requirements | FR-FIN-01, FR-FIN-03 |
| Associated tests (planned) | TC-FIN-001, TC-FIN-003 |

### US-SUP-02

**Post a manual balance adjustment** · Priority: **Must**

> As a **super admin**, I want to credit or debit a user's wallet with a reason and an optional related entity, so that errors and takedown clawbacks can be corrected auditably.

**Preconditions**
- `finance.adjust`; step-up MFA.

**Main scenario**
1. Super_admin opens `/admin/finance?tab=adjustments`, selects user, direction, amount (> 0), reason ≥ 10 chars and related entity.
2. Client sends `POST /admin/adjustments` with an `Idempotency-Key`.
3. System posts `adjustment_credit`/`adjustment_debit` (key `adjustment:{id}`) and notifies the user.

**Alternate scenarios**
- A1: Debit greater than available → `422 insufficient_balance`.
- A2: Adjusting own wallet → `403 self_action_forbidden`.
- A3: Retry with same key → no duplicate journal.

**Acceptance criteria**
- **AC1** — **Given** available $5.00, **when** a $6.00 debit is posted, **then** the response is `422 insufficient_balance`.
- **AC2** — **Given** a $2.50 credit with reason "Late correction for DS-2026-000123", **when** it is posted, **then** a balanced journal exists, the user's adjustments total increases by $2.50 and they are notified.
- **AC3** — **Given** a super_admin, **when** they adjust their own wallet, **then** the response is `403 self_action_forbidden`.
- **AC4** — **Given** the same Idempotency-Key, **when** the request is retried, **then** only one journal exists.

| Trace | Value |
|---|---|
| API | `POST /admin/adjustments`, `GET /admin/ledger` |
| UI routes | `/admin/finance` |
| SRS requirements | FR-FIN-12, FR-FIN-10 |
| Associated tests (planned) | TC-FIN-012, TC-FIN-010 |

### US-SUP-03

**Reverse a paid payout that bounced** · Priority: **Must**

> As a **super admin**, I want to reverse a paid payout with a reason, so that bounced transfers return to the user's available balance.

**Preconditions**
- `finance.adjust` (super_admin); payout `paid`; step-up MFA.

**Main scenario**
1. Super_admin opens `/admin/payouts/[id]` and clicks Reverse with a reason.
2. System sets `reversed` and posts `payout_reversal` (paid → available); user notified.

**Alternate scenarios**
- A1: Payout not `paid` → `409 invalid_state`.

**Acceptance criteria**
- **AC1** — **Given** a paid $80 payout, **when** it is reversed with reason "Bank returned funds 2026-11-03", **then** status `reversed`, available +$80, paid total −$80.
- **AC2** — **Given** an approved payout, **when** reverse is called, **then** the response is `409 invalid_state`.
- **AC3** — **Given** an admin (not super_admin), **when** they reverse, **then** the response is `403 forbidden`.

| Trace | Value |
|---|---|
| API | `POST /admin/payouts/{id}/reverse` |
| UI routes | `/admin/payouts/[id]` |
| SRS requirements | FR-PAY-12, FR-PAY-13 |
| Associated tests (planned) | TC-PAY-012, TC-PAY-013 |

### US-SUP-04

**Manage system settings** · Priority: **Must**

> As a **super admin**, I want to view and change typed, validated settings such as limits, hold days, withdrawal limits, dual-approval threshold, allowed extensions, reason codes and categories, so that the platform can be tuned without a deploy.

**Preconditions**
- `settings.manage`; step-up MFA.

**Main scenario**
1. Super_admin opens `/admin/settings` (`GET /admin/settings`).
2. Super_admin edits a value; `PUT /admin/settings/{key}` validates type and range.
3. Change is audit-logged with old and new values and takes effect within the 30 s settings cache.

**Alternate scenarios**
- A1: Invalid value (e.g. `min_withdrawal_micros` not a multiple of 10,000) → `422`.
- A2: Adding a deny-listed extension (`exe`, `html`, `svg`, `docm`) to `extra_allowed_extensions` → `422`.

**Acceptance criteria**
- **AC1** — **Given** `earning_hold_days` set from 0 to 7, **when** the next review is finalized, **then** its earnings are credited to `pending` with `hold_until` +7 days.
- **AC2** — **Given** `min_withdrawal_micros = 10,005,000`, **when** it is saved, **then** the response is `422`.
- **AC3** — **Given** any setting change, **when** audit logs are inspected, **then** old and new values and the actor are recorded.
- **AC4** — **Given** an unknown key, **when** it is PUT, **then** the response is `404`.

| Trace | Value |
|---|---|
| API | `GET /admin/settings`, `PUT /admin/settings/{key}` |
| UI routes | `/admin/settings` |
| SRS requirements | FR-ADM-08, FR-FIN-08 |
| Associated tests (planned) | TC-ADM-008, TC-FIN-008 |

### US-SUP-05

**Switch maintenance mode** · Priority: **Must**

> As a **super admin**, I want to turn maintenance mode on and off, so that I can perform risky operations without users changing data meanwhile.

**Preconditions**
- `settings.manage`; step-up MFA.

**Main scenario**
1. Super_admin sets `maintenance_mode = true` (`PUT /admin/settings/maintenance_mode`).
2. Within 30 s every non-exempt API call returns 503 `service_unavailable` with `details.reason = "maintenance"`; the web shows `/maintenance`.
3. Admins keep using `/auth/*` and `/admin/*`; super_admin turns it off afterwards.

**Alternate scenarios**
- A1: Planned maintenance ≤ 4 h/month is announced ≥ 48 h ahead and excluded from availability.

**Acceptance criteria**
- **AC1** — **Given** maintenance on, **when** a contributor uploads, **then** the API returns 503 with reason `maintenance`.
- **AC2** — **Given** maintenance on, **when** a super_admin calls `PUT /admin/settings/maintenance_mode` with false, **then** it succeeds and user calls work again within 30 s.
- **AC3** — **Given** maintenance on, **when** a WebSocket upgrade is attempted, **then** it is refused with 503.

| Trace | Value |
|---|---|
| API | `PUT /admin/settings/{key}` |
| UI routes | `/admin/settings`, `/maintenance` |
| SRS requirements | FR-ADM-08, NFR-AVL-04, NFR-AVL-01 |
| Associated tests (planned) | TC-ADM-008, TC-AVL-004, TC-AVL-001 |

### US-SUP-06

**Manage admin roles safely** · Priority: **Must**

> As a **super admin**, I want to grant and revoke `admin` and `super_admin` roles, never leaving the platform without a super_admin, so that administrative power is controlled.

**Preconditions**
- `role.manage`; step-up MFA.

**Main scenario**
1. Super_admin opens `/admin/users/[id]?tab=roles` and grants or revokes admin roles.
2. Revoking an admin role revokes the user's sessions immediately.
3. New admins must enrol MFA at next login.

**Alternate scenarios**
- A1: Demoting the last active super_admin → `409 last_super_admin`.
- A2: Changing own roles → refused.

**Acceptance criteria**
- **AC1** — **Given** one active super_admin, **when** their super_admin role is revoked by another path, **then** the response is `409 last_super_admin`.
- **AC2** — **Given** an admin with an active session, **when** their admin role is revoked, **then** their next admin call returns `403` and their sessions are revoked.
- **AC3** — **Given** a newly granted admin without MFA, **when** they call an admin endpoint, **then** the response is `403 mfa_required`.

| Trace | Value |
|---|---|
| API | `PUT /admin/users/{id}/roles`, `GET /admin/roles` |
| UI routes | `/admin/users/[id]`, `/admin/settings` |
| SRS requirements | FR-ADM-03, FR-ADM-09, SEC-21, SEC-05 |
| Associated tests (planned) | TC-ADM-003, TC-ADM-009, TC-SEC-021, TC-SEC-005 |

### US-SUP-07

**Audit actions and security events** · Priority: **Must**

> As a **super admin**, I want to search the append-only audit log and the security-event log, so that every sensitive action can be investigated.

**Preconditions**
- `audit.read`.

**Main scenario**
1. Super_admin opens `/admin/audit-logs?tab=audit` (`GET /admin/audit-logs`, filters actor, action, entity type/id, date range).
2. Each row shows actor, action, entity, before/after diff, IP, request_id and time.
3. `?tab=security` lists login success/failure, lockouts, MFA events, password changes/resets, session revocations, role changes, payout-method changes and infected uploads.

**Alternate scenarios**
- A1: Admin (not super_admin) → `403 forbidden`.

**Acceptance criteria**
- **AC1** — **Given** a payout approval, **when** audit logs are filtered by entity_type=payout and entity_id, **then** the transition row with before/after JSON exists.
- **AC2** — **Given** a direct `UPDATE audit_logs` in the database, **when** it is executed, **then** the trigger rejects it.
- **AC3** — **Given** any audit or security row, **when** it is searched for passwords, hashes, tokens, MFA secrets or recovery codes, **then** none are found and payout identifiers show only the last 4 characters.
- **AC4** — **Given** an admin without `audit.read`, **when** they open audit logs, **then** the response is `403 forbidden`.

| Trace | Value |
|---|---|
| API | `GET /admin/audit-logs`, `GET /admin/security-events` |
| UI routes | `/admin/audit-logs` |
| SRS requirements | FR-AUD-01, FR-AUD-02, FR-AUD-03, FR-AUD-05, NFR-OBS-05 |
| Associated tests (planned) | TC-AUD-001, TC-AUD-002, TC-AUD-003, TC-AUD-005, TC-OBS-005 |

### US-SUP-08

**Publish a new Contributor Agreement version** · Priority: **Must**

> As a **super admin**, I want to publish a new Contributor Agreement version, so that all contributors accept updated legal terms before contributing more data.

**Preconditions**
- `settings.manage`; HA-01 legal approval obtained.

**Main scenario**
1. Super_admin updates `contributor_agreement_version` (e.g. CA-2027-01) and publishes the text at `/legal/contributor-agreement`.
2. Contributors with older acceptance get `403 agreement_outdated` on dataset creation, upload initiation and submission until they re-accept.

**Alternate scenarios**
- A1: Existing datasets, reviews and balances unaffected.

**Acceptance criteria**
- **AC1** — **Given** version CA-2027-01 published, **when** a contributor who accepted CA-2026-10 submits a dataset, **then** the response is `403 agreement_outdated`.
- **AC2** — **Given** the contributor re-accepts, **when** they submit again, **then** it succeeds and a new `agreement_acceptances` row exists.
- **AC3** — **Given** the change, **when** audit logs are inspected, **then** the old and new version are recorded.

| Trace | Value |
|---|---|
| API | `PUT /admin/settings/{key}`, `POST /me/onboarding` |
| UI routes | `/admin/settings`, `/legal/contributor-agreement` |
| SRS requirements | FR-USER-03, FR-ADM-08 |
| Associated tests (planned) | TC-USER-003, TC-ADM-008 |

### US-SUP-09

**Access a quarantined file for investigation** · Priority: **Should**

> As a **super admin**, I want to access a quarantined file through an audit-logged path, so that I can investigate malware reports without exposing anyone else.

**Preconditions**
- File `quarantined`; super_admin.

**Main scenario**
1. Super_admin opens the file on `/admin/datasets/[id]?tab=files` and requests access with a reason.
2. System issues a 5-minute download URL and writes an audit entry.
3. Security event list shows the infected upload; ≥ 3 infected uploads from one user in 30 days raise an alert.

**Alternate scenarios**
- A1: Admin (not super_admin) → `404`/`403`.

**Acceptance criteria**
- **AC1** — **Given** a quarantined file, **when** an admin requests it, **then** access is denied.
- **AC2** — **Given** a quarantined file, **when** a super_admin requests it, **then** a URL valid 5 minutes is issued and an audit row exists.
- **AC3** — **Given** a user's 3rd infected upload within 30 days, **when** it is quarantined, **then** an alert fires.

| Trace | Value |
|---|---|
| API | `POST /files/{id}/download-url`, `GET /admin/security-events` |
| UI routes | `/admin/datasets/[id]`, `/admin/audit-logs` |
| SRS requirements | FR-PROC-03, FR-AUD-04, NFR-OBS-04 |
| Associated tests (planned) | TC-PROC-003, TC-AUD-004, TC-OBS-004 |

### US-SUP-10

**Monitor platform health and alerts** · Priority: **Must**

> As a **super admin**, I want health endpoints, metrics, structured logs and alerts for errors, queues, backups, storage and email failures, so that I learn about problems before users do.

**Preconditions**
- Operations access.

**Main scenario**
1. An external probe checks `/readyz` and `/` every 60 s; monthly availability ≥ 99.5 %.
2. `GET /metrics` (internal only) exposes request, latency, 5xx, queue depth/age, task failures, upload/file/scan/outbox/payout/reconciliation and storage metrics.
3. Structured JSON logs include request_id/task_id, user id, route, status and duration, and never secrets or presigned URLs.
4. Alerts fire for 5xx > 2 %/5 min, 3 failed probes, queue age > 15 min or depth > 500, reconciliation mismatch, backup failure/no backup in 26 h, storage > 80 %, > 10 email failures/h, ≥ 3 infected uploads per user in 30 days.

**Alternate scenarios**
- A1: Sentry DSN configured → exceptions reported with PII scrubbed.

**Acceptance criteria**
- **AC1** — **Given** the processing queue's oldest task is 16 min old, **when** the alert rule evaluates, **then** an alert fires.
- **AC2** — **Given** `GET /metrics` from the public internet, **when** it is requested, **then** it is not reachable.
- **AC3** — **Given** a login request, **when** its log line is inspected, **then** it contains request_id and duration and no password, cookie or token.
- **AC4** — **Given** 200 concurrent users on the reference host, **when** the load test runs, **then** p95 < 300 ms, p99 < 1,000 ms and error rate < 0.5 %.

| Trace | Value |
|---|---|
| API | `GET /healthz`, `GET /readyz`, `GET /metrics` |
| UI routes | `/admin` |
| SRS requirements | NFR-OBS-01, NFR-OBS-02, NFR-OBS-03, NFR-OBS-04, NFR-OBS-05, NFR-AVL-01, NFR-PERF-01 |
| Associated tests (planned) | TC-OBS-001, TC-OBS-002, TC-OBS-003, TC-OBS-004, TC-OBS-005, TC-AVL-001, TC-PERF-001 |

### US-SUP-11

**Restore from backup within the recovery targets** · Priority: **Must**

> As a **super admin**, I want daily encrypted backups and a proven restore procedure, so that a disaster loses at most 24 h of data and service is back within 4 h.

**Preconditions**
- Backups configured; isolated restore environment.

**Main scenario**
1. Daily encrypted `pg_dump` retained 30 days; object storage protected by versioning (S3) or nightly `rclone sync` with 30-day retention (R2, AM-13).
2. Before launch and every quarter, the team restores database and objects into isolated infrastructure.
3. Reconciliation runs on the restored data and must pass.

**Alternate scenarios**
- A1: Backup job fails or no successful backup in 26 h → alert.

**Acceptance criteria**
- **AC1** — **Given** a restore drill, **when** it is timed, **then** database and service are running within 4 h.
- **AC2** — **Given** the restored database, **when** `finance.reconcile` runs, **then** it reports 0 mismatches.
- **AC3** — **Given** the latest backup, **when** its age is measured at restore time, **then** it is ≤ 24 h old.
- **AC4** — **Given** a backup file, **when** it is inspected off-host, **then** it is encrypted.

| Trace | Value |
|---|---|
| API | — (no API operation; verified by inspection/operations) |
| UI routes | — (operations; no UI route) |
| SRS requirements | NFR-AVL-02, NFR-AVL-03, SEC-13, FR-FIN-13 |
| Associated tests (planned) | TC-AVL-002, TC-AVL-003, TC-SEC-013, TC-FIN-013 |

## 9. Open gaps referenced by stories

No open API-contract gaps remain in this story baseline. Implementation and executed-test statuses remain `Planned` until application work begins.
