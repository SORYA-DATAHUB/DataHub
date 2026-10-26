# DataHub — Engineering Baseline (canonical decisions)

> **Purpose.** Single source of truth that every one of the 35 mandatory documents and the implementation must agree with. If a document and this baseline disagree, this baseline wins until it is amended through `DECISION_LOG.md`.
> **Status:** Approved as documentation baseline v1.1 (2026-10-26; §16 amendments). Owner: CTO role.

---

## 1. Assumptions (A-xx) — sensible defaults for non-critical gaps

| ID | Assumption |
|---|---|
| A-01 | Operator is a single organisation ("the Platform", SKAI Technology, Cambodia) buying data for its own AI work (Khmer-first OCR / NLP). No external buyers in v1; a `buyer` role and `orders` module are reserved for v2. |
| A-02 | Primary languages of content: Khmer (km) and English (en); UI ships in English with all strings in a message catalogue so Khmer UI can be added. All text inputs/outputs are UTF-8, NFC-normalised **except** annotation transcription, which is stored exactly as typed (see §11). |
| A-03 | Initial scale: ≤ 2,000 registered users, ≤ 200 concurrent sessions, ≤ 50 concurrent uploads, ≤ 20 TB stored in year 1, single file ≤ 4,000,000,000 bytes (AM-01), dataset ≤ 50 GB. |
| A-04 | Currency is USD only. Amounts stored as **integer micro-USD** (`*_micros`, 1 USD = 1,000,000). Payouts are whole cents (multiple of 10,000 micros). |
| A-05 | Payout methods for v1: `bank_transfer` (Cambodian banks), `aba_pay`, `wise`, `paypal`, `other`. Method details are stored as admin-visible JSON, never auto-executed. |
| A-06 | Minimum withdrawal $10.00; maximum single withdrawal $5,000.00; both configurable (`system_settings`). |
| A-07 | Earning hold period default **0 days** (credit straight to `available`); configurable (`earning_hold_days`). If > 0, credits land in `pending` and a beat job releases them. |
| A-08 | Contributor verification ("eligibility review") = admin review of legal name, country, date of birth (18+), phone, payout method, optional ID document. It gates **withdrawals and annotation assignment**, not uploads. |
| A-09 | Uploads require: email verified + onboarding completed (contributor agreement accepted + rights declaration). |
| A-10 | Malware scanning by ClamAV (clamd INSTREAM). Scanning is **fail-closed**: a file that was not scanned clean can never be accepted for payment. |
| A-11 | No LibreOffice in v1: DOC/DOCX/RTF/ODT get text-extraction previews only (no page rendering). PDF/TIFF/images get page images rendered server-side. |
| A-12 | Email provider: any SMTP (Mailpit in dev; Postmark/SES/Brevo SMTP in prod). |
| A-13 | Time zone: all timestamps `timestamptz` in UTC; UI renders in user's browser tz. |
| A-14 | Annotation reward default: per-task fixed reward set per project; per-page reward optional (`reward_per_page_micros`). |
| A-15 | Retention defaults (pending legal review): rejected dataset objects 90 days; withdrawn drafts 30 days; abandoned upload sessions 24 h; exports 7 days; audit/financial records 7 years; security events 1 year. |

## 2. Items requiring human approval (HA-xx) — must be resolved before public launch

| ID | Item | Owner |
|---|---|---|
| HA-01 | Contributor Agreement, Terms of Service, Privacy Policy text (drafts provided, **not legal advice**). | Legal counsel |
| HA-02 | IP/licence model: v1 drafts a **perpetual, worldwide, non-exclusive licence** granted by contributor on acceptance+payment (not assignment). Confirm or change. | Legal / owner |
| HA-03 | Personal-data rules for Cambodia (draft Law on Personal Data Protection) and any foreign contributors (GDPR if EU residents). | Legal |
| HA-04 | Tax/withholding obligations on contributor payments; KYC thresholds. | Finance / legal |
| HA-05 | Production hosting account, domain, DNS, SMTP credentials, object-storage credentials, Sentry DSN. | Owner |
| HA-06 | Pricing changes after launch ($1.00 raw / $1.50 labeled are confirmed for v1). | Owner |
| HA-07 | Dual-approval threshold for payouts (default $100.00). | Owner / finance |
| HA-08 | Labeled-upgrade policy (§8.4) — differential payment for re-submitting already-paid raw data as labeled. | Owner |

## 3. Technology stack (pinned majors)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript 5, Tailwind CSS 4, shadcn/ui (Radix) components vendored in `apps/web/src/components/ui`, lucide-react, React Hook Form + Zod, TanStack Query 5, Recharts, next-themes (light/dark). Fonts: Inter + Noto Sans Khmer (self-hosted via `next/font`). |
| Document viewing | Server-rendered page images (PNG/WebP) for PDF/TIFF/images (ADR-0007). PDF.js is **not** used in v1. |
| Backend | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.0 (sync ORM, psycopg 3), Alembic, uv for deps. Sync handlers (threadpool); WebSocket endpoint is async using `redis.asyncio`. |
| Tasks | Celery 5 (Redis broker, `acks_late`, idempotent tasks) + Celery beat for schedules. Queues: `default`, `processing`, `exports`, `email`. |
| DB | PostgreSQL 17. |
| Cache/broker/pubsub/rate-limit | Redis 8. |
| Object storage | S3 API. Dev: SeaweedFS (`chrislusf/seaweedfs`) — MinIO images are no longer freely distributed. Prod: Cloudflare R2 or AWS S3. Private bucket `datahub-private`. |
| Malware | ClamAV `clamav/clamav:stable` (clamd on 3310, internal only). |
| Mail (dev) | Mailpit. |
| File sniffing | libmagic (`python-magic`), `pypdfium2` (PDF render), Pillow (images/TIFF), `python-docx`, `openpyxl`, `striprtf`, stdlib zipfile/xml (defusedxml). |
| Auth | Opaque session token (256-bit) in `HttpOnly; Secure; SameSite=Lax` cookie `dh_session`; SHA-256 of token stored in `user_sessions`. CSRF double-submit cookie `dh_csrf` + header `X-CSRF-Token` on unsafe methods. Argon2id passwords. TOTP MFA (pyotp) mandatory for admin/super_admin. |
| Reverse proxy | Caddy 2 (prod, auto-HTTPS). Dev: Next.js rewrites `/api/*` → API so cookies are first-party. |
| E2E | Playwright. Unit: pytest (+ real Postgres), Vitest + Testing Library for web. |
| Observability | structlog JSON logs with request_id; `/metrics` Prometheus endpoint (internal); Sentry SDK optional via `SENTRY_DSN`. |

## 4. Repository layout

```
DataHub/
├── apps/api/            # FastAPI modular monolith (package `datahub`)
│   ├── src/datahub/
│   │   ├── core/        # config, db, security, errors, logging, storage, permissions, audit, ratelimit
│   │   ├── modules/
│   │   │   ├── identity/      # auth, sessions, users, roles, profiles, verification, mfa
│   │   │   ├── datasets/      # datasets, files, uploads, versions, metadata, licences, duplicates
│   │   │   ├── processing/    # sniffing, hashing, scanning, previews, archive expansion (worker side)
│   │   │   ├── review/        # dataset reviews, file reviews, quality scores
│   │   │   ├── finance/       # pricing, ledger, wallets, earnings, payouts, adjustments
│   │   │   ├── annotation/    # projects, tasks, assignments, annotations, versions, reviews, rewards
│   │   │   ├── messaging/     # conversations, messages, attachments, notifications, websocket, email
│   │   │   ├── exports/       # export jobs, export files
│   │   │   └── admin/         # analytics, audit log view, settings
│   │   ├── worker.py    # Celery app
│   │   └── main.py      # FastAPI app factory
│   ├── alembic/         # migrations
│   └── tests/
├── apps/web/            # Next.js app
├── packages/shared/     # generated TS API types (openapi-typescript) + shared constants
├── infrastructure/{docker,deployment,monitoring}
├── tests/e2e/           # Playwright
├── scripts/             # create-admin, backup, restore, openapi export
├── compose.yaml         # local dev stack
└── docs/
```

Module rule: a module exposes `router.py` (HTTP), `service.py` (business logic, owns transactions), `models.py`, `schemas.py`, `repository.py` optional, `tasks.py` (Celery). Modules call each other **only via service functions**, never touch another module's tables directly — except read-only joins for admin search, documented in LLD.

## 5. Ports (dev host) — chosen to avoid this host's busy ports (3200, 5434, 8000, 8080)

| Service | Container | Host port |
|---|---|---|
| web (Next.js) | `datahub_web` | **3410** |
| api (FastAPI) | `datahub_api` | **8410** |
| worker / beat | `datahub_worker`, `datahub_beat` | – |
| postgres | `datahub_postgres` | **5440** |
| redis | `datahub_redis` | **6390** |
| object storage S3 | `datahub_s3` | **9410** (S3 API), 9411 (filer UI, dev only) |
| clamav | `datahub_clamav` | – (internal 3310) |
| mailpit | `datahub_mailpit` | **8425** (UI), 1035 (SMTP) |

## 6. Roles and permissions

Roles: `contributor`, `annotator`, `reviewer`, `admin`, `super_admin`. A user may hold several. Every new registered user gets `contributor`. Roles are stored in `roles` (with `permissions text[]`) and `user_roles`.

| Permission code | contributor | annotator | reviewer | admin | super_admin |
|---|:-:|:-:|:-:|:-:|:-:|
| `profile.self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `dataset.create`, `dataset.read.own` | ✓ | | | ✓ | ✓ |
| `payout.request` (also requires verified contributor) | ✓ | ✓ | | | |
| `message.self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `annotation.work` (assigned tasks only) | | ✓ | | | |
| `dataset.review` (assigned/claimed reviews only) | | | ✓ | ✓ | ✓ |
| `annotation.review` | | | ✓ | ✓ | ✓ |
| `dataset.read.any` | | | (only datasets in their review queue) | ✓ | ✓ |
| `user.read`, `user.manage`, `user.verify` | | | | ✓ | ✓ |
| `annotation.manage` | | | | ✓ | ✓ |
| `payout.approve`, `payout.record_payment` | | | | ✓ | ✓ |
| `finance.read` | | | | ✓ | ✓ |
| `finance.adjust` | | | | | ✓ |
| `dataset.export` | | | | ✓ | ✓ |
| `message.support` (support inbox) | | | | ✓ | ✓ |
| `analytics.read` | | | | ✓ | ✓ |
| `pricing.manage`, `role.manage`, `settings.manage`, `audit.read` | | | | | ✓ |

Enforcement: FastAPI dependency `require(permission)` + resource checks in services (`dataset.owner_id == actor.id`, `assignment.annotator_id == actor.id`, reviewer must be the review's assignee). Admin endpoints additionally require `session.mfa_verified_at IS NOT NULL` (setting `ADMIN_MFA_REQUIRED`, default true). Separation of duties: nobody may review their own dataset, approve/pay their own payout, or review their own annotation.

## 7. File formats

| Ext | Detected MIME (libmagic) | Allowed | Preview | Annotatable | Payable |
|---|---|:-:|---|:-:|:-:|
| pdf | application/pdf | ✓ | page images (≤ 500 pages rendered) | ✓ page-level | ✓ |
| docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document | ✓ | extracted text | ✓ text | ✓ |
| doc | application/msword | ✓ | none (download only) | ✗ | ✓ |
| odt | application/vnd.oasis.opendocument.text | ✓ | extracted text | ✓ text | ✓ |
| rtf | text/rtf | ✓ | extracted text | ✓ text | ✓ |
| txt | text/plain | ✓ | text (first 1 MB) | ✓ text | ✓ |
| jpg/jpeg, png, bmp | image/jpeg, image/png, image/bmp | ✓ | image (WebP derivative, ≤ 4096 px) | ✓ page-level | ✓ |
| tiff/tif | image/tiff | ✓ | page images (multi-page) | ✓ page-level | ✓ |
| csv | text/csv or text/plain | ✓ | first 200 rows table | ✗ (metadata only) | ✓ |
| json / jsonl | application/json or text/plain (+ parse check) | ✓ | pretty text (first 1 MB) | ✗ | ✓ |
| xml | text/xml / application/xml (defusedxml parse) | ✓ | text | ✗ | ✓ |
| xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | ✓ | first sheet, 200 rows | ✗ | ✓ |
| zip | application/zip | ✓ (container) | member list | ✗ | **container itself never payable**; each extracted member is a normal file |
| other | — | only if extension listed in setting `extra_allowed_extensions` | none | ✗ | reviewer decides |

Detection uses magic bytes; extension must agree with detected MIME family or file → `failed` (`type_mismatch`). Executables, scripts, HTML/SVG, macro-enabled Office (docm/xlsm), nested archives other than ZIP-in-ZIP depth 1 → rejected at processing (`disallowed_type`).

ZIP limits: ≤ 10,000 members; total uncompressed ≤ 20 GB; per-member ratio ≤ 100:1; depth ≤ 1 (nested zip members are *not* expanded and are marked `failed: nested_archive`); member names sanitised (no absolute paths, no `..`, no symlinks, no device files); members extracted by streaming to new S3 objects — never written to an executable path, never executed.

Upload limits: file ≤ 4,000,000,000 bytes (`max_file_bytes`, AM-01), dataset ≤ 50 GB (`max_dataset_bytes`), unreviewed storage per user ≤ 200 GB (`user_pending_quota_bytes`), ≤ 2,000 files per dataset (excluding archive members). Multipart part size 16 MiB (raised automatically to keep ≤ 10,000 parts).

## 8. Money and earnings rules

### 8.1 Units
`micros` = integer micro-USD (BIGINT). Rates stored as `rate_micros_per_gb` (raw = 1,000,000; labeled = 1,500,000). 1 GB = 1,000,000,000 bytes (decimal).

### 8.2 Formula
For each accepted, eligible file in a finalized review:
`file_earning_micros = floor(accepted_bytes × applicable_rate_micros_per_gb / 1_000_000_000)`
Dataset earning = Σ file earnings (floor per file; documented loss < 1 micro per file). Display rounds **down** to cents. Python `int` arithmetic only; never float.

### 8.3 Eligibility
Payable only if: file processing_status = `ready`, scan_status = `clean`, review decision = `accepted`, not an exact duplicate of any *previously accepted* file (`dataset_duplicates.kind = exact`), not an archive container. Near-duplicates are flagged for the reviewer, who decides.

### 8.4 Raw vs labeled
Dataset `data_class` ∈ {`raw`,`labeled`} declared by contributor, confirmable/changeable by reviewer at finalize. A file whose sha256 was already paid: earns **0**, except (HA-08, default ON) when the earlier payment was at the raw rate and the new dataset is `labeled` and the reviewer ticks "labeled upgrade" — then it earns `labeled_rate − rate_previously_paid` (never negative). The pricing rule versions in force at finalization are stored on `earning_records`.

### 8.5 Ledger (append-only, double-entry)
- `ledger_journals` (= spec's transaction header; table name `wallet_transactions` holds the **lines**). Each journal has unique `idempotency_key`, `kind`, `source_type`, `source_id`, `created_by`.
- `wallets`: one per user (`kind=user`) plus system wallets `system_dataset_purchases`, `system_annotation_labor`, `system_adjustments`, `system_payouts_settled`.
- Lines: `wallet_transactions(journal_id, wallet_id, bucket, amount_micros)`; buckets for user wallets: `pending`, `available`, `reserved`, `paid`; system wallets use bucket `main`. **Sum of lines per journal = 0** (deferred constraint trigger). UPDATE/DELETE on journals & lines blocked by trigger.
- Journal kinds and lines:
  | kind | lines |
  |---|---|
  | `dataset_earning` | user.available (or pending) +X ; system_dataset_purchases.main −X |
  | `annotation_reward` | user.available +X ; system_annotation_labor.main −X |
  | `earning_release` | user.pending −X ; user.available +X |
  | `payout_reserve` | user.available −X ; user.reserved +X |
  | `payout_release` (rejected/cancelled/failed) | user.reserved −X ; user.available +X |
  | `payout_settle` | user.reserved −X ; user.paid +X (the `paid` bucket is the cumulative record of money sent; `system_payouts_settled` is reserved for v2 cash accounting and unused in v1) |
  | `adjustment_credit` / `adjustment_debit` | user.available ±X ; system_adjustments.main ∓X |
  | `payout_reversal` (payment later found failed) | user.paid −X ; user.available +X |
- Balance = Σ lines per (wallet, bucket). `wallets` row holds cached balances updated in the same transaction; a reconciliation job (`finance.reconcile`, nightly) recomputes from lines and alerts on mismatch.
- Concurrency: every journal that touches a user wallet first does `SELECT … FROM wallets WHERE id=:id FOR UPDATE`. Available-balance check happens after the lock. Negative `available`/`reserved` is rejected (CHECK on cached columns).
- Idempotency keys: `dataset_review:{review_id}:earning`, `annotation_review:{review_id}:reward`, `payout:{payout_id}:reserve|release|settle|reversal`, `adjustment:{adjustment_id}`; client-supplied `Idempotency-Key` header on `POST /payouts` stored in `payout_requests.client_idempotency_key` (unique per user).

### 8.6 Displayed figures (contributor)
- **Estimated**: Σ bytes of processed, clean, non-duplicate files in datasets *not yet finalized* × current rate (not in ledger; label "estimate").
- **Pending**: ledger `pending` bucket. **Available**: `available`. **Reserved**: `reserved`. **Paid**: `paid`. **Adjustments**: Σ adjustment journals. **Approved earnings (lifetime)**: Σ dataset_earning + annotation_reward journals.

### 8.7 Payout rules
Requires: `payout.request`, contributor verification `approved`, account `active`, ≥ 1 payout method, amount multiple of 10,000 micros, min ≤ amount ≤ max, amount ≤ available, ≤ 1 open (`requested`/`approved`) payout at a time. Approval by admin ≠ recipient; amounts ≥ `payout_dual_approval_threshold_micros` (default 100,000,000 = $100) need 2 distinct approvers. Mark-paid requires: status `approved`, `payment_reference` (non-empty, unique per method), `paid_at`, optional proof file (stored private); the recorder ≠ recipient.

## 9. State machines

- **users.status**: `pending_email` → `active` → `suspended` ⇄ `active`; `active|suspended` → `deactivated` (self-delete request processed) → `anonymized`. Login allowed for `pending_email` (limited: only verify/resend/logout) and `active`.
- **contributor_verifications.status** (latest row = current): `pending` → `approved` | `rejected` | `needs_info` → (resubmit → `pending`). `users.verification_status` mirrors: `unverified|pending|approved|rejected|needs_info`.
- **upload_sessions.status**: `initiated` → `uploading` → `completed` | `aborted` | `expired`.
- **dataset_files.processing_status**: `pending_upload` → `uploaded` → `processing` → `ready` | `failed` | `quarantined`. `scan_status`: `pending|clean|infected|error|skipped_container`.
- **datasets.status**: `draft` → (`submit`, all files terminal & ≥1 `ready`) `submitted` → (`claim`) `in_review` → `approved` | `partially_approved` | `rejected` | `changes_requested`; `changes_requested` → (contributor edits, resubmits → new `dataset_versions` row) `submitted`; `draft|submitted|changes_requested` → `withdrawn` (by owner); any → `taken_down` (admin, with reason). Finalized states are terminal for earnings.
- **dataset_reviews.status**: `in_progress` → `finalized` (with `decision` ∈ approve|partial|reject|request_changes) | `released` (reviewer unclaimed).
- **annotation_tasks.status**: `unassigned` → `assigned` → `in_progress` → `submitted` → `in_review` → `approved` | `changes_requested` → (`in_progress` …); `assigned|in_progress` → `unassigned` (reassign); any non-approved → `cancelled` (project closed).
- **payout_requests.status**: `requested` → `approved` (→ needs 2nd approval keeps `requested` with `approvals_count`) → `paid`; `requested` → `rejected` | `cancelled` (by contributor); `approved` → `cancelled` (admin) | `failed`; `paid` → `reversed` (super_admin, payment later bounced).
- **export_jobs.status**: `queued` → `running` → `completed` | `failed`; `completed` → `expired`.
- **conversations.status**: `open` → `awaiting_user` ⇄ `open` → `closed` (reopen on new message by contributor).

Every transition writes an `audit_logs` row (actor, action, entity, before/after JSON diff, ip, request_id).

## 10. Database tables (PostgreSQL, UUID v7-style `uuid` PKs generated in app, `created_at`/`updated_at timestamptz`)

Identity: `users`, `user_profiles`, `roles`, `user_roles`, `user_sessions`, `email_verifications` (also used for password-reset tokens via `purpose`), `contributor_verifications`, `payout_methods`, `agreement_acceptances`, `security_events`, `mfa_recovery_codes`.
Datasets: `datasets`, `dataset_versions`, `dataset_files`, `dataset_metadata` (key/value per dataset, typed), `upload_sessions`, `upload_parts`(optional cache), `dataset_licenses`, `dataset_duplicates`, `file_previews`.
Review: `dataset_reviews`, `dataset_file_reviews`, `dataset_quality_scores`.
Finance: `pricing_rules`, `wallets`, `ledger_journals`, `wallet_transactions`, `earning_records`, `payout_requests`, `payout_approvals`, `payout_records`, `payout_adjustments`.
Annotation: `annotation_projects`, `annotation_project_datasets`, `annotation_tasks`, `annotation_assignments`, `annotations`, `annotation_versions`, `annotation_reviews`, `annotation_feedback`, `annotation_rewards`.
Communication: `conversations`, `conversation_participants`, `messages`, `message_attachments`, `notifications`, `email_outbox`.
Operations: `audit_logs`, `export_jobs`, `export_files`, `system_settings`, `background_job_records`, `takedown_requests`, `deletion_requests`.

Key constraints: `users.email` unique (citext, lower); `user_roles (user_id, role_id)` PK; `dataset_files (dataset_id, sha256)` index + global index on `sha256`; `dataset_file_reviews (review_id, file_id)` unique; `earning_records (source_type, source_id, file_id)` unique; `ledger_journals.idempotency_key` unique; `payout_requests (user_id, client_idempotency_key)` unique; partial unique index one open payout per user `WHERE status IN ('requested','approved')`; `payout_approvals (payout_id, approver_id)` unique; `payout_records.payout_id` unique; `annotation_assignments` partial unique one active assignment per task; `annotations (task_id)` unique with `version int` for optimistic locking; `annotation_rewards.annotation_review_id` unique; `pricing_rules (data_class, effective_from)` unique and non-overlapping (exclusion constraint).

## 11. Annotation model

Project fields: name, instructions (markdown), `annotation_types` ⊆ {`transcription`,`text_correction`,`classification`,`metadata`,`page_label`, (`bbox` reserved)}, `label_set` (classification labels), `metadata_schema` (list of {key,label,type: text|number|date|select,options,required}), `task_unit` ∈ {`file`,`page`}, `reward_per_task_micros`, `reward_per_page_micros`, `deadline`, `review_required` (always true v1), source datasets (approved/partially approved only, accepted files only, previewable+annotatable).

Annotation `data` JSON (validated by Pydantic): `{ "pages": [{"page": 1, "transcription": "...", "corrected_text": "...", "page_label": "...", "regions": [] }], "classification": ["label"], "metadata": {"key": value}, "notes": "..." }`. Transcription text is stored verbatim (no NFC normalisation, preserves Khmer COENG sequences and ZWSP); a separate `normalized` copy is produced at export.

Concurrency: `PUT /annotation/tasks/{id}/draft` requires `If-Match: <version>`; mismatch → 409 with server copy. Only the active assignee may write; autosave every 5 s of idle typing + on blur; each save inserts `annotation_versions` when content hash changes (draft versions compacted: keep last 50 drafts + all submitted).

## 12. API contract (prefix `/api/v1`; JSON; errors `{"error":{"code","message","details","request_id"}}`)

Pagination: `?page=1&page_size=25` (max 100) → `{"items":[…],"page","page_size","total"}`. Sorting `?sort=-created_at`. Filters are explicit query params. Unsafe methods need `X-CSRF-Token`. Financial POSTs accept `Idempotency-Key`.

- **Health**: `GET /healthz`, `GET /readyz`, `GET /metrics` (internal network only).
- **Auth**: `GET /auth/csrf`, `POST /auth/register`, `POST /auth/login` (→ `{mfa_required}` when admin w/ MFA), `POST /auth/mfa/verify`, `POST /auth/logout`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/change-password`, `GET /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `POST /auth/sessions/revoke-others`, `POST /auth/mfa/setup`, `POST /auth/mfa/enable`, `POST /auth/mfa/disable`.
- **Me**: `GET|PATCH /me/profile`, `POST /me/onboarding`, `GET|POST /me/payout-methods`, `DELETE /me/payout-methods/{id}`, `GET|POST /me/verification`, `POST /me/deletion-request`, `GET|PATCH /me/notification-preferences`.
- **Public**: `GET /public/pricing`, `GET /public/formats`, `POST /public/contact`.
- **Datasets (owner)**: `POST /datasets`, `GET /datasets`, `GET|PATCH|DELETE /datasets/{id}`, `POST /datasets/{id}/submit`, `POST /datasets/{id}/withdraw`, `GET /datasets/{id}/files`, `DELETE /datasets/{id}/files/{file_id}` (draft/changes_requested only), `GET /datasets/{id}/reviews`, `GET /datasets/{id}/estimate`.
- **Files**: `GET /files/{id}` (metadata + previews), `GET /files/{id}/preview/{page}` (302 → presigned, 5 min), `GET /files/{id}/text`, `POST /files/{id}/download-url` (presigned 5 min, `Content-Disposition: attachment`).
- **Uploads**: `POST /datasets/{id}/uploads` (init) → `{upload_id, part_size, part_count, expires_at}`; `POST /uploads/{id}/part-urls` `{part_numbers:[…]}` → presigned PUT URLs (15 min); `GET /uploads/{id}` → status + uploaded parts (from S3 ListParts); `POST /uploads/{id}/complete` `{parts:[{part_number,etag}]}`; `DELETE /uploads/{id}`.
- **Review**: `GET /reviews/queue`, `POST /datasets/{id}/claim-review`, `GET /reviews/{id}`, `PUT /reviews/{id}/files/{file_id}` `{decision: accepted|rejected, reason_code, comment, labeled_upgrade}`, `POST /reviews/{id}/files/bulk`, `PATCH /reviews/{id}` (checklist, quality scores, comments, data_class), `GET /reviews/{id}/summary`, `POST /reviews/{id}/finalize` `{decision, feedback}` (+`Idempotency-Key`), `POST /reviews/{id}/release`, `GET /reviews/history`.
- **Finance (user)**: `GET /wallet`, `GET /wallet/transactions`, `GET /earnings`, `POST /payouts`, `GET /payouts`, `GET /payouts/{id}`, `POST /payouts/{id}/cancel`.
- **Finance (admin)**: `GET /admin/finance/overview`, `GET /admin/payouts`, `GET /admin/payouts/{id}`, `POST /admin/payouts/{id}/approve`, `POST /admin/payouts/{id}/reject`, `POST /admin/payouts/{id}/mark-paid`, `POST /admin/payouts/{id}/mark-failed`, `POST /admin/payouts/{id}/cancel`, `POST /admin/payouts/{id}/reverse`, `POST /admin/payouts/{id}/proof` (upload proof), `POST /admin/adjustments`, `GET /admin/ledger`, `GET /pricing-rules` (admin), `POST /admin/pricing-rules` (super_admin), `GET /admin/finance/reconciliation`.
- **Annotation**: `GET|POST /annotation/projects`, `GET|PATCH /annotation/projects/{id}`, `POST /annotation/projects/{id}/generate-tasks`, `POST /annotation/projects/{id}/close`, `GET /annotation/projects/{id}/tasks`, `POST /annotation/tasks/{id}/assign` `{annotator_id}`, `POST /annotation/tasks/bulk-assign`, `POST /annotation/tasks/{id}/unassign`; annotator: `GET /annotation/my-tasks`, `GET /annotation/tasks/{id}`, `POST /annotation/tasks/{id}/start`, `PUT /annotation/tasks/{id}/draft`, `POST /annotation/tasks/{id}/submit`, `GET /annotation/tasks/{id}/versions`, `GET /annotation/my-rewards`; reviewer: `GET /annotation/review-queue`, `POST /annotation/tasks/{id}/claim-review`, `POST /annotation/tasks/{id}/review` `{decision: approve|request_changes, score, comments}`, `GET /annotation/reviews/history`.
- **Messaging**: `GET|POST /conversations`, `GET|PATCH /conversations/{id}`, `GET|POST /conversations/{id}/messages`, `POST /conversations/{id}/read`, `POST /conversations/{id}/attachments` (multipart ≤ 10 MB, scanned before visible), `GET /attachments/{id}/download-url`; `WS /api/v1/ws` (cookie auth; server events `message.created`, `notification.created`, `conversation.updated`).
- **Notifications**: `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.
- **Admin users**: `GET /admin/users`, `GET /admin/users/{id}`, `POST /admin/users/{id}/suspend`, `POST /admin/users/{id}/reactivate`, `PUT /admin/users/{id}/roles` (super_admin for admin roles), `POST /admin/users/{id}/revoke-sessions`, `GET /admin/verifications`, `POST /admin/verifications/{id}/decision`.
- **Admin datasets**: `GET /admin/datasets` (q, status, data_class, language, category, min_quality, owner, date range), `GET /admin/datasets/{id}`, `POST /admin/datasets/{id}/takedown`, `POST /admin/files/{id}/rescan`.
- **Exports**: `POST /admin/exports`, `GET /admin/exports`, `GET /admin/exports/{id}`, `POST /admin/exports/{id}/download-url`.
- **Admin misc**: `GET /admin/analytics/overview?from&to`, `GET /admin/audit-logs`, `GET /admin/security-events`, `GET /admin/settings`, `PUT /admin/settings/{key}`, `GET /admin/roles`.

## 13. Background jobs (Celery)

| Task | Queue | Trigger | Idempotency |
|---|---|---|---|
| `processing.process_file(file_id)` | processing | upload complete | status guard (`uploaded` → `processing`), retries ×3 backoff |
| `processing.expand_archive(file_id)` | processing | zip processed | member rows keyed `(parent_file_id, member_path)` unique |
| `processing.detect_duplicates(file_id)` | processing | after hash | upsert on `(file_id, matched_file_id, kind)` |
| `uploads.expire_sessions` | default | beat 15 min | aborts S3 multipart, status guard |
| `finance.release_pending` | default | beat hourly | journal idempotency key |
| `finance.reconcile` | default | beat nightly | read-only + alert |
| `messaging.send_email(outbox_id)` | email | outbox insert (transactional outbox) | outbox status |
| `exports.build_export(job_id)` | exports | admin request | status guard; rebuild overwrites same key |
| `exports.expire` / `retention.purge` | default | beat daily | status guards |

`background_job_records` stores task name, args hash, status, attempts, last_error for admin visibility.

## 14. Non-functional targets

p95 API latency < 300 ms (non-file endpoints, 200 concurrent users); upload success ≥ 99 % for files ≤ 4,000,000,000 bytes on resumable path; processing throughput ≥ 2 GB/min per worker for hashing/scanning; availability 99.5 % monthly; RPO 24 h (daily `pg_dump` + object storage protection), optional 15 min with WAL archiving; RTO 4 h; WCAG 2.2 AA.

## 15. Requirement ID scheme (used across all documents)

`BR-nn` business requirement (BRD) · `FR-<MOD>-nn` functional (SRS; MOD ∈ AUTH, USER, VER, DS, UPL, PROC, REV, FIN, PAY, ANN, MSG, NOTIF, EXP, ADM, AUD) · `NFR-<CAT>-nn` (PERF, AVL, ACC, INT, UPL, OBS) · `SEC-nn` · `US-<ROLE>-nn` (CON, ANN, REV, ADM, SUP) · `TC-<MOD>-nnn` test cases · `ADR-nnnn` · `HA-nn` approvals · `A-nn` assumptions · `R-nn` risks.

## 16. Amendments after wave-1 review (v1.1, 2026-10-26) — these override earlier sections

| # | Amendment | Resolves |
|---|---|---|
| AM-01 | **Per-file size limit = 4,000,000,000 bytes (4 GB decimal)** for every uploaded file and every extracted ZIP member, because clamd cannot scan a single stream ≥ 4 GiB. No windowed scanning; `scan_mode` does not exist. ZIP containers are hashed but not scanned (`scan_status=skipped_container`); every member is scanned individually. clamd configured with `StreamMaxLength 4000M`, `MaxScanSize 4000M`, `MaxFileSize 4000M`. Dataset limit stays 50 GB. | LLD 4 GB vs API docs 2 GB windows vs §7 5 GB |
| AM-02 | Earning hold: `earning_records.hold_until timestamptz NULL`; release journal key `earning_release:{earning_record_id}`. Annotation rewards follow the same hold rule. | SDD vs LLD key mismatch |
| AM-03 | Double-pay DB guard: `earning_records.content_sha256 char(64)`, `pricing_tier varchar(32)` ∈ {`raw`,`labeled`,`labeled_upgrade`}; partial unique index `(content_sha256, pricing_tier) WHERE amount_micros > 0`. Finalize takes `pg_advisory_xact_lock(hashtext(content_sha256))` per file (sorted order) before eligibility recheck. | Policy + LLD |
| AM-04 | New endpoints: `GET /admin/takedown-requests`, `POST /admin/takedown-requests/{id}/decision`, `POST /public/takedown-requests` (rights holders, no login, rate-limited). | Takedown workflow had no API |
| AM-05 | Extra list filters: `role` on `/admin/users`; `user_id` on `/admin/payouts`; `entity_type`,`entity_id`,`actor_id` on `/admin/audit-logs`; any `status` filter accepts comma-separated values. | UI needs |
| AM-06 | Setting `maintenance_mode` (bool): when true every non-admin API call returns 503 `service_unavailable` with `details.reason="maintenance"`; `/healthz`, `/readyz`, `/auth/*`, `/admin/*` still work. | Page 64 |
| AM-07 | Dataset human code `DS-YYYY-NNNNNN` (sequence per year via `dataset_code_counters`), shown in UI everywhere; URLs use UUID. Payout code `PO-YYYY-NNNNNN`, export code `EX-YYYY-NNNNNN` same scheme. | UI short ref vs dataset doc |
| AM-08 | Sessions: user idle 7 days / absolute 30 days; admin-role sessions idle **30 minutes** / absolute **12 hours**; step-up MFA window for finance actions 15 minutes. Login lockout 5 failures / 15 min → 15 min lock. Passwords 12–128 chars. | SRS vs AUTH doc |
| AM-09 | Additional schema items adopted: `annotation_reviews.review_kind` (`primary`,`qa`) and status `cancelled`; `dataset_code_counters`; settings `review_max_active_claims` (default 5), `annotation_qa_sample_rate` (0.10), `maintenance_mode`, `legal_docs_approved` (false); `user_profiles.privacy_trained bool`; `legal_hold bool` + `legal_hold_reason` on `datasets`, `users`. | Data/annotation docs |
| AM-10 | New beat job `admin.requeue_stalled` (every 5 min) re-enqueues outbox rows `pending` > 2 min, files `uploaded` > 5 min, exports `queued` > 5 min. | SDD §8 |
| AM-11 | Rejection reason codes, category codes, source types, licence codes, page labels: as defined in `05-data-annotation/DATA_QUALITY_REVIEW.md` and `DATASET_DOCUMENTATION.md` (canonical lists). | Enum source of truth |
| AM-12 | Risk IDs: `RISK_REGISTER.md` is the only R-xx namespace. BRD business risks are renumbered `BRISK-xx` and cross-referenced to R-xx; roadmap delivery risks stay `DR-xx` and are appended to the register. | ID collision |
| AM-13 | Object storage backups: R2 has no versioning → nightly `rclone sync` of the private bucket to a separate backup bucket/provider with 30-day retention of deleted objects; on AWS S3 enable versioning + lifecycle instead. | Backup docs |
| AM-14 | Registration returns 202 for any email (no account enumeration) and does not log the user in. | API docs |
