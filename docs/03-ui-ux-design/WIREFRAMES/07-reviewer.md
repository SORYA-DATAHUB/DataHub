# Wireframes 07 — Reviewer workspace

| Field | Value |
|---|---|
| Document | #16 Wireframes — part 07 (review) |
| Version | v1.0 · 2026-10-26 · Baseline |
| Pages | #56, #57, #33, #58, #59, #60 |

**Purpose.** Layouts for reviewing datasets file-by-file and reviewing annotations, plus the reviewer's dashboard, queues and history. **Scope.** `/review`, `/review/datasets`, `/review/datasets/[reviewId]`, `/review/annotations`, `/review/annotations/[taskId]`, `/review/history`. The dataset review workspace (#33) is also used by admins (linked from #34). **Assumptions.** Reviewers work at ≥ 1280 px; review decisions on files are persisted immediately per file (`PUT /reviews/{id}/files/{file_id}`); earnings are computed server-side and shown via `GET /reviews/{id}/summary`. **Decisions.** Separation of duties: own datasets/annotations never appear claimable. Finalize requires typing the payable amount when it is > $0.00. Sizes in financial context use `formatGB` (3 decimals). **Dependencies.** Baseline §8.2–§8.4 (formula, eligibility, labeled upgrade), §9 (dataset/review/task states), §12 (review & annotation-review endpoints); UI_UX_DESIGN §9.4; USER_FLOWS §4, §5, §10. **Acceptance criteria.** Every master-prompt Part 10 workspace element is present (preview, file navigation, metadata, duplicate warnings, checklist, accepted size, rejected size, comments, history, contributor feedback, final payable amount); Part 12 annotation-review capabilities are present in #59.

---

## #56 Reviewer Dashboard — `/review`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Review                                                                                       │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐                 │
│ │ DATASETS     │ MY DATASET   │ ANNOTATIONS  │ MY ANNOT.    │ REVIEWED     │                 │
│ │ AWAITING     │ REVIEWS      │ AWAITING     │ REVIEWS      │ THIS WEEK    │                 │
│ │ 12           │ 1            │ 120          │ 3            │ 9 ds · 210 an│                 │
│ └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘                 │
│ ┌ My in-progress reviews ──────────────────────────────────────────────────────────────────┐ │
│ │ Dataset  សៀវភៅសិក្សា ថ្នាក់ទី៩ · 24 / 38 files decided · claimed 1d ago      [Continue →] │ │
│ │ Annotation TK-0A0E11 · Textbook OCR p.15 · claimed 20 min ago             [Continue →] │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Oldest datasets in queue ──────────────────────┐ ┌ Oldest annotations in queue ─────────┐ │
│ │ Legal forms EN/KM · 0.92 GB · [5 days] [Claim] │ │ TK-0A0E10 · p.14 · 2h      [Claim]   │ │
│ │ Market price lists · 1.40 GB · [3 days] [Claim]│ │ TK-0A0E12 · p.16 · 2h      [Claim]   │ │
│ └────────────────────────────────────────────────┘ └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #57 Dataset Review Tasks — `/review/datasets`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Dataset reviews                                                                              │
│ [Queue 12] [Mine 1]          Class [Any ▾]  Language [Any ▾]  Category [Any ▾]  Sort [Oldest]│
│ ┌──────────────────────────────┬────────┬───────┬──────────┬─────────┬───────────┬─────────┐ │
│ │ Dataset                      │ Size   │ Files │ Class    │ Lang    │ Waiting   │         │ │
│ │ Legal forms EN/KM            │ 0.92 GB│ 31    │ Labeled  │ km, en  │ [5 days]  │ [Claim] │ │
│ │ DS-77E019 · v2 (resubmitted) │        │       │          │         │           │         │ │
│ │ Market price lists           │ 1.40 GB│ 120   │ Raw      │ km      │ [3 days]  │ [Claim] │ │
│ └──────────────────────────────┴────────┴───────┴──────────┴─────────┴───────────┴─────────┘ │
│ Resubmitted datasets show "v2 (resubmitted)" and open with the previous review's feedback.   │
│ Empty queue: ✓ "Queue is clear. New submissions will appear here."                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #33 Dataset Review Workspace — `/review/datasets/[reviewId]`

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Queue │ Legal forms EN/KM · DS-77E019 v2 · owner Dara K.  [● Review in progress]   [?] [Message owner] [⋯ Release] │
├──────────────────────────────┬─────────────────────────────────────────────────────┬──────────────────────────────┤
│ FILES 31            [▤][«]   │ form-007.pdf · page 1 of 3                          │ FILE                    [»]  │
│ [Undecided 9][Accepted 19]   │ ◀ ▶  [−] 100% [+] [Fit] [⟳]  [Extracted text ⇄ Page]│ form-007.pdf                 │
│ [Rejected 3][Flags 2]        │ ┌─────────────────────────────────────────────────┐ │ 28.4 MB · application/pdf    │
│ ⌕ {Filter}                   │ │                                                 │ │ 3 pages · uploaded 21 Oct    │
│ [ ] Select all               │ │   ┌──────────────────────────────────────┐      │ │ [● Ready] [● Clean]          │
│ ┌──────────────────────────┐ │ │   │ ពាក្យស្នើសុំ / APPLICATION FORM       │      │ │ sha256 9f2c…e01a ⧉           │
│ │✓ form-001.pdf  29 MB     │ │ │   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │      │ │ ┌ ⚠ Possible duplicate ─────┐│
│ │✓ form-002.pdf  27 MB     │ │ │   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░           │      │ │ │ 96% similar to form-001.pdf││
│ │✗ form-003.pdf  31 MB     │ │ │   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │      │ │ │ in this dataset [Compare] ││
│ │✓ form-004.pdf  28 MB     │ │ │   │     (white page surface)             │      │ │ └───────────────────────────┘│
│ │⚑ form-005.pdf  30 MB  dup│ │ │   └──────────────────────────────────────┘      │ │ Decision                     │
│ │· form-006.pdf  29 MB     │ │ │                                                 │ │ (•) Accept  ( ) Reject       │
│ │▸ form-007.pdf  28 MB  ⚑  │ │ │                                                 │ │ Reason [— ▾] (reject only)   │
│ │· form-008.pdf  27 MB     │ │ └─────────────────────────────────────────────────┘ │ Comment to contributor       │
│ │…                         │ │ Pages ▸ [1][2][3]                                   │ {.........................}  │
│ └──────────────────────────┘ │                                                     │ [ ] Labeled upgrade ⓘ        │
│ J/K next/prev · A accept ·   │ [Download original] (presigned, logged)             │ (only if previously paid raw)│
│ X reject · U clear           │                                                     │ ✓ Saved                      │
│                              │                                                     │ ───────────────────────────  │
│                              │                                                     │ [Checklist] [Scores] [Meta-  │
│                              │                                                     │ data] [Comments] [History]   │
├──────────────────────────────┴─────────────────────────────────────────────────────┴──────────────────────────────┤
│ Decided 22/31 · Accepted 0.548 GB (19) · Rejected 0.087 GB (3) · Class Labeled · Payable $0.82    [Finalize… ⌃↵]  │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 Legend: ✓ accepted · ✗ rejected · ⚑ flagged (duplicate/scan) · · undecided · ▸ current.
 Ineligible files (failed, infected, exact duplicate of an accepted file, ZIP container) are pre-set
 to Rejected with a system reason and locked (tooltip explains).
 Bulk: select rows → bar "4 selected · [Accept] [Reject…] [Clear]".
```

### #33 — Right panel tabs

```
[Checklist]                                    [Scores]
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│ [x] Content matches description      │       │ Legibility       ○○○●○  4            │
│ [x] Language matches declared (km,en)│       │ Completeness     ○○○○●  5            │
│ [x] No personal data without consent │       │ Relevance        ○○○●○  4            │
│ [ ] Data class correct               │       │ Metadata quality ○○●○○  3            │
│ [x] Rights statement plausible       │       │ Overall (avg)    4.0 / 5             │
└──────────────────────────────────────┘       └──────────────────────────────────────┘
[Metadata]  contributor-entered title, description (text-content), language, category, data class,
            source & rights, licence, custom key/values; reviewer can change data class here.
[Comments]  internal reviewer notes (not shown to contributor) + contributor-facing feedback draft.
[History]   previous versions & reviews of this dataset (v1 → changes requested: "Remove blank
            pages"), with links to the earlier per-file decisions.
```

### #33 — Finalize dialog (L4 when payable > $0.00)

```
┌ Finalize review of "Legal forms EN/KM" (v2) ──────────────────────────────────────┐
│ ┌ Summary ──────────────────────────────────────────────────────────────────────┐ │
│ │ Files            31 decided (28 accepted · 3 rejected)                        │ │
│ │ Accepted size    0.835 GB   (835,214,330 bytes)                               │ │
│ │ Rejected size    0.087 GB                                                     │ │
│ │ Data class       Labeled · rate $1.50 / GB (rule v1)                          │ │
│ │ Labeled upgrades 0 files                                                      │ │
│ │ Payable          $1.25                                                        │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│ Decision                                                                          │
│ ( ) Approve — all files accepted                (disabled: 3 rejected)             │
│ (•) Partially approve                                                             │
│ ( ) Reject — pay nothing                                                          │
│ ( ) Request changes — contributor can fix and resubmit                            │
│ Feedback to contributor (required for partial / reject / request changes)        │
│ {Thanks — 3 forms were blank scans and were rejected...........................}  │
│ Type the payable amount to confirm: ⟦1.25⟧  {........}                            │
│                                            [Cancel]  [Finalize & credit $1.25]    │
└───────────────────────────────────────────────────────────────────────────────────┘
 Payable comes from GET /reviews/{id}/summary (server floor per file; display floored to cents).
 Reject / Request changes: no amount to type (L3), button "Finalize review".
 Finalize is disabled while any file is undecided (message: "9 files still undecided").
```

### #33 — Release dialog (L2)

```
┌ Release this review? ─────────────────────────────────────────┐
│ The dataset returns to the queue. Your file decisions stay in │
│ this review's history; the next reviewer starts a new review. │
│                                       [Cancel]  [Release]     │
└───────────────────────────────────────────────────────────────┘
```

## #58 Annotation Review Tasks — `/review/annotations`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Annotation reviews                                                                           │
│ [Queue 120] [Mine 3]                Project [All ▾]  Annotator [Any ▾]   Sort [Oldest ▾]     │
│ ┌──────────────┬───────────────────────────┬──────────────┬──────────────┬─────────┬───────┐ │
│ │ Task         │ Project / source          │ Annotator    │ Submitted    │ Attempt │       │ │
│ │ TK-0A0E10    │ Textbook OCR · p.14       │ Dara K.      │ 26 Oct 08:01 │ 1st     │[Claim]│ │
│ │ TK-0A0E02    │ Textbook OCR · p.2        │ Dara K.      │ 26 Oct 10:15 │ 2nd ↻   │[Claim]│ │
│ └──────────────┴───────────────────────────┴──────────────┴──────────────┴─────────┴───────┘ │
│ "2nd ↻" = resubmitted after changes requested; opens with diff against the previous         │
│ submission preselected.                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #59 Annotation Comparison — `/review/annotations/[taskId]`

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Queue │ Textbook OCR · TK-0A0E02 · p.2 · Dara K. · attempt 2   [● In review]                    [?] [Decide…]  │
├───────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────┤
│ SOURCE                                    │ ANNOTATION     Compare [v7 submitted 25 Oct ▾] ⇄ [v9 submitted 26 Oct ▾]│
│ [−] 100% [+] [Fit] [⟳]                    │ [Side by side] [Inline diff]                                          │
│ ┌───────────────────────────────────────┐ │ ┌ Transcription ──────────────────────────────────────────────────┐   │
│ │ ┌───────────────────────────────────┐ │ │ │ v7                              │ v9                            │   │
│ │ │ ░░░░ page image ░░░░░░░░░░░░░░░░░ │ │ │ │ …ការ​ប្រជំ​នៅ​ថ្ងៃ…              │ …ការ​ប្រជុំ​នៅ​ថ្ងៃ…  (+ុ)       │   │
│ │ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │ │ │                                 │                               │   │
│ │ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │ │ │ grapheme-level diff; changes marked with −/+ and colour         │   │
│ │ └───────────────────────────────────┘ │ │ └─────────────────────────────────────────────────────────────────┘   │
│ └───────────────────────────────────────┘ │ Page label   v7 advertisement → v9 article ✓                         │
│ [Extracted text] [Page image]             │ Metadata     pub_date 1998-01-02 (unchanged) · section politics       │
│                                           │ Notes        "Bottom 2 lines torn; marked [illegible]."               │
│                                           │ ┌ Review ───────────────────────────────────────────────────────────┐ │
│                                           │ │ Previous comment (v7): "Line 3: 'ប្រជំ' should be 'ប្រជុំ' …" ✓ fixed │ │
│                                           │ │ Score  ○○○○●  5                                                   │ │
│                                           │ │ Comments to annotator                                            │ │
│                                           │ │ {Fixed, thanks.................................................}  │ │
│                                           │ │                    [Request changes]  [Approve · reward $0.05]   │ │
│                                           │ └───────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────┘
 Request changes (L3): comments required; optional per-page notes. Approve (L2 summary): "Approve
 TK-0A0E02 and credit $0.05 to Dara Keo?" — POST /annotation/tasks/{id}/review with Idempotency-Key.
 Diff toggle "Show invisible characters" reveals ZWSP differences.
```

## #60 Review History — `/review/history`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Review history                         [Datasets] [Annotations]   Reviewer [Me ▾] (admins)   │
│ [From – To]  Decision [Any ▾]                                                                │
│ ┌──────────────┬──────────────────────────┬──────────────────────┬──────────┬──────────────┐ │
│ │ Finalized    │ Dataset                  │ Decision             │ Accepted │ Payable      │ │
│ │ 26 Oct 11:02 │ Legal forms EN/KM v2     │ [● Partially approved│ 0.835 GB │ $1.25        │ │
│ │ 24 Oct 15:40 │ Newspapers 1998          │ [● Approved]         │ 2.400 GB │ $2.40        │ │
│ │ 22 Oct 09:15 │ Receipts batch 1         │ [● Changes requested]│ —        │ —            │ │
│ └──────────────┴──────────────────────────┴──────────────────────┴──────────┴──────────────┘ │
│ Row → read-only review record (files & decisions, checklist, scores, feedback).              │
│ Annotations tab: reviewed at · task · annotator · decision · score · reward.                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
