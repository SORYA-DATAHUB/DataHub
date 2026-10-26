# DataHub — Software Requirements Specification (SRS)

## Document control

| Field | Value |
|---|---|
| Document | SRS: Software Requirements Specification (mandatory doc #3) |
| Version | 1.1 (baseline §16 amendments AM-01…AM-14 applied; new IDs appended, none renumbered) |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | Business Analyst / Solution Architect |
| Approvers | CTO role; Product Manager |
| Canonical source | [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) (wins on conflict until amended via `DECISION_LOG.md`) |

## Header block

**Purpose.** This is the **canonical, uniquely numbered requirement catalogue** for DataHub v1. Every design document, user story (`US-…`), test case (`TC-<MOD>-nnn`) and the traceability matrix cite requirements by the IDs defined here. IDs are stable: a retired requirement keeps its ID and is marked *Retired*, and its number is never reused.

**Scope.** All software behaviour of DataHub v1 (MVP): identity, users, verification, datasets, uploads, processing, review, finance, payouts, annotation, messaging, notifications, exports, administration and audit. It also covers non-functional, security, error-handling, constraint, external-interface and acceptance requirements. Future features (buyer marketplace, bbox, audio, automatic payouts) are excluded except where v1 must reserve extensibility.

**Assumptions.** A-01 … A-15 from the baseline apply in full. The most load-bearing here are A-03 (scale), A-04 (micro-USD), A-06 (min/max withdrawal), A-07 (hold days), A-08 (verification gates), A-09 (upload prerequisites), A-10 (fail-closed scanning), A-11 (no LibreOffice), A-13 (UTC) and A-15 (retention).

**Decisions.** This SRS fixes the following defaults, which the baseline left open. They are recorded here as canonical and must be mirrored in AUTH_AUTHORIZATION.md, API_DOCUMENTATION.md and openapi.yaml:
- Session lifetimes: idle 7 days / absolute 30 days for non-admin sessions; idle 30 min / absolute 12 h for sessions of users holding `admin` or `super_admin`.
- Token validity: email verification 24 h; password reset 1 h; both single-use.
- Login lockout: 5 failures per account in 15 min locks login for 15 min.
- Password policy: 12–128 characters, rejected if in the bundled common-password list.
- Annotation project lifecycle `draft → active → closed`.
- Review/annotation score scale 1–5.
- The error-code catalogue in §9.
- Export parts ≤ 4 GB (4,000,000,000 bytes) each.

**Dependencies.** BRD.md (BR-01 … BR-34), PRD.md, ENGINEERING_BASELINE.md §§1–15. Consumers: USER_STORIES.md, PRICING_PAYOUT_POLICY.md, SAD/HLD/LLD/SDD, DATABASE_SCHEMA.md, API_DOCUMENTATION.md, openapi.yaml, AUTH_AUTHORIZATION.md, FILE_UPLOAD_STORAGE.md, DATA_QUALITY_REVIEW.md, TEST_PLAN.md, TEST_CASES.md, SECURITY_REQUIREMENTS.md, REQUIREMENTS_TRACEABILITY.md.

**Acceptance criteria for this document.**
1. Every requirement has a unique ID in the baseline scheme (§15 of the baseline), a "shall" statement, a priority, a source (BR-nn and/or baseline section) and a verification method.
2. Requirements are testable: they name states, endpoints, limits and numbers taken from the baseline.
3. The counts in §2 match the catalogue (checked by script before the baseline is frozen).
4. No contradiction with ENGINEERING_BASELINE.md (states, endpoints, roles, limits, money units).
5. Each BR-nn is covered by at least one requirement (§13).

---

## 1. Introduction

### 1.1 Conventions
- **ID scheme:** `FR-<MOD>-nn` functional; `NFR-<CAT>-nn` non-functional; `SEC-nn` security. In this document `NFR-INT` means *Integrity*: data integrity, API contract and error handling.
- **Priority (MoSCoW):** **M** Must (MVP release blocker), **S** Should (MVP target, may slip to v1.1 only with PM + CTO sign-off), **C** Could (nice to have).
- **Verification:** **T** Test (automated unit/integration/API/E2E), **I** Inspection (code/config/document review), **D** Demonstration (manual walkthrough on staging).
- **Source:** BR-nn (BRD.md) and/or `BL §n` (ENGINEERING_BASELINE.md section).
- All endpoint paths are relative to `/api/v1`. "Error `x`" means a response using the envelope in §9 with `error.code = "x"`.
- Money is integer **micro-USD** (`*_micros`, 1 USD = 1,000,000). "GB" means 10⁹ bytes.

### 1.2 Definitions
| Term | Meaning |
|---|---|
| Accepted file | `dataset_file_reviews.decision = accepted` in a finalized review. |
| Eligible file | Satisfies BL §8.3: processing_status `ready`, scan_status `clean`, accepted, not an exact duplicate of a previously accepted file, not an archive container. |
| Terminal file status | `ready`, `failed` or `quarantined`. |
| Open payout | `payout_requests.status ∈ {requested, approved}`. |
| Verified contributor | `users.verification_status = approved`. |
| Admin session | Session of a user holding `admin` or `super_admin`. It is MFA-verified when `user_sessions.mfa_verified_at IS NOT NULL`. |

## 2. Requirement summary

| Group | Module / category | ID range | Count |
|---|---|---|---:|
| Functional | AUTH: authentication & sessions | FR-AUTH-01 … FR-AUTH-14 | 14 |
| Functional | USER: profile, onboarding, payout methods, deletion | FR-USER-01 … FR-USER-08 | 8 |
| Functional | VER: contributor verification | FR-VER-01 … FR-VER-07 | 7 |
| Functional | DS: datasets & file access | FR-DS-01 … FR-DS-14 | 14 |
| Functional | UPL: uploads | FR-UPL-01 … FR-UPL-12 | 12 |
| Functional | PROC: processing | FR-PROC-01 … FR-PROC-13 | 13 |
| Functional | REV: dataset review | FR-REV-01 … FR-REV-15 | 15 |
| Functional | FIN: pricing, earnings, ledger | FR-FIN-01 … FR-FIN-16 | 16 |
| Functional | PAY: payouts | FR-PAY-01 … FR-PAY-14 | 14 |
| Functional | ANN: annotation | FR-ANN-01 … FR-ANN-20 | 20 |
| Functional | MSG: messaging | FR-MSG-01 … FR-MSG-08 | 8 |
| Functional | NOTIF: notifications & email | FR-NOTIF-01 … FR-NOTIF-06 | 6 |
| Functional | EXP: exports | FR-EXP-01 … FR-EXP-07 | 7 |
| Functional | ADM: administration | FR-ADM-01 … FR-ADM-20 | 20 |
| Functional | AUD: audit & security logging | FR-AUD-01 … FR-AUD-05 | 5 |
| Non-functional | PERF: performance | NFR-PERF-01 … NFR-PERF-06 | 6 |
| Non-functional | AVL: availability & recovery | NFR-AVL-01 … NFR-AVL-05 | 5 |
| Non-functional | ACC: accessibility & i18n | NFR-ACC-01 … NFR-ACC-07 | 7 |
| Non-functional | INT: data integrity & error handling | NFR-INT-01 … NFR-INT-10 | 10 |
| Non-functional | UPL: upload reliability | NFR-UPL-01 … NFR-UPL-05 | 5 |
| Non-functional | OBS: observability | NFR-OBS-01 … NFR-OBS-05 | 5 |
| Security | SEC | SEC-01 … SEC-22 | 22 |
| **Total** | | | **239** |

## 3. Overall description

### 3.1 Product perspective
DataHub is a modular-monolith web application. A Next.js 15 front end on port 3410 in dev talks to a FastAPI back end on 8410 in dev, which is backed by PostgreSQL 17, Redis 8, S3-compatible private object storage, Celery workers, ClamAV and SMTP (BL §3, §5). Browsers upload file bytes directly to object storage using presigned multipart URLs. File bytes never pass through the API process.

### 3.2 User classes
`contributor` (every registered user), `annotator`, `reviewer`, `admin`, `super_admin`, plus anonymous visitors. A user may hold several roles. The authoritative permission matrix is **BL §6**, and this SRS refers to permission codes from that matrix (e.g. `payout.approve`).

### 3.3 Operating environment
Evergreen browsers (latest two versions of Chrome, Edge, Firefox and Safari; Chrome for Android; iOS Safari), at viewport widths ≥ 360 px. The annotation editor and review workspace are optimised for ≥ 1280 px. Servers are Linux containers (Docker Compose in dev, single-host or small-cluster containers in prod; no Kubernetes in v1).

### 3.4 Design and implementation constraints
See §10.

## 4. Functional requirements

### 4.1 FR-AUTH: authentication and sessions

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-AUTH-01 | `POST /auth/register` shall accept `email`, `password`, `display_name` and acceptance of the current Terms of Service and Privacy Policy versions. It shall create a `users` row with status `pending_email`, assign role `contributor`, create the user wallet and send a verification email. If the email is already registered, the system shall return the same `202` response and send an "account already exists" email instead, so that accounts cannot be enumerated. | M | BR-01; BL §9 | T |
| FR-AUTH-02 | Passwords shall be 12–128 characters, shall not equal the email address and shall not appear in the bundled list of the 100,000 most common passwords. Violations return `422 validation_error` with a field-level detail. | M | BR-30 | T |
| FR-AUTH-03 | Email-verification tokens shall be 256-bit random values, stored only as SHA-256 hashes in `email_verifications` (`purpose = verify_email`), valid for 24 h and single-use. A successful `POST /auth/verify-email` shall set `users.status = active` and `email_verified_at`, and shall emit the "email verified" notification. | M | BR-01 | T |
| FR-AUTH-04 | `POST /auth/resend-verification` shall invalidate earlier unused verification tokens and shall be limited to 3 requests per hour per account (`429 rate_limited` beyond that). | M | BR-01 | T |
| FR-AUTH-05 | `POST /auth/login` with valid credentials shall create a `user_sessions` row and set the `dh_session` cookie (BL §3). Users in `pending_email` receive a limited session that may only call `GET /auth/me`, verify/resend endpoints and `POST /auth/logout` (other calls: `403 email_not_verified`). `suspended` users receive `403 account_suspended`. `deactivated`/`anonymized` users receive `401 invalid_credentials`. | M | BR-01, BR-03 | T |
| FR-AUTH-06 | Unknown email and wrong password shall both return `401 invalid_credentials` with no observable timing difference beyond 50 ms at p95. A dummy Argon2id verification is run for unknown emails. | M | BR-30 | T |
| FR-AUTH-07 | After 5 consecutive failed logins for one account within 15 min, login for that account shall be locked for 15 min (`429 login_locked`, `Retry-After` header) and a `security_events` row written. A successful login resets the counter. | M | BR-30 | T |
| FR-AUTH-08 | For a user holding `admin` or `super_admin`, a correct password shall return `{"mfa_required": true}` and create a session with `mfa_verified_at = NULL`. `POST /auth/mfa/verify` with a valid TOTP code (30 s step, ±1 step tolerance, no reuse of a code within its window) or an unused recovery code shall set `mfa_verified_at`. Five failed MFA attempts on one session shall revoke that session. | M | BR-30; BL §3, §6 | T |
| FR-AUTH-09 | `POST /auth/mfa/setup` shall return an otpauth URI and secret. The secret is stored encrypted (SEC-14). `POST /auth/mfa/enable` shall require a valid code and return 10 single-use recovery codes, stored hashed in `mfa_recovery_codes`. `POST /auth/mfa/disable` shall require the current password and a valid code. It shall be refused (`409 mfa_required_for_role`) for admin/super_admin while `ADMIN_MFA_REQUIRED = true`. | M | BR-30 | T |
| FR-AUTH-10 | Sessions shall expire after 7 days idle / 30 days absolute for non-admin sessions, and after 30 min idle / 12 h absolute for admin sessions. `last_seen_at` is updated at most once per minute. Expired sessions return `401 session_expired`. | M | BR-30 | T |
| FR-AUTH-11 | `POST /auth/logout` shall revoke the current session and clear `dh_session` and `dh_csrf`. `GET /auth/sessions` shall list the user's active sessions (created_at, last_seen_at, IP, user-agent summary, `current` flag). `DELETE /auth/sessions/{id}` and `POST /auth/sessions/revoke-others` shall revoke the selected or all other sessions. | M | BR-30 | T |
| FR-AUTH-12 | `POST /auth/forgot-password` shall always return `202`. When the account exists and is not anonymized, it sends a reset link whose token is valid for 1 h and single-use. Requests are limited to 3 per hour per email. `POST /auth/reset-password` shall set the new password (FR-AUTH-02 rules), revoke **all** sessions of the user, record a security event and send a "password changed" email. | M | BR-30 | T |
| FR-AUTH-13 | `POST /auth/change-password` shall require the current password, apply FR-AUTH-02, revoke all other sessions and send a "password changed" email. | M | BR-30 | T |
| FR-AUTH-14 | `GET /auth/me` shall return the user id, email, display name, status, roles, effective permission codes, `verification_status`, `onboarding_completed`, MFA enrolment and MFA-verified state of the current session. | M | BR-04 | T |

### 4.2 FR-USER: profile, onboarding, payout methods, account lifecycle

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-USER-01 | `GET/PATCH /me/profile` shall let a user read and update `display_name` (2–80 chars), `legal_name` (≤ 200), `phone` (E.164), `country` (ISO 3166-1 alpha-2), `date_of_birth` and `preferred_language` (`en` or `km`). Text is stored NFC-normalised (BL A-02). | M | BR-01 | T |
| FR-USER-02 | `POST /me/onboarding` shall record acceptance of the current Contributor Agreement version and the rights declaration in `agreement_acceptances` (document type, version, accepted_at, IP, user agent), and shall set `onboarding_completed_at`. Dataset creation and upload endpoints shall return `403 onboarding_required` until email is verified and onboarding is completed. | M | BR-01; A-09 | T |
| FR-USER-03 | When super_admin publishes a new `contributor_agreement_version` (system setting), users whose latest acceptance is older shall be required to re-accept before `POST /datasets`, upload initiation or `POST /datasets/{id}/submit` (`403 agreement_outdated`). Existing datasets and balances are unaffected. | M | BR-01; HA-01 | T |
| FR-USER-04 | `GET/POST /me/payout-methods` shall manage up to 5 payout methods of type `bank_transfer` (bank name, account name, account number), `aba_pay` (account name, account number or phone), `wise` (account holder, email or account details), `paypal` (email) or `other` (free text ≤ 500 chars). Exactly one may be marked default. `DELETE /me/payout-methods/{id}` shall be refused with `409 payout_method_in_use` while an open payout references it. | M | BR-15; A-05 | T |
| FR-USER-05 | Adding or deleting a payout method shall send an email alert to the account email and write a security event. For 24 h after a method is added, any payout to that method shall carry the flag `new_payout_method` shown to approving admins. | S | BR-16 | T |
| FR-USER-06 | `GET/PATCH /me/notification-preferences` shall let users switch e-mail delivery on or off per category (`datasets`, `annotation`, `messages`, `product_updates`). Categories `security`, `account` and `financial` cannot be disabled. | M | BR-23 | T |
| FR-USER-07 | `POST /me/deletion-request` shall create a `deletion_requests` row and is refused with `409 open_payout_exists` while an open payout exists. When an admin processes it, the user becomes `deactivated` with all sessions revoked. After processing, PII (email, names, phone, DOB, payout details, ID documents) is replaced or erased (`anonymized`), while ledger, earning, payout and audit records are retained for 7 years (A-15). | M | BR-28; A-15; HA-03 | T |
| FR-USER-08 | Changing `legal_name`, `date_of_birth` or `country` while `verification_status = approved` shall reset `verification_status` to `pending` and create a new verification row for admin re-review. | S | BR-02, BR-16 | T |

### 4.3 FR-VER: contributor verification (eligibility review)

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-VER-01 | `POST /me/verification` shall accept legal name, country, date of birth, phone, a reference to one of the user's payout methods and an optional ID document (JPEG, PNG or PDF, ≤ 10 MB, malware-scanned before admins can view it). It creates a `contributor_verifications` row with status `pending` and sets `users.verification_status = pending`. Preconditions: active account, onboarding completed, ≥ 1 payout method; otherwise `422 verification_prerequisites`. | M | BR-02; A-08 | T |
| FR-VER-02 | Submissions where the applicant is under 18 years on the submission date shall be rejected with `422 underage`. | M | BR-02; A-08 | T |
| FR-VER-03 | `GET /admin/verifications` (`user.verify`) shall list verifications filtered by status, oldest first, with submitted data and duplicate-identity hints (same phone or legal name + DOB as another account). | M | BR-02 | T |
| FR-VER-04 | `POST /admin/verifications/{id}/decision` shall accept `approved`, `rejected` or `needs_info`. A reason (≥ 10 chars) is required for `rejected`/`needs_info`. The decision shall be mirrored to `users.verification_status` and shall send an in-app notification and email ("contributor approved" or the outcome). An admin cannot decide their own verification (`403 self_action_forbidden`). | M | BR-02 | T |
| FR-VER-05 | After `needs_info` or `rejected`, the user may resubmit, which creates a new row with `pending`. The latest row is current and earlier rows remain visible to admins as history. | M | BR-02; BL §9 | T |
| FR-VER-06 | Only verified contributors may request payouts (FR-PAY-01) or be assigned annotation tasks (FR-ANN-07). Uploads do not require verification. | M | BR-02; A-08 | T |
| FR-VER-07 | ID documents shall be viewable only by holders of `user.verify`, via 5-minute presigned URLs. Each view shall be audit-logged (FR-AUD-04). | M | BR-07, BR-30 | T |

### 4.4 FR-DS: datasets and file access

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-DS-01 | `POST /datasets` (`dataset.create`) shall create a dataset in status `draft` with: `title` (3–200 chars), `description` (≤ 5,000), `languages` (≥ 1 ISO 639-1 code; `km` and `en` offered first), `category` (from the `dataset_categories` setting), `data_class` (`raw`/`labeled`), `source_provenance` (≤ 2,000), `license_code` (from `dataset_licenses`), `contains_personal_data` (bool), and `tags` (≤ 20, each ≤ 40 chars). | M | BR-08 | T |
| FR-DS-02 | `GET /datasets` shall list only datasets owned by the caller, paginated (BL §12), filterable by `status` and `data_class`, sortable by `created_at`, `updated_at` and `title`. | M | BR-07 | T |
| FR-DS-03 | `GET /datasets/{id}` shall return metadata, status, current version, file counts per processing status, total and ready bytes, the estimate (FR-DS-10) and the latest finalized review summary. It is available only to the owner and holders of `dataset.read.any`. Any other caller receives `404 not_found`. | M | BR-07 | T |
| FR-DS-04 | `PATCH /datasets/{id}` and `DELETE /datasets/{id}/files/{file_id}` shall be allowed only when the dataset status is `draft` or `changes_requested`. Otherwise the response is `409 invalid_state`. | M | BR-09; BL §9 | T |
| FR-DS-05 | `DELETE /datasets/{id}` shall be allowed only for a `draft` that has never been submitted. It soft-deletes the dataset and schedules its objects for purge after 30 days (A-15). | M | BR-28 | T |
| FR-DS-06 | `GET /datasets/{id}/files` shall list files with original name, relative path, size, detected MIME, `processing_status`, `scan_status`, failure reason, SHA-256, page count, duplicate flags and (after review) the decision and reason code. | M | BR-05, BR-10 | T |
| FR-DS-07 | A dataset shall contain ≤ 2,000 directly uploaded files (archive members excluded) and ≤ 50 GB (`max_dataset_bytes`). The sum of a user's bytes in datasets with status `draft`, `submitted`, `in_review` or `changes_requested` shall not exceed 200 GB (`user_pending_quota_bytes`). Limits are enforced at upload initiation (FR-UPL-02). | M | BR-05; BL §7 | T |
| FR-DS-08 | `POST /datasets/{id}/submit` shall succeed only when status is `draft` or `changes_requested`, every file is in a terminal status, ≥ 1 file is `ready`, required metadata is present, and the caller confirms the per-dataset rights declaration (and data-subject consent when `contains_personal_data = true`). It shall set status `submitted`, insert an immutable `dataset_versions` row (version n+1, snapshot of metadata and file ids) and emit "dataset received". Failures return `409 invalid_state` or `422 submit_preconditions_failed` with details listing the unmet conditions. | M | BR-08, BR-09; BL §9 | T |
| FR-DS-09 | `POST /datasets/{id}/withdraw` shall move a `draft`, `submitted` or `changes_requested` dataset to `withdrawn`. It is refused with `409 invalid_state` while `in_review` or after finalization. | M | BL §9 | T |
| FR-DS-10 | `GET /datasets/{id}/estimate` shall return Σ bytes of files that are `ready`, `clean`, not exact duplicates of previously accepted files and not containers, multiplied by the current rate for the dataset's `data_class` and floored per file (BL §8.2, §8.6). It is labelled `estimate: true` and is never written to the ledger. | M | BR-11, BR-14 | T |
| FR-DS-11 | `GET /datasets/{id}/reviews` shall show the owner each finalized review: decision, per-file decision with reason code and comment, quality scores, feedback, accepted and rejected bytes, payable micros and the pricing rule applied. The reviewer is shown as "DataHub reviewer", not by name. | M | BR-10 | T |
| FR-DS-12 | `POST /admin/datasets/{id}/takedown` (admin or super_admin) with a mandatory reason shall set status `taken_down` from any status. It blocks non-admin access to its files, cancels non-approved annotation tasks sourced from it, excludes it from new projects and exports, and notifies the owner. Earnings already posted are not reversed automatically. Corrections use FR-FIN-12. | M | BR-28 | T |
| FR-DS-13 | File endpoints (`GET /files/{id}`, `GET /files/{id}/preview/{page}`, `GET /files/{id}/text`, `POST /files/{id}/download-url`) shall be authorised for: the dataset owner (not after `taken_down`); admins; the reviewer assigned to an `in_progress` review of that dataset version (read-only access persists for that reviewer's finalized reviews); and an annotator with an active assignment on a task that references the file. Everyone else receives `404 not_found`. | M | BR-07; BL §6 | T |
| FR-DS-14 | Preview and download URLs shall be presigned GETs valid for 5 minutes. Download URLs force `Content-Disposition: attachment` with the sanitised original filename. | M | BR-06, BR-07 | T |

### 4.5 FR-UPL: uploads

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-UPL-01 | `POST /datasets/{id}/uploads` with `filename`, `size_bytes`, `relative_path` (optional) and `content_type` (advisory) shall, for an owned dataset in `draft` or `changes_requested`, create an S3 multipart upload and an `upload_sessions` row (`initiated`). It returns `upload_id`, `part_size` (16 MiB, raised in whole MiB so that `part_count ≤ 10,000`), `part_count` and `expires_at` (now + 24 h). | M | BR-05; BL §7, §12 | T |
| FR-UPL-02 | Initiation shall reject: `size_bytes > max_file_bytes` (4,000,000,000 bytes — AM-01) with `413 file_too_large`; an extension not in BL §7 and not in `extra_allowed_extensions` with `422 unsupported_type`; a dataset byte/file-count limit breach with `422 dataset_limit_exceeded`; a pending-quota breach with `422 quota_exceeded`; a filename longer than 255 chars after NFC normalisation with `422 validation_error`; and more than 20 non-terminal upload sessions for the user with `429 too_many_uploads`. | M | BR-05; BL §7 | T |
| FR-UPL-03 | `POST /uploads/{id}/part-urls` with ≤ 100 part numbers shall return presigned PUT URLs valid for 15 minutes and set the session to `uploading`. Only the session owner may call it. | M | BR-05 | T |
| FR-UPL-04 | `GET /uploads/{id}` shall return session status and the list of parts already stored (from S3 `ListParts`), which is the source of truth for resuming. | M | BR-05 | T |
| FR-UPL-05 | `POST /uploads/{id}/complete` shall verify that the submitted part list matches `ListParts` (numbers and ETags) and that the stored size equals `size_bytes`, then complete the multipart upload. It creates a `dataset_files` row with `processing_status = uploaded`, marks the session `completed` and enqueues `processing.process_file`. On mismatch it returns `422 upload_incomplete` and lists the missing parts. Repeating the call on a completed session returns the same file id. | M | BR-05; BL §13 | T |
| FR-UPL-06 | `DELETE /uploads/{id}` shall abort the multipart upload and set status `aborted`. | M | BR-05 | T |
| FR-UPL-07 | Beat task `uploads.expire_sessions` (every 15 min) shall set sessions past `expires_at` that are not `completed` to `expired` and abort their multipart uploads in storage. | M | BR-05; A-15 | T |
| FR-UPL-08 | Object keys shall be generated by the server from UUIDs only. User-supplied filenames and paths are stored solely as metadata (`original_filename`, `relative_path`) and never appear in keys. | M | BR-06 | I/T |
| FR-UPL-09 | The upload UI shall support selecting multiple files, folders (where the browser supports directory selection, preserving relative paths) and drag-and-drop. It shall show per-file progress, overall progress, current speed and ETA, and a completion confirmation. | M | BR-05 | D/T |
| FR-UPL-10 | The client shall upload up to 4 parts concurrently per file and 3 files concurrently. It retries each failed part up to 5 times with exponential backoff (1, 2, 4, 8, 16 s), then marks the file "failed – retry" with a Retry action that resumes from missing parts. | M | BR-05 | T |
| FR-UPL-11 | The client shall persist `{upload_id, name, size, lastModified}` in IndexedDB. After a reload or reconnect it shall offer to resume. Once the user re-selects the same file (matched on name, size and lastModified), only missing parts are uploaded. | M | BR-05 | T |
| FR-UPL-12 | The user shall be able to cancel one file or all in-flight uploads. Cancelling calls `DELETE /uploads/{id}` and removes the file from the list. | M | BR-05 | T |

### 4.6 FR-PROC: file processing (worker)

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-PROC-01 | `processing.process_file(file_id)` shall move a file `uploaded → processing` under a status guard. Steps: stream the object, compute SHA-256, detect type, scan, extract metadata, generate previews, detect duplicates. On transient errors it retries up to 3 times with exponential backoff. After final failure it sets `failed` (`processing_error`) and records `background_job_records.last_error`. | M | BR-06; BL §13 | T |
| FR-PROC-02 | Type detection shall use libmagic on file content. If the detected MIME family does not match the extension per BL §7, the file is set `failed` with reason `type_mismatch`. Executables, scripts, HTML, SVG, macro-enabled Office (docm, xlsm, pptm) and unsupported archives are set `failed` with `disallowed_type`. | M | BR-06; BL §7 | T |
| FR-PROC-03 | Every non-container file shall be scanned with ClamAV (clamd INSTREAM). `infected` sets `processing_status = quarantined`, makes the object inaccessible to every role except super_admin via audit-logged access, writes a security event and notifies the owner. A scan `error` after 3 retries sets `scan_status = error` and `processing_status = failed` (`scan_error`). A file that is not `clean` shall never become `ready` (fail-closed, A-10). | M | BR-06; A-10 | T |
| FR-PROC-04 | `POST /admin/files/{id}/rescan` (admin) shall re-run scanning for files in `failed` with `scan_error`. On a clean result the file proceeds to `ready`. | M | BR-06 | T |
| FR-PROC-05 | `processing.expand_archive(file_id)` shall expand ZIP containers by streaming each member to a new private object and creating a child `dataset_files` row keyed uniquely by `(parent_file_id, member_path)`, which is then processed as a normal file. The container gets `scan_status = skipped_container`, is never payable and its members do not count toward the 2,000-file limit. | M | BR-05, BR-12; BL §7 | T |
| FR-PROC-06 | Archive limits shall be enforced: ≤ 10,000 members, total uncompressed ≤ 20 GB, per-member compression ratio ≤ 100:1, depth ≤ 1. If a limit is breached, expansion stops, any member objects already created are deleted and the container is set `failed` (`archive_limits_exceeded`). Nested archives become members with `failed` (`nested_archive`). Encrypted members become `failed` (`encrypted_archive`). | M | BR-06; BL §7 | T |
| FR-PROC-07 | Member names shall be sanitised. Absolute paths, `..` segments, symlinks, device and special files are not extracted and are logged as `unsafe_member`. Members are never written to a local executable path and never executed. | M | BR-06 | T |
| FR-PROC-08 | Previews shall be generated per BL §7. PDF: page images for up to 500 pages, long edge ≤ 2,000 px. Images: WebP derivative ≤ 4,096 px. TIFF: each page. DOCX/ODT/RTF/TXT: extracted text (first 1 MB). CSV/XLSX: first 200 rows of the first sheet. JSON/JSONL/XML: text (first 1 MB, XML parsed with defusedxml). ZIP: member list. DOC: no preview. Preview records are stored in `file_previews`. | M | BR-06; A-11 | T |
| FR-PROC-09 | Preview generation shall run with a 300 s per-file timeout, an image pixel limit of 200 megapixels and a memory limit set per worker container. If any of these is exceeded, the file is still `ready` (payable if accepted) with `preview_status = unavailable`. | M | BR-06 | T |
| FR-PROC-10 | For text-bearing files, processing shall record `page_count` where applicable, character count and `khmer_ratio`: the share of letters in Unicode blocks U+1780–U+17FF and U+19E0–U+19FF among letters in extracted text. | S | BR-29 | T |
| FR-PROC-11 | `processing.detect_duplicates(file_id)` shall upsert `dataset_duplicates` rows `(file_id, matched_file_id, kind = exact)` for every other file with the same SHA-256. It distinguishes matches against previously accepted files (which make the file ineligible, FR-FIN-05), against files in the same dataset, and against files in other non-finalized datasets (flags only). | M | BR-12; BL §8.3 | T |
| FR-PROC-12 | The system shall flag probable near-duplicates (`kind = near`) with a similarity score, using the method specified in FILE_UPLOAD_STORAGE.md. Near-duplicate flags shall never by themselves block acceptance or payment. | S | BR-12 | T |
| FR-PROC-13 | When every file of a dataset has reached a terminal status, the owner shall receive a "processing finished" notification with counts of ready, failed and quarantined files. Re-running any processing task for the same file shall not create duplicate rows or notifications. | M | BR-23; BL §13 | T |

### 4.7 FR-REV: dataset review

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-REV-01 | `GET /reviews/queue` (`dataset.review`) shall list `submitted` datasets oldest-first with size, file counts, data class, languages, duplicate counts and owner verification status. It shall exclude datasets owned by the caller. The queue shows metadata only. File content becomes available after claim (FR-DS-13). | M | BR-09; BL §6 | T |
| FR-REV-02 | `POST /datasets/{id}/claim-review` shall atomically move `submitted → in_review` and create a `dataset_reviews` row (`in_progress`, assignee = caller, version = current). Of concurrent claims exactly one succeeds and the others receive `409 already_claimed`. Claiming one's own dataset returns `403 self_review_forbidden`. | M | BR-09; BL §6, §9 | T |
| FR-REV-03 | `GET /reviews/{id}` (assignee or admin) shall return the review workspace data: dataset metadata and version, files with previews, processing/scan status, duplicate warnings with links to matched files, checklist, scores, comments, and all previous reviews of the dataset. | M | BR-09 | T |
| FR-REV-04 | `PUT /reviews/{id}/files/{file_id}` with `{decision: accepted\|rejected, reason_code, comment, labeled_upgrade}` shall record a per-file decision in an `in_progress` review. Rules: `reason_code` is required for `rejected`; `comment` (≤ 2,000 chars) is required when the reason is `other`; `accepted` is allowed only for `ready` files (`422 file_not_eligible`); `labeled_upgrade` may be true only when the dataset is `labeled` and the file has a previous raw-rate payment. | M | BR-09, BR-13 | T |
| FR-REV-05 | `POST /reviews/{id}/files/bulk` shall apply one decision, reason and comment to up to 2,000 listed files in one transaction, under the same rules as FR-REV-04. If any file violates a rule, the whole batch is rejected with per-file details. | M | BR-09, BR-34 | T |
| FR-REV-06 | Rejection reason codes shall come from the `review_reason_codes` setting, seeded with: `corrupted`, `unreadable`, `blank_or_near_blank`, `low_value`, `excessive_resolution`, `duplicate`, `rights_concern`, `personal_data`, `wrong_language`, `off_topic`, `disallowed_content`, `other`. | M | BR-10 | T |
| FR-REV-07 | `PATCH /reviews/{id}` shall save checklist answers (rights plausibility, metadata accuracy, language match, personal-data check, legibility), quality scores 1–5 for `legibility`, `completeness`, `relevance`, `metadata_accuracy` and `language_correctness` (overall = mean, 2 decimals, stored in `dataset_quality_scores`), reviewer comments, and an optional `data_class` change. | M | BR-10; BL §8.4 | T |
| FR-REV-08 | `GET /reviews/{id}/summary` shall return counts and bytes for accepted, rejected and undecided files; eligible accepted bytes; bytes excluded as exact duplicates; labeled-upgrade bytes; and the payable micros computed by the server with the pricing rule currently in force (FR-FIN-03). | M | BR-11, BR-12 | T |
| FR-REV-09 | `POST /reviews/{id}/finalize` with `{decision, feedback}` and `Idempotency-Key` shall enforce the following. For `approve`, `partial` and `reject`, every `ready` file must have a decision. `approve` requires all `ready` files accepted; `partial` requires ≥ 1 accepted and ≥ 1 rejected; `reject` requires 0 accepted. `request_changes` requires `feedback` ≥ 20 chars and creates no earnings. `feedback` is required for every decision except `approve`. Violations return `422 decision_inconsistent`. | M | BR-09 | T |
| FR-REV-10 | Finalization shall, in **one database transaction**: set the review `finalized` with its decision; set the dataset status to `approved`, `partially_approved`, `rejected` or `changes_requested`; insert `earning_records` per accepted file; and post one `dataset_earning` journal with idempotency key `dataset_review:{review_id}:earning` when the total > 0. A retry or concurrent duplicate request shall return the original result without additional records (E2E Scenario 7). | M | BR-09, BR-14; BL §8.5 | T |
| FR-REV-11 | `POST /reviews/{id}/release` (assignee) shall set the review `released` and return the dataset to `submitted`. File decisions of a released review are kept read-only in history and are not carried over. An admin may release any `in_progress` review. | M | BR-09; BL §9 | T |
| FR-REV-12 | On finalization the owner shall receive an in-app notification and an email for "dataset approved", "partially approved", "rejected" or "changes requested", including accepted bytes and payable amount where applicable. | M | BR-10, BR-23 | T |
| FR-REV-13 | After `changes_requested`, the owner may edit and resubmit (FR-DS-08), creating a new version and a new review. The next reviewer sees the earlier reviews and feedback. | M | BR-09; BL §9 | T |
| FR-REV-14 | `GET /reviews/history` shall list the caller's finalized and released reviews. Admins may filter by any reviewer. | M | BR-09 | T |
| FR-REV-15 | A reviewer shall hold at most `review_max_active_claims` (setting, default 5) `in_progress` dataset reviews at a time. A further `POST /datasets/{id}/claim-review` returns `409 review.claim_limit_reached` with `details.limit`. | M | BR-09; AM-09 | T |

### 4.8 FR-FIN: pricing, earnings and ledger

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-FIN-01 | `pricing_rules` shall be seeded with `raw = 1,000,000` and `labeled = 1,500,000` `rate_micros_per_gb`, effective at launch. `POST /admin/pricing-rules` (`pricing.manage`, super_admin) shall create a new version with `effective_from ≥ now` (no retroactive rules) and a mandatory note. Overlapping periods per data class are rejected by an exclusion constraint. `GET /pricing-rules` (admin) lists history. | M | BR-11; HA-06 | T |
| FR-FIN-02 | `GET /public/pricing` shall return the current rates per data class (as micros and formatted USD) and the definition 1 GB = 1,000,000,000 bytes. | M | BR-11 | T |
| FR-FIN-03 | The rule applied to a file shall be the rule for its dataset's final `data_class` in force at the finalization timestamp. Its id and rate shall be stored on each `earning_records` row. | M | BR-11; BL §8.4 | T |
| FR-FIN-04 | `file_earning_micros = floor(accepted_bytes × rate_micros_per_gb / 1_000_000_000)` computed with integer arithmetic only. Dataset earning = Σ file earnings. Displayed USD values are rounded **down** to cents. | M | BR-11; BL §8.2 | T |
| FR-FIN-05 | A file shall earn > 0 only if eligible (BL §8.3). Files that are not eligible but were accepted (e.g. exact duplicate of a previously accepted file) shall get an `earning_records` row with `amount_micros = 0` and an `ineligible_reason`. | M | BR-12 | T |
| FR-FIN-06 | When two or more accepted files in the same review share a SHA-256, only the earliest-created one shall earn. The others record `ineligible_reason = duplicate_in_dataset`. | M | BR-12 | T |
| FR-FIN-07 | A file whose SHA-256 was already paid shall earn 0, except when the earlier payment was at the raw rate, the new dataset is `labeled` and the reviewer set `labeled_upgrade = true` (HA-08, setting `labeled_upgrade_enabled`, default true). In that case it earns `labeled_rate − rate_previously_paid` per GB (floored, never negative). A SHA-256 shall receive at most one labeled-upgrade payment. | M | BR-13; BL §8.4; HA-08 | T |
| FR-FIN-08 | Dataset earnings shall credit the user wallet `available` bucket when `earning_hold_days = 0`. Otherwise they credit `pending` and set `earning_records.hold_until = finalized_at + hold days`. Annotation rewards follow the same hold rule (AM-02). `finance.release_pending` (hourly) shall post one `earning_release` journal per due earning record, keyed `earning_release:{earning_record_id}`, idempotently. | M | BR-14; A-07 | T |
| FR-FIN-09 | Each user shall have exactly one wallet (`kind = user`) created at registration. It holds both dataset earnings and annotation rewards, distinguished by journal kind. System wallets `system_dataset_purchases`, `system_annotation_labor`, `system_adjustments` and `system_payouts_settled` shall exist from the first migration. | M | BR-14, BR-21; BL §8.5 | T/I |
| FR-FIN-10 | Every money movement shall be a `ledger_journals` row of a kind listed in BL §8.5 with balanced `wallet_transactions` lines (Σ = 0). Journals and lines cannot be updated or deleted. Cached balances are updated in the same transaction after `SELECT … FOR UPDATE` on the wallet row. | M | BR-14 | T |
| FR-FIN-11 | `GET /wallet` shall return estimated, pending, available, reserved, paid, adjustments (net) and lifetime approved earnings (BL §8.6), as integer micros plus formatted strings. `GET /wallet/transactions` (paginated, filter by kind and date) and `GET /earnings` (per dataset and per annotation task, with the rule applied) shall show every line with a link to its source. | M | BR-14 | T |
| FR-FIN-12 | `POST /admin/adjustments` (`finance.adjust`, super_admin) with `{user_id, direction: credit\|debit, amount_micros > 0, reason ≥ 10 chars, related_entity?}` and `Idempotency-Key` shall post `adjustment_credit`/`adjustment_debit` (key `adjustment:{adjustment_id}`). A debit greater than `available` returns `422 insufficient_balance`. The user is notified. An actor cannot adjust their own wallet (`403 self_action_forbidden`). | M | BR-17 | T |
| FR-FIN-13 | Nightly `finance.reconcile` shall recompute every wallet bucket from lines and compare it with the cached balances. It shall also check that Σ all lines = 0, that Σ `earning_records.amount_micros` per review equals its journal amount, and that no `available`/`reserved` balance is negative. Results are stored and shown at `GET /admin/finance/reconciliation`. Any mismatch raises an alert (NFR-OBS-04). | M | BR-14; BL §13 | T |
| FR-FIN-14 | `GET /admin/finance/overview` (`finance.read`) shall show, for a date range: earnings credited (dataset vs annotation), adjustments, payouts by status and amount, outstanding liability (Σ user pending + available + reserved), and estimated liability of submitted and in-review datasets. `GET /admin/ledger` shall list journals with filters (user, kind, source, date). | M | BR-25, BR-34 | T |
| FR-FIN-15 | Annotation rewards shall post `annotation_reward` journals against `system_annotation_labor` (key `annotation_review:{review_id}:reward`), never against `system_dataset_purchases`. | M | BR-21 | T |
| FR-FIN-16 | Double payment of the same content shall be prevented in the database as well as in the service: every dataset `earning_records` row stores `content_sha256` (hex) and `pricing_tier` ∈ {`raw`, `labeled`, `labeled_upgrade`}; a partial unique index on `(content_sha256, pricing_tier) WHERE amount_micros > 0` rejects a second positive payment per tier, and finalize takes `pg_advisory_xact_lock(hashtext(content_sha256))` per file in sorted order before re-checking eligibility (FR-FIN-07). | M | BR-12, BR-13; AM-03 | T |

### 4.9 FR-PAY: payouts (manual)

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-PAY-01 | `POST /payouts` with `{amount_micros, payout_method_id}` and a required `Idempotency-Key` header shall create a `requested` payout **and** a `payout_reserve` journal in one transaction (wallet row locked), only if: the caller has `payout.request`; is a verified contributor; status is `active`; owns the method; `amount_micros % 10,000 = 0`; `min_withdrawal_micros` (10,000,000) ≤ amount ≤ `max_withdrawal_micros` (5,000,000,000); amount ≤ available; and the caller has no open payout. | M | BR-15, BR-16; BL §8.7 | T |
| FR-PAY-02 | Violations of FR-PAY-01 shall return, respectively: `403 forbidden`, `422 verification_required`, `403 account_suspended`, `422 invalid_payout_method`, `422 amount_not_whole_cents`, `422 amount_below_minimum`/`amount_above_maximum`, `422 insufficient_balance`, `409 open_payout_exists`. | M | BR-16 | T |
| FR-PAY-03 | Replaying `POST /payouts` with the same `Idempotency-Key` and identical body shall return the original payout (`200`) without new journals. The same key with a different body returns `409 idempotency_key_reused`. | M | BR-14 | T |
| FR-PAY-04 | Concurrent payout requests from one user shall never reserve more than the available balance, and at most one open payout shall exist per user (partial unique index). This is verified by a parallel-request test. | M | BR-14; Part 11 | T |
| FR-PAY-05 | At request time the payout shall store an immutable snapshot of the payout method details. Later edits or deletion of the method do not change the payout destination. | M | BR-15 | T |
| FR-PAY-06 | `POST /payouts/{id}/cancel` by the owner shall be allowed only in `requested`. It sets `cancelled` and posts `payout_release`. `GET /payouts` and `GET /payouts/{id}` shall show the owner's payouts with a status timeline, approvals count (without approver identities), payment reference and paid date. | M | BR-15 | T |
| FR-PAY-07 | `GET /admin/payouts` (`payout.approve`) shall list payouts with filters (status, amount range, method type, date) and risk flags: `new_payout_method` (FR-USER-05), `first_payout`, `requires_dual_approval`, `recipient_verification_changed`. | M | BR-16 | T |
| FR-PAY-08 | `POST /admin/payouts/{id}/approve` shall be refused if the actor is the recipient (`403 self_action_forbidden`) or the recipient is suspended (`422 recipient_suspended`). If amount < `payout_dual_approval_threshold_micros` (default 100,000,000), status becomes `approved`. Otherwise the first approval keeps `requested` with `approvals_count = 1`, and a second approval by a **different** admin sets `approved`. A repeat approval by the same admin returns `409 already_approved`. | M | BR-16; HA-07 | T |
| FR-PAY-09 | `POST /admin/payouts/{id}/reject` with a reason (≥ 10 chars) shall move `requested → rejected` and post `payout_release`. | M | BR-15 | T |
| FR-PAY-10 | `POST /admin/payouts/{id}/mark-paid` with `{payment_reference (1–128 chars, unique per method type), paid_at (≤ now and ≥ approval time), note?}` shall be allowed only from `approved`, by an actor with `payout.record_payment` who is not the recipient. It shall set `paid`, insert `payout_records` and post `payout_settle` (key `payout:{id}:settle`) atomically. A repeat call returns the original record. Proof files go to `POST /admin/payouts/{id}/proof` (PDF/JPEG/PNG ≤ 10 MB, scanned, private). | M | BR-15; BL §8.7 | T |
| FR-PAY-11 | `POST /admin/payouts/{id}/mark-failed` (from `approved`, with reason) shall set `failed` and post `payout_release`. `POST /admin/payouts/{id}/cancel` (admin, from `approved`, with reason) shall set `cancelled` and post `payout_release`. | M | BR-17 | T |
| FR-PAY-12 | `POST /admin/payouts/{id}/reverse` (super_admin, from `paid`, reason required) shall set `reversed` and post `payout_reversal` (paid → available). | M | BR-17 | T |
| FR-PAY-13 | Each payout status change shall notify the recipient in-app and by email (requested, approved, rejected, paid = "payment recorded", failed, cancelled, reversed). New requests appear in the admin dashboard queue count. | M | BR-23 | T |
| FR-PAY-14 | DataHub shall not call any bank, wallet or payment-provider API to move money in v1. `mark-paid` only records an external transfer confirmed by an admin. | M | BR-15 | I |

### 4.10 FR-ANN: annotation

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-ANN-01 | `POST /annotation/projects` (`annotation.manage`) shall create a project in status `draft` with: name, instructions (Markdown, ≤ 50,000 chars, rendered through an allow-list sanitiser), `annotation_types` ⊆ {`transcription`, `text_correction`, `classification`, `metadata`, `page_label`} (`bbox` rejected in v1), `label_set` (required if `classification`), `metadata_schema` (fields of type text, number, date or select, each with key, label, options and required), `task_unit` (`file`/`page`), `reward_per_task_micros` and `reward_per_page_micros` (≥ 0, at least one > 0), `deadline` (optional), `review_required = true`. `PATCH` may change instructions, deadline and rewards. Reward changes affect only tasks not yet approved. | M | BR-18, BR-21; BL §11 | T |
| FR-ANN-02 | Source datasets shall be `approved` or `partially_approved` and not `taken_down`. Only accepted files whose format is annotatable (BL §7) shall be included. Other selections return `422 source_not_eligible`. | M | BR-18 | T |
| FR-ANN-03 | `POST /annotation/projects/{id}/generate-tasks` shall create one task per eligible file (`task_unit = file`) or one per page (`page`), idempotently (unique per project, file and page), all `unassigned`, and set the project `active`. | M | BR-18 | T |
| FR-ANN-04 | `GET /annotation/projects` and `GET /annotation/projects/{id}/tasks` shall show progress counts per task status, per annotator, overdue tasks and approval rate, with filters by status and annotator. | M | BR-18 | T |
| FR-ANN-05 | `POST /annotation/tasks/{id}/assign` shall assign an `unassigned` task to a user who holds `annotator`, is verified and is `active` (otherwise `422 annotator_not_eligible`). It creates the single active `annotation_assignments` row, sets the task `assigned` and notifies the annotator ("annotation assigned"). | M | BR-18; A-08 | T |
| FR-ANN-06 | `POST /annotation/tasks/bulk-assign` shall assign up to 500 unassigned tasks round-robin across up to 50 eligible annotators in one transaction. | M | BR-18 | T |
| FR-ANN-07 | `POST /annotation/tasks/{id}/unassign` shall move `assigned`/`in_progress` to `unassigned`, end the active assignment (previous assignee loses access at once) and retain all saved versions for the next assignee. | M | BR-18 | T |
| FR-ANN-08 | `GET /annotation/my-tasks` shall list only the caller's active and past assignments. `GET /annotation/tasks/{id}` shall be available only to the active assignee, reviewers of that task and admins (`404` otherwise). | M | BR-07; BL §6 | T |
| FR-ANN-09 | `POST /annotation/tasks/{id}/start` shall move `assigned → in_progress`. Saving a draft on a `changes_requested` task shall move it to `in_progress`. | M | BL §9 | T |
| FR-ANN-10 | `PUT /annotation/tasks/{id}/draft` shall require `If-Match: <version>`. It is accepted only from the active assignee in `in_progress` or `changes_requested` and increments `annotations.version`. A version mismatch returns `409 version_conflict` with the server copy. The data must validate against the BL §11 schema and project configuration (`422 validation_error`). | M | BR-19; BL §11 | T |
| FR-ANN-11 | Each save whose content hash differs from the previous version shall insert an `annotation_versions` row. The last 50 draft versions and all submitted versions are retained. `GET /annotation/tasks/{id}/versions` lists them and allows viewing or restoring any retained version into the draft. | M | BR-19 | T |
| FR-ANN-12 | Transcription and corrected text shall be stored exactly as typed, with no NFC normalisation, preserving Khmer COENG (U+17D2) sequences, ZWSP (U+200B) and ZWNJ/ZWJ. A save → load round-trip shall be byte-identical. | M | BR-19, BR-29; A-02 | T |
| FR-ANN-13 | The editor shall provide three panels: **left** (task/page navigation, progress, instructions); **centre** (page image with zoom 25–400 %, pan, fit-width/fit-page, 90° rotation, page navigation); **right** (transcription, correction, metadata fields, classification labels, notes, reviewer comments). It shall autosave after 5 s of idle typing and on blur, show save state (Saved, Saving…, Offline – changes kept locally, Conflict), keep unsaved edits in local storage for draft recovery, and support undo/redo and documented keyboard shortcuts. | M | BR-19 | T/D |
| FR-ANN-14 | `POST /annotation/tasks/{id}/submit` shall validate completeness: required metadata present; classification labels in `label_set`; when `transcription` is a project type, each page in the task has non-empty transcription or is flagged unreadable per ANNOTATION_GUIDELINES.md. It then moves the task to `submitted` and freezes a submitted version. | M | BR-19 | T |
| FR-ANN-15 | `GET /annotation/review-queue` (`annotation.review`) shall list `submitted` tasks. `POST /annotation/tasks/{id}/claim-review` shall atomically move `submitted → in_review` for one reviewer (`409 already_claimed` otherwise). A reviewer who was ever assigned the task is refused (`403 self_review_forbidden`). | M | BR-20; BL §6 | T |
| FR-ANN-16 | `POST /annotation/tasks/{id}/review` with `{decision: approve\|request_changes, score 1–5, comments}` shall be allowed only for the claiming reviewer. `comments` is required for `request_changes`. `approve` sets `approved`, inserts `annotation_reviews`, an `annotation_rewards` row and the reward journal (FR-FIN-15) in one transaction. Reward = `reward_per_task_micros + reward_per_page_micros × pages_in_task`, credited exactly once (unique `annotation_review_id`). `request_changes` sets `changes_requested`, stores `annotation_feedback` and notifies the annotator ("annotation returned"). | M | BR-20, BR-21 | T |
| FR-ANN-17 | The reviewer view shall show the source document beside the annotation and a character-level diff between any two submitted versions. `GET /annotation/reviews/history` lists past reviews. `GET /annotation/my-rewards` lists the annotator's rewards per task. | M | BR-20, BR-21 | T |
| FR-ANN-18 | `POST /annotation/projects/{id}/close` shall set the project `closed` and every non-approved task `cancelled`. Saved data is retained, but no further edits or rewards are possible. Tasks past `deadline` shall be flagged `overdue` in admin views, and assignees shall be notified 24 h before a deadline. | M | BR-18 | T |
| FR-ANN-19 | When a task is approved, it shall be selected for a QA second review with probability `annotation_qa_sample_rate` (default 0.10). The QA review is an `annotation_reviews` row with `review_kind = qa` (primary reviews use `primary`), performed by a reviewer other than the annotator and the primary reviewer; it records score and comments only and never changes the task status or reward. Reviews whose claim is released or whose task is cancelled/reassigned end with status `cancelled`. | S | BR-20; AM-09 | T |
| FR-ANN-20 | Tasks from datasets with `contains_personal_data = true` shall be assignable only to annotators, and claimable only by reviewers, whose `user_profiles.privacy_trained = true` (set by an admin). Otherwise assignment returns `422 annotator_not_eligible`. | M | BR-18; AM-09 | T |

### 4.11 FR-MSG: messaging

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-MSG-01 | `POST /conversations` (`message.self`) shall create a conversation with `subject` (3–200 chars), first message, and optional `dataset_id` or `payout_id` that must belong to the caller. Participants are the creator and the support inbox (all `message.support` holders). An admin may start a conversation with any user. | M | BR-22 | T |
| FR-MSG-02 | `GET /conversations` shall list the caller's conversations. Support-inbox holders see all support conversations, filterable by status, assignee, unread, linked dataset, and `q`, a case-insensitive search over subjects and message bodies. Non-participants receive `404` for any conversation resource. | M | BR-22 | T |
| FR-MSG-03 | `POST /conversations/{id}/messages` shall accept plain-text bodies of 1–5,000 chars. They are rendered as escaped text with auto-linked http(s) URLs only. Messages cannot be edited or deleted by users in v1. | M | BR-22 | T |
| FR-MSG-04 | `POST /conversations/{id}/read` shall set the participant's `last_read_at`. Lists include per-conversation unread counts. | M | BR-22 | T |
| FR-MSG-05 | `POST /conversations/{id}/attachments` shall accept up to 5 files per message, each ≤ 10 MB, of type PDF, JPEG, PNG, TXT or DOCX. Attachments stay hidden (`pending_scan`) until ClamAV reports clean. Infected attachments are rejected and the sender is notified. `GET /attachments/{id}/download-url` returns a 5-minute presigned URL to participants only. | M | BR-22, BR-06 | T |
| FR-MSG-06 | Conversation status: an admin reply sets `awaiting_user`; a user reply sets `open`; an admin may `PATCH` to `closed` and set an assignee. A contributor message on a `closed` conversation reopens it to `open`. | M | BR-22; BL §9 | T |
| FR-MSG-07 | `WS /api/v1/ws` (cookie-authenticated, origin-checked) shall push `message.created` and `conversation.updated` to connected participants. When the socket is unavailable, the client shall poll every 30 s. | M | BR-22 | T |
| FR-MSG-08 | The admin support inbox shall show unassigned and open counts and the age of the oldest conversation awaiting an admin reply. | S | BR-22 | D |

### 4.12 FR-NOTIF: notifications and email

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-NOTIF-01 | The system shall create in-app notifications for: email verified; contributor approved (and other verification outcomes); dataset received; dataset processing finished; dataset approved; dataset partially approved; dataset rejected; changes requested; earnings credited; withdrawal requested; withdrawal approved; payment recorded; payout rejected/failed/cancelled/reversed; annotation assigned; annotation returned for correction; annotation approved; new support message; dataset taken down. | M | BR-23; Part 13 | T |
| FR-NOTIF-02 | `GET /notifications` (paginated, unread filter), `GET /notifications/unread-count`, `POST /notifications/{id}/read` and `POST /notifications/read-all` shall operate only on the caller's notifications. `notification.created` is pushed over WebSocket. | M | BR-23 | T |
| FR-NOTIF-03 | Emails shall be produced through a transactional outbox: an `email_outbox` row is inserted in the same transaction as the triggering event and sent by `messaging.send_email` via SMTP. Retries use exponential backoff up to 5 attempts over ≤ 1 h, and the final status `sent`/`failed` is visible to admins. | M | BR-23; BL §13 | T |
| FR-NOTIF-04 | Email shall be sent for: verification and password-reset links; password changed; payout method added/removed; verification decisions; dataset decisions; earnings credited; every payout status change; annotation assigned or returned; a support message still unread 15 min after creation; account suspended or reactivated. User preferences (FR-USER-06) apply except to mandatory categories. | M | BR-23 | T |
| FR-NOTIF-05 | Emails shall have plain-text and HTML parts, contain no document content, tokens other than the single-use link, or payout details beyond the last 4 characters. Non-mandatory categories include a `List-Unsubscribe` header. | M | BR-30 | T/I |
| FR-NOTIF-06 | Admin users with the relevant permission shall receive in-app notifications for a new verification submission, a new payout request and a new support conversation. | S | BR-25 | T |

### 4.13 FR-EXP: exports

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-EXP-01 | `POST /admin/exports` (`dataset.export`) shall accept a selection (explicit dataset ids and/or filters: category, language, `min_quality`, `data_class`, finalized-date range) and content options: `include_files` (accepted files only), `include_annotations` (approved only), `include_metadata`, and `annotation_text_form` (`verbatim`, `normalized_nfc` or `both`). Only `approved`/`partially_approved` datasets that are not `taken_down` are eligible. Rejected, quarantined and failed files are never exported. | M | BR-24 | T |
| FR-EXP-02 | Exports shall run as `exports.build_export` on the `exports` queue with statuses `queued → running → completed \| failed` and a progress percentage. The API process never builds export content. | M | BR-24; BL §13 | T |
| FR-EXP-03 | Each export shall produce ZIP part(s) ≤ 4 GB (4,000,000,000 bytes), each recorded in `export_files` with size and SHA-256. Every package contains `manifest.jsonl` (one line per file: export path, dataset id and version, file id, SHA-256, size, MIME, original filename, languages, category, licence, data class, quality score, annotation ids) plus `metadata.csv`. When annotations are included it also contains `annotations.jsonl` (BL §11 data plus project, task, version, reviewer score). Contributor PII (email, legal name, phone) is never included; contributors are identified by a pseudonymous id. | M | BR-24, BR-30 | T |
| FR-EXP-04 | `POST /admin/exports/{id}/download-url` shall return a presigned URL valid for 5 minutes for one part, only for `completed` exports. Each issuance is audit-logged. | M | BR-24 | T |
| FR-EXP-05 | Completed exports shall expire 7 days after completion (`exports.expire` daily). Objects are deleted and status set to `expired`. | M | BR-24; A-15 | T |
| FR-EXP-06 | Each export shall audit the requester, time, selection criteria, resolved dataset ids, file count and total bytes. `GET /admin/exports` and `GET /admin/exports/{id}` show this history. | M | BR-24, BR-26 | T |
| FR-EXP-07 | At most 2 exports shall run concurrently. Further jobs remain `queued`. | S | BR-24 | T |

### 4.14 FR-ADM: administration

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-ADM-01 | `GET /admin/users` (`user.read`) shall search by email or name and filter by role, status, verification status and registration date. `GET /admin/users/{id}` shows profile, roles, verification history, datasets, wallet summary, payouts, active sessions and recent audit events. | M | BR-04 | T |
| FR-ADM-02 | `POST /admin/users/{id}/suspend` (reason ≥ 10 chars) shall set `suspended`, revoke all sessions, and block login, uploads, submissions, payout requests and annotation work. `POST /admin/users/{id}/reactivate` restores `active`. Both notify the user by email. Admins cannot suspend themselves or a super_admin. | M | BR-03 | T |
| FR-ADM-03 | `PUT /admin/users/{id}/roles` (`user.manage`) shall let admins grant or revoke `annotator` and `reviewer`. Granting or revoking `admin` or `super_admin` requires `role.manage` (super_admin). No user may change their own roles, and the last active super_admin cannot be demoted (`409 last_super_admin`). Role changes take effect on the next request (permissions resolved per request). | M | BR-04, BR-27 | T |
| FR-ADM-04 | `POST /admin/users/{id}/revoke-sessions` shall revoke all sessions of the user. | M | BR-30 | T |
| FR-ADM-05 | `GET /admin/datasets` (`dataset.read.any`) shall support `q` (dataset code `DS-YYYY-NNNNNN`, title, description, tags), and filters `status`, `data_class`, `language`, `category`, `min_quality`, `owner`, and created/finalized date range, with pagination and sorting. `GET /admin/datasets/{id}` shows full details including reviews, earnings and duplicates. | M | BR-24 | T |
| FR-ADM-06 | `GET /admin/analytics/overview?from&to` (`analytics.read`) shall return: registrations; verified users; datasets submitted and finalized by decision; submitted, accepted and rejected bytes; acceptance rate; median submit→finalize time; earnings credited; payouts requested and paid; outstanding liability; annotation tasks by status; pages approved; first-pass approval rate; open conversations; storage bytes in use. Each chart shall have a tabular alternative. | M | BR-25, BR-34 | T |
| FR-ADM-07 | The admin dashboard shall show actionable queue counts: verifications pending, datasets submitted, reviews in progress > 3 days, payouts requested/approved-unpaid, conversations awaiting admin, failed background jobs (24 h), and the latest reconciliation result. | M | BR-25 | D/T |
| FR-ADM-08 | `GET /admin/settings` and `PUT /admin/settings/{key}` (`settings.manage`, super_admin) shall manage typed, validated settings, at least: `max_file_bytes`, `max_dataset_bytes`, `user_pending_quota_bytes`, `earning_hold_days`, `min_withdrawal_micros`, `max_withdrawal_micros`, `payout_dual_approval_threshold_micros`, `labeled_upgrade_enabled`, `extra_allowed_extensions`, `review_reason_codes`, `dataset_categories`, `contributor_agreement_version`, and (AM-06, AM-09) `maintenance_mode`, `review_max_active_claims`, `annotation_qa_sample_rate`, `legal_docs_approved`. `max_file_bytes` cannot exceed 4,000,000,000 (AM-01). Every change is audit-logged with old and new values. | M | BR-27 | T |
| FR-ADM-09 | `GET /admin/roles` shall list roles and their permission codes (BL §6). | M | BR-27 | T |
| FR-ADM-10 | `POST /public/contact` (anonymous, rate-limited) shall accept name, email, category (`general`, `takedown`, `privacy`, `account`) and a message ≤ 5,000 chars. Formal takedown/privacy notices use the dedicated `POST /public/takedown-requests` (FR-ADM-13); a contact message with category `takedown` or `privacy` also creates a `takedown_requests` row (`source = public_form`). Requests are tracked with status `received → under_review → actioned \| rejected` (or `withdrawn`) and a link to the affected dataset (FR-ADM-14). | M | BR-28 | T |
| FR-ADM-11 | Admins shall process `deletion_requests` (`pending → processed \| refused` with reason). Processing executes FR-USER-07. | M | BR-28 | T |
| FR-ADM-12 | Admins shall view `background_job_records` (task, status, attempts, last error) filtered by status and task, and may re-enqueue a failed idempotent job. | S | BR-31 | T |
| FR-ADM-13 | `POST /public/takedown-requests` (no login, CSRF + rate limit 5/h per IP, honeypot) shall accept requester name, email, organisation, `claim_type` (`copyright`, `privacy`, `illegal_content`, `consent_withdrawn`, `other`), dataset reference (code or id, optional), description (20–10,000 chars), evidence URL and a sworn statement, create a `takedown_requests` row (`received`), acknowledge by email and notify admins. The response is always `202` and never reveals whether the referenced dataset exists. | M | BR-28; AM-04 | T |
| FR-ADM-14 | `GET /admin/takedown-requests` (`user.manage`) shall list requests filtered by status (comma-separated), claim type, source, dataset and date. `POST /admin/takedown-requests/{id}/decision` (step-up MFA) shall move a request `received → under_review` or `received\|under_review → actioned\|rejected` with notes; `actioned` requires the dataset to be `taken_down` already or `apply_takedown = true`, which performs FR-DS-12 in the same transaction. The requester is emailed the outcome. | M | BR-28; AM-04 | T |
| FR-ADM-15 | When the setting `maintenance_mode` is true, every API call except `/healthz`, `/readyz`, `/auth/*`, `/admin/*` and other admin-MFA endpoints shall return `503 service_unavailable` with `details.reason = "maintenance"` and `Retry-After`; the web app shows the maintenance page. The switch takes effect within 60 s and is audit-logged. | M | BR-31; AM-06 | T |
| FR-ADM-16 | Datasets, payout requests and export jobs shall receive an immutable human reference code `DS-YYYY-NNNNNN`, `PO-YYYY-NNNNNN` and `EX-YYYY-NNNNNN` respectively (per-prefix, per-UTC-year counter in `dataset_code_counters`, allocated in the creating transaction), returned as `code` by the API, shown in the UI wherever the record is referenced and searchable by exact code. URLs keep using the UUID. | M | BR-24, BR-25; AM-07 | T |
| FR-ADM-17 | Admin list endpoints shall support: `role` on `GET /admin/users`; `user_id` on `GET /admin/payouts`; `entity_type`, `entity_id` and `actor_id` on `GET /admin/audit-logs`. Every `status` filter shall accept a comma-separated list of values (e.g. `?status=requested,approved`). | M | BR-25, BR-26; AM-05 | T |
| FR-ADM-18 | A super_admin shall be able to set and release a legal hold (`legal_hold` + mandatory `legal_hold_reason`) on a user or a dataset. While held, retention purges, owner deletion, account anonymisation and secure deletion after takedown are suspended for the held records. Setting and releasing are audit-logged. | M | BR-28; AM-09 | T |
| FR-ADM-19 | Beat job `admin.requeue_stalled` (every 5 min) shall re-enqueue `email_outbox` rows `pending` > 2 min, `dataset_files` `uploaded` > 5 min and `export_jobs` `queued` > 5 min. Target tasks are status-guarded so duplicate enqueues have no effect. | M | BR-31; AM-10 | T |
| FR-ADM-20 | While the setting `legal_docs_approved` is `false` (default), the Terms of Service, Privacy Policy and Contributor Agreement pages and acceptance dialogs shall carry a visible "Draft — pending legal review" banner, and the release-readiness check shall fail for production (HA-01). Only super_admin may set it to `true` (audited). | M | BR-28; AM-09; HA-01 | T |

### 4.15 FR-AUD: audit and security logging

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| FR-AUD-01 | Every state transition in BL §9 and every sensitive action (role change, setting change, pricing change, adjustment, takedown, export, verification decision, payout action, suspension) shall write an `audit_logs` row with actor, action, entity type and id, before/after JSON diff, IP, request_id and timestamp, in the same transaction as the change. | M | BR-26; BL §9 | T |
| FR-AUD-02 | `audit_logs` shall be append-only: UPDATE and DELETE are blocked by a database trigger. Retention is 7 years (A-15). | M | BR-26 | T |
| FR-AUD-03 | `GET /admin/audit-logs` (`audit.read`, super_admin) shall filter by actor, action, entity type/id and date range. `GET /admin/security-events` shall list login successes and failures, lockouts, MFA enrol/disable/fail, password changes and resets, session revocations, role changes, payout-method changes and infected uploads (retained 1 year). | M | BR-26 | T |
| FR-AUD-04 | Access by non-owners to file downloads, ID documents, payout proofs and export downloads shall be audit-logged. | M | BR-07, BR-26 | T |
| FR-AUD-05 | Audit and security records shall never contain passwords, password hashes, session or reset tokens, MFA secrets or recovery codes. Payout account identifiers are masked to the last 4 characters. | M | BR-30 | T/I |

## 5. Business rules index

The rules below are normative through the referenced requirements. This index exists so that PRICING_PAYOUT_POLICY.md and DATA_QUALITY_REVIEW.md can cite one place.

| Rule | Statement | Requirements |
|---|---|---|
| Pricing formula | `floor(accepted_bytes × rate_micros_per_gb / 10⁹)` per file; integer only; display floored to cents | FR-FIN-04 |
| Rates | raw 1,000,000 / labeled 1,500,000 micros per GB; versioned; no retroactive change | FR-FIN-01, FR-FIN-03 |
| Eligibility | ready + clean + accepted + not exact-duplicate of a previously accepted file + not container | FR-FIN-05, FR-PROC-03, FR-PROC-05 |
| Duplicates | exact global duplicate earns 0; in-dataset duplicates earn once; near-duplicates are flags only | FR-PROC-11, FR-PROC-12, FR-FIN-06 |
| Raw → labeled | differential only, at most once per SHA-256, reviewer opt-in, HA-08 | FR-FIN-07, FR-REV-04 |
| Upload prerequisites | verified email + onboarding (+ current agreement version) | FR-USER-02, FR-USER-03 |
| Verification gates | payouts and annotation assignment only | FR-VER-06 |
| Payout limits | $10 ≤ amount ≤ $5,000, whole cents, ≤ available, one open payout | FR-PAY-01 |
| Dual approval | ≥ $100 needs 2 distinct admins | FR-PAY-08 |
| Separation of duties | no self-review (dataset/annotation), no self-approval or self-payment of payouts, no self-adjustment, no self-verification, no self role change | FR-REV-02, FR-ANN-15, FR-PAY-08, FR-PAY-10, FR-FIN-12, FR-VER-04, FR-ADM-03 |
| Annotation reward | per_task + per_page × pages, once per approved task, separate system wallet | FR-ANN-16, FR-FIN-15 |
| Hold period | `earning_hold_days` (default 0) | FR-FIN-08 |
| Retention | A-15 defaults | FR-DS-05, FR-UPL-07, FR-EXP-05, FR-USER-07, FR-AUD-02 |

## 6. Permissions

The role → permission matrix is **BL §6** and is normative. Requirements that implement it:

| Concern | Requirement |
|---|---|
| Deny-by-default endpoint guard `require(permission)` | SEC-07 |
| Resource ownership / assignment checks returning 404 | SEC-08, FR-DS-03, FR-DS-13, FR-ANN-08, FR-MSG-02 |
| Admin endpoints need MFA-verified session | SEC-05 |
| Separation of duties | §5 row "Separation of duties" |
| Role management limits | FR-ADM-03 |
| Verification-gated permissions | FR-VER-06 |
| Reviewer content access only after claim | FR-REV-01, FR-DS-13 |
| Export only by `dataset.export` | FR-EXP-01 |
| Super_admin-only: pricing, settings, roles (admin), audit, adjustments, reversals | FR-FIN-01, FR-ADM-08, FR-ADM-03, FR-AUD-03, FR-FIN-12, FR-PAY-12 |

An automated authorization test matrix (TEST_CASES.md) shall exercise every endpoint in BL §12 against every role and an anonymous caller (see NFR-INT-10).

## 7. Non-functional requirements

### 7.1 NFR-PERF: performance

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| NFR-PERF-01 | With 200 concurrent authenticated users on the reference production host, non-file API endpoints shall have p95 latency < 300 ms and p99 < 1,000 ms, with error rate < 0.5 % (load test of a realistic mix: dashboards, lists, review decisions, drafts). | M | BR-31; BL §14 | T |
| NFR-PERF-02 | Hashing plus malware scanning shall process ≥ 2 GB/min per worker on the reference worker size. Files ≤ 100 MB shall reach a terminal status within 120 s of upload completion (p95) when the queue is empty. | M | BL §14 | T |
| NFR-PERF-03 | All list endpoints shall paginate (max `page_size` 100) and use indexed predicates. No endpoint shall return an unbounded collection. The slowest list query at year-1 data volume (2,000 users, 20,000 datasets, 2,000,000 files) shall execute in < 100 ms (EXPLAIN-verified). | M | BL §12 | T/I |
| NFR-PERF-04 | Authenticated dashboard pages shall reach Largest Contentful Paint ≤ 2.5 s (p75) under a 10 Mbps / 100 ms RTT profile. Initial JS per route ≤ 300 KB gzip. | S | BR-32 | T |
| NFR-PERF-05 | WebSocket events shall be delivered to connected clients ≤ 2 s (p95) after the triggering commit. Emails shall be handed to SMTP ≤ 5 min (p95) after the event. | M | BR-23 | T |
| NFR-PERF-06 | Finalizing a review of a 2,000-file dataset (decisions + earnings + journal) shall complete in ≤ 5 s. Bulk decisions on 2,000 files shall complete in ≤ 3 s. | M | BR-09 | T |

### 7.2 NFR-AVL: availability and recovery

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| NFR-AVL-01 | Monthly availability of the web app and API shall be ≥ 99.5 %, measured by an external probe of `/readyz` and the home page every 60 s. This excludes planned maintenance ≤ 4 h/month announced ≥ 48 h in advance. | M | BR-31; BL §14 | T |
| NFR-AVL-02 | RPO ≤ 24 h through a daily encrypted `pg_dump` retained 30 days plus object-storage backup per AM-13: on AWS S3 bucket versioning (noncurrent versions kept 30 days); on Cloudflare R2 (no versioning) a nightly `rclone sync` to a separate backup bucket/provider keeping deleted objects 30 days. Optional WAL archiving gives RPO 15 min. | M | BR-31 | T |
| NFR-AVL-03 | RTO ≤ 4 h for a full restore of database and service on new infrastructure, proven by a restore drill before launch and every quarter (E2E Scenario 8). | M | BR-31 | T |
| NFR-AVL-04 | `GET /healthz` shall return 200 when the process is alive, with no dependency checks. `GET /readyz` shall return 200 only when PostgreSQL, Redis and object storage respond within 2 s, and 503 otherwise. The web app shows the Maintenance page when the API returns 503. | M | BR-31 | T |
| NFR-AVL-05 | Degraded dependencies shall not lose data. ClamAV down: files remain `processing` and are retried, and nothing becomes `ready`. SMTP down: outbox rows remain queued. Worker down: uploads still complete and tasks run when workers return. Redis down: API returns 503 for affected endpoints rather than bypassing rate limits. | M | BR-31, A-10 | T |

### 7.3 NFR-ACC: accessibility, responsiveness and Khmer support

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| NFR-ACC-01 | All pages shall conform to WCAG 2.2 Level AA. Automated axe-core checks in CI shall report 0 serious/critical violations on every route. Manual screen-reader checks (NVDA + Chrome, VoiceOver + Safari) shall pass for registration, upload, review, payout and the annotation editor before launch. | M | BR-32 | T |
| NFR-ACC-02 | All functionality shall be keyboard-operable with visible focus (≥ 2 px, contrast ≥ 3:1). Focus is trapped in and restored from dialogs, and there is a skip-to-content link. | M | BR-32 | T |
| NFR-ACC-03 | Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI components) in both light and dark themes. Pointer targets are ≥ 24×24 CSS px. Status is never conveyed by colour alone. Motion respects `prefers-reduced-motion`. | M | BR-32 | T/I |
| NFR-ACC-04 | Form errors shall be programmatically associated with fields (`aria-describedby`), announced via a live region and summarised at the top of the form on submit. | M | BR-32 | T |
| NFR-ACC-05 | Layouts shall be usable from 360 px width without horizontal scrolling (except data tables, which scroll within their container). The annotation editor and review workspace require ≥ 1024 px and show an advisory on smaller screens while keeping read-only access. | M | BR-32 | T |
| NFR-ACC-06 | Khmer content shall render with self-hosted Noto Sans Khmer. Elements containing Khmer user content carry `lang="km"`. Khmer text uses line-height ≥ 1.6 so that stacked subscript consonants are not clipped. Text inputs accept and display COENG sequences without alteration. | M | BR-29 | T |
| NFR-ACC-07 | All UI strings shall come from a message catalogue (no hard-coded user-facing strings in components), so that a Khmer UI can be added without code changes. Dates and numbers are formatted with `Intl` in the user's browser timezone (A-13). | M | BR-29; A-02 | I/T |

### 7.4 NFR-INT: data integrity, API contract and error handling

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| NFR-INT-01 | All monetary amounts shall be stored as `BIGINT` micro-USD and computed with integer arithmetic. No float or Decimal-to-float conversion may occur in financial code paths. This is enforced by a lint rule and by property-based tests of the earning formula. | M | BR-14; A-04 | T/I |
| NFR-INT-02 | Database constraints shall enforce: ledger lines Σ = 0 per journal (deferred trigger); no UPDATE/DELETE on journals, lines and audit logs; CHECK `available ≥ 0` and `reserved ≥ 0` on cached balances; and the unique constraints listed in BL §10. | M | BR-14; BL §10 | T |
| NFR-INT-03 | Every command that changes state shall run in one database transaction, including its audit row and outbox rows. Celery tasks and emails are enqueued only after commit. All tasks shall be idempotent under redelivery (`acks_late`). | M | BR-14; BL §13 | T |
| NFR-INT-04 | User-supplied text shall be UTF-8 and NFC-normalised on input, **except** annotation transcription and corrected text (FR-ANN-12). Invalid UTF-8 returns `422 validation_error`. | M | A-02 | T |
| NFR-INT-05 | All timestamps shall be stored as `timestamptz` in UTC and serialised in ISO 8601 with `Z`. | M | A-13 | T |
| NFR-INT-06 | Every API error shall use the envelope `{"error":{"code","message","details","request_id"}}` (BL §12) with the status codes in §9. `details` for validation errors is a list of `{field, issue}`. | M | BL §12 | T |
| NFR-INT-07 | Responses shall never include stack traces, SQL, internal hostnames or storage keys. Unexpected errors return `500 internal_error` with `request_id`. Every response carries `X-Request-ID`, which is honoured from the proxy if present and generated otherwise. | M | BR-30 | T |
| NFR-INT-08 | Schema changes shall be made only through reviewed Alembic migrations. CI shall run upgrade-from-empty and upgrade-from-previous-release on PostgreSQL 17, plus a check that models and migrations do not drift. | M | Part 7 | T |
| NFR-INT-09 | Before adding a file to an export, the stored object's SHA-256 shall be re-verified against `dataset_files.sha256`. A mismatch fails the export and raises an alert. | S | BR-24 | T |
| NFR-INT-10 | The implemented API shall match `openapi.yaml`. CI validates the spec and runs contract tests. An automated authorization matrix test covers every endpoint × role (contributor, annotator, reviewer, admin, super_admin, anonymous). | M | BR-04 | T |

### 7.5 NFR-UPL: upload reliability

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| NFR-UPL-01 | ≥ 99 % of upload sessions for files ≤ 4 GB (the AM-01 maximum) that the client does not cancel shall reach `completed`, measured over a 7-day staging soak with injected network faults and in production. | M | BR-05; BL §14 | T |
| NFR-UPL-02 | An upload interrupted by network loss, tab closure or browser restart shall be resumable within the 24 h session lifetime without re-uploading already stored parts (E2E Scenario 6). | M | BR-05 | T |
| NFR-UPL-03 | A resumed upload shall produce an object whose server-computed SHA-256 equals the SHA-256 of the source file (verified in tests with 2 GB and 4,000,000,000-byte fixtures). | M | BR-05 | T |
| NFR-UPL-04 | The system shall sustain 50 concurrent multipart uploads (A-03) without API p95 latency exceeding NFR-PERF-01, because bytes go directly to object storage. | M | A-03 | T |
| NFR-UPL-05 | Uploads shall work on a 1 Mbps link. The client uses a per-part timeout of 10 min and adapts concurrency down to 1 part on repeated timeouts. | S | BR-05; OC-03 | T |

### 7.6 NFR-OBS: observability

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| NFR-OBS-01 | API and workers shall emit structured JSON logs (structlog) including timestamp, level, request_id or task_id, user id (when authenticated), route, status and duration. | M | Part 24 | I/T |
| NFR-OBS-02 | `GET /metrics` (internal network only) shall expose Prometheus metrics at least for: request count, latency histograms, 5xx rate, queue depth and oldest-task age per queue, task failures, upload sessions by status, files by processing status, scan results, outbox backlog, payout counts by status, reconciliation result and storage bytes. | M | Part 24 | T |
| NFR-OBS-03 | Unhandled exceptions shall be reported to Sentry when `SENTRY_DSN` is set, with PII scrubbing and request bodies excluded. | S | Part 24 | I |
| NFR-OBS-04 | Alerts shall fire for: 5xx rate > 2 % over 5 min; `/readyz` failing for 3 consecutive probes; any queue with oldest task > 15 min or depth > 500; reconciliation mismatch; backup job failure or no successful backup in 26 h; storage usage > 80 % of budgeted capacity; email failures > 10 in 1 h; ≥ 3 infected uploads from one user in 30 days. | M | BR-31 | T/D |
| NFR-OBS-05 | Logs shall never contain passwords, tokens, cookies, MFA secrets, presigned URLs, document contents or full payout account numbers. This is verified by a log-scrubbing test. | M | BR-30 | T |

## 8. Security requirements (SEC)

| ID | Requirement | Pri | Source | Verif |
|---|---|:-:|---|:-:|
| SEC-01 | Passwords shall be hashed with Argon2id (memory ≥ 64 MiB, iterations ≥ 3, parallelism ≥ 1, 16-byte salt). Hashes are rehashed on login when parameters are increased. | M | BR-30 | T |
| SEC-02 | Session tokens shall be 256-bit CSPRNG values. Only their SHA-256 is stored (`user_sessions`), and they are rotated on login, privilege change and MFA verification. | M | BR-30; BL §3 | T |
| SEC-03 | Cookie `dh_session` shall be `HttpOnly; Secure; SameSite=Lax; Path=/`. `dh_csrf` shall be `Secure; SameSite=Lax`. In dev the web app proxies `/api/*` so that cookies are first-party. | M | BL §3 | T |
| SEC-04 | All unsafe methods (POST, PUT, PATCH, DELETE) shall require header `X-CSRF-Token` equal to cookie `dh_csrf` (from `GET /auth/csrf`). A mismatch returns `403 csrf_failed`. The WebSocket handshake checks `Origin` against the allowed origin. | M | BR-30 | T |
| SEC-05 | `admin` and `super_admin` shall enrol TOTP MFA. While `ADMIN_MFA_REQUIRED = true`, every `/admin/*` endpoint and every endpoint requiring an admin-only permission returns `403 mfa_required` unless `mfa_verified_at` is set on the session. | M | BR-30; BL §6 | T |
| SEC-06 | Rate limits (Redis, sliding window) shall apply: register 5/h per IP; login 20 per 15 min per IP plus FR-AUTH-07 per account; forgot-password 3/h per email and 10/h per IP; `/public/contact` 5/h per IP; upload initiation 120/min per user; messages 30/min per user; all other authenticated requests 600/min per user. Exceeding a limit returns `429 rate_limited` with `Retry-After`. | M | BR-30 | T |
| SEC-07 | Every endpoint shall declare its required permission through the `require(permission)` dependency (deny by default). A CI test fails if any route lacks an explicit permission or `public` marker. | M | BR-04; BL §6 | T |
| SEC-08 | Services shall enforce resource-level checks (ownership, assignment, reviewer assignee, conversation participant). Resources the caller may not know about return `404 not_found`. A valid resource where the role lacks the action returns `403 forbidden`. | M | BR-07 | T |
| SEC-09 | The object-storage bucket `datahub-private` shall block public access. Objects are accessed only via presigned URLs (PUT parts 15 min, GET 5 min) issued after authorization. No permanent public links exist. | M | BR-07 | T/I |
| SEC-10 | File downloads and previews shall be served with `X-Content-Type-Options: nosniff`. Downloads use `Content-Disposition: attachment`. Previews are served only as raster images or as text rendered as escaped text by the app. Uploaded HTML, SVG and scripts are never rendered. | M | BR-06 | T |
| SEC-11 | Processing workers shall run as non-root with a read-only root filesystem and a size-limited scratch dir. Network egress is limited to object storage, PostgreSQL, Redis and clamd. Uploaded content is never executed or opened with macro-capable software. | M | BR-06 | I |
| SEC-12 | All external traffic shall use TLS 1.2+ (Caddy auto-HTTPS) with HSTS (`max-age=31536000; includeSubDomains`). Internal services (Postgres, Redis, clamd, metrics) are not exposed publicly. | M | BR-30 | T/I |
| SEC-13 | Data at rest shall be encrypted by provider-side encryption for object storage and database volumes, and backups shall be encrypted before leaving the host. | M | BR-30 | I |
| SEC-14 | MFA secrets and payout-method details shall be encrypted at the application layer with AES-256-GCM using a key from the secret store (`APP_ENCRYPTION_KEY`). Key rotation is supported through key ids. | M | BR-30 | T |
| SEC-15 | Web responses shall set CSP (`default-src 'self'`, scripts via nonce, `frame-ancestors 'none'`, `object-src 'none'`, `img-src 'self' data: <storage origin>`, `connect-src 'self' <storage origin> wss:`), `Referrer-Policy: strict-origin-when-cross-origin` and a restrictive `Permissions-Policy`. | M | BR-30 | T |
| SEC-16 | CORS shall be disabled for the API except the configured web origin. The object-storage CORS policy allows only that origin and methods PUT/GET/HEAD with the ETag header exposed. | M | BR-30 | T |
| SEC-17 | All inputs shall be validated by Pydantic v2 models with explicit length and range limits. JSON bodies are capped at 1 MB (`413 payload_too_large`). Database access uses SQLAlchemy parameter binding only. No raw SQL is built by string concatenation, and no server-side fetching of user-supplied URLs is allowed (SSRF). | M | BR-30 | T/I |
| SEC-18 | User-generated content shall be rendered as escaped text. Project instructions (Markdown) are sanitised with an allow-list. `dangerouslySetInnerHTML` is forbidden for user content (lint rule). | M | BR-30 | T/I |
| SEC-19 | No secrets shall be committed. Configuration comes from environment/secret store, `.env.example` contains placeholders only, and CI runs a secret scanner (gitleaks). | M | BR-30 | I/T |
| SEC-20 | CI shall scan dependencies (pip-audit, npm audit/osv-scanner) and container images (Trivy). Critical vulnerabilities block release. High vulnerabilities require a documented exception. | M | BR-30 | T |
| SEC-21 | Permissions shall be re-evaluated on every request from current roles. Suspension, password reset and removal of admin roles revoke existing sessions immediately. | M | BR-03, BR-30 | T |
| SEC-22 | Before public launch, a security test against OWASP ASVS 4.0 Level 2 (authentication, access control, file handling, business logic) shall be performed, with all critical/high findings fixed (THREAT_MODEL.md, SECURITY_REQUIREMENTS.md). | M | BR-30 | T |

## 9. Error handling

Envelope (NFR-INT-06):
```json
{"error": {"code": "insufficient_balance", "message": "Requested amount exceeds your available balance.", "details": {"available_micros": 7250000}, "request_id": "01J…"}}
```

Canonical error codes (the minimum set; modules may add codes that follow the same pattern and must register them in API_DOCUMENTATION.md):

| HTTP | Code(s) | Used by |
|---|---|---|
| 400 | `bad_request` | malformed JSON, bad headers |
| 401 | `unauthenticated`, `invalid_credentials`, `session_expired` | FR-AUTH-05/06/10 |
| 403 | `forbidden`, `csrf_failed`, `mfa_required`, `email_not_verified`, `onboarding_required`, `agreement_outdated`, `account_suspended`, `self_review_forbidden`, `self_action_forbidden` | SEC-04/05/08, FR-USER-02/03, FR-REV-02, FR-PAY-08 |
| 404 | `not_found` | SEC-08 |
| 409 | `invalid_state`, `already_claimed`, `already_approved`, `version_conflict`, `open_payout_exists`, `idempotency_key_reused`, `payout_method_in_use`, `last_super_admin`, `mfa_required_for_role` | FR-DS-04, FR-REV-02, FR-ANN-10, FR-PAY-02/03/08 |
| 413 | `file_too_large`, `payload_too_large` | FR-UPL-02, SEC-17 |
| 422 | `validation_error`, `unsupported_type`, `dataset_limit_exceeded`, `quota_exceeded`, `upload_incomplete`, `submit_preconditions_failed`, `file_not_eligible`, `decision_inconsistent`, `insufficient_balance`, `amount_below_minimum`, `amount_above_maximum`, `amount_not_whole_cents`, `verification_required`, `verification_prerequisites`, `underage`, `invalid_payout_method`, `recipient_suspended`, `annotator_not_eligible`, `source_not_eligible` | FR-UPL, FR-DS, FR-REV, FR-PAY, FR-VER, FR-ANN |
| 429 | `rate_limited`, `login_locked`, `too_many_uploads` | SEC-06, FR-AUTH-07, FR-UPL-02 |
| 500 | `internal_error` | NFR-INT-07 |
| 503 | `service_unavailable` | NFR-AVL-04/05 |

Client-side handling (normative for the web app): `401` → redirect to login, preserving the return URL. `403 mfa_required` → MFA prompt. `409 version_conflict` → conflict dialog showing both versions with "keep mine" (re-save with the new `If-Match`) or "use server". `422` → field errors (NFR-ACC-04). `429` → message with retry time. `5xx` → the Server Error page with `request_id`, and in-flight forms keep their content.

## 10. System constraints

| Constraint | Detail | Source |
|---|---|---|
| Stack | Next.js 15 / React 19 / TS 5 / Tailwind 4 / shadcn/ui; Python 3.13 / FastAPI / Pydantic v2 / SQLAlchemy 2.0 / Alembic; Celery 5; PostgreSQL 17; Redis 8; S3 API storage; ClamAV; Caddy 2 | BL §3 |
| Architecture | Modular monolith with modules identity, datasets, processing, review, finance, annotation, messaging, exports, admin. Cross-module calls only via service functions | BL §4 |
| Dev ports | web 3410, api 8410, postgres 5440, redis 6390, S3 9410/9411, mailpit 8425/1035 | BL §5 |
| Document viewing | Server-rendered page images; no PDF.js; no LibreOffice in v1 | BL §3; A-11 |
| Scale envelope | ≤ 2,000 users, ≤ 200 concurrent sessions, ≤ 50 concurrent uploads, ≤ 20 TB year 1, file ≤ 4 GB (AM-01), dataset ≤ 50 GB | A-03; AM-01 |
| Currency | USD only, micro-USD integers | A-04 |
| Payments | Manual only; no transfer APIs | Part 3; FR-PAY-14 |
| Hosting | Containers without Kubernetes; single region | Part 6 |
| Legal | HA-01 … HA-04 approval before public launch | BL §2 |

## 11. External interfaces

| Interface | Protocol / library | Direction | Requirements | Failure behaviour |
|---|---|---|---|---|
| Object storage (SeaweedFS dev; Cloudflare R2 or AWS S3 prod) | S3 API (multipart upload, ListParts, presigned PUT/GET, versioning) via boto3 | API & workers ↔ storage; browser → storage (presigned) | FR-UPL-01…07, FR-DS-14, SEC-09, SEC-16, NFR-AVL-02 | `/readyz` 503; uploads resumable; tasks retried |
| ClamAV | clamd INSTREAM over TCP 3310 (internal network) | workers → clamd | FR-PROC-03, FR-MSG-05, FR-VER-01, FR-PAY-10 | Fail-closed: nothing becomes `ready`/visible until clean (NFR-AVL-05) |
| SMTP (Mailpit dev; Postmark/SES/Brevo prod) | SMTP submission with STARTTLS (587) or TLS (465) | worker → provider | FR-NOTIF-03…05 | Outbox retry ×5, then `failed` and an alert |
| Web browser | HTTPS JSON REST `/api/v1`, WebSocket `/api/v1/ws` | browser ↔ API | BL §12, FR-MSG-07, SEC-03/04 | Envelope errors §9; WS → 30 s polling fallback |
| Sentry (optional) | HTTPS SDK | API/web → Sentry | NFR-OBS-03 | Non-blocking |
| Prometheus scraper | HTTP `/metrics` (internal) | monitor → API/worker | NFR-OBS-02 | n/a |
| Payment channels (banks, ABA Pay, Wise, PayPal) | **None (manual)**. Admins operate them outside DataHub | — | FR-PAY-10, FR-PAY-14 | n/a |

## 12. Acceptance requirements

Release acceptance requires every **Must** requirement to be verified by its stated method, with evidence linked in REQUIREMENTS_TRACEABILITY.md, and the following end-to-end scenarios (MASTER_PROMPT Part 20) passing on staging with test accounts and clearly marked test data:

| Scenario | Flow | Key requirements proven |
|---|---|---|
| S1 | Register → verify email → onboarding → upload → review → approve → earnings visible | FR-AUTH-01/03, FR-USER-02, FR-UPL-01…05, FR-PROC-01…03, FR-REV-02/09/10, FR-FIN-04/08/11 |
| S2 | Payout request → admin approves (dual ≥ $100) → mark paid with reference → contributor sees transaction | FR-PAY-01/08/10/13, FR-FIN-10/11 |
| S3 | Admin assigns document → annotator transcribes Khmer → reviewer approves → admin exports | FR-ANN-03/05/10/12/14/16, FR-FIN-15, FR-EXP-01…04 |
| S4 | User attempts to access another contributor's dataset → denied | FR-DS-03, FR-DS-13, SEC-08 |
| S5 | Duplicate content uploaded → flagged → earns 0 | FR-PROC-11, FR-FIN-05/06 |
| S6 | Large upload disconnects → resumes → no corruption | FR-UPL-04/10/11, NFR-UPL-02/03 |
| S7 | Repeated finalize request → no duplicate wallet transactions | FR-REV-10, FR-PAY-03, NFR-INT-02 |
| S8 | Backup restored in isolation → integrity verified (reconciliation passes) | NFR-AVL-02/03, FR-FIN-13 |

Further gates: NFR-ACC-01 report; NFR-PERF-01 load-test report; SEC-20 scan reports; SEC-22 security test report; 7-day staging soak with 0 reconciliation mismatches (FR-FIN-13) and ≥ 99 % upload success (NFR-UPL-01).

## 13. Traceability: business requirements → SRS

| BR | Requirements |
|---|---|
| BR-01 | FR-AUTH-01, 03, 04, 05; FR-USER-02, 03 |
| BR-02 | FR-VER-01…07; FR-USER-08 |
| BR-03 | FR-ADM-02; FR-AUTH-05; SEC-21 |
| BR-04 | FR-AUTH-14; FR-ADM-03; SEC-07; NFR-INT-10 |
| BR-05 | FR-UPL-01…12; FR-DS-06, 07; FR-PROC-05; NFR-UPL-01…05 |
| BR-06 | FR-PROC-01…09; FR-DS-14; FR-UPL-08; SEC-10, 11 |
| BR-07 | FR-DS-02, 03, 13, 14; FR-ANN-08; FR-VER-07; FR-AUD-04; SEC-08, 09 |
| BR-08 | FR-DS-01, 08 |
| BR-09 | FR-REV-01…15; FR-DS-04, 08 |
| BR-10 | FR-REV-06, 07, 12; FR-DS-11 |
| BR-11 | FR-FIN-01…04; FR-DS-10; FR-REV-08 |
| BR-12 | FR-FIN-05, 06, 16; FR-PROC-05, 11, 12 |
| BR-13 | FR-FIN-07, 16; FR-REV-04 |
| BR-14 | FR-FIN-08…13; FR-PAY-03, 04; NFR-INT-01…03 |
| BR-15 | FR-PAY-01, 05, 06, 09, 10, 14; FR-USER-04 |
| BR-16 | FR-PAY-01, 02, 07, 08; FR-USER-05 |
| BR-17 | FR-PAY-11, 12; FR-FIN-12 |
| BR-18 | FR-ANN-01…07, 18, 20 |
| BR-19 | FR-ANN-09…14 |
| BR-20 | FR-ANN-15…17, 19; FR-EXP-01, 03 |
| BR-21 | FR-ANN-16, 17; FR-FIN-15 |
| BR-22 | FR-MSG-01…08 |
| BR-23 | FR-NOTIF-01…06; FR-REV-12; FR-PAY-13; NFR-PERF-05 |
| BR-24 | FR-EXP-01…07; FR-ADM-05, 16; NFR-INT-09 |
| BR-25 | FR-ADM-06, 07, 16, 17; FR-FIN-14 |
| BR-26 | FR-AUD-01…05; FR-ADM-17 |
| BR-27 | FR-ADM-03, 08, 09; FR-FIN-01 |
| BR-28 | FR-DS-05, 12; FR-USER-07; FR-ADM-10, 11, 13, 14, 18, 20 |
| BR-29 | FR-ANN-12; FR-PROC-10; NFR-ACC-06, 07 |
| BR-30 | SEC-01…22; FR-AUTH-02, 06…13; NFR-OBS-05 |
| BR-31 | NFR-AVL-01…05; NFR-OBS-04; FR-ADM-12, 15, 19 |
| BR-32 | NFR-ACC-01…05; NFR-PERF-04 |
| BR-33 | NFR-INT-10 (contract-first API), BL §4 module boundaries (validated in SAD review), FR-FIN-09 (system wallets incl. reserved `system_payouts_settled`) |
| BR-34 | FR-FIN-14; FR-ADM-06; FR-REV-05 |
