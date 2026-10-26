# DataHub — Data Annotation Guidelines

## 0. Document header

| Field | Content |
|---|---|
| **Purpose** | The rules annotators follow and reviewers enforce when producing transcriptions, text corrections, classifications, metadata labels and page labels in the DataHub annotation editor. SKAI Technology uses these outputs to train and evaluate Khmer-first OCR and NLP models, so consistency matters more than speed. |
| **Scope** | Annotation types in v1: `transcription`, `text_correction`, `classification`, `metadata`, `page_label`. `bbox` is reserved and specified here as a design for a later release. Covers Khmer and English text, markers for uncertain or unreadable content, redaction, review and quality thresholds, and editor usage. |
| **Assumptions** | A-02 (km/en; transcription stored exactly as typed, NFC applied only to the export copy), A-08 (annotators must be verified before assignment), A-14 (reward per task, optional per page). |
| **Decisions** | Diplomatic transcription by default (type what is on the page); Khmer typed in standard Unicode order (§4); ASCII bracket markers `[?]`, `[?:…]`, `[illegible]`, `[signature]`, `[figure]`, `[REDACTED:<type>]`; ZWSP only when the project enables `word_segmentation`; approval needs a character error rate (CER) ≤ 2 % and no zero-tolerance error; 10 % of approved tasks are QA-sampled (DATA_QUALITY_REVIEW.md §11). |
| **Dependencies** | `docs/ENGINEERING_BASELINE.md` §6, §9, §11; DATASET_DOCUMENTATION.md (categories, export); DATA_QUALITY_REVIEW.md (QA sampling, audit); DATA_PRIVACY_OWNERSHIP.md (personal data, confidentiality); PRICING_PAYOUT_POLICY.md §7.4 (annotation rewards). |
| **Acceptance criteria** | (1) Every annotation type has unambiguous rules and at least one JSON example that validates against the baseline §11 shape. (2) Khmer rules list exact code points. (3) Markers can be parsed with the regular expressions in §7.4. (4) Review thresholds are numeric. (5) Every editor action has a documented shortcut or control. |

**Document control**

| Version | Date | Status | Owner | Change |
|---|---|---|---|---|
| v1.0 | 2026-10-26 | Baseline | Annotation lead | First baseline |

Project instructions (markdown written by the admin in `annotation_projects.instructions`) may **narrow** or **extend** these guidelines for a specific project, for example by turning on word segmentation or redaction. Where they conflict, the project instructions win, and the reviewer judges work against them.

---

## 1. Annotation principles

1. **Faithfulness.** Record what the document shows. Do not translate, summarise, modernise spelling or correct the author's mistakes unless the task type is `text_correction` and the project asks for normalisation.
2. **Completeness.** Every visible text element in scope is transcribed or explicitly marked (`[illegible]`, `[figure]`, `[signature]`). Silent omissions are errors.
3. **Honesty about uncertainty.** Mark doubt with `[?]` rather than guessing silently. A clearly marked uncertainty is never penalised. A confident wrong reading is.
4. **Correct encoding.** Khmer must be standard Unicode in the canonical typing order (§4). Text that only *looks* right but is encoded wrongly is still wrong.
5. **Consistency.** Apply the same rule every time within a task, a project and across annotators. When unsure, check this document and then ask in the project conversation.
6. **Confidentiality.** Source documents are private. Do not copy, screenshot, download or share them outside the editor. Do not paste them into external tools such as translation websites, chatbots or OCR services.
7. **No machine shortcuts unless provided.** Only use pre-filled text that the platform supplies (for example, OCR output in a `text_correction` task). Do not paste output from external OCR or AI systems.

## 2. Annotation types (v1)

| Type | Unit | Output field (baseline §11) | What you do |
|---|---|---|---|
| `transcription` | page | `pages[].transcription` | Type all text on the page in reading order. |
| `text_correction` | page | `pages[].corrected_text` | Fix the provided machine text so it matches the page exactly. |
| `classification` | file (task) | `classification[]` | Choose label(s) from the project's `label_set`. |
| `metadata` | file (task) | `metadata{}` | Fill the fields in the project's `metadata_schema`. |
| `page_label` | page | `pages[].page_label` | Choose one page label (§9). |
| `bbox` (reserved) | page | `pages[].regions[]` | Not enabled in v1. `regions` must be `[]` (§10). |

A project can combine types, for example transcription + page_label + metadata. Fields for types that are not enabled in the project are **omitted** from `data`. `regions` is always present as `[]`.

## 3. Document transcription rules

### 3.1 Reading order
- Single column: top to bottom, left to right.
- Multi-column: finish the left column top to bottom, then the next column. A headline spanning all columns comes first.
- Footnotes, headers, footers and page numbers: transcribe them in their position on the page (header first, footer last). Page numbers are transcribed, not skipped.
- Side notes and marginalia: after the main text of the same vertical band, prefixed by nothing. Mention them in `notes` if their placement matters.

### 3.2 Lines and paragraphs
- Each printed line ends with a line feed `\n`. Paragraph breaks are an empty line (`\n\n`).
- Keep end-of-line hyphenation in English exactly as printed (`informa-\ntion`). Khmer has no hyphenation. Never join or split a Khmer word to "fix" line wrapping.
- **Spaces.** Type a space only where there is a visible gap. Khmer does not separate words with spaces. Spaces mark phrase or sentence boundaries and appear in lists. Never add spaces between Khmer words.

### 3.3 Tables and forms
- One table row per line. Separate cells with a single TAB (`\t`). Empty cells stay empty (consecutive tabs).
- Forms: transcribe each printed label followed by its filled value on the same line, e.g. `ឈ្មោះ៖ សុខ ចាន់`. Leave blank fields blank, after the label.

### 3.4 Non-text elements
| Element | Rule |
|---|---|
| Photo, drawing, chart without text | `[figure]` on its own line in position. |
| Text inside a figure, stamp or seal | Transcribe it if legible, in position. If not legible, `[illegible]`. |
| Handwritten signature | `[signature]`. |
| Handwritten additions on printed pages | Transcribe in position. Mention `handwritten annotation` in `notes`. |
| Struck-through text | Transcribe it if readable and add a note. Do not mark it inline. |
| Logos | The logo's text if legible, otherwise `[figure]`. |
| Decorative ornaments, page borders | Ignore. |

### 3.5 Characters and digits
- Type digits exactly as printed. Khmer digits ០១២៣៤៥៦៧៨៩ (U+17E0–U+17E9) stay Khmer, and Western digits stay Western. Never convert between them in transcription.
- Currency: ៛ (U+17DB KHMER CURRENCY SYMBOL RIEL), `$`, and `រៀល` as printed.
- Punctuation as printed: Khmer full stop ។ (U+17D4 KHAN), end-of-text ៕ (U+17D5 BARIYOOSAN), Khmer colon ៖ (U+17D6 CAMNUC PII KUUH), repetition mark ៗ (U+17D7 LEK TOO). Latin punctuation is typed as on the page.
- Quotes and dashes: type what your keyboard produces for the visible mark (`"` or `«»` as printed). Do not "beautify" them.
- Ligatures in Latin text (`ﬁ`, `ﬂ`) are typed as separate letters (`fi`, `fl`).

## 4. Khmer Unicode handling

### 4.1 Storage rule
Transcription and corrected text are stored **verbatim**, exactly the code points you type. The system does not NFC-normalise them, reorder characters or remove zero-width characters. A normalised copy is made only at export (§13). This means the encoding is your responsibility. The editor shows warnings (§4.7) but does not silently change your text.

### 4.2 Canonical typing order inside a syllable cluster

```
Base consonant (or independent vowel)
  → subscript consonant(s): COENG U+17D2 + consonant   (max 2; COENG + RO U+179A typed LAST)
  → register shifter: ៉ U+17C9 MUUSIKATOAN or ៊ U+17CA TRIISAP (if any)
  → dependent vowel: ONE code point (U+17B6–U+17C5)
  → signs: ំ U+17C6 NIKAHIT, ះ U+17C7 REAHMUK, ៈ U+17C8 YUUKALEAPINTU, and other diacritics (U+17C9–U+17D1, U+17DD)
```

The standard Khmer NiDA keyboard (Windows, macOS, Linux, Android, iOS) produces this order if you type in the order you *read* the cluster: consonant, then subscript, then vowel, then sign. Never type a vowel first because it appears to the left (for example េ, ែ, ៃ), and never type a sign before the vowel.

### 4.3 Worked encodings (correct)

| Word | Meaning | Code points | Character names |
|---|---|---|---|
| ក្រសួង | ministry | U+1780 U+17D2 U+179A U+179F U+17BD U+1784 | KA · COENG · RO · SA · VOWEL UA · NGO |
| ស្ត្រី | woman | U+179F U+17D2 U+178F U+17D2 U+179A U+17B8 | SA · COENG · TA · COENG · RO · VOWEL II |
| ព្រះ | royal / sacred prefix | U+1796 U+17D2 U+179A U+17C7 | PO · COENG · RO · REAHMUK |
| ឆ្នាំ | year | U+1786 U+17D2 U+1793 U+17B6 U+17C6 | CHA · COENG · NO · VOWEL AA · NIKAHIT |
| ម៉ោង | hour | U+1798 U+17C9 U+17C4 U+1784 | MO · MUUSIKATOAN · VOWEL OO · NGO |
| កម្ពុជា | Cambodia | U+1780 U+1798 U+17D2 U+1796 U+17BB U+1787 U+17B6 | KA · MO · COENG · PO · VOWEL U · CO · VOWEL AA |
| សៀវភៅ | book | U+179F U+17C0 U+179C U+1797 U+17C5 | SA · VOWEL IE · VO · PHO · VOWEL AU |
| ជុំ | round / around | U+1787 U+17BB U+17C6 | CO · VOWEL U · NIKAHIT |

### 4.4 Common errors (all are counted as character errors in review)

| # | Error | Wrong (code points) | Right | How to spot it |
|---|---|---|---|---|
| E1 | Split vowel typed as two parts | ក + េ + ា (U+1780 U+17C1 U+17B6) | កោ (U+1780 U+17C4) | Looks identical in many fonts. The editor flags `U+17C1 U+17B6`. The same applies to េ + ី (U+17C1 U+17B8), which must be ើ (U+17BE). |
| E2 | Sign before vowel | ឆ្នំា (… U+17C6 U+17B6) | ឆ្នាំ (… U+17B6 U+17C6) | Dotted circle ◌ or a misplaced nikahit in Noto Sans Khmer. |
| E3 | COENG RO not last | ស្រ្តី (U+179F U+17D2 U+179A U+17D2 U+178F U+17B8) | ស្ត្រី (U+179F U+17D2 U+178F U+17D2 U+179A U+17B8) | Search and comparison fail. The editor flags RO-not-last. |
| E4 | Duplicated vowel or sign | កាា (U+1780 U+17B6 U+17B6) | កា | Dotted circle on the second vowel. |
| E5 | ា confused with ៈ, or ះ confused with ៈ | តាៈ vs តា, ពះ vs ពៈ | Type what is printed: ា (U+17B6) is a full-height stroke, ះ (U+17C7) is two stacked circles, ៈ (U+17C8) is two small vertically stacked marks | Zoom to 200 % and compare the glyph shapes. |
| E6 | ASCII colon instead of Khmer colon | `ដូចខាងក្រោម:` | `ដូចខាងក្រោម៖` (U+17D6) | Only use `:` where the page uses a Latin colon (e.g. times `10:30`). |
| E7 | Subscript ត vs ដ | ្ដ (U+17D2 U+178A) where ្ត (U+17D2 U+178F) is standard, or the reverse | Follow the spelling in the Chuon Nath dictionary. If it cannot be decided, keep the form most common in the document and note it. | The two subscripts are drawn the same, so this is a spelling decision, not a visual one. |
| E8 | Deprecated or discouraged characters | U+17A3, U+17A4, U+17A8, U+17B4, U+17B5, U+17D3 | U+17A3 → អ (U+17A2); U+17A4 → អា (U+17A2 U+17B6); U+17A8 → ឧក (U+17A7 U+1780); U+17B4/U+17B5 → delete; U+17D3 → ំ U+17C6 where it means nikahit | Flagged by the editor. |
| E9 | Splitting a cluster | `[?:ក្]រសួង` or a line break between COENG and its consonant | Markers and line breaks only at cluster boundaries | The editor rejects markers inside a cluster. |
| E10 | Latin look-alikes or legacy-font text | `ÉkSar` (Limon-encoded text pasted from a document) | Real Khmer Unicode | §4.6. |

### 4.5 Zero-width characters
- **ZWSP U+200B** (zero width space) is used **only if** the project instructions enable `word_segmentation`. In that case insert exactly one ZWSP between Khmer words according to the project's segmentation guide (for example, the Chuon Nath headword list), never inside a cluster, and never next to a real space.
- If word segmentation is **not** enabled, do not type ZWSP. If the pre-filled text in a correction task contains ZWSP, leave it unless the project says to remove it.
- **ZWNJ U+200C, ZWJ U+200D, BOM/ZWNBSP U+FEFF, soft hyphen U+00AD**: never type them. Remove them from corrected text. The editor flags them.

### 4.6 Legacy (non-Unicode) Khmer fonts
- Older documents and Word files often use **Limon**, **ABC** or similar fonts, which draw Khmer shapes from Latin code points. Such text is **not** Khmer Unicode.
- Never type with a legacy font or keyboard. Use a Unicode Khmer keyboard (NiDA standard layout).
- If a correction task's pre-filled text is legacy-encoded (it reads as Latin gibberish in the editor's Noto Sans Khmer view), do not convert it by hand. Set `notes` to `legacy_encoding: <font name if known>` and use **Report problem**. The admin will convert it or cancel the task.

### 4.7 How to verify your Khmer
1. The editor renders text in **Noto Sans Khmer** (self-hosted). A dotted circle ◌ means a combining mark has no valid base. Fix it.
2. Press **F2** to open the code-point inspector for the selection. It lists each code point, its name, and cluster boundaries, so you can compare with §4.3.
3. Read the editor's **validation panel**. Warnings: split vowels (E1), sign-before-vowel (E2), RO-not-last (E3), duplicated vowels or signs (E4), ASCII `:` directly after Khmer (E6), deprecated characters (E8), markers inside clusters (E9), zero-width characters (§4.5), long runs of Latin letters inside a page whose language is Khmer only (E10). Each warning has an explicit **Apply fix** button. The editor never fixes anything without that click.
4. Zoom the page image to 200–400 % for small diacritics (ៈ, ះ, ់ U+17CB BANTOC, ៍ U+17CD TOANDAKHIAT).

## 5. English text
- Transcribe spelling, capitalisation and punctuation exactly as printed (diplomatic), including errors. Do not add `[sic]`.
- Old typewriter spacing (two spaces after a full stop) becomes one space.
- Superscripts and subscripts (footnote marks, chemical formulas) are typed as plain characters inline, e.g. `H2O`, `text1`. Mention them in `notes` if the project needs them.
- Mixed Khmer–English lines are typed as printed, with no extra spaces added at script changes.

## 6. Text correction (`text_correction`)
- You receive machine text (OCR) and the page image. `corrected_text` must equal what a perfect transcription (§3–§5) of the page would be.
- Fix: wrong characters, wrong encoding order (§4.4), missing or extra lines, wrong reading order, OCR-invented characters, missing markers.
- Do not fix the author's genuine spelling mistakes, old spelling or grammar unless the project instructions say `mode: normalised`. In that mode, follow the project's normalisation list.
- If the machine text belongs to another page or is unusable (more than 50 % wrong), clear it, transcribe from scratch, and note `retyped_from_scratch` in `notes`.

## 7. Ambiguous and unreadable content

### 7.1 Uncertain reading `[?]`
- **Short form** `[?]`: placed directly after a space-delimited word you are unsure of: `Phnom Penh[?]`, `ក្រសួងសុខាភិបាល[?]` (when followed by a space or line end on the page).
- **Span form** `[?:text]`: wraps the uncertain characters when there is no space to delimit them (typical for Khmer): `ក្រសួង[?:សុខាភិបាល]`. The span must start and end on cluster boundaries.
- Use these markers only for **one best guess**. If two readings are equally likely, put the more common one in the transcription and the alternative in `notes` (`page 3 line 7: alt reading សុខុមាលភាព`).

### 7.2 Unreadable `[illegible]`
- Replace each contiguous unreadable stretch, up to one line, with a single `[illegible]`. If several consecutive lines are unreadable, use one `[illegible]` per line.
- A whole page that cannot be read gets `transcription: "[illegible]"`, `page_label: "illegible"`, and a note giving the reason (blur, damage, cut off).
- Partly visible text cut off at the edge: transcribe the visible part, then `[illegible]`.

### 7.3 Redaction of personal data `[REDACTED:<type>]`
Apply this only when the project instructions enable `redact_personal_data` (for example, for datasets with `contains_personal_data = yes`; see DATA_PRIVACY_OWNERSHIP.md §6).
- Replace the personal datum (not its label) with `[REDACTED:<type>]`. `<type>` is one of `name`, `id_number`, `phone`, `email`, `address`, `date_of_birth`, `account_number`, `signature`, `other`.
  Example: `លេខអត្តសញ្ញាណប័ណ្ណ៖ [REDACTED:id_number]`.
- The page image is **not** altered in v1. Redaction applies only to text outputs.
- If redaction is **not** enabled and you find unexpected sensitive content (national ID cards, passports, medical records, bank statements, documents about children, or anything marked confidential or secret), **stop**. Click **Report problem** and choose "sensitive content". Do not transcribe further. The admin decides (DATA_PRIVACY_OWNERSHIP.md §7).

### 7.4 Marker grammar (machine-parsable)

| Marker | Regex |
|---|---|
| Uncertain, short | `\[\?\]` |
| Uncertain, span | `\[\?:([^\[\]]+)\]` |
| Illegible | `\[illegible\]` |
| Signature | `\[signature\]` |
| Figure | `\[figure\]` |
| Redacted | `\[REDACTED:(name|id_number|phone|email|address|date_of_birth|account_number|signature|other)\]` |

Markers are ASCII, case-sensitive, and contain no spaces. If the page itself contains square brackets, type them normally. The validator only treats the exact patterns above as markers. If page text happens to match a marker pattern exactly, say so in `notes`.

## 8. Metadata labeling (`metadata`)
- Fill every **required** field in the project's `metadata_schema` (types `text`, `number`, `date`, `select`). Optional fields are left empty when unknown. Never guess.
- `date`: ISO 8601 `YYYY-MM-DD`, or `YYYY-MM` / `YYYY` if only that is printed. Dates given only in the Buddhist Era (ព.ស.) or the lunar calendar are not converted. Copy them verbatim into `notes` (`date_be: ព.ស. ២៥៦៨`) and leave the date field empty unless the project gives a conversion rule.
- `number`: Western digits and a `.` decimal separator, without thousands separators (for example ១២.០០០ រៀល → `12000`). The **transcription** keeps the Khmer digits.
- `text`: NFC, trimmed, as printed (Khmer names in Khmer script; no romanisation unless the field asks for it).
- `select`: exactly one listed option. If none fits, choose `other` when available, otherwise leave it empty and note why.

## 9. Document classification and page labels

### 9.1 Classification (`classification`)
- Labels come from the project's `label_set`. Default label set, used when the project does not define one (format `<dataset category>.<subtype>`):

| Label | Use for |
|---|---|
| `books.textbook`, `books.literature`, `books.reference` | Book content |
| `newspapers.article`, `newspapers.advertisement` | Periodicals |
| `government_documents.law_regulation`, `government_documents.official_letter`, `government_documents.report`, `government_documents.gazette` | Official texts |
| `legal_documents.contract`, `legal_documents.judgement` | Legal |
| `academic.paper`, `academic.thesis` | Academic |
| `educational.exam`, `educational.worksheet` | Education |
| `religious_cultural.religious_text`, `religious_cultural.manuscript` | Religious and cultural |
| `forms_receipts.receipt`, `forms_receipts.invoice`, `forms_receipts.form` | Forms |
| `business_documents.letter`, `business_documents.brochure`, `business_documents.menu` | Business |
| `handwriting.letter`, `handwriting.notes` | Handwriting |
| `signage_photos.shop_sign`, `signage_photos.street_sign`, `signage_photos.product_label` | Scene text |
| `other.other` | None of the above (explain in `notes`) |

- One label unless the project allows several (`multi_label: true`). Choose by the document's **purpose**, not its look. A typed letter from a ministry is `government_documents.official_letter`.

### 9.2 Page labels (`page_label`)
Exactly one per page from: `cover`, `title_page`, `table_of_contents`, `body_text`, `table`, `form`, `receipt`, `image_only`, `mixed`, `index`, `blank`, `illegible`, `back_cover`, `other`. Use `blank` for pages with no content (transcription `""`). Use `mixed` when no single kind covers more than 70 % of the page area.

## 10. Bounding boxes (design for a future release; not enabled in v1)
- The `regions` array per page is reserved. In v1 the validator requires `regions: []`.
- Planned region object:

```json
{"id": "r-0001", "shape": "bbox", "x": 0.112, "y": 0.084, "w": 0.640, "h": 0.031,
 "rotation_deg": 0, "label": "text_line", "text": "ព្រះរាជាណាចក្រកម្ពុជា", "reading_order": 1}
```

- Coordinates are normalised to [0, 1] relative to the rendered page image in its **original orientation**, origin top-left, at 6 decimal places. The UI rotation is a view transform and never changes the stored coordinates. `shape: "polygon"` with `points: [[x, y], …]` is reserved.
- Planned labels: `text_line`, `word`, `paragraph`, `title`, `table`, `table_cell`, `figure`, `stamp`, `signature`, `handwriting`.
- Boxes will be drawn tight around ink with ≤ 2 px padding at 100 % zoom, and each box will cover one complete line or word, never part of a Khmer cluster.

## 11. Annotation examples (baseline §11 `data` shape)

**Example A: transcription + page_label (government letter, page unit).**
```json
{
  "pages": [
    {
      "page": 1,
      "transcription": "ព្រះរាជាណាចក្រកម្ពុជា\nជាតិ សាសនា ព្រះមហាក្សត្រ\n\nក្រសួងអប់រំ យុវជន និងកីឡា\nលេខ៖ ១២៣ អយក\n\n[figure]\nសេចក្តីជូនដំណឹង\n[signature]",
      "page_label": "body_text",
      "regions": []
    }
  ],
  "notes": "Round ministry seal at bottom right; text inside seal illegible, covered by [figure]."
}
```

**Example B: text_correction (OCR fixes: missing ា at the end of line 1; ASCII colon replaced by ៖, rule E6).**
Machine text: `ក្រសួងអប់រំ យុវជន និងកីឡ\nកាលបរិច្ឆេទ: ១៤ មេសា`.
```json
{
  "pages": [
    {
      "page": 1,
      "corrected_text": "ក្រសួងអប់រំ យុវជន និងកីឡា\nកាលបរិច្ឆេទ៖ ១៤ មេសា",
      "regions": []
    }
  ],
  "notes": ""
}
```

**Example C: classification + metadata + transcription with markers (receipt photo).**
```json
{
  "pages": [
    {
      "page": 1,
      "transcription": "ហាងកាហ្វេ [?:សុខសាន្ត]\nបង្កាន់ដៃ\nកាហ្វេទឹកដោះគោ\t២\t១០.០០០៛\nសរុប\t\t១០.០០០៛\nទូរស័ព្ទ៖ [REDACTED:phone]\n[illegible]",
      "page_label": "receipt",
      "regions": []
    }
  ],
  "classification": ["forms_receipts.receipt"],
  "metadata": {"merchant_name": "ហាងកាហ្វេ សុខសាន្ត", "total_amount": 10000, "currency": "KHR", "date": "2026-03-14"},
  "notes": "Bottom line torn off. Merchant name partly faded."
}
```

**Example D: illegible page in a multi-page task.**
```json
{
  "pages": [
    {"page": 1, "transcription": "សៀវភៅ ភាសាខ្មែរ\nថ្នាក់ទី ៣", "page_label": "cover", "regions": []},
    {"page": 2, "transcription": "[illegible]", "page_label": "illegible", "regions": []},
    {"page": 3, "transcription": "", "page_label": "blank", "regions": []}
  ],
  "classification": ["educational.worksheet"],
  "notes": "Page 2: severe water damage, no characters recoverable."
}
```

## 12. Annotation review

### 12.1 Who reviews
- `annotation.review` holders (reviewer, admin, super_admin) claim from `GET /annotation/review-queue`. A reviewer never reviews their own annotation (baseline §6) or a task they annotated in any earlier version.

### 12.2 Procedure
1. Claim the task (`POST /annotation/tasks/{id}/claim-review`). Task status: `submitted` → `in_review`.
2. Open the split view: page image on one side, text on the other. Use **Compare versions** to see changes since the last reviewed version.
3. Check every page for tasks of 5 pages or fewer. For longer tasks, check at least 5 pages or 20 % of pages, whichever is more. Always include the first page, the last page, and every page with a marker or a validation warning.
4. Measure CER on the checked pages: correct the text in **review mode**, which saves the reviewer's reference copy without overwriting the annotator's version. The editor computes `CER = Levenshtein(submitted, reference) / len(reference)` over NFC code points, markers included as literal text.
5. Check classification, metadata and page labels against the page.
6. Give a **score** from 1 to 5 (table below), then **approve** or **request changes**. Comments are mandatory for request changes and must quote the page and line and give the rule number from this document (for example "p.2 l.4: E3 COENG RO order").
7. On approval, the task becomes `approved`, and an `annotation_reviews` row plus an `annotation_rewards` row are written, with an `annotation_reward` journal (exactly once; PRICING_PAYOUT_POLICY.md §7.4). Request changes sets the task to `changes_requested`, and it returns to the same annotator (or is reassigned by an admin).

### 12.3 Quality criteria and thresholds

| Score | Transcription / correction CER | Other conditions | Decision |
|---|---|---|---|
| 5 | ≤ 0.5 % | Labels and metadata 100 % correct; no unresolved validation warnings | Approve |
| 4 | ≤ 1.0 % | Same | Approve |
| 3 | ≤ 2.0 % | Same | Approve (comment on the errors) |
| 2 | > 2.0 % and ≤ 5.0 % | or any wrong label or required metadata field | Request changes |
| 1 | > 5.0 % | or any zero-tolerance error | Request changes; the admin is notified when an annotator gets 3 scores of 1 within 30 days |

**Zero-tolerance errors** (score 1 whatever the CER): invented text (content not on the page); transcription of the wrong page or file; legacy-font or Latin look-alike encoding; external machine output pasted in breach of §1.7; sensitive content transcribed when §7.3 required stopping; unredacted personal data when redaction was enabled.

Approval therefore requires **CER ≤ 2 %**, correct labels and metadata, and no zero-tolerance error.

### 12.4 QA sampling
10 % of approved tasks per project (minimum 1 per annotator per week) get a blind second review by a different reviewer. Procedure and consequences: DATA_QUALITY_REVIEW.md §11.

## 13. Export normalisation
At export, the `normalized` copy of each text field is: Unicode NFC, CRLF/CR converted to LF, U+FEFF removed, trailing spaces trimmed per line. Markers, ZWSP and Khmer digits are kept. The verbatim text is always exported alongside it (DATASET_DOCUMENTATION.md §9.5).

## 14. Annotator instructions

### 14.1 Before you start
- You need the `annotator` role and an **approved** contributor verification (A-08). Install a Unicode Khmer keyboard (NiDA layout) and use a current Chrome, Edge, Firefox or Safari. Fonts are provided by the editor.
- Read the project instructions and this document. Questions go to the project conversation (Messages → project thread).

### 14.2 Workflow
1. **My tasks** lists the tasks assigned to you, with deadline and reward.
2. **Start** opens the editor and sets the status to `in_progress`.
3. Work page by page. Autosave runs after 5 s of no typing and when a field loses focus. The save indicator shows `Saving…`, `Saved hh:mm`, or `Offline — retrying`. A version is kept whenever the content changes, and you can restore any of your last 50 drafts from **History**.
4. If another session edited the task (409 conflict), the editor shows both versions side by side. Choose which to keep. Nothing is overwritten silently.
5. Clear every validation **error** (missing required field, invalid marker, non-empty `regions`) and review the **warnings**.
6. **Submit** (`Ctrl+Enter`, with confirmation). The task is locked until review.
7. If changes are requested, read the reviewer comments (right panel), fix the issues, and resubmit. The reward is paid once, when the task is approved.
8. Use **Report problem** for a wrong file, a legacy encoding, sensitive content, or an unreadable source. The task is paused and the admin is notified.

### 14.3 Keyboard shortcuts
On macOS use `Cmd` instead of `Ctrl`. Shortcuts work while focus is inside the editor. Browser-reserved combinations are deliberately not used, and AltGr and Alt+Shift (common for switching keyboard layouts) are never used.

| Action | Shortcut |
|---|---|
| Save now | `Ctrl+S` |
| Submit task (confirm dialog) | `Ctrl+Enter` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` (also `Ctrl+Y`) |
| Previous / next page | `Alt+PageUp` / `Alt+PageDown` |
| Zoom in / out / fit width | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` |
| Rotate preview 90° clockwise (view only) | `Ctrl+]` (counter-clockwise `Ctrl+[`) |
| Insert `[illegible]` | `Ctrl+Shift+L` |
| Mark selection uncertain `[?:…]` (or insert `[?]` with no selection) | `Ctrl+Shift+U` |
| Redact selection `[REDACTED:…]` (type picker) | `Ctrl+Shift+X` (only when redaction is enabled) |
| Insert `[figure]` / `[signature]` | `Ctrl+Shift+F` / `Ctrl+Shift+G` |
| Code-point inspector | `F2` |
| Focus text panel / focus preview panel | `Ctrl+Shift+1` / `Ctrl+Shift+2` |
| Show shortcut help | `F1` (also `?` when focus is not in a text field) |

### 14.4 Do and don't
- **Do** zoom in before deciding between look-alike characters, keep notes short and factual, and ask early.
- **Don't** download or copy source material, use legacy fonts, add spaces between Khmer words, translate, or "improve" the author's text.
