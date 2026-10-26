# DataHub — Contributor Guide

| Field | Value |
|---|---|
| **Purpose** | Help contributors use DataHub from sign-up to getting paid: create an account, upload datasets, understand reviews and earnings, and withdraw money. |
| **Audience** | Contributors (every registered user). Many readers are in Cambodia and read English as a second language, so this guide uses short sentences. |
| **Scope** | Registration, onboarding, verification, datasets, uploads, processing, review results, earnings, wallet, withdrawals, messages, notifications, account security, data deletion. Annotation work is in [ANNOTATOR_GUIDE.md](ANNOTATOR_GUIDE.md). |
| **Last updated** | 2026-10-26 |
| **Status** | Baseline — screenshots to be added after implementation. |
| **Sources** | [ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md) (incl. §16 amendments), [UI_UX_DESIGN.md](../03-ui-ux-design/UI_UX_DESIGN.md) §3, [PRICING_PAYOUT_POLICY.md](../01-business-product/PRICING_PAYOUT_POLICY.md), [DATA_QUALITY_REVIEW.md](../05-data-annotation/DATA_QUALITY_REVIEW.md), [DATASET_DOCUMENTATION.md](../05-data-annotation/DATASET_DOCUMENTATION.md), [DATA_PRIVACY_OWNERSHIP.md](../05-data-annotation/DATA_PRIVACY_OWNERSHIP.md), [DATA_RETENTION_DELETION.md](../05-data-annotation/DATA_RETENTION_DELETION.md), [AUTH_AUTHORIZATION.md](../04-backend-api/AUTH_AUTHORIZATION.md). If this guide and those documents disagree, those documents win. |

---

## 1. DataHub in five steps

1. **Register** and verify your email.
2. **Finish onboarding**: accept the Contributor Agreement and confirm your rights.
3. **Upload a dataset**: add details, add files, and submit it for review.
4. **Get reviewed**: a reviewer accepts or rejects each file. You earn money for accepted files.
5. **Get paid**: get verified once, then request a withdrawal.

DataHub is run by SKAI Technology (Cambodia). SKAI buys a **licence** to use your accepted data for its AI work (Khmer-first OCR and language tools). **You keep ownership** of your files. Payment does not transfer your copyright to SKAI.

## 2. Create your account

### 2.1 Register (`/register`)

1. Open `/register`.
2. Enter your display name, email and a password.
3. Tick the boxes to accept the Terms of Service and the Privacy Policy.
4. Click **Create account**.

The page always says "Check your inbox", even if the email is already registered. This protects your privacy. Registering does **not** sign you in.

**Password rules**

- 12 to 128 characters. Spaces and Khmer letters are allowed.
- It must not contain your email name or your display name.
- It must not be a common or leaked password.
- A long sentence you can remember is a good password.

### 2.2 Verify your email (`/verify-email`)

1. Open the email from DataHub and click the link.
2. The page confirms "Email verified".

- The link works **once** and expires after **24 hours**.
- No email? Check your spam folder. Then sign in and click **Resend** on `/verify-email`. You can resend after 60 seconds, up to 3 times per hour.
- Until your email is verified, you can only use the verification page.

### 2.3 Sign in (`/login`)

- Sign in with your email and password.
- After **5 failed attempts within 15 minutes**, your account is locked for **15 minutes**. To get in sooner, use **Forgot password** (`/forgot-password`). A password reset also removes the lock.
- A reset link expires after **1 hour** and works once.

## 3. Onboarding (`/onboarding`)

You must finish onboarding before you can upload. You can click **Finish later** and look around first. The dashboard will remind you.

| Step | Route | What you do |
|---|---|---|
| 1 Profile | `/onboarding?step=profile` | Legal name (as on your ID), display name, optional Khmer name, country, phone, date of birth (you must be 18 or older), preferred content languages. |
| 2 Agreement | `/onboarding?step=agreement` | Read the Contributor Agreement. Scroll to the end (or open the full page). Tick the box to accept. |
| 3 Rights | `/onboarding?step=rights` | Tick each statement: you own your data or have permission, you do not share other people's personal data without consent, you will not upload malware or illegal content, and you are paid only after review and acceptance. |
| 4 Verification | `/onboarding?step=verification` | Optional now. Needed later to withdraw money (see §4). You can click **Skip for now**. |

When you finish step 3, you see "You can now upload datasets."

**What the agreement means (plain language)**

- You keep ownership. For each file that is **accepted and paid**, you give SKAI a perpetual, worldwide, non-exclusive licence to use it for AI work.
- You may still use, publish or license the same files to others.
- SKAI pays only for accepted, unique, eligible files.
- Do not upload data you have no rights to. Do not upload other people's personal data without a lawful right (for example, their consent).

> The legal texts are drafts pending legal review. While they are drafts, the legal pages show a "draft" banner.

## 4. Get verified (needed to withdraw)

Verification is a check of your identity. **You do not need it to upload.** You need it to:

- withdraw money, and
- receive annotation work (if you also become an annotator).

**How to submit**

1. Go to `/profile?tab=verification` (or step 4 of onboarding).
2. Check your profile details: legal name, country, date of birth, phone.
3. Add a payout method: ABA Pay, bank transfer (Cambodian banks), Wise, PayPal or Other. Enter the account name and number.
4. Optional: upload a photo or PDF of your national ID or passport. This makes the review faster.
5. Click **Submit for verification**.

Verification is usually reviewed within **2 business days**.

| Status | Meaning | What to do |
|---|---|---|
| `unverified` | You have not submitted yet. | Submit when you want to withdraw. |
| `pending` | We are checking your details. | Wait. You will get a notification. |
| `approved` | You are verified. | You can withdraw money. |
| `needs_info` | We need more information. | Read the message, update your details, submit again. |
| `rejected` | We could not verify you. | Read the reason. Contact support in Messages if you think it is wrong. |

**Payout methods** are managed at `/profile?tab=payout-methods`. You can save up to 5. We show only the last 4 characters of account numbers. When you add or change a method, we email you. If you changed it in the last 72 hours, an admin may message you to confirm before paying.

## 5. Create a dataset (`/datasets/new`)

A **dataset** is one submission. Put files together when they have the **same origin** and the **same data class**. Example: "Phnom Penh Post scans 1995–1999, raw".

### 5.1 Dataset details

| Field | Required | Tips |
|---|---|---|
| Title | Yes | 3–200 characters. Khmer is fine. |
| Description | Yes | 20–5,000 characters. Say what the content is, where it came from, the time period, and any known problems (missing pages, damage). |
| Languages | Yes | Choose at least one. Put the **main** language first (more than half of the text). |
| Category | Yes | Choose one (see §5.2). |
| Data class | Yes | `raw` or `labeled` (see §5.3). |
| Label format and label description | If labeled | Format: paired text, sidecar JSON, CSV mapping, JSONL, or other documented. Explain how labels match files. |
| Source type | Yes | Own creation, scanned physical original, photographed, born-digital own, public domain, government publication, licensed from rights holder, web collected, other. |
| Source description | Yes | 10–2,000 characters. Where did the material come from? For public domain, say why (for example "author died 1950"). |
| Collection dates | Yes | When you scanned, photographed or collected it. |
| Licence of the original work | Yes | Own work, rights holder permission, public domain, government open, CC0, CC BY 4.0, CC BY-SA 4.0, other open. "Unknown" cannot be submitted. |
| Contains personal data? | Yes | `no`, `yes` or `unsure`. If `yes`, choose the types (names, contact details, ID numbers, signatures, faces, financial, health, biometric, minors, other). Answer honestly. |
| Optional | No | Tags, source URL, publisher, author, publication dates, places, scan DPI, printed or handwritten, page layout, legacy font notes. Rich details help your quality score. |

### 5.2 Categories

| Code | Use for |
|---|---|
| `books` | Printed books, novels, textbooks |
| `newspapers` | Newspapers, magazines, bulletins |
| `government_documents` | Prakas, sub-decrees, gazettes, official letters, public reports |
| `legal_documents` | Laws, de-identified contracts, court judgements |
| `academic` | Theses, research papers, journals |
| `educational` | School textbooks, exam papers, worksheets |
| `religious_cultural` | Buddhist texts, palm-leaf manuscript scans, literature, songs |
| `forms_receipts` | Invoices, receipts, application forms, tickets |
| `business_documents` | Reports, letters, menus, brochures, catalogues |
| `handwriting` | Handwritten letters, notes, exercise books |
| `signage_photos` | Shop signs, street signs, banners, product labels |
| `web_text` | Articles, blogs, forum text collected with rights |
| `parallel_text` | Aligned Khmer–English (or other) sentence pairs |
| `structured_data` | CSV, JSON, XML, XLSX: dictionaries, word lists, tables |
| `other` | Anything else. Explain in the description. |

Choose the **main** category. Explain any other material in the description.

### 5.3 Raw or labeled?

- **Raw** ($1.00 per accepted GB): documents without labels. Scans, photos, digital files, text, spreadsheets.
- **Labeled** ($1.50 per accepted GB): documents **with accurate labels** that match each file. Examples: a correct transcription for each page image, corrected OCR text, classified documents.

Rules for labeled data:

- Labels must exist for at least 95 % of the files.
- Labels must be accurate. The reviewer checks at least 10 items.
- Khmer label text must be real Khmer Unicode, not a legacy font such as Limon or ABC.
- Do **not** mix raw and labeled files. Make two datasets.
- If labels are not good enough, the reviewer can change the dataset to raw or ask you to fix it.

Each dataset gets a code such as `DS-2026-000123`. Use this code when you contact support.

## 6. Upload files

After you click **Create dataset & start upload**, you go to `/datasets/[id]/upload`.

### 6.1 Add files

- **Drag and drop** files onto the upload area, or
- click **Choose files**, or
- click **Choose folder** to add a whole folder. Folder names are kept. (Some phones cannot choose folders.)
- ZIP files are allowed (see §6.3).

### 6.2 Limits

| Limit | Value |
|---|---|
| One file (also each file inside a ZIP) | **4 GB** (4,000,000,000 bytes) |
| One dataset | **50 GB** |
| Files per dataset | 2,000 (files inside ZIPs are not counted) |
| Your data waiting for review (all datasets) | 200 GB |

DataHub checks these limits before the upload starts and lists any problem files.

**Supported formats:** PDF, DOCX, DOC, ODT, RTF, TXT, JPG/JPEG, PNG, BMP, TIFF, CSV, JSON, JSONL, XML, XLSX, ZIP. See `/data-types` for details.

**Not accepted:** programs and scripts, HTML, SVG, macro-enabled Office files (DOCM, XLSM). Text files (TXT, CSV, JSON, XML) should be UTF-8.

### 6.3 ZIP rules

- A ZIP can hold up to **10,000 files**.
- All files together, unpacked, must be **20 GB or less**.
- Each file inside must be 4 GB or less.
- No extreme compression (more than 100 times smaller than the real size).
- **No ZIP inside a ZIP.** An inner ZIP is not opened and is marked failed. Unzip it and upload the inner files.
- No unsafe file paths (for example names with `..`).
- DataHub unpacks the ZIP. Each file inside is checked, reviewed and paid **on its own**. The ZIP file itself is never paid.

### 6.4 Watch the progress

- Each file shows progress, speed and time left.
- You can **pause**, **resume**, **cancel** or **retry** each file, or all files.
- You can move to other pages in DataHub. Uploads keep going. The upload tray (bottom-right) shows progress.
- Do not close the browser tab while uploading. DataHub warns you if you try.

### 6.5 If your internet stops

- DataHub pauses all uploads and shows "You're offline — uploads will resume automatically".
- When the internet comes back, uploads continue from where they stopped. Finished parts are not sent again.
- If you closed the browser or restarted your computer: open the dataset upload page again. Click **Re-select files to resume** and choose the same files. DataHub sends only the missing parts.
- An unfinished upload expires after **24 hours**. Then you must start that file again.

### 6.6 Remove a file

While the dataset is a draft (or changes are requested), you can remove a file. Removed files are deleted after 30 days.

## 7. What happens during processing

After each file uploads, DataHub checks it automatically. Usually this takes a few minutes. You can leave the page. You get a notification when processing finishes.

1. **Type check.** The real file type must match the extension.
2. **Safety check.** Programs, scripts and other unsafe types are refused.
3. **ZIP unpacking.** Files inside ZIPs are extracted and checked one by one.
4. **Integrity check.** The file must open (PDF opens, image decodes, JSON parses).
5. **Malware scan.** Every file is scanned. A file that was not scanned clean is **never** paid.
6. **Fingerprint and duplicate detection.** DataHub computes a fingerprint (SHA-256) of each file and looks for copies already on the platform.
7. **Previews.** DataHub makes page images or text previews for the reviewer.

**File statuses**

| Status | Meaning | What to do |
|---|---|---|
| `pending_upload` | Waiting for upload. | Upload or resume. |
| `uploaded` | Received, waiting to be processed. | Wait. |
| `processing` | Being checked. | Wait. |
| `ready` | Passed all checks. | Nothing. It will be reviewed. |
| `failed` | A check failed. The reason is shown (see table below). | Fix the file and upload it again, or remove it. |
| `quarantined` | The malware scan found a threat. | Remove the file. Check your computer for viruses. |

| Failure reason | Meaning |
|---|---|
| `type_mismatch` | The file content does not match its extension. |
| `disallowed_type` | This type is not allowed. |
| `nested_archive` | A ZIP inside a ZIP. Unzip it and upload the inner files. |
| `zip_limits_exceeded` | The ZIP breaks a ZIP rule (§6.3). |
| `unsafe_member_path` | A file inside the ZIP has an unsafe name or path. |
| `corrupt` | The file is damaged or cannot be opened. |
| `infected` | Malware was found. |
| `scan_error` | The scan did not finish. An admin can rescan it. Contact support if it stays. |

**Duplicates.** If a file is an exact copy of a file DataHub already accepted (from you or anyone), it earns **$0**. The estimate does not count it.

## 8. Submit for review

The **Submit for review** button works when **every file is finished processing** and **at least one file is `ready`**. Files that failed are excluded automatically.

1. Click **Submit for review**.
2. Check the summary: number of files, eligible size, estimate.
3. Tick **all six** rights statements:
   - RD-1: You created or own the files, or have written permission, and can grant the licence.
   - RD-2: You got the files lawfully. Sharing them breaks no contract or duty of confidentiality.
   - RD-3: You answered the personal-data question truthfully and have a lawful right to share any personal data.
   - RD-4: No classified, secret or confidential material, unless you are authorised.
   - RD-5: No malware. No padded, duplicated or altered files to increase payment.
   - RD-6: You understand that only accepted, unique, eligible files are paid, and false statements can lead to removal, recovery of payments and suspension.
4. Confirm.

After submitting, you **cannot add files** unless the reviewer requests changes. The dataset now waits in the review queue. Target times: a reviewer starts within **5 business days** and finishes within **10 business days**.

**Changed your mind?** You can **withdraw** a dataset while it is `draft`, `submitted` or `changes_requested`. You cannot withdraw it while it is `in_review`. Withdrawn datasets are not reviewed or paid. Their files are deleted after 30 days.

## 9. Dataset statuses

| Status | Meaning | What happens next |
|---|---|---|
| `draft` | You are still preparing it. | Upload files and submit. A draft with no activity for 180 days gets a reminder and is withdrawn 14 days later. |
| `submitted` | Waiting for a reviewer. | A reviewer claims it. |
| `in_review` | A reviewer is checking it. | Wait for the result. |
| `approved` | All reviewed files were accepted. | Earnings are added to your wallet. |
| `partially_approved` | Some files were accepted, some rejected. | You are paid for accepted files only. |
| `rejected` | No files were accepted. | No payment. Read the feedback. This is final. |
| `changes_requested` | The reviewer wants you to fix something. | Edit and resubmit (§10). |
| `withdrawn` | You withdrew it. | Files deleted after 30 days. |
| `taken_down` | An admin removed it (for example after a rights or privacy complaint). | You get a message with the reason. |

`approved`, `partially_approved` and `rejected` are final. To add more material from the same source, create a **new** dataset.

## 10. Feedback and resubmission

Open the dataset at `/datasets/[id]?tab=feedback`. You see:

- the decision for each file,
- the reason for each rejected file, and sometimes a comment,
- the quality scores,
- the reviewer as a pseudonym (for example "Reviewer 19a2").

**Rejection reasons**

| Code | What it means |
|---|---|
| `duplicate` | The file is already held by the platform, or appears twice in this dataset. |
| `near_duplicate` | A near copy (re-scan or resized version) of content already held. |
| `corrupt` | The file is damaged or cannot be read completely. |
| `illegible` | The text cannot be read reliably (blur, low resolution, damage). |
| `off_topic` | Not text-bearing, or not useful for Khmer/English document AI. |
| `personal_data` | Personal data that was not declared or cannot be accepted. |
| `copyright_concern` | We could not confirm you have the right to license it. |
| `malware` | The file was flagged as unsafe. |
| `wrong_format` | Unsupported format, cannot be previewed safely, or wrong encoding. |
| `low_quality` | Below our quality threshold. See the comment. |
| `incomplete` | Incomplete compared with the description. |
| `metadata_mismatch` | Title, language, category, data class or source does not match the content. |
| `size_inflation` | The file seems padded or re-encoded to look bigger. |
| `other` | See the reviewer's comment. |

**If changes are requested**

1. Read the feedback.
2. Edit the details, remove files or upload new files at `/datasets/[id]/upload`.
3. Submit again. You tick the rights statements again.

- Files you did not change are kept. You do not upload them again.
- Each resubmission creates a new version (v2, v3 …).
- A dataset can have **at most 3** change requests. On the fourth review, the reviewer must approve, partly approve or reject.
- Resubmit within 90 days. You get a reminder at 60 days. After 90 days the dataset is withdrawn automatically.

**Disagree with a decision?** Open a conversation in Messages within **60 days** of the decision. Link the dataset. A different reviewer re-checks it. If you are right, the missing amount is credited to your wallet as an adjustment.

## 11. How earnings are calculated

### 11.1 The rule

- **Raw:** $1.00 per accepted GB. **Labeled:** $1.50 per accepted GB.
- **1 GB = 1,000,000,000 bytes** (decimal GB).
- DataHub counts money in micro-dollars (1 USD = 1,000,000 micros).
- For each accepted file: `earning = floor(file bytes × rate ÷ 1,000,000,000)` micros. "Floor" means round **down**.
- Dataset earning = the sum of all file earnings.
- Amounts are shown rounded **down** to whole cents. The extra fraction stays in your wallet and counts toward later withdrawals.
- For files inside a ZIP, the **unzipped** size counts. The ZIP itself earns nothing.
- The rate is the one in force when the review is **finalized**, not when you uploaded.

### 11.2 What earns $0

- Rejected files.
- Failed or quarantined files, or files not scanned clean.
- The ZIP container itself.
- **Exact duplicates** of a file already accepted (from anyone, including you).
- A second copy of the same file inside one dataset (only the first copy can be paid).
- Withdrawn datasets, and datasets that are rejected or sent back with changes requested.

### 11.3 Worked examples

**Example 1 — one raw file.** 734,003,200 bytes.
734,003,200 × 1,000,000 ÷ 1,000,000,000 = 734,003.2 → round down → **734,003 micros = $0.73**.

**Example 2 — the same file, labeled.**
734,003,200 × 1,500,000 ÷ 1,000,000,000 = 1,101,004.8 → **1,101,004 micros = $1.10**.

**Example 3 — tiny files.** A raw file of 999 bytes earns 0 micros. A raw file of 10,000 bytes earns 10 micros.

**Example 4 — a partly approved raw dataset (`DS-2026-000123`).**

| File | Size (bytes) | Result | Earning (micros) |
|---|---|---|---|
| A `ledger_1960.pdf` | 2,000,000,000 | accepted | 2,000,000 |
| B `blurry_scan.jpg` | 523,456,789 | rejected `illegible` | 0 |
| C `gazette_vol2.tiff` | 1,250,000,001 | accepted | 1,250,000 |
| D `copy_of_A.pdf` | 1,048,576 | exact duplicate of an accepted file | 0 |
| E `forms.zip` | 900,000,000 | ZIP container | 0 |
| E1 `forms/receipt_001.png` | 600,000,000 (unzipped) | accepted | 600,000 |
| E2 `forms/receipt_002.png` | 700,000,000 (unzipped) | accepted | 700,000 |
| **Total** | | | **4,550,000 micros = $4.55** |

**Example 5 — the same dataset, confirmed as labeled.**
A 3,000,000 + C 1,875,000 + E1 900,000 + E2 1,050,000 = **6,825,000 micros**, shown as **$6.82**. The extra half cent stays in your wallet.

**Example 6 — adding labels to data that was already paid as raw.** File F (3,000,000,000 bytes) was paid before at the raw rate ($3.00). You submit it again in a labeled dataset with accurate labels. If the reviewer ticks "labeled upgrade", F earns only the difference: 3,000,000,000 × (1,500,000 − 1,000,000) ÷ 1,000,000,000 = **$1.50**. Without the tick, F earns $0.

### 11.4 Estimates

Before review, the dataset page shows an **Estimate** (≈). It counts processed, clean, non-duplicate files at the current rate. It is **not** money in your wallet. The final amount is set when the review is finalized.

## 12. Your wallet (`/earnings`)

| Figure | Meaning |
|---|---|
| **Estimated** | What your datasets in review may earn. Not money yet. |
| **Pending** | Approved earnings waiting for a hold period. Not withdrawable yet. (By default there is no hold, so earnings go straight to Available.) |
| **Available** | Money you can withdraw. |
| **Reserved** | Money locked by an open withdrawal request. |
| **Paid** | Total money sent to you. |
| **Adjustments** | Manual corrections by DataHub finance, each with a reason. |
| **Approved earnings (lifetime)** | Everything you ever earned, split into "Dataset purchases" and "Annotation work". |

The **Transactions** tab (`/earnings?tab=transactions`) lists every money movement. Each item links to its source: a dataset review, an annotation task, a withdrawal or an adjustment.

## 13. Withdrawals (`/withdrawals`)

### 13.1 Before you can withdraw

- Your verification is `approved`.
- Your account is active.
- You have at least one payout method.
- You have no other open request (`requested` or `approved`).

The page shows a checklist of anything missing.

### 13.2 Rules

| Rule | Value |
|---|---|
| Minimum | $10.00 |
| Maximum per request | $5,000.00 |
| Amount | Whole cents only, and not more than your Available balance |
| Open requests | One at a time |
| Currency | USD |

**Withdraw all available** fills in your available balance rounded down to whole cents. Example: available $57.4321 → you can request $57.43.

### 13.3 Request a withdrawal

1. Go to `/withdrawals` and click **Request withdrawal**.
2. Enter the amount and choose a payout method.
3. Check the summary and confirm.
4. The amount moves from **Available** to **Reserved**.

Clicking twice does not create two requests.

### 13.4 What happens next

| Status | Meaning |
|---|---|
| `requested` | Waiting for DataHub finance. You can still **cancel** it. The money returns to Available. |
| `approved` | Approved. Finance will send the money. Requests of **$100.00 or more** need two different approvers, so they can take a little longer. |
| `paid` | Money sent. You see the payment reference and date at `/withdrawals/[id]`. |
| `rejected` | Not approved. The reason is shown. The money returns to Available. Fix the cause and request again. |
| `failed` | The transfer failed (for example, wrong account). The money returns to Available. Check your payout method and request again. |
| `cancelled` | Cancelled by you, or by finance with a reason. The money returns to Available. |
| `reversed` | A paid transfer bounced back to SKAI. The money returns to Available. |

**Timing targets:** a decision within **5 business days**, payment within **10 business days** of your request.

**How you are notified:** you get an in-app notification and an email when your request is received, approved, paid, rejected, failed or cancelled.

**Fees and currency:** SKAI pays its own sending fees. Fees charged by your bank or by intermediaries are your responsibility. If the payment rail needs KHR, the provider's exchange rate is used. Your request amount is always in USD.

**Did not receive money marked paid?** Message support with the withdrawal code (`PO-…`). Finance checks the transfer with the provider.

**Tax:** DataHub does not deduct tax in v1. Amounts are gross. You are responsible for any tax in your country. (This notice is pending legal review.)

## 14. Messages and notifications

### 14.1 Messages (`/messages`)

- Click **New conversation** to contact DataHub support. You can link one of your datasets.
- You can attach files up to **10 MB**. Attachments are scanned before anyone can open them.
- Conversation statuses: `open` (support is working on it), `awaiting_user` (support is waiting for your reply), `closed`. If you reply to a closed conversation, it opens again.
- Never send passwords or full card numbers in messages.

### 14.2 Notifications (`/notifications`)

The bell in the top bar shows unread notifications. You get notifications (in the app and by email) for example when:

- your email is verified,
- your verification is approved, needs information or is rejected,
- file processing finishes,
- a dataset is received, approved, partly approved, rejected or needs changes,
- earnings are credited,
- a withdrawal is requested, approved, paid, rejected or failed,
- support replies to you.

Choose which emails you get at `/settings?tab=notifications`. Security emails (password changes, sign-in alerts, account locks) are always sent.

## 15. Account security (`/settings?tab=security`)

- **Change password:** enter your current password and a new one. All your other sessions are signed out.
- **Sessions:** see where you are signed in. Sign out one session, or click **Sign out other sessions**. A session ends after **7 days** without activity, or **30 days** after sign-in at most. DataHub warns you 2 minutes before an idle session ends.
- **Two-step verification (optional for contributors):** you can turn on an authenticator app (TOTP). Save your 10 recovery codes in a safe place. Each code works once.
- **Sign-in alerts:** we email you when someone signs in from a new device, or when your account is locked.
- If you see a session or sign-in you do not recognise: change your password, sign out other sessions, and message support.

## 16. Delete your data

### 16.1 Delete your account (`/settings?tab=privacy`)

1. Click **Request account deletion**.
2. Read what will be deleted and what is kept.
3. Type `DELETE` and confirm with your password (and your two-step code if you use one).

What happens:

- You have **14 days** to change your mind. You can cancel from the email link or the settings page.
- The request waits ("on hold") while you have an open withdrawal, reserved money, or a dataset in review.
- If your available balance is $10.00 or more, withdraw it first. If it is less, you can keep the account until it reaches $10.00, or give up the balance.
- Deletion is finished within **30 days** (not counting time on hold). You get a confirmation email.

What is kept, and why:

- **Accepted datasets** stay with SKAI under the licence you gave. Your name is removed.
- **Financial records** (earnings, withdrawals) are kept for **7 years** for accounting and tax.
- **Agreements, rights declarations and audit records** are kept as proof.
- Draft, submitted and changes-requested datasets are withdrawn and deleted.

> "When we delete your data, it is removed from our live systems straight away or on the schedule shown above. Copies may remain in our encrypted backups for up to 35 days, until those backups expire. We use backups only to recover from a technical failure. If we ever restore a backup, we delete your data again before the system goes back into use."

### 16.2 Delete specific data

- **Draft data:** remove files or withdraw the dataset. Deleted after 30 days.
- **Rejected data:** kept 90 days for disputes, then deleted. To delete earlier, ask support in Messages. This is done within 10 business days unless a dispute is open.
- **Uploaded something by mistake that was already accepted:** message support right away. We handle it as a takedown request.

## 17. FAQ

**Do I need to be verified to upload?**
No. You need a verified email and finished onboarding. Verification is only for withdrawals and annotation work.

**Why does my estimate differ from what I was paid?**
The estimate assumes all ready files are accepted at today's rate. The final amount counts only accepted, eligible files at the rate in force at finalization.

**I uploaded the same file in two datasets. Will I be paid twice?**
No. Each file content is paid once. The second copy earns $0.

**Why is 1 GB = 1,000,000,000 bytes and not 1,073,741,824?**
DataHub uses decimal GB everywhere. Your computer may show sizes in GiB, which look a little smaller.

**My upload stopped at 80 %. Do I start again?**
No. Reconnect and it continues. If you closed the browser, open the upload page and re-select the same files within 24 hours.

**Can I upload a 6 GB video or a 5 GB PDF?**
No. The limit is 4 GB per file. Split large PDFs into parts. Video is not a supported format.

**Can I upload text typed with the Limon font?**
Yes, but it is not Khmer Unicode. Mention it in "legacy font notes". The reviewer decides if it is useful, and it is priced as raw.

**Can I upload ID cards, bank statements or medical records?**
Not by default. These are prohibited unless SKAI has approved a special project.

**Can I change the data class after submitting?**
Not yourself. The reviewer can change it at review. If changes are requested, you can edit it before resubmitting.

**Who can see my files?**
You, the reviewer who claimed your dataset, annotators assigned to tasks on accepted files, and DataHub admins. All files are private. Every view is logged.

**Does SKAI own my files after paying?**
No. You keep ownership. SKAI gets a non-exclusive licence to use accepted files for AI work.

**Why was my withdrawal of $100 slower than my $20 one?**
Requests of $100.00 or more need two different finance approvers.

**I see a maintenance page.**
DataHub is being updated. The page returns automatically when the service is back.
