# DataHub — User Documentation (index)

| Field | Value |
|---|---|
| **Purpose** | Index of the supplementary operating guides for DataHub users and staff. |
| **Audience** | Contributors, annotators, reviewers, admins and super admins; support staff who answer their questions. |
| **Scope** | Task-oriented "how to" guides. They explain the product in plain English and do not add rules. The canonical rules live in the engineering baseline and the policy documents linked below. The developer README and setup guide (mandatory document #35) is the repository root `README.md`, not this folder. |
| **Last updated** | 2026-10-26 |
| **Status** | Baseline — screenshots to be added after implementation. |

## Guides

| Guide | For | Covers |
|---|---|---|
| [CONTRIBUTOR_GUIDE.md](CONTRIBUTOR_GUIDE.md) | Every registered user | Register, verify email, onboarding, verification, creating datasets, uploading (4 GB per file, 50 GB per dataset, ZIP rules, resume), processing, submitting, statuses, feedback and resubmission, earnings with worked examples, wallet, withdrawals, messages, notifications, account security, data deletion, FAQ. |
| [ANNOTATOR_GUIDE.md](ANNOTATOR_GUIDE.md) | Annotators | Access, task list and statuses, the three-panel editor, keyboard shortcuts, autosave, conflicts, Khmer typing, markers, submitting, corrections, rewards, FAQ. |
| [REVIEWER_GUIDE.md](REVIEWER_GUIDE.md) | Reviewers (and admins who review) | Queue and claiming (max 5 active claims), workspace, checklist and rubric, per-file decisions and reason codes, partial approval, labeled upgrade, payable summary, finalize and feedback, annotation review, QA sampling, separation of duties, confidentiality. |
| [ADMIN_GUIDE.md](ADMIN_GUIDE.md) | Admins and super admins | First-time setup (CLI super admin, MFA), users, roles, verification, dataset oversight and takedown, review oversight, annotation projects, payouts, adjustments, pricing, inbox, exports, analytics, audit logs, settings, daily/weekly checklists, runbook links. |

## Which guide do I need?

- I want to upload data and get paid → **Contributor Guide**.
- I was given annotation tasks → **Annotator Guide** (and the Contributor Guide for withdrawals).
- I check datasets or annotations → **Reviewer Guide**.
- I run DataHub operations or finance → **Admin Guide**.

People with several roles use the **workspace switcher** at the top of the sidebar (Contribute, Annotate, Review, Admin).

## Writing rules for these guides

- Plain, friendly English. Short sentences. Many readers are in Cambodia and read English as a second language.
- Task-oriented: start with what the user wants to do, then the steps.
- Use the exact page routes and names from [UI_UX_DESIGN.md](../03-ui-ux-design/UI_UX_DESIGN.md) §3.
- Use the exact status names, limits and amounts from [ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md), including the §16 amendments (for example: 4 GB per file, admin sessions 30 minutes idle / 12 hours absolute, sign-in lock after 5 failures in 15 minutes, 5 active review claims).
- Money: `$` with 2 decimals; sizes in decimal units (1 GB = 1,000,000,000 bytes).
- Do not repeat policy text in full. Link to the source document instead.
- When a rule changes in a source document, update the affected guide in the same change.

## Source documents

| Topic | Document |
|---|---|
| Canonical decisions | [ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md) |
| Routes, pages, shortcuts, confirmations | [UI_UX_DESIGN.md](../03-ui-ux-design/UI_UX_DESIGN.md), [USER_FLOWS.md](../03-ui-ux-design/USER_FLOWS.md) |
| Prices, earnings, wallet, payouts | [PRICING_PAYOUT_POLICY.md](../01-business-product/PRICING_PAYOUT_POLICY.md) |
| Sign-in, sessions, MFA, roles | [AUTH_AUTHORIZATION.md](../04-backend-api/AUTH_AUTHORIZATION.md) |
| Annotation rules | [ANNOTATION_GUIDELINES.md](../05-data-annotation/ANNOTATION_GUIDELINES.md) |
| Review rules and reason codes | [DATA_QUALITY_REVIEW.md](../05-data-annotation/DATA_QUALITY_REVIEW.md) |
| Dataset metadata, categories, exports | [DATASET_DOCUMENTATION.md](../05-data-annotation/DATASET_DOCUMENTATION.md) |
| Rights, licence, privacy, takedown | [DATA_PRIVACY_OWNERSHIP.md](../05-data-annotation/DATA_PRIVACY_OWNERSHIP.md) |
| Retention and deletion | [DATA_RETENTION_DELETION.md](../05-data-annotation/DATA_RETENTION_DELETION.md) |
| Deployment and runbooks | [DEPLOYMENT_PLAN.md](../07-deployment-operations/DEPLOYMENT_PLAN.md) |

## Pending items

- Screenshots for each guide are added after the web app is implemented.
- Legal texts (Contributor Agreement, Terms, Privacy Policy, confidentiality undertaking, tax notice) are drafts pending legal review (HA-01–HA-04). Update the guides if counsel changes them.
- A Khmer translation of these guides is planned once the UI message catalogue supports Khmer.
