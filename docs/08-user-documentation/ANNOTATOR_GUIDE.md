# DataHub — Annotator Guide

| Field | Value |
|---|---|
| **Purpose** | Help annotators get access, find tasks, use the annotation editor, avoid lost work, submit good annotations, handle corrections, and understand rewards. |
| **Audience** | Annotators (users with the `annotator` role). Many are Khmer linguists working in English as a second language, so this guide uses short sentences. |
| **Scope** | Access, task list, task statuses, the three-panel editor, shortcuts, autosave, conflicts, Khmer typing, markers, submitting, corrections, rewards. The full annotation rules are in [ANNOTATION_GUIDELINES.md](../05-data-annotation/ANNOTATION_GUIDELINES.md) — read them too. Money and withdrawals are in [CONTRIBUTOR_GUIDE.md](CONTRIBUTOR_GUIDE.md) §12–§13. |
| **Last updated** | 2026-10-26 |
| **Status** | Baseline — screenshots to be added after implementation. |
| **Sources** | [ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md) §6, §9, §11, §16; [UI_UX_DESIGN.md](../03-ui-ux-design/UI_UX_DESIGN.md) §3, §9; [ANNOTATION_GUIDELINES.md](../05-data-annotation/ANNOTATION_GUIDELINES.md); [DATA_QUALITY_REVIEW.md](../05-data-annotation/DATA_QUALITY_REVIEW.md) §11; [DATA_PRIVACY_OWNERSHIP.md](../05-data-annotation/DATA_PRIVACY_OWNERSHIP.md) §3.2, §8, §11.3; [PRICING_PAYOUT_POLICY.md](../01-business-product/PRICING_PAYOUT_POLICY.md) §7.4. If this guide and those documents disagree, those documents win. |

---

## 1. Get annotator access

You need all of these:

1. **A DataHub account** with a verified email (see [CONTRIBUTOR_GUIDE.md](CONTRIBUTOR_GUIDE.md) §2).
2. **Approved verification** (`/profile?tab=verification`). Without it, nobody can assign tasks to you.
3. **The `annotator` role.** An admin adds it. Ask DataHub support in `/messages` if you were invited to annotate.
4. **The confidentiality undertaking** (`CU-1`). You accept it before your first task. In short: keep all documents confidential, use them only for your tasks, never copy, download, photograph or share them, never put them into outside tools, and report leaks or sensitive content within 24 hours.

**Your equipment**

- A computer with a screen **at least 1024 px wide** (1280 px or more is best). On a phone or small tablet, you can read tasks and feedback, but you cannot edit.
- A current Chrome, Edge, Firefox or Safari.
- A **Unicode Khmer keyboard (NiDA layout)**. Never use a legacy font or keyboard such as Limon or ABC.
- Fonts are provided by the editor (Noto Sans Khmer).

When you have the role, a **workspace switcher** appears at the top of the sidebar. Choose **Annotate** to open `/annotate`.

## 2. Your pages

| Page | Route | What it shows |
|---|---|---|
| Annotator dashboard | `/annotate` | "Continue where you left off", counts (assigned, in progress, changes requested, approved this month, rewards available), tasks due soon, recent feedback. |
| My tasks | `/annotate/tasks` | All tasks assigned to you: status, project, unit, reward, deadline. The badge shows tasks returned for correction. |
| Task details | `/annotate/tasks/[id]` | Instructions, source file, reward, deadline, history, reviewer feedback, **Start** / **Continue**. |
| Annotation editor | `/annotate/tasks/[id]/edit` | The three-panel editor (§4). |
| Submitted | `/annotate/submitted` | Tasks you submitted, in review or approved, with outcome and reward. |
| Feedback | `/annotate/feedback` | Reviewer comments and scores. Tasks with changes requested come first. |
| Annotation earnings | `/annotate/earnings` | Your rewards per task and project, and a link to withdrawals. |
| Withdrawals | `/withdrawals` | Request money (same rules as contributors). |

## 3. Task statuses

| Status | Meaning | What you do |
|---|---|---|
| `assigned` | The task is yours. You have not started. | Open it and click **Start**. |
| `in_progress` | You are working on it. | Keep working. Autosave is on. |
| `submitted` | You submitted it. It is locked. | Wait for a reviewer. |
| `in_review` | A reviewer is checking it. | Wait. |
| `approved` | Accepted. Your reward is credited. | Nothing. Well done. |
| `changes_requested` | The reviewer wants fixes. | Read the comments, fix, submit again (§9). |
| `cancelled` | The project was closed or the task was cancelled. | Nothing. No reward. |

An admin can also **unassign** or **reassign** a task that is `assigned` or `in_progress`. Your draft is kept as a version, and the next annotator continues from it.

## 4. The three-panel editor

Open a task and click **Start** (or **Continue**). The editor opens at `/annotate/tasks/[id]/edit`. Opening an `assigned` task moves it to `in_progress`.

```
┌──────────────┬───────────────────────────────┬──────────────────────┐
│ Navigator    │ Document                      │ Annotation           │
│ (left)       │ (center)                      │ (right)              │
│ tasks, pages,│ page image or extracted text  │ transcription, labels│
│ instructions │ zoom · pan · rotate · pages   │ metadata, notes,     │
│              │                               │ comments, history    │
└──────────────┴───────────────────────────────┴──────────────────────┘
 Status bar: save state · last saved · version · character count · invisible characters · input hint
```

### 4.1 Left — Navigator

- **Task switcher:** your other tasks in this project.
- **Page list** with a tick for each finished page, and progress (pages done / total).
- **Instructions** for the project. Project instructions can narrow or extend the general guidelines. If they conflict, the project instructions win.
- Collapse the panel to a thin rail when you need more space.

### 4.2 Center — Document

- **Zoom:** fit width, fit page, or 25 % to 400 %. Zoom to 200–400 % to read small Khmer signs (ៈ, ះ, ់, ៍).
- **Pan:** drag the image, hold **Space** and drag, or use the arrow keys when the viewer has focus.
- **Rotate:** 90° steps. Rotation only changes your view. It never changes the file.
- **Page navigation:** next/previous page buttons, the page list, or shortcuts (§5).
- DOCX, ODT, RTF and TXT files show **extracted text** instead of page images.
- There is no download button. Do not screenshot or copy the source.

### 4.3 Right — Annotation

Sections depend on the project's annotation types:

| Section | What you do |
|---|---|
| Transcription (per page) | Type all text on the page in reading order. |
| Correction | Fix the machine (OCR) text so it matches the page exactly. The original text is shown read-only. |
| Page label | Choose one label for the page: `cover`, `title_page`, `table_of_contents`, `body_text`, `table`, `form`, `receipt`, `image_only`, `mixed`, `index`, `blank`, `illegible`, `back_cover`, `other`. |
| Classification | Choose the label(s) from the project's label set. One label unless the project allows more. |
| Metadata | Fill the project's form. Required fields must be filled. Leave optional fields empty if unknown — never guess. |
| Notes | Short, factual notes (for example "Page 2: water damage"). |
| Reviewer comments | Read-only. Newest first. |
| Version history | Your saved versions. |

### 4.4 Status bar

Shows the save state, last saved time, version number, character count, a **Show invisible characters** switch (to see spaces, tabs, line breaks and zero-width characters), and a Khmer/English input hint.

### 4.5 Report problem

Use **Report problem** when:

- the file is the wrong file or the wrong page,
- pre-filled text uses a legacy font (it looks like Latin nonsense),
- you find **sensitive content** (ID cards, passports, medical records, bank statements, documents about children, anything marked confidential or secret) and redaction is not enabled for the project,
- the source cannot be read at all.

The task is paused and an admin is notified. For sensitive content: **stop**. Do not transcribe further.

## 5. Keyboard shortcuts

On macOS, use `Cmd` instead of `Ctrl`. Press `?` (when you are not typing in a text field), `F1`, or `Ctrl /` to see the shortcut list in the editor.

**Important rules**

- Shortcuts never fire while you are composing text with an input method (IME).
- Single-key shortcuts (like `R`, `+`, `]`) work only when the **document viewer or navigator** has focus, never inside a text field.
- You can turn single-key shortcuts off at `/settings?tab=accessibility`.
- Where two keys are listed, both are defined in the design documents. The shortcut list in the editor shows the keys for your version.

| Action | Shortcut |
|---|---|
| Save now | `Ctrl S` |
| Submit (opens summary) | `Ctrl Enter` |
| Next / previous page | `Alt PageDown` / `Alt PageUp` (anywhere); `]` / `[` (viewer or navigator) |
| Next / previous task | `Alt Shift →` / `Alt Shift ←` |
| Focus navigator / document / annotation panel | `F6` cycles; `Alt 1` / `Alt 2` / `Alt 3` |
| Focus text panel / preview panel | `Ctrl Shift 1` / `Ctrl Shift 2` |
| Zoom in / out / fit width / fit page | `+` / `-` / `0` / `Shift 0` (viewer); also `Ctrl =` / `Ctrl -` / `Ctrl 0` |
| Rotate clockwise / counter-clockwise | `R` (viewer); also `Ctrl ]` / `Ctrl [` |
| Pan | Arrow keys (viewer); `Space` + drag |
| Undo / redo | `Ctrl Z` / `Ctrl Shift Z` (also `Ctrl Y`) |
| Toggle classification label 1–9 | `Alt 1`…`Alt 9` while the label group has focus |
| Insert `[illegible]` | `Ctrl Shift L` |
| Mark selection uncertain `[?:…]` (or insert `[?]` with no selection) | `Ctrl Shift U` |
| Redact selection `[REDACTED:…]` | `Ctrl Shift X` (only when redaction is enabled) |
| Insert `[figure]` / `[signature]` | `Ctrl Shift F` / `Ctrl Shift G` |
| Code-point inspector | `F2` |
| Show invisible characters | `Ctrl Shift I` |
| Show / hide instructions | `Ctrl Shift H` |
| Version history | `Ctrl Shift V` |
| Close dialog / exit full-screen viewer | `Esc` |

**Tip:** on some computers, `Alt Shift` switches the keyboard layout. If `Alt Shift →` changes your layout, use the task switcher in the navigator instead.

## 6. Autosave and save status

You do not need to click Save. The editor saves:

- after **5 seconds** without typing,
- when a field loses focus,
- when you change page,
- when you press `Ctrl S`.

| Status bar shows | Meaning |
|---|---|
| `Saving…` | Sending your changes. |
| `Saved hh:mm` | Your work is on the server. |
| `Offline — retrying` | No connection. Keep working. The editor retries. |

**Local backup.** The editor also keeps a copy of every change in your browser. If the browser crashes or the internet drops, open the task again. If your local copy is newer, the editor asks: **Restore unsaved local changes** or **Discard**. Normally choose Restore.

**Version history.** A new version is saved whenever the content changes. You can open the last 50 drafts and all submitted versions (`Ctrl Shift V`). Select a version to view it. **Restore this version** copies it into your current draft.

**Session timeout.** DataHub warns you 2 minutes before your session ends. Click **Stay signed in**. Even if you are signed out, your local copy is kept.

## 7. Conflicts (409 — "This task was changed elsewhere")

A conflict happens when the task was saved from **another place** after you opened it. For example, you had the task open in two tabs or on two computers.

What you see:

- A red banner that you cannot dismiss: "This task was changed elsewhere".
- A side-by-side comparison of the **server copy** and **your copy**, field by field.

What to do:

1. Read both copies carefully.
2. Choose one:
   - **Keep mine (overwrite)** — your copy replaces the server copy.
   - **Use server copy** — the server copy replaces yours.
   - Or copy the parts you need from one side to the other, then keep that copy.
3. The editor saves again with the new version number.

Nothing is overwritten without your choice. To avoid conflicts, **open each task in one tab only**.

## 8. Khmer typing tips

Full rules: [ANNOTATION_GUIDELINES.md](../05-data-annotation/ANNOTATION_GUIDELINES.md) §3–§5.

**Basics**

- **Type what is on the page.** Do not translate, modernise spelling or fix the author's mistakes (unless the project says so).
- Each printed line ends with Enter. A blank line marks a new paragraph.
- **Never add spaces between Khmer words.** Type a space only where there is a visible gap.
- Keep Khmer digits (០–៩) as Khmer. Keep Western digits as Western.
- Use the Khmer full stop ។, the Khmer colon ៖, and ៗ as printed. Do not type `:` after Khmer text unless the page uses a Latin colon (for example `10:30`).
- Tables: one row per line, cells separated by one Tab.
- Your text is saved **exactly as you type it**. The editor never changes it silently. Correct encoding is your job.

**Type in reading order inside each cluster**

Consonant → subscript (COENG + consonant; COENG RO ្រ last) → register sign (៉ or ៊) → **one** vowel → other signs (ំ ះ ៈ …).
Never type a vowel first just because it appears on the left (េ ែ ៃ).

**Common mistakes the editor warns about**

| Mistake | Wrong | Right |
|---|---|---|
| Split vowel | េ + ា | ោ (one character) |
| Sign before vowel | ឆ្នំា | ឆ្នាំ |
| COENG RO not last | ស្រ្តី | ស្ត្រី |
| Repeated vowel | កាា | កា |
| ASCII colon after Khmer | `ដូចខាងក្រោម:` | `ដូចខាងក្រោម៖` |
| Deprecated characters | U+17A3, U+17A4, U+17A8, U+17B4, U+17B5, U+17D3 | see guidelines §4.4 E8 |
| Zero-width characters | ZWNJ, ZWJ, BOM, soft hyphen | remove them |

**Check your work**

1. A dotted circle ◌ means a sign has no valid base. Fix it.
2. Select text and press **F2** to see each code point and the cluster boundaries.
3. Read the **validation panel**. Each warning has an **Apply fix** button. Nothing is fixed without your click.
4. Turn on **Show invisible characters** to find stray spaces and zero-width characters.
5. Zero-width space (ZWSP): type it **only** if the project instructions turn on word segmentation.

**Never** paste text from outside OCR tools, translation websites or AI chatbots. Only use pre-filled text that DataHub gives you.

## 9. Markers

Markers are ASCII, case-sensitive, and have no spaces. Put them only at cluster boundaries, never inside a Khmer cluster.

| Marker | Use it when | Example |
|---|---|---|
| `[?]` | You are unsure of the word just before it (a word followed by a space or line end). | `Phnom Penh[?]` |
| `[?:text]` | You are unsure of some characters without spaces around them (common in Khmer). | `ក្រសួង[?:សុខាភិបាល]` |
| `[illegible]` | A stretch (up to one line) cannot be read. Use one per unreadable line. | `[illegible]` |
| `[figure]` | A photo, drawing or chart without readable text. | `[figure]` |
| `[signature]` | A handwritten signature. | `[signature]` |
| `[REDACTED:<type>]` | Only when the project enables redaction. Replace the personal data, not its label. Types: `name`, `id_number`, `phone`, `email`, `address`, `date_of_birth`, `account_number`, `signature`, `other`. | `លេខអត្តសញ្ញាណប័ណ្ណ៖ [REDACTED:id_number]` |

- Mark doubt honestly. A clear `[?]` is never penalised. A confident wrong reading is.
- Two equally likely readings? Type the more common one and put the other in Notes.
- A whole unreadable page: transcription `[illegible]`, page label `illegible`, and a note with the reason.
- A blank page: empty transcription and page label `blank`.

## 10. Submit

1. Finish every page in the task.
2. Open the **Checks** list. Clear every **error** (missing required field, invalid marker, missing page text). Review every **warning**.
3. Press **Submit** (`Ctrl Enter`).
4. The summary dialog shows pages completed and any warnings. Errors block submission.
5. Confirm. The task becomes `submitted` and read-only, with the banner "Submitted for review".

## 11. Corrections (changes requested)

1. You get a notification. The task shows `changes_requested` in `/annotate/tasks` and at the top of `/annotate/feedback`.
2. Open the task. Reviewer comments are pinned at the top of the right panel. Pages with comments have markers in the navigator.
3. Comments name the page, line and rule, for example: "p.2 l.4: E3 COENG RO order".
4. Fix every point. If a comment is unclear, ask in the project conversation in `/messages`.
5. Submit again.

The task normally returns to you. An admin can reassign it.

**How reviewers score your work**

| Score | Character error rate (CER) | Result |
|---|---|---|
| 5 | ≤ 0.5 % | Approve |
| 4 | ≤ 1.0 % | Approve |
| 3 | ≤ 2.0 % | Approve, with comments |
| 2 | > 2.0 % and ≤ 5.0 %, or any wrong label or required metadata | Changes requested |
| 1 | > 5.0 %, or any zero-tolerance error | Changes requested |

Labels and metadata must be fully correct for approval.

**Zero-tolerance errors** (score 1, whatever the CER): invented text; the wrong page or file; legacy-font or look-alike encoding; pasted output from outside machines; transcribing sensitive content when you should have stopped; leaving personal data unredacted when redaction was enabled.

**Quality checks after approval.** About 10 % of approved tasks get a second, blind review. This does not change your task status or your reward for normal mistakes. If your pass rate over 30 days drops below 80 % (at least 5 samples), you get no new tasks until an admin retrains you.

## 12. Rewards

- Each project sets the reward: a fixed amount per task, and sometimes an amount per page.
- You see the reward on the task before you start.
- **You are paid once, when the task is approved.** Submitting does not pay. Changes requested does not pay.
- The reward goes to your wallet's **Available** balance straight away (by default there is no hold period; if DataHub sets one, it goes to Pending first and moves to Available later).
- You get a notification: "Annotation approved + Earnings credited".
- Rewards are shown at `/annotate/earnings` and as "Annotation work" at `/earnings`.
- Rewards and dataset earnings are in the same wallet. You can withdraw them together at `/withdrawals` (minimum $10.00, maximum $5,000.00, one open request at a time, verification required).
- Cancelled tasks earn nothing.
- Rewards are not taken back for normal quality issues. Proven fraud (invented text, pasted machine output) can lead to a debit and suspension.

**Who owns the annotations?** Under the draft Annotator Terms, copyright in your transcriptions and labels passes to SKAI Technology when the task is approved and paid. (Pending legal review.)

## 13. FAQ

**I see "The annotation editor is designed for screens at least 1024 px wide".**
You are on a small screen. You can read the task, instructions and feedback. Open it on a computer to edit.

**I lost my internet while typing. Is my work gone?**
No. The editor keeps a copy in your browser and saves when you reconnect. At most the last few seconds can be lost if the browser crashes.

**Why can't I see a task I worked on before?**
An admin may have reassigned it, or the project was closed. Your draft is kept as a version.

**Can I download the source file to work offline?**
No. Source documents stay in DataHub. This protects the contributor and is part of your confidentiality undertaking.

**Can I use Google Translate or an OCR app to speed up?**
No. Outside tools break confidentiality, and pasted machine output is a zero-tolerance error.

**The page text has square brackets like `[1]`.**
Type them normally. Only the exact marker patterns count as markers. If page text matches a marker pattern exactly, say so in Notes.

**Should I correct spelling mistakes in the original?**
No, unless the project instructions say `mode: normalised`. Type what is printed.

**Dates in the Buddhist Era (ព.ស.)?**
Do not convert them. Copy them into Notes (for example `date_be: ព.ស. ២៥៦៨`) and leave the date field empty, unless the project gives a rule.

**When is my reward credited?**
When a reviewer approves the task. Check `/annotate/earnings`.

**Who reviews my work?**
A reviewer who did not work on the task. You see reviewer comments, not the reviewer's name.
