# DataHub — Admin Guide

| Field | Value |
|---|---|
| **Purpose** | Operating guide for DataHub administrators and super administrators: first-time setup, people, data, reviews, annotation projects, money, support, exports, analytics, audit, settings, and routine checks. |
| **Audience** | Users with the `admin` or `super_admin` role (operations, finance, data protection, CTO). |
| **Scope** | Day-to-day use of the Admin workspace (`/admin/...`) and the admin-only CLI steps. Infrastructure, deployment and incident runbooks are in [DEPLOYMENT_PLAN.md](../07-deployment-operations/DEPLOYMENT_PLAN.md). Reviewing work is in [REVIEWER_GUIDE.md](REVIEWER_GUIDE.md). |
| **Last updated** | 2026-10-26 |
| **Status** | Baseline — screenshots to be added after implementation. |
| **Sources** | [ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md) (incl. §16 AM-01, AM-04, AM-06, AM-08, AM-09); [UI_UX_DESIGN.md](../03-ui-ux-design/UI_UX_DESIGN.md) §3, §12; [AUTH_AUTHORIZATION.md](../04-backend-api/AUTH_AUTHORIZATION.md); [PRICING_PAYOUT_POLICY.md](../01-business-product/PRICING_PAYOUT_POLICY.md); [DATA_QUALITY_REVIEW.md](../05-data-annotation/DATA_QUALITY_REVIEW.md); [DATASET_DOCUMENTATION.md](../05-data-annotation/DATASET_DOCUMENTATION.md); [DATA_PRIVACY_OWNERSHIP.md](../05-data-annotation/DATA_PRIVACY_OWNERSHIP.md); [DATA_RETENTION_DELETION.md](../05-data-annotation/DATA_RETENTION_DELETION.md). If this guide and those documents disagree, those documents win. |

---

## 1. Admin basics

**Who can do what**

| Area | admin | super_admin |
|---|:-:|:-:|
| Users, verifications, datasets, takedowns, exports, analytics, support inbox | ✓ | ✓ |
| Grant/remove `annotator` and `reviewer` | ✓ | ✓ |
| Grant/remove `admin` and `super_admin` | — | ✓ |
| Annotation projects and assignments | ✓ | ✓ |
| Review datasets and annotations (as a reviewer) | ✓ | ✓ |
| Approve, reject, mark paid, mark failed, cancel payouts | ✓ | ✓ |
| Reverse a paid payout, adjustments, pricing rules | — | ✓ |
| Audit logs, security events, system settings | — | ✓ |

**Security rules for admins**

- **MFA (authenticator app) is mandatory.** You cannot turn it off while you hold an admin role.
- Admin sessions end after **30 minutes** of inactivity and **12 hours** after sign-in at most.
- **Step-up:** financial and privileged actions need an MFA code entered within the last **15 minutes**. DataHub asks for a code when needed. Step-up applies to: payout approve/reject/mark-paid/mark-failed/cancel/reverse, adjustments, pricing rules, suspend/reactivate users, role changes, revoke sessions, dataset takedown, creating exports, and changing settings.
- **Separation of duties:** you can never act on your own payout, adjustment, verification, roles or dataset. Admins do not hold `payout.request`. If you also contribute privately, use a separate contributor account.
- Every admin action is written to the audit log (who, what, before/after, IP, request ID). Viewing sensitive data (unmasked payout details, ID documents) is also logged.
- Confirmation levels: L2 = confirm dialog; L3 = reason required; L4 = type an exact value (amount, code, email or word) to confirm.

## 2. First-time setup

### 2.1 Create the first super admin (CLI)

There is no web sign-up for admins. On the server, an operator with shell access runs:

```bash
scripts/create-admin
```

- The script **asks** for the email and password interactively. Never pass them as arguments or environment variables.
- The exact way to run it inside the production container is in [DEPLOYMENT_PLAN.md](../07-deployment-operations/DEPLOYMENT_PLAN.md).
- Users are never created by database migrations. Migrations seed only roles, system wallets, the two initial pricing rules (raw $1.00/GB, labeled $1.50/GB) and default settings.

### 2.2 Enrol MFA

1. Sign in at `/login`.
2. DataHub sends you to `/settings?tab=security&setup=mfa`. No other page works until MFA is on.
3. Enter your password. Scan the QR code with an authenticator app (6-digit codes, 30 seconds).
4. Enter one code to enable MFA.
5. **Save the 10 recovery codes** somewhere safe and offline. Each works once. They are shown only once.
6. From now on, sign-in has a second step (`/login?step=mfa`).

**Lost device:** use a recovery code. If none are left, a super admin resets MFA after checking your identity out of band:

```bash
scripts/create-admin --reset-mfa <email>
```

This revokes all your sessions and forces re-enrolment. A super admin who loses all factors is recovered through the two-person break-glass procedure in [DEPLOYMENT_PLAN.md](../07-deployment-operations/DEPLOYMENT_PLAN.md).

### 2.3 Launch checklist (super admin)

1. Open `/admin/settings` and check every value against §15. Uploads: `max_file_bytes` must be **4,000,000,000** (4 GB).
2. Open `/admin/pricing`. Confirm raw $1.00/GB and labeled $1.50/GB are in force.
3. Keep `legal_docs_approved = false` until legal counsel approves the Terms, Privacy Policy and Contributor Agreement (HA-01).
4. Create at least **two** people with `payout.approve` (two admins). Payouts of $100.00 or more need two different approvers.
5. Grant `reviewer` to review staff. Set the **privacy-trained** flag for reviewers who completed privacy training (only they can claim datasets with possible personal data).
6. Name a **Data Protection Lead** (DPL) for takedowns and privacy cases.
7. Send a test email (register a test account) and confirm delivery.
8. Check `/admin/finance?tab=reconciliation` shows OK.

## 3. User management

### 3.1 Find users (`/admin/users`)

Filter by role, status, verification, join date. Search by name or email. `Ctrl K` jumps to a user by email or UUID.

### 3.2 User details (`/admin/users/[id]`)

Tabs: `overview`, `datasets`, `finance`, `roles`, `sessions`, `activity`.

| Action | How | Notes |
|---|---|---|
| Suspend | **Suspend** (L3, reason, step-up) | All sessions end within seconds. Open uploads are aborted. Claimed reviews are released. Assigned annotation tasks are unassigned (drafts kept). Open payouts are **not** cancelled — you decide them. The user gets an email with the reason. |
| Reactivate | **Reactivate** (step-up) | Nothing is restored automatically. |
| Revoke sessions | **Revoke all sessions** (L2, step-up) | Use when an account may be compromised. |
| Change roles | **Roles** tab (step-up) | See §4. |
| Message the user | **Message** | Opens a support conversation. |

You cannot suspend yourself or change your own roles. Actions on admin accounts need a super admin. The last active super admin cannot be removed or suspended.

**Account deletion requests** are processed by the system after a 14-day cooling-off and are put on hold while the user has an open payout, reserved money, a dataset in review, a dispute, a takedown or a legal hold. Only a super admin can reject a deletion request, with a reason. Target: completed within 30 days.

## 4. Roles

| Role | Gives | Granted by |
|---|---|---|
| `contributor` | Upload datasets, wallet, withdrawals. Every user has it. | Automatic |
| `annotator` | Work on assigned annotation tasks; rewards. Also needs approved verification to receive tasks. | admin, super_admin |
| `reviewer` | Review datasets and annotations. | admin, super_admin |
| `admin` | Admin workspace (§1). MFA forced at next request. | super_admin only (L4: type the user's email) |
| `super_admin` | Admin + pricing, settings, roles, audit, adjustments, reversals. | super_admin only (L4) |

- Role changes take effect on the user's next request.
- `contributor` can be removed only from staff accounts with no datasets and no balance.
- Before granting `annotator` or `reviewer`, make sure the person accepts the confidentiality undertaking (they are asked before their first task or claim).

## 5. Contributor verification (`/admin/verifications`)

Verification gates **withdrawals and annotation assignment**, not uploads.

1. Open `/admin/verifications?status=pending` (oldest first). Click a case to open the sheet.
2. Check:
   - legal name, country, date of birth (**18 or older**), phone;
   - payout method: the account holder name should match the legal name;
   - the ID document, if uploaded (viewing it is logged);
   - history: earlier submissions and decisions;
   - flags: for example, **3 or more accounts sharing one payout account number**.
3. Decide:
   - **Approve** — the user can withdraw and receive annotation work.
   - **Needs info** (L3) — write a clear message saying what to provide.
   - **Reject** (L3) — write the reason.
4. The user gets a notification.

Target: decide within **2 business days**. You cannot decide your own verification. Rejected or superseded ID documents are deleted after 90 days.

## 6. Dataset oversight and takedown

### 6.1 Search (`/admin/datasets`)

Filters: text (title or exact code such as `DS-2026-000123`), status, data class, language, category, minimum quality, owner, date range.

### 6.2 Dataset details (`/admin/datasets/[id]`)

Tabs: `files`, `reviews`, `duplicates`, `activity`. From here you can:

- see full metadata, every file with processing and scan status, duplicates, reviews and earnings;
- **Rescan** a file whose scan status is `error` (files are paid only if scanned clean);
- **Message owner**;
- **Claim review** (if you also review);
- **Take down** the dataset.

### 6.3 Takedown

Use takedown for upheld rights, privacy, confidentiality or illegal-content complaints, or a contributor's request about their own data.

1. Requests arrive through the public takedown/contact form (`/help`), the takedown email address, a reviewer or annotator report, or support messages. Each request gets a code `TD-YYYY-NNNN`.
2. Follow the service levels:

| Step | Target |
|---|---|
| Acknowledge the requester | ≤ 2 business days |
| Interim restriction for personal data, illegal content, confidential material, authority requests | ≤ 24 hours from receipt |
| Interim restriction for credible copyright claims | ≤ 2 business days |
| Notify the contributor (without the requester's personal details unless they agreed) | At restriction, or when review starts |
| Contributor counter-statement window | 10 business days |
| Decision | ≤ 10 business days after acknowledgement (one 10-day extension, with notice) |
| Execute upheld actions | ≤ 2 business days after decision |

3. To take down: on `/admin/datasets/[id]` click **Take down** (L4: type the dataset code; reason required; step-up). Link the takedown request.
4. Effects: status `taken_down`; open annotation tasks cancelled; approved annotations excluded from future exports; active exports containing the files expire immediately; files deleted immediately for personal data, illegal content and confidential material, otherwise after 30 days (unless a legal hold applies).
5. If the contributor's declaration was false, a super admin may post an adjustment debit (`takedown_recovery`).

**Legal hold** (super admin): place a hold on a user, dataset, file set, takedown or payout for litigation, a regulator or police request, or a fraud investigation. Nothing on hold is deleted. Review holds every 90 days.

## 7. Review oversight (`/admin/reviews`)

- Filter `?status=submitted` (waiting) or `?status=in_review` (claimed). Watch age: target first claim within **5 business days**, finalize within **10 business days**.
- **Stale claims:** claims with no activity for over **72 hours** are highlighted. Release them with a reason. The dataset returns to the queue.
- Reviewers hold at most `review_max_active_claims` (default 5) claims each.
- Datasets with possible personal data can be claimed only by privacy-trained reviewers. Make sure enough reviewers have the flag.
- **Monthly QA:** re-examine a random 5 % of finalized dataset reviews (at least 2 per reviewer). Discuss disagreements. Fix contributor-impacting errors only with adjustments (§11).
- **Disputes:** contributors may dispute within 60 days. Ask a reviewer who was **not** the original reviewer to re-examine. If upheld, a super admin posts an `adjustment_credit` (reason `review_error`) using the original rate. Finalized reviews are never reopened.
- `malware` rejections by reviewers alert you: rescan or take down the file. `personal_data` and `copyright_concern` rejections are flagged for privacy and rights follow-up.

## 8. Annotation projects

### 8.1 Create a project (`/admin/annotation/projects/new`)

| Step | Route | What to set |
|---|---|---|
| Basics | `?step=basics` | Name; instructions (markdown). Instructions can turn on `word_segmentation` (ZWSP) or `redact_personal_data`, or `mode: normalised` for corrections. |
| Sources | `?step=sources` | Source datasets: only `approved` or `partially_approved`. Only accepted, previewable, annotatable files are used (PDF, images, TIFF page-level; DOCX, ODT, RTF, TXT text). |
| Schema | `?step=schema` | Annotation types: `transcription`, `text_correction`, `classification`, `metadata`, `page_label`. Label set for classification (default set in ANNOTATION_GUIDELINES.md §9.1). Metadata form (text, number, date, select; required or optional). |
| Rewards | `?step=rewards` | Task unit: `file` or `page`. Reward per task, optional reward per page. Deadline. |
| Review | `?step=review` | Check everything and create. Review is always required. |

Projects get a code `AP-YYYY-NNNN`. For datasets with personal data, enable redaction.

### 8.2 Generate tasks

On `/admin/annotation/projects/[id]` (`?tab=overview`), click **Generate tasks**. New tasks are `unassigned`.

### 8.3 Assign (`/admin/annotation/assignments`)

1. Choose the project (`?project=<id>`). Filter by status.
2. Select tasks and **Assign** or **Bulk assign** to an annotator. The list shows each annotator's workload.
3. Only annotators who are **active and verified** can receive tasks. Do not assign to annotators below 80 % QA pass rate until retrained.
4. **Unassign / reassign** (L2) works on `assigned` and `in_progress` tasks. The draft is kept as a version; the next annotator continues from it.
5. Match the dataset's primary language to the annotator's skills.

**Report problem** from annotators (wrong file, legacy encoding, sensitive content, unreadable source) pauses the task and notifies you. Convert legacy text or cancel the task; for sensitive content, involve the DPL within 2 business days.

### 8.4 Annotation reviews (`/admin/annotation/reviews`)

See all submitted tasks waiting for review. Claim them yourself or make sure reviewers do. The weekly report lists annotators with no QA sample that week; add one manually. You are notified when an annotator gets three scores of 1 in 30 days.

### 8.5 Close a project

On the project page, **Close project** (L3). All tasks that are not approved become `cancelled` (the dialog shows how many). Cancelled tasks earn no reward.

## 9. Payouts

Contributors call it "withdrawal"; finance screens call it "payout". **DataHub never moves money.** You transfer money outside DataHub, then record it.

### 9.1 Queue (`/admin/payouts`)

Filter `?status=requested`, oldest first. Targets: decision within **5 business days**, payment within **10 business days**.

### 9.2 Check before approving (`/admin/payouts/[id]`)

1. Verification is `approved` and the account is `active`. (A "recipient suspended" banner means you must decide what to do.)
2. The legal name matches the account holder in the payout method snapshot.
3. If the payout method was added or changed in the **last 72 hours**, confirm with the contributor by message first.
4. Open the wallet ledger: the reserved amount equals the request; earnings trace to finalized reviews or approved annotation tasks. Investigate adjustment credits in the last 30 days.

### 9.3 Approve or reject

- **Approve** (L2, step-up). Below $100.00, one approval is enough. **At $100.00 or more, two different admins must approve.** The first approval keeps the status `requested` (approvals 1 of 2); the second makes it `approved`. The dialog says which approval you are giving.
- **Reject** (L3, step-up). Reason code: `verification_mismatch`, `suspected_fraud`, `method_invalid`, `account_under_review`, `other`. The comment is mandatory and shown to the contributor. The reserved money returns to their Available balance.

### 9.4 Perform the external transfer

1. Use the payout method **snapshot** on the payout page (ABA Pay, bank transfer, Wise, PayPal, other).
2. Send **exactly the requested USD amount**. If the rail needs KHR, convert at the provider's rate and note the rate.
3. SKAI pays its own sending fees.
4. Wait for the provider's **confirmation**. Never mark a payout paid "provisionally".
5. Keep the confirmation in the provider portal too.

Recommended: for dual-approved payouts, the person recording payment is one of the approvers, and the transfer is released by someone who holds the bank-portal credentials.

### 9.5 Mark paid

Click **Mark as paid** (L4, step-up):

| Field | Rule |
|---|---|
| Typed amount | Must match the payout amount exactly (for example `125.00`). |
| Payment reference | Required. Unique per payout method type. A reused reference is refused. |
| Paid at | Required. Not in the future. |
| Notes | Exchange rate, provider details. |
| Proof | Optional PDF, PNG or JPG up to 10 MB. Stored privately and scanned. |

Result: status `paid`, money moves from Reserved to Paid, and the contributor gets an in-app notification and email. You cannot mark your own payout.

### 9.6 Mark failed, cancel, reverse

| Situation | Action | Result |
|---|---|---|
| Transfer failed **before** you marked it paid (bank rejection, wrong account) | **Mark failed** (L3, reason, step-up) | `failed`; money back to Available; user asked to check the method and request again. |
| Approved payout should not be sent | **Cancel** (L3, reason, step-up) | `cancelled`; money back to Available. |
| A **paid** payout bounced back to SKAI | **Reverse** (super admin only; L4 type amount; reason + evidence) | `reversed`; money moves from Paid back to Available. The original record stays. |

### 9.7 Reconciliation pause

A nightly job checks the ledger. If it finds a mismatch, **approve and mark-paid are paused** until a super admin acknowledges the mismatch at `/admin/finance?tab=reconciliation`. Follow the wallet reconciliation runbook in [DEPLOYMENT_PLAN.md](../07-deployment-operations/DEPLOYMENT_PLAN.md).

## 10. Payment overview (`/admin/finance`)

Tabs: `overview` (liabilities = available + reserved; paid this period; pending payouts; totals per stream: dataset purchases, annotation labour, adjustments), `ledger` (filter by user, kind, date; CSV export), `reconciliation`, `adjustments`.

**Month-end close (finance lead):** reconciliation is green; total payout records for the month equal the provider statements; every adjustment has a reason and a super admin actor; export the ledger CSV and file it with the accounting records.

## 11. Adjustments (super admin)

Use adjustments only to correct mistakes. They never edit reviews or earnings.

1. Open `/admin/finance?tab=adjustments` or the user's `finance` tab.
2. Choose **credit** or **debit**, the amount, a reason code (`review_error`, `pricing_error`, `duplicate_payment_recovery`, `takedown_recovery`, `goodwill`, `migration`, `other`) and a reason text of **at least 20 characters**. Reference the related review, payout or takedown.
3. Check the preview of the resulting available balance. Type the amount to confirm (L4, step-up).

- You cannot adjust your own wallet.
- A debit cannot be larger than the available balance. If more is owed: debit up to the available balance, record the remainder in the reason text, open a support conversation, and set the user's verification to `needs_info` to block withdrawals until it is settled.
- Another super admin should review every adjustment in the audit log.

## 12. Pricing rule versions (`/admin/pricing`)

- Admins can view. Only super admins can add rules.
- Rules are **never edited or deleted**. To change a price, add a new rule with a future **effective from** date. The old rule closes at that moment.
- A rule applies to reviews **finalized** after its start time. Past earnings never change.
- **Price decreases** must be announced to contributors at least **30 days** before they take effect (email and in-app). Increases can start immediately.
- Confirm by typing the new rate (L4, step-up).
- Any price change after launch needs owner approval (HA-06).

## 13. Messaging inbox (`/admin/messages`)

- Filter by status (`open`, `awaiting_user`, `closed`), assignee, linked dataset. Search by text.
- A user context panel sits beside the thread. Use it to check who you are talking to before you answer.
- Reply in plain, short English. Set the status to `awaiting_user` when you need the user to act.
- Attachments up to 10 MB are scanned before anyone can open them.
- Never share another user's information, a reviewer's identity, or internal fraud suspicions.
- **Close** (L2): the user can reopen it by replying.
- Typical topics: verification questions, payout method changes (confirm before paying), review disputes (60-day window), deletion of rejected data, takedown requests, lost MFA (staff only).

## 14. Exports (`/admin/exports`)

1. Click **New export** (`?new=1`). Step-up is required.
2. Choose datasets, or filters: category, languages, data class, minimum quality, finalized date range.
3. Options: include files (default yes), include annotations, text normalisation (`verbatim_and_nfc` default or `verbatim_only`), CSV manifest, **exclude personal data** (default **yes**).
4. Start. Job statuses: `queued` → `running` → `completed` or `failed`.
5. You are notified when it is ready. Open the job (`?job=<id>`) and click **Download**. The link is valid for 5 minutes; request a new one if needed.
6. The package **expires after 7 days** and is deleted.

Only accepted, eligible files from approved or partially approved datasets that are not taken down are exported, plus approved annotations. Annotators and reviewers appear only as pseudonyms. Each export and each download link is logged. Exports get a code `EX-YYYY-NNNNNN`. Failed exports: see the failed-export runbook.

## 15. Analytics, audit logs and settings

### 15.1 Analytics (`/admin/analytics?from=&to=`)

Uploads, accepted bytes, acceptance rate, earnings vs payouts, annotation throughput, reviewer throughput, languages and categories. Every chart has a table view.

### 15.2 Audit logs (`/admin/audit-logs`, super admin)

- `?tab=audit`: every state change and admin action, with a before/after diff. Filter by entity type, entity ID, actor.
- `?tab=security`: sign-ins, failures, lockouts, MFA events, revoked sessions, CSRF and permission denials, rate limits, payout-method changes.
- Audit logs are kept 7 years; security events 1 year.

### 15.3 System settings (`/admin/settings`, super admin)

Tabs: `general`, `uploads`, `finance`, `annotation`, `roles` (read-only role × permission matrix). Each change shows old → new, needs step-up, and is audited. Money values are stored in micro-USD (1 USD = 1,000,000).

| Key | Default | Meaning |
|---|---|---|
| `maintenance_mode` | false | When **true**, all non-admin API calls return 503 and users see `/maintenance`. Sign-in and `/admin` still work; super admins can still use the app. Set a message and expected end time. Turn it off after checking `/readyz`. |
| `legal_docs_approved` | false | While false, legal pages show a draft banner. Set to true **only** after counsel approves the legal texts (HA-01). |
| `max_file_bytes` | 4,000,000,000 | Per-file limit (also per ZIP member). Do not raise above 4 GB: the malware scanner cannot scan larger streams. |
| `max_dataset_bytes` | 50,000,000,000 | Per-dataset limit. |
| `user_pending_quota_bytes` | 200,000,000,000 | Unreviewed storage per user. |
| `extra_allowed_extensions` | none | Extra file types; reviewers decide on them. |
| `payout_min_micros` | 10,000,000 ($10) | Minimum withdrawal. |
| `payout_max_micros` | 5,000,000,000 ($5,000) | Maximum withdrawal. |
| `payout_dual_approval_threshold_micros` | 100,000,000 ($100) | Two approvers at or above this (HA-07). |
| `earning_hold_days` | 0 | Days earnings stay Pending before Available. |
| `labeled_upgrade_enabled` | true | Allows labeled-upgrade differential payments (HA-08). |
| `review_max_active_claims` | 5 | Dataset review claims per reviewer. |
| `annotation_qa_sample_rate` | 0.10 | Share of approved annotation tasks sent to QA. |
| `retention_*` | see DATA_RETENTION_DELETION.md §2 | Retention periods. Shorter periods apply from the next purge; purged data cannot come back. |

## 16. Operational checklists

### 16.1 Daily

- [ ] `/admin` dashboard: verifications pending, datasets awaiting review, payouts awaiting action, open support conversations.
- [ ] Reconciliation card is **OK** (nightly run). If not, follow the runbook; payouts are paused.
- [ ] Background job failures card: failed processing, emails, exports.
- [ ] `/admin/payouts?status=requested`: decide new requests; record completed transfers; nothing approved and unpaid for too long.
- [ ] `/admin/verifications?status=pending`: decide within 2 business days.
- [ ] `/admin/messages`: answer open conversations; check takedown requests against their 24-hour and 2-day targets.
- [ ] Files with scan status `error`: rescan.
- [ ] Retention purge summary: no failures.

### 16.2 Weekly

- [ ] `/admin/reviews`: release claims inactive for over 72 hours; check queue age against the 5/10 business-day targets.
- [ ] Annotation: deadlines, stalled tasks, Report-problem cases, annotators with no QA sample this week, annotators under 80 % QA pass rate.
- [ ] Access-anomaly report (for example more than 500 file opens per day by one reviewer).
- [ ] Security events (super admin): lockouts on admin accounts, bursts of failures or permission denials.
- [ ] Flags for shared payout accounts (3 or more users) in the verification queue.
- [ ] Storage use and export jobs.

### 16.3 Monthly and periodic

- [ ] Month-end finance close (§10).
- [ ] Dataset-review QA: 5 % of finalized reviews, at least 2 per reviewer.
- [ ] Review adjustments made by super admins (second super admin).
- [ ] Every 90 days: review legal holds.
- [ ] Quarterly: the DPL samples 10 purged items and confirms deletion evidence.
- [ ] Every 3 years: the data lead re-confirms the need to keep accepted data.

## 17. Runbooks

Operational runbooks are maintained in [DEPLOYMENT_PLAN.md](../07-deployment-operations/DEPLOYMENT_PLAN.md):

| Runbook | Use when |
|---|---|
| Service outage | The site or API is down; users see the server error page. |
| Database connection failure | API errors mention the database; `/readyz` fails. |
| Failed upload processing | Files stay `uploaded` or `processing`, or many fail. |
| Stuck annotation task | A task cannot be saved, submitted, assigned or reviewed. |
| Wallet reconciliation problem | Reconciliation shows a mismatch; payouts are paused. |
| Failed export | An export job is `failed` or stays `queued`. |
| Storage capacity warning | Object storage or disk is filling up. |
| Security incident | Suspected breach, account takeover or data leak (escalate to the DPL within 24 hours). |
| Backup restoration | Data must be restored; re-apply deletions after restore. |
| Break-glass super admin recovery | A super admin lost all MFA factors (two-person procedure). |

## 18. FAQ

**I cannot approve a payout — the button is missing.**
It is your own payout, or you already gave the first approval. Another admin must approve.

**Mark as paid says the reference is a duplicate.**
That reference was already used for another payout with the same method type. Check you are not recording the same transfer twice.

**A contributor says money marked paid never arrived.**
Check with the provider. If the transfer failed, a super admin reverses the payout. If it succeeded, share the reference with the contributor and close the case.

**Can I fix a wrong review decision?**
Not the review. Ask a different reviewer to re-check, then a super admin posts an adjustment.

**A reviewer left and holds claims.**
Release the claims at `/admin/reviews`. Then remove the role.

**Someone needs an admin role.**
Only a super admin can grant it. The new admin must enrol MFA at the next sign-in.
