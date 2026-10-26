# Wireframes 04 — Admin core

| Field | Value |
|---|---|
| Document | #16 Wireframes — part 04 (admin core) |
| Version | v1.0 · 2026-10-26 · Baseline |
| Pages | #27–#32, #34–#39, #45–#48 |

**Purpose.** Layouts for platform administration other than finance: dashboard, users, verification, datasets, review queue, annotation management, exports, analytics, audit and settings. **Scope.** Routes under `/admin` listed in UI_UX_DESIGN §3 except finance (#40–#43, see 05) and messaging (#44, see 08). **Assumptions.** Admin sessions are MFA-verified; sidebar shows the Admin workspace groups (UI_UX_DESIGN §5.2); tables default to comfortable density, compact toggle available. **Decisions.** Detail views that are quick decisions (verification cases, export jobs) open in right sheets with URL state; heavier entities (users, datasets, projects) get full pages. Super-admin-only controls are absent (not disabled) for admins. **Dependencies.** UI_UX_DESIGN §4, §6.4, §12; USER_FLOWS §2, §4, §8, §11. **Acceptance criteria.** Every filter maps to an API query param; destructive actions show the confirmation level from UI_UX_DESIGN §12.

---

## Admin sidebar

```
┌───────────────────────┐
│ ▤ DataHub             │
│ [⛨ Admin          ▾]  │
│ OVERVIEW              │
│ ▌⌂ Dashboard          │
│  ▥ Analytics          │
│ PEOPLE                │
│  ☺ Users              │
│  ✓ Verifications   7  │
│ DATA                  │
│  ⛁ All datasets       │
│  ☑ Review queue   12  │
│  ⇩ Exports            │
│ ANNOTATION            │
│  ✎ Projects           │
│  ⇄ Assignments        │
│  ☑ Review queue    5  │
│ FINANCE               │
│  ▣ Overview           │
│  ¤ Payouts         4  │
│  ⌗ Pricing            │
│ SUPPORT               │
│  ✉ Inbox           3  │
│ SYSTEM (super admin)  │
│  ≣ Audit logs         │
│  ⚙ Settings           │
└───────────────────────┘
```

## #27 Admin Dashboard — `/admin`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Admin dashboard                                              Period [Last 30 days ▾]         │
│ ┌ Verifications ─────┐ ┌ Dataset reviews ───┐ ┌ Payouts ───────────┐ ┌ Support ───────────┐  │
│ │ 7 pending          │ │ 12 awaiting        │ │ 3 requested        │ │ 3 open             │  │
│ │ oldest 2 days      │ │ oldest 5 days ⚠    │ │ 1 approved, unpaid │ │ 1 awaiting > 24h ⚠ │  │
│ │ [Open queue →]     │ │ [Open queue →]     │ │ [Open payouts →]   │ │ [Open inbox →]     │  │
│ └────────────────────┘ └────────────────────┘ └────────────────────┘ └────────────────────┘  │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐                 │
│ │ RECEIVED     │ ACCEPTED     │ CREDITED     │ PAID OUT     │ LIABILITY    │                 │
│ │ 412 GB       │ 287 GB · 70% │ $331.42      │ $210.00      │ $305.92      │                 │
│ │ ▲ 18% vs prev│ ▲ 4 pts      │ ▲ 22%        │ ▲ 9%         │ avail + res. │                 │
│ └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘                 │
│ ┌ Uploaded vs accepted (GB / day) ──────────────┐ ┌ Credited vs paid ($ / week) ────────────┐ │
│ │ area chart: chart-1 uploaded, chart-2 accepted│ │ bars: chart-2 credited, chart-1 paid    │ │
│ │ [View as table]                               │ │ [View as table]                         │ │
│ └───────────────────────────────────────────────┘ └─────────────────────────────────────────┘ │
│ ┌ Reconciliation ─────────────┐ ┌ Background jobs ───────────┐ ┌ Recent audit (super admin)┐ │
│ │ ✓ Ledger balanced           │ │ 0 failed in 24 h           │ │ Lina approved PO-7F3A2B   │ │
│ │ Last run 26 Oct 02:00       │ │ 2 retried (processing)     │ │ Rithy published price v2  │ │
│ │ [Details →]                 │ │                            │ │ [All logs →]              │ │
│ └─────────────────────────────┘ └────────────────────────────┘ └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #28 User Management — `/admin/users`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Users                                                                     [Export CSV]       │
│ ⌕ {Name or email…}  Role [All ▾]  Status [All ▾]  Verification [All ▾]  Joined [Any ▾]        │
│ ┌──────────────────────────────┬──────────────────┬───────────┬──────────────┬────────┬────┐ │
│ │ User                         │ Roles            │ Status    │ Verification │ Joined │    │ │
│ ├──────────────────────────────┼──────────────────┼───────────┼──────────────┼────────┼────┤ │
│ │ (SC) Sophea Chan             │ Contributor      │[● Active] │[● Verified]  │ 02 Sep │ ⋯  │ │
│ │      sophea@example.com      │ Annotator        │           │              │        │    │ │
│ │ (DK) Dara Keo                │ Contributor      │[● Active] │[● Pending]   │ 20 Oct │ ⋯  │ │
│ │ (VS) Vannak Sok              │ Reviewer         │[● Active] │[● Not verif.]│ 01 Aug │ ⋯  │ │
│ │ (??) m.t@example.org         │ Contributor      │[● Email   │[● Not verif.]│ 26 Oct │ ⋯  │ │
│ │                              │                  │ unverified]                │        │    │ │
│ │ (PL) Piseth Long             │ Contributor      │[● Suspend.]│[● Rejected] │ 11 Jun │ ⋯  │ │
│ └──────────────────────────────┴──────────────────┴───────────┴──────────────┴────────┴────┘ │
│ 1–25 of 1,240                                                  Rows [25 ▾]   ‹ 1 2 3 … 50 ›  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Row ⋯: Open · Message user · Suspend / Reactivate · Revoke sessions
```

## #29 User Details — `/admin/users/[id]`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Users › Dara Keo                                                                 ‹ prev next ›│
│ (DK) Dara Keo  dara@example.com  US-1E44A0 ⧉   [● Active] [● Verification pending]            │
│ Joined 20 Oct 2026 · Last active 2 h ago · Cambodia     [💬 Message] [Suspend] [⋯ More]       │
│ [Overview] [Datasets 4] [Finance] [Roles] [Sessions 2] [Activity]                            │
│ ┌ Profile ─────────────────────────────────┐ ┌ Wallet ──────────────────────────────────────┐│
│ │ Legal name   Dara Keo / កែវ ដារ៉ា          │ │ Available $14.50 · Reserved $0.00            ││
│ │ DOB          1992-05-02 (34)             │ │ Paid $0.00 · Approved $14.50                 ││
│ │ Phone        +855 12 888 001             │ │ [View ledger] [+ Adjustment] (super admin)   ││
│ │ Onboarding   ✓ Agreement v1.0, 20 Oct    │ └──────────────────────────────────────────────┘│
│ │ Payout       ABA Pay ••• 771             │ ┌ Verification ────────────────────────────────┐│
│ └──────────────────────────────────────────┘ │ Submitted 21 Oct · pending  [Open case →]    ││
│                                              └──────────────────────────────────────────────┘│
│ Roles tab:                                                                                   │
│ [x] Contributor (always)  [x] Annotator  [ ] Reviewer  [ ] Admin*  [ ] Super admin*          │
│ *super admin only. Granting admin roles → L4 type user email.         [Save roles]           │
│ Sessions tab: device · IP (masked /24) · created · last seen · [Revoke]; [Revoke all] (L2)   │
│ Activity tab: audit entries for this user (super admin) / security events summary.           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Suspend dialog (L3): reason (required, sent to user) · "All sessions will be signed out." [Suspend user]
```

## #30 Contributor Verification — `/admin/verifications`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Verifications                                                                                │
│ [Pending 7] [More info needed 2] [Approved] [Rejected]        ⌕ {Name or email}              │
│ ┌──────────────────────────┬─────────────┬──────────────┬─────────────────┬────────────────┐ │
│ │ Applicant                │ Country     │ Submitted ↕  │ ID document     │ Status         │ │
│ │ Dara Keo                 │ Cambodia    │ 21 Oct (5d)  │ ✓ attached      │ [● Pending]    │ │
│ │ Sreyneang Phal           │ Cambodia    │ 24 Oct (2d)  │ — none          │ [● Pending]    │ │
│ └──────────────────────────┴─────────────┴──────────────┴─────────────────┴────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Case sheet (?case=<id>, 640 px):
 ┌ Verification · Dara Keo ──────────────────────────────────────────── ✕ ┐
 │ Legal name     Dara Keo / កែវ ដារ៉ា         Age 34 ✓ (18+)              │
 │ Country        Cambodia                  Phone +855 12 888 001        │
 │ Payout method  ABA Pay · Dara Keo ••• 771 (name matches ✓)            │
 │ ┌ ID document ─────────────────────────────────────────────────────┐  │
 │ │ ░░░░░░░░ image preview (presigned, 5 min) ░░░░░░░  [⤢] [⟳]       │  │
 │ └──────────────────────────────────────────────────────────────────┘  │
 │ History: no previous submissions                                      │
 │ Decision                                                              │
 │ (•) Approve  ( ) Needs more info  ( ) Reject                          │
 │ Message to applicant (required for Needs info / Reject)               │
 │ {..................................................................}  │
 │ ═════════════════════════════════════════════════════════════════════ │
 │ [Cancel]                                   [Approve verification]      │
 └───────────────────────────────────────────────────────────────────────┘
 After decision: next pending case opens automatically ("Next case →" toast with undo-free note).
```

## #31 All Datasets — `/admin/datasets`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ All datasets                                                         [⇩ Export selected]     │
│ ⌕ {Title, ID, owner email…}  Status [Any ▾]  Class [Any ▾]  Language [Any ▾]                 │
│ Category [Any ▾]  Min quality [Any ▾]  Owner [Any ▾]  Submitted [From – To]  [Clear]          │
│ ┌──┬──────────────────────────┬────────────┬──────────────┬────────┬────────┬───────┬──────┐ │
│ │[ ]│ Dataset                 │ Owner      │ Status       │ Size   │ Quality│ Lang  │ Subm.│ │
│ ├──┼──────────────────────────┼────────────┼──────────────┼────────┼────────┼───────┼──────┤ │
│ │[ ]│ សៀវភៅសិក្សា ថ្នាក់ទី៩     │ Sophea C.  │[● In review] │ 4.21 GB│ —      │ km    │ 25 Oct││
│ │   │ DS-3F9A1C · Raw · Edu.  │            │              │        │        │       │      │ │
│ │[ ]│ Newspapers 1998          │ Sophea C.  │[● Approved]  │ 2.40 GB│ 4.2/5  │ km    │ 20 Oct││
│ │[ ]│ Legal forms EN/KM        │ Dara K.    │[● Submitted] │ 0.92 GB│ —      │ km,en │ 26 Oct││
│ └──┴──────────────────────────┴────────────┴──────────────┴────────┴────────┴───────┴──────┘ │
│ 1–25 of 318                                                                   ‹ 1 2 … 13 ›   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 "Export selected" opens Export Center builder prefilled with the selected datasets.
```

## #32 Dataset Details (admin) — `/admin/datasets/[id]`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ All datasets › Newspapers 1998                                                               │
│ Newspapers 1998   [● Approved]  DS-51D2B7 ⧉                [💬 Message owner] [⋯ Take down]  │
│ Owner Sophea Chan · Khmer · News · Raw · 112 files · 2.40 GB · v1 · quality 4.2/5            │
│ ┌ Metadata ────────────────────────────┐ ┌ Earnings ────────────────────────────────────────┐ │
│ │ Description (text-content)            │ │ Accepted 2.400 GB · Rejected 0.000 GB           │ │
│ │ Source & rights statement             │ │ Rate $1.00/GB (rule v1) · Earned $2.40          │ │
│ │ Licence: DataHub contributor licence  │ │ Journal dataset_review:RV-1C9F02:earning ⧉      │ │
│ │ Custom metadata (key/value)           │ └──────────────────────────────────────────────────┘ │
│ └───────────────────────────────────────┘                                                    │
│ [Files 112] [Reviews 1] [Duplicates 0] [Activity]                                            │
│ ┌──────────────────────────┬────────┬─────────────────┬───────────┬────────────┬───────────┐ │
│ │ File                     │ Size   │ Detected type   │ Processing│ Scan       │ Decision  │ │
│ │ 📄 1998-01-03.pdf        │ 21 MB  │ application/pdf │ [● Ready] │ [● Clean]  │[● Accepted]│ │
│ │ 📄 1998-01-04.pdf        │ 22 MB  │ application/pdf │ [● Ready] │ [● Scan    │[● Accepted]│ │
│ │                          │        │                 │           │   error] ⋯ │           │ │
│ └──────────────────────────┴────────┴─────────────────┴───────────┴────────────┴───────────┘ │
│ File row ⋯: Preview (sheet) · Download original (presigned) · Rescan (scan error/pending)    │
│ Datasets in `submitted` show [Claim review] in header (hidden if admin is the owner).        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Take down (L4): reason (required) + "Type DS-51D2B7 to confirm" → [Take down dataset]
```

## #34 Review Queue (admin) — `/admin/reviews`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Dataset review queue                                                                         │
│ [Awaiting 12] [In review 4]        Class [Any ▾]  Language [Any ▾]   Sort [Oldest first ▾]   │
│ ┌──────────────────────────┬────────────┬────────┬───────┬──────────┬────────────┬─────────┐ │
│ │ Dataset                  │ Owner      │ Size   │ Files │ Waiting  │ Claimed by │         │ │
│ │ Legal forms EN/KM        │ Dara K.    │ 0.92 GB│ 31    │ [5 days] │ —          │ [Claim] │ │
│ │ Market price lists       │ Kosal R.   │ 1.40 GB│ 120   │ [3 days] │ —          │ [Claim] │ │
│ │ សៀវភៅសិក្សា ថ្នាក់ទី៩     │ Sophea C.  │ 4.21 GB│ 38    │ 1 day    │ Vannak S.  │ [Open]  │ │
│ └──────────────────────────┴────────────┴────────┴───────┴──────────┴────────────┴─────────┘ │
│ Waiting chip: neutral < 3 days, warning 3–7 days, danger > 7 days.                           │
│ [Claim] → POST /datasets/{id}/claim-review → /review/datasets/{reviewId} (#33).              │
│ Own datasets show "Your dataset" instead of Claim.                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #35 Annotation Projects — `/admin/annotation/projects`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Annotation projects                                                     [+ New project]      │
│ [Active 3] [Closed 5]                ⌕ {Project name}                                        │
│ ┌────────────────────────────┬──────────────────────┬──────────────────────────┬──────┬────┐ │
│ │ Project                    │ Types                │ Progress                 │ Due  │    │ │
│ │ Khmer textbook OCR gold    │ Transcription, Page  │ ▓▓░░░░░░░░ 655/3,140 appr│ 30 Nov│ ⋯ │ │
│ │ PR-0D11F3 · per page $0.05 │ label                │ 80 in review · 25 return.│      │    │ │
│ │ Receipts classification    │ Classification,      │ ▓▓▓▓▓▓▓▓▓░ 1,820/2,000   │ 15 Nov│ ⋯ │ │
│ │ PR-77A0B2 · per task $0.02 │ Metadata             │                          │      │    │ │
│ └────────────────────────────┴──────────────────────┴──────────────────────────┴──────┴────┘ │
│ Progress bar segments: approved (teal) · in review (sky) · in progress (indigo) · returned   │
│ (amber) · unassigned (slate); legend + exact counts in tooltip.                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #36 Create Annotation Project — `/admin/annotation/projects/new`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Annotation projects › New project                                                            │
│ ① Basics ── ② Source datasets ── ③ Annotation schema ── ④ Tasks & rewards ── ⑤ Review        │
│                                                                                              │
│ ② Source datasets                                                                            │
│ Only approved / partially approved datasets; only accepted, annotatable files are used.      │
│ ⌕ {Search datasets}  Language [km ▾]  Category [Any ▾]                                       │
│ ┌──┬────────────────────────────┬──────────────┬───────────────┬───────────────────────────┐ │
│ │[x]│ Newspapers 1998           │ [● Approved] │ 112 files     │ 112 annotatable · 3,140 pp│ │
│ │[ ]│ Village survey forms      │ [● Partially]│ 48 accepted   │ 48 annotatable · 48 pp    │ │
│ └──┴────────────────────────────┴──────────────┴───────────────┴───────────────────────────┘ │
│ Selected: 1 dataset · 112 files · 3,140 pages                                                │
│                                                                                              │
│ ③ Annotation schema                                                                          │
│ Types  [x] Transcription  [x] Text correction  [ ] Classification  [x] Metadata  [x] Page label│
│ Page labels {cover} {article} {advertisement} {blank} [+ add]                                │
│ Metadata fields                                                                              │
│ │ Key          │ Label          │ Type    │ Options             │ Required │                 │
│ │ pub_date     │ Publication    │ date    │ —                   │ [x]      │ ✕               │
│ │ section      │ Section        │ select  │ politics, economy…  │ [ ]      │ ✕               │
│ [+ Add field]                                                                                │
│                                                                                              │
│ ④ Tasks & rewards                                                                            │
│ Task unit (•) Page  ( ) File          Reward per page $ {0.05}   per task $ {0.00}            │
│ Deadline {30/11/2026}   Review required ✓ (always in v1)                                     │
│ Estimate: 3,140 tasks × $0.05 = $157.00 maximum annotation cost                              │
│                                                                                              │
│ ═════════════════════════════════════════════════════════════════════════════════════════════ │
│ [← Back]                                                 [Create project & generate tasks]   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 ① Basics: name, instructions (markdown editor with preview, Khmer-capable), deadline.
 ⑤ Review: read-only summary of all steps with [Edit] links.
```

## #37 Annotation Project Details — `/admin/annotation/projects/[id]`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Projects › Khmer textbook OCR gold   [● Active]  PR-0D11F3        [Assign tasks] [⋯ Close]   │
│ Due 30 Nov 2026 · per page $0.05 · 3,140 tasks · 6 annotators                                │
│ [Overview] [Tasks] [Settings]                                                                │
│ ┌───────────┬───────────┬───────────┬───────────┬───────────┬───────────┬───────────┐        │
│ │Unassigned │ Assigned  │In progress│ Submitted │ In review │ Returned  │ Approved  │        │
│ │ 1,210     │ 640       │ 410       │ 120       │ 80        │ 25        │ 655       │        │
│ └───────────┴───────────┴───────────┴───────────┴───────────┴───────────┴───────────┘        │
│ ┌ Throughput (approved / day) ────────────────┐ ┌ Annotators ─────────────────────────────┐  │
│ │ line chart                                  │ │ Dara K.   assigned 120 · approved 98 · │  │
│ └─────────────────────────────────────────────┘ │           returned 4 · avg score 4.6   │  │
│                                                 └─────────────────────────────────────────┘  │
│ Tasks tab = same table as #38 filtered to this project.                                      │
│ Settings tab = name, instructions, deadline (PATCH). Annotation types, schema and rewards are│
│ shown read-only once tasks exist, so every task in a project is paid and validated alike.   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Close project (L3): "2,485 tasks that are not approved will be cancelled." reason → [Close project]
```

## #38 Annotation Assignments — `/admin/annotation/assignments`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Assignments                     Project [Khmer textbook OCR gold ▾]                          │
│ Status [Unassigned ▾]  Annotator [Any ▾]  Source [Any dataset ▾]   ⌕ {File name}             │
│ ┌──┬──────────────┬──────────────────────────┬──────┬───────────────┬──────────────┬───────┐ │
│ │[x]│ Task        │ Source                   │ Page │ Status        │ Annotator    │       │ │
│ │[x]│ TK-0A1102   │ 1998-01-03.pdf           │ 1    │ [● Unassigned]│ —            │ ⋯     │ │
│ │[x]│ TK-0A1103   │ 1998-01-03.pdf           │ 2    │ [● Unassigned]│ —            │ ⋯     │ │
│ │[ ]│ TK-0A0F77   │ 1998-01-02.pdf           │ 7    │ [● In progress]│ Dara K.     │ ⋯     │ │
│ └──┴──────────────┴──────────────────────────┴──────┴───────────────┴──────────────┴───────┘ │
│ ═ 2 selected ═══ Assign to [Select annotator ▾]  [Assign]   [Unassign]   [Clear] ═══════════  │
│                                                                                              │
│ Annotator picker (Combobox): name · verified ✓ · current load "38 open tasks" · avg score.   │
│ Unverified or non-annotator users are listed disabled with reason.                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Reassign (row ⋯ on assigned/in_progress) → L2: "Dara's draft is kept; the new annotator
 continues from it." → unassign + assign.
```

## #39 Annotation Review Queue (admin) — `/admin/annotation/reviews`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Annotation review queue                Project [All ▾]  Annotator [Any ▾]  Sort [Oldest ▾]   │
│ ┌──────────────┬───────────────────────────┬──────────────┬────────────┬──────────┬────────┐ │
│ │ Task         │ Project / source          │ Annotator    │ Submitted  │ Claimed  │        │ │
│ │ TK-0A0E10    │ Textbook OCR · p.14       │ Dara K.      │ 26 Oct 08:01│ —       │ [Claim]│ │
│ │ TK-0A0E11    │ Textbook OCR · p.15       │ Dara K.      │ 26 Oct 08:20│ Vannak S.│ —      │ │
│ └──────────────┴───────────────────────────┴──────────────┴────────────┴──────────┴────────┘ │
│ [Claim] → /review/annotations/{taskId} (#59). Same table component as reviewer #58.          │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #45 Dataset Export Center — `/admin/exports`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Exports                                                                [+ New export]        │
│ Exports are private, expire after 7 days, and every download is logged.                      │
│ ┌──────────┬─────────────────────────────────┬──────────────┬──────────────────┬──────────┐  │
│ │ Export   │ Contents                        │ Requested    │ Status           │          │  │
│ │ EX-90F1A2│ 3 datasets · labeled + annot.   │ Rithy · 1h   │ [● Building] 62% │ ⋯        │  │
│ │ EX-90E004│ 12 datasets · raw + metadata    │ Lina · 2d    │ [● Ready]  6.1 GB│[Download]│  │
│ │          │                                 │              │ expires in 5 d   │          │  │
│ │ EX-8F77C3│ 1 dataset · raw                 │ Lina · 9d    │ [● Expired]      │ ⋯        │  │
│ └──────────┴─────────────────────────────────┴──────────────┴──────────────────┴──────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 New export sheet (?new=1, 640 px):
 ┌ New export ─────────────────────────────────────────────────────────── ✕ ┐
 │ 1 Datasets   (•) Select datasets [3 selected ▾]   ( ) By filter         │
 │              Filter: Category [Any ▾] Language [km ▾] Min quality [4 ▾] │
 │              Status ✓ Approved ✓ Partially approved                     │
 │ 2 Content    [x] Raw files (accepted only)   [x] Labeled data           │
 │              [x] Dataset metadata  [x] Approved annotations             │
 │              [x] Normalized text copy (NFC) alongside verbatim          │
 │ 3 Format     (•) ZIP + JSONL manifest   ( ) ZIP + CSV manifest           │
 │ Preview      3 datasets · 260 files · 8.42 GB · 655 annotations         │
 │ ═══════════════════════════════════════════════════════════════════════ │
 │ [Cancel]                                          [Start export] (L2)   │
 └─────────────────────────────────────────────────────────────────────────┘
 Job sheet (?job=<id>): parameters, datasets list, progress, error (failed), audit of downloads.
```

## #46 Analytics — `/admin/analytics`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Analytics                                    [From 01 Oct 2026] – [To 26 Oct 2026]  [Apply]  │
│ ┌ Data ───────────────────────────────────────────────────────────────────────────────────┐  │
│ │ KPIs: received 412 GB · accepted 287 GB · acceptance 70% · duplicates 18 GB · infected 3 │  │
│ │ [area: bytes received vs accepted per day]   [stacked bar: datasets by final decision]   │  │
│ │ [h-bar: top languages by accepted GB]        [h-bar: top categories by accepted GB]      │  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Money ──────────────────────────────────────────────────────────────────────────────────┐  │
│ │ credited $331.42 · paid $210.00 · liability $305.92 · avg payout time 2.4 days          │  │
│ │ [bars: credited vs paid per week]            [line: liability over time]                │  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Work ───────────────────────────────────────────────────────────────────────────────────┐  │
│ │ review turnaround median 2.1 d · annotation approved 655 · return rate 4%               │  │
│ │ [line: reviews finalized per day]            [bars: annotation approved per annotator]  │  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ Every chart: title, text summary, [View as table], [Download CSV].                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #47 Audit Logs — `/admin/audit-logs` (super admin)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Audit logs                                                                                   │
│ [Audit trail] [Security events]                                                              │
│ Actor [Any ▾]  Action [Any ▾]  Entity type [Any ▾]  Entity ID {…}  [From – To]  Density [▤]  │
│ ┌──────────────────┬──────────────┬──────────────────────┬──────────────────┬──────────────┐ │
│ │ Time (local)     │ Actor        │ Action               │ Entity           │ Request      │ │
│ │ 26 Oct 11:30:02  │ Lina H.      │ payout.approve       │ PO-7F3A2B        │ 7c1e…a90 ⧉  │ │
│ │ 26 Oct 10:02:45  │ Rithy S.     │ pricing_rule.create  │ labeled v2       │ 12aa…003 ⧉  │ │
│ │ 26 Oct 09:58:13  │ system       │ dataset.process      │ DS-3F9A1C        │ —            │ │
│ └──────────────────┴──────────────┴──────────────────────┴──────────────────┴──────────────┘ │
│ Row click → sheet: before/after JSON diff (red/teal line markers + −/+ prefixes), IP, UA.    │
│ Security events tab: time · user · event (login_failed, mfa_failed, session_revoked …) ·     │
│ severity badge · IP.                                                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #48 System Settings — `/admin/settings` (super admin)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ System settings                                                                              │
│ [General] [Uploads] [Finance] [Annotation] [Roles & permissions]                             │
│ ┌ Uploads ────────────────────────────────────────────────────────────────────────────────┐  │
│ │ max_file_bytes             5,000,000,000  (5.00 GB)               [Edit]                │  │
│ │ max_dataset_bytes          50,000,000,000 (50.0 GB)               [Edit]                │  │
│ │ user_pending_quota_bytes   200,000,000,000 (200 GB)               [Edit]                │  │
│ │ extra_allowed_extensions   — none —                               [Edit]                │  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ Finance tab: min/max withdrawal (money input), earning_hold_days, payout_dual_approval_      │
│ threshold. General tab: maintenance_mode (switch + message + expected end), support email.   │
│ Each edit: inline editor with typed validation → confirm dialog showing old → new → PUT.     │
│ Roles & permissions: read-only matrix from GET /admin/roles (role × permission ✓).           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
