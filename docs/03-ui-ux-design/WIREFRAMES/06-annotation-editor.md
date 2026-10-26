# Wireframes 06 — Annotator workspace & annotation editor

| Field | Value |
|---|---|
| Document | #16 Wireframes — part 06 (annotation) |
| Version | v1.0 · 2026-10-26 · Baseline |
| Pages | #49–#55 (editor #52 in detail) |

**Purpose.** Layouts for annotator pages and the three-panel annotation editor, including its autosave, conflict, draft-recovery, submission, version-history and read-only states. **Scope.** `/annotate`, `/annotate/tasks`, `/annotate/tasks/[id]`, `/annotate/tasks/[id]/edit`, `/annotate/submitted`, `/annotate/feedback`, `/annotate/earnings`. **Assumptions.** Editor drawn at 1440 × 900; annotators use a Khmer keyboard layout (NiDA) via the OS IME; task unit is `page` in the example project (types: transcription, text correction, page label, metadata). **Decisions.** Focus layout without sidebar; panels resizable with persisted sizes; autosave 5 s idle + blur with `If-Match`; local IndexedDB draft copy; single-key shortcuts only when focus is outside text fields (UI_UX_DESIGN §9.3). **Dependencies.** Baseline §11 (annotation model, concurrency), §9 (task states), §12 (annotation endpoints); UI_UX_DESIGN §9; DESIGN_SYSTEM §4.4 (Khmer rules), §8.9 (`SaveIndicator`); USER_FLOWS §9–§10. **Acceptance criteria.** All editor features from master prompt Part 12 are visible in the wireframes (navigation, tasks, progress, instructions, preview with zoom/pan/rotate/page nav, transcription, correction, metadata, classification, notes, reviewer comments, autosave, save status, undo/redo, draft recovery, shortcuts, validation, submission, corrections, version history, Khmer support).

---

## #49 Annotator Dashboard — `/annotate`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Annotate                                                                                     │
│ ┌ Continue where you left off ─────────────────────────────────────────────────────────────┐ │
│ │ Khmer textbook OCR gold · TK-0A0F77 · 1998-01-02.pdf page 7     [● In progress]           │ │
│ │ Last saved 26 Oct 10:42 · due 30 Nov                                   [Open editor →]   │ │
│ └───────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐                 │
│ │ ASSIGNED     │ IN PROGRESS  │ CHANGES REQ. │ APPROVED (MO)│ REWARDS (MO) │                 │
│ │ 34           │ 3            │ 2 ⚠          │ 98           │ $4.90        │                 │
│ └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘                 │
│ ┌ Due soon ───────────────────────────────────────────┐ ┌ Recent feedback ─────────────────┐ │
│ │ TK-0A0F78 · p.8 · due 30 Nov · [● Assigned]  Open   │ │ TK-0A0E02 Changes requested      │ │
│ │ TK-0A0E02 · p.2 · due 30 Nov · [● Changes req] Open │ │ "Line 3: 'ប្រជំ' should be 'ប្រជុំ'" · 1h   │ │
│ └─────────────────────────────────────────────────────┘ │ TK-0A0E01 Approved · score 5     │ │
│                                                         └──────────────────────────────────┘ │
│ Not verified: banner "Annotation tasks are assigned to verified contributors." [Verify]      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #50 My Annotation Tasks — `/annotate/tasks`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ My tasks                                                                                     │
│ [To do 37] [Changes requested 2] [All]     Project [All ▾]   Sort [Deadline ▾]               │
│ ┌──────────────┬──────────────────────────┬──────────────┬───────────────────┬────────┬─────┐│
│ │ Task         │ Project / source         │ Reward       │ Status            │ Due    │     ││
│ │ TK-0A0E02    │ Textbook OCR · p.2       │ $0.05        │[● Changes req.]   │ 30 Nov │[Fix]││
│ │ TK-0A0F77    │ Textbook OCR · p.7       │ $0.05        │[● In progress]    │ 30 Nov │[Cont││
│ │ TK-0A0F78    │ Textbook OCR · p.8       │ $0.05        │[● Assigned]       │ 30 Nov │[Star││
│ └──────────────┴──────────────────────────┴──────────────┴───────────────────┴────────┴─────┘│
│ Row → Task Details (#51). Action button → Editor (#52).                                      │
│ Empty: ✎ "No tasks assigned. You'll get a notification when an admin assigns work."          │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #51 Annotation Task Details — `/annotate/tasks/[id]`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ My tasks › TK-0A0E02                                                                         │
│ Textbook OCR · 1998-01-02.pdf · page 2     [● Changes requested]         [Open editor →]     │
│ Reward $0.05 · due 30 Nov 2026 · assigned 20 Oct by Lina H.                                  │
│ ┌ Reviewer feedback (latest) ─────────────────────────────────────────────────────────────┐  │
│ │ Vannak S. · 26 Oct 09:40 · score 3/5                                                    │  │
│ │ "Line 3: 'ប្រជំ' should be 'ប្រជុំ'; page label should be 'article'."  (text-content, lang=km)     │  │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Instructions ─────────────────────────────────┐ ┌ Status history ─────────────────────────┐│
│ │ (project markdown, collapsible sections)      │ │ ● Assigned 20 Oct                       ││
│ │ 1. Transcribe exactly as printed …            │ │ ● In progress 21 Oct                    ││
│ │ 2. Keep original line breaks …                │ │ ● Submitted 25 Oct                      ││
│ └───────────────────────────────────────────────┘ │ ● Changes requested 26 Oct              ││
│ Source preview: thumbnail of page 2 [View larger] └─────────────────────────────────────────┘│
│ Versions: v7 submitted 25 Oct · v6 draft … [View history]                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #52 Annotation Editor — `/annotate/tasks/[id]/edit`

### Full layout (≥ 1280 px)

Example: project "Newspaper transcription" with task unit **file** (one task = the whole 12-page PDF, reward $0.05 per page → $0.60). For **page-unit** projects (e.g. "Khmer textbook OCR gold") the Pages list shows the annotator's own page tasks from the same source file, each ticked when submitted, and the task switcher moves between them; pages not assigned to the annotator are not listed.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← My tasks │ Newspaper transcription · TK-0B1A20 · 1998-01-02.pdf  [● In progress]  ✓ Saved 10:42 · v12   [?] [Checks 1⚠] [Submit] │
├────────────────────────┬─────────────────────────────────────────────────────┬────────────────────────────────┤
│ NAVIGATOR          [«] │ ◀ Page 7 of 12 ▶   [−] 100% [+]  [Fit width] [Fit   │ ANNOTATION                 [»] │
│ Task  [TK-0B1A20 ▾]    │ page]  [⟳ Rotate]  [✋ Pan]        [⤢ Full screen]   │ [Transcription] [Correction]   │
│ ── Progress ────────── │ ┌─────────────────────────────────────────────────┐ │ [Labels] [Metadata] [Notes]    │
│ Pages 6 / 12 done      │ │                                                 │ │ [Comments 0] [History]         │
│ ▓▓▓▓▓▓▓▓░░░░░░░ 50%    │ │   ┌───────────────────────────────────────┐     │ │ ─────────────────────────────  │
│ ── Pages ───────────── │ │   │ ព្រះរាជាណាចក្រកម្ពុជា                  │     │ │ Transcription · page 7         │
│ ✓ 1  cover             │ │   │ ជាតិ សាសនា ព្រះមហាក្សត្រ                │     │ │ ┌────────────────────────────┐ │
│ ✓ 2  article           │ │   │ ═══════════════                       │     │ │ │ព្រះរាជាណាចក្រកម្ពុជា         │ │
│ ✓ 3  article           │ │   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │     │ │ │ជាតិ សាសនា ព្រះមហាក្សត្រ       │ │
│ ✓ 4  article           │ │   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░        │     │ │ │                            │ │
│ ✓ 5  advertisement     │ │   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │     │ │ │ការប្រកាសព័ត៌មាន…▏           │ │
│ ✓ 6  article           │ │   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░           │     │ │ │                            │ │
│ ▸ 7  ·  (current)      │ │   │     page image (white page surface     │     │ │ │ 16px, line-height 1.9,     │ │
│ ○ 8                    │ │   │      in both themes, canvas = muted)   │     │ │ │ lang=km, spellcheck off    │ │
│ ○ 9                    │ │   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │     │ │ └────────────────────────────┘ │
│ ○ 10                   │ │   └───────────────────────────────────────┘     │ │ 1,284 characters · ¶ show ZWSP │
│ ○ 11                   │ │                                                 │ │ ─────────────────────────────  │
│ ○ 12                   │ │                                                 │ │ Page label (required)          │
│ ── Instructions ───[▾] │ │                                                 │ │ [article ▾]                    │
│ 1. Transcribe exactly  │ │                                                 │ │                                │
│    as printed; keep    │ │                                                 │ │                                │
│    line breaks.        │ │                                                 │ │                                │
│ 2. Use ZWSP only where │ └─────────────────────────────────────────────────┘ │                                │
│    printed text has    │ Thumbnails ▸ [1][2][3][4][5][6][7][8][9][10][11][12]│                                │
│    word separation …   │                                                     │                                │
│ [Open full ↗]          │                                                     │                                │
├────────────────────────┴─────────────────────────────────────────────────────┴────────────────────────────────┤
│ ✓ Saved 10:42:13 · version 12 · Khmer input · Undo ⌃Z / Redo ⌃⇧Z · Shortcuts ?                 Alt+1/2/3 panels │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 Panel widths: navigator 280 (min 240, collapse to 48 rail) · document fluid (min 480) · annotation 420 (min 360).
 Resize handles are focusable separators (←/→ adjust 16 px, Enter toggles collapse).
```

### Left panel — task switcher open

```
┌ Task  [TK-0B1A20 ▾] ─────────────────┐
│ ⌕ {Filter my tasks}                  │
│ ✎ TK-0B1A20 1998-01-02 In progress ● │
│ ○ TK-0B1A21 1998-01-03 Assigned      │
│ ○ TK-0B1A22 1998-01-04 Assigned      │
│ (tasks in this project only)         │
│ Switching saves the current task first│
└──────────────────────────────────────┘
```

### Right panel tabs

```
[Correction]                                   [Labels] (when Classification enabled)
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│ Extracted text (read-only, page 7)   │       │ Classification (select all that      │
│ ┌──────────────────────────────────┐ │       │ apply)                               │
│ │ ព្រះរាជាណាចក្រកម្ពុជា ...           │ │       │ [✓ news] [ ads] [✓ government]       │
│ └──────────────────────────────────┘ │       │ [ education] [ religion]             │
│ [Copy into corrected text]           │       │ Alt+1…9 toggles while focused        │
│ Corrected text                       │       │ Page label (per page)                │
│ ┌──────────────────────────────────┐ │       │ [article ▾]                          │
│ │ ព្រះរាជាណាចក្រកម្ពុជា ...▏           │ │       └──────────────────────────────────────┘
│ └──────────────────────────────────┘ │
│ Diff vs extracted: 3 changes [Show]  │       [Metadata] (schema-driven)
└──────────────────────────────────────┘       ┌──────────────────────────────────────┐
                                               │ Publication date (required)          │
[Notes]                                        │ {02/01/1998}                         │
┌──────────────────────────────────────┐       │ Section                              │
│ Notes for reviewer (optional)        │       │ [politics ▾]                         │
│ {Bottom 2 lines are torn; marked     │       │ Page count printed                   │
│  with [illegible].................}  │       │ {12.....}  must be a number ⚠        │
└──────────────────────────────────────┘       └──────────────────────────────────────┘

[Comments] (read-only; on changes_requested shown pinned at top of every tab)
┌──────────────────────────────────────────────────────────────┐
│ ⚠ Changes requested · Vannak S. · 26 Oct 09:40 · score 3/5    │
│ "Line 3: 'ប្រជំ' should be 'ប្រជុំ'; page label should be 'article'."    │
│ Page 2 · line 3 → [Go to page]                               │
└──────────────────────────────────────────────────────────────┘
```

### Save status states (`SaveIndicator`, top bar + status bar)

```
 ✓ Saved 10:42 · v12        (success tone)        … Saving…                 (progress tone)
 ● Unsaved changes          (neutral, after edit)  ⚠ Offline — kept on this device, will sync
 ⛔ Conflict — review needed (danger; opens conflict banner)
```

### Conflict banner (409 on `PUT …/draft`)

```
┌ ⛔ This task was saved from another tab or device (server v13, yours based on v12). ──────────────────────┐
│ Your changes are safe on this device. Choose what to keep:                                              │
│ ┌ Server copy (v13) ───────────────────────────┐ ┌ Your copy ──────────────────────────────────────────┐ │
│ │ …ការប្រកាសព័ត៌មាន ថ្ងៃទី២                   │ │ …ការប្រកាសព័ត៌មាន ថ្ងៃទី២ ខែមករា                     │ │
│ │                    ─── removed ───          │ │                          +++ added +++              │ │
│ └──────────────────────────────────────────────┘ └─────────────────────────────────────────────────────┘ │
│ Field: Transcription p.7 (1 of 2 conflicting fields)  ‹ ›                                               │
│                           [Use server copy]  [Keep mine (save as v14)]  [Copy mine to clipboard]         │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 Editing is locked until each conflicting field is resolved. Diff uses −/+ markers and colour.
```

### Draft recovery dialog (on open, local copy newer than server)

```
┌ Restore unsaved changes? ─────────────────────────────────────┐
│ This device has changes to TK-0B1A20 from 26 Oct 10:43 that   │
│ weren't saved to the server (server last saved 10:42, v12).   │
│ Pages affected: 7                                             │
│                 [Discard local changes]  [Restore and save]   │
└───────────────────────────────────────────────────────────────┘
```

### Submit dialog with validation

```
┌ Submit TK-0B1A20 for review? ─────────────────────────────────┐
│ ✓ 12 of 12 pages transcribed                                  │
│ ✓ Page labels set on all pages                                │
│ ⚠ Metadata "Page count printed" must be a number  [Fix →]     │
│ You can't edit after submitting unless the reviewer requests  │
│ changes.                                                      │
│                              [Cancel]  [Submit] (disabled     │
│                                         until errors fixed)   │
└───────────────────────────────────────────────────────────────┘
 After submit: editor read-only, banner "Submitted for review 26 Oct 10:50 — you'll be notified."
```

### Version history (right panel `[History]` tab, `Ctrl/⌘ ⇧ V`)

```
┌ Version history ─────────────────────────────┐
│ v13  26 Oct 10:44  draft      you            │
│ v12  26 Oct 10:42  draft      you            │
│ v7   25 Oct 17:10  submitted  you   ● review │
│ …                                            │
│ Selected v7: read-only preview in panel      │
│ [Compare with current]  [Restore this version]│
└──────────────────────────────────────────────┘
 Restore copies v7 content into the draft and saves as a new version (L2 confirm).
```

### Keyboard shortcuts dialog (`?`)

```
┌ Keyboard shortcuts ───────────────────────────────────────────────────────────┐
│ General                         Document viewer (when focused)                │
│ Save now           Ctrl S       Zoom in / out        + / −                    │
│ Submit             Ctrl Enter   Fit width / page     0 / Shift 0              │
│ Next / prev page   Alt PgDn/PgUp Rotate              R                        │
│ Next / prev task   Alt ⇧ → / ←  Pan                  Arrow keys               │
│ Focus panel 1/2/3  Alt 1/2/3    Next / prev page     ] / [                    │
│ Cycle panels       F6           Annotation                                    │
│ Instructions       Ctrl ⇧ H     Undo / redo labels   Ctrl Z / Ctrl ⇧ Z         │
│ Version history    Ctrl ⇧ V     Toggle label n       Alt 1…9 (label group)     │
│ Invisible chars    Ctrl ⇧ I     Close dialog         Esc                      │
│ Single-key shortcuts: [On]  (Settings › Accessibility)                        │
└───────────────────────────────────────────────────────────────────────────────┘
 macOS shows ⌘ instead of Ctrl. All shortcuts are ignored during IME composition.
```

### Read-only notice (< 1024 px)

```
┌───────────────────────────────────┐
│ ← TK-0B1A20        [● In progress]│
├───────────────────────────────────┤
│ ⓘ The editor needs a screen at    │
│ least 1024 px wide. You can read  │
│ the task here; open it on a       │
│ computer to edit.                 │
│ [Copy link]                       │
├───────────────────────────────────┤
│ Page 7 of 12      ‹  ›            │
│ ┌───────────────────────────────┐ │
│ │ ░░░ page image (pinch zoom) ░ │ │
│ └───────────────────────────────┘ │
│ Instructions ▸                    │
│ Reviewer comments ▸               │
│ Current transcription (read-only) │
└───────────────────────────────────┘
```

## #53 Submitted Tasks — `/annotate/submitted`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Submitted                                                                                    │
│ [Awaiting review 120] [In review 80] [Approved 98]                Project [All ▾]            │
│ ┌──────────────┬──────────────────────────┬──────────────┬──────────────────┬──────┬───────┐ │
│ │ Task         │ Project / source         │ Submitted    │ Status           │ Score│ Reward│ │
│ │ TK-0A0E10    │ Textbook OCR · p.14      │ 26 Oct 08:01 │ [● Submitted]    │ —    │ $0.05 │ │
│ │ TK-0A0E11    │ Textbook OCR · p.15      │ 26 Oct 08:20 │ [● In review]    │ —    │ $0.05 │ │
│ │ TK-0A0E01    │ Textbook OCR · p.1       │ 24 Oct 15:00 │ [● Approved]     │ 5/5  │ $0.05 │ │
│ └──────────────┴──────────────────────────┴──────────────┴──────────────────┴──────┴───────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #54 Annotation Feedback — `/annotate/feedback`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Feedback                                    [Needs action 2] [All feedback]                  │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ⚠ TK-0A0E02 · Textbook OCR · p.2 · Changes requested · Vannak S. · 26 Oct 09:40 · 3/5    │ │
│ │ "Line 3: 'ប្រជំ' should be 'ប្រជុំ'; page label should be 'article'."                  [Fix now →] │ │
│ ├──────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ ✓ TK-0A0E01 · Textbook OCR · p.1 · Approved · Vannak S. · 24 Oct · 5/5                    │ │
│ │ "Clean transcription, good handling of the torn margin."                                 │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ Summary: average score 4.6 · return rate 4% (last 30 days)                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #55 Annotation Earnings — `/annotate/earnings`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Annotation earnings                                               [Withdraw →]               │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐                                │
│ │ THIS MONTH   │ LIFETIME     │ AWAITING     │ WALLET       │                                │
│ │ $4.90        │ $14.50       │ REVIEW       │ AVAILABLE    │                                │
│ │ 98 tasks     │ 290 tasks    │ ≈ $10.00     │ $14.50       │                                │
│ │              │              │ 200 tasks    │ (all sources)│                                │
│ └──────────────┴──────────────┴──────────────┴──────────────┘                                │
│ Rewards                                                                                      │
│ ┌──────────────┬──────────────────────────┬──────────────┬──────────────┬─────────────────┐  │
│ │ Approved     │ Task                     │ Unit         │ Reward       │ Credited        │  │
│ │ 24 Oct 15:02 │ TK-0A0E01 Textbook p.1   │ 1 page       │ $0.05        │ ✓ available     │  │
│ └──────────────┴──────────────────────────┴──────────────┴──────────────┴─────────────────┘  │
│ By project: Textbook OCR $12.30 · Receipts classification $2.20                              │
│ Annotation rewards are separate from dataset purchase earnings and appear together in your  │
│ wallet (Earnings › Transactions).                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
