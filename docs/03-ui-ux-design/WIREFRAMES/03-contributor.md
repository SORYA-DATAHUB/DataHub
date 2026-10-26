# Wireframes 03 — Contributor workspace

| Field | Value |
|---|---|
| Document | #16 Wireframes — part 03 (contributor) |
| Version | v1.0 · 2026-10-26 · Baseline |
| Pages | App shell, #15–#22, #25 |

**Purpose.** Layouts for the contributor journey: dashboard, upload, datasets, earnings and withdrawals, profile. **Scope.** `/dashboard`, `/datasets/new`, `/datasets/[id]/upload`, `/datasets`, `/datasets/[id]`, `/earnings`, `/withdrawals`, `/withdrawals/[id]`, `/profile`. **Assumptions.** Desktop drawings at 1440 px with full sidebar; mobile variants shown where layout changes materially. **Decisions.** Money figures follow DESIGN_SYSTEM §12 (floor to cents, `≈` for estimates); sizes follow §13 (`formatGB` 3 dp in financial context). **Dependencies.** UI_UX_DESIGN §4 (endpoints), §6.1 (dashboard), §8 (upload), §12 (confirmations); USER_FLOWS §3, §5, §6. **Acceptance criteria.** Every wireframed action maps to an endpoint in UI_UX_DESIGN §4; every list has empty/loading/error states per UI_UX_DESIGN §11.

---

## App shell (all authenticated workspaces)

```
┌───────────────────────┬──────────────────────────────────────────────────────────────────────────────┐
│ ▤ DataHub             │ Contribute › Dashboard            [⌕ Search…  Ctrl K]   🔔3  💬•  ◐  (SC ▾) │
│ ┌───────────────────┐ ├──────────────────────────────────────────────────────────────────────────────┤
│ │ ◫ Contribute    ▾ │ │                                                                              │
│ └───────────────────┘ │                                                                              │
│ OVERVIEW              │                                                                              │
│ ▌⌂ Dashboard          │                         page content                                         │
│ DATA                  │                                                                              │
│  ⛁ My datasets        │                                                                              │
│  ⇪ Upload dataset     │                                                                              │
│ MONEY                 │                                                                              │
│  ▣ Earnings           │                                                                              │
│  ¤ Withdrawals        │                                                                              │
│ PERSONAL              │                                                                              │
│  ✉ Messages        2  │                                                                              │
│  🔔 Notifications      │                                                                              │
│  ☺ Profile            │                                                                              │
│  ⚙ Settings           │                                                                              │
│                       │                                                                              │
│ ───────────────────── │                                                                              │
│ ? Help                │                                                                              │
│ « Collapse            │                                                                    ┌─────────┐│
│                       │                                                                    │⇪ 2 up-  ││
│                       │                                                                    │loading  ││
│                       │                                                                    │▓▓▓░ 64% ││
└───────────────────────┴────────────────────────────────────────────────────────────────────└─────────┘┘
 Workspace switcher (opened):          ┌──────────────────────────────────────────┐
                                       │ ✓ ◫ Contribute  Upload data, earnings    │
                                       │   ✎ Annotate    Your annotation tasks    │
                                       │   ☑ Review      Dataset & annotation QA  │
                                       │   ⛨ Admin       Platform administration  │
                                       └──────────────────────────────────────────┘
 Bottom-right: global UploadTray (only while uploads exist), collapsible.
 Mobile: top bar = ☰ · page title · 🔔 · avatar; sidebar opens as left sheet.
```

## #15 Contributor Dashboard — `/dashboard`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Good afternoon, Sophea                                              [⇪ Upload dataset]       │
│                                                                                              │
│ ┌ ⓘ Verify your identity to withdraw earnings. Uploads don't need it.   [Verify identity] ┐  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘  │
│ ┌ ⚠ Changes requested on 1 dataset: "ឯកសារប្រវត្តិសាស្ត្រ ១៩៦០"            [Review feedback] ┐  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                              │
│ ┌───────────────────┬───────────────────┬───────────────────┬───────────────────┐            │
│ │ AVAILABLE         │ PENDING           │ RESERVED          │ PAID (LIFETIME)   │            │
│ │ $42.17            │ $0.00             │ $25.00            │ $118.40           │            │
│ │ [Withdraw]        │ Released after    │ 1 withdrawal      │ 6 withdrawals     │            │
│ │                   │ hold period       │ in progress       │                   │            │
│ └───────────────────┴───────────────────┴───────────────────┴───────────────────┘            │
│ ≈ $6.30 estimated from 2 datasets in review (not yet credited) · How earnings work ⓘ         │
│                                                                                              │
│ ┌ Recent datasets ────────────────────────────── View all → ┐ ┌ Notifications ── All → ────┐ │
│ │ Title                       Status          Size   Value  │ │ ● Dataset approved          │ │
│ │ សៀវភៅសិក្សា ថ្នាក់ទី៩        [● In review]    4.21 GB ≈$4.21│ │   "Newspapers 1998" · 2h    │ │
│ │ Newspapers 1998             [● Approved]    2.40 GB  $2.40│ │ ● Earnings credited $2.40   │ │
│ │ Receipts scan batch 3       [● Draft]       1.07 GB    —  │ │ ○ Withdrawal approved       │ │
│ │ ឯកសារប្រវត្តិសាស្ត្រ ១៩៦០    [● Changes req.] 0.88 GB    —  │ │   PO-7F3A2B · yesterday     │ │
│ │ Village survey forms        [● Partially ap] 3.10 GB  $2.09│ │ ○ Dataset received          │ │
│ └───────────────────────────────────────────────────────────┘ └─────────────────────────────┘ │
│ ┌ Continue uploading ────────────────────────────────────────┐ ┌ Annotation work ───────────┐ │
│ │ Receipts scan batch 3 · 12 of 40 files uploaded            │ │ (shown to annotators only) │ │
│ │ ▓▓▓▓▓▓░░░░░░░░░░ 30%                       [Resume upload] │ │ 3 tasks assigned · 1 due   │ │
│ └────────────────────────────────────────────────────────────┘ │ tomorrow   [Go to Annotate]│ │
│                                                                └────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 First-run (no datasets): KPI strip replaced by checklist card:
   [✓] Complete onboarding   [ ] Upload your first dataset [Upload]   [ ] Get verified [Verify]
```

## #16 Upload Dataset — `/datasets/new`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ My datasets › New dataset                                                                    │
│ Upload a dataset                                                                             │
│ Describe the data, then add files. You can add more files until you submit for review.       │
│ ┌ 1  About this dataset ──────────────────────────────────────────┐ ┌ Guidelines ─────────┐  │
│ │ Title (required)                                                │ │ ✓ Files you own or  │  │
│ │ {សៀវភៅសិក្សា ថ្នាក់ទី៩ ឆ្នាំ២០០៥...............................}  │ │   may license       │  │
│ │ Description (required)                                          │ │ ✓ Max 5 GB per file │  │
│ │ {Scanned textbook pages, 300 dpi, ...........................}  │ │ ✓ Max 50 GB total   │  │
│ │ Primary language          Category                              │ │ ✗ No executables,   │  │
│ │ [Khmer ▾]                 [Education / textbooks ▾]             │ │   scripts, HTML     │  │
│ │ Data class                                                      │ │ ZIPs are unpacked;  │  │
│ │ (•) Raw — $1.00/GB   ( ) Clean/labeled — $1.50/GB  ⓘ            │ │ only contents count │  │
│ │ Source & rights (required)                                      │ │ All formats →       │  │
│ │ {Scanned from my own copies, published by MoEYS 2005.........}  │ └─────────────────────┘  │
│ │ Licence                                                         │                          │
│ │ [DataHub contributor licence (default) ▾]                       │                          │
│ └─────────────────────────────────────────────────────────────────┘                          │
│ ┌ 2  Files ───────────────────────────────────────────────────────────────────────────────┐  │
│ │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │  │
│ │      ⇪  Drag files, folders or ZIP archives here                                         │  │
│ │ │         [Choose files]   [Choose folder]                                             │ │  │
│ │      PDF, DOCX, DOC, ODT, RTF, TXT, JPG, PNG, TIFF, BMP, CSV, JSON, JSONL, XML, XLSX, ZIP │  │
│ │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │  │
│ │ 38 files · 4.21 GB selected                                               [Clear all]   │  │
│ │  📄 page-001.tif        41.2 MB   textbook/ch1/                                   ✕      │  │
│ │  📄 page-002.tif        40.8 MB   textbook/ch1/                                   ✕      │  │
│ │  ⚠ setup.exe            2.1 MB    Not allowed: executable files                    ✕      │  │
│ │  … (virtualised list)                                                                   │  │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│ ═════════════════════════════════════════════════════════════════════════════════════════════ │
│ 1 file has a problem and will be skipped.        [Save as draft]  [Create dataset & upload]  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #17 Upload Progress — `/datasets/[id]/upload`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ My datasets › សៀវភៅសិក្សា ថ្នាក់ទី៩ › Upload                     DS-3F9A1C   [● Draft]          │
│ Uploading files                                                   [Add files]  [Pause all]   │
│ ┌────────────────────────────────────────────────────────────────────────────────────────┐   │
│ │ Overall   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  2.71 GB of 4.21 GB · 64%                      │   │
│ │ 4.8 MB/s · about 5 min left · 24 done · 3 uploading · 10 queued · 1 failed             │   │
│ └────────────────────────────────────────────────────────────────────────────────────────┘   │
│ ▤ [All 38] [Uploading 3] [Processing 6] [Ready 18] [Problems 2]          ⌕ {Filter files}    │
│ ┌──────────────────────────────┬──────────┬──────────────────────────────┬────────────┬────┐ │
│ │ File                         │ Size     │ Progress / status            │ Scan       │    │ │
│ ├──────────────────────────────┼──────────┼──────────────────────────────┼────────────┼────┤ │
│ │ 📄 page-031.tif              │ 41.0 MB  │ ▓▓▓▓▓▓▓░░░ 71% · 1.6 MB/s    │ —          │ ⏸ ✕│ │
│ │ 📄 page-032.tif              │ 40.9 MB  │ ▓▓░░░░░░░░ 22%               │ —          │ ⏸ ✕│ │
│ │ 🗜 chapter-2.zip             │ 812 MB   │ ▓▓▓▓▓░░░░░ 48% · 2.1 MB/s    │ —          │ ⏸ ✕│ │
│ │ 📄 page-030.tif              │ 41.1 MB  │ [● Processing] ░░░ (indet.)  │ [● Pending]│ ⋯  │ │
│ │ 📄 page-001.tif              │ 41.2 MB  │ [● Ready]                    │ [● Clean]  │ ⋯  │ │
│ │ 📄 notes.docx                │ 1.2 MB   │ [● Failed] type_mismatch ⓘ   │ —          │ 🗑 │ │
│ │   "The file content is not a Word document. Re-save it as .docx and upload again."     │ │
│ │ 📄 page-017.tif              │ 40.7 MB  │ [● Upload error — retry]     │ —          │ ↻ ✕│ │
│ └──────────────────────────────┴──────────┴──────────────────────────────┴────────────┴────┘ │
│ ┌ Estimate ───────────────────────────────────────┐                                          │
│ │ Eligible so far 0.739 GB × $1.00 = ≈ $0.73      │  Estimates exclude duplicates and failed │
│ │ (updates as files finish processing)            │  files. Final amount set at review.      │
│ └─────────────────────────────────────────────────┘                                          │
│ ═════════════════════════════════════════════════════════════════════════════════════════════ │
│ Keep this tab open while uploading. You can browse other pages.   [Submit for review] (dis-  │
│                                                                    abled: "Wait for all files │
│                                                                    to finish processing")    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### #17 — Resume after disconnect / reload

```
┌ ⚠ You're offline. Uploads are paused and will resume automatically when you reconnect. ────┐
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌ 3 uploads were interrupted ─────────────────────────────────────────────────────────────────┐
│ Your browser can't continue these files on its own after a reload. Select the same files    │
│ again — we'll only send the parts that are missing.                                         │
│   📄 page-031.tif     41.0 MB    29 of 41 MB already uploaded      [● Re-select file]       │
│   🗜 chapter-2.zip    812 MB     390 of 812 MB already uploaded     [● Re-select file]       │
│   📄 page-040.tif     40.6 MB    session expired (older than 24 h)  [● Expired] start again  │
│                                                       [Select files to resume]  [Discard]   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
 Mismatch: "page-031.tif doesn't match the interrupted file (different size or date)."
```

### #17 — Mobile (375 px)

```
┌───────────────────────────────────┐
│ ☰  Upload               🔔  (SC)  │
├───────────────────────────────────┤
│ សៀវភៅសិក្សា ថ្នាក់ទី៩    [● Draft]   │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░ 64%               │
│ 2.71 / 4.21 GB · 4.8 MB/s · 5 min │
│ [Pause all]   [Add files]         │
│ ┌───────────────────────────────┐ │
│ │ 📄 page-031.tif        ⏸  ✕   │ │
│ │ ▓▓▓▓▓▓▓░░░ 71% · 41.0 MB      │ │
│ └───────────────────────────────┘ │
│ ┌───────────────────────────────┐ │
│ │ 📄 notes.docx    [● Failed]   │ │
│ │ Not a Word document.  [Remove]│ │
│ └───────────────────────────────┘ │
│ …                                 │
├═══════════════════════════════════┤
│ [      Submit for review        ] │
└───────────────────────────────────┘
```

## #18 My Datasets — `/datasets`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ My datasets                                                         [⇪ Upload dataset]       │
│ ⌕ {Search title…}  Status [All ▾]  Class [All ▾]  Language [All ▾]   Sort [Last updated ▾]    │
│ ┌────────────────────────────────┬──────────────────┬───────┬─────────┬──────────┬────────┬─┐│
│ │ Title ↕                        │ Status           │ Files │ Size ↕  │ Value    │Updated↕│ ││
│ ├────────────────────────────────┼──────────────────┼───────┼─────────┼──────────┼────────┼─┤│
│ │ សៀវភៅសិក្សា ថ្នាក់ទី៩            │ [● In review]     │ 38    │ 4.21 GB │ ≈ $4.21  │ 2h ago │⋯││
│ │ DS-3F9A1C · Khmer · Raw        │                  │       │         │ estimate │        │ ││
│ │ Newspapers 1998                │ [● Approved]      │ 112   │ 2.40 GB │ $2.40    │ 1d ago │⋯││
│ │ Receipts scan batch 3          │ [● Draft]         │ 40    │ 1.07 GB │ —        │ 3d ago │⋯││
│ │ ឯកសារប្រវត្តិសាស្ត្រ ១៩៦០        │ [● Changes req.]  │ 15    │ 0.88 GB │ —        │ 4d ago │⋯││
│ │ Village survey forms           │ [● Partially ap.] │ 64    │ 3.10 GB │ $2.09    │ 9d ago │⋯││
│ └────────────────────────────────┴──────────────────┴───────┴─────────┴──────────┴────────┴─┘│
│ 1–5 of 5                                                       Rows [25 ▾]   ‹ 1 ›           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Row menu ⋯: Open · Continue upload (draft/changes_requested) · Message support about this ·
             Withdraw (draft/submitted/changes_requested, L2)
 Empty (first use): ⛁ "No datasets yet" + "We pay $1.00 per accepted GB of raw data." [Upload dataset]
```

### #18 — Mobile cards

```
┌───────────────────────────────────┐
│ ☰  My datasets          🔔  (SC)  │
│ ⌕ {Search…}            [▤ Filter] │
│ ┌───────────────────────────────┐ │
│ │ សៀវភៅសិក្សា ថ្នាក់ទី៩            │ │
│ │ [● In review]                 │ │
│ │ Size 4.21 GB   Value ≈ $4.21  │ │
│ │ Updated 2h ago             ⋯  │ │
│ └───────────────────────────────┘ │
│ ┌───────────────────────────────┐ │
│ │ Newspapers 1998               │ │
│ │ [● Approved]                  │ │
│ │ Size 2.40 GB   Earned $2.40   │ │
│ └───────────────────────────────┘ │
└───────────────────────────────────┘
```

## #19 Dataset Details (contributor) — `/datasets/[id]`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ My datasets › Village survey forms                                                           │
│ Village survey forms                   [● Partially approved]  DS-8C21E0 ⧉                    │
│ Khmer · Surveys · Raw · 64 files · 3.10 GB · submitted 12 Oct 2026     [💬 Message support][⋯]│
│                                                                                              │
│ ┌ Status timeline ─────────────────────────────────────────────────────────────────────────┐ │
│ │ ● Draft 10 Oct ─── ● Submitted 12 Oct ─── ● In review 14 Oct ─── ● Partially approved 15 Oct│
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Earnings ────────────────────────────────────────┐ ┌ What happens next ──────────────────┐ │
│ │ Accepted   2.094 GB  (48 files)                  │ │ Your earnings were credited to your │ │
│ │ Rejected   1.006 GB  (16 files)                  │ │ balance on 15 Oct. Rejected files   │ │
│ │ Rate       $1.00 / GB (raw, rule v1)             │ │ won't be paid; see reasons below.   │ │
│ │ Earned     $2.09                                 │ │ [Go to earnings]                    │ │
│ └──────────────────────────────────────────────────┘ └─────────────────────────────────────┘ │
│ [Files 64]  [Feedback]  [History]                                                            │
│ ▤ Decision [All ▾]  Status [All ▾]   ⌕ {Filter files}                                        │
│ ┌──────────────────────────┬─────────┬─────────────┬───────────┬──────────────────────────┐  │
│ │ File                     │ Size    │ Processing  │ Review    │ Reason                   │  │
│ ├──────────────────────────┼─────────┼─────────────┼───────────┼──────────────────────────┤  │
│ │ 📄 form-001.jpg          │ 48.1 MB │ [● Ready]   │[● Accepted]│                          │  │
│ │ 📄 form-002.jpg          │ 47.9 MB │ [● Ready]   │[● Rejected]│ Illegible (too blurry)  │  │
│ │ 📄 form-003.jpg          │ 48.0 MB │ [● Ready]   │[● Rejected]│ Exact duplicate of a     │  │
│ │                          │         │             │           │ previously accepted file │  │
│ └──────────────────────────┴─────────┴─────────────┴───────────┴──────────────────────────┘  │
│ Click a file → right sheet with preview (page images / text), metadata, decision, comment.   │
│                                                                                              │
│ Feedback tab: reviewer's overall feedback (text-content, Khmer-capable), quality scores,     │
│ checklist outcomes (contributor-visible items only).                                         │
│ History tab: versions (v1 submitted 12 Oct …), each with review outcome.                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Draft / changes_requested: header actions [Edit details] [Add / remove files → /upload]
                            [Submit for review]; ⋯ → Withdraw dataset (L2).
```

## #20 Earnings — `/earnings`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Earnings                                                              [Withdraw →]           │
│ ┌───────────────┬───────────────┬───────────────┬───────────────┬───────────────┐            │
│ │ AVAILABLE     │ PENDING       │ RESERVED      │ PAID          │ APPROVED      │            │
│ │ $42.17        │ $0.00         │ $25.00        │ $118.40       │ $185.57       │            │
│ │ Ready to      │ In hold       │ In open       │ Sent to you   │ Lifetime      │            │
│ │ withdraw ⓘ    │ period ⓘ      │ withdrawal ⓘ  │ ⓘ             │ credited ⓘ    │            │
│ └───────────────┴───────────────┴───────────────┴───────────────┴───────────────┘            │
│ ≈ $6.30 Estimate (datasets in review) ⓘ   ·   Adjustments: +$0.00                            │
│                                                                                              │
│ [Summary]  [Transactions]                                                                    │
│ ┌ Earned per month (bar, teal) ─────────────────────────┐ ┌ By source ─────────────────────┐ │
│ │  $60 ┤        ██                                      │ │ Dataset purchases   $171.07    │ │
│ │  $30 ┤  ██    ██  ██                                  │ │ Annotation rewards  $14.50     │ │
│ │   $0 ┼──██────██──██──██──                            │ │ Adjustments         $0.00      │ │
│ │       Jul  Aug  Sep  Oct     [View as table]          │ └────────────────────────────────┘ │
│ └───────────────────────────────────────────────────────┘                                    │
│ Earnings by dataset                                                                          │
│ ┌──────────────────────────────┬──────────────┬──────────┬────────────┬──────────┬─────────┐ │
│ │ Dataset                      │ Finalized    │ Accepted │ Rate       │ Earned   │ Credited│ │
│ │ Newspapers 1998              │ 25 Oct 2026  │ 2.400 GB │ $1.00 / GB │ $2.40    │ ✓       │ │
│ │ Village survey forms         │ 15 Oct 2026  │ 2.094 GB │ $1.00 / GB │ $2.09    │ ✓       │ │
│ └──────────────────────────────┴──────────────┴──────────┴────────────┴──────────┴─────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Transactions tab (GET /wallet/transactions):
 │ Date        │ Type                       │ Reference             │ Bucket    │ Amount   │
 │ 25 Oct 14:05│ [Dataset earning]          │ Newspapers 1998       │ Available │ +$2.40   │
 │ 22 Oct 09:12│ [Reserved for withdrawal]  │ PO-7F3A2B             │ Avail→Res │ −$25.00  │
 │ 10 Oct 16:40│ [Paid out]                 │ PO-19B0C4 · ABA 88213 │ Res→Paid  │ $20.00   │
```

## #21 Withdrawals — `/withdrawals`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Withdrawals                                                     [Request withdrawal]         │
│ ┌ Available to withdraw ────────────────┐ ┌ Requirements ──────────────────────────────────┐ │
│ │ $42.17                                │ │ ✓ Identity verified                            │ │
│ │ Min $10.00 · Max $5,000.00 per request│ │ ✓ Payout method: ABA Pay ••• 456               │ │
│ │ One open request at a time            │ │ ✗ You have an open request (PO-7F3A2B)         │ │
│ └───────────────────────────────────────┘ └────────────────────────────────────────────────┘ │
│ History                                                                                      │
│ ┌────────────┬──────────────┬──────────┬────────────────┬────────────────────────┬────────┐  │
│ │ Request    │ Requested    │ Amount   │ Method         │ Status                 │ Paid   │  │
│ │ PO-7F3A2B  │ 22 Oct 2026  │ $25.00   │ ABA Pay ••456  │ [● Approved · awaiting]│ —      │  │
│ │ PO-19B0C4  │ 08 Oct 2026  │ $20.00   │ ABA Pay ••456  │ [● Paid]               │ 10 Oct │  │
│ │ PO-0A77D1  │ 01 Sep 2026  │ $15.00   │ Bank ••9012    │ [● Rejected]           │ —      │  │
│ └────────────┴──────────────┴──────────┴────────────────┴────────────────────────┴────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Not eligible: [Request withdrawal] disabled + tooltip naming the first unmet requirement.
 Empty: ¤ "No withdrawals yet. When your balance reaches $10.00 you can request one."
```

### #21 — Request withdrawal dialog (`?request=1`)

```
┌ Request a withdrawal ─────────────────────────────────────────┐
│ Amount                                                        │
│ ┌──────────────────────────────┐                              │
│ │ $ {42.00....................}│  [Max]                       │
│ └──────────────────────────────┘                              │
│ Available $42.17 · min $10.00 · max $5,000.00                 │
│ Whole cents only.                                             │
│                                                               │
│ Pay to                                                        │
│ (•) ABA Pay · Sophea Chan · ••• 456                           │
│ ( ) Bank transfer · ACLEDA · ••• 9012                         │
│ Manage payout methods →                                       │
│                                                               │
│ ┌ Summary ──────────────────────────────────────────────────┐ │
│ │ $42.00 will be reserved from your available balance until │ │
│ │ the request is paid, rejected or cancelled.               │ │
│ │ Payments are made manually, usually within 5 business days│ │
│ └───────────────────────────────────────────────────────────┘ │
│                              [Cancel]  [Request $42.00]       │
└───────────────────────────────────────────────────────────────┘
 [Request $42.00] uses the `money` button variant; Idempotency-Key generated on open.
```

## #22 Withdrawal Details — `/withdrawals/[id]`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Withdrawals › PO-7F3A2B                                                                      │
│ $25.00 withdrawal                       [● Approved · awaiting payment]     [Cancel request] │
│                                                                     (only when Requested)    │
│ ┌ Details ─────────────────────────────────────┐ ┌ Timeline ────────────────────────────────┐│
│ │ Amount          $25.00                       │ │ ● Requested       22 Oct 09:12           ││
│ │ Method          ABA Pay · Sophea Chan ••456  │ │   $25.00 reserved                        ││
│ │ Requested       22 Oct 2026, 09:12           │ │ ● Approved        23 Oct 11:30           ││
│ │ Payment ref.    — (shown after payment)      │ │ ○ Payment recorded  (waiting)            ││
│ │ Paid on         —                            │ │                                          ││
│ └──────────────────────────────────────────────┘ └──────────────────────────────────────────┘│
│ Questions about this withdrawal? [Message support] (creates conversation linked to payout)  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
 Paid state: Payment ref. "ABA-88213-XK" · Paid on 24 Oct 2026, 15:02 · [● Paid] · teal summary
 "We sent $25.00 to your ABA Pay account. Check your statement for reference ABA-88213-XK."
 Rejected/failed state: danger Alert with admin's reason; "$25.00 returned to your available balance."
```

## #25 Profile — `/profile`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Profile                                                                                      │
│ (SC)  Sophea Chan · sophea@example.com      [Contributor] [Annotator]    [● Verified]         │
│ [Personal details]  [Verification]  [Payout methods]                                         │
│ ┌ Personal details ───────────────────────────────────────────────────────────────────────┐  │
│ │ Display name {Sophea..........}   Legal name {Sophea Chan..........} (locked when      │  │
│ │ Legal name (Khmer) {ចាន់ សុភា.......}                                 verified; change │  │
│ │ Country [Cambodia ▾]  Phone [+855 ▾]{12 345 678}                      via support)     │  │
│ │ Date of birth 14/03/2004 (locked)                                                       │  │
│ │                                                             [Cancel]  [Save changes]    │  │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│ Verification tab: status card ([● Verified] approved 18 Oct 2026) or, for needs_info/        │
│ rejected, the admin's message + prefilled resubmission form (POST /me/verification).        │
│ Payout methods tab:                                                                          │
│ ┌──────────────────────────┬─────────────────────────┬───────────────┬───────────────────┐   │
│ │ Method                   │ Account                 │ Added         │                   │   │
│ │ ABA Pay (default)        │ Sophea Chan ••• 456     │ 18 Oct 2026   │ [Remove] (L2)     │   │
│ │ Bank transfer — ACLEDA   │ Sophea Chan ••• 9012    │ 02 Sep 2026   │ [Remove]          │   │
│ └──────────────────────────┴─────────────────────────┴───────────────┴───────────────────┘   │
│ [+ Add payout method]  (sheet: method radio + method-specific fields)                        │
│ Removing a method used by an open withdrawal is blocked with an explanation.                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
