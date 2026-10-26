# DataHub — API Documentation

| Field | Value |
|---|---|
| **Purpose** | Human-readable contract for the DataHub REST + WebSocket API: conventions every endpoint follows, the complete error-code catalogue, rate limits, the WebSocket protocol, and a reference entry (access, example request/response, validation, status codes, errors) for every endpoint in `ENGINEERING_BASELINE.md` §12. |
| **Scope** | All endpoints under `/api/v1` served by `apps/api` (FastAPI modular monolith), including health probes and `WS /api/v1/ws`. Out of scope: S3 presigned-URL semantics beyond what the client must send (see `FILE_UPLOAD_STORAGE.md`), auth internals (see `AUTH_AUTHORIZATION.md`), v2 buyer/orders API. |
| **Assumptions** | A-01…A-15 of the baseline. Web app and API share one origin (`/api/*` proxied by Caddy in production, Next.js rewrites in development), so cookies are first-party. Single API version `v1`. Clients are the DataHub web app and operator scripts; no third-party API consumers in v1. |
| **Decisions** | Cookie sessions + CSRF double-submit (no bearer tokens in v1). Offset pagination (`page`/`page_size`). Error envelope `{"error":{code,message,details,request_id}}` with stable dotted codes. Money = integer `*_micros`, sizes = integer `*_bytes`. `Idempotency-Key` on financial POSTs (required on `POST /payouts`). Optimistic locking via `version` + `If-Match` (412), except annotation drafts (409 with server copy, baseline §11). Request bodies reject unknown fields. |
| **Dependencies** | `ENGINEERING_BASELINE.md` (§3, §6–§9, §11, §12), `openapi.yaml` (machine-readable twin of this document), `AUTH_AUTHORIZATION.md`, `FILE_UPLOAD_STORAGE.md`, Database Schema and LLD documents. |
| **Acceptance criteria** | (1) Every §12 endpoint appears in §10 and in `openapi.yaml` (verified by script: 146 operations; §12 + amendments AM-04, 0 missing). (2) Every error code an endpoint can return is in the §6 catalogue. (3) `openapi.yaml` passes `openapi-spec-validator` (OpenAPI 3.1). (4) CI contract test diffs the FastAPI-generated spec against `openapi.yaml`; any undocumented path, status or field fails the build. (5) Authorization matrix tests cover every endpoint × role (see `AUTH_AUTHORIZATION.md` §14). |

**Document control:** Version 1.1 · 2026-10-26 · Status: Baseline (v1.1 — baseline §16 amendments AM-01…AM-14 applied) · Owner: Backend lead · Change process: amendments via `DECISION_LOG.md`; `openapi.yaml` and this file change in the same pull request.

---

## Contents

1. Overview and base URL
2. Authentication and sessions
3. CSRF and origin protection
4. Data formats
5. Pagination, filtering and sorting
6. Errors and the error-code catalogue
7. Idempotency and optimistic locking
8. Rate limits
9. WebSocket protocol
10. Endpoint reference (index + 17 modules)
11. Versioning, deprecation and spec reconciliation

---

## 1. Overview and base URL

| Environment | Web origin | API base URL |
|---|---|---|
| Local development | `http://localhost:3410` | `http://localhost:3410/api/v1` (Next.js rewrite → `datahub_api:8410`); direct `http://localhost:8410/api/v1` for scripts |
| Production | Production web origin (domain is approval item HA-05), served by Caddy 2 with automatic HTTPS | Path `/api/v1` on the **same origin** as the web app; clients use relative URLs, so no host is hard-coded |

- Transport: HTTPS only in production (HSTS `max-age=31536000; includeSubDomains`). HTTP requests are redirected by Caddy; the API itself refuses to set `Secure` cookies over plain HTTP outside `ENV=development`.
- Content type: `application/json; charset=utf-8` for all bodies except the three documented `multipart/form-data` endpoints (verification ID document, message attachment, payout proof). Large dataset files **never** pass through the API — they go browser → S3 with presigned URLs.
- Every response carries `X-Request-ID` (client value echoed when it matches `^[A-Za-z0-9._-]{1,64}$`, otherwise a server-generated ULID prefixed `req_`). It is logged with every structured log line and returned in the error envelope.
- Security headers on every API response: `Cache-Control: no-store` (except `/public/*`: `public, max-age=60`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (JSON responses).
- CORS: the API is same-origin. `CORS_ALLOWED_ORIGINS` contains only the web origin; credentialed cross-origin requests from any other origin are rejected (no `Access-Control-Allow-Origin` emitted, and the CSRF Origin check fails).

## 2. Authentication and sessions

Summary (normative detail in `AUTH_AUTHORIZATION.md`):

- `POST /auth/login` sets `dh_session` — an opaque 256-bit random token, base64url — as `HttpOnly; Secure; SameSite=Lax; Path=/`. The server stores only `SHA-256(token)` in `user_sessions`.
- Idle timeout: 7 days for users, 30 minutes for sessions of users holding `admin`/`super_admin`; absolute lifetime 30 days for users, 12 hours for admin-role sessions (baseline AM-08). Each authenticated request slides `last_seen_at` (written at most once per minute).
- Session id is rotated on login, MFA verification, password change and role change.
- Users with MFA enabled (mandatory for admin/super_admin) get an **MFA-pending** session from `/auth/login` and must call `POST /auth/mfa/verify`. Admin endpoints (`/admin/*`, `/annotation/projects*`, assignment endpoints, `/pricing-rules`) require an MFA-verified session.
- **Step-up:** endpoints marked *step-up* additionally require `mfa_verified_at` within the last 15 minutes; otherwise `403 auth.step_up_required`, after which the client calls `POST /auth/mfa/verify` and retries.
- Limited states: a `pending_email` user may call only `GET /auth/me`, `GET /auth/csrf`, `POST /auth/resend-verification`, `POST /auth/verify-email`, `POST /auth/logout`, `POST /auth/change-password`, own-session endpoints and MFA setup/enable/verify; anything else → `403 auth.email_unverified`.
- Failure responses: missing/unknown/revoked cookie → `401 auth.not_authenticated`; expired → `401 auth.session_expired`. The web app redirects to `/login?next=…` on 401.

## 3. CSRF and origin protection

Unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) — including unauthenticated ones such as login and register — require **all** of:

1. Cookie `dh_csrf` (Secure, SameSite=Lax, **not** HttpOnly so the app can read it) issued by `GET /auth/csrf`.
2. Header `X-CSRF-Token` equal to the cookie (constant-time compare).
3. A valid token signature: `token = nonce "." issued_at "." base64url(HMAC-SHA256(CSRF_SECRET, binding | nonce | issued_at))`, where `binding` is the session-id hash (or the anonymous pre-session id for logged-out forms). Tokens older than the session's absolute lifetime are invalid.
4. `Origin` header (or `Referer` when Origin is absent) matching `CORS_ALLOWED_ORIGINS`. Requests with neither header are rejected for cookie-authenticated unsafe methods.

Failure → `403 csrf.missing` or `403 csrf.invalid` and a `csrf_rejected` security event. The web client reads `dh_csrf` from `document.cookie` and attaches it in its fetch wrapper; on `csrf.*` it calls `GET /auth/csrf` once and retries. Login, logout, MFA verification and role/password changes rotate the token. `GET` endpoints never change state (presigned download URL for message attachments is a `GET` because issuing a URL is not a state change; file and export download URLs are `POST` because they are audited actions).

## 4. Data formats

| Concern | Rule |
|---|---|
| Encoding | UTF-8 JSON. Text inputs are NFC-normalised and trimmed, **except** annotation `transcription`/`corrected_text`, which are stored byte-exact (baseline A-02, §11). Control characters (except `\n`, `\t`) are rejected in single-line fields. |
| Identifiers | UUID (v7-style, generated by the app), lower-case canonical string. URLs and foreign keys always use the UUID. Datasets, payouts and export jobs additionally carry an immutable human reference `code` (`DS-YYYY-NNNNNN`, `PO-YYYY-NNNNNN`, `EX-YYYY-NNNNNN`; sequence per prefix per calendar year, baseline AM-07) shown in the UI and searchable via `q`; codes are never accepted in paths. |
| Timestamps | RFC 3339 / ISO 8601 in UTC with `Z` (`2026-10-26T08:30:00Z`). Dates (`date_of_birth`, analytics range) are `YYYY-MM-DD`. |
| Money | Integer micro-USD in fields ending `_micros` (1 USD = 1,000,000). Never floats. Payout amounts are whole cents (multiple of 10,000). Rates are `rate_micros_per_gb` (raw 1,000,000; labeled 1,500,000). Clients format by integer division; display rounds **down** to cents. |
| Sizes | Integer bytes in fields ending `_bytes`. 1 GB = 1,000,000,000 bytes (decimal) for pricing; part sizes are binary (16 MiB = 16,777,216). |
| Nulls | Optional response fields are present with `null` rather than omitted. In PATCH bodies, an omitted field is unchanged and `null` clears a nullable field. |
| Unknown fields | Request bodies are strict (`extra="forbid"`): unknown fields → `422 validation_error`. Responses may gain new fields in a minor release; clients must ignore unknown fields. |
| Enums | Lower-case snake_case strings; status values exactly match baseline §9. |
| Body size | JSON bodies ≤ 1 MiB (annotation drafts ≤ 2 MiB); multipart ≤ 10 MB + 64 KiB envelope. Larger → `413 request.payload_too_large`. |
| Booleans in query | `true` / `false` only. Multi-value filters: every `status` / `*_status` filter accepts a comma-separated list (`?status=submitted,in_review`, baseline AM-05); repeated keys (`?status=submitted&status=in_review`) are also accepted. |

## 5. Pagination, filtering and sorting

- **Pagination:** `?page=1&page_size=25`. `page` ≥ 1 (≤ 10,000), `page_size` 1–100 (default 25). Response:
  ```json
  {"items": [ … ], "page": 1, "page_size": 25, "total": 312}
  ```
  `total` is an exact `COUNT(*)` for lists under 100,000 rows; for the audit log and ledger it is capped at 100,000 (the UI shows "100,000+"). A page past the end returns `items: []` with the real `total` (not 404).
- **Filtering:** explicit, documented query parameters only (no generic filter language). Unknown query parameters are ignored; invalid values → `422 validation_error`. Date ranges use `from` (inclusive) and `to` (exclusive) on `created_at` unless the endpoint states otherwise. `q` is case-insensitive search (Postgres trigram / `simple` full-text), max 200 chars.
- **Sorting:** `?sort=-created_at` or `?sort=status,-submitted_at` (≤ 3 keys). Allowed fields per endpoint are listed in §10 and in `x-sortable-fields` in `openapi.yaml`; others → `422 validation_error`. `id` is appended as a deterministic tie-breaker. Default sort is `-created_at` unless stated.
- Non-paginated small collections (sessions, payout methods, pricing rules, settings, roles, contributor review feedback) return `{"items": [...]}`.

## 6. Errors

### 6.1 Envelope

Every non-2xx/3xx response has this shape (also for 404 on unknown routes and 405 on wrong methods):

```json
{
  "error": {
    "code": "payout.insufficient_balance",
    "message": "Amount exceeds your available balance.",
    "details": {"available_micros": 12367001, "requested_micros": 20000000},
    "request_id": "req_01JBA7Q4M8"
  }
}
```

- `code` is stable and machine-readable; clients branch on it, never on `message`.
- `message` is safe English text for display; the web app maps codes to translated strings where available.
- `details` is `null` or a code-specific object. Validation errors use `details.fields`:
  ```json
  {"error": {"code": "validation_error", "message": "One or more fields are invalid.",
    "details": {"fields": [{"loc": ["body", "amount_micros"], "msg": "must be a multiple of 10000", "type": "multiple_of"}]},
    "request_id": "req_01JBA7Q4M9"}}
  ```
- `500` responses never include stack traces or exception text; `details` is `null`.
- **No existence leaks:** a resource the caller may not see returns `404 resource.not_found`, identical to a missing one. `403 permission.denied` is used only when the caller can legitimately know the resource exists (e.g. an owner trying an admin-only action on their own dataset, or a role lacking an entire endpoint).

### 6.2 HTTP status usage

| Status | Meaning in DataHub |
|---|---|
| 200 / 201 / 202 / 204 | Success / created (with `Location` where useful) / accepted for async work / no body |
| 302 | Preview redirect to a presigned URL |
| 400 | Malformed request, bad/expired single-use token, missing mandatory header |
| 401 | Not authenticated / session expired / wrong credentials or MFA code |
| 403 | Authenticated but not allowed: permission, CSRF, MFA/step-up, unverified email, suspended, separation of duties |
| 404 | Not found or not visible |
| 409 | Conflicts with current state (state machine, duplicates, concurrent claims, version conflict for annotations, balance) |
| 412 | `If-Match` version mismatch |
| 413 | Body or declared upload exceeds a size limit or quota |
| 415 | Wrong Content-Type or disallowed file type |
| 422 | Semantically invalid input (field validation, business rule on input values) |
| 429 | Rate limited or account temporarily locked (`Retry-After` set) |
| 500 | Unexpected server error (or storage provider failure after retries) |
| 503 | `readyz`: required dependency down; **maintenance mode** (AM-06): every non-exempt endpoint returns `503 service_unavailable` with `details.reason = "maintenance"` and `Retry-After` |

### 6.3 Error-code catalogue

| Code | HTTP | Default message | Raised when |
|---|---|---|---|
| `request.malformed` | 400 | The request body is not valid JSON or has the wrong shape. | Unparseable JSON, wrong Content-Type charset, duplicate multipart fields. |
| `request.unsupported_media_type` | 415 | Unsupported Content-Type. | Body is not application/json (or multipart/form-data where documented). |
| `request.payload_too_large` | 413 | Request body too large. | JSON body > 1 MiB, or multipart body above the endpoint limit. |
| `validation_error` | 422 | One or more fields are invalid. | Schema/field validation failure; details.fields = [{loc,msg,type}]. |
| `resource.not_found` | 404 | Not found. | Unknown id, or a resource the caller may not see (no existence leak). |
| `precondition.required` | 400 | If-Match header is required. | Endpoint mandates optimistic locking but If-Match is missing. |
| `precondition.failed` | 412 | The resource was modified by someone else. | If-Match version ≠ current version (details.current_version). |
| `idempotency.key_invalid` | 400 | Idempotency-Key is malformed. | Not 8–128 chars of [A-Za-z0-9_-]. |
| `idempotency.key_required` | 400 | Idempotency-Key header is required. | Missing on POST /payouts. |
| `idempotency.key_reused` | 422 | Idempotency-Key was already used with a different request. | Same key, different body hash, within 24 h. |
| `idempotency.in_progress` | 409 | A request with this Idempotency-Key is still being processed. | Concurrent duplicate submission. |
| `rate_limited` | 429 | Too many requests. Try again later. | Any rate-limit bucket exhausted; Retry-After header set. |
| `internal_error` | 500 | Something went wrong. Quote the request id if you contact support. | Unhandled exception; details always null. |
| `service_unavailable` | 503 | Service temporarily unavailable. | readyz dependency down; or `maintenance_mode` is on and the endpoint is not maintenance-exempt (details.reason = "maintenance", Retry-After set). |
| `auth.not_authenticated` | 401 | Sign in to continue. | No/unknown/revoked session cookie. |
| `auth.session_expired` | 401 | Your session has expired. Sign in again. | Idle or absolute timeout reached. |
| `auth.invalid_credentials` | 401 | Email or password is incorrect. | Wrong email or password (identical response for both). |
| `auth.account_locked` | 429 | Too many failed sign-in attempts. Try again later. | 5 failures within 15 min → 15 min lock; details.retry_after_seconds. |
| `auth.account_suspended` | 403 | This account is suspended. Contact support. | Login or request by a suspended user (after password verified). |
| `auth.account_inactive` | 403 | This account is no longer active. | deactivated/anonymized account. |
| `auth.email_unverified` | 403 | Verify your email address first. | pending_email user calls anything except verify/resend/logout/me/csrf. |
| `auth.onboarding_required` | 403 | Complete onboarding (agreement and rights declaration) first. | Upload/dataset creation before POST /me/onboarding. |
| `auth.mfa_required` | 403 | Two-factor verification required. | Session not MFA-verified on an admin endpoint, or MFA-pending session calls anything except mfa/verify, logout, me, csrf. |
| `auth.mfa_enrollment_required` | 403 | Set up two-factor authentication to continue. | Admin/super_admin without MFA enabled. |
| `auth.step_up_required` | 403 | Re-enter your two-factor code to confirm this action. | Financial/privileged action and mfa_verified_at older than 15 min. |
| `auth.mfa_invalid_code` | 401 | The verification code is incorrect or expired. | Wrong TOTP (±1 step), reused TOTP step, or unknown/used recovery code. |
| `auth.mfa_already_enabled` | 409 | Two-factor authentication is already enabled. | setup/enable when enabled. |
| `auth.mfa_not_set_up` | 409 | Start two-factor setup first. | enable without a pending setup secret, or disable when MFA is off. |
| `auth.mfa_cannot_disable` | 403 | Two-factor authentication is mandatory for your role. | admin/super_admin calls mfa/disable. |
| `auth.token_invalid` | 400 | This link is invalid or has already been used. | Unknown/used/purpose-mismatched verification or reset token. |
| `auth.token_expired` | 400 | This link has expired. Request a new one. | Token past expires_at. |
| `auth.email_already_verified` | 409 | Email already verified. | resend-verification for a verified user. |
| `auth.password_policy` | 422 | Password does not meet the policy. | <12 chars, >128 chars, equals email, in common/breached list; details.reasons. |
| `auth.current_password_invalid` | 422 | Current password is incorrect. | change-password, mfa setup/disable, payout-method create. |
| `csrf.missing` | 403 | Security token missing. Reload the page. | Unsafe method without X-CSRF-Token or dh_csrf cookie. |
| `csrf.invalid` | 403 | Security token invalid. Reload the page. | Header ≠ cookie, bad HMAC, bound to another session, or Origin not allowed. |
| `permission.denied` | 403 | You do not have permission to do this. | Missing permission code or failed resource rule. |
| `permission.separation_of_duties` | 403 | You cannot act on your own item. | Self-review, self-approval/payment of payout, self role change, self adjustment. |
| `account.deletion_blocked` | 409 | Account cannot be deleted while a payout is open or a dataset is in review. | Open payout or in_review dataset. |
| `account.deletion_pending` | 409 | A deletion request is already pending. | Duplicate deletion request. |
| `verification.already_pending` | 409 | Your verification is already under review. | Resubmit while pending. |
| `verification.already_approved` | 409 | You are already verified. | Submit while approved. |
| `verification.invalid_state` | 409 | This verification has already been decided. | Decision on non-pending verification. |
| `verification.underage` | 422 | You must be at least 18 years old. | date_of_birth < 18 years ago. |
| `payout_method.in_use` | 409 | This payout method is used by an open payout. | Delete method referenced by requested/approved payout. |
| `payout_method.limit_reached` | 409 | Maximum of 5 payout methods. | 6th method. |
| `payout_method.invalid_details` | 422 | Payout method details are incomplete for this type. | Per-type details validation. |
| `dataset.invalid_state` | 409 | This action is not allowed in the dataset's current status. | State-machine violation; details.status, details.allowed_from. |
| `dataset.not_editable` | 409 | The dataset can only be edited while in draft or changes requested. | PATCH/file delete/upload outside draft/changes_requested. |
| `dataset.files_not_terminal` | 409 | Some files are still uploading or processing. | Submit with non-terminal files or open upload sessions; details.pending_file_ids. |
| `dataset.no_ready_files` | 409 | At least one file must be processed successfully. | Submit with zero ready files. |
| `dataset.file_limit_exceeded` | 409 | Datasets are limited to 2,000 files. | Upload init beyond max_files_per_dataset. |
| `upload.file_too_large` | 413 | File exceeds the 4 GB (4,000,000,000 bytes) limit. | size_bytes > max_file_bytes. |
| `upload.dataset_too_large` | 413 | Dataset would exceed the 50 GB limit. | Σ dataset bytes + size_bytes > max_dataset_bytes. |
| `upload.quota_exceeded` | 413 | You have reached your 200 GB unreviewed-storage quota. | Σ unreviewed bytes + size_bytes > user_pending_quota_bytes; details.used_bytes, details.quota_bytes. |
| `upload.type_not_allowed` | 415 | This file type is not accepted. | Extension not in allow-list or extra_allowed_extensions (pre-check only; real check by magic bytes). |
| `upload.invalid_state` | 409 | This upload is no longer active. | Part URLs/complete on completed/aborted/expired session. |
| `upload.expired` | 409 | This upload session has expired. Start again. | expires_at passed (24 h). |
| `upload.part_number_invalid` | 422 | Part number out of range. | part_number < 1 or > part_count. |
| `upload.parts_mismatch` | 422 | Uploaded parts do not match the expected file. | Missing parts, ETag mismatch vs ListParts, size sum ≠ size_bytes; details.missing_parts. |
| `upload.storage_unavailable` | 500 | Storage temporarily unavailable. Retry. | S3 error on presign/complete after retries. |
| `file.not_ready` | 409 | This file has not finished processing. | Preview/text/download before ready. |
| `file.no_preview` | 404 | No preview available for this file or page. | Format has no preview or page out of range. |
| `file.unavailable` | 409 | This file is quarantined or unavailable. | Download/preview of quarantined/infected/taken-down file. |
| `review.already_claimed` | 409 | Another reviewer has claimed this dataset. | Concurrent claim. |
| `review.claim_limit_reached` | 409 | You already hold the maximum number of active review claims. | Reviewer holds review_max_active_claims (default 5) in_progress reviews (AM-09); details.limit. |
| `review.invalid_state` | 409 | This review is not in progress. | Edits on finalized/released review. |
| `review.not_assignee` | 403 | This review is assigned to another reviewer. | Non-assignee reviewer edits (admins may view only). |
| `review.incomplete` | 422 | Every reviewable file needs a decision. | Finalize with undecided files; details.undecided_file_ids. |
| `review.decision_inconsistent` | 422 | Decision does not match file decisions. | approve with rejected files, partial without both, reject with accepted files; details.allowed_decisions. |
| `review.feedback_required` | 422 | Feedback is required for this decision. | Non-approve decision with feedback < 10 chars. |
| `review.reason_required` | 422 | A reason code is required to reject a file. | decision=rejected without reason_code. |
| `review.file_not_reviewable` | 422 | This file cannot be reviewed. | Container ZIP, failed or quarantined file. |
| `review.labeled_upgrade_not_applicable` | 422 | Labeled upgrade only applies to files previously paid at the raw rate in a labeled dataset. | labeled_upgrade=true when not eligible or HA-08 disabled. |
| `payout.insufficient_balance` | 409 | Amount exceeds your available balance. | amount > available after row lock; details.available_micros. |
| `payout.open_request_exists` | 409 | You already have an open withdrawal request. | requested/approved payout exists. |
| `payout.amount_below_minimum` | 422 | Amount is below the minimum withdrawal. | < payout_min_micros. |
| `payout.amount_above_maximum` | 422 | Amount is above the maximum withdrawal. | > payout_max_micros. |
| `payout.amount_not_whole_cents` | 422 | Amount must be whole cents. | amount_micros % 10000 ≠ 0. |
| `payout.verification_required` | 403 | Contributor verification must be approved before withdrawing. | verification_status ≠ approved. |
| `payout.method_invalid` | 422 | Choose one of your payout methods. | payout_method_id not owned by caller or deleted. |
| `payout.invalid_state` | 409 | This payout cannot change from its current status. | State-machine violation. |
| `payout.already_approved_by_you` | 409 | You have already approved this payout. | Second approval by same admin. |
| `payout.reference_duplicate` | 409 | This payment reference is already recorded for this method. | Unique (method, payment_reference). |
| `payout.paid_at_invalid` | 422 | Payment date cannot be in the future or before approval. | paid_at > now+5 min or < approved_at. |
| `payout.proof_invalid` | 415 | Proof must be a PDF, PNG or JPEG up to 10 MB. | Wrong type/size of proof file. |
| `finance.adjustment_negative_balance` | 409 | Debit would make the available balance negative. | Debit > available. |
| `pricing.overlap` | 409 | A pricing rule already starts at that time. | Exclusion constraint on (data_class, effective_from). |
| `pricing.effective_from_in_past` | 422 | New rates must take effect in the future. | effective_from < now. |
| `annotation.version_conflict` | 409 | This annotation was changed elsewhere. | If-Match ≠ current version; details.server_annotation contains the current copy. |
| `annotation.not_assignee` | 403 | This task is assigned to someone else. | Non-assignee write/start/submit. |
| `annotation.invalid_state` | 409 | This task cannot do that in its current status. | State-machine violation. |
| `annotation.validation_failed` | 422 | The annotation is incomplete or invalid. | Required metadata missing, label not in label_set, page out of range, bbox in v1. |
| `annotation.project_closed` | 409 | This project is closed. | Mutations on closed project. |
| `annotation.annotator_ineligible` | 422 | This user cannot be assigned annotation tasks. | No annotator role, not active, or verification not approved. |
| `annotation.dataset_ineligible` | 422 | Only approved or partially approved datasets can be annotated. | Source dataset status/format check. |
| `annotation.immutable_field` | 409 | This setting cannot change after tasks exist. | task_unit/annotation_types change with tasks. |
| `annotation.already_claimed` | 409 | Another reviewer has claimed this task. | Concurrent review claim. |
| `annotation.comments_required` | 422 | Comments are required when requesting changes. | request_changes without comments. |
| `message.attachment_too_large` | 413 | Attachments are limited to 10 MB. | Attachment > 10 MB. |
| `message.attachment_type_not_allowed` | 415 | This attachment type is not allowed. | Magic-byte type outside attachment allow-list. |
| `message.attachment_unavailable` | 409 | This attachment is still being scanned or was blocked. | download-url before clean / infected; or attachment not owned/unused. |
| `message.conversation_closed` | 409 | This conversation is closed. | Staff message to closed conversation (contributor message reopens instead). |
| `user.invalid_state` | 409 | This account cannot change from its current status. | Suspend suspended / reactivate active, etc. |
| `user.role_escalation_forbidden` | 403 | Only a super administrator can grant or remove administrative roles. | admin edits admin/super_admin roles. |
| `user.last_super_admin` | 409 | At least one active super administrator must remain. | Removing/suspending the last super_admin. |
| `takedown.invalid_state` | 409 | This takedown request has already been decided. | Decision on a request in actioned/rejected/withdrawn, or a transition not allowed from the current status (details.status). |
| `takedown.dataset_not_taken_down` | 409 | Take the dataset down before marking the request actioned. | decision=actioned, linked dataset not taken_down and apply_takedown=false. |
| `takedown.no_target` | 422 | This request is not linked to a dataset. | decision=actioned with apply_takedown=true but dataset_id is null (set it with dataset_id in the decision). |
| `export.not_ready` | 409 | This export has not completed. | download-url before completed. |
| `export.expired` | 409 | This export has expired. Create a new one. | download-url after expires_at. |
| `export.empty_selection` | 422 | No datasets match the selection. | Filters match zero approved/partially approved datasets. |
| `settings.unknown_key` | 404 | Unknown setting. | PUT on a key outside the registry. |
| `settings.invalid_value` | 422 | Invalid value for this setting. | Type/range check failure; details.constraint. |

### 6.4 Maintenance mode (baseline AM-06)

Super-admins switch the `maintenance_mode` system setting (boolean, default `false`) with `PUT /admin/settings/maintenance_mode` (step-up, audited). While it is `true`, a middleware placed before routing answers every request whose path is **not** exempt with:

```json
{"error": {"code": "service_unavailable", "message": "Service temporarily unavailable.", "details": {"reason": "maintenance"}, "request_id": "req_01JBA7Q4M8"}}
```

(HTTP 503, `Retry-After: 300`). Exempt: `/healthz`, `/readyz`, `/metrics`, `/auth/*`, `/admin/*` and the other admin-MFA endpoints (`x-admin-mfa: true`, e.g. `/pricing-rules`, annotation project management), so administrators can sign in and turn the flag off. The WebSocket upgrade (`/api/v1/ws`) is refused with 503 as well; already-open sockets are left to expire with their sessions. Each operation in `openapi.yaml` carries `x-maintenance-exempt`. The web app shows the maintenance page (UI page 64) on any 503 with `details.reason = "maintenance"`. The setting is read through the 30-second settings cache, so the switch takes effect within 30 s.

## 7. Idempotency and optimistic locking

### 7.1 Idempotency-Key

- Accepted on: `POST /payouts` (**required**), `POST /payouts/{id}/cancel`, `POST /reviews/{id}/finalize`, `POST /admin/payouts/{id}/approve|reject|mark-paid|mark-failed|cancel|reverse`, `POST /admin/adjustments`, `POST /admin/pricing-rules`, `POST /annotation/tasks/{id}/review`.
- Format: 8–128 chars `[A-Za-z0-9_-]`; the web app uses a UUID v4 generated when the confirmation dialog opens (so double clicks and retries reuse it).
- Server behaviour: key scoped to `(user_id, method, route template)`, stored in Redis for 24 h with SHA-256 of the canonical body and, after completion, the status + response body. Same key + same body → stored response replayed with `Idempotent-Replayed: true`. Same key + different body → `422 idempotency.key_reused`. Same key while the first request is still running → `409 idempotency.in_progress`. For `POST /payouts` the key is also persisted in `payout_requests.client_idempotency_key` (unique per user), so the guarantee survives Redis loss.
- Independently of the header, every ledger write uses a deterministic journal idempotency key (`dataset_review:{review_id}:earning`, `payout:{id}:reserve|release|settle|reversal`, `annotation_review:{id}:reward`, `adjustment:{id}`) with a unique constraint, so retries can never double-credit.

### 7.2 Optimistic locking

- Mutable aggregates expose an integer `version` and an `ETag: "<version>"` header: profile, dataset, review, annotation project, system setting, annotation.
- `If-Match` is **optional** on `PATCH /me/profile`, `PATCH /datasets/{id}`, `PATCH /reviews/{id}`, `PATCH /annotation/projects/{id}`, `PUT /admin/settings/{key}`, `POST /annotation/tasks/{id}/submit`; when sent and stale → `412 precondition.failed` with `details.current_version`. The web app always sends it from edit forms.
- `If-Match` is **required** on `PUT /annotation/tasks/{id}/draft` (missing → `400 precondition.required`); stale → `409 annotation.version_conflict` with `details.server_annotation` (full current `Annotation`) so the editor can show a merge/choose dialog (baseline §11).
- State transitions (submit, claim, finalize, approve, …) do not need `If-Match`: they lock the row (`SELECT … FOR UPDATE`) and validate the transition; a lost race yields `409 *.invalid_state` / `*.already_claimed`.

## 8. Rate limits

Implementation: Redis sliding-window counters (`core/ratelimit`), keyed per class by user id (authenticated) or client IP (from Caddy's `X-Forwarded-For`, trusting only the proxy hop). Every limited response carries `RateLimit: limit=…, remaining=…, reset=…`; a rejected request gets `429 rate_limited` with `Retry-After`. A global safety net of 1,200 requests/min per IP applies to all endpoints except health probes. If Redis is unavailable, auth-class limits fail **closed** (503-equivalent `service_unavailable` for login/register/forgot) and other classes fail open with an alert.

| Class | Limit | Applies to |
|---|---|---|
| `none` | Not rate-limited (health probes; internal metrics). | `GET /healthz`, `GET /readyz`, `GET /metrics` |
| `public` | 60 / min per IP. | `GET /auth/csrf`, `GET /public/pricing`, `GET /public/formats` |
| `contact` | 5 / h per IP. | `POST /public/contact`, `POST /public/takedown-requests` |
| `auth_register` | 5 / h per IP. | `POST /auth/register` |
| `auth_login` | 5 / min per (IP + email) and 20 / min per IP; account lockout after 5 failures within 15 min (locked 15 min). | `POST /auth/login` |
| `auth_mfa` | 5 / min per session and 20 / h per user; 10 consecutive failures revoke the MFA-pending session. | `POST /auth/mfa/verify`, `POST /auth/mfa/enable` |
| `auth_token` | 10 / h per IP (verify-email, reset-password). | `POST /auth/verify-email`, `POST /auth/reset-password` |
| `auth_resend` | 3 / h per user. | `POST /auth/resend-verification` |
| `auth_forgot` | 3 / h per email and 10 / h per IP (silently not sent above limit; response still 202). | `POST /auth/forgot-password` |
| `auth_password` | 5 / h per user (change-password, MFA setup/disable, payout-method create). | `POST /auth/change-password`, `POST /auth/mfa/setup`, `POST /auth/mfa/disable`, `POST /me/payout-methods` |
| `read` | 600 / min per user. | All other authenticated GETs (55 endpoints) |
| `write` | 120 / min per user. | All other authenticated unsafe methods (53 endpoints) |
| `autosave` | 60 / min per user per task. | `PUT /annotation/tasks/{task_id}/draft` |
| `upload` | 600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof). | `POST /me/verification`, `POST /datasets/{dataset_id}/uploads`, `POST /uploads/{upload_id}/part-urls`, `GET /uploads/{upload_id}`, `POST /uploads/{upload_id}/complete`, `DELETE /uploads/{upload_id}`, `POST /admin/payouts/{payout_id}/proof` |
| `download` | 120 / min per user (presigned URL issuance, preview redirects). | `GET /files/{file_id}/preview/{page}`, `POST /files/{file_id}/download-url`, `GET /attachments/{attachment_id}/download-url`, `POST /admin/exports/{export_id}/download-url` |
| `payout_request` | 10 / h per user. | `POST /payouts` |
| `messaging` | 30 / min per user. | `POST /conversations`, `POST /conversations/{conversation_id}/messages` |
| `attachment` | 60 / h per user. | `POST /conversations/{conversation_id}/attachments` |
| `export` | 10 / h per user. | `POST /admin/exports` |
| `ws` | 10 connection attempts / min per user; max 5 concurrent sockets per user. | `GET /ws` |

## 9. WebSocket protocol

**Endpoint:** `GET /api/v1/ws` with `Upgrade: websocket` (`wss://` in production). Purpose: push hints so the UI updates without polling. REST remains the source of truth; events carry enough data to render but clients must tolerate missed events.

### 9.1 Handshake and authentication

1. Browser opens `new WebSocket("/api/v1/ws")`; the `dh_session` cookie is sent automatically (same origin).
2. Server validates: session cookie (active, not MFA-pending, user `active`), `Origin` ∈ `CORS_ALLOWED_ORIGINS`, connection rate limit (class `ws`), ≤ 5 concurrent sockets per user.
3. On failure the server accepts then immediately closes with an application close code (browsers cannot read HTTP status of failed upgrades):

| Close code | Reason | Client action |
|---|---|---|
| 1000 | Normal closure (logout) | Do not reconnect |
| 1001 | Server going away (deploy/restart) | Reconnect with backoff |
| 1008 | Policy violation (malformed frames, oversize message) | Reconnect with backoff; report |
| 4401 | Not authenticated / session expired or revoked | Stop; route to login |
| 4403 | Origin not allowed, or account suspended | Stop |
| 4408 | Heartbeat timeout | Reconnect |
| 4429 | Too many connections / connection rate limit | Reconnect after ≥ 30 s |

4. On success the server sends:
```json
{"type": "hello", "id": "evt_01JBA8…", "ts": "2026-10-26T08:30:00Z", "data": {"user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01", "heartbeat_seconds": 25, "server_version": "1.0.0"}}
```

### 9.2 Frames

All frames are UTF-8 JSON text frames ≤ 64 KiB: `{"type": string, "id": string, "ts": RFC3339, "data": object}`.

Server → client events:

| type | When | data |
|---|---|---|
| `hello` | After connect | `user_id`, `heartbeat_seconds`, `server_version` |
| `message.created` | New message in a conversation the user participates in (or any support conversation for `message.support` holders) | `{conversation_id, message: Message}` (attachments listed with current `scan_status`) |
| `conversation.updated` | Status/assignment/subject change, or attachment scan finished | `{conversation: Conversation}` |
| `notification.created` | Notification row inserted for the user | `{notification: Notification, unread_count}` |
| `pong` | Reply to client `ping` | `{}` |
| `session.revoked` | Session revoked (logout elsewhere, password change, suspension) — sent just before close 4401 | `{reason}` |

Client → server frames (anything else → ignored; > 10 frames/s → close 1008):

| type | data | Effect |
|---|---|---|
| `ping` | `{}` | Server replies `pong` |
| `ack` | `{notification_ids: [uuid]}` (≤ 100) | Same as marking notifications read |

### 9.3 Delivery semantics

- Fan-out: services publish to Redis channels `ws:user:{user_id}` and `ws:support` **after** the DB transaction commits (transactional outbox row → publisher). Each API replica subscribes for its connected users.
- At-most-once, no replay. On (re)connect the client refetches `GET /notifications/unread-count` and the open conversation's latest page.
- Heartbeat: server sends a WebSocket ping control frame every 25 s; no pong in 60 s → close 4408. Client may send `ping` frames to detect half-open connections.
- Session checks: the server re-validates the session every 60 s and on `session.revoked` pub/sub signals, closing within 5 s of revocation.
- Reconnect policy (client): exponential backoff 1 s, 2 s, 4 s … max 30 s, ±20 % jitter; stop on 4401/4403.
- Authorization is enforced at publish time (only participants/staff are targeted) and again at the socket (event user must equal socket user, or socket user holds `message.support` for `ws:support`).

## 10. Endpoint reference

Conventions used below: **Access** lists the permission code (baseline §6) plus extra gates; *admin MFA session* means the session must be MFA-verified; *step-up* means MFA verified within 15 minutes; *CSRF* means `X-CSRF-Token` is required. "Common errors" are the cross-cutting codes from §§2–8 that apply to the endpoint; "Endpoint-specific errors" are business errors. Paths below include the `/api/v1` prefix. Examples are illustrative but schema-valid and use consistent ids across the document.

### 10.0 Index (146 operations)

| # | Method | Path | Permission | Notes |
|---|---|---|---|---|
| 1 | GET | `/api/v1/healthz` | `public` |  |
| 2 | GET | `/api/v1/readyz` | `public` |  |
| 3 | GET | `/api/v1/metrics` | `internal` |  |
| 4 | GET | `/api/v1/auth/csrf` | `public` |  |
| 5 | POST | `/api/v1/auth/register` | `public` |  |
| 6 | POST | `/api/v1/auth/login` | `public` |  |
| 7 | POST | `/api/v1/auth/mfa/verify` | `user` |  |
| 8 | POST | `/api/v1/auth/logout` | `user` |  |
| 9 | POST | `/api/v1/auth/verify-email` | `public` |  |
| 10 | POST | `/api/v1/auth/resend-verification` | `user` |  |
| 11 | POST | `/api/v1/auth/forgot-password` | `public` |  |
| 12 | POST | `/api/v1/auth/reset-password` | `public` |  |
| 13 | POST | `/api/v1/auth/change-password` | `user` |  |
| 14 | GET | `/api/v1/auth/me` | `user` |  |
| 15 | GET | `/api/v1/auth/sessions` | `user` |  |
| 16 | DELETE | `/api/v1/auth/sessions/{session_id}` | `user` |  |
| 17 | POST | `/api/v1/auth/sessions/revoke-others` | `user` |  |
| 18 | POST | `/api/v1/auth/mfa/setup` | `user` |  |
| 19 | POST | `/api/v1/auth/mfa/enable` | `user` |  |
| 20 | POST | `/api/v1/auth/mfa/disable` | `user` |  |
| 21 | GET | `/api/v1/me/profile` | `profile.self` |  |
| 22 | PATCH | `/api/v1/me/profile` | `profile.self` | If-Match optional |
| 23 | POST | `/api/v1/me/onboarding` | `profile.self` |  |
| 24 | GET | `/api/v1/me/payout-methods` | `payout.request` |  |
| 25 | POST | `/api/v1/me/payout-methods` | `payout.request` |  |
| 26 | DELETE | `/api/v1/me/payout-methods/{method_id}` | `payout.request` |  |
| 27 | GET | `/api/v1/me/verification` | `profile.self` |  |
| 28 | POST | `/api/v1/me/verification` | `profile.self` |  |
| 29 | POST | `/api/v1/me/deletion-request` | `profile.self` |  |
| 30 | GET | `/api/v1/me/notification-preferences` | `profile.self` |  |
| 31 | PATCH | `/api/v1/me/notification-preferences` | `profile.self` |  |
| 32 | GET | `/api/v1/public/pricing` | `public` |  |
| 33 | GET | `/api/v1/public/formats` | `public` |  |
| 34 | POST | `/api/v1/public/contact` | `public` |  |
| 35 | POST | `/api/v1/public/takedown-requests` | `public` |  |
| 36 | POST | `/api/v1/datasets` | `dataset.create` |  |
| 37 | GET | `/api/v1/datasets` | `dataset.read.own` |  |
| 38 | GET | `/api/v1/datasets/{dataset_id}` | `dataset.read.own` |  |
| 39 | PATCH | `/api/v1/datasets/{dataset_id}` | `dataset.create` | If-Match optional |
| 40 | DELETE | `/api/v1/datasets/{dataset_id}` | `dataset.create` |  |
| 41 | POST | `/api/v1/datasets/{dataset_id}/submit` | `dataset.create` |  |
| 42 | POST | `/api/v1/datasets/{dataset_id}/withdraw` | `dataset.create` |  |
| 43 | GET | `/api/v1/datasets/{dataset_id}/files` | `dataset.read.own` |  |
| 44 | DELETE | `/api/v1/datasets/{dataset_id}/files/{file_id}` | `dataset.create` |  |
| 45 | GET | `/api/v1/datasets/{dataset_id}/reviews` | `dataset.read.own` |  |
| 46 | GET | `/api/v1/datasets/{dataset_id}/estimate` | `dataset.read.own` |  |
| 47 | GET | `/api/v1/files/{file_id}` | `user` |  |
| 48 | GET | `/api/v1/files/{file_id}/preview/{page}` | `user` |  |
| 49 | GET | `/api/v1/files/{file_id}/text` | `user` |  |
| 50 | POST | `/api/v1/files/{file_id}/download-url` | `user` |  |
| 51 | POST | `/api/v1/datasets/{dataset_id}/uploads` | `dataset.create` |  |
| 52 | POST | `/api/v1/uploads/{upload_id}/part-urls` | `dataset.create` |  |
| 53 | GET | `/api/v1/uploads/{upload_id}` | `dataset.create` |  |
| 54 | POST | `/api/v1/uploads/{upload_id}/complete` | `dataset.create` |  |
| 55 | DELETE | `/api/v1/uploads/{upload_id}` | `dataset.create` |  |
| 56 | GET | `/api/v1/reviews/queue` | `dataset.review` |  |
| 57 | POST | `/api/v1/datasets/{dataset_id}/claim-review` | `dataset.review` |  |
| 58 | GET | `/api/v1/reviews/{review_id}` | `dataset.review` |  |
| 59 | PUT | `/api/v1/reviews/{review_id}/files/{file_id}` | `dataset.review` |  |
| 60 | POST | `/api/v1/reviews/{review_id}/files/bulk` | `dataset.review` |  |
| 61 | PATCH | `/api/v1/reviews/{review_id}` | `dataset.review` | If-Match optional |
| 62 | GET | `/api/v1/reviews/{review_id}/summary` | `dataset.review` |  |
| 63 | POST | `/api/v1/reviews/{review_id}/finalize` | `dataset.review` | Idempotency-Key optional |
| 64 | POST | `/api/v1/reviews/{review_id}/release` | `dataset.review` |  |
| 65 | GET | `/api/v1/reviews/history` | `dataset.review` |  |
| 66 | GET | `/api/v1/wallet` | `payout.request` |  |
| 67 | GET | `/api/v1/wallet/transactions` | `payout.request` |  |
| 68 | GET | `/api/v1/earnings` | `payout.request` |  |
| 69 | POST | `/api/v1/payouts` | `payout.request` | Idempotency-Key required |
| 70 | GET | `/api/v1/payouts` | `payout.request` |  |
| 71 | GET | `/api/v1/payouts/{payout_id}` | `payout.request` |  |
| 72 | POST | `/api/v1/payouts/{payout_id}/cancel` | `payout.request` | Idempotency-Key optional |
| 73 | GET | `/api/v1/admin/finance/overview` | `finance.read` | admin MFA |
| 74 | GET | `/api/v1/admin/payouts` | `finance.read` | admin MFA |
| 75 | GET | `/api/v1/admin/payouts/{payout_id}` | `finance.read` | admin MFA |
| 76 | POST | `/api/v1/admin/payouts/{payout_id}/approve` | `payout.approve` | admin MFA, step-up, Idempotency-Key optional |
| 77 | POST | `/api/v1/admin/payouts/{payout_id}/reject` | `payout.approve` | admin MFA, step-up, Idempotency-Key optional |
| 78 | POST | `/api/v1/admin/payouts/{payout_id}/mark-paid` | `payout.record_payment` | admin MFA, step-up, Idempotency-Key optional |
| 79 | POST | `/api/v1/admin/payouts/{payout_id}/mark-failed` | `payout.record_payment` | admin MFA, step-up, Idempotency-Key optional |
| 80 | POST | `/api/v1/admin/payouts/{payout_id}/cancel` | `payout.approve` | admin MFA, step-up, Idempotency-Key optional |
| 81 | POST | `/api/v1/admin/payouts/{payout_id}/reverse` | `finance.adjust` | admin MFA, step-up, Idempotency-Key optional |
| 82 | POST | `/api/v1/admin/payouts/{payout_id}/proof` | `payout.record_payment` | admin MFA |
| 83 | POST | `/api/v1/admin/adjustments` | `finance.adjust` | admin MFA, step-up, Idempotency-Key optional |
| 84 | GET | `/api/v1/admin/ledger` | `finance.read` | admin MFA |
| 85 | GET | `/api/v1/pricing-rules` | `finance.read` | admin MFA |
| 86 | POST | `/api/v1/admin/pricing-rules` | `pricing.manage` | admin MFA, step-up, Idempotency-Key optional |
| 87 | GET | `/api/v1/admin/finance/reconciliation` | `finance.read` | admin MFA |
| 88 | GET | `/api/v1/annotation/projects` | `annotation.manage` | admin MFA |
| 89 | POST | `/api/v1/annotation/projects` | `annotation.manage` | admin MFA |
| 90 | GET | `/api/v1/annotation/projects/{project_id}` | `annotation.manage` | admin MFA |
| 91 | PATCH | `/api/v1/annotation/projects/{project_id}` | `annotation.manage` | admin MFA, If-Match optional |
| 92 | POST | `/api/v1/annotation/projects/{project_id}/generate-tasks` | `annotation.manage` | admin MFA |
| 93 | POST | `/api/v1/annotation/projects/{project_id}/close` | `annotation.manage` | admin MFA |
| 94 | GET | `/api/v1/annotation/projects/{project_id}/tasks` | `annotation.manage` | admin MFA |
| 95 | POST | `/api/v1/annotation/tasks/{task_id}/assign` | `annotation.manage` | admin MFA |
| 96 | POST | `/api/v1/annotation/tasks/bulk-assign` | `annotation.manage` | admin MFA |
| 97 | POST | `/api/v1/annotation/tasks/{task_id}/unassign` | `annotation.manage` | admin MFA |
| 98 | GET | `/api/v1/annotation/my-tasks` | `annotation.work` |  |
| 99 | GET | `/api/v1/annotation/tasks/{task_id}` | `annotation.work` or `annotation.review` or `annotation.manage` |  |
| 100 | POST | `/api/v1/annotation/tasks/{task_id}/start` | `annotation.work` |  |
| 101 | PUT | `/api/v1/annotation/tasks/{task_id}/draft` | `annotation.work` | If-Match required |
| 102 | POST | `/api/v1/annotation/tasks/{task_id}/submit` | `annotation.work` | If-Match optional |
| 103 | GET | `/api/v1/annotation/tasks/{task_id}/versions` | `annotation.work` or `annotation.review` or `annotation.manage` |  |
| 104 | GET | `/api/v1/annotation/my-rewards` | `annotation.work` |  |
| 105 | GET | `/api/v1/annotation/review-queue` | `annotation.review` |  |
| 106 | POST | `/api/v1/annotation/tasks/{task_id}/claim-review` | `annotation.review` |  |
| 107 | POST | `/api/v1/annotation/tasks/{task_id}/review` | `annotation.review` | Idempotency-Key optional |
| 108 | GET | `/api/v1/annotation/reviews/history` | `annotation.review` |  |
| 109 | GET | `/api/v1/conversations` | `message.self` |  |
| 110 | POST | `/api/v1/conversations` | `message.self` |  |
| 111 | GET | `/api/v1/conversations/{conversation_id}` | `message.self` |  |
| 112 | PATCH | `/api/v1/conversations/{conversation_id}` | `message.self` |  |
| 113 | GET | `/api/v1/conversations/{conversation_id}/messages` | `message.self` |  |
| 114 | POST | `/api/v1/conversations/{conversation_id}/messages` | `message.self` |  |
| 115 | POST | `/api/v1/conversations/{conversation_id}/read` | `message.self` |  |
| 116 | POST | `/api/v1/conversations/{conversation_id}/attachments` | `message.self` |  |
| 117 | GET | `/api/v1/attachments/{attachment_id}/download-url` | `message.self` |  |
| 118 | GET | `/api/v1/ws` | `user` |  |
| 119 | GET | `/api/v1/notifications` | `profile.self` |  |
| 120 | GET | `/api/v1/notifications/unread-count` | `profile.self` |  |
| 121 | POST | `/api/v1/notifications/{notification_id}/read` | `profile.self` |  |
| 122 | POST | `/api/v1/notifications/read-all` | `profile.self` |  |
| 123 | GET | `/api/v1/admin/users` | `user.read` | admin MFA |
| 124 | GET | `/api/v1/admin/users/{user_id}` | `user.read` | admin MFA |
| 125 | POST | `/api/v1/admin/users/{user_id}/suspend` | `user.manage` | admin MFA, step-up |
| 126 | POST | `/api/v1/admin/users/{user_id}/reactivate` | `user.manage` | admin MFA, step-up |
| 127 | PUT | `/api/v1/admin/users/{user_id}/roles` | `user.manage` | admin MFA, step-up |
| 128 | POST | `/api/v1/admin/users/{user_id}/revoke-sessions` | `user.manage` | admin MFA, step-up |
| 129 | GET | `/api/v1/admin/verifications` | `user.verify` | admin MFA |
| 130 | POST | `/api/v1/admin/verifications/{verification_id}/decision` | `user.verify` | admin MFA |
| 131 | GET | `/api/v1/admin/datasets` | `dataset.read.any` | admin MFA |
| 132 | GET | `/api/v1/admin/datasets/{dataset_id}` | `dataset.read.any` | admin MFA |
| 133 | POST | `/api/v1/admin/datasets/{dataset_id}/takedown` | `dataset.read.any` | admin MFA, step-up |
| 134 | POST | `/api/v1/admin/files/{file_id}/rescan` | `dataset.read.any` | admin MFA |
| 135 | GET | `/api/v1/admin/takedown-requests` | `user.manage` | admin MFA |
| 136 | POST | `/api/v1/admin/takedown-requests/{takedown_id}/decision` | `user.manage` | admin MFA, step-up |
| 137 | POST | `/api/v1/admin/exports` | `dataset.export` | admin MFA, step-up |
| 138 | GET | `/api/v1/admin/exports` | `dataset.export` | admin MFA |
| 139 | GET | `/api/v1/admin/exports/{export_id}` | `dataset.export` | admin MFA |
| 140 | POST | `/api/v1/admin/exports/{export_id}/download-url` | `dataset.export` | admin MFA |
| 141 | GET | `/api/v1/admin/analytics/overview` | `analytics.read` | admin MFA |
| 142 | GET | `/api/v1/admin/audit-logs` | `audit.read` | admin MFA |
| 143 | GET | `/api/v1/admin/security-events` | `audit.read` | admin MFA |
| 144 | GET | `/api/v1/admin/settings` | `settings.manage` | admin MFA |
| 145 | PUT | `/api/v1/admin/settings/{key}` | `settings.manage` | admin MFA, step-up, If-Match optional |
| 146 | GET | `/api/v1/admin/roles` | `user.read` | admin MFA |

### 10.1 Health

#### `GET /api/v1/healthz` — Liveness probe

- **Access:** Public (no session)
- **Rate limit:** Not rate-limited (health probes; internal metrics).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Process is up. No dependency checks. Never rate-limited, never authenticated.

**Response `200 OK`** (`Health`):
```json
{"status": "ok", "version": "1.0.0", "time": "2026-10-26T08:30:00Z"}
```

**Status codes:** 200, 500

**Common errors:** `internal_error`

#### `GET /api/v1/readyz` — Readiness probe

- **Access:** Public (no session)
- **Rate limit:** Not rate-limited (health probes; internal metrics).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Checks Postgres (SELECT 1 + Alembic head), Redis PING, S3 HeadBucket, clamd PING. Returns **503** with the same body shape when any required check fails (ClamAV failure ⇒ `degraded`: API serves, processing pauses).

**Response `200 OK`** (`Readiness`):
```json
{"status": "ok", "checks": {"postgres": "ok", "redis": "ok", "s3": "ok", "clamav": "ok", "migrations": "ok"}}
```

**Status codes:** 200, 500, 503

**Endpoint-specific errors:** `service_unavailable` (503)

**Common errors:** `internal_error`

#### `GET /api/v1/metrics` — Prometheus metrics (internal only)

- **Access:** Internal network only
- **Rate limit:** Not rate-limited (health probes; internal metrics).

Prometheus text exposition (`text/plain; version=0.0.4`). Caddy returns 404 for this path on the public listener; reachable only on the internal Docker network by the Prometheus scraper.

**Response `200 OK`** — no JSON body.

**Status codes:** 200

### 10.2 Auth

#### `GET /api/v1/auth/csrf` — Issue CSRF token

- **Access:** Public (no session)
- **Rate limit:** 60 / min per IP.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Sets/refreshes the `dh_csrf` cookie (not HttpOnly, Secure, SameSite=Lax, Path=/) and returns the same value. The token is `nonce.timestamp.HMAC-SHA256(secret, session_binding|nonce|timestamp)`; binding is the session id hash, or an anonymous pre-session id for unauthenticated forms. Call on app boot and after login/logout (both rotate it).

**Response `200 OK`** (`CsrfToken`):
```json
{"csrf_token": "c1a9b0f2e5d84f6c.1730000000.Q2x8hFz0Yw0m3vV5J2t3p5r1Xk6b4N8o9Lq7s0dE1aA"}
```

**Status codes:** 200, 429, 500

**Common errors:** `rate_limited`, `internal_error`

#### `POST /api/v1/auth/register` — Register a new account

- **Access:** Public (no session) · CSRF required
- **Rate limit:** 5 / h per IP.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Creates a `pending_email` user with role `contributor` and sends a verification email (24 h link). **Enumeration-safe:** if the email already exists, the response is identical and the existing owner receives an 'account already exists' email instead. No session is created; the client shows 'check your inbox' and the user signs in normally (pending_email accounts may sign in with limited access).

**Request** (`RegisterRequest`, application/json):
```json
{
  "email": "sophea@example.com",
  "password": "correct horse battery staple",
  "display_name": "Sophea K.",
  "accept_terms": true,
  "accept_privacy": true,
  "terms_version": "TOS-2026-10"
}
```

**Response `202 Accepted`** (`Accepted`):
```json
{"status": "accepted", "message": "If this email can be registered, we have sent a verification link."}
```

**Validation:** email: RFC 5322, ≤ 254 chars, lower-cased + NFC; stored citext; password: 12–128 chars, not equal to email/local-part, not in the bundled common-password list (100k); HIBP k-anonymity check when `PASSWORD_BREACH_CHECK=true`; display_name: 2–80 chars, trimmed, NFC, no control chars; accept_terms/accept_privacy must be true; terms_version must equal the current published version.

**Status codes:** 202, 400, 403, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.password_policy` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/login` — Sign in with email and password

- **Access:** Public (no session) · CSRF required
- **Rate limit:** 5 / min per (IP + email) and 20 / min per IP; account lockout after 5 failures within 15 min (locked 15 min).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Verifies credentials (constant-time; dummy Argon2 hash when the email is unknown). On success: revokes the pre-login session if any, creates a new session (rotation), sets `dh_session` (HttpOnly, Secure, SameSite=Lax, Path=/) and a fresh `dh_csrf`. If the user has MFA enabled, the session is created in *MFA-pending* state and the response is `{mfa_required: true, me: null}`; the client must call `POST /auth/mfa/verify`. Admin/super_admin without MFA get `{mfa_enrollment_required: true}` and may only call MFA setup/enable, me, csrf, logout.

**Request** (`LoginRequest`, application/json):
```json
{"email": "sophea@example.com", "password": "correct horse battery staple"}
```

**Response `200 OK`** (`LoginResponse`):
```json
{
  "mfa_required": false,
  "mfa_enrollment_required": false,
  "me": {
    "user": {
      "id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "email": "sophea@example.com",
      "display_name": "Sophea K.",
      "status": "active",
      "roles": ["contributor"],
      "email_verified_at": "2026-10-20T03:00:00Z",
      "verification_status": "approved",
      "onboarding_completed_at": "2026-10-20T03:05:00Z",
      "mfa_enabled": false,
      "created_at": "2026-10-20T02:58:00Z",
      "last_login_at": "2026-10-26T08:30:00Z"
    },
    "permissions": ["profile.self", "dataset.create", "dataset.read.own", "payout.request", "message.self"],
    "session": {
      "id": "01930b70-1111-7a00-8000-0000000000a1",
      "mfa_verified": false,
      "mfa_required": false,
      "mfa_enrollment_required": false,
      "step_up_valid_until": null,
      "idle_expires_at": "2026-11-02T08:30:00Z",
      "absolute_expires_at": "2026-11-25T08:30:00Z"
    },
    "capabilities": {"can_upload": true, "can_withdraw": true, "can_be_assigned_annotation": false, "limited_reason": null}
  }
}
```

**Validation:** email and password required; password ≤ 128 chars (longer input rejected before hashing to avoid DoS).

**Status codes:** 200, 400, 401, 403, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.invalid_credentials` (401), `auth.account_locked` (429), `auth.account_suspended` (403), `auth.account_inactive` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/mfa/verify` — Verify TOTP / recovery code (login second factor or step-up)

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions · CSRF
- **Rate limit:** 5 / min per session and 20 / h per user; 10 consecutive failures revoke the MFA-pending session.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Completes login for MFA-pending sessions and doubles as **step-up**: on an already verified session it re-stamps `mfa_verified_at`, opening a 15-minute window for financial/privileged actions. TOTP: SHA-1, 6 digits, 30 s, ±1 step; the last accepted step is stored to prevent replay. A recovery code is single-use and triggers a security email. Session id is rotated on first verification.

**Request** (`MfaVerifyRequest`, application/json):
```json
{"code": "492817"}
```

**Response `200 OK`** (`Me`):
```json
{
  "user": {
    "id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "email": "sophea@example.com",
    "display_name": "Sophea K.",
    "status": "active",
    "roles": ["contributor"],
    "email_verified_at": "2026-10-20T03:00:00Z",
    "verification_status": "approved",
    "onboarding_completed_at": "2026-10-20T03:05:00Z",
    "mfa_enabled": false,
    "created_at": "2026-10-20T02:58:00Z",
    "last_login_at": "2026-10-26T08:30:00Z"
  },
  "permissions": ["profile.self", "dataset.create", "dataset.read.own", "payout.request", "message.self"],
  "session": {
    "id": "01930b70-1111-7a00-8000-0000000000a1",
    "mfa_verified": true,
    "mfa_required": false,
    "mfa_enrollment_required": false,
    "step_up_valid_until": "2026-10-26T08:45:00Z",
    "idle_expires_at": "2026-11-02T08:30:00Z",
    "absolute_expires_at": "2026-11-25T08:30:00Z"
  },
  "capabilities": {"can_upload": true, "can_withdraw": true, "can_be_assigned_annotation": false, "limited_reason": null}
}
```

**Validation:** exactly one of code (6 digits) or recovery_code (XXXXX-XXXXX base32).

**Status codes:** 200, 400, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.mfa_invalid_code` (401), `auth.mfa_not_set_up` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/logout` — Sign out current session

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Revokes the current session row, clears `dh_session` and rotates `dh_csrf`. Idempotent: an already-invalid session still gets 204 with cleared cookies.

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/verify-email` — Confirm email with token

- **Access:** Public (no session) · CSRF required
- **Rate limit:** 10 / h per IP (verify-email, reset-password).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Token = 32 random bytes, base64url (43 chars). Looks up SHA-256(token) with purpose `email_verify`, checks expiry (24 h) and `used_at IS NULL`, then sets `email_verified_at`, status `pending_email → active`, marks the token used and invalidates other outstanding verify tokens. Works without a session (link opened on another device).

**Request** (`TokenRequest`, application/json):
```json
{"token": "Jw0Qe3m8ZKcV9rT1xY4uB6nP2sD5fG7hJ0kL3zX8cVb"}
```

**Response `200 OK`** (`OkStatus`):
```json
{"status": "verified"}
```

**Status codes:** 200, 400, 403, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.token_invalid` (400), `auth.token_expired` (400)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/resend-verification` — Resend verification email

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions · CSRF
- **Rate limit:** 3 / h per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

For the signed-in `pending_email` user. Invalidates previous tokens and issues a new one.

**Response `202 Accepted`** (`Accepted`):
```json
{"status": "accepted", "message": "Verification email sent."}
```

**Status codes:** 202, 401, 403, 409, 429, 500

**Endpoint-specific errors:** `auth.email_already_verified` (409)

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/forgot-password` — Request password-reset email

- **Access:** Public (no session) · CSRF required
- **Rate limit:** 3 / h per email and 10 / h per IP (silently not sent above limit; response still 202).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Enumeration-safe; identical response and similar latency whether or not the account exists. Sends a 1-hour single-use token (purpose `password_reset`). Suspended/anonymized accounts receive nothing.

**Request** (`EmailRequest`, application/json):
```json
{"email": "sophea@example.com"}
```

**Response `202 Accepted`** (`Accepted`):
```json
{"status": "accepted", "message": "If an account exists for this email, a reset link has been sent."}
```

**Status codes:** 202, 400, 403, 413, 415, 422, 429, 500

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/reset-password` — Set new password with reset token

- **Access:** Public (no session) · CSRF required
- **Rate limit:** 10 / h per IP (verify-email, reset-password).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Validates token (1 h, single use), applies password policy, re-hashes with Argon2id, revokes **all** sessions, clears lockout counter, emails a confirmation. If the account was `pending_email`, the reset also verifies the email (the user proved inbox control).

**Request** (`ResetPasswordRequest`, application/json):
```json
{"token": "Jw0Qe3m8ZKcV9rT1xY4uB6nP2sD5fG7hJ0kL3zX8cVb", "new_password": "a new long passphrase 2026"}
```

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 400, 403, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.token_invalid` (400), `auth.token_expired` (400), `auth.password_policy` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/change-password` — Change password (signed in)

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions · CSRF
- **Rate limit:** 5 / h per user (change-password, MFA setup/disable, payout-method create).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Requires current password. Revokes all other sessions and rotates the current one (new cookie).

**Request** (`ChangePasswordRequest`, application/json):
```json
{"current_password": "correct horse battery staple", "new_password": "a new long passphrase 2026"}
```

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 400, 401, 403, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.current_password_invalid` (422), `auth.password_policy` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `GET /api/v1/auth/me` — Current user, permissions and session state

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Single bootstrap call for the web app. Returns 401 when not signed in. Works in limited states (pending_email, MFA-pending) so the UI can route the user.

**Response `200 OK`** (`Me`):
```json
{
  "user": {
    "id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "email": "sophea@example.com",
    "display_name": "Sophea K.",
    "status": "active",
    "roles": ["contributor"],
    "email_verified_at": "2026-10-20T03:00:00Z",
    "verification_status": "approved",
    "onboarding_completed_at": "2026-10-20T03:05:00Z",
    "mfa_enabled": false,
    "created_at": "2026-10-20T02:58:00Z",
    "last_login_at": "2026-10-26T08:30:00Z"
  },
  "permissions": ["profile.self", "dataset.create", "dataset.read.own", "payout.request", "message.self"],
  "session": {
    "id": "01930b70-1111-7a00-8000-0000000000a1",
    "mfa_verified": false,
    "mfa_required": false,
    "mfa_enrollment_required": false,
    "step_up_valid_until": null,
    "idle_expires_at": "2026-11-02T08:30:00Z",
    "absolute_expires_at": "2026-11-25T08:30:00Z"
  },
  "capabilities": {"can_upload": true, "can_withdraw": true, "can_be_assigned_annotation": false, "limited_reason": null}
}
```

**Status codes:** 200, 401, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `rate_limited`, `internal_error`

#### `GET /api/v1/auth/sessions` — List my active sessions

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Active (non-revoked, non-expired) sessions of the caller; `current` marks this one. IP shown as stored (truncated /24 for IPv4, /48 for IPv6 after 30 days).

**Response `200 OK`** (`SessionList`):
```json
{
  "items": [
    {
      "id": "01930b70-1111-7a00-8000-0000000000a1",
      "created_at": "2026-10-26T08:30:00Z",
      "last_seen_at": "2026-10-26T09:15:00Z",
      "idle_expires_at": "2026-11-02T09:15:00Z",
      "absolute_expires_at": "2026-11-25T08:30:00Z",
      "ip": "203.0.113.24",
      "user_agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0",
      "current": true,
      "mfa_verified_at": null
    },
    {
      "id": "01930b70-1111-7a00-8000-0000000000a2",
      "created_at": "2026-10-26T08:30:00Z",
      "last_seen_at": "2026-10-26T09:15:00Z",
      "idle_expires_at": "2026-11-02T09:15:00Z",
      "absolute_expires_at": "2026-11-25T08:30:00Z",
      "ip": "203.0.113.24",
      "user_agent": "Mozilla/5.0 (Android 14) Chrome/130.0",
      "current": false,
      "mfa_verified_at": null
    }
  ]
}
```

**Status codes:** 200, 401, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `rate_limited`, `internal_error`

#### `DELETE /api/v1/auth/sessions/{session_id}` — Revoke one of my sessions

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Revokes a session belonging to the caller. Revoking the current session is equivalent to logout.

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/sessions/revoke-others` — Revoke all my other sessions

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

**Response `200 OK`** (`RevokeResult`):
```json
{"revoked": 2}
```

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/mfa/setup` — Start TOTP enrolment

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions · CSRF
- **Rate limit:** 5 / h per user (change-password, MFA setup/disable, payout-method create).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Generates a 160-bit secret, stores it encrypted (AES-256-GCM, key `MFA_ENCRYPTION_KEY`) as *pending* for 15 minutes. The UI renders the otpauth URI as a QR code client-side. Allowed for MFA-enrolment-required sessions.

**Request** (`MfaSetupRequest`, application/json):
```json
{"password": "correct horse battery staple"}
```

**Response `200 OK`** (`MfaSetupResponse`):
```json
{
  "secret": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
  "otpauth_uri": "otpauth://totp/DataHub:vanna%40datahub.example?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=DataHub&algorithm=SHA1&digits=6&period=30",
  "issuer": "DataHub",
  "algorithm": "SHA1",
  "digits": 6,
  "period": 30
}
```

**Status codes:** 200, 400, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.current_password_invalid` (422), `auth.mfa_already_enabled` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/mfa/enable` — Confirm TOTP enrolment and get recovery codes

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions · CSRF
- **Rate limit:** 5 / min per session and 20 / h per user; 10 consecutive failures revoke the MFA-pending session.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Verifies a code against the pending secret, activates MFA, generates 10 recovery codes (shown once; stored as SHA-256), marks the session MFA-verified and rotates the session id (privilege change).

**Request** (`MfaEnableRequest`, application/json):
```json
{"code": "492817"}
```

**Response `200 OK`** (`MfaEnableResponse`):
```json
{
  "recovery_codes": [
    "K7QPA-M2XRD",
    "B4TNE-WZ6FH",
    "R3JVC-Q5LMA",
    "Z2HYD-7NKPE",
    "F6WRB-T3QJX",
    "M5CZK-L7NAR",
    "P2XVD-J4HTE",
    "W7NQF-C6RYB",
    "D3LTA-K5ZMH",
    "H7RPE-X2WQN"
  ]
}
```

**Status codes:** 200, 400, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.mfa_invalid_code` (401), `auth.mfa_not_set_up` (409), `auth.mfa_already_enabled` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/mfa/disable` — Disable TOTP (non-admin roles only)

- **Access:** any signed-in user · CSRF
- **Rate limit:** 5 / h per user (change-password, MFA setup/disable, payout-method create).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Requires password and a current TOTP code. Forbidden for users holding admin or super_admin. Deletes secret and recovery codes; security email sent.

**Request** (`MfaDisableRequest`, application/json):
```json
{"password": "correct horse battery staple", "code": "492817"}
```

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 400, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.current_password_invalid` (422), `auth.mfa_invalid_code` (401), `auth.mfa_not_set_up` (409), `auth.mfa_cannot_disable` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

### 10.3 Me

#### `GET /api/v1/me/profile` — Get my profile

- **Access:** `profile.self`
- **Rate limit:** 600 / min per user.

**Response `200 OK`** (`Profile`):
```json
{
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "display_name": "Sophea K.",
  "legal_name": "Sophea Keo",
  "country": "KH",
  "phone": "+85512345678",
  "date_of_birth": "1995-04-12",
  "preferred_language": "km",
  "timezone": "Asia/Phnom_Penh",
  "bio": null,
  "version": 3,
  "updated_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 200, 401, 403, 429, 500, 503

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `PATCH /api/v1/me/profile` — Update my profile

- **Access:** `profile.self` · CSRF
- **Rate limit:** 120 / min per user.
- **Headers:** `If-Match` (optional)

Partial update. `legal_name`, `country`, `date_of_birth` become read-only while a verification is `pending` or `approved` (changing them requires a new verification submission).

**Request** (`ProfileUpdate`, application/json):
```json
{"display_name": "Sophea K.", "timezone": "Asia/Phnom_Penh", "preferred_language": "km"}
```

**Response `200 OK`** (`Profile`):
```json
{
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "display_name": "Sophea K.",
  "legal_name": "Sophea Keo",
  "country": "KH",
  "phone": "+85512345678",
  "date_of_birth": "1995-04-12",
  "preferred_language": "km",
  "timezone": "Asia/Phnom_Penh",
  "bio": null,
  "version": 3,
  "updated_at": "2026-10-26T08:30:00Z"
}
```

**Validation:** country ISO-3166 alpha-2; phone E.164; timezone must be a valid IANA name; date_of_birth ≥ 18 years ago; all strings NFC, no control characters.

**Status codes:** 200, 400, 401, 403, 412, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `verification.underage` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `precondition.failed`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/me/onboarding` — Accept contributor agreement and rights declaration

- **Access:** `profile.self` · CSRF
- **Rate limit:** 120 / min per user.

Records `agreement_acceptances` (version, timestamp, IP, user agent) and sets `onboarding_completed_at`. Idempotent per agreement version. Required before creating datasets (A-09). When a new agreement version is published, users are prompted again and uploads are blocked until accepted.

**Request** (`OnboardingRequest`, application/json):
```json
{
  "agreement_version": "CA-2026-10",
  "accept_contributor_agreement": true,
  "rights_declaration": true,
  "acknowledge_no_personal_data_without_consent": true
}
```

**Response `200 OK`** (`Me`):
```json
{
  "user": {
    "id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "email": "sophea@example.com",
    "display_name": "Sophea K.",
    "status": "active",
    "roles": ["contributor"],
    "email_verified_at": "2026-10-20T03:00:00Z",
    "verification_status": "approved",
    "onboarding_completed_at": "2026-10-20T03:05:00Z",
    "mfa_enabled": false,
    "created_at": "2026-10-20T02:58:00Z",
    "last_login_at": "2026-10-26T08:30:00Z"
  },
  "permissions": ["profile.self", "dataset.create", "dataset.read.own", "payout.request", "message.self"],
  "session": {
    "id": "01930b70-1111-7a00-8000-0000000000a1",
    "mfa_verified": false,
    "mfa_required": false,
    "mfa_enrollment_required": false,
    "step_up_valid_until": null,
    "idle_expires_at": "2026-11-02T08:30:00Z",
    "absolute_expires_at": "2026-11-25T08:30:00Z"
  },
  "capabilities": {"can_upload": true, "can_withdraw": true, "can_be_assigned_annotation": false, "limited_reason": null}
}
```

**Validation:** agreement_version must equal current published version; all booleans must be true.

**Status codes:** 200, 400, 401, 403, 413, 415, 422, 429, 500, 503

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/me/payout-methods` — List my payout methods

- **Access:** `payout.request`
- **Rate limit:** 600 / min per user.

**Response `200 OK`** (`PayoutMethodList`):
```json
{
  "items": [
    {
      "id": "01930b76-7777-7000-8000-000000000102",
      "type": "aba_pay",
      "label": "My ABA account",
      "is_default": true,
      "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"},
      "created_at": "2026-10-26T08:30:00Z"
    }
  ]
}
```

**Status codes:** 200, 401, 403, 429, 500, 503

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/me/payout-methods` — Add a payout method

- **Access:** `payout.request` · CSRF
- **Rate limit:** 5 / h per user (change-password, MFA setup/disable, payout-method create).

Requires current password (re-authentication). Max 5 methods. Emits security event `payout_method_changed` and a mandatory email. Details are never used for automatic transfers.

**Request** (`PayoutMethodCreate`, application/json):
```json
{
  "type": "aba_pay",
  "label": "My ABA account",
  "is_default": true,
  "details": {"account_name": "KEO SOPHEA", "account_number": "000124821"},
  "current_password": "correct horse battery staple"
}
```

**Response `201 Created`** (`PayoutMethod`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000102",
  "type": "aba_pay",
  "label": "My ABA account",
  "is_default": true,
  "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"},
  "created_at": "2026-10-26T08:30:00Z"
}
```

**Validation:** per-type required details (see schema); account numbers 4–34 chars [A-Za-z0-9 -]; emails RFC 5322; label 1–60 chars.

**Status codes:** 201, 400, 401, 403, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `auth.current_password_invalid` (422), `payout_method.limit_reached` (409), `payout_method.invalid_details` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `DELETE /api/v1/me/payout-methods/{method_id}` — Remove a payout method

- **Access:** `payout.request` · CSRF
- **Rate limit:** 120 / min per user.

Soft-deletes (kept for historical payouts which store a snapshot).

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `payout_method.in_use` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/me/verification` — Get my latest contributor verification

- **Access:** `profile.self`
- **Rate limit:** 600 / min per user.

Returns the latest verification row or **404** `resource.not_found` if never submitted (UI shows 'not started').

**Response `200 OK`** (`ContributorVerification`):
```json
{
  "id": "01930b7c-dddd-7600-8000-000000000701",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "status": "pending",
  "legal_name": "Sophea Keo",
  "country": "KH",
  "date_of_birth": "1995-04-12",
  "phone": "+85512345678",
  "id_document": {"filename": "national-id.jpg", "size_bytes": 412339, "content_type": "image/jpeg"},
  "decision_reason": null,
  "decided_by": null,
  "decided_at": null,
  "submitted_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 200, 401, 403, 429, 500, 503

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/me/verification` — Submit (or resubmit) contributor verification

- **Access:** `profile.self` · CSRF
- **Rate limit:** 600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof).

multipart/form-data. Creates a new `pending` row (allowed when none, `rejected` or `needs_info`), mirrors `users.verification_status=pending`, notifies verifiers. The optional ID document (PDF/JPEG/PNG ≤ 10 MB) is magic-byte checked, ClamAV scanned and stored at `verifications/{verification_id}/id-document` — visible to `user.verify` holders only.

**Request** (`VerificationSubmit`, multipart/form-data):
```json
{
  "legal_name": "Sophea Keo",
  "country": "KH",
  "date_of_birth": "1995-04-12",
  "phone": "+85512345678",
  "id_document": "<binary national-id.jpg>"
}
```

**Response `201 Created`** (`ContributorVerification`):
```json
{
  "id": "01930b7c-dddd-7600-8000-000000000701",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "status": "pending",
  "legal_name": "Sophea Keo",
  "country": "KH",
  "date_of_birth": "1995-04-12",
  "phone": "+85512345678",
  "id_document": {"filename": "national-id.jpg", "size_bytes": 412339, "content_type": "image/jpeg"},
  "decision_reason": null,
  "decided_by": null,
  "decided_at": null,
  "submitted_at": "2026-10-26T08:30:00Z"
}
```

**Validation:** age ≥ 18; country alpha-2; phone E.164; id_document ≤ 10 MB, pdf/jpeg/png by magic bytes.

**Status codes:** 201, 401, 403, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `verification.already_pending` (409), `verification.already_approved` (409), `verification.underage` (422), `message.attachment_too_large` (413), `message.attachment_type_not_allowed` (415)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/me/deletion-request` — Request account deletion

- **Access:** `profile.self` · CSRF
- **Rate limit:** 120 / min per user.

Creates a `deletion_requests` row processed by an admin per the Retention policy: account → `deactivated` then `anonymized`; financial and audit records retained 7 years (A-15) in pseudonymised form. Available balance must be withdrawn or explicitly forfeited (confirmation in UI).

**Request** (`DeletionRequestCreate`, application/json):
```json
{"confirm_email": "sophea@example.com", "reason": "No longer contributing."}
```

**Response `202 Accepted`** (`DeletionRequest`):
```json
{
  "id": "01930b7e-ffff-7800-8000-000000000901",
  "status": "pending",
  "created_at": "2026-10-26T08:30:00Z",
  "scheduled_for": "2026-11-25T08:30:00Z"
}
```

**Status codes:** 202, 400, 401, 403, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `account.deletion_blocked` (409), `account.deletion_pending` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/me/notification-preferences` — Get notification preferences

- **Access:** `profile.self`
- **Rate limit:** 600 / min per user.

**Response `200 OK`** (`NotificationPreferences`):
```json
{
  "email": {"dataset_approved": true, "annotation_assigned": true, "support_message": true},
  "mandatory_email_types": ["payment_recorded", "security_alert", "withdrawal_rejected", "payout_failed"]
}
```

**Status codes:** 200, 401, 403, 429, 500, 503

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `PATCH /api/v1/me/notification-preferences` — Update notification preferences

- **Access:** `profile.self` · CSRF
- **Rate limit:** 120 / min per user.

**Request** (`NotificationPreferencesUpdate`, application/json):
```json
{"email": {"annotation_assigned": false}}
```

**Response `200 OK`** (`NotificationPreferences`):
```json
{
  "email": {"dataset_approved": true, "annotation_assigned": false, "support_message": true},
  "mandatory_email_types": ["payment_recorded", "security_alert", "withdrawal_rejected", "payout_failed"]
}
```

**Validation:** keys must be NotificationType values; mandatory types ignore false.

**Status codes:** 200, 400, 401, 403, 413, 415, 422, 429, 500, 503

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

### 10.4 Public

#### `GET /api/v1/public/pricing` — Current published rates

- **Access:** Public (no session)
- **Rate limit:** 60 / min per IP.

Cached 60 s. Shows rules in force now (future rules are not published until effective).

**Response `200 OK`** (`PublicPricing`):
```json
{
  "currency": "USD",
  "bytes_per_gb": 1000000000,
  "rates": [
    {"data_class": "raw", "rate_micros_per_gb": 1000000, "effective_from": "2026-10-01T00:00:00Z"},
    {"data_class": "labeled", "rate_micros_per_gb": 1500000, "effective_from": "2026-10-01T00:00:00Z"}
  ],
  "min_withdrawal_micros": 10000000,
  "max_withdrawal_micros": 5000000000
}
```

**Status codes:** 200, 429, 500, 503

**Common errors:** `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/public/formats` — Allowed formats and upload limits

- **Access:** Public (no session)
- **Rate limit:** 60 / min per IP.

Machine-readable form of baseline §7 plus `extra_allowed_extensions`. Used by the uploader for client-side pre-checks.

**Response `200 OK`** (`FormatList`):
```json
{
  "items": [
    {
      "extension": "pdf",
      "mime_types": ["application/pdf"],
      "allowed": true,
      "preview": "page_images",
      "annotatable": "page_level",
      "payable": "yes",
      "notes": "First 500 pages rendered."
    },
    {
      "extension": "zip",
      "mime_types": ["application/zip"],
      "allowed": true,
      "preview": "member_list",
      "annotatable": "no",
      "payable": "members_only",
      "notes": "Container never payable; members processed individually."
    }
  ],
  "limits": {
    "max_file_bytes": 4000000000,
    "max_dataset_bytes": 50000000000,
    "user_pending_quota_bytes": 200000000000,
    "max_files_per_dataset": 2000,
    "part_size_bytes": 16777216
  }
}
```

**Status codes:** 200, 429, 500, 503

**Common errors:** `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/public/contact` — Contact form

- **Access:** Public (no session) · CSRF required
- **Rate limit:** 5 / h per IP.

Creates a support conversation (kind `support`, no user) visible in the admin inbox and an email to the support address. Honeypot field `website` (must be empty) silently drops bots with 202.

**Request** (`ContactRequest`, application/json):
```json
{
  "name": "Dara",
  "email": "dara@example.org",
  "subject": "Partnership",
  "message": "We have 20k scanned Khmer forms. Can we contribute?"
}
```

**Response `202 Accepted`** (`Accepted`):
```json
{"status": "accepted", "message": "Thanks — we will reply by email."}
```

**Status codes:** 202, 400, 403, 413, 415, 422, 429, 500, 503

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/public/takedown-requests` — Submit a takedown / rights or privacy complaint

- **Access:** Public (no session) · CSRF required
- **Rate limit:** 5 / h per IP.

For rights holders and data subjects; **no login required** (AM-04). Creates a `takedown_requests` row (`source=public_form`, `status=received`), resolves `dataset_reference` (code or UUID) to `dataset_id` when it matches (the response never reveals whether it matched), emails an acknowledgement to the requester, and notifies `user.manage` holders. Rate-limited 5 / h per IP; honeypot `website` must be empty (bots get a silent 202). Signed-in users may use it too (`requester_user_id` is recorded).

**Request** (`TakedownClaimCreate`, application/json):
```json
{
  "requester_name": "Chan Vuthy",
  "requester_email": "rights@publisher.example",
  "requester_organization": "Angkor Press Co.",
  "claim_type": "copyright",
  "dataset_reference": "DS-2026-000123",
  "file_reference": null,
  "description": "Pages 1–48 of this dataset are scans of our 1994 newspaper editions, reproduced without permission.",
  "evidence_url": "https://publisher.example/catalogue/1994",
  "sworn_statement": true,
  "website": ""
}
```

**Response `202 Accepted`** (`Accepted`):
```json
{
  "status": "accepted",
  "message": "Your notice has been received. We will acknowledge it by email within 2 business days."
}
```

**Validation:** requester_name 2–200 chars; requester_email valid email; claim_type ∈ TakedownClaimType; description 20–10,000 chars; sworn_statement must be true; evidence_url http(s) only.

**Status codes:** 202, 400, 403, 413, 415, 422, 429, 500, 503

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

### 10.5 Datasets

#### `POST /api/v1/datasets` — Create a dataset (draft)

- **Access:** `dataset.create` · onboarding completed · CSRF
- **Rate limit:** 120 / min per user.

Creates `datasets` (status `draft`), `dataset_versions` v1 and `dataset_licenses` (licence version, acceptance time, IP). Requires email verified + onboarding (A-09).

**Request** (`DatasetCreate`, application/json):
```json
{
  "title": "Khmer newspaper scans 1990–1999",
  "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
  "data_class": "raw",
  "category": "news",
  "languages": ["km"],
  "tags": ["newspaper", "ocr"],
  "source_description": "Personal archive, scanned by me.",
  "contains_personal_data": false,
  "rights_declaration_accepted": true,
  "license_version": "CA-2026-10"
}
```

**Response `201 Created`** (`Dataset`):
```json
{
  "id": "01930b71-2222-7b00-8000-0000000000d1",
  "code": "DS-2026-000123",
  "owner_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "owner_display_name": "Sophea K.",
  "title": "Khmer newspaper scans 1990–1999",
  "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
  "data_class": "raw",
  "category": "news",
  "languages": ["km"],
  "tags": ["newspaper", "ocr"],
  "source_description": "Personal archive, scanned by me.",
  "contains_personal_data": false,
  "personal_data_notes": null,
  "status": "draft",
  "version_number": 1,
  "file_count": 0,
  "ready_file_count": 0,
  "failed_file_count": 0,
  "total_bytes": 0,
  "accepted_bytes": null,
  "earned_micros": null,
  "license_version": "CA-2026-10",
  "takedown_reason": null,
  "submitted_at": null,
  "finalized_at": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T09:15:00Z",
  "version": 1
}
```

**Validation:** title 3–200 chars NFC trimmed; languages 1–5 distinct ISO codes; tags ≤ 20 × ≤ 40 chars; personal_data_notes required when contains_personal_data=true; license_version = current agreement version.

**Status codes:** 201, 400, 401, 403, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `auth.onboarding_required` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/datasets` — List my datasets

- **Access:** `dataset.read.own`
- **Rate limit:** 600 / min per user.
- **Query:** `status` — Filter by status (repeatable).; `data_class` — Filter.; `q` — Case-insensitive search text.; `page`, `page_size`, `sort` (sortable: `created_at`, `updated_at`, `title`, `total_bytes`, `submitted_at`)

Only datasets owned by the caller (admins use `/admin/datasets`).

**Response `200 OK`** (`PaginatedDataset`):
```json
{
  "items": [
    {
      "id": "01930b71-2222-7b00-8000-0000000000d1",
      "code": "DS-2026-000123",
      "owner_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "owner_display_name": "Sophea K.",
      "title": "Khmer newspaper scans 1990–1999",
      "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
      "data_class": "raw",
      "category": "news",
      "languages": ["km"],
      "tags": ["newspaper", "ocr"],
      "source_description": "Personal archive, scanned by me.",
      "contains_personal_data": false,
      "personal_data_notes": null,
      "status": "draft",
      "version_number": 1,
      "file_count": 2,
      "ready_file_count": 2,
      "failed_file_count": 0,
      "total_bytes": 734003200,
      "accepted_bytes": null,
      "earned_micros": null,
      "license_version": "CA-2026-10",
      "takedown_reason": null,
      "submitted_at": null,
      "finalized_at": null,
      "created_at": "2026-10-26T08:30:00Z",
      "updated_at": "2026-10-26T09:15:00Z",
      "version": 4
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/datasets/{dataset_id}` — Get a dataset

- **Access:** `dataset.read.own`
- **Rate limit:** 600 / min per user.

Owner, or a holder of `dataset.read.any` (admin), or the reviewer whose claimed review targets this dataset. Others get 404.

**Response `200 OK`** (`Dataset`):
```json
{
  "id": "01930b71-2222-7b00-8000-0000000000d1",
  "code": "DS-2026-000123",
  "owner_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "owner_display_name": "Sophea K.",
  "title": "Khmer newspaper scans 1990–1999",
  "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
  "data_class": "raw",
  "category": "news",
  "languages": ["km"],
  "tags": ["newspaper", "ocr"],
  "source_description": "Personal archive, scanned by me.",
  "contains_personal_data": false,
  "personal_data_notes": null,
  "status": "draft",
  "version_number": 1,
  "file_count": 2,
  "ready_file_count": 2,
  "failed_file_count": 0,
  "total_bytes": 734003200,
  "accepted_bytes": null,
  "earned_micros": null,
  "license_version": "CA-2026-10",
  "takedown_reason": null,
  "submitted_at": null,
  "finalized_at": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T09:15:00Z",
  "version": 4
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `PATCH /api/v1/datasets/{dataset_id}` — Update dataset metadata

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 120 / min per user.
- **Headers:** `If-Match` (optional)

Owner only; status `draft` or `changes_requested`.

**Request** (`DatasetUpdate`, application/json):
```json
{
  "description": "Scanned front pages, 300 dpi, 1990–1999. Some pages faded.",
  "tags": ["newspaper", "ocr", "1990s"]
}
```

**Response `200 OK`** (`Dataset`):
```json
{
  "id": "01930b71-2222-7b00-8000-0000000000d1",
  "code": "DS-2026-000123",
  "owner_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "owner_display_name": "Sophea K.",
  "title": "Khmer newspaper scans 1990–1999",
  "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
  "data_class": "raw",
  "category": "news",
  "languages": ["km"],
  "tags": ["newspaper", "ocr"],
  "source_description": "Personal archive, scanned by me.",
  "contains_personal_data": false,
  "personal_data_notes": null,
  "status": "draft",
  "version_number": 1,
  "file_count": 2,
  "ready_file_count": 2,
  "failed_file_count": 0,
  "total_bytes": 734003200,
  "accepted_bytes": null,
  "earned_micros": null,
  "license_version": "CA-2026-10",
  "takedown_reason": null,
  "submitted_at": null,
  "finalized_at": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T09:15:00Z",
  "version": 4
}
```

**Validation:** as DatasetCreate; all fields optional.

**Status codes:** 200, 400, 401, 403, 404, 409, 412, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `dataset.not_editable` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `precondition.failed`, `rate_limited`, `internal_error`, `service_unavailable`

#### `DELETE /api/v1/datasets/{dataset_id}` — Delete a draft or withdrawn dataset

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 120 / min per user.

Owner only; status `draft` or `withdrawn` and never finalized. Aborts open upload sessions, soft-deletes rows, objects purged by `retention.purge` after 30 days (A-15).

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `dataset.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/datasets/{dataset_id}/submit` — Submit for review

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 120 / min per user.

`draft|changes_requested → submitted`. Preconditions: no open upload sessions; every file terminal (`ready|failed|quarantined`); ≥ 1 `ready`; metadata valid. Resubmission after `changes_requested` creates a new `dataset_versions` row (version_number+1) and snapshots the file list. Owner is notified (`dataset_received`).

**Response `200 OK`** (`Dataset`):
```json
{
  "id": "01930b71-2222-7b00-8000-0000000000d1",
  "code": "DS-2026-000123",
  "owner_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "owner_display_name": "Sophea K.",
  "title": "Khmer newspaper scans 1990–1999",
  "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
  "data_class": "raw",
  "category": "news",
  "languages": ["km"],
  "tags": ["newspaper", "ocr"],
  "source_description": "Personal archive, scanned by me.",
  "contains_personal_data": false,
  "personal_data_notes": null,
  "status": "submitted",
  "version_number": 1,
  "file_count": 2,
  "ready_file_count": 2,
  "failed_file_count": 0,
  "total_bytes": 734003200,
  "accepted_bytes": null,
  "earned_micros": null,
  "license_version": "CA-2026-10",
  "takedown_reason": null,
  "submitted_at": "2026-10-26T09:15:00Z",
  "finalized_at": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T09:15:00Z",
  "version": 5
}
```

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `dataset.invalid_state` (409), `dataset.files_not_terminal` (409), `dataset.no_ready_files` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/datasets/{dataset_id}/withdraw` — Withdraw a dataset

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 120 / min per user.

`draft|submitted|changes_requested → withdrawn` (not once claimed: `in_review`). Owner only.

**Response `200 OK`** (`Dataset`):
```json
{
  "id": "01930b71-2222-7b00-8000-0000000000d1",
  "code": "DS-2026-000123",
  "owner_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "owner_display_name": "Sophea K.",
  "title": "Khmer newspaper scans 1990–1999",
  "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
  "data_class": "raw",
  "category": "news",
  "languages": ["km"],
  "tags": ["newspaper", "ocr"],
  "source_description": "Personal archive, scanned by me.",
  "contains_personal_data": false,
  "personal_data_notes": null,
  "status": "withdrawn",
  "version_number": 1,
  "file_count": 2,
  "ready_file_count": 2,
  "failed_file_count": 0,
  "total_bytes": 734003200,
  "accepted_bytes": null,
  "earned_micros": null,
  "license_version": "CA-2026-10",
  "takedown_reason": null,
  "submitted_at": null,
  "finalized_at": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T09:15:00Z",
  "version": 4
}
```

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `dataset.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/datasets/{dataset_id}/files` — List files of a dataset

- **Access:** `dataset.read.own`
- **Rate limit:** 600 / min per user.
- **Query:** `processing_status` — Filter.; `include_members` — Include ZIP members (default true).; `parent_file_id` — Only members of this archive.; `has_duplicates` — Only files with duplicate flags.; `page`, `page_size`, `sort` (sortable: `created_at`, `original_filename`, `size_bytes`)

Same visibility as GET dataset. Contributors see duplicate flags without the other owner's ids.

**Response `200 OK`** (`PaginatedDatasetFile`):
```json
{
  "items": [
    {
      "id": "01930b72-3333-7c00-8000-0000000000f1",
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "parent_file_id": null,
      "original_filename": "phnom-penh-post-1994-03.pdf",
      "relative_path": "1994/phnom-penh-post-1994-03.pdf",
      "member_path": null,
      "extension": "pdf",
      "declared_mime": "application/pdf",
      "detected_mime": "application/pdf",
      "size_bytes": 367001600,
      "sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
      "processing_status": "ready",
      "scan_status": "clean",
      "failure_code": null,
      "failure_message": null,
      "is_container": false,
      "page_count": 48,
      "previews": [{"page": 1, "width": 1654, "height": 2339, "content_type": "image/webp"}],
      "text_available": false,
      "duplicates": [
        {
          "kind": "near",
          "method": "dhash",
          "distance": 3,
          "matched_file_id": null,
          "matched_dataset_id": null,
          "matched_previously_accepted": true,
          "same_owner": false
        }
      ],
      "review_decision": null,
      "created_at": "2026-10-26T08:30:00Z",
      "uploaded_at": "2026-10-26T08:30:00Z",
      "processed_at": "2026-10-26T09:15:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `DELETE /api/v1/datasets/{dataset_id}/files/{file_id}` — Remove a file from a dataset

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 120 / min per user.

Owner; dataset `draft` or `changes_requested`. Removing an archive removes its members. Object deleted asynchronously.

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `dataset.not_editable` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/datasets/{dataset_id}/reviews` — Review feedback for my dataset

- **Access:** `dataset.read.own`
- **Rate limit:** 600 / min per user.

Finalized reviews only, contributor-safe projection (no reviewer identity, no internal comments).

**Response `200 OK`** (`ReviewFeedbackList`):
```json
{
  "items": [
    {
      "review_id": "01930b74-5555-7e00-8000-0000000000c1",
      "dataset_version_number": 1,
      "decision": "partial",
      "feedback": "Page scans 13–20 are illegible.",
      "finalized_at": "2026-10-26T09:15:00Z",
      "accepted_bytes": 367001600,
      "rejected_bytes": 367001600,
      "earned_micros": 367001,
      "file_decisions": [
        {
          "file_id": "01930b72-3333-7c00-8000-0000000000f2",
          "original_filename": "pp-1994-04.pdf",
          "decision": "rejected",
          "reason_code": "illegible",
          "comment": "Too faded."
        }
      ]
    }
  ]
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/datasets/{dataset_id}/estimate` — Estimated earnings for a dataset

- **Access:** `dataset.read.own`
- **Rate limit:** 600 / min per user.

Σ bytes of ready+clean, non-exact-duplicate, non-container files × current rate for the declared data_class (§8.6). Not a ledger figure; final amount set at review.

**Response `200 OK`** (`DatasetEstimate`):
```json
{
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "is_estimate": true,
  "data_class": "raw",
  "rate_micros_per_gb": 1000000,
  "eligible_bytes": 734003200,
  "excluded_bytes": 0,
  "excluded_breakdown": {"duplicates_bytes": 0, "failed_or_quarantined_bytes": 0, "containers_bytes": 0, "processing_bytes": 0},
  "estimated_micros": 734003,
  "computed_at": "2026-10-26T09:15:00Z"
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

### 10.6 Files

#### `GET /api/v1/files/{file_id}` — File metadata and previews

- **Access:** any signed-in user
- **Rate limit:** 600 / min per user.

Visible to: dataset owner; reviewer with an in-progress/finalized review of the dataset; annotator with an active assignment on a task for this file; `dataset.read.any`. Otherwise 404.

**Response `200 OK`** (`DatasetFile`):
```json
{
  "id": "01930b72-3333-7c00-8000-0000000000f1",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "parent_file_id": null,
  "original_filename": "phnom-penh-post-1994-03.pdf",
  "relative_path": "1994/phnom-penh-post-1994-03.pdf",
  "member_path": null,
  "extension": "pdf",
  "declared_mime": "application/pdf",
  "detected_mime": "application/pdf",
  "size_bytes": 367001600,
  "sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
  "processing_status": "ready",
  "scan_status": "clean",
  "failure_code": null,
  "failure_message": null,
  "is_container": false,
  "page_count": 48,
  "previews": [{"page": 1, "width": 1654, "height": 2339, "content_type": "image/webp"}],
  "text_available": false,
  "duplicates": [
    {
      "kind": "near",
      "method": "dhash",
      "distance": 3,
      "matched_file_id": null,
      "matched_dataset_id": null,
      "matched_previously_accepted": true,
      "same_owner": false
    }
  ],
  "review_decision": null,
  "created_at": "2026-10-26T08:30:00Z",
  "uploaded_at": "2026-10-26T08:30:00Z",
  "processed_at": "2026-10-26T09:15:00Z"
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/files/{file_id}/preview/{page}` — Redirect to a page preview image

- **Access:** any signed-in user
- **Rate limit:** 120 / min per user (presigned URL issuance, preview redirects).

302 to a presigned GET (5 min) of `datasets/{dataset_id}/files/{file_id}/previews/page-{n}.webp` with `response-content-type=image/webp` and `Cache-Control: private, max-age=300`. Same visibility as GET file. Preview of quarantined/infected files is never served.

**Response `302 Found`** — no JSON body.

**Status codes:** 302, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `file.not_ready` (409), `file.no_preview` (404), `file.unavailable` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/files/{file_id}/text` — Extracted text (first 1 MB)

- **Access:** any signed-in user
- **Rate limit:** 600 / min per user.

UTF-8 text produced by processing (docx/odt/rtf/txt/csv/json/xml/xlsx). Returned as JSON string — the client renders it as text, never HTML.

**Response `200 OK`** (`FileText`):
```json
{
  "file_id": "01930b72-3333-7c00-8000-0000000000f1",
  "text": "ព័ត៌មានថ្ងៃនេះ ...",
  "truncated": true,
  "source": "extracted",
  "char_count": 1048576
}
```

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `file.not_ready` (409), `file.no_preview` (404), `file.unavailable` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/files/{file_id}/download-url` — Presigned download URL for the original

- **Access:** any signed-in user · CSRF
- **Rate limit:** 120 / min per user (presigned URL issuance, preview redirects).

Presigned GET valid 5 minutes with `response-content-disposition=attachment; filename*=UTF-8''<sanitised original name>` and `response-content-type` forced to the detected MIME (or application/octet-stream). Audited (`file.download_url`). Same visibility as GET file; annotators may download only if the project allows (default: preview only).

**Request** (`DownloadUrlRequest`, application/json):
```json
{"reason": "Checking page 12"}
```

**Response `200 OK`** (`PresignedUrl`):
```json
{
  "url": "https://s3.datahub.example/datahub-private/datasets/01930b71-2222-7b00-8000-0000000000d1/files/01930b72-3333-7c00-8000-0000000000f1/original?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300&response-content-disposition=attachment%3B%20filename%3D%22phnom-penh-post-1994-03.pdf%22&X-Amz-Signature=…",
  "expires_at": "2026-10-26T08:35:00Z",
  "method": "GET"
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `file.not_ready` (409), `file.unavailable` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

### 10.7 Uploads

#### `POST /api/v1/datasets/{dataset_id}/uploads` — Initiate a resumable multipart upload

- **Access:** `dataset.create` · onboarding completed · CSRF
- **Rate limit:** 600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof).

Owner; dataset `draft|changes_requested`. Checks extension allow-list (advisory), file/dataset/quota limits (sizes counted from declared size and re-checked on complete), creates `dataset_files` (`pending_upload`) and `upload_sessions` (`initiated`, expires 24 h), calls S3 CreateMultipartUpload on key `datasets/{dataset_id}/files/{file_id}/original`. part_size = max(16 MiB, ceil(size/10000) rounded up to 1 MiB).

**Request** (`UploadInitRequest`, application/json):
```json
{
  "filename": "scans-1995.zip",
  "size_bytes": 1073741824,
  "content_type": "application/zip",
  "relative_path": "archive/scans-1995.zip",
  "last_modified": "2026-09-01T10:00:00Z"
}
```

**Response `201 Created`** (`UploadSession`):
```json
{
  "upload_id": "01930b73-4444-7d00-8000-0000000000b1",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "file_id": "01930b72-3333-7c00-8000-0000000000f2",
  "filename": "scans-1995.zip",
  "size_bytes": 1073741824,
  "part_size": 16777216,
  "part_count": 64,
  "status": "initiated",
  "uploaded_parts": [],
  "uploaded_bytes": 0,
  "expires_at": "2026-10-27T08:30:00Z",
  "created_at": "2026-10-26T08:30:00Z",
  "completed_at": null
}
```

**Validation:** filename 1–255 chars after sanitisation (NFC, strip path, control chars, leading dots); stored as metadata only; size_bytes 1 … max_file_bytes; extension allowed (or in extra_allowed_extensions).

**Status codes:** 201, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `dataset.not_editable` (409), `dataset.file_limit_exceeded` (409), `upload.file_too_large` (413), `upload.dataset_too_large` (413), `upload.quota_exceeded` (413), `upload.type_not_allowed` (415), `upload.storage_unavailable` (500), `auth.onboarding_required` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/uploads/{upload_id}/part-urls` — Presign part upload URLs

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof).

Up to 100 presigned UploadPart PUT URLs, valid 15 minutes, signed for the **public** S3 endpoint host (`S3_PUBLIC_ENDPOINT`). First call moves the session `initiated → uploading`. Each URL is bound to the exact key, uploadId and partNumber; Content-Length is enforced by S3 against the signed payload size where supported.

**Request** (`PartUrlsRequest`, application/json):
```json
{"part_numbers": [2, 3, 4, 5]}
```

**Response `200 OK`** (`PartUrlsResponse`):
```json
{
  "urls": [
    {
      "part_number": 2,
      "url": "https://s3.datahub.example/datahub-private/datasets/…/original?partNumber=2&uploadId=…&X-Amz-Expires=900&X-Amz-Signature=…"
    }
  ],
  "expires_at": "2026-10-26T08:45:00Z"
}
```

**Validation:** 1–100 distinct part numbers within 1…part_count.

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `upload.invalid_state` (409), `upload.expired` (409), `upload.part_number_invalid` (422), `upload.storage_unavailable` (500)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/uploads/{upload_id}` — Upload status and uploaded parts (resume)

- **Access:** `dataset.create`
- **Rate limit:** 600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof).

Authoritative list of uploaded parts from S3 ListParts (paginated server-side), so a client can resume after reload using the `upload_id` it kept in localStorage.

**Response `200 OK`** (`UploadSession`):
```json
{
  "upload_id": "01930b73-4444-7d00-8000-0000000000b1",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "file_id": "01930b72-3333-7c00-8000-0000000000f2",
  "filename": "scans-1995.zip",
  "size_bytes": 1073741824,
  "part_size": 16777216,
  "part_count": 64,
  "status": "uploading",
  "uploaded_parts": [{"part_number": 1, "etag": "\"a54357aff0632cce46d942af68356b38\"", "size_bytes": 16777216}],
  "uploaded_bytes": 16777216,
  "expires_at": "2026-10-27T08:30:00Z",
  "created_at": "2026-10-26T08:30:00Z",
  "completed_at": null
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Endpoint-specific errors:** `upload.storage_unavailable` (500)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/uploads/{upload_id}/complete` — Complete the multipart upload

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof).

Verifies the client list against ListParts (all parts 1…N present, ETags equal, Σ sizes = size_bytes), calls CompleteMultipartUpload, HeadObject to confirm size, sets file `uploaded`, session `completed`, and enqueues `processing.process_file`. Idempotent: repeating on a completed session returns the same file with 202.

**Request** (`UploadCompleteRequest`, application/json):
```json
{
  "parts": [
    {"part_number": 1, "etag": "\"a54357aff0632cce46d942af68356b38\""},
    {"part_number": 2, "etag": "\"0c78aef83f66abc1fa1e8477f296d394\""}
  ]
}
```

**Response `202 Accepted`** (`DatasetFile`):
```json
{
  "id": "01930b72-3333-7c00-8000-0000000000f2",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "parent_file_id": null,
  "original_filename": "scans-1995.zip",
  "relative_path": "1994/phnom-penh-post-1994-03.pdf",
  "member_path": null,
  "extension": "zip",
  "declared_mime": "application/pdf",
  "detected_mime": "application/pdf",
  "size_bytes": 367001600,
  "sha256": null,
  "processing_status": "uploaded",
  "scan_status": "pending",
  "failure_code": null,
  "failure_message": null,
  "is_container": true,
  "page_count": null,
  "previews": [],
  "text_available": false,
  "duplicates": [],
  "review_decision": null,
  "created_at": "2026-10-26T08:30:00Z",
  "uploaded_at": "2026-10-26T08:30:00Z",
  "processed_at": "2026-10-26T09:15:00Z"
}
```

**Status codes:** 202, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `upload.invalid_state` (409), `upload.expired` (409), `upload.parts_mismatch` (422), `upload.file_too_large` (413), `upload.dataset_too_large` (413), `upload.quota_exceeded` (413), `dataset.not_editable` (409), `upload.storage_unavailable` (500)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `DELETE /api/v1/uploads/{upload_id}` — Abort an upload

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof).

AbortMultipartUpload, session `aborted`, file row deleted. Idempotent for already aborted/expired sessions.

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `upload.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

### 10.8 Review

#### `GET /api/v1/reviews/queue` — Datasets awaiting review

- **Access:** `dataset.review`
- **Rate limit:** 600 / min per user.
- **Query:** `status` — Default submitted.; `data_class` — Filter.; `category` — Filter.; `language` — Filter.; `mine` — Only reviews claimed by me.; `page`, `page_size`, `sort` (sortable: `submitted_at`, `total_bytes`)

FIFO by submitted_at by default. Excludes the caller's own datasets (separation of duties).

**Response `200 OK`** (`PaginatedReviewQueueItem`):
```json
{
  "items": [
    {
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "dataset_code": "DS-2026-000123",
      "title": "Khmer newspaper scans 1990–1999",
      "owner_display_name": "Sophea K.",
      "data_class": "raw",
      "category": "news",
      "languages": ["km"],
      "file_count": 2,
      "total_bytes": 734003200,
      "submitted_at": "2026-10-26T09:15:00Z",
      "version_number": 1,
      "has_duplicate_flags": true,
      "contains_personal_data": false,
      "status": "submitted",
      "claimed_review_id": null
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/datasets/{dataset_id}/claim-review` — Claim a submitted dataset for review

- **Access:** `dataset.review` · CSRF
- **Rate limit:** 120 / min per user.

`submitted → in_review`; creates `dataset_reviews` (`in_progress`) with the caller as assignee. Uses `SELECT … FOR UPDATE SKIP LOCKED`-style guard; a concurrent claim gets 409. Owner cannot claim. A reviewer may hold at most `review_max_active_claims` (setting, default 5) in-progress reviews (AM-09).

**Response `201 Created`** (`Review`):
```json
{
  "id": "01930b74-5555-7e00-8000-0000000000c1",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "dataset_version_number": 1,
  "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
  "reviewer_name": "Dara R.",
  "status": "in_progress",
  "decision": null,
  "data_class": "raw",
  "checklist": {
    "rights_plausible": true,
    "matches_description": true,
    "language_correct": true,
    "no_unconsented_personal_data": true,
    "no_copyright_concern": null,
    "quality_acceptable": true,
    "metadata_complete": true
  },
  "quality_scores": {"legibility": 4, "completeness": 5, "accuracy": null, "relevance": 5, "labeling_quality": null},
  "overall_quality": 4.67,
  "internal_comments": "Check page 12 for faded print.",
  "feedback": null,
  "claimed_at": "2026-10-26T08:30:00Z",
  "finalized_at": null,
  "released_at": null,
  "version": 2
}
```

**Status codes:** 201, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `review.claim_limit_reached` (409), `review.already_claimed` (409), `dataset.invalid_state` (409), `permission.separation_of_duties` (403)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/reviews/{review_id}` — Review workspace data

- **Access:** `dataset.review`
- **Rate limit:** 600 / min per user.

Assignee reviewer, or `dataset.read.any`. Includes duplicate matches with matched ids, previous versions' finalized reviews (`history`).

**Response `200 OK`** (`ReviewDetail`):
```json
{
  "review": {
    "id": "01930b74-5555-7e00-8000-0000000000c1",
    "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
    "dataset_version_number": 1,
    "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
    "reviewer_name": "Dara R.",
    "status": "in_progress",
    "decision": null,
    "data_class": "raw",
    "checklist": {
      "rights_plausible": true,
      "matches_description": true,
      "language_correct": true,
      "no_unconsented_personal_data": true,
      "no_copyright_concern": null,
      "quality_acceptable": true,
      "metadata_complete": true
    },
    "quality_scores": {"legibility": 4, "completeness": 5, "accuracy": null, "relevance": 5, "labeling_quality": null},
    "overall_quality": 4.67,
    "internal_comments": "Check page 12 for faded print.",
    "feedback": null,
    "claimed_at": "2026-10-26T08:30:00Z",
    "finalized_at": null,
    "released_at": null,
    "version": 2
  },
  "dataset": {
    "id": "01930b71-2222-7b00-8000-0000000000d1",
    "code": "DS-2026-000123",
    "owner_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "owner_display_name": "Sophea K.",
    "title": "Khmer newspaper scans 1990–1999",
    "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
    "data_class": "raw",
    "category": "news",
    "languages": ["km"],
    "tags": ["newspaper", "ocr"],
    "source_description": "Personal archive, scanned by me.",
    "contains_personal_data": false,
    "personal_data_notes": null,
    "status": "in_review",
    "version_number": 1,
    "file_count": 2,
    "ready_file_count": 2,
    "failed_file_count": 0,
    "total_bytes": 734003200,
    "accepted_bytes": null,
    "earned_micros": null,
    "license_version": "CA-2026-10",
    "takedown_reason": null,
    "submitted_at": null,
    "finalized_at": null,
    "created_at": "2026-10-26T08:30:00Z",
    "updated_at": "2026-10-26T09:15:00Z",
    "version": 4
  },
  "files": [
    {
      "id": "01930b72-3333-7c00-8000-0000000000f1",
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "parent_file_id": null,
      "original_filename": "phnom-penh-post-1994-03.pdf",
      "relative_path": "1994/phnom-penh-post-1994-03.pdf",
      "member_path": null,
      "extension": "pdf",
      "declared_mime": "application/pdf",
      "detected_mime": "application/pdf",
      "size_bytes": 367001600,
      "sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
      "processing_status": "ready",
      "scan_status": "clean",
      "failure_code": null,
      "failure_message": null,
      "is_container": false,
      "page_count": 48,
      "previews": [{"page": 1, "width": 1654, "height": 2339, "content_type": "image/webp"}],
      "text_available": false,
      "duplicates": [
        {
          "kind": "near",
          "method": "dhash",
          "distance": 3,
          "matched_file_id": null,
          "matched_dataset_id": null,
          "matched_previously_accepted": true,
          "same_owner": false
        }
      ],
      "review_decision": null,
      "created_at": "2026-10-26T08:30:00Z",
      "uploaded_at": "2026-10-26T08:30:00Z",
      "processed_at": "2026-10-26T09:15:00Z"
    }
  ],
  "file_reviews": [
    {
      "file_id": "01930b72-3333-7c00-8000-0000000000f1",
      "decision": "accepted",
      "reason_code": null,
      "comment": null,
      "labeled_upgrade": false,
      "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
      "reviewed_at": "2026-10-26T09:15:00Z"
    }
  ],
  "summary": {
    "review_id": "01930b74-5555-7e00-8000-0000000000c1",
    "total_files": 2,
    "decided_files": 2,
    "undecided_files": 0,
    "not_reviewable_files": 0,
    "accepted_files": 1,
    "rejected_files": 1,
    "accepted_bytes": 367001600,
    "rejected_bytes": 367001600,
    "payable_bytes": 367001600,
    "non_payable_accepted_bytes": 0,
    "labeled_upgrade_files": 0,
    "data_class": "raw",
    "rate_micros_per_gb": 1000000,
    "payable_micros": 367001,
    "rejections_by_reason": {"illegible": 1},
    "allowed_decisions": ["partial", "request_changes"]
  },
  "history": []
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `PUT /api/v1/reviews/{review_id}/files/{file_id}` — Set decision for one file

- **Access:** `dataset.review` · CSRF
- **Rate limit:** 120 / min per user.

Upsert on (review_id, file_id). Assignee only; review `in_progress`.

**Request** (`FileReviewInput`, application/json):
```json
{
  "decision": "rejected",
  "reason_code": "illegible",
  "comment": "Pages 13–20 too faded to read.",
  "labeled_upgrade": false
}
```

**Response `200 OK`** (`FileReview`):
```json
{
  "file_id": "01930b72-3333-7c00-8000-0000000000f1",
  "decision": "rejected",
  "reason_code": "illegible",
  "comment": "Pages 13–20 too faded to read.",
  "labeled_upgrade": false,
  "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
  "reviewed_at": "2026-10-26T09:15:00Z"
}
```

**Validation:** reason_code required when rejected; labeled_upgrade only when dataset data_class=labeled, file sha256 previously paid at raw rate, HA-08 setting on; file must be reviewable (ready, clean, not container).

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `review.not_assignee` (403), `review.invalid_state` (409), `review.reason_required` (422), `review.file_not_reviewable` (422), `review.labeled_upgrade_not_applicable` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/reviews/{review_id}/files/bulk` — Set decision for many files

- **Access:** `dataset.review` · CSRF
- **Rate limit:** 120 / min per user.

Same rules as single; non-reviewable files are skipped with a code instead of failing the batch.

**Request** (`FileReviewBulk`, application/json):
```json
{
  "file_ids": ["01930b72-3333-7c00-8000-0000000000f1", "01930b72-3333-7c00-8000-0000000000f2"],
  "decision": "accepted"
}
```

**Response `200 OK`** (`FileReviewBulkResult`):
```json
{"updated": 2, "skipped": []}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `review.not_assignee` (403), `review.invalid_state` (409), `review.reason_required` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `PATCH /api/v1/reviews/{review_id}` — Update checklist, scores, comments, data class

- **Access:** `dataset.review` · CSRF
- **Rate limit:** 120 / min per user.
- **Headers:** `If-Match` (optional)

Assignee; partial merge into checklist/quality_scores; overall_quality recomputed as mean of non-null scores.

**Request** (`ReviewUpdate`, application/json):
```json
{
  "checklist": {"no_copyright_concern": true},
  "quality_scores": {"accuracy": 4},
  "feedback": "Good scans overall."
}
```

**Response `200 OK`** (`Review`):
```json
{
  "id": "01930b74-5555-7e00-8000-0000000000c1",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "dataset_version_number": 1,
  "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
  "reviewer_name": "Dara R.",
  "status": "in_progress",
  "decision": null,
  "data_class": "raw",
  "checklist": {
    "rights_plausible": true,
    "matches_description": true,
    "language_correct": true,
    "no_unconsented_personal_data": true,
    "no_copyright_concern": null,
    "quality_acceptable": true,
    "metadata_complete": true
  },
  "quality_scores": {"legibility": 4, "completeness": 5, "accuracy": null, "relevance": 5, "labeling_quality": null},
  "overall_quality": 4.67,
  "internal_comments": "Check page 12 for faded print.",
  "feedback": null,
  "claimed_at": "2026-10-26T08:30:00Z",
  "finalized_at": null,
  "released_at": null,
  "version": 2
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 412, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `review.not_assignee` (403), `review.invalid_state` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `precondition.failed`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/reviews/{review_id}/summary` — Accepted/rejected sizes and payable amount

- **Access:** `dataset.review`
- **Rate limit:** 600 / min per user.

Computed live from file decisions with the pricing rule in force now; `allowed_decisions` drives the finalize dialog.

**Response `200 OK`** (`ReviewSummary`):
```json
{
  "review_id": "01930b74-5555-7e00-8000-0000000000c1",
  "total_files": 2,
  "decided_files": 2,
  "undecided_files": 0,
  "not_reviewable_files": 0,
  "accepted_files": 1,
  "rejected_files": 1,
  "accepted_bytes": 367001600,
  "rejected_bytes": 367001600,
  "payable_bytes": 367001600,
  "non_payable_accepted_bytes": 0,
  "labeled_upgrade_files": 0,
  "data_class": "raw",
  "rate_micros_per_gb": 1000000,
  "payable_micros": 367001,
  "rejections_by_reason": {"illegible": 1},
  "allowed_decisions": ["partial", "request_changes"]
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/reviews/{review_id}/finalize` — Finalize the review (creates earnings)

- **Access:** `dataset.review` · CSRF
- **Rate limit:** 120 / min per user.
- **Headers:** `Idempotency-Key` (optional)

One DB transaction: lock review + dataset rows, validate consistency, set review `finalized`, dataset → `approved|partially_approved|rejected|changes_requested`, and for approve/partial write `earning_records` per payable file (§8.2–8.4, pricing rule pinned) plus one `dataset_earning` journal with idempotency key `dataset_review:{review_id}:earning`. Retries return the same result. Notifies owner (in-app + email).

**Request** (`FinalizeRequest`, application/json):
```json
{"decision": "partial", "feedback": "Pages 13–20 are illegible; the rest is excellent.", "data_class": "raw"}
```

**Response `200 OK`** (`FinalizeResult`):
```json
{
  "review": {
    "id": "01930b74-5555-7e00-8000-0000000000c1",
    "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
    "dataset_version_number": 1,
    "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
    "reviewer_name": "Dara R.",
    "status": "finalized",
    "decision": "partial",
    "data_class": "raw",
    "checklist": {
      "rights_plausible": true,
      "matches_description": true,
      "language_correct": true,
      "no_unconsented_personal_data": true,
      "no_copyright_concern": null,
      "quality_acceptable": true,
      "metadata_complete": true
    },
    "quality_scores": {"legibility": 4, "completeness": 5, "accuracy": null, "relevance": 5, "labeling_quality": null},
    "overall_quality": 4.67,
    "internal_comments": "Check page 12 for faded print.",
    "feedback": null,
    "claimed_at": "2026-10-26T08:30:00Z",
    "finalized_at": "2026-10-26T09:15:00Z",
    "released_at": null,
    "version": 2
  },
  "dataset_status": "partially_approved",
  "earning": {
    "journal_id": "01930b75-6666-7f00-8000-0000000000e1",
    "amount_micros": 367001,
    "records": 1,
    "credited_bucket": "available"
  }
}
```

**Validation:** all reviewable files decided (except request_changes); approve ⇒ 0 rejected; partial ⇒ ≥1 accepted and ≥1 rejected; reject ⇒ 0 accepted; feedback ≥ 10 chars unless approve.

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `review.not_assignee` (403), `review.invalid_state` (409), `review.incomplete` (422), `review.decision_inconsistent` (422), `review.feedback_required` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/reviews/{review_id}/release` — Release (unclaim) a review

- **Access:** `dataset.review` · CSRF
- **Rate limit:** 120 / min per user.

Assignee or admin. Review → `released`, dataset `in_review → submitted`; file decisions are kept on the released review for history but not carried over.

**Response `200 OK`** (`Review`):
```json
{
  "id": "01930b74-5555-7e00-8000-0000000000c1",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "dataset_version_number": 1,
  "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
  "reviewer_name": "Dara R.",
  "status": "released",
  "decision": null,
  "data_class": "raw",
  "checklist": {
    "rights_plausible": true,
    "matches_description": true,
    "language_correct": true,
    "no_unconsented_personal_data": true,
    "no_copyright_concern": null,
    "quality_acceptable": true,
    "metadata_complete": true
  },
  "quality_scores": {"legibility": 4, "completeness": 5, "accuracy": null, "relevance": 5, "labeling_quality": null},
  "overall_quality": 4.67,
  "internal_comments": "Check page 12 for faded print.",
  "feedback": null,
  "claimed_at": "2026-10-26T08:30:00Z",
  "finalized_at": null,
  "released_at": "2026-10-26T09:15:00Z",
  "version": 2
}
```

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `review.not_assignee` (403), `review.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/reviews/history` — My past reviews

- **Access:** `dataset.review`
- **Rate limit:** 600 / min per user.
- **Query:** `decision` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `reviewer_id` — Admins only: another reviewer.; `page`, `page_size`, `sort` (sortable: `finalized_at`, `claimed_at`)

**Response `200 OK`** (`PaginatedReview`):
```json
{
  "items": [
    {
      "id": "01930b74-5555-7e00-8000-0000000000c1",
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "dataset_version_number": 1,
      "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
      "reviewer_name": "Dara R.",
      "status": "finalized",
      "decision": "partial",
      "data_class": "raw",
      "checklist": {
        "rights_plausible": true,
        "matches_description": true,
        "language_correct": true,
        "no_unconsented_personal_data": true,
        "no_copyright_concern": null,
        "quality_acceptable": true,
        "metadata_complete": true
      },
      "quality_scores": {"legibility": 4, "completeness": 5, "accuracy": null, "relevance": 5, "labeling_quality": null},
      "overall_quality": 4.67,
      "internal_comments": "Check page 12 for faded print.",
      "feedback": null,
      "claimed_at": "2026-10-26T08:30:00Z",
      "finalized_at": null,
      "released_at": null,
      "version": 2
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

### 10.9 Finance

#### `GET /api/v1/wallet` — My balances

- **Access:** `payout.request`
- **Rate limit:** 600 / min per user.

Ledger-derived buckets (cached columns, reconciled nightly) plus the non-ledger estimate (§8.6). Reviewers without payout.request get 403.

**Response `200 OK`** (`Wallet`):
```json
{
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "currency": "USD",
  "estimated_micros": 734003,
  "pending_micros": 0,
  "available_micros": 12367001,
  "reserved_micros": 10000000,
  "paid_micros": 25000000,
  "adjustments_micros": 0,
  "approved_lifetime_micros": 47367001,
  "updated_at": "2026-10-26T09:15:00Z"
}
```

**Status codes:** 200, 401, 403, 429, 500, 503

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/wallet/transactions` — My ledger lines

- **Access:** `payout.request`
- **Rate limit:** 600 / min per user.
- **Query:** `kind` — Filter.; `bucket` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`)

**Response `200 OK`** (`PaginatedLedgerLine`):
```json
{
  "items": [
    {
      "id": "01930b75-6666-7f00-8000-0000000000e2",
      "journal_id": "01930b75-6666-7f00-8000-0000000000e1",
      "kind": "dataset_earning",
      "wallet_id": "01930b75-6666-7f00-8000-0000000000e9",
      "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "bucket": "available",
      "amount_micros": 367001,
      "source_type": "dataset_review",
      "source_id": "01930b74-5555-7e00-8000-0000000000c1",
      "description": "Earning for “Khmer newspaper scans 1990–1999” (v1)",
      "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
      "created_at": "2026-10-26T09:15:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/earnings` — My earning records

- **Access:** `payout.request`
- **Rate limit:** 600 / min per user.
- **Query:** `dataset_id` — Filter.; `source_type` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`, `amount_micros`)

**Response `200 OK`** (`PaginatedEarningRecord`):
```json
{
  "items": [
    {
      "id": "01930b75-6666-7f00-8000-0000000000e3",
      "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "source_type": "dataset_review",
      "source_id": "01930b74-5555-7e00-8000-0000000000c1",
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "file_id": "01930b72-3333-7c00-8000-0000000000f1",
      "task_id": null,
      "accepted_bytes": 367001600,
      "data_class": "raw",
      "rate_micros_per_gb": 1000000,
      "pricing_rule_id": "01930b7b-cccc-7500-8000-000000000601",
      "labeled_upgrade": false,
      "previously_paid_rate_micros_per_gb": null,
      "amount_micros": 367001,
      "journal_id": "01930b75-6666-7f00-8000-0000000000e1",
      "created_at": "2026-10-26T09:15:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/payouts` — Request a withdrawal

- **Access:** `payout.request` · CSRF
- **Rate limit:** 10 / h per user.
- **Headers:** `Idempotency-Key` (required)

Transaction: lock wallet row `FOR UPDATE`, check §8.7 rules after the lock, insert `payout_requests` (`requested`, approvals_required = 2 if amount ≥ threshold else 1, method snapshot), write `payout_reserve` journal (`payout:{id}:reserve`). The partial unique index guarantees one open payout per user even under races. `Idempotency-Key` is **required** and stored per user.

**Request** (`PayoutCreate`, application/json):
```json
{"amount_micros": 10000000, "payout_method_id": "01930b76-7777-7000-8000-000000000102", "note": null}
```

**Response `201 Created`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
  "code": "PO-2026-000042",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "user_display_name": "Sophea K.",
  "amount_micros": 10000000,
  "currency": "USD",
  "status": "requested",
  "payout_method": {
    "id": "01930b76-7777-7000-8000-000000000102",
    "type": "aba_pay",
    "label": "My ABA account",
    "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
  },
  "note": null,
  "approvals_required": 1,
  "approvals": [],
  "record": null,
  "rejection_reason": null,
  "failure_reason": null,
  "cancellation_reason": null,
  "reversal_reason": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T08:30:00Z",
  "version": 1
}
```

**Validation:** amount multiple of 10,000 micros (whole cents); payout_min_micros ≤ amount ≤ payout_max_micros; amount ≤ available; verification approved, account active; method owned by caller.

**Status codes:** 201, 400, 401, 403, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `payout.insufficient_balance` (409), `payout.open_request_exists` (409), `payout.amount_below_minimum` (422), `payout.amount_above_maximum` (422), `payout.amount_not_whole_cents` (422), `payout.verification_required` (403), `payout.method_invalid` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `idempotency.key_required`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/payouts` — My payouts

- **Access:** `payout.request`
- **Rate limit:** 600 / min per user.
- **Query:** `status` — Filter.; `page`, `page_size`, `sort` (sortable: `created_at`, `amount_micros`)

**Response `200 OK`** (`PaginatedPayout`):
```json
{
  "items": [
    {
      "id": "01930b76-7777-7000-8000-000000000101",
      "code": "PO-2026-000042",
      "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "user_display_name": "Sophea K.",
      "amount_micros": 10000000,
      "currency": "USD",
      "status": "requested",
      "payout_method": {
        "id": "01930b76-7777-7000-8000-000000000102",
        "type": "aba_pay",
        "label": "My ABA account",
        "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
      },
      "note": null,
      "approvals_required": 1,
      "approvals": [],
      "record": null,
      "rejection_reason": null,
      "failure_reason": null,
      "cancellation_reason": null,
      "reversal_reason": null,
      "created_at": "2026-10-26T08:30:00Z",
      "updated_at": "2026-10-26T08:30:00Z",
      "version": 1
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/payouts/{payout_id}` — One of my payouts

- **Access:** `payout.request`
- **Rate limit:** 600 / min per user.

Owner only (admins use /admin/payouts/{id}). Proof file metadata visible; approver identities shown as 'DataHub finance'.

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
  "code": "PO-2026-000042",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "user_display_name": "Sophea K.",
  "amount_micros": 10000000,
  "currency": "USD",
  "status": "paid",
  "payout_method": {
    "id": "01930b76-7777-7000-8000-000000000102",
    "type": "aba_pay",
    "label": "My ABA account",
    "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
  },
  "note": null,
  "approvals_required": 1,
  "approvals": [
    {
      "id": "01930b76-7777-7000-8000-000000000103",
      "payout_id": "01930b76-7777-7000-8000-000000000101",
      "approver_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
      "approver_name": "Admin Vanna",
      "comment": null,
      "created_at": "2026-10-26T09:15:00Z"
    }
  ],
  "record": {
    "id": "01930b76-7777-7000-8000-000000000104",
    "payout_id": "01930b76-7777-7000-8000-000000000101",
    "payment_reference": "ABA-20261027-558812",
    "method": "aba_pay",
    "paid_at": "2026-10-27T01:55:00Z",
    "recorded_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
    "notes": null,
    "proof": null,
    "created_at": "2026-10-27T02:00:00Z"
  },
  "rejection_reason": null,
  "failure_reason": null,
  "cancellation_reason": null,
  "reversal_reason": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-27T02:00:00Z",
  "version": 3
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/payouts/{payout_id}/cancel` — Cancel my pending withdrawal

- **Access:** `payout.request` · CSRF
- **Rate limit:** 120 / min per user.
- **Headers:** `Idempotency-Key` (optional)

`requested → cancelled` only (approved payouts can be cancelled by admins). Writes `payout_release` journal.

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
  "code": "PO-2026-000042",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "user_display_name": "Sophea K.",
  "amount_micros": 10000000,
  "currency": "USD",
  "status": "cancelled",
  "payout_method": {
    "id": "01930b76-7777-7000-8000-000000000102",
    "type": "aba_pay",
    "label": "My ABA account",
    "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
  },
  "note": null,
  "approvals_required": 1,
  "approvals": [],
  "record": null,
  "rejection_reason": null,
  "failure_reason": null,
  "cancellation_reason": "Cancelled by contributor",
  "reversal_reason": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T08:30:00Z",
  "version": 2
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `payout.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`, `service_unavailable`

### 10.10 Admin finance

#### `GET /api/v1/admin/finance/overview` — Finance dashboard figures

- **Access:** `finance.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

**Response `200 OK`** (`FinanceOverview`):
```json
{
  "currency": "USD",
  "liabilities": {"pending_micros": 0, "available_micros": 812440120, "reserved_micros": 45000000},
  "paid_lifetime_micros": 2330000000,
  "paid_this_month_micros": 410000000,
  "earned_this_month_micros": 530120000,
  "open_payouts": {
    "requested_count": 4,
    "requested_micros": 45000000,
    "approved_count": 1,
    "approved_micros": 10000000,
    "awaiting_second_approval_count": 1
  },
  "last_reconciliation": {"run_at": "2026-10-26T00:10:00Z", "status": "ok"}
}
```

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/payouts` — Payout requests

- **Access:** `finance.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `q` — Payout code (`PO-YYYY-NNNNNN`, exact or prefix), recipient email or display name.; `status` — Filter.; `user_id` — Only payouts of this recipient (AM-05; used by the user-detail page).; `method` — Filter.; `min_amount_micros` — Filter.; `max_amount_micros` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`, `amount_micros`, `updated_at`)

**Response `200 OK`** (`PaginatedPayout`):
```json
{
  "items": [
    {
      "id": "01930b76-7777-7000-8000-000000000101",
      "code": "PO-2026-000042",
      "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "user_display_name": "Sophea K.",
      "amount_micros": 10000000,
      "currency": "USD",
      "status": "requested",
      "payout_method": {
        "id": "01930b76-7777-7000-8000-000000000102",
        "type": "aba_pay",
        "label": "My ABA account",
        "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
      },
      "note": null,
      "approvals_required": 1,
      "approvals": [],
      "record": null,
      "rejection_reason": null,
      "failure_reason": null,
      "cancellation_reason": null,
      "reversal_reason": null,
      "created_at": "2026-10-26T08:30:00Z",
      "updated_at": "2026-10-26T08:30:00Z",
      "version": 1
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/payouts/{payout_id}` — Payout detail (full method details)

- **Access:** `finance.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Unmasked payout-method details only for `payout.approve` holders; access is audited (`payout.view_details`).

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
  "code": "PO-2026-000042",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "user_display_name": "Sophea K.",
  "amount_micros": 10000000,
  "currency": "USD",
  "status": "requested",
  "payout_method": {
    "id": "01930b76-7777-7000-8000-000000000102",
    "type": "aba_pay",
    "label": "My ABA account",
    "details": {"account_name": "KEO SOPHEA", "account_number": "000124821"}
  },
  "note": null,
  "approvals_required": 1,
  "approvals": [],
  "record": null,
  "rejection_reason": null,
  "failure_reason": null,
  "cancellation_reason": null,
  "reversal_reason": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T08:30:00Z",
  "version": 1
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/payouts/{payout_id}/approve` — Approve a payout

- **Access:** `payout.approve` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Headers:** `Idempotency-Key` (optional)

Inserts `payout_approvals` (unique per approver). When approvals = approvals_required, status `requested → approved`; otherwise stays `requested`. Approver ≠ recipient; second approver ≠ first.

**Request** (`ApproveRequest`, application/json):
```json
{"comment": "Verified bank details."}
```

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
  "code": "PO-2026-000042",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "user_display_name": "Sophea K.",
  "amount_micros": 10000000,
  "currency": "USD",
  "status": "approved",
  "payout_method": {
    "id": "01930b76-7777-7000-8000-000000000102",
    "type": "aba_pay",
    "label": "My ABA account",
    "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
  },
  "note": null,
  "approvals_required": 1,
  "approvals": [
    {
      "id": "01930b76-7777-7000-8000-000000000103",
      "payout_id": "01930b76-7777-7000-8000-000000000101",
      "approver_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
      "approver_name": "Admin Vanna",
      "comment": null,
      "created_at": "2026-10-26T09:15:00Z"
    }
  ],
  "record": null,
  "rejection_reason": null,
  "failure_reason": null,
  "cancellation_reason": null,
  "reversal_reason": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T08:30:00Z",
  "version": 2
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `payout.invalid_state` (409), `payout.already_approved_by_you` (409), `permission.separation_of_duties` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/payouts/{payout_id}/reject` — Reject a payout

- **Access:** `payout.approve` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Headers:** `Idempotency-Key` (optional)

`requested → rejected`, `payout_release` journal returns funds to available; contributor notified with the reason.

**Request** (`ReasonRequest`, application/json):
```json
{"reason": "Account name does not match verified legal name."}
```

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
  "code": "PO-2026-000042",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "user_display_name": "Sophea K.",
  "amount_micros": 10000000,
  "currency": "USD",
  "status": "rejected",
  "payout_method": {
    "id": "01930b76-7777-7000-8000-000000000102",
    "type": "aba_pay",
    "label": "My ABA account",
    "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
  },
  "note": null,
  "approvals_required": 1,
  "approvals": [],
  "record": null,
  "rejection_reason": "Account name does not match verified legal name.",
  "failure_reason": null,
  "cancellation_reason": null,
  "reversal_reason": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T08:30:00Z",
  "version": 2
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `payout.invalid_state` (409), `permission.separation_of_duties` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/payouts/{payout_id}/mark-paid` — Record the external payment

- **Access:** `payout.record_payment` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Headers:** `Idempotency-Key` (optional)

Only after the admin has actually sent money outside DataHub. `approved → paid`; inserts `payout_records` and `payout_settle` journal (`payout:{id}:settle`). Recorder ≠ recipient. Proof may be attached before or after via `/proof`.

**Request** (`MarkPaidRequest`, application/json):
```json
{"payment_reference": "ABA-20261027-558812", "paid_at": "2026-10-27T01:55:00Z", "notes": null}
```

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
  "code": "PO-2026-000042",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "user_display_name": "Sophea K.",
  "amount_micros": 10000000,
  "currency": "USD",
  "status": "paid",
  "payout_method": {
    "id": "01930b76-7777-7000-8000-000000000102",
    "type": "aba_pay",
    "label": "My ABA account",
    "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
  },
  "note": null,
  "approvals_required": 1,
  "approvals": [
    {
      "id": "01930b76-7777-7000-8000-000000000103",
      "payout_id": "01930b76-7777-7000-8000-000000000101",
      "approver_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
      "approver_name": "Admin Vanna",
      "comment": null,
      "created_at": "2026-10-26T09:15:00Z"
    }
  ],
  "record": {
    "id": "01930b76-7777-7000-8000-000000000104",
    "payout_id": "01930b76-7777-7000-8000-000000000101",
    "payment_reference": "ABA-20261027-558812",
    "method": "aba_pay",
    "paid_at": "2026-10-27T01:55:00Z",
    "recorded_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
    "notes": null,
    "proof": null,
    "created_at": "2026-10-27T02:00:00Z"
  },
  "rejection_reason": null,
  "failure_reason": null,
  "cancellation_reason": null,
  "reversal_reason": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-27T02:00:00Z",
  "version": 3
}
```

**Validation:** payment_reference 3–120 chars, unique per method; paid_at ≥ approval time and ≤ now + 5 min.

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `payout.invalid_state` (409), `payout.reference_duplicate` (409), `payout.paid_at_invalid` (422), `permission.separation_of_duties` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/payouts/{payout_id}/mark-failed` — Mark an approved payout as failed

- **Access:** `payout.record_payment` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Headers:** `Idempotency-Key` (optional)

`approved → failed` (transfer attempt failed before settlement); `payout_release` journal.

**Request** (`ReasonRequest`, application/json):
```json
{"reason": "Bank rejected transfer: account closed."}
```

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
  "code": "PO-2026-000042",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "user_display_name": "Sophea K.",
  "amount_micros": 10000000,
  "currency": "USD",
  "status": "failed",
  "payout_method": {
    "id": "01930b76-7777-7000-8000-000000000102",
    "type": "aba_pay",
    "label": "My ABA account",
    "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
  },
  "note": null,
  "approvals_required": 1,
  "approvals": [],
  "record": null,
  "rejection_reason": null,
  "failure_reason": "Bank rejected transfer: account closed.",
  "cancellation_reason": null,
  "reversal_reason": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T08:30:00Z",
  "version": 3
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `payout.invalid_state` (409), `permission.separation_of_duties` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/payouts/{payout_id}/cancel` — Cancel an approved payout

- **Access:** `payout.approve` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Headers:** `Idempotency-Key` (optional)

`approved → cancelled`; `payout_release` journal.

**Request** (`ReasonRequest`, application/json):
```json
{"reason": "Contributor asked to change method."}
```

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
  "code": "PO-2026-000042",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "user_display_name": "Sophea K.",
  "amount_micros": 10000000,
  "currency": "USD",
  "status": "cancelled",
  "payout_method": {
    "id": "01930b76-7777-7000-8000-000000000102",
    "type": "aba_pay",
    "label": "My ABA account",
    "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
  },
  "note": null,
  "approvals_required": 1,
  "approvals": [],
  "record": null,
  "rejection_reason": null,
  "failure_reason": null,
  "cancellation_reason": "Contributor asked to change method.",
  "reversal_reason": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T08:30:00Z",
  "version": 3
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `payout.invalid_state` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/payouts/{payout_id}/reverse` — Reverse a paid payout (super_admin)

- **Access:** `finance.adjust` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Headers:** `Idempotency-Key` (optional)

`paid → reversed`; `payout_reversal` journal moves amount from `paid` back to `available`. super_admin only; actor ≠ recipient.

**Request** (`ReasonRequest`, application/json):
```json
{"reason": "Transfer bounced on 2026-10-29, bank ref R-7781."}
```

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
  "code": "PO-2026-000042",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "user_display_name": "Sophea K.",
  "amount_micros": 10000000,
  "currency": "USD",
  "status": "reversed",
  "payout_method": {
    "id": "01930b76-7777-7000-8000-000000000102",
    "type": "aba_pay",
    "label": "My ABA account",
    "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}
  },
  "note": null,
  "approvals_required": 1,
  "approvals": [
    {
      "id": "01930b76-7777-7000-8000-000000000103",
      "payout_id": "01930b76-7777-7000-8000-000000000101",
      "approver_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
      "approver_name": "Admin Vanna",
      "comment": null,
      "created_at": "2026-10-26T09:15:00Z"
    }
  ],
  "record": {
    "id": "01930b76-7777-7000-8000-000000000104",
    "payout_id": "01930b76-7777-7000-8000-000000000101",
    "payment_reference": "ABA-20261027-558812",
    "method": "aba_pay",
    "paid_at": "2026-10-27T01:55:00Z",
    "recorded_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
    "notes": null,
    "proof": null,
    "created_at": "2026-10-27T02:00:00Z"
  },
  "rejection_reason": null,
  "failure_reason": null,
  "cancellation_reason": null,
  "reversal_reason": "Transfer bounced on 2026-10-29, bank ref R-7781.",
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-27T02:00:00Z",
  "version": 4
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `payout.invalid_state` (409), `permission.separation_of_duties` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/payouts/{payout_id}/proof` — Upload payment proof

- **Access:** `payout.record_payment` · admin MFA session · CSRF
- **Rate limit:** 600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

multipart/form-data, PDF/PNG/JPEG ≤ 10 MB (magic bytes), ClamAV scanned, stored at `payouts/{payout_id}/proof/{attachment_id}`. Allowed while status `approved` (staged, attached on mark-paid) or `paid`. Replacing keeps the previous object (audited).

**Request** (`AttachmentUpload`, multipart/form-data):
```json
{"file": "<binary aba-receipt.pdf>"}
```

**Response `201 Created`** (`PayoutRecord`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000104",
  "payout_id": "01930b76-7777-7000-8000-000000000101",
  "payment_reference": "ABA-20261027-558812",
  "method": "aba_pay",
  "paid_at": "2026-10-27T01:55:00Z",
  "recorded_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
  "notes": null,
  "proof": {
    "filename": "aba-receipt.pdf",
    "size_bytes": 84211,
    "content_type": "application/pdf",
    "uploaded_at": "2026-10-26T09:15:00Z"
  },
  "created_at": "2026-10-27T02:00:00Z"
}
```

**Status codes:** 201, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `payout.invalid_state` (409), `payout.proof_invalid` (415), `message.attachment_too_large` (413)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/adjustments` — Manual ledger adjustment (super_admin)

- **Access:** `finance.adjust` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Headers:** `Idempotency-Key` (optional)

Writes `payout_adjustments` + `adjustment_credit|adjustment_debit` journal (`adjustment:{id}`). Debits cannot drive available below 0. Actor ≠ target user. Never edits existing ledger lines.

**Request** (`AdjustmentCreate`, application/json):
```json
{
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "direction": "credit",
  "amount_micros": 500000,
  "reason_code": "correction",
  "reason": "Rate rounding correction for dataset v1 (ticket #42)."
}
```

**Response `201 Created`** (`Adjustment`):
```json
{
  "id": "01930b7b-cccc-7500-8000-000000000602",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "direction": "credit",
  "amount_micros": 500000,
  "reason_code": "correction",
  "reason": "Rate rounding correction for dataset v1 (ticket #42).",
  "journal_id": "01930b75-6666-7f00-8000-0000000000e1",
  "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f09",
  "created_at": "2026-10-26T09:15:00Z"
}
```

**Status codes:** 201, 400, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `finance.adjustment_negative_balance` (409), `permission.separation_of_duties` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/ledger` — Ledger lines (all wallets)

- **Access:** `finance.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `user_id` — Filter.; `wallet_id` — Filter.; `journal_id` — Filter.; `kind` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`)

**Response `200 OK`** (`PaginatedLedgerLine`):
```json
{
  "items": [
    {
      "id": "01930b75-6666-7f00-8000-0000000000e2",
      "journal_id": "01930b75-6666-7f00-8000-0000000000e1",
      "kind": "dataset_earning",
      "wallet_id": "01930b75-6666-7f00-8000-0000000000e9",
      "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "bucket": "available",
      "amount_micros": 367001,
      "source_type": "dataset_review",
      "source_id": "01930b74-5555-7e00-8000-0000000000c1",
      "description": "Earning for “Khmer newspaper scans 1990–1999” (v1)",
      "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
      "created_at": "2026-10-26T09:15:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `GET /api/v1/pricing-rules` — Pricing rule history

- **Access:** `finance.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

All rules, past, current and scheduled. Path is outside /admin per baseline §12 but requires admin MFA like other admin reads.

**Response `200 OK`** (`PricingRuleList`):
```json
{
  "items": [
    {
      "id": "01930b7b-cccc-7500-8000-000000000601",
      "data_class": "raw",
      "rate_micros_per_gb": 1000000,
      "effective_from": "2026-10-01T00:00:00Z",
      "effective_to": null,
      "note": "Launch rate (HA-06).",
      "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f09",
      "created_at": "2026-09-30T00:00:00Z"
    },
    {
      "id": "01930b7b-cccc-7500-8000-000000000603",
      "data_class": "labeled",
      "rate_micros_per_gb": 1500000,
      "effective_from": "2026-10-01T00:00:00Z",
      "effective_to": null,
      "note": "Launch rate (HA-06).",
      "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f09",
      "created_at": "2026-09-30T00:00:00Z"
    }
  ]
}
```

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/pricing-rules` — Schedule a new rate (super_admin)

- **Access:** `pricing.manage` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Headers:** `Idempotency-Key` (optional)

Closes the previous open rule at effective_from (sets effective_to) and inserts the new one; rules are never edited. Reviews finalized after effective_from use the new rate.

**Request** (`PricingRuleCreate`, application/json):
```json
{
  "data_class": "labeled",
  "rate_micros_per_gb": 1750000,
  "effective_from": "2027-01-01T00:00:00Z",
  "note": "Owner-approved rate change (HA-06)."
}
```

**Response `201 Created`** (`PricingRule`):
```json
{
  "id": "01930b7b-cccc-7500-8000-000000000601",
  "data_class": "labeled",
  "rate_micros_per_gb": 1750000,
  "effective_from": "2027-01-01T00:00:00Z",
  "effective_to": null,
  "note": "Owner-approved rate change (HA-06).",
  "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f09",
  "created_at": "2026-09-30T00:00:00Z"
}
```

**Status codes:** 201, 400, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `pricing.overlap` (409), `pricing.effective_from_in_past` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/finance/reconciliation` — Latest ledger reconciliation result

- **Access:** `finance.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

**Response `200 OK`** (`Reconciliation`):
```json
{
  "run_at": "2026-10-26T00:10:00Z",
  "status": "ok",
  "wallets_checked": 1843,
  "journal_imbalances": 0,
  "mismatches": []
}
```

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

### 10.11 Annotation

#### `GET /api/v1/annotation/projects` — List annotation projects

- **Access:** `annotation.manage` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `status` — Filter.; `q` — Case-insensitive search text.; `page`, `page_size`, `sort` (sortable: `created_at`, `name`, `deadline`)

**Response `200 OK`** (`PaginatedAnnotationProject`):
```json
{
  "items": [
    {
      "id": "01930b77-8888-7100-8000-000000000201",
      "name": "Khmer newspaper transcription — batch 1",
      "instructions": "Transcribe each page exactly as printed. Keep COENG sequences.",
      "annotation_types": ["transcription", "page_label"],
      "label_set": ["headline", "article", "advertisement", "mixed"],
      "metadata_schema": [{"key": "publication_date", "label": "Publication date", "type": "date", "options": [], "required": true}],
      "task_unit": "page",
      "reward_per_task_micros": 0,
      "reward_per_page_micros": 150000,
      "deadline": "2026-12-15T00:00:00Z",
      "review_required": true,
      "status": "active",
      "dataset_ids": ["01930b71-2222-7b00-8000-0000000000d1"],
      "progress": {
        "total": 120,
        "unassigned": 40,
        "assigned": 20,
        "in_progress": 15,
        "submitted": 10,
        "in_review": 5,
        "approved": 28,
        "changes_requested": 2,
        "cancelled": 0
      },
      "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
      "created_at": "2026-10-26T08:30:00Z",
      "closed_at": null,
      "version": 1
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `POST /api/v1/annotation/projects` — Create an annotation project

- **Access:** `annotation.manage` · admin MFA session · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

**Request** (`AnnotationProjectCreate`, application/json):
```json
{
  "name": "Khmer newspaper transcription — batch 1",
  "instructions": "Transcribe each page exactly as printed. Keep COENG sequences.",
  "annotation_types": ["transcription", "page_label"],
  "label_set": ["headline", "article", "advertisement", "mixed"],
  "metadata_schema": [{"key": "publication_date", "label": "Publication date", "type": "date", "options": [], "required": true}],
  "task_unit": "page",
  "reward_per_task_micros": 0,
  "reward_per_page_micros": 150000,
  "deadline": "2026-12-15T00:00:00Z",
  "dataset_ids": ["01930b71-2222-7b00-8000-0000000000d1"]
}
```

**Response `201 Created`** (`AnnotationProject`):
```json
{
  "id": "01930b77-8888-7100-8000-000000000201",
  "name": "Khmer newspaper transcription — batch 1",
  "instructions": "Transcribe each page exactly as printed. Keep COENG sequences.",
  "annotation_types": ["transcription", "page_label"],
  "label_set": ["headline", "article", "advertisement", "mixed"],
  "metadata_schema": [{"key": "publication_date", "label": "Publication date", "type": "date", "options": [], "required": true}],
  "task_unit": "page",
  "reward_per_task_micros": 0,
  "reward_per_page_micros": 150000,
  "deadline": "2026-12-15T00:00:00Z",
  "review_required": true,
  "status": "active",
  "dataset_ids": ["01930b71-2222-7b00-8000-0000000000d1"],
  "progress": {
    "total": 0,
    "unassigned": 0,
    "assigned": 0,
    "in_progress": 0,
    "submitted": 0,
    "in_review": 0,
    "approved": 0,
    "changes_requested": 0,
    "cancelled": 0
  },
  "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
  "created_at": "2026-10-26T08:30:00Z",
  "closed_at": null,
  "version": 1
}
```

**Validation:** annotation_types ⊆ v1 types (bbox rejected); label_set required when classification selected; metadata_schema required when metadata selected; select fields need ≥1 option; keys unique; reward_per_task_micros + reward_per_page_micros > 0; datasets approved/partially_approved.

**Status codes:** 201, 400, 401, 403, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `annotation.dataset_ineligible` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `GET /api/v1/annotation/projects/{project_id}` — Project detail with progress

- **Access:** `annotation.manage` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

**Response `200 OK`** (`AnnotationProject`):
```json
{
  "id": "01930b77-8888-7100-8000-000000000201",
  "name": "Khmer newspaper transcription — batch 1",
  "instructions": "Transcribe each page exactly as printed. Keep COENG sequences.",
  "annotation_types": ["transcription", "page_label"],
  "label_set": ["headline", "article", "advertisement", "mixed"],
  "metadata_schema": [{"key": "publication_date", "label": "Publication date", "type": "date", "options": [], "required": true}],
  "task_unit": "page",
  "reward_per_task_micros": 0,
  "reward_per_page_micros": 150000,
  "deadline": "2026-12-15T00:00:00Z",
  "review_required": true,
  "status": "active",
  "dataset_ids": ["01930b71-2222-7b00-8000-0000000000d1"],
  "progress": {
    "total": 120,
    "unassigned": 40,
    "assigned": 20,
    "in_progress": 15,
    "submitted": 10,
    "in_review": 5,
    "approved": 28,
    "changes_requested": 2,
    "cancelled": 0
  },
  "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
  "created_at": "2026-10-26T08:30:00Z",
  "closed_at": null,
  "version": 1
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `PATCH /api/v1/annotation/projects/{project_id}` — Update a project

- **Access:** `annotation.manage` · admin MFA session · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Headers:** `If-Match` (optional)

**Request** (`AnnotationProjectUpdate`, application/json):
```json
{"deadline": "2026-12-31T00:00:00Z", "instructions": "Updated: mark illegible words with [?]."}
```

**Response `200 OK`** (`AnnotationProject`):
```json
{
  "id": "01930b77-8888-7100-8000-000000000201",
  "name": "Khmer newspaper transcription — batch 1",
  "instructions": "Transcribe each page exactly as printed. Keep COENG sequences.",
  "annotation_types": ["transcription", "page_label"],
  "label_set": ["headline", "article", "advertisement", "mixed"],
  "metadata_schema": [{"key": "publication_date", "label": "Publication date", "type": "date", "options": [], "required": true}],
  "task_unit": "page",
  "reward_per_task_micros": 0,
  "reward_per_page_micros": 150000,
  "deadline": "2026-12-15T00:00:00Z",
  "review_required": true,
  "status": "active",
  "dataset_ids": ["01930b71-2222-7b00-8000-0000000000d1"],
  "progress": {
    "total": 120,
    "unassigned": 40,
    "assigned": 20,
    "in_progress": 15,
    "submitted": 10,
    "in_review": 5,
    "approved": 28,
    "changes_requested": 2,
    "cancelled": 0
  },
  "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
  "created_at": "2026-10-26T08:30:00Z",
  "closed_at": null,
  "version": 1
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 412, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `annotation.project_closed` (409), `annotation.immutable_field` (409), `annotation.dataset_ineligible` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `precondition.failed`, `rate_limited`, `internal_error`

#### `POST /api/v1/annotation/projects/{project_id}/generate-tasks` — Split source files into tasks

- **Access:** `annotation.manage` · admin MFA session · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

One task per accepted, annotatable file (task_unit=file) or per page (task_unit=page, pages from page_count). Unique (project_id, file_id, page_number) makes it idempotent. Ineligible: rejected, non-annotatable formats (§7), failed/quarantined.

**Request** (`GenerateTasksRequest`, application/json):
```json
{"dataset_ids": ["01930b71-2222-7b00-8000-0000000000d1"], "dry_run": false}
```

**Response `200 OK`** (`GenerateTasksResult`):
```json
{"created": 96, "skipped_existing": 24, "skipped_ineligible": 3, "dry_run": false}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `annotation.project_closed` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/annotation/projects/{project_id}/close` — Close a project

- **Access:** `annotation.manage` · admin MFA session · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

All non-approved tasks → `cancelled`; annotators notified; approved rewards unaffected.

**Response `200 OK`** (`AnnotationProject`):
```json
{
  "id": "01930b77-8888-7100-8000-000000000201",
  "name": "Khmer newspaper transcription — batch 1",
  "instructions": "Transcribe each page exactly as printed. Keep COENG sequences.",
  "annotation_types": ["transcription", "page_label"],
  "label_set": ["headline", "article", "advertisement", "mixed"],
  "metadata_schema": [{"key": "publication_date", "label": "Publication date", "type": "date", "options": [], "required": true}],
  "task_unit": "page",
  "reward_per_task_micros": 0,
  "reward_per_page_micros": 150000,
  "deadline": "2026-12-15T00:00:00Z",
  "review_required": true,
  "status": "closed",
  "dataset_ids": ["01930b71-2222-7b00-8000-0000000000d1"],
  "progress": {
    "total": 120,
    "unassigned": 40,
    "assigned": 20,
    "in_progress": 15,
    "submitted": 10,
    "in_review": 5,
    "approved": 28,
    "changes_requested": 2,
    "cancelled": 0
  },
  "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
  "created_at": "2026-10-26T08:30:00Z",
  "closed_at": "2026-10-26T09:15:00Z",
  "version": 1
}
```

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `annotation.project_closed` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `GET /api/v1/annotation/projects/{project_id}/tasks` — Tasks of a project

- **Access:** `annotation.manage` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `status` — Filter (repeatable).; `assignee_id` — Filter.; `dataset_id` — Filter.; `overdue` — due_at < now and not approved.; `page`, `page_size`, `sort` (sortable: `created_at`, `due_at`, `status`)

**Response `200 OK`** (`PaginatedAnnotationTask`):
```json
{
  "items": [
    {
      "id": "01930b77-8888-7100-8000-000000000202",
      "project_id": "01930b77-8888-7100-8000-000000000201",
      "project_name": "Khmer newspaper transcription — batch 1",
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "file_id": "01930b72-3333-7c00-8000-0000000000f1",
      "original_filename": "phnom-penh-post-1994-03.pdf",
      "page_number": 3,
      "page_count": 1,
      "status": "in_progress",
      "assignee_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
      "assignee_name": "Bopha A.",
      "reviewer_id": null,
      "due_at": "2026-11-05T00:00:00Z",
      "reward_micros": 150000,
      "annotation_version": 7,
      "submitted_at": null,
      "approved_at": null,
      "latest_review": null,
      "created_at": "2026-10-26T08:30:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `POST /api/v1/annotation/tasks/{task_id}/assign` — Assign (or reassign) a task

- **Access:** `annotation.manage` · admin MFA session · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Task `unassigned → assigned` (or reassigns an `assigned|in_progress` task: old assignment ended, draft kept). Annotator must hold `annotator`, be active and verification `approved` (A-08). Notifies annotator.

**Request** (`AssignRequest`, application/json):
```json
{"annotator_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05", "due_at": "2026-11-05T00:00:00Z"}
```

**Response `200 OK`** (`AnnotationTask`):
```json
{
  "id": "01930b77-8888-7100-8000-000000000202",
  "project_id": "01930b77-8888-7100-8000-000000000201",
  "project_name": "Khmer newspaper transcription — batch 1",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "file_id": "01930b72-3333-7c00-8000-0000000000f1",
  "original_filename": "phnom-penh-post-1994-03.pdf",
  "page_number": 3,
  "page_count": 1,
  "status": "assigned",
  "assignee_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
  "assignee_name": "Bopha A.",
  "reviewer_id": null,
  "due_at": "2026-11-05T00:00:00Z",
  "reward_micros": 150000,
  "annotation_version": null,
  "submitted_at": null,
  "approved_at": null,
  "latest_review": null,
  "created_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `annotation.invalid_state` (409), `annotation.annotator_ineligible` (422), `annotation.project_closed` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/annotation/tasks/bulk-assign` — Assign many tasks

- **Access:** `annotation.manage` · admin MFA session · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

≤ 500 per call; each item validated independently; failures reported per task.

**Request** (`BulkAssignRequest`, application/json):
```json
{
  "assignments": [{"task_id": "01930b77-8888-7100-8000-000000000202", "annotator_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05"}],
  "due_at": "2026-11-05T00:00:00Z"
}
```

**Response `200 OK`** (`BulkAssignResult`):
```json
{"assigned": 1, "failed": []}
```

**Status codes:** 200, 400, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `annotation.project_closed` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/annotation/tasks/{task_id}/unassign` — Unassign a task

- **Access:** `annotation.manage` · admin MFA session · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

`assigned|in_progress → unassigned`; draft preserved for the next assignee.

**Response `200 OK`** (`AnnotationTask`):
```json
{
  "id": "01930b77-8888-7100-8000-000000000202",
  "project_id": "01930b77-8888-7100-8000-000000000201",
  "project_name": "Khmer newspaper transcription — batch 1",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "file_id": "01930b72-3333-7c00-8000-0000000000f1",
  "original_filename": "phnom-penh-post-1994-03.pdf",
  "page_number": 3,
  "page_count": 1,
  "status": "unassigned",
  "assignee_id": null,
  "assignee_name": null,
  "reviewer_id": null,
  "due_at": "2026-11-05T00:00:00Z",
  "reward_micros": 150000,
  "annotation_version": 7,
  "submitted_at": null,
  "approved_at": null,
  "latest_review": null,
  "created_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `annotation.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `GET /api/v1/annotation/my-tasks` — My assigned tasks

- **Access:** `annotation.work`
- **Rate limit:** 600 / min per user.
- **Query:** `status` — Filter (repeatable).; `project_id` — Filter.; `page`, `page_size`, `sort` (sortable: `due_at`, `created_at`, `status`)

**Response `200 OK`** (`PaginatedAnnotationTask`):
```json
{
  "items": [
    {
      "id": "01930b77-8888-7100-8000-000000000202",
      "project_id": "01930b77-8888-7100-8000-000000000201",
      "project_name": "Khmer newspaper transcription — batch 1",
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "file_id": "01930b72-3333-7c00-8000-0000000000f1",
      "original_filename": "phnom-penh-post-1994-03.pdf",
      "page_number": 3,
      "page_count": 1,
      "status": "in_progress",
      "assignee_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
      "assignee_name": "Bopha A.",
      "reviewer_id": null,
      "due_at": "2026-11-05T00:00:00Z",
      "reward_micros": 150000,
      "annotation_version": 7,
      "submitted_at": null,
      "approved_at": null,
      "latest_review": null,
      "created_at": "2026-10-26T08:30:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/annotation/tasks/{task_id}` — Task workspace data

- **Access:** `annotation.work | annotation.review | annotation.manage`
- **Rate limit:** 600 / min per user.

Active assignee; reviewer who claimed the task (or browsing `annotation.review` queue items in `submitted`); `annotation.manage`. Others 404.

**Response `200 OK`** (`AnnotationTaskDetail`):
```json
{
  "task": {
    "id": "01930b77-8888-7100-8000-000000000202",
    "project_id": "01930b77-8888-7100-8000-000000000201",
    "project_name": "Khmer newspaper transcription — batch 1",
    "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
    "file_id": "01930b72-3333-7c00-8000-0000000000f1",
    "original_filename": "phnom-penh-post-1994-03.pdf",
    "page_number": 3,
    "page_count": 1,
    "status": "in_progress",
    "assignee_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
    "assignee_name": "Bopha A.",
    "reviewer_id": null,
    "due_at": "2026-11-05T00:00:00Z",
    "reward_micros": 150000,
    "annotation_version": 7,
    "submitted_at": null,
    "approved_at": null,
    "latest_review": null,
    "created_at": "2026-10-26T08:30:00Z"
  },
  "project": {
    "id": "01930b77-8888-7100-8000-000000000201",
    "name": "Khmer newspaper transcription — batch 1",
    "instructions": "Transcribe each page exactly as printed. Keep COENG sequences.",
    "annotation_types": ["transcription", "page_label"],
    "label_set": ["headline", "article", "advertisement", "mixed"],
    "metadata_schema": [{"key": "publication_date", "label": "Publication date", "type": "date", "options": [], "required": true}]
  },
  "file": {
    "id": "01930b72-3333-7c00-8000-0000000000f1",
    "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
    "parent_file_id": null,
    "original_filename": "phnom-penh-post-1994-03.pdf",
    "relative_path": "1994/phnom-penh-post-1994-03.pdf",
    "member_path": null,
    "extension": "pdf",
    "declared_mime": "application/pdf",
    "detected_mime": "application/pdf",
    "size_bytes": 367001600,
    "sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
    "processing_status": "ready",
    "scan_status": "clean",
    "failure_code": null,
    "failure_message": null,
    "is_container": false,
    "page_count": 48,
    "previews": [{"page": 1, "width": 1654, "height": 2339, "content_type": "image/webp"}],
    "text_available": false,
    "duplicates": [
      {
        "kind": "near",
        "method": "dhash",
        "distance": 3,
        "matched_file_id": null,
        "matched_dataset_id": null,
        "matched_previously_accepted": true,
        "same_owner": false
      }
    ],
    "review_decision": null,
    "created_at": "2026-10-26T08:30:00Z",
    "uploaded_at": "2026-10-26T08:30:00Z",
    "processed_at": "2026-10-26T09:15:00Z"
  },
  "annotation": {
    "id": "01930b77-8888-7100-8000-000000000203",
    "task_id": "01930b77-8888-7100-8000-000000000202",
    "data": {
      "pages": [
        {
          "page": 3,
          "transcription": "ព័ត៌មានថ្ងៃនេះ",
          "corrected_text": null,
          "page_label": "article",
          "regions": []
        }
      ],
      "classification": [],
      "metadata": {"publication_date": "1994-03-12"},
      "notes": null
    },
    "version": 7,
    "content_sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
    "updated_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
    "updated_at": "2026-10-26T09:15:00Z"
  },
  "reviews": []
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/annotation/tasks/{task_id}/start` — Start working on a task

- **Access:** `annotation.work` · CSRF
- **Rate limit:** 120 / min per user.

`assigned|changes_requested → in_progress`; creates the `annotations` row (version 0) if absent. Idempotent when already in_progress.

**Response `200 OK`** (`AnnotationTaskDetail`):
```json
{
  "task": {
    "id": "01930b77-8888-7100-8000-000000000202",
    "project_id": "01930b77-8888-7100-8000-000000000201",
    "project_name": "Khmer newspaper transcription — batch 1",
    "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
    "file_id": "01930b72-3333-7c00-8000-0000000000f1",
    "original_filename": "phnom-penh-post-1994-03.pdf",
    "page_number": 3,
    "page_count": 1,
    "status": "in_progress",
    "assignee_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
    "assignee_name": "Bopha A.",
    "reviewer_id": null,
    "due_at": "2026-11-05T00:00:00Z",
    "reward_micros": 150000,
    "annotation_version": 7,
    "submitted_at": null,
    "approved_at": null,
    "latest_review": null,
    "created_at": "2026-10-26T08:30:00Z"
  },
  "project": {
    "id": "01930b77-8888-7100-8000-000000000201",
    "name": "Khmer newspaper transcription — batch 1",
    "instructions": "Transcribe each page exactly as printed. Keep COENG sequences.",
    "annotation_types": ["transcription", "page_label"],
    "label_set": ["headline", "article", "advertisement", "mixed"],
    "metadata_schema": [{"key": "publication_date", "label": "Publication date", "type": "date", "options": [], "required": true}]
  },
  "file": {
    "id": "01930b72-3333-7c00-8000-0000000000f1",
    "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
    "parent_file_id": null,
    "original_filename": "phnom-penh-post-1994-03.pdf",
    "relative_path": "1994/phnom-penh-post-1994-03.pdf",
    "member_path": null,
    "extension": "pdf",
    "declared_mime": "application/pdf",
    "detected_mime": "application/pdf",
    "size_bytes": 367001600,
    "sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
    "processing_status": "ready",
    "scan_status": "clean",
    "failure_code": null,
    "failure_message": null,
    "is_container": false,
    "page_count": 48,
    "previews": [{"page": 1, "width": 1654, "height": 2339, "content_type": "image/webp"}],
    "text_available": false,
    "duplicates": [
      {
        "kind": "near",
        "method": "dhash",
        "distance": 3,
        "matched_file_id": null,
        "matched_dataset_id": null,
        "matched_previously_accepted": true,
        "same_owner": false
      }
    ],
    "review_decision": null,
    "created_at": "2026-10-26T08:30:00Z",
    "uploaded_at": "2026-10-26T08:30:00Z",
    "processed_at": "2026-10-26T09:15:00Z"
  },
  "annotation": {
    "id": "01930b77-8888-7100-8000-000000000203",
    "task_id": "01930b77-8888-7100-8000-000000000202",
    "data": {
      "pages": [
        {
          "page": 3,
          "transcription": "ព័ត៌មានថ្ងៃនេះ",
          "corrected_text": null,
          "page_label": "article",
          "regions": []
        }
      ],
      "classification": [],
      "metadata": {"publication_date": "1994-03-12"},
      "notes": null
    },
    "version": 0,
    "content_sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
    "updated_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
    "updated_at": "2026-10-26T09:15:00Z"
  },
  "reviews": []
}
```

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `annotation.not_assignee` (403), `annotation.invalid_state` (409), `annotation.project_closed` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `PUT /api/v1/annotation/tasks/{task_id}/draft` — Autosave draft (optimistic locking)

- **Access:** `annotation.work` · CSRF
- **Rate limit:** 60 / min per user per task.
- **Headers:** `If-Match` (required)

`If-Match: <version>` required (bare integer or quoted ETag). Atomic `UPDATE annotations SET … version=version+1 WHERE task_id=:id AND version=:v`; 0 rows → 409 `annotation.version_conflict` with `details.server_annotation`. Inserts an `annotation_versions` row only when content hash changes (keep last 50 drafts). Transcription stored verbatim (no NFC).

**Request** (`DraftRequest`, application/json):
```json
{
  "data": {
    "pages": [
      {
        "page": 3,
        "transcription": "ព័ត៌មានថ្ងៃនេះ",
        "corrected_text": null,
        "page_label": "article",
        "regions": []
      }
    ],
    "classification": [],
    "metadata": {"publication_date": "1994-03-12"},
    "notes": null
  }
}
```

**Response `200 OK`** (`DraftSaved`):
```json
{
  "version": 8,
  "content_sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
  "version_created": true,
  "saved_at": "2026-10-26T09:15:00Z"
}
```

**Validation:** structure per AnnotationData; pages within file page range; one entry per page; classification labels ∈ label_set; metadata keys ∈ metadata_schema with matching types (required-ness checked at submit); regions must be empty (bbox reserved); body ≤ 2 MiB.

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `annotation.version_conflict` (409), `annotation.not_assignee` (403), `annotation.invalid_state` (409), `annotation.validation_failed` (422), `precondition.required` (400)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/annotation/tasks/{task_id}/submit` — Submit annotation for review

- **Access:** `annotation.work` · CSRF
- **Rate limit:** 120 / min per user.
- **Headers:** `If-Match` (optional)

`in_progress → submitted`; full validation (required metadata, every page has transcription/correction when those types are selected); records a `submitted` annotation_version. Version must equal current (409 otherwise).

**Request** (`SubmitAnnotationRequest`, application/json):
```json
{"version": 8}
```

**Response `200 OK`** (`AnnotationTask`):
```json
{
  "id": "01930b77-8888-7100-8000-000000000202",
  "project_id": "01930b77-8888-7100-8000-000000000201",
  "project_name": "Khmer newspaper transcription — batch 1",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "file_id": "01930b72-3333-7c00-8000-0000000000f1",
  "original_filename": "phnom-penh-post-1994-03.pdf",
  "page_number": 3,
  "page_count": 1,
  "status": "submitted",
  "assignee_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
  "assignee_name": "Bopha A.",
  "reviewer_id": null,
  "due_at": "2026-11-05T00:00:00Z",
  "reward_micros": 150000,
  "annotation_version": 8,
  "submitted_at": "2026-10-26T09:15:00Z",
  "approved_at": null,
  "latest_review": null,
  "created_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 412, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `annotation.version_conflict` (409), `annotation.not_assignee` (403), `annotation.invalid_state` (409), `annotation.validation_failed` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `precondition.failed`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/annotation/tasks/{task_id}/versions` — Annotation version history

- **Access:** `annotation.work | annotation.review | annotation.manage`
- **Rate limit:** 600 / min per user.
- **Query:** `kind` — Filter.; `page`, `page_size`, `sort` (sortable: `version`)

Same visibility as GET task. Used for diff/compare in reviewer and draft recovery in the editor.

**Response `200 OK`** (`PaginatedAnnotationVersion`):
```json
{
  "items": [
    {
      "id": "01930b77-8888-7100-8000-000000000206",
      "annotation_id": "01930b77-8888-7100-8000-000000000203",
      "version": 7,
      "kind": "draft",
      "data": {
        "pages": [
          {
            "page": 3,
            "transcription": "ព័ត៌មានថ្ងៃនេះ",
            "corrected_text": null,
            "page_label": "article",
            "regions": []
          }
        ],
        "classification": [],
        "metadata": {"publication_date": "1994-03-12"},
        "notes": null
      },
      "content_sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
      "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
      "created_at": "2026-10-26T09:15:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/annotation/my-rewards` — My annotation rewards

- **Access:** `annotation.work`
- **Rate limit:** 600 / min per user.
- **Query:** `project_id` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`, `amount_micros`)

**Response `200 OK`** (`PaginatedRewardWithTotals`):
```json
{
  "items": [
    {
      "id": "01930b77-8888-7100-8000-000000000205",
      "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
      "task_id": "01930b77-8888-7100-8000-000000000202",
      "project_id": "01930b77-8888-7100-8000-000000000201",
      "project_name": "Khmer newspaper transcription — batch 1",
      "annotation_review_id": "01930b77-8888-7100-8000-000000000204",
      "pages": 1,
      "amount_micros": 150000,
      "journal_id": "01930b75-6666-7f00-8000-0000000000e1",
      "created_at": "2026-10-26T10:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1,
  "totals": {"approved_count": 1, "total_micros": 150000, "pending_review_count": 2}
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/annotation/review-queue` — Submitted annotations awaiting review

- **Access:** `annotation.review`
- **Rate limit:** 600 / min per user.
- **Query:** `project_id` — Filter.; `mine` — Only tasks I claimed (in_review).; `page`, `page_size`, `sort` (sortable: `submitted_at`)

Excludes tasks the caller annotated (separation of duties).

**Response `200 OK`** (`PaginatedAnnotationTask`):
```json
{
  "items": [
    {
      "id": "01930b77-8888-7100-8000-000000000202",
      "project_id": "01930b77-8888-7100-8000-000000000201",
      "project_name": "Khmer newspaper transcription — batch 1",
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "file_id": "01930b72-3333-7c00-8000-0000000000f1",
      "original_filename": "phnom-penh-post-1994-03.pdf",
      "page_number": 3,
      "page_count": 1,
      "status": "submitted",
      "assignee_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
      "assignee_name": "Bopha A.",
      "reviewer_id": null,
      "due_at": "2026-11-05T00:00:00Z",
      "reward_micros": 150000,
      "annotation_version": 7,
      "submitted_at": null,
      "approved_at": null,
      "latest_review": null,
      "created_at": "2026-10-26T08:30:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/annotation/tasks/{task_id}/claim-review` — Claim a submitted annotation for review

- **Access:** `annotation.review` · CSRF
- **Rate limit:** 120 / min per user.

`submitted → in_review`; creates `annotation_reviews` row for the current submitted version.

**Response `201 Created`** (`AnnotationReview`):
```json
{
  "id": "01930b77-8888-7100-8000-000000000204",
  "task_id": "01930b77-8888-7100-8000-000000000202",
  "annotation_version": 8,
  "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
  "reviewer_name": "Dara R.",
  "decision": null,
  "score": null,
  "comments": null,
  "page_comments": [],
  "claimed_at": "2026-10-26T09:15:00Z",
  "decided_at": null
}
```

**Status codes:** 201, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `annotation.already_claimed` (409), `annotation.invalid_state` (409), `permission.separation_of_duties` (403)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/annotation/tasks/{task_id}/review` — Approve or request changes

- **Access:** `annotation.review` · CSRF
- **Rate limit:** 120 / min per user.
- **Headers:** `Idempotency-Key` (optional)

Claimant only. approve: `in_review → approved`, inserts `annotation_rewards` (unique per review) and `annotation_reward` journal (`annotation_review:{review_id}:reward`); amount = reward_per_task + reward_per_page × pages. request_changes: `in_review → changes_requested`, annotator notified.

**Request** (`AnnotationReviewRequest`, application/json):
```json
{"decision": "approve", "score": 5, "comments": "Accurate.", "page_comments": []}
```

**Response `200 OK`** (`AnnotationReviewResult`):
```json
{
  "task": {
    "id": "01930b77-8888-7100-8000-000000000202",
    "project_id": "01930b77-8888-7100-8000-000000000201",
    "project_name": "Khmer newspaper transcription — batch 1",
    "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
    "file_id": "01930b72-3333-7c00-8000-0000000000f1",
    "original_filename": "phnom-penh-post-1994-03.pdf",
    "page_number": 3,
    "page_count": 1,
    "status": "approved",
    "assignee_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
    "assignee_name": "Bopha A.",
    "reviewer_id": null,
    "due_at": "2026-11-05T00:00:00Z",
    "reward_micros": 150000,
    "annotation_version": 7,
    "submitted_at": null,
    "approved_at": "2026-10-26T10:00:00Z",
    "latest_review": null,
    "created_at": "2026-10-26T08:30:00Z"
  },
  "review": {
    "id": "01930b77-8888-7100-8000-000000000204",
    "task_id": "01930b77-8888-7100-8000-000000000202",
    "annotation_version": 8,
    "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
    "reviewer_name": "Dara R.",
    "decision": "approve",
    "score": 5,
    "comments": "Accurate.",
    "page_comments": [],
    "claimed_at": "2026-10-26T09:15:00Z",
    "decided_at": "2026-10-26T10:00:00Z"
  },
  "reward": {
    "id": "01930b77-8888-7100-8000-000000000205",
    "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05",
    "task_id": "01930b77-8888-7100-8000-000000000202",
    "project_id": "01930b77-8888-7100-8000-000000000201",
    "project_name": "Khmer newspaper transcription — batch 1",
    "annotation_review_id": "01930b77-8888-7100-8000-000000000204",
    "pages": 1,
    "amount_micros": 150000,
    "journal_id": "01930b75-6666-7f00-8000-0000000000e1",
    "created_at": "2026-10-26T10:00:00Z"
  }
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `annotation.invalid_state` (409), `annotation.comments_required` (422), `permission.separation_of_duties` (403), `permission.denied` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/annotation/reviews/history` — My annotation reviews

- **Access:** `annotation.review`
- **Rate limit:** 600 / min per user.
- **Query:** `project_id` — Filter.; `decision` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `decided_at`)

**Response `200 OK`** (`PaginatedAnnotationReview`):
```json
{
  "items": [
    {
      "id": "01930b77-8888-7100-8000-000000000204",
      "task_id": "01930b77-8888-7100-8000-000000000202",
      "annotation_version": 8,
      "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
      "reviewer_name": "Dara R.",
      "decision": "approve",
      "score": 5,
      "comments": "Accurate.",
      "page_comments": [],
      "claimed_at": "2026-10-26T09:15:00Z",
      "decided_at": "2026-10-26T10:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

### 10.12 Messaging

#### `GET /api/v1/conversations` — List conversations

- **Access:** `message.self`
- **Rate limit:** 600 / min per user.
- **Query:** `status` — Filter.; `dataset_id` — Filter.; `q` — Case-insensitive search text.; `scope` — support = admin inbox (message.support); default mine.; `assigned_to` — Admin inbox filter.; `unread` — Only with unread.; `page`, `page_size`, `sort` (sortable: `last_message_at`, `created_at`)

`q` searches subject and message bodies (Postgres `simple` full-text + trigram).

**Response `200 OK`** (`PaginatedConversation`):
```json
{
  "items": [
    {
      "id": "01930b78-9999-7200-8000-000000000301",
      "kind": "dataset",
      "subject": "Question about newspaper dataset",
      "status": "open",
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "assigned_admin_id": null,
      "participants": [
        {
          "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
          "display_name": "Sophea K.",
          "is_staff": false,
          "last_read_at": "2026-10-26T08:30:00Z"
        }
      ],
      "unread_count": 0,
      "last_message_at": "2026-10-26T08:30:00Z",
      "last_message_preview": "Hello, my dataset has been in review for a week — any update?",
      "created_at": "2026-10-26T08:30:00Z",
      "updated_at": "2026-10-26T08:30:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/conversations` — Start a conversation

- **Access:** `message.self` · CSRF
- **Rate limit:** 30 / min per user.

Contributors open `support` (or `dataset` when dataset_id given — must own it) conversations with staff. Staff (`message.support`) may set `participant_user_id` to contact a user.

**Request** (`ConversationCreate`, application/json):
```json
{
  "subject": "Question about newspaper dataset",
  "body": "Hello, my dataset has been in review for a week — any update?",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "attachment_ids": []
}
```

**Response `201 Created`** (`ConversationDetail`):
```json
{
  "conversation": {
    "id": "01930b78-9999-7200-8000-000000000301",
    "kind": "dataset",
    "subject": "Question about newspaper dataset",
    "status": "open",
    "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
    "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "assigned_admin_id": null,
    "participants": [
      {
        "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
        "display_name": "Sophea K.",
        "is_staff": false,
        "last_read_at": "2026-10-26T08:30:00Z"
      }
    ],
    "unread_count": 0,
    "last_message_at": "2026-10-26T08:30:00Z",
    "last_message_preview": "Hello, my dataset has been in review for a week — any update?",
    "created_at": "2026-10-26T08:30:00Z",
    "updated_at": "2026-10-26T08:30:00Z"
  },
  "first_message": {
    "id": "01930b78-9999-7200-8000-000000000302",
    "conversation_id": "01930b78-9999-7200-8000-000000000301",
    "sender_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "sender_name": "Sophea K.",
    "sender_is_staff": false,
    "body": "Hello, my dataset has been in review for a week — any update?",
    "attachments": [],
    "created_at": "2026-10-26T08:30:00Z"
  }
}
```

**Validation:** subject 3–150; body 1–10,000 chars, stored as plain text (rendered escaped with autolinks); ≤ 5 attachments, owned by caller, unused, scan clean or pending.

**Status codes:** 201, 400, 401, 403, 413, 415, 422, 429, 500, 503

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/conversations/{conversation_id}` — Conversation detail

- **Access:** `message.self`
- **Rate limit:** 600 / min per user.

Participants and `message.support` holders only.

**Response `200 OK`** (`Conversation`):
```json
{
  "id": "01930b78-9999-7200-8000-000000000301",
  "kind": "dataset",
  "subject": "Question about newspaper dataset",
  "status": "open",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "assigned_admin_id": null,
  "participants": [
    {
      "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "display_name": "Sophea K.",
      "is_staff": false,
      "last_read_at": "2026-10-26T08:30:00Z"
    }
  ],
  "unread_count": 0,
  "last_message_at": "2026-10-26T08:30:00Z",
  "last_message_preview": "Hello, my dataset has been in review for a week — any update?",
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `PATCH /api/v1/conversations/{conversation_id}` — Change status / assignment

- **Access:** `message.self` · CSRF
- **Rate limit:** 120 / min per user.

Participants may close; only staff may set `awaiting_user` or `assigned_admin_id`. Emits `conversation.updated`.

**Request** (`ConversationUpdate`, application/json):
```json
{"status": "closed"}
```

**Response `200 OK`** (`Conversation`):
```json
{
  "id": "01930b78-9999-7200-8000-000000000301",
  "kind": "dataset",
  "subject": "Question about newspaper dataset",
  "status": "closed",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "assigned_admin_id": null,
  "participants": [
    {
      "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "display_name": "Sophea K.",
      "is_staff": false,
      "last_read_at": "2026-10-26T08:30:00Z"
    }
  ],
  "unread_count": 0,
  "last_message_at": "2026-10-26T08:30:00Z",
  "last_message_preview": "Hello, my dataset has been in review for a week — any update?",
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 200, 400, 401, 403, 404, 413, 415, 422, 429, 500, 503

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/conversations/{conversation_id}/messages` — Messages (oldest→newest)

- **Access:** `message.self`
- **Rate limit:** 600 / min per user.
- **Query:** `page`, `page_size`, `sort` (sortable: `created_at`)

Default sort `created_at`; page_size up to 100. Attachments with scan_status ≠ clean are listed (status shown) but not downloadable.

**Response `200 OK`** (`PaginatedMessage`):
```json
{
  "items": [
    {
      "id": "01930b78-9999-7200-8000-000000000302",
      "conversation_id": "01930b78-9999-7200-8000-000000000301",
      "sender_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "sender_name": "Sophea K.",
      "sender_is_staff": false,
      "body": "Hello, my dataset has been in review for a week — any update?",
      "attachments": [],
      "created_at": "2026-10-26T08:30:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/conversations/{conversation_id}/messages` — Send a message

- **Access:** `message.self` · CSRF
- **Rate limit:** 30 / min per user.

Contributor message on `closed`/`awaiting_user` conversation reopens it to `open`. Fan-out via Redis pub/sub `message.created` + notification `support_message` (+ email if the recipient is offline > 5 min).

**Request** (`MessageCreate`, application/json):
```json
{"body": "Thanks! Attached the receipt.", "attachment_ids": ["01930b78-9999-7200-8000-000000000303"]}
```

**Response `201 Created`** (`Message`):
```json
{
  "id": "01930b78-9999-7200-8000-000000000302",
  "conversation_id": "01930b78-9999-7200-8000-000000000301",
  "sender_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "sender_name": "Sophea K.",
  "sender_is_staff": false,
  "body": "Thanks! Attached the receipt.",
  "attachments": [
    {
      "id": "01930b78-9999-7200-8000-000000000303",
      "filename": "receipt.pdf",
      "content_type": "application/pdf",
      "size_bytes": 84211,
      "scan_status": "pending",
      "message_id": null,
      "uploaded_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "created_at": "2026-10-26T08:30:00Z"
    }
  ],
  "created_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 201, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `message.conversation_closed` (409), `message.attachment_unavailable` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/conversations/{conversation_id}/read` — Mark read up to a message

- **Access:** `message.self` · CSRF
- **Rate limit:** 120 / min per user.

**Request** (`ReadMarker`, application/json):
```json
{"last_read_message_id": "01930b78-9999-7200-8000-000000000302"}
```

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 400, 401, 403, 404, 413, 415, 422, 429, 500, 503

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/conversations/{conversation_id}/attachments` — Upload an attachment

- **Access:** `message.self` · CSRF
- **Rate limit:** 60 / h per user.

multipart ≤ 10 MB; allowed by magic bytes: pdf, png, jpeg, txt, csv, docx, xlsx, zip (not expanded). Stored `attachments/{attachment_id}/original`, ClamAV scanned asynchronously; visible to other participants only when `clean`.

**Request** (`AttachmentUpload`, multipart/form-data):
```json
{"file": "<binary receipt.pdf>"}
```

**Response `201 Created`** (`Attachment`):
```json
{
  "id": "01930b78-9999-7200-8000-000000000303",
  "filename": "receipt.pdf",
  "content_type": "application/pdf",
  "size_bytes": 84211,
  "scan_status": "pending",
  "message_id": null,
  "uploaded_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "created_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 201, 401, 403, 404, 413, 415, 422, 429, 500, 503

**Endpoint-specific errors:** `message.attachment_too_large` (413), `message.attachment_type_not_allowed` (415)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/attachments/{attachment_id}/download-url` — Presigned attachment download

- **Access:** `message.self`
- **Rate limit:** 120 / min per user (presigned URL issuance, preview redirects).

Participants/staff of the attachment's conversation (uploader always). 5 min, `Content-Disposition: attachment`. Not a state change, so GET without CSRF.

**Response `200 OK`** (`PresignedUrl`):
```json
{
  "url": "https://s3.datahub.example/datahub-private/attachments/01930b78-9999-7200-8000-000000000303/original?X-Amz-Expires=300&X-Amz-Signature=…",
  "expires_at": "2026-10-26T08:35:00Z",
  "method": "GET"
}
```

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500, 503

**Endpoint-specific errors:** `message.attachment_unavailable` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/ws` — WebSocket upgrade (realtime events)

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions
- **Rate limit:** 10 connection attempts / min per user; max 5 concurrent sockets per user.

`GET /api/v1/ws` with `Upgrade: websocket`. Cookie-authenticated; Origin must be in `CORS_ALLOWED_ORIGINS`. Server→client events `message.created`, `notification.created`, `conversation.updated`. Protocol in API_DOCUMENTATION.md §9.

**Response `101 Switching Protocols`** — no JSON body.

**Status codes:** 101, 401, 429, 500, 503

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `rate_limited`, `internal_error`, `service_unavailable`

### 10.13 Notifications

#### `GET /api/v1/notifications` — My notifications

- **Access:** `profile.self`
- **Rate limit:** 600 / min per user.
- **Query:** `unread` — Only unread.; `type` — Filter.; `page`, `page_size`, `sort` (sortable: `created_at`)

**Response `200 OK`** (`PaginatedNotification`):
```json
{
  "items": [
    {
      "id": "01930b79-aaaa-7300-8000-000000000401",
      "type": "dataset_approved",
      "title": "Dataset approved",
      "body": "“Khmer newspaper scans 1990–1999” was approved. $0.36 credited.",
      "link": "/datasets/01930b71-2222-7b00-8000-0000000000d1",
      "data": {"dataset_id": "01930b71-2222-7b00-8000-0000000000d1"},
      "read_at": null,
      "created_at": "2026-10-26T09:15:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500, 503

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `GET /api/v1/notifications/unread-count` — Unread count

- **Access:** `profile.self`
- **Rate limit:** 600 / min per user.

**Response `200 OK`** (`UnreadCount`):
```json
{"unread": 3}
```

**Status codes:** 200, 401, 403, 429, 500, 503

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/notifications/{notification_id}/read` — Mark one read

- **Access:** `profile.self` · CSRF
- **Rate limit:** 120 / min per user.

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 422, 429, 500, 503

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

#### `POST /api/v1/notifications/read-all` — Mark all read

- **Access:** `profile.self` · CSRF
- **Rate limit:** 120 / min per user.

**Response `200 OK`** (`CountResult`):
```json
{"count": 3}
```

**Status codes:** 200, 401, 403, 429, 500, 503

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`, `service_unavailable`

### 10.14 Admin users

#### `GET /api/v1/admin/users` — Search users

- **Access:** `user.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `q` — Case-insensitive search text.; `role` — Users holding this role (AM-05).; `status` — Filter.; `verification_status` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`, `email`, `last_login_at`)

**Response `200 OK`** (`PaginatedUser`):
```json
{
  "items": [
    {
      "id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "email": "sophea@example.com",
      "display_name": "Sophea K.",
      "status": "active",
      "roles": ["contributor"],
      "email_verified_at": "2026-10-20T03:00:00Z",
      "verification_status": "approved",
      "onboarding_completed_at": "2026-10-20T03:05:00Z",
      "mfa_enabled": false,
      "created_at": "2026-10-20T02:58:00Z",
      "last_login_at": "2026-10-26T08:30:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/users/{user_id}` — User detail

- **Access:** `user.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

**Response `200 OK`** (`AdminUserDetail`):
```json
{
  "user": {
    "id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "email": "sophea@example.com",
    "display_name": "Sophea K.",
    "status": "active",
    "roles": ["contributor"],
    "email_verified_at": "2026-10-20T03:00:00Z",
    "verification_status": "approved",
    "onboarding_completed_at": "2026-10-20T03:05:00Z",
    "mfa_enabled": false,
    "created_at": "2026-10-20T02:58:00Z",
    "last_login_at": "2026-10-26T08:30:00Z"
  },
  "profile": {
    "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "display_name": "Sophea K.",
    "legal_name": "Sophea Keo",
    "country": "KH",
    "phone": "+85512345678",
    "date_of_birth": "1995-04-12",
    "preferred_language": "km",
    "timezone": "Asia/Phnom_Penh",
    "bio": null,
    "version": 3,
    "updated_at": "2026-10-26T08:30:00Z"
  },
  "verification": {
    "id": "01930b7c-dddd-7600-8000-000000000701",
    "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "status": "approved",
    "legal_name": "Sophea Keo",
    "country": "KH",
    "date_of_birth": "1995-04-12",
    "phone": "+85512345678",
    "id_document": {"filename": "national-id.jpg", "size_bytes": 412339, "content_type": "image/jpeg"},
    "decision_reason": null,
    "decided_by": null,
    "decided_at": null,
    "submitted_at": "2026-10-26T08:30:00Z"
  },
  "wallet": {
    "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "currency": "USD",
    "estimated_micros": 734003,
    "pending_micros": 0,
    "available_micros": 12367001,
    "reserved_micros": 10000000,
    "paid_micros": 25000000,
    "adjustments_micros": 0,
    "approved_lifetime_micros": 47367001,
    "updated_at": "2026-10-26T09:15:00Z"
  },
  "stats": {"datasets": 3, "accepted_bytes": 367001600, "tasks_approved": 0, "open_payouts": 1},
  "active_sessions": 2,
  "suspension_reason": null
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/users/{user_id}/suspend` — Suspend a user

- **Access:** `user.manage` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

`active → suspended`; revokes all sessions immediately (and closes their WebSockets), cancels open upload sessions, releases claimed reviews/unassigns in-progress tasks, blocks payout approval (open payouts stay for admin decision). Admin cannot suspend admins/super_admins unless super_admin; nobody suspends themselves.

**Request** (`SuspendRequest`, application/json):
```json
{"reason": "Repeated uploads of copyrighted books.", "notify_user": true}
```

**Response `200 OK`** (`User`):
```json
{
  "id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "email": "sophea@example.com",
  "display_name": "Sophea K.",
  "status": "suspended",
  "roles": ["contributor"],
  "email_verified_at": "2026-10-20T03:00:00Z",
  "verification_status": "approved",
  "onboarding_completed_at": "2026-10-20T03:05:00Z",
  "mfa_enabled": false,
  "created_at": "2026-10-20T02:58:00Z",
  "last_login_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `user.invalid_state` (409), `user.role_escalation_forbidden` (403), `user.last_super_admin` (409), `permission.separation_of_duties` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/users/{user_id}/reactivate` — Reactivate a suspended user

- **Access:** `user.manage` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

`suspended → active`. User must sign in again.

**Response `200 OK`** (`User`):
```json
{
  "id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "email": "sophea@example.com",
  "display_name": "Sophea K.",
  "status": "active",
  "roles": ["contributor"],
  "email_verified_at": "2026-10-20T03:00:00Z",
  "verification_status": "approved",
  "onboarding_completed_at": "2026-10-20T03:05:00Z",
  "mfa_enabled": false,
  "created_at": "2026-10-20T02:58:00Z",
  "last_login_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `user.invalid_state` (409), `user.role_escalation_forbidden` (403)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `PUT /api/v1/admin/users/{user_id}/roles` — Replace a user's roles

- **Access:** `user.manage` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Full replacement. Granting/removing `admin` or `super_admin` requires `role.manage` (super_admin). No self-changes. Last active super_admin cannot be removed. The target's sessions are rotated (privilege change); a granted admin role forces MFA enrolment on next request.

**Request** (`RolesUpdate`, application/json):
```json
{"roles": ["contributor", "annotator"], "reason": "Passed annotation trial."}
```

**Response `200 OK`** (`User`):
```json
{
  "id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "email": "sophea@example.com",
  "display_name": "Sophea K.",
  "status": "active",
  "roles": ["contributor", "annotator"],
  "email_verified_at": "2026-10-20T03:00:00Z",
  "verification_status": "approved",
  "onboarding_completed_at": "2026-10-20T03:05:00Z",
  "mfa_enabled": false,
  "created_at": "2026-10-20T02:58:00Z",
  "last_login_at": "2026-10-26T08:30:00Z"
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `user.role_escalation_forbidden` (403), `user.last_super_admin` (409), `permission.separation_of_duties` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/users/{user_id}/revoke-sessions` — Revoke all sessions of a user

- **Access:** `user.manage` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

**Response `200 OK`** (`RevokeResult`):
```json
{"revoked": 2}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Endpoint-specific errors:** `user.role_escalation_forbidden` (403)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/verifications` — Contributor verification queue

- **Access:** `user.verify` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `status` — Default pending.; `q` — Case-insensitive search text.; `page`, `page_size`, `sort` (sortable: `submitted_at`)

**Response `200 OK`** (`PaginatedContributorVerification`):
```json
{
  "items": [
    {
      "id": "01930b7c-dddd-7600-8000-000000000701",
      "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "status": "pending",
      "legal_name": "Sophea Keo",
      "country": "KH",
      "date_of_birth": "1995-04-12",
      "phone": "+85512345678",
      "id_document": {"filename": "national-id.jpg", "size_bytes": 412339, "content_type": "image/jpeg"},
      "decision_reason": null,
      "decided_by": null,
      "decided_at": null,
      "submitted_at": "2026-10-26T08:30:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/verifications/{verification_id}/decision` — Decide a verification

- **Access:** `user.verify` · admin MFA session · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

`pending → approved|rejected|needs_info`; mirrors users.verification_status; notifies user. Verifier ≠ subject. ID document access audited.

**Request** (`VerificationDecision`, application/json):
```json
{"decision": "approved", "reason": null}
```

**Response `200 OK`** (`ContributorVerification`):
```json
{
  "id": "01930b7c-dddd-7600-8000-000000000701",
  "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "status": "approved",
  "legal_name": "Sophea Keo",
  "country": "KH",
  "date_of_birth": "1995-04-12",
  "phone": "+85512345678",
  "id_document": {"filename": "national-id.jpg", "size_bytes": 412339, "content_type": "image/jpeg"},
  "decision_reason": null,
  "decided_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
  "decided_at": "2026-10-26T09:15:00Z",
  "submitted_at": "2026-10-26T08:30:00Z"
}
```

**Validation:** reason required (≥ 5 chars) for rejected/needs_info.

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `verification.invalid_state` (409), `permission.separation_of_duties` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

### 10.15 Admin datasets

#### `GET /api/v1/admin/datasets` — Search all datasets

- **Access:** `dataset.read.any` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `q` — Dataset code (`DS-YYYY-NNNNNN`, exact), title (trigram) or owner email.; `status` — Filter (repeatable).; `data_class` — Filter.; `language` — Filter.; `category` — Filter.; `min_quality` — Overall quality ≥.; `owner_id` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`, `updated_at`, `title`, `total_bytes`, `submitted_at`, `finalized_at`, `overall_quality`)

**Response `200 OK`** (`PaginatedDataset`):
```json
{
  "items": [
    {
      "id": "01930b71-2222-7b00-8000-0000000000d1",
      "code": "DS-2026-000123",
      "owner_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "owner_display_name": "Sophea K.",
      "title": "Khmer newspaper scans 1990–1999",
      "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
      "data_class": "raw",
      "category": "news",
      "languages": ["km"],
      "tags": ["newspaper", "ocr"],
      "source_description": "Personal archive, scanned by me.",
      "contains_personal_data": false,
      "personal_data_notes": null,
      "status": "draft",
      "version_number": 1,
      "file_count": 2,
      "ready_file_count": 2,
      "failed_file_count": 0,
      "total_bytes": 734003200,
      "accepted_bytes": null,
      "earned_micros": null,
      "license_version": "CA-2026-10",
      "takedown_reason": null,
      "submitted_at": null,
      "finalized_at": null,
      "created_at": "2026-10-26T08:30:00Z",
      "updated_at": "2026-10-26T09:15:00Z",
      "version": 4
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/datasets/{dataset_id}` — Dataset detail (admin)

- **Access:** `dataset.read.any` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Full dataset record with all reviews (including internal comments and reviewer identities), version history, licence acceptance evidence and earning total. Files are fetched via `GET /datasets/{id}/files` (admins have `dataset.read.any`).

**Response `200 OK`** (`AdminDatasetDetail`):
```json
{
  "dataset": {
    "id": "01930b71-2222-7b00-8000-0000000000d1",
    "code": "DS-2026-000123",
    "owner_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
    "owner_display_name": "Sophea K.",
    "title": "Khmer newspaper scans 1990–1999",
    "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
    "data_class": "raw",
    "category": "news",
    "languages": ["km"],
    "tags": ["newspaper", "ocr"],
    "source_description": "Personal archive, scanned by me.",
    "contains_personal_data": false,
    "personal_data_notes": null,
    "status": "partially_approved",
    "version_number": 1,
    "file_count": 2,
    "ready_file_count": 2,
    "failed_file_count": 0,
    "total_bytes": 734003200,
    "accepted_bytes": null,
    "earned_micros": null,
    "license_version": "CA-2026-10",
    "takedown_reason": null,
    "submitted_at": null,
    "finalized_at": null,
    "created_at": "2026-10-26T08:30:00Z",
    "updated_at": "2026-10-26T09:15:00Z",
    "version": 4
  },
  "reviews": [
    {
      "id": "01930b74-5555-7e00-8000-0000000000c1",
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "dataset_version_number": 1,
      "reviewer_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04",
      "reviewer_name": "Dara R.",
      "status": "finalized",
      "decision": "partial",
      "data_class": "raw",
      "checklist": {
        "rights_plausible": true,
        "matches_description": true,
        "language_correct": true,
        "no_unconsented_personal_data": true,
        "no_copyright_concern": null,
        "quality_acceptable": true,
        "metadata_complete": true
      },
      "quality_scores": {"legibility": 4, "completeness": 5, "accuracy": null, "relevance": 5, "labeling_quality": null},
      "overall_quality": 4.67,
      "internal_comments": "Check page 12 for faded print.",
      "feedback": null,
      "claimed_at": "2026-10-26T08:30:00Z",
      "finalized_at": null,
      "released_at": null,
      "version": 2
    }
  ],
  "versions": [{"version_number": 1, "submitted_at": "2026-10-26T09:15:00Z", "file_count": 2, "total_bytes": 734003200}],
  "duplicate_flagged_files": 1,
  "earned_micros": 367001,
  "license": {"license_version": "CA-2026-10", "accepted_at": "2026-10-26T08:30:00Z", "accepted_ip": "203.0.113.24"}
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/datasets/{dataset_id}/takedown` — Take down a dataset

- **Access:** `dataset.read.any` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Any status → `taken_down`; files become undownloadable/unpreviewable (except audit), excluded from exports and annotation (open tasks cancelled). Earnings already credited are **not** reversed automatically; a super_admin may post an `adjustment_debit` (`takedown_clawback`).

**Request** (`TakedownRequest`, application/json):
```json
{
  "reason_code": "rights_claim",
  "reason": "Publisher claim received 2026-10-25 (ticket #57).",
  "notify_owner": true
}
```

**Response `200 OK`** (`Dataset`):
```json
{
  "id": "01930b71-2222-7b00-8000-0000000000d1",
  "code": "DS-2026-000123",
  "owner_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
  "owner_display_name": "Sophea K.",
  "title": "Khmer newspaper scans 1990–1999",
  "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.",
  "data_class": "raw",
  "category": "news",
  "languages": ["km"],
  "tags": ["newspaper", "ocr"],
  "source_description": "Personal archive, scanned by me.",
  "contains_personal_data": false,
  "personal_data_notes": null,
  "status": "taken_down",
  "version_number": 1,
  "file_count": 2,
  "ready_file_count": 2,
  "failed_file_count": 0,
  "total_bytes": 734003200,
  "accepted_bytes": null,
  "earned_micros": null,
  "license_version": "CA-2026-10",
  "takedown_reason": "Publisher claim received 2026-10-25 (ticket #57).",
  "submitted_at": null,
  "finalized_at": null,
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T09:15:00Z",
  "version": 4
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `dataset.invalid_state` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/files/{file_id}/rescan` — Re-run malware scan / processing

- **Access:** `dataset.read.any` · admin MFA session · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Re-enqueues `processing.process_file` with `force_rescan`; used after signature updates or `scan_status=error`. Not allowed for finalized-accepted files with clean status (no-op 202).

**Response `202 Accepted`** (`DatasetFile`):
```json
{
  "id": "01930b72-3333-7c00-8000-0000000000f1",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "parent_file_id": null,
  "original_filename": "phnom-penh-post-1994-03.pdf",
  "relative_path": "1994/phnom-penh-post-1994-03.pdf",
  "member_path": null,
  "extension": "pdf",
  "declared_mime": "application/pdf",
  "detected_mime": "application/pdf",
  "size_bytes": 367001600,
  "sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d",
  "processing_status": "processing",
  "scan_status": "pending",
  "failure_code": null,
  "failure_message": null,
  "is_container": false,
  "page_count": 48,
  "previews": [{"page": 1, "width": 1654, "height": 2339, "content_type": "image/webp"}],
  "text_available": false,
  "duplicates": [
    {
      "kind": "near",
      "method": "dhash",
      "distance": 3,
      "matched_file_id": null,
      "matched_dataset_id": null,
      "matched_previously_accepted": true,
      "same_owner": false
    }
  ],
  "review_decision": null,
  "created_at": "2026-10-26T08:30:00Z",
  "uploaded_at": "2026-10-26T08:30:00Z",
  "processed_at": "2026-10-26T09:15:00Z"
}
```

**Status codes:** 202, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/takedown-requests` — Takedown request queue

- **Access:** `user.manage` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `q` — Case-insensitive search text.; `status` — Default `received,under_review`.; `claim_type` — Filter.; `source` — Filter.; `dataset_id` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`, `updated_at`, `status`)

Rights/privacy complaints from `POST /public/takedown-requests`, signed-in users and admins (AM-04). `q` matches requester name/email/organisation and dataset code. Viewing requester contact data is audited.

**Response `200 OK`** (`PaginatedTakedownCase`):
```json
{
  "items": [
    {
      "id": "01930b7f-0000-7900-8000-000000000a01",
      "source": "public_form",
      "status": "received",
      "claim_type": "copyright",
      "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
      "dataset_code": "DS-2026-000123",
      "dataset_status": "approved",
      "file_id": null,
      "requester_user_id": null,
      "requester_name": "Chan Vuthy",
      "requester_email": "rights@publisher.example",
      "requester_organization": "Angkor Press Co.",
      "description": "Pages 1–48 of this dataset are scans of our 1994 newspaper editions, reproduced without permission.",
      "evidence_url": "https://publisher.example/catalogue/1994",
      "decided_by": null,
      "decided_at": null,
      "decision_notes": null,
      "created_at": "2026-10-26T08:30:00Z",
      "updated_at": "2026-10-26T08:30:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/takedown-requests/{takedown_id}/decision` — Decide a takedown request

- **Access:** `user.manage` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Transitions (AM-04, LLD §12): `received → under_review`; `received|under_review → actioned|rejected`. `actioned` requires the linked dataset to be `taken_down` — either already, or in the same transaction via `apply_takedown=true` (same effects as `POST /admin/datasets/{id}/takedown`: review released, open annotation tasks cancelled, owner notified). `dataset_id` may (re)link the request to a dataset. The requester is emailed the outcome for `actioned`/`rejected`. Audited with before/after.

**Request** (`TakedownDecision`, application/json):
```json
{
  "decision": "actioned",
  "notes": "Publisher ownership verified; dataset removed.",
  "dataset_id": null,
  "apply_takedown": true,
  "takedown_reason_code": "rights_claim"
}
```

**Response `200 OK`** (`TakedownCase`):
```json
{
  "id": "01930b7f-0000-7900-8000-000000000a01",
  "source": "public_form",
  "status": "actioned",
  "claim_type": "copyright",
  "dataset_id": "01930b71-2222-7b00-8000-0000000000d1",
  "dataset_code": "DS-2026-000123",
  "dataset_status": "taken_down",
  "file_id": null,
  "requester_user_id": null,
  "requester_name": "Chan Vuthy",
  "requester_email": "rights@publisher.example",
  "requester_organization": "Angkor Press Co.",
  "description": "Pages 1–48 of this dataset are scans of our 1994 newspaper editions, reproduced without permission.",
  "evidence_url": "https://publisher.example/catalogue/1994",
  "decided_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
  "decided_at": "2026-10-26T09:15:00Z",
  "decision_notes": "Publisher ownership verified; dataset removed.",
  "created_at": "2026-10-26T08:30:00Z",
  "updated_at": "2026-10-26T09:15:00Z"
}
```

**Validation:** notes 5–5,000 chars; takedown_reason_code required when apply_takedown=true.

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `takedown.invalid_state` (409), `takedown.dataset_not_taken_down` (409), `takedown.no_target` (422), `dataset.invalid_state` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

### 10.16 Exports

#### `POST /api/v1/admin/exports` — Create an export job

- **Access:** `dataset.export` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 10 / h per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Only approved/partially_approved datasets and accepted files are exportable; taken_down excluded. Background `exports.build_export` streams objects into ZIP parts ≤ 4 GB (4,000,000,000 bytes) at `exports/{job_id}/datahub-export-{job_id}-partNNN.zip`. The job gets a human code `EX-YYYY-NNNNNN` (AM-07). Logged with dataset ids (audit). Expires after 7 days (A-15).

**Request** (`ExportCreate`, application/json):
```json
{
  "filters": {
    "dataset_ids": [],
    "categories": ["news"],
    "languages": ["km"],
    "min_quality": 4,
    "data_class": null,
    "finalized_from": null,
    "finalized_to": null
  },
  "format": "zip_originals",
  "include_metadata": true,
  "include_annotations": true,
  "note": "OCR training set v3"
}
```

**Response `202 Accepted`** (`ExportJob`):
```json
{
  "id": "01930b7a-bbbb-7400-8000-000000000501",
  "code": "EX-2026-000007",
  "status": "queued",
  "requested_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
  "filters": {
    "dataset_ids": [],
    "categories": ["news"],
    "languages": ["km"],
    "min_quality": 4,
    "data_class": null,
    "finalized_from": null,
    "finalized_to": null
  },
  "format": "zip_originals",
  "include_metadata": true,
  "include_annotations": true,
  "progress_percent": 0,
  "dataset_count": 0,
  "file_count": 0,
  "total_bytes": 0,
  "files": [],
  "error": null,
  "created_at": "2026-10-26T08:30:00Z",
  "started_at": null,
  "completed_at": null,
  "expires_at": null
}
```

**Status codes:** 202, 400, 401, 403, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `export.empty_selection` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/exports` — List export jobs

- **Access:** `dataset.export` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `q` — Export code (`EX-YYYY-NNNNNN`) or note text.; `status` — Filter.; `requested_by` — Filter.; `page`, `page_size`, `sort` (sortable: `created_at`)

**Response `200 OK`** (`PaginatedExportJob`):
```json
{
  "items": [
    {
      "id": "01930b7a-bbbb-7400-8000-000000000501",
      "code": "EX-2026-000007",
      "status": "completed",
      "requested_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
      "filters": {
        "dataset_ids": [],
        "categories": ["news"],
        "languages": ["km"],
        "min_quality": 4,
        "data_class": null,
        "finalized_from": null,
        "finalized_to": null
      },
      "format": "zip_originals",
      "include_metadata": true,
      "include_annotations": true,
      "progress_percent": 100,
      "dataset_count": 12,
      "file_count": 1840,
      "total_bytes": 48318382080,
      "files": [
        {
          "id": "01930b7a-bbbb-7400-8000-000000000502",
          "name": "datahub-export-01930b7a-part-001.zip",
          "size_bytes": 3998712041,
          "sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d"
        }
      ],
      "error": null,
      "created_at": "2026-10-26T08:30:00Z",
      "started_at": "2026-10-26T08:30:00Z",
      "completed_at": "2026-10-26T09:15:00Z",
      "expires_at": "2026-11-02T09:15:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/exports/{export_id}` — Export job status

- **Access:** `dataset.export` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

**Response `200 OK`** (`ExportJob`):
```json
{
  "id": "01930b7a-bbbb-7400-8000-000000000501",
  "code": "EX-2026-000007",
  "status": "completed",
  "requested_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
  "filters": {
    "dataset_ids": [],
    "categories": ["news"],
    "languages": ["km"],
    "min_quality": 4,
    "data_class": null,
    "finalized_from": null,
    "finalized_to": null
  },
  "format": "zip_originals",
  "include_metadata": true,
  "include_annotations": true,
  "progress_percent": 100,
  "dataset_count": 12,
  "file_count": 1840,
  "total_bytes": 48318382080,
  "files": [
    {
      "id": "01930b7a-bbbb-7400-8000-000000000502",
      "name": "datahub-export-01930b7a-part-001.zip",
      "size_bytes": 3998712041,
      "sha256": "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d"
    }
  ],
  "error": null,
  "created_at": "2026-10-26T08:30:00Z",
  "started_at": "2026-10-26T08:30:00Z",
  "completed_at": "2026-10-26T09:15:00Z",
  "expires_at": "2026-11-02T09:15:00Z"
}
```

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `POST /api/v1/admin/exports/{export_id}/download-url` — Presigned download for an export part

- **Access:** `dataset.export` · admin MFA session · CSRF
- **Rate limit:** 120 / min per user (presigned URL issuance, preview redirects).
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

5-minute presigned GET; every issuance audited (`export.download_url`).

**Request** (`ExportDownloadRequest`, application/json):
```json
{"file_id": "01930b7a-bbbb-7400-8000-000000000502"}
```

**Response `200 OK`** (`PresignedUrl`):
```json
{
  "url": "https://s3.datahub.example/datahub-private/exports/01930b7a-bbbb-7400-8000-000000000501/datahub-export-01930b7a-part-001.zip?X-Amz-Expires=300&X-Amz-Signature=…",
  "expires_at": "2026-10-26T09:20:00Z",
  "method": "GET"
}
```

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `export.not_ready` (409), `export.expired` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

### 10.17 Admin

#### `GET /api/v1/admin/analytics/overview` — Analytics overview

- **Access:** `analytics.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `from` — Start date (UTC, inclusive); default 30 days ago.; `to` — End date (UTC, inclusive); default today; range ≤ 366 days.

**Response `200 OK`** (`AnalyticsOverview`):
```json
{
  "from": "2026-09-27",
  "to": "2026-10-26",
  "users": {"registered": 412, "verified_contributors": 128, "active_30d": 203},
  "datasets": {"submitted": 96, "approved": 41, "partially_approved": 22, "rejected": 9, "changes_requested": 7},
  "bytes": {"uploaded": 2840000000000, "accepted_raw": 910000000000, "accepted_labeled": 120000000000},
  "finance": {"earned_micros": 1090000000, "paid_micros": 410000000},
  "annotation": {"tasks_approved": 1880, "avg_review_score": 4.3},
  "review": {"median_hours_to_finalize": 19.5, "queue_depth": 14},
  "series": [
    {
      "date": "2026-10-26",
      "uploaded_bytes": 92000000000,
      "accepted_bytes": 30000000000,
      "earned_micros": 31000000,
      "paid_micros": 0
    }
  ]
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/audit-logs` — Audit log

- **Access:** `audit.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `actor_id` — Only rows written by this actor (AM-05).; `action` — Exact or prefix (`payout.`).; `entity_type` — Entity table/type, e.g. `dataset`, `payout_request`, `user` (AM-05).; `entity_id` — Entity id (UUID); combine with entity_type for an entity's history (AM-05).; `request_id` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`)

Read-only; audit rows are append-only (UPDATE/DELETE blocked by trigger). Viewing is itself audited.

**Response `200 OK`** (`PaginatedAuditLog`):
```json
{
  "items": [
    {
      "id": "01930b7d-eeee-7700-8000-000000000801",
      "actor_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02",
      "actor_email": "vanna@datahub.example",
      "action": "payout.approve",
      "entity_type": "payout_request",
      "entity_id": "01930b76-7777-7000-8000-000000000101",
      "before": {"status": "requested"},
      "after": {"status": "approved"},
      "ip": "198.51.100.7",
      "user_agent": "Mozilla/5.0",
      "request_id": "req_01JBA7Q4M8",
      "created_at": "2026-10-26T09:15:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/security-events` — Security events

- **Access:** `audit.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Query:** `user_id` — Filter.; `event_type` — Filter.; `ip` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`)

**Response `200 OK`** (`PaginatedSecurityEvent`):
```json
{
  "items": [
    {
      "id": "01930b7d-eeee-7700-8000-000000000802",
      "user_id": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01",
      "email": "sophea@example.com",
      "event_type": "login_failed",
      "ip": "203.0.113.24",
      "user_agent": "curl/8.5",
      "details": {"consecutive_failures": 3},
      "created_at": "2026-10-26T08:30:00Z"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/settings` — System settings

- **Access:** `settings.manage` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

**Response `200 OK`** (`SystemSettingList`):
```json
{
  "items": [
    {
      "key": "payout_dual_approval_threshold_micros",
      "value": 100000000,
      "value_type": "integer",
      "description": "Payouts ≥ this amount need two distinct approvers (HA-07).",
      "updated_by": null,
      "updated_at": "2026-10-26T08:30:00Z",
      "version": 1
    }
  ]
}
```

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`

#### `PUT /api/v1/admin/settings/{key}` — Update a system setting

- **Access:** `settings.manage` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 120 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).
- **Headers:** `If-Match` (optional)

Registry-validated keys only (see AUTH/API docs). Change is audited with before/after and takes effect within 30 s (settings cache TTL).

**Request** (`SettingUpdate`, application/json):
```json
{"value": 150000000, "reason": "Owner raised dual-approval threshold to $150 (HA-07)."}
```

**Response `200 OK`** (`SystemSetting`):
```json
{
  "key": "payout_dual_approval_threshold_micros",
  "value": 150000000,
  "value_type": "integer",
  "description": "Payouts ≥ this amount need two distinct approvers (HA-07).",
  "updated_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f09",
  "updated_at": "2026-10-26T08:30:00Z",
  "version": 2
}
```

**Status codes:** 200, 400, 401, 403, 404, 412, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `settings.unknown_key` (404), `settings.invalid_value` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `auth.step_up_required`, `csrf.missing`, `csrf.invalid`, `precondition.failed`, `rate_limited`, `internal_error`

#### `GET /api/v1/admin/roles` — Role definitions and permissions

- **Access:** `user.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).

Read-only in v1: role → permission mapping is seeded by migration (baseline §6); changing it requires a migration + DECISION_LOG entry.

**Response `200 OK`** (`RoleList`):
```json
{
  "items": [
    {
      "name": "contributor",
      "description": "Uploads datasets and withdraws earnings.",
      "permissions": ["profile.self", "dataset.create", "dataset.read.own", "payout.request", "message.self"],
      "user_count": 398,
      "requires_mfa": false
    }
  ]
}
```

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `auth.mfa_enrollment_required`, `rate_limited`, `internal_error`


## 11. Versioning, deprecation and spec reconciliation

- **Versioning:** URL-major (`/api/v1`). Additive changes (new endpoints, new optional request fields, new response fields, new enum values in *response-only* enums) ship in v1. Breaking changes (removing/renaming fields, tightening validation, changing status codes or error codes) require `/api/v2` or a documented migration with a deprecation window.
- **Deprecation:** deprecated operations are marked `deprecated: true` in `openapi.yaml` and respond with `Deprecation: true` and `Sunset: <HTTP-date>` headers for ≥ 90 days before removal.
- **Reconciliation with the implementation:** `scripts/openapi-export` dumps the FastAPI-generated spec; CI runs a diff (`oasdiff breaking` + a path/operation/status/error-code coverage check) against `docs/04-backend-api/openapi.yaml`. Any operation present in one and not the other, or a breaking difference, fails CI until either the code or this contract (with a `DECISION_LOG.md` entry) is changed. `packages/shared` TypeScript types are generated from the reconciled spec with `openapi-typescript`.
- **Error codes** are part of the contract: adding a code is additive; changing an existing code's HTTP status or meaning is breaking.
