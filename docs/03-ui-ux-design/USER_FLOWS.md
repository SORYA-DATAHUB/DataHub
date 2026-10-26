# DataHub — User Flow Diagrams

| Field | Value |
|---|---|
| Document | #17 — User Flow Diagram |
| Path | `docs/03-ui-ux-design/USER_FLOWS.md` |
| Version | v1.0 |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | Design lead (CTO role) |
| Related | [`UI_UX_DESIGN.md`](UI_UX_DESIGN.md) (routes, confirmations), [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), [`WIREFRAMES/`](WIREFRAMES/README.md), [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) §8–§12 |

## 0. Document header

**Purpose.** Describe, as Mermaid flowcharts, the twelve end-to-end user journeys required by the master prompt, showing screens (with route and page number), decisions, API calls and state transitions, so that UI, API and tests share one understanding of each journey.

**Scope.** Registration, contributor onboarding, dataset upload (including resume after disconnect), quality review, earnings approval, withdrawal, payment recording, annotation assignment, annotation completion, annotation review, dataset export, support messaging.

**Assumptions.** State machines, permissions and money rules exactly as in the engineering baseline (§6, §8, §9). Routes and page numbers exactly as in `UI_UX_DESIGN.md` §3. Notifications are created server-side on the listed events and delivered in-app (WS) and by email via the outbox.

**Decisions.**
- Flowchart notation: rectangles = screens/steps (route in label), diamonds = decisions, stadiums = start/end, subroutine shapes `[[…]]` = server/background processing, hexagons `{{…}}` = notifications.
- All node and edge labels are double-quoted for Mermaid validity with special characters.
- Each flow lists the requirement hooks (status transitions) it exercises so test cases (#29) can trace to it.

**Dependencies.** Baseline §6 (permissions & separation of duties), §7 (formats), §8 (earnings/ledger/payout rules), §9 (states), §11 (annotation concurrency), §12 (endpoints), §13 (jobs).

**Acceptance criteria.**
1. All twelve diagrams render with Mermaid ≥ 10 (validated with `mermaid.parse`).
2. Every screen node references a route that exists in `UI_UX_DESIGN.md` §3.
3. Every state transition shown is legal under baseline §9.
4. Financial flows show the ledger journal kind created at each step (baseline §8.5).
5. E2E scenarios in the test plan can be mapped 1:1 onto at least one path of these diagrams.

---

## 1. Registration

```mermaid
flowchart TD
    S1(["Visitor on public site"]) --> R1["Registration /register (#10)"]
    R1 --> R2{"Form valid? name, email, password ≥ 12 chars, Terms + Privacy accepted"}
    R2 -->|"No"| R3["Inline field errors, focus first invalid"]
    R3 --> R1
    R2 -->|"Yes"| R4[["POST /auth/register"]]
    R4 --> R5{"Response"}
    R5 -->|"429 rate limited"| R6["Show retry countdown"]
    R6 --> R1
    R5 -->|"201 created or email already registered (same response, no enumeration)"| R7["Check your inbox /verify-email (#11)"]
    R7 --> R8{{"Verification email sent via outbox"}}
    R8 --> R9{"User clicks link?"}
    R9 -->|"Not received"| R10["Resend (60 s cooldown) POST /auth/resend-verification"]
    R10 --> R8
    R9 -->|"Yes"| R11[["POST /auth/verify-email with token"]]
    R11 --> R12{"Token valid and unexpired?"}
    R12 -->|"No"| R13["Link expired message + Resend button"]
    R13 --> R10
    R12 -->|"Yes"| R14["users.status pending_email to active"]
    R14 --> R15{{"Notification: Email verified"}}
    R15 --> R16{"Signed in?"}
    R16 -->|"No"| R17["Login /login (#9)"]
    R17 --> R18[["POST /auth/login"]]
    R18 --> R19["Contributor onboarding /onboarding (#14)"]
    R16 -->|"Yes"| R19
    R19 --> E1(["Registration complete — continue to onboarding flow"])
```

Notes: a session created while `pending_email` may only reach `/verify-email` (resend, logout). Admin accounts are created by script/super_admin, never via `/register`; admin login adds the MFA step (`/login?step=mfa`, `POST /auth/mfa/verify`).

## 2. Contributor onboarding

```mermaid
flowchart TD
    S1(["First login after email verification"]) --> O1["Step 1 Profile /onboarding?step=profile"]
    O1 --> O2{"Legal name, display name, country, phone, date of birth valid?"}
    O2 -->|"No"| O1
    O2 -->|"Yes"| O3[["PATCH /me/profile"]]
    O3 --> O4["Step 2 Contributor Agreement /onboarding?step=agreement"]
    O4 --> O5{"Scrolled to end and ticked I accept version N?"}
    O5 -->|"No"| O4
    O5 -->|"Yes"| O6["Step 3 Rights declaration /onboarding?step=rights"]
    O6 --> O7{"All declarations ticked: own rights, no personal data without consent, no malware, licence grant"}
    O7 -->|"No"| O6
    O7 -->|"Yes"| O8[["POST /me/onboarding (agreement version + declarations)"]]
    O8 --> O9["Uploads unlocked"]
    O9 --> O10["Step 4 Verification (optional now) /onboarding?step=verification"]
    O10 --> O11{"Verify now?"}
    O11 -->|"Later"| O12["Dashboard /dashboard (#15) with Verify to withdraw banner"]
    O11 -->|"Now"| O13["Add payout method form"]
    O13 --> O14[["POST /me/payout-methods"]]
    O14 --> O15["Optional ID document upload + confirm details"]
    O15 --> O16[["POST /me/verification"]]
    O16 --> O17["verification_status pending"]
    O17 --> O12
    O12 --> A1["Admin: Contributor Verification /admin/verifications (#30)"]
    A1 --> A2{"Admin decision POST /admin/verifications/{id}/decision"}
    A2 -->|"approved"| A3{{"Notification: Contributor approved"}}
    A3 --> A4(["Withdrawals and annotation assignment enabled"])
    A2 -->|"needs_info"| A5{{"Notification: More info needed + message"}}
    A5 --> A6["Profile /profile?tab=verification (#25) prefilled resubmission"]
    A6 --> O16
    A2 -->|"rejected"| A7{{"Notification: Verification rejected + reason"}}
    A7 --> A8(["Uploads still allowed; withdrawals blocked; user may message support"])
```

## 3. Dataset upload (including resume after disconnect)

```mermaid
flowchart TD
    S1(["Contributor clicks Upload dataset"]) --> G1{"Onboarding complete?"}
    G1 -->|"No"| G2["Redirect /onboarding?next=/datasets/new"]
    G1 -->|"Yes"| U1["Upload Dataset /datasets/new (#16): metadata + choose files/folder/ZIP"]
    U1 --> U2{"Client pre-checks: allowed extension, file ≤ 4 GB, dataset ≤ 50 GB, ≤ 2,000 files, quota"}
    U2 -->|"Fail"| U3["List problems per file; remove or fix"]
    U3 --> U1
    U2 -->|"Pass"| U4[["POST /datasets (status draft)"]]
    U4 --> U5["Upload Progress /datasets/{id}/upload (#17)"]
    U5 --> U6[["Per file: POST /datasets/{id}/uploads → upload_id, part_size"]]
    U6 --> U7["Persist session in localStorage (upload_id, name, size, lastModified)"]
    U7 --> U8[["POST /uploads/{id}/part-urls → PUT parts directly to storage (4 parallel)"]]
    U8 --> U9{"Network or tab interrupted?"}
    U9 -->|"Offline event"| U10["Auto-pause all, banner You're offline"]
    U10 --> U11{"Back online?"}
    U11 -->|"Yes, same tab"| U8
    U9 -->|"Tab closed or reloaded"| U12["User reopens /datasets/{id}/upload"]
    U12 --> U13["Interrupted files listed: Re-select files to resume"]
    U13 --> U14{"Session age < 24 h?"}
    U14 -->|"No (expired)"| U15["Upload expired — start file again"]
    U15 --> U6
    U14 -->|"Yes"| U16{"Re-selected file matches name + size + lastModified?"}
    U16 -->|"No"| U13
    U16 -->|"Yes"| U17[["GET /uploads/{id} → parts already uploaded"]]
    U17 --> U18["Upload only missing parts"]
    U18 --> U8
    U9 -->|"No interruption"| U19[["POST /uploads/{id}/complete (part list + ETags)"]]
    U19 --> U20["File processing_status uploaded"]
    U20 --> P1[["Worker: sniff MIME, sha256, ClamAV scan, duplicates, previews, ZIP expansion"]]
    P1 --> P2{"Result per file"}
    P2 -->|"ready + clean"| P3["File Ready"]
    P2 -->|"failed (type_mismatch, disallowed_type, nested_archive)"| P4["File Failed with reason → Remove file"]
    P2 -->|"infected"| P5["File Quarantined"]
    P3 --> P6{{"Notification: Dataset processing finished"}}
    P4 --> P6
    P5 --> P6
    P6 --> V1{"All files terminal and ≥ 1 ready?"}
    V1 -->|"No"| U5
    V1 -->|"Yes"| V2["Estimate card updates GET /datasets/{id}/estimate"]
    V2 --> V3["Submit for review — confirm dialog (L2)"]
    V3 --> V4[["POST /datasets/{id}/submit → status submitted"]]
    V4 --> V5{{"Notification: Dataset received"}}
    V5 --> E1(["Dataset Details /datasets/{id} (#19) shows Submitted + next steps"])
```

Cancel path: "Cancel" on a file calls `DELETE /uploads/{id}` (session `aborted`); abandoned sessions are expired by `uploads.expire_sessions` after 24 h.

## 4. Quality review (dataset)

```mermaid
flowchart TD
    S1(["Reviewer or admin opens queue"]) --> Q1["Dataset Review Tasks /review/datasets (#57) or Review Queue /admin/reviews (#34)"]
    Q1 --> Q2{"Dataset owner is me?"}
    Q2 -->|"Yes"| Q3["Claim hidden — separation of duties"]
    Q2 -->|"No"| Q4[["POST /datasets/{id}/claim-review → dataset in_review, review in_progress"]]
    Q4 --> Q5{"409 already claimed?"}
    Q5 -->|"Yes"| Q6["Toast: claimed by someone else, queue refreshes"]
    Q6 --> Q1
    Q5 -->|"No"| W1["Review Workspace /review/datasets/{reviewId} (#33)"]
    W1 --> W2["Select file: preview, metadata, scan + processing status, duplicate warnings"]
    W2 --> W3{"File eligible? ready, clean, not exact duplicate of accepted file, not container"}
    W3 -->|"No"| W4["Decision forced Rejected with system reason"]
    W3 -->|"Yes"| W5{"Reviewer decision"}
    W5 -->|"Accept"| W6[["PUT /reviews/{id}/files/{file_id} accepted (+ labeled_upgrade if offered)"]]
    W5 -->|"Reject"| W7[["PUT /reviews/{id}/files/{file_id} rejected + reason_code + comment"]]
    W4 --> W8
    W6 --> W8{"All files decided?"}
    W7 --> W8
    W8 -->|"No"| W2
    W8 -->|"Yes"| W9["Checklist + quality scores + data class PATCH /reviews/{id}"]
    W9 --> W10[["GET /reviews/{id}/summary → accepted GB, rejected GB, payable"]]
    W10 --> W11{"Leave without finishing?"}
    W11 -->|"Release"| W12[["POST /reviews/{id}/release → review released, dataset submitted"]]
    W12 --> Q1
    W11 -->|"Finalize"| F1["Finalize dialog: decision + feedback + type payable amount"]
    F1 --> F2{"Decision"}
    F2 -->|"Approve (all accepted)"| F3["dataset approved"]
    F2 -->|"Partial (mix)"| F4["dataset partially_approved"]
    F2 -->|"Reject"| F5["dataset rejected"]
    F2 -->|"Request changes"| F6["dataset changes_requested"]
    F3 --> F7[["POST /reviews/{id}/finalize (Idempotency-Key)"]]
    F4 --> F7
    F5 --> F7
    F6 --> F7
    F7 --> F8{"Payable > 0?"}
    F8 -->|"Yes"| F9(["Continue in Earnings approval flow"])
    F8 -->|"No"| F10{{"Notification: Dataset rejected / Changes requested"}}
    F10 --> F11["Contributor sees per-file reasons on /datasets/{id}?tab=feedback"]
    F11 --> F12{"changes_requested?"}
    F12 -->|"Yes"| F13["Contributor edits files/metadata on /datasets/{id}/upload, resubmits → new dataset_versions row, status submitted"]
    F13 --> Q1
    F12 -->|"No"| E1(["Review closed"])
```

## 5. Earnings approval

```mermaid
flowchart TD
    S1(["Review finalized with accepted files"]) --> E1[["Finance service in same transaction as finalize"]]
    E1 --> E2["For each accepted eligible file: floor(accepted_bytes × rate_micros_per_gb / 1e9)"]
    E2 --> E3{"File sha256 previously paid?"}
    E3 -->|"No"| E4["Earn full applicable rate (raw $1.00 / labeled $1.50 per GB)"]
    E3 -->|"Yes, raw paid and labeled upgrade ticked"| E5["Earn labeled − previously paid rate"]
    E3 -->|"Yes, otherwise"| E6["Earn 0 (recorded with reason)"]
    E4 --> E7["Insert earning_records with pricing rule version"]
    E5 --> E7
    E6 --> E7
    E7 --> E8{"earning_hold_days > 0?"}
    E8 -->|"No (default)"| E9[["Journal dataset_earning: user.available +X, system_dataset_purchases −X"]]
    E8 -->|"Yes"| E10[["Journal dataset_earning: user.pending +X, system_dataset_purchases −X"]]
    E10 --> E11[["Beat finance.release_pending (hourly) → journal earning_release pending→available"]]
    E9 --> E12{"Retry with same idempotency key dataset_review:{id}:earning?"}
    E11 --> E12
    E12 -->|"Yes"| E13["Existing journal returned — no duplicate credit"]
    E12 -->|"No"| E14{{"Notification: Dataset approved + Earnings credited"}}
    E13 --> E14
    E14 --> C1["Contributor Earnings /earnings (#20): Approved, Pending, Available updated"]
    C1 --> C2["Dataset Details /datasets/{id} shows accepted GB × rate = earned"]
    C2 --> X1(["Available balance can be withdrawn"])
```

Annotation rewards follow the same pattern with journal `annotation_reward` (see flow 10).

## 6. Withdrawal (contributor request)

```mermaid
flowchart TD
    S1(["Contributor opens Withdrawals /withdrawals (#21)"]) --> W1{"Eligible? verification approved, account active, ≥ 1 payout method, no open payout, available ≥ $10.00"}
    W1 -->|"No"| W2["Requirement checklist with links (Profile, Verification, Earnings)"]
    W2 --> E0(["Stop until requirements met"])
    W1 -->|"Yes"| W3["Request withdrawal dialog: amount + payout method"]
    W3 --> W4{"Amount valid? cents only, $10.00 ≤ amount ≤ $5,000.00, ≤ available"}
    W4 -->|"No"| W5["Inline error with limits"]
    W5 --> W3
    W4 -->|"Yes"| W6["Confirm summary (L2): amount reserved until resolved"]
    W6 --> W7[["POST /payouts with Idempotency-Key"]]
    W7 --> W8{"Server result"}
    W8 -->|"409 open payout exists or balance changed"| W9["Show server message, refresh wallet"]
    W9 --> W3
    W8 -->|"201"| W10[["Journal payout_reserve: available −X, reserved +X; status requested"]]
    W10 --> W11{{"Notification: Withdrawal requested (user + finance admins)"}}
    W11 --> W12["Withdrawal Details /withdrawals/{id} (#22) timeline"]
    W12 --> W13{"User cancels while requested?"}
    W13 -->|"Yes"| W14[["POST /payouts/{id}/cancel → cancelled; journal payout_release"]]
    W14 --> E1(["Amount back in Available"])
    W13 -->|"No"| W15(["Await admin decision — Payment recording flow"])
```

## 7. Payment recording (admin)

```mermaid
flowchart TD
    S1(["Finance admin opens Payout Requests /admin/payouts (#41)"]) --> P1["Payout Details /admin/payouts/{id} (#42)"]
    P1 --> P2{"Am I the recipient?"}
    P2 -->|"Yes"| P3["All actions hidden — separation of duties"]
    P2 -->|"No"| P4{"Decision on requested payout"}
    P4 -->|"Reject (L3 reason)"| P5[["POST /admin/payouts/{id}/reject → rejected; journal payout_release"]]
    P5 --> P6{{"Notification to user with reason"}}
    P4 -->|"Approve (L2)"| P7[["POST /admin/payouts/{id}/approve"]]
    P7 --> P8{"Amount ≥ dual-approval threshold ($100.00)?"}
    P8 -->|"Yes, first approval"| P9["Stays requested: 1 of 2 approvals"]
    P9 --> P10["Second distinct admin approves"]
    P10 --> P11["status approved"]
    P8 -->|"No, or second approval"| P11
    P11 --> P12{{"Notification: Withdrawal approved"}}
    P12 --> P13["Admin transfers money outside DataHub (bank / ABA Pay / Wise / PayPal)"]
    P13 --> P14{"Transfer succeeded?"}
    P14 -->|"No"| P15[["POST /admin/payouts/{id}/mark-failed (L3) → failed; journal payout_release"]]
    P14 -->|"Admin cancels instead"| P15b[["POST /admin/payouts/{id}/cancel (L3) → cancelled; journal payout_release"]]
    P14 -->|"Yes"| P16["Mark as paid dialog: payment reference, paid at, optional proof"]
    P16 --> P17{"Typed amount equals payout amount exactly?"}
    P17 -->|"No"| P16
    P17 -->|"Yes"| P18[["POST /admin/payouts/{id}/proof (if file) then POST /admin/payouts/{id}/mark-paid (Idempotency-Key)"]]
    P18 --> P19{"Reference unique for method?"}
    P19 -->|"No (409)"| P20["Error: reference already used — check for double payment"]
    P20 --> P16
    P19 -->|"Yes"| P21[["status paid; journal payout_settle: reserved −X, paid +X; payout_records row"]]
    P21 --> P22{{"Notification: Payment recorded (in-app + email)"}}
    P22 --> P23{"Payment later bounced?"}
    P23 -->|"Yes (super_admin, L4 typed amount)"| P24[["POST /admin/payouts/{id}/reverse → reversed; journal payout_reversal paid→available"]]
    P23 -->|"No"| E1(["Payout closed; full audit trail on #42 timeline"])
    P24 --> E1
```

## 8. Annotation assignment (admin)

```mermaid
flowchart TD
    S1(["Admin opens Annotation Projects /admin/annotation/projects (#35)"]) --> A1["Create project /admin/annotation/projects/new (#36)"]
    A1 --> A2["Step basics: name, instructions (markdown), deadline"]
    A2 --> A3["Step sources: choose approved / partially approved datasets (accepted annotatable files only)"]
    A3 --> A4["Step schema: annotation types, label set, metadata schema"]
    A4 --> A5["Step rewards: task unit file or page, reward per task / per page"]
    A5 --> A6["Review + Create POST /annotation/projects"]
    A6 --> A7[["POST /annotation/projects/{id}/generate-tasks → tasks unassigned"]]
    A7 --> A8["Assignments /admin/annotation/assignments?project={id} (#38)"]
    A8 --> A9["Select tasks + annotator (Combobox shows verified annotators with workload)"]
    A9 --> A10{"Annotator verified and holds annotator role?"}
    A10 -->|"No"| A11["Not selectable — reason tooltip"]
    A11 --> A9
    A10 -->|"Yes"| A12{"Single or bulk?"}
    A12 -->|"Single"| A13[["POST /annotation/tasks/{id}/assign"]]
    A12 -->|"Bulk"| A14[["POST /annotation/tasks/bulk-assign"]]
    A13 --> A15["Task status assigned"]
    A14 --> A15
    A15 --> A16{{"Notification: Annotation assigned"}}
    A16 --> A17{"Need to reassign later?"}
    A17 -->|"Yes (L2)"| A18[["POST /annotation/tasks/{id}/unassign → unassigned; draft kept as version"]]
    A18 --> A9
    A17 -->|"No"| E1(["Monitor progress on Project Details (#37)"])
```

## 9. Annotation completion (annotator)

```mermaid
flowchart TD
    S1(["Annotator receives assignment"]) --> N1["Annotator Dashboard /annotate (#49) or My Tasks /annotate/tasks (#50)"]
    N1 --> N2["Task Details /annotate/tasks/{id} (#51): instructions, reward, deadline"]
    N2 --> N3{"Screen ≥ 1024 px?"}
    N3 -->|"No"| N4["Read-only notice: open on a computer to edit"]
    N3 -->|"Yes"| N5["Annotation Editor /annotate/tasks/{id}/edit (#52)"]
    N5 --> N6{"Task assigned (first open)?"}
    N6 -->|"Yes"| N7[["POST /annotation/tasks/{id}/start → in_progress"]]
    N6 -->|"No"| N8{"Local IndexedDB draft newer than server?"}
    N7 --> N9
    N8 -->|"Yes"| N10["Dialog: Restore unsaved local changes or Discard"]
    N10 --> N9
    N8 -->|"No"| N9["Work: transcribe, correct, label, metadata, notes per page"]
    N9 --> N11[["Autosave after 5 s idle or blur: PUT /annotation/tasks/{id}/draft with If-Match version"]]
    N11 --> N12{"Response"}
    N12 -->|"200"| N13["Saved · version n+1"]
    N12 -->|"409 version conflict"| N14["Conflict banner: compare server vs mine, choose per field"]
    N14 --> N11
    N12 -->|"Network error"| N15["Offline — kept locally, retry with backoff"]
    N15 --> N11
    N13 --> N16{"All pages done?"}
    N16 -->|"No"| N9
    N16 -->|"Yes"| N17["Submit (Ctrl Enter) → validation summary"]
    N17 --> N18{"Validation errors?"}
    N18 -->|"Yes"| N19["Checks popover lists missing fields/pages"]
    N19 --> N9
    N18 -->|"No"| N20[["POST /annotation/tasks/{id}/submit → submitted"]]
    N20 --> N21["Editor read-only; task in Submitted /annotate/submitted (#53)"]
    N21 --> N22(["Await review — Annotation review flow"])
```

## 10. Annotation review

```mermaid
flowchart TD
    S1(["Reviewer opens Annotation Review Tasks /review/annotations (#58)"]) --> R1{"Annotator is me?"}
    R1 -->|"Yes"| R2["Hidden from my queue — separation of duties"]
    R1 -->|"No"| R3[["POST /annotation/tasks/{id}/claim-review → in_review"]]
    R3 --> R4["Annotation Comparison /review/annotations/{taskId} (#59)"]
    R4 --> R5["Inspect source page vs transcription; compare versions; check labels and metadata"]
    R5 --> R6["Add comments (general + per page) and score"]
    R6 --> R7{"Decision"}
    R7 -->|"Request changes"| R8[["POST /annotation/tasks/{id}/review request_changes"]]
    R8 --> R9["Task changes_requested"]
    R9 --> R10{{"Notification: Annotation returned for correction"}}
    R10 --> R11["Annotator sees comments in Feedback /annotate/feedback (#54) and editor"]
    R11 --> R12["Annotator corrects in editor → in_progress → submits again"]
    R12 --> S1
    R7 -->|"Approve"| R13[["POST /annotation/tasks/{id}/review approve (Idempotency-Key)"]]
    R13 --> R14["Task approved; annotation_rewards row (per task or per page)"]
    R14 --> R15[["Journal annotation_reward: user.available +X, system_annotation_labor −X; key annotation_review:{id}:reward"]]
    R15 --> R16{{"Notification: Annotation approved + Earnings credited"}}
    R16 --> R17["Annotation Earnings /annotate/earnings (#55) and /earnings updated"]
    R17 --> E1(["Approved annotation exportable with source file"])
```

## 11. Dataset export

```mermaid
flowchart TD
    S1(["Admin opens Export Center /admin/exports (#45)"]) --> X1["New export (sheet ?new=1)"]
    X1 --> X2["Select datasets or filters: category, language, min quality, status approved / partially approved"]
    X2 --> X3["Choose content: raw files, labeled data, metadata, annotations (approved only), normalized text copy"]
    X3 --> X4["Choose format: ZIP with JSONL manifest or ZIP with CSV manifest"]
    X4 --> X5["Preview: dataset count, file count, total size"]
    X5 --> X6{"Confirm (L2)"}
    X6 -->|"Cancel"| S1
    X6 -->|"Start"| X7[["POST /admin/exports → export_jobs queued; audit log who/when/which datasets"]]
    X7 --> X8[["Worker exports.build_export → running (progress)"]]
    X8 --> X9{"Build result"}
    X9 -->|"Failed"| X10["Job failed with error; Retry creates a new job"]
    X10 --> X1
    X9 -->|"Completed"| X11{{"Notification to requesting admin: Export ready"}}
    X11 --> X12["Job row Ready to download (expires in 7 days)"]
    X12 --> X13[["POST /admin/exports/{id}/download-url → presigned URL (5 min)"]]
    X13 --> X14["Browser downloads ZIP; download event audited"]
    X14 --> X15{"After 7 days"}
    X15 --> X16[["exports.expire → expired; object deleted"]]
    X16 --> E1(["Job history retained, file no longer downloadable"])
```

## 12. Support messaging

```mermaid
flowchart TD
    S1(["User needs help"]) --> M1{"Context"}
    M1 -->|"About a dataset"| M2["Dataset Details /datasets/{id} → Message support (dataset linked)"]
    M1 -->|"General"| M3["Messages /messages (#23) → New conversation"]
    M2 --> M4["Compose subject + message + optional attachments (≤ 10 MB each)"]
    M3 --> M4
    M4 --> M5[["POST /conversations then POST /conversations/{id}/messages"]]
    M5 --> M6{"Attachments?"}
    M6 -->|"Yes"| M7[["POST /conversations/{id}/attachments → scanned before visible (shows Scanning…)"]]
    M6 -->|"No"| M8["conversation open"]
    M7 --> M8
    M8 --> M9{{"WS message.created + Notification: New support message (admins)"}}
    M9 --> A1["Admin Messaging /admin/messages (#44) inbox, filter Open"]
    A1 --> A2["Open /admin/messages/{id}: thread + user context panel (status, verification, linked dataset)"]
    A2 --> A3[["Admin replies POST /conversations/{id}/messages; PATCH status awaiting_user"]]
    A3 --> A4{{"Notification + email to user: New support message"}}
    A4 --> U1["User reads /messages/{id}; POST /conversations/{id}/read"]
    U1 --> U2{"Issue resolved?"}
    U2 -->|"No, user replies"| U3["status awaiting_user → open"]
    U3 --> A1
    U2 -->|"Yes"| A5["Admin closes conversation (L2) PATCH status closed"]
    A5 --> A6{"User replies after close?"}
    A6 -->|"Yes"| U3
    A6 -->|"No"| E1(["Conversation closed; history retained"])
```
