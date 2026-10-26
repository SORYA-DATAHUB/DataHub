# Wireframes 01 — Public pages

| Field | Value |
|---|---|
| Document | #16 Wireframes — part 01 (public) |
| Version | v1.0 · 2026-10-26 · Baseline |
| Pages | #1–#8 |

**Purpose.** Structure of the marketing and legal pages that explain DataHub to prospective contributors. **Scope.** Routes `/`, `/how-it-works`, `/pricing`, `/data-types`, `/help`, `/legal/*`. **Assumptions.** Rates and formats are fetched from `GET /public/pricing` and `GET /public/formats` (server-rendered, revalidated every 5 min) so public numbers always match the system. **Decisions.** No testimonials or invented statistics; content is factual (rates, rules, process). Legal pages share one template. **Dependencies.** UI_UX_DESIGN §3–§5; DESIGN_SYSTEM §2 (brand), §4 (type scale incl. `text-display`). **Acceptance criteria.** Each page renders without JavaScript (server components), passes axe, and shows rates/limits from the API, not hard-coded.

---

## Shared marketing header & footer

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ▤ DataHub        How it works   Pricing   Data types   Help            [Log in] [Get started]│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
   … page …
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ▤ DataHub                  Product            Legal                    Contact               │
│ Data collection for        How it works       Terms of Service         Help & FAQ            │
│ Khmer-first AI.            Pricing            Privacy Policy           support form          │
│                            Data types         Contributor Agreement                          │
│ DataHub is operated by SKAI Technology, Phnom Penh, Cambodia.          Theme [Light|Dark|Sys]│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
Mobile: logo + [Log in] + ☰ (sheet with links and [Get started]).
Signed-in visitor: [Log in][Get started] replaced by [Open DataHub →].
```

## #1 Home — `/`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                                       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  Get paid for the documents                     ┌─────────────────────────────────────────┐  │
│  that teach AI to read Khmer.                   │ ░ scanned-page texture with ledger lines│  │
│                                                 │ ░  ┌─────────────────────────────┐      │  │
│  Upload documents and datasets you own.         │ ░  │ Dataset DS-3F9A1C  [● Approved]│   │  │
│  We review every file and pay for what we       │ ░  │ Accepted 2.400 GB × $1.50     │      │  │
│  accept — $1.00 per GB raw, $1.50 per GB        │ ░  │ Earned            $3.60       │      │  │
│  labeled.                                       │ ░  └─────────────────────────────┘      │  │
│                                                 └─────────────────────────────────────────┘  │
│  [Get started]  [How it works →]                (illustrative product card, static)          │
│                                                                                              │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  HOW YOU GET PAID (4 steps, horizontal on desktop, vertical on mobile)                       │
│  ① Register & verify email  ② Accept agreement  ③ Upload & we review  ④ Withdraw to bank/ABA │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  RATES (from GET /public/pricing)                                                            │
│  ┌────────────────────────────┐  ┌────────────────────────────┐                              │
│  │ Raw data                   │  │ Clean / labeled data       │   Paid only for accepted,    │
│  │ $1.00 / accepted GB        │  │ $1.50 / accepted GB        │   unique, eligible files.    │
│  │ scans, photos, documents   │  │ transcribed, tagged, clean │   1 GB = 1,000,000,000 bytes │
│  └────────────────────────────┘  └────────────────────────────┘   [See pricing details →]    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  WHAT WE ACCEPT (from GET /public/formats, grouped)                                          │
│  Documents PDF DOCX DOC ODT RTF TXT · Images JPG PNG TIFF BMP · Data CSV JSON JSONL XML XLSX  │
│  · Archives ZIP (contents reviewed individually)                [All data types →]           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  ALSO: PAID ANNOTATION WORK                                                                  │
│  Verified contributors can be invited to transcribe and label documents in our web editor,  │
│  paid per task or per page.                                      [How annotation works →]   │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  TRUST: Files stay private · Malware-scanned · You keep ownership (licence, not assignment)  │
│  · Manual payouts recorded with a reference you can see                                      │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  CTA band: Ready to contribute?                                       [Create your account] │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ FOOTER                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #2 How It Works — `/how-it-works`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                                       │
│ How DataHub works                                                                            │
│ From upload to payment, every step is visible in your dashboard.                             │
│                                                                                              │
│ ┌ 1 Create your account ──────────────────────────────────────────────────────────────────┐ │
│ │ Register, verify your email, complete your profile and accept the Contributor Agreement.│ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ 2 Upload ───────────────────────────────────────────────────────────────────────────────┐ │
│ │ Add a title, language and category; drop files, folders or ZIPs. Large uploads resume   │ │
│ │ automatically if your connection drops.                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ 3 Automatic checks ─────────────────────────────────────────────────────────────────────┐ │
│ │ File type detection, malware scan, duplicate detection, previews. Status per file.      │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ 4 Human review ─────────────────────────────────────────────────────────────────────────┐ │
│ │ A reviewer accepts or rejects each file, with reasons. Possible outcomes: approved,     │ │
│ │ partially approved, rejected, changes requested.                                        │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ 5 Earnings & withdrawal ────────────────────────────────────────────────────────────────┐ │
│ │ Accepted GB × rate is credited to your balance. Verify your identity, then request a    │ │
│ │ withdrawal ($10.00–$5,000.00). We transfer manually and record the payment reference.   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                              │
│ Status glossary (table: Draft, Submitted, In review, Approved, Partially approved, Rejected, │
│ Changes requested — what it means / what you can do)                                         │
│                                                                                              │
│ Annotation work (section) · FAQ accordion (8 items)            [Get started]                 │
│ FOOTER                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #3 Pricing — `/pricing`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                                       │
│ Pricing                                                     Effective since 2026-11-01 (API) │
│ ┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐            │
│ │ RAW                                  │ │ CLEAN / LABELED                      │            │
│ │ $1.00 per accepted GB                │ │ $1.50 per accepted GB                │            │
│ │ Unprocessed scans, photos, documents │ │ Transcribed, corrected or labeled    │            │
│ └──────────────────────────────────────┘ └──────────────────────────────────────┘            │
│                                                                                              │
│ Worked examples                                                                              │
│ ┌────────────────────────────────────────────────────────────────────────────────────────┐   │
│ │ Uploaded           Accepted             Class     Calculation           You earn       │   │
│ │ 3.000 GB           2.400 GB             Raw       2.400 × $1.00         $2.40          │   │
│ │ 1.250 GB           1.250 GB             Labeled   1.250 × $1.50         $1.87          │   │
│ │ 0.800 GB (dupes)   0.000 GB             Raw       duplicates unpaid     $0.00          │   │
│ └────────────────────────────────────────────────────────────────────────────────────────┘   │
│ Amounts are rounded down to the cent. 1 GB = 1,000,000,000 bytes.                            │
│                                                                                              │
│ What counts / what doesn't (two columns ✓ / ✗): accepted, unique, clean, previously unpaid   │
│ ✗ rejected files, duplicates, malware, ZIP container bytes (contents counted individually)  │
│                                                                                              │
│ Withdrawals: min $10.00 · max $5,000.00 per request · one open request at a time ·           │
│ methods: Bank transfer (Cambodia), ABA Pay, Wise, PayPal, Other · identity verification     │
│ required.                                                                                    │
│ FOOTER                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #4 Supported Data Types — `/data-types`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                                       │
│ Supported data types                                    ⌕ {Filter formats...}                │
│ ┌────────────┬───────────────────┬──────────┬───────────────────────┬────────────┬─────────┐ │
│ │ Format     │ Typical use       │ Allowed  │ Preview               │ Annotatable│ Payable │ │
│ ├────────────┼───────────────────┼──────────┼───────────────────────┼────────────┼─────────┤ │
│ │ PDF        │ Scans, books      │ ✓ Yes    │ Page images (≤500 pp) │ ✓ Pages    │ ✓ Yes   │ │
│ │ DOCX       │ Typed documents   │ ✓ Yes    │ Extracted text        │ ✓ Text     │ ✓ Yes   │ │
│ │ DOC        │ Legacy Word       │ ✓ Yes    │ Download only         │ ✗ No       │ ✓ Yes   │ │
│ │ …          │                   │          │                       │            │         │ │
│ │ ZIP        │ Bulk upload       │ ✓ Yes    │ Member list           │ ✗ No       │ Contents│ │
│ └────────────┴───────────────────┴──────────┴───────────────────────┴────────────┴─────────┘ │
│ (Mobile: each format becomes a card with the same five facts.)                               │
│                                                                                              │
│ Limits: 4 GB per file · 50 GB per dataset · 2,000 files per dataset · ZIP ≤ 10,000 members, │
│ nested ZIPs not expanded · Executables, scripts, HTML/SVG, macro-enabled Office rejected.    │
│ Files are identified by content, not by extension.                                           │
│ FOOTER                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #5 Contact / Help — `/help`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                                       │
│ Help & contact                                                                               │
│ ┌───────────────────────────────────────────────┐ ┌────────────────────────────────────────┐ │
│ │ Frequently asked questions   ⌕ {Search FAQ}   │ │ Contact us                             │ │
│ │ ▸ When do I get paid?                         │ │ Name      {.........................}  │ │
│ │ ▸ Why was my file rejected?                   │ │ Email     {.........................}  │ │
│ │ ▸ What does "partially approved" mean?        │ │ Topic     [Account ▾]                  │ │
│ │ ▸ Can I upload documents in Khmer and English?│ │ Message   {.........................}  │ │
│ │ ▸ My upload stopped — do I start again?       │ │           {.........................}  │ │
│ │ ▸ How is my identity verified?                │ │ [Send message]                         │ │
│ │ ▸ Who owns the data after I'm paid?           │ │ Signed in? Use Messages for faster     │ │
│ │ ▸ How do I delete my account?                 │ │ support → /messages                    │ │
│ └───────────────────────────────────────────────┘ └────────────────────────────────────────┘ │
│ Success state: form replaced by "Thanks — we'll reply to name@example.com within 2 business │
│ days." Rate-limit state: "Too many messages. Try again in 10 minutes."                       │
│ FOOTER                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## #6 Terms, #7 Privacy, #8 Contributor Agreement — `/legal/terms`, `/legal/privacy`, `/legal/contributor-agreement`

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                                       │
│ Legal  ›  Contributor Agreement                                                              │
│ ┌──────────────────────┐ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ON THIS PAGE         │ │ Contributor Agreement                                         │   │
│ │ 1 Definitions        │ │ Version 1.0 · Effective 2026-11-01 · [Download PDF]           │   │
│ │ 2 Licence grant      │ │ ┌───────────────────────────────────────────────────────────┐ │   │
│ │ 3 Your promises      │ │ │ ⓘ Draft pending legal review (HA-01). Shown only in      │ │   │
│ │ 4 Review & payment   │ │ │   non-production environments.                            │ │   │
│ │ 5 Takedown           │ │ └───────────────────────────────────────────────────────────┘ │   │
│ │ 6 Termination        │ │ 1 Definitions                                                 │   │
│ │ (sticky on desktop;  │ │ Body text 16/26, max 72ch …                                   │   │
│ │  collapsible on      │ │                                                               │   │
│ │  mobile)             │ │ Signed in: "You accepted version 1.0 on 26 Oct 2026."         │   │
│ └──────────────────────┘ └───────────────────────────────────────────────────────────────┘   │
│ Other legal documents: Terms · Privacy · Contributor Agreement                               │
│ FOOTER                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
Differences: #6 and #7 omit the "You accepted" line; #7 adds a "Your data rights" summary card at the top (access, correction, deletion request → `/settings?tab=privacy`).
