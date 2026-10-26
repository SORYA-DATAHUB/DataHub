# DataHub — API Documentation

| Field | Value |
|---|---|
| **Purpose** | Human-readable contract for the DataHub REST + WebSocket API: conventions every endpoint follows, the complete error-code catalogue, rate limits, the WebSocket protocol, and a reference entry (access, example request/response, validation, status codes, errors) for every endpoint in `ENGINEERING_BASELINE.md` §12. |
| **Scope** | All endpoints under `/api/v1` served by `apps/api` (FastAPI modular monolith), including health probes and `WS /api/v1/ws`. Out of scope: S3 presigned-URL semantics beyond what the client must send (see `FILE_UPLOAD_STORAGE.md`), auth internals (see `AUTH_AUTHORIZATION.md`), v2 buyer/orders API. |
| **Assumptions** | A-01…A-15 of the baseline. Web app and API share one origin (`/api/*` proxied by Caddy in production, Next.js rewrites in development), so cookies are first-party. Single API version `v1`. Clients are the DataHub web app and operator scripts; no third-party API consumers in v1. |
| **Decisions** | Cookie sessions + CSRF double-submit (no bearer tokens in v1). Offset pagination (`page`/`page_size`). Error envelope `{"error":{code,message,details,request_id}}` with stable dotted codes. Money = integer `*_micros`, sizes = integer `*_bytes`. `Idempotency-Key` on financial POSTs (required on `POST /payouts`). Optimistic locking via `version` + `If-Match` (412), except annotation drafts (409 with server copy, baseline §11). Request bodies reject unknown fields. |
| **Dependencies** | `ENGINEERING_BASELINE.md` (§3, §6–§9, §11, §12), `openapi.yaml` (machine-readable twin of this document), `AUTH_AUTHORIZATION.md`, `FILE_UPLOAD_STORAGE.md`, Database Schema and LLD documents. |
| **Acceptance criteria** | (1) Every §12 endpoint appears in §10 and in `openapi.yaml` (verified by script: 143 operations, 0 missing). (2) Every error code an endpoint can return is in the §6 catalogue. (3) `openapi.yaml` passes `openapi-spec-validator` (OpenAPI 3.1). (4) CI contract test diffs the FastAPI-generated spec against `openapi.yaml`; any undocumented path, status or field fails the build. (5) Authorization matrix tests cover every endpoint × role (see `AUTH_AUTHORIZATION.md` §14). |

**Document control:** Version 1.0 · 2026-10-26 · Status: Baseline · Owner: Backend lead · Change process: amendments via `DECISION_LOG.md`; `openapi.yaml` and this file change in the same pull request.

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
- Idle timeout: 7 days for users, 12 hours for sessions of users holding `admin`/`super_admin`; absolute lifetime 30 days. Each authenticated request slides `last_seen_at` (written at most once per minute).
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
| Identifiers | UUID (v7-style, generated by the app), lower-case canonical string. |
| Timestamps | RFC 3339 / ISO 8601 in UTC with `Z` (`2026-10-26T08:30:00Z`). Dates (`date_of_birth`, analytics range) are `YYYY-MM-DD`. |
| Money | Integer micro-USD in fields ending `_micros` (1 USD = 1,000,000). Never floats. Payout amounts are whole cents (multiple of 10,000). Rates are `rate_micros_per_gb` (raw 1,000,000; labeled 1,500,000). Clients format by integer division; display rounds **down** to cents. |
| Sizes | Integer bytes in fields ending `_bytes`. 1 GB = 1,000,000,000 bytes (decimal) for pricing; part sizes are binary (16 MiB = 16,777,216). |
| Nulls | Optional response fields are present with `null` rather than omitted. In PATCH bodies, an omitted field is unchanged and `null` clears a nullable field. |
| Unknown fields | Request bodies are strict (`extra="forbid"`): unknown fields → `422 validation_error`. Responses may gain new fields in a minor release; clients must ignore unknown fields. |
| Enums | Lower-case snake_case strings; status values exactly match baseline §9. |
| Body size | JSON bodies ≤ 1 MiB (annotation drafts ≤ 2 MiB); multipart ≤ 10 MB + 64 KiB envelope. Larger → `413 request.payload_too_large`. |
| Booleans in query | `true` / `false` only. Repeatable filters use repeated keys: `?status=submitted&status=in_review`. |

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
| 503 | `readyz` only: required dependency down |

### 6.3 Error-code catalogue

{{ERRORS}}

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

{{RATELIMITS}}

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

### 10.0 Index ({{COUNT}} operations)

{{INDEX}}

{{ENDPOINTS}}

## 11. Versioning, deprecation and spec reconciliation

- **Versioning:** URL-major (`/api/v1`). Additive changes (new endpoints, new optional request fields, new response fields, new enum values in *response-only* enums) ship in v1. Breaking changes (removing/renaming fields, tightening validation, changing status codes or error codes) require `/api/v2` or a documented migration with a deprecation window.
- **Deprecation:** deprecated operations are marked `deprecated: true` in `openapi.yaml` and respond with `Deprecation: true` and `Sunset: <HTTP-date>` headers for ≥ 90 days before removal.
- **Reconciliation with the implementation:** `scripts/openapi-export` dumps the FastAPI-generated spec; CI runs a diff (`oasdiff breaking` + a path/operation/status/error-code coverage check) against `docs/04-backend-api/openapi.yaml`. Any operation present in one and not the other, or a breaking difference, fails CI until either the code or this contract (with a `DECISION_LOG.md` entry) is changed. `packages/shared` TypeScript types are generated from the reconciled spec with `openapi-typescript`.
- **Error codes** are part of the contract: adding a code is additive; changing an existing code's HTTP status or meaning is breaking.
