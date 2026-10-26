# DataHub — Reviewer Guide

| Field | Value |
|---|---|
| **Purpose** | Help reviewers review datasets and annotations fairly, consistently and safely: claim work, inspect files, decide, score, finalize, give feedback, and protect confidential data. |
| **Audience** | Reviewers, and admins or super admins who perform reviews. |
| **Scope** | Dataset review queue and claiming, the review workspace, checklist and scoring rubric, per-file decisions and reason codes, partial approval, labeled upgrade, payable summary, finalize, annotation review and comparison, QA sampling, separation of duties, confidentiality. The normative rules are in [DATA_QUALITY_REVIEW.md](../05-data-annotation/DATA_QUALITY_REVIEW.md) and [ANNOTATION_GUIDELINES.md](../05-data-annotation/ANNOTATION_GUIDELINES.md) §12. |
| **Last updated** | 2026-10-26 |
| **Status** | Baseline — screenshots to be added after implementation. |
| **Sources** | [ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md) §6, §8, §9, §16 (AM-09: `review_max_active_claims` default 5); [UI_UX_DESIGN.md](../03-ui-ux-design/UI_UX_DESIGN.md) §3, §9.4, §12; [DATA_QUALITY_REVIEW.md](../05-data-annotation/DATA_QUALITY_REVIEW.md); [PRICING_PAYOUT_POLICY.md](../01-business-product/PRICING_PAYOUT_POLICY.md) §2–§5; [DATA_PRIVACY_OWNERSHIP.md](../05-data-annotation/DATA_PRIVACY_OWNERSHIP.md) §5–§8, §11.3; [AUTH_AUTHORIZATION.md](../04-backend-api/AUTH_AUTHORIZATION.md) §12. If this guide and those documents disagree, those documents win. |

---

## 1. Before your first review

- You need the `reviewer` role (an admin grants it). Choose **Review** in the workspace switcher to open `/review`.
- Accept the **confidentiality undertaking** (`CU-1`) before your first claim. It means: keep all documents confidential, use them only for your review, never copy, download (except as allowed in §5.3), photograph, share or put them into outside tools, and report leaks or sensitive content within 24 hours.
- Work on a screen **at least 1024 px wide** (1280 px or more recommended). The review workspace is read-only on smaller screens.
- Datasets that may contain personal data (`contains_personal_data` = `yes` or `unsure`) can be claimed only by reviewers with the **privacy-trained** flag. Ask an admin about training.

## 2. Your pages

| Page | Route | Use |
|---|---|---|
| Reviewer dashboard | `/review` | Counts, your in-progress reviews, queue previews (oldest first; age chip amber > 3 days, red > 7 days). |
| Dataset review tasks | `/review/datasets` (`?tab=queue` or `?tab=mine`) | Unclaimed datasets and your claimed ones. |
| Dataset review workspace | `/review/datasets/[reviewId]` | Decide files, checklist, scores, finalize. |
| Annotation review tasks | `/review/annotations` (`?tab=queue` or `?tab=mine`) | Submitted annotation tasks and your claimed ones. |
| Annotation comparison | `/review/annotations/[taskId]` | Compare source and annotation, score, decide. |
| Review history | `/review/history` (`?type=datasets` or `?type=annotations`) | Your finalized reviews (read-only). |

## 3. Dataset review queue and claiming

### 3.1 The queue (`/review/datasets?tab=queue`)

- Lists `submitted` datasets, **oldest first**.
- You see only summary details: dataset code, title, category, languages, data class, size, file count, submitted date. You cannot open files until you claim.
- **Returning (vN)** means a resubmission after changes were requested. The previous reviewer is shown as a pseudonym.
- A **privacy** badge means the dataset may contain personal data.
- Your own datasets never appear.

### 3.2 Claim

1. Click **Claim** on a dataset.
2. The dataset moves to `in_review`, and you become its only reviewer. Two reviewers can never claim the same dataset.
3. The workspace opens.

**Limit:** you can hold at most **5 active claims** at a time (setting `review_max_active_claims`, default 5). Finish or release one before claiming another.

**Service targets:** claim within **5 business days** of submission; finalize within **10 business days**. Admins see claims with no activity for over **72 hours** and may release them.

### 3.3 Release a claim

Click **Release** (bottom bar) when you cannot finish, or when you have a **conflict of interest** (family member, employer, or your own source material uploaded by someone else). For a conflict, choose the reason `conflict_of_interest`.

- The dataset returns to the queue.
- Your draft file decisions are not carried over. The next reviewer starts a new review. Your decisions stay in the audit history.

## 4. The review workspace (`/review/datasets/[reviewId]`)

```
┌──────────────┬───────────────────────────────┬──────────────────────┐
│ Files        │ Preview                       │ Decision             │
│ filter: un-  │ page image / text / table     │ file info, scan,     │
│ decided,     │ zoom · pan · rotate · pages   │ duplicates, Accept / │
│ accepted,    │ [Download original]           │ Reject + reason +    │
│ rejected,    │                               │ comment, labeled     │
│ duplicates,  │                               │ upgrade; tabs:       │
│ failed       │                               │ Checklist · Scores · │
│              │                               │ Metadata · Comments ·│
│              │                               │ History              │
├──────────────┴───────────────────────────────┴──────────────────────┤
│ Summary: decided N/M · accepted GB · rejected GB · data class ·      │
│ payable (floor) · [Release] [Finalize…]                             │
└──────────────────────────────────────────────────────────────────────┘
```

- **Files panel (left):** filter by undecided, accepted, rejected, flagged duplicates, failed. Each row shows type, name, size and decision. Select several rows for bulk actions. ZIP members are listed under their ZIP. The ZIP itself has no decision.
- **Preview (center):** page images for PDF, TIFF and images; text for DOCX, ODT, RTF and TXT; tables for CSV, JSON and XLSX.
- **Decision panel (right):** file metadata, processing and scan status, duplicate warnings with links, the Accept/Reject controls, reason code, comment, and the labeled-upgrade checkbox when it applies. Below: Checklist, Quality scores, Dataset metadata, Comments, History.
- **Summary bar (bottom):** decided files, accepted size (GB, 3 decimals), rejected size, data class, payable amount, Release, Finalize.

Every file decision **saves immediately**. You can leave and come back.

**Files excluded by the system** (failed or quarantined) appear under "Excluded by system" with their code (`type_mismatch`, `disallowed_type`, `nested_archive`, `zip_limits_exceeded`, `unsafe_member_path`, `corrupt`, `infected`, `scan_error`). They need no decision and are never paid.

### 4.1 Workspace shortcuts (file list focused)

| Action | Key |
|---|---|
| Next / previous file | `J` / `K` |
| Accept | `A` |
| Reject (moves focus to reason) | `X` |
| Clear decision | `U` |
| Show duplicates | `D` |
| Accept all selected | `Shift A` |
| Open finalize dialog | `Ctrl Enter` (`Cmd Enter` on macOS) |

Single-key shortcuts can be turned off at `/settings?tab=accessibility`.

## 5. Quality checklist and file inspection

### 5.1 Checklist (each item: pass, fail or n/a)

| ID | Check |
|---|---|
| CL-01 | Title and description match the content. |
| CL-02 | Languages are correct. |
| CL-03 | Category is correct. |
| CL-04 | Data class is correct (see §7). |
| CL-05 | Source and licence are plausible. |
| CL-06 | The personal-data answer is correct. |
| CL-07 | No sensitive documents without a basis. |
| CL-08 | Duplicates are resolved. |
| CL-09 | Sampling coverage is met (§5.2). |
| CL-10 | Khmer text is Unicode (when text files are present). |
| CL-11 | No size inflation. |

Datasets that include Khmer (`km`) also show Khmer checks: Unicode vs legacy encoding, script legibility, diacritic clarity.

### 5.2 How many files to open

- **50 reviewable files or fewer:** open every file.
- **More than 50:** open at least **50 files or 10 %, whichever is more**. Use the **random sample** button. Also open every flagged file (near duplicate, personal data, "other" extension, low resolution) and at least one member of each ZIP.
- You may decide unopened files **in bulk** only if **5 % or fewer** of opened files were rejected. Otherwise, open every file.
- The system records which files you opened.

### 5.3 Special file types

- **DOC** files have no preview. Download them and open them in a sandboxed viewer with macros disabled. If you cannot open one safely, reject it `wrong_format` and ask for DOCX or PDF.
- **"Other" extensions** (allowed by an admin setting): accept only if you can open them safely and they meet all acceptance criteria. Otherwise reject `wrong_format`.

### 5.4 Acceptance criteria — accept a file only if all are true

| # | Criterion | Guidance |
|---|---|---|
| AC-1 | Readable / usable | Text legible at 100 % zoom (about 200 DPI or better; 300 recommended). Digital text has a real encoding. |
| AC-2 | Relevant | Text-bearing content useful for Khmer-first OCR/NLP, consistent with the category. |
| AC-3 | Unique | Not an exact duplicate of accepted content; not a near duplicate that adds nothing. |
| AC-4 | Lawful and permitted | The rights claim is plausible: no commercial e-book rip, publisher watermark, "© All rights reserved" without permission evidence, or "confidential" marking without evidence. |
| AC-5 | Matches metadata | Language, category and period match the dataset details. |
| AC-6 | Honest size | No padding, embedded junk, upscaled images, repeated pages or inflated re-encodes. |
| AC-7 | Complete | Not truncated, unless the description says it is a fragment. |

## 6. Per-file decisions and reason codes

For each file choose **Accept** or **Reject**. A rejected file needs a **reason code**. Some codes also need a comment.

| Code | Use when | Comment required |
|---|---|---|
| `duplicate` | Same content already held, or a repeat inside this dataset. | No |
| `near_duplicate` | Re-scan or resized copy that adds no new information. | No |
| `corrupt` | Damaged: blank renders, garbled pages, truncated text. | No |
| `illegible` | Text cannot be read reliably. | No |
| `off_topic` | Not text-bearing or not relevant. | No |
| `personal_data` | Undeclared or unacceptable personal data. | **Yes** |
| `copyright_concern` | Rights cannot be confirmed. | **Yes** |
| `malware` | Suspicious content the scanner missed. | No (admins are alerted automatically) |
| `wrong_format` | Unsupported, cannot be previewed safely, or wrong encoding. | No |
| `low_quality` | Below the acceptance threshold. | **Yes** |
| `incomplete` | Incomplete compared with the description. | **Yes** |
| `metadata_mismatch` | Title, language, category, data class or source does not match. | **Yes** |
| `size_inflation` | Padded or re-encoded to look bigger. | **Yes** |
| `other` | None of the above. | **Yes** |

**Duplicates**

| Situation | What you do |
|---|---|
| Exact duplicate of **previously accepted** content | It is pre-marked `rejected / duplicate`. Leave it, except for a labeled upgrade (§7). |
| Exact duplicate **inside this dataset** | Later copies are pre-marked rejected. Leave them. |
| Exact duplicate of content **pending elsewhere** | Decide normally. At finalize the system re-checks; whoever finalizes first wins. |
| Near duplicate | Reject `near_duplicate` if it adds nothing; accept if it is a different page or edition. |
| Contributor resubmits a file rejected before | Reject with the same reason unless the reason no longer applies. |

Never reveal another user's dataset, name or file name in feedback. The message for duplicates is only "This file duplicates content already held by the platform."

**Personal data** is acceptable only if it is incidental (or needed for the document's value, such as realistic forms), declared by the contributor, of no special category (unless the Data Protection Lead approved it in writing), and the dataset will be redacted in annotation. Otherwise reject `personal_data`.

**Sensitive documents** (classified or secret government documents, confidential company files, ID cards, passports, medical records, bank statements, documents about children, unpublished case files) are prohibited by default. Reject them and the admin team is notified.

## 7. Raw vs labeled, and the labeled-upgrade checkbox

**Confirm `labeled` only if:**

1. Labels exist for at least 95 % of the files they describe.
2. The label format is documented (`paired_text`, `sidecar_json`, `csv_mapping`, `jsonl`, `other_documented`).
3. A spot check of at least 10 labeled items (or all, if fewer) finds CER ≤ 2 % for transcriptions and ≥ 95 % correct for classification labels.
4. Khmer label text is Unicode, not a legacy font.

If not: change the data class to `raw` (and explain in the feedback), or request changes (`metadata_mismatch` or `low_quality`). A data-class change always needs a comment. Mixed raw/labeled datasets: request changes (`metadata_mismatch`) or downgrade to raw.

**Labeled-upgrade checkbox.** It appears on a file that was already paid at the raw rate, when this dataset is labeled. Tick it **only** if this submission adds accurate labels for that file (it passed check 3). The file then earns only the difference between the labeled and raw rates. Without the tick it earns $0. The labels may come from a different contributor; check they hold the rights to the labels.

## 8. Quality scores (rubric)

Score each dimension 1–5. Scores are **required** for approve and partial, optional for reject and request changes. They describe the **accepted** part only.

| Dimension | Weight | 1 | 3 | 5 |
|---|---|---|---|---|
| Legibility | 0.25 | Mostly unreadable | Readable with effort in places | Crisp scans or native text |
| Completeness | 0.15 | Fragments only | Some gaps, documented | Complete as described |
| Relevance | 0.25 | Off-topic | Useful, common material | Rare Khmer content, handwriting, historic, gold-standard labels |
| Metadata accuracy | 0.15 | Wrong or misleading | Minor corrections needed | Accurate and rich |
| Labeling accuracy (labeled only) | 0.20 | Unusable labels | CER ≤ 5 % / ≥ 90 % correct | CER ≤ 0.5 % / ≥ 99 % correct |

Scores 2 and 4 sit between the descriptions (see DATA_QUALITY_REVIEW.md §5 for every level).

- For **raw** datasets, labeling accuracy is not scored and the other weights are rescaled.
- **Overall** = weighted average, rounded half up to 2 decimals. Example (raw): legibility 4, completeness 5, relevance 4, metadata 3 → (1.00 + 0.75 + 1.00 + 0.45) / 0.80 = **4.00**.
- Tiers: **A** ≥ 4.00, **B** 3.00–3.99, **C** below 3.00.
- **Approve** needs overall ≥ 3.00 and no dimension below 2. A **partial** with overall below 3.00 needs a written justification in the internal notes.
- Scores do **not** change the price. They are used for export filters and statistics.

## 9. Payable summary and finalize

### 9.1 Summary

Before finalizing, check the summary: accepted and rejected bytes and counts, excluded files, and the **payable amount**. It uses the same formula as finalize (`floor(bytes × rate ÷ 1,000,000,000)` per file, decimal GB, $1.00 raw / $1.50 labeled) and is marked "will be fixed at finalize". The rate in force at the moment you finalize is the one paid.

### 9.2 Finalize decisions

Click **Finalize…** (`Ctrl Enter`). The options depend on your file decisions.

| Decision | When | Requirements | Result |
|---|---|---|---|
| **Approve** | Every reviewable file accepted | All files decided, checklist complete, scores present | `approved`, earnings credited once |
| **Partially approve** | At least one accepted and one rejected | All files decided, checklist complete, scores present | `partially_approved`, accepted eligible files paid once |
| **Reject** | No usable files | At least one reason code; feedback ≥ 30 characters. Undecided files are set to rejected with the dataset reason. | `rejected`, no earnings, final |
| **Request changes** | The contributor can fix it | At least one reason code; feedback ≥ 30 characters; fewer than 3 earlier change requests | `changes_requested`, no earnings |

- A dataset can receive **at most 3** change requests. On the fourth review you must approve, partially approve or reject.
- **Incomplete datasets:** request changes (`incomplete`) if the contributor can supply the missing part; partially approve the usable files and explain what is missing; or reject (`incomplete`) if the rest has no value on its own.
- If the payable amount is above $0.00, you must **type the exact payable amount** to confirm. If it is $0.00, you confirm with a reason.
- Finalize happens once. Double-clicks and retries do not pay twice. A finalized review **cannot be changed**. Mistakes are fixed only by a super admin adjustment.

### 9.3 Writing feedback

- **Mandatory** (≥ 30 characters) for reject and request changes. Optional for approve and partial (the system adds an automatic summary).
- **Specific:** name the file code and page (for example `DS-2026-000123/F00042, p.3`).
- **Actionable:** say what would make the file acceptable.
- **Courteous.** No personal remarks. No other users' information.
- **Fraud suspicions go in the internal notes** (admins only), never in feedback.
- The contributor sees you as a pseudonym (for example "Reviewer 19a2"), never by name.

## 10. Annotation review

### 10.1 Claim

1. Go to `/review/annotations?tab=queue`.
2. Click **Claim**. The task moves from `submitted` to `in_review`.
3. Tasks you annotated (in any version) never appear in your queue.

### 10.2 The comparison page (`/review/annotations/[taskId]`)

- Source page on one side, the submitted annotation on the other.
- **Compare versions** (`?compare=<versionA>..<versionB>`) shows changes since the last reviewed version.
- Labels, metadata, notes and earlier comments are shown.
- Usable on screens 768 px wide or more.

### 10.3 Procedure

1. **Choose pages to check.** Tasks of 5 pages or fewer: every page. Longer tasks: at least 5 pages or 20 %, whichever is more. Always include the first page, the last page, and every page with a marker or a validation warning.
2. **Measure CER.** Correct the text in **review mode**. This saves your reference copy and does not overwrite the annotator's version. The editor computes CER = edit distance ÷ reference length.
3. **Check** classification, metadata and page labels against the page.
4. **Score 1–5** and decide:

| Score | CER | Other conditions | Decision |
|---|---|---|---|
| 5 | ≤ 0.5 % | Labels and metadata 100 % correct; no unresolved warnings | Approve |
| 4 | ≤ 1.0 % | Same | Approve |
| 3 | ≤ 2.0 % | Same | Approve (comment on errors) |
| 2 | > 2.0 % and ≤ 5.0 % | or any wrong label or required metadata field | Request changes |
| 1 | > 5.0 % | or any zero-tolerance error | Request changes |

**Zero-tolerance errors** (score 1): invented text; wrong page or file; legacy-font or look-alike encoding; pasted external machine output; sensitive content transcribed when the annotator should have stopped; personal data left unredacted when redaction was enabled.

5. **Comments** are mandatory for request changes. Quote page, line and rule: "p.2 l.4: E3 COENG RO order".
6. **Approve** → task `approved`, the reward is credited once. **Request changes** → task `changes_requested`, back to the annotator.

An admin is notified when an annotator gets three scores of 1 within 30 days.

## 11. QA sampling

**Annotation QA.** About **10 %** of approved annotation tasks (setting `annotation_qa_sample_rate`) are picked at random for a **blind second review**.

- The QA reviewer must differ from the annotator and the first reviewer.
- You do not see the first reviewer's score or comments until you submit.
- QA **never** changes the task status and **never** creates or removes rewards.
- **Pass:** CER ≤ 2 % and labels correct. **Fail:** the annotation is flagged `qa_failed`; an admin may create a follow-up correction task, and the data is excluded from exports until fixed.
- Calibration: an annotator under 80 % pass rate in 30 days (at least 5 samples) gets no new tasks until retrained. A reviewer whose approvals fail QA more than 20 % of the time in 30 days (at least 5 samples) is recalibrated.

**Dataset-review QA.** Each month an admin re-examines a random 5 % of finalized dataset reviews (at least 2 per reviewer) and discusses disagreements with you.

## 12. Separation of duties

| Rule | What happens if broken |
|---|---|
| You cannot review a dataset you own. | Not in your queue; claim refused. |
| You cannot review an annotation task you worked on (any version). | Not in your queue; claim refused. |
| You must declare conflicts of interest. | Release the claim with reason `conflict_of_interest`. |
| Only the reviewer who claimed a review can decide or finalize it. | Others can read (admins) but not act. |
| QA reviewers differ from the annotator and the first reviewer. | Enforced by the system. |
| You cannot correct a finalized outcome. | A super admin makes an adjustment if needed. |

## 13. Confidentiality and privacy

- You can open file content **only while you hold the claim**, and read-only afterwards for reviews you finalized.
- Every file open and download is logged. Admins review unusual access weekly (for example more than 500 file opens per day).
- Preview links expire after 5 minutes. Do not share them.
- Download only when needed (for example DOC files). Delete local copies as soon as you finish.
- Do not screenshot, photograph, copy or paste documents into any outside tool.
- You see contributors' display names only. Legal names, birth dates, phones and ID documents are visible only to admins who verify users.
- If you find malware, sensitive documents or undeclared personal data, reject the file with the right code (`malware`, `personal_data`, `copyright_concern`). These codes alert admins automatically.
- Report any suspected leak to an admin within 24 hours.

## 14. FAQ

**I claimed a dataset by mistake.**
Release it. The dataset returns to the queue.

**Can I change a decision after finalizing?**
No. Tell an admin. Corrections are made by a super admin through an adjustment.

**The scan status says `error`.**
The file cannot be accepted until it is scanned clean. Ask an admin to rescan it.

**Two datasets contain the same file and I review both.**
Decide normally. At finalize the system pays the content only once.

**The contributor marked the dataset `labeled`, but half the files have no labels.**
Request changes (`metadata_mismatch`) so they split it, or change it to raw and explain in the feedback.

**Do quality scores change the payment?**
No. They are used for export filters and statistics.

**Can I see who reviewed an annotation before me?**
In QA, not until you submit your own result.
