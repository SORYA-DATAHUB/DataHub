# DataHub — Authentication & Authorization Specification

| Field | Value |
|---|---|
| **Purpose** | Normative specification of how DataHub identifies users (registration, login, email verification, password reset, sessions, MFA) and decides what they may do (RBAC, resource-level rules, separation of duties), plus rate limiting, lockout, suspension, session revocation and how all of this is tested. |
| **Scope** | `identity` module and `core/security`, `core/permissions`, `core/ratelimit` of `apps/api`; the web app's auth flows; every endpoint in `API_DOCUMENTATION.md` (authorization matrix in Appendix A). Out of scope: SSO/OAuth (not in v1), buyer role (v2), infrastructure access control (see Deployment Plan). |
| **Assumptions** | Single organisation operator (A-01); ≤ 2,000 users, ≤ 200 concurrent sessions (A-03); web app and API share one origin so first-party `SameSite=Lax` cookies work; SMTP provider configured (A-12); clocks synchronised by NTP (TOTP tolerance ±30 s). |
| **Decisions** | Opaque server-side sessions (no JWT) in an HttpOnly cookie `dh_session`; SHA-256 of the token stored. CSRF double-submit cookie `dh_csrf` + `X-CSRF-Token` + Origin check. Argon2id passwords (argon2-cffi, t=3, m=64 MiB, p=4). TOTP MFA mandatory for admin/super_admin, step-up within 15 min for financial/privileged actions. Enumeration-safe register/forgot. 10 consecutive failures → 15-minute lock. Permission codes per baseline §6 enforced by a FastAPI dependency plus service-level resource checks; hidden resources return 404. |
| **Dependencies** | `ENGINEERING_BASELINE.md` §3, §6, §9, §12; `API_DOCUMENTATION.md`; `openapi.yaml` (`x-permission`, `x-admin-mfa`, `x-step-up-mfa` extensions drive the matrix tests); Database Schema (`users`, `user_sessions`, `email_verifications`, `mfa_recovery_codes`, `security_events`, `roles`, `user_roles`, `audit_logs`); Security Requirements and Threat Model documents. |
| **Acceptance criteria** | (1) All rules in §§3–13 have automated tests (§16). (2) The generated endpoint × role matrix test suite passes for all 146 operations with 0 unexpected allows. (3) No password, token, TOTP secret or recovery code is ever stored in plaintext or logged (log-scrubber test). (4) Suspension revokes all sessions and closes WebSockets within 5 s. (5) Financial actions without fresh MFA are refused with `auth.step_up_required`. (6) Separation-of-duties rules in §12.3 each have a negative test. |

**Document control:** Version 1.1 · 2026-10-26 · Status: Baseline (v1.1 — baseline §16 amendments AM-01…AM-14 applied) · Owner: Security lead / Backend lead · Changes via `DECISION_LOG.md`.

---

## Contents

1. Identity model and account states
2. Registration
3. Email verification
4. Password policy and storage
5. Login, lockout and login responses
6. Password reset and password change
7. Session management
8. CSRF protection
9. Multi-factor authentication (TOTP) and step-up
10. Administrative authentication
11. Authorization model (RBAC)
12. Resource-level rules, separation of duties, data scoping
13. Rate limiting and abuse protection
14. Account suspension, deactivation and deletion
15. Session revocation
16. Security events and audit
17. Authorization testing strategy
18. Configuration reference
Appendix A — Endpoint × role authorization matrix

---

## 1. Identity model and account states

- `users` (email `citext` unique, `password_hash`, `status`, `email_verified_at`, `verification_status`, `onboarding_completed_at`, `mfa_secret_enc`, `mfa_enabled_at`, `failed_login_count`, `locked_until`, `last_login_at`), `user_profiles`, `user_roles` → `roles(permissions text[])`.
- Every new user gets role `contributor`. Other roles are granted by admins (§11.4). A user may hold several roles; effective permissions = union.

| `users.status` (baseline §9) | Can sign in | What they can do |
|---|---|---|
| `pending_email` | Yes (limited) | `GET /auth/me`, `GET /auth/csrf`, verify / resend verification, logout, change password, own sessions, MFA setup/enable/verify. Everything else → `403 auth.email_unverified`. |
| `active` | Yes | According to roles and gates below. |
| `suspended` | No → `403 auth.account_suspended` (only after a correct password, to avoid status enumeration) | Nothing; all sessions revoked. Mandatory emails still delivered. |
| `deactivated` | No → `403 auth.account_inactive` | Nothing; awaiting anonymisation. |
| `anonymized` | No (email replaced by `deleted+<id>@invalid`, so login fails as invalid credentials) | Nothing. |

**Capability gates** (independent of roles, returned in `GET /auth/me → capabilities`):

| Capability | Requires |
|---|---|
| Upload / create datasets (`can_upload`) | `active` + email verified + onboarding completed for the current agreement version (A-09) |
| Withdraw (`can_withdraw`) | `payout.request` + `verification_status = approved` + `active` + ≥ 1 payout method (baseline §8.7) |
| Be assigned annotation tasks (`can_be_assigned_annotation`) | `annotator` role + `active` + `verification_status = approved` (A-08) |

## 2. Registration

1. Client: `GET /auth/csrf`, then `POST /auth/register {email, password, display_name, accept_terms, accept_privacy, terms_version}`.
2. Server validation: email RFC 5322 ≤ 254 chars, lower-cased and NFC; password policy (§4); display name 2–80 chars; acceptances `true`; `terms_version` = current.
3. Rate limit `5/h per IP` (class `auth_register`) and the global per-IP limit.
4. **Enumeration safety:** the response is always `202 {"status":"accepted"}` after a constant minimum duration (≥ 400 ms, padded). If the email is new: insert `users(status=pending_email)`, `user_roles(contributor)`, `user_profiles`, `agreement_acceptances` for ToS/Privacy (version, time, IP, UA), and an `email_verifications` token (§3) — then enqueue the verification email via the transactional outbox. If the email exists: enqueue an "account already exists — sign in or reset your password" email; nothing else changes. Argon2id hashing is performed in both branches so timing does not reveal existence.
5. No session is created. The user signs in normally; a `pending_email` session only allows the verification flows.
6. Contributor Agreement and rights declaration are **not** part of registration; they are accepted in onboarding (`POST /me/onboarding`) because they are required for uploading only (A-09) and their text is pending legal approval (HA-01).

## 3. Email verification

| Property | Value |
|---|---|
| Token | 32 bytes from `secrets.token_urlsafe(32)` → 43-char base64url string |
| Storage | `email_verifications(user_id, purpose='email_verify', token_hash=SHA-256(token) hex, expires_at, used_at, created_at, requested_ip)`; unique index on `token_hash`. The plaintext token exists only in the outgoing email. |
| Lifetime | 24 hours |
| Use | Single use: `used_at` set in the same transaction as `users.email_verified_at`; a used/unknown token → `400 auth.token_invalid`; expired → `400 auth.token_expired`. |
| Supersession | Issuing a new token (resend) marks all previous unused `email_verify` tokens of that user as used. |
| Link | `WEB_ORIGIN + "/verify-email#token=" + token` (`WEB_ORIGIN` = configured web origin) — the token is in the URL **fragment**, so it never reaches server logs, proxies or `Referer`. The page reads it with JavaScript and calls `POST /auth/verify-email {token}`. The page also sets `Referrer-Policy: no-referrer`. |
| Effect | `email_verified_at = now()`, `status: pending_email → active`, notification `email_verified`, security event `email_verified`. If the user is signed in, their session continues (no re-login). |
| Resend | `POST /auth/resend-verification` (signed in, `3/h per user`). |
| Email change | Not available in v1 self-service; support changes it after identity checks (audited), which sets `email_verified_at = NULL` and sends a new token. |

Comparison uses the hash lookup (constant-time by construction, no string compare of secrets). Expired/used tokens are purged daily after 7 days.

## 4. Password policy and storage

**Policy (NIST SP 800-63B aligned):**

- Length 12–128 characters after Unicode NFKC normalisation; all printable Unicode allowed including spaces and Khmer; no composition rules; no periodic expiry.
- Rejected if: equal to (or containing) the email local-part or display name (case-insensitive); in the bundled list of the 100,000 most common passwords; or — when `PASSWORD_BREACH_CHECK=true` (default `true` in production, `false` in development/CI) — found in Have I Been Pwned via the k-anonymity range API (first 5 hex chars of SHA-1 only; on HIBP timeout > 2 s the check is skipped and logged, never blocks registration).
- Errors: `422 auth.password_policy` with `details.reasons` ⊆ `{too_short, too_long, contains_identity, common, breached}`.
- The UI shows a strength meter (zxcvbn) as guidance only; the server rules above are authoritative.

**Storage:** Argon2id via `argon2-cffi` `PasswordHasher(time_cost=3, memory_cost=65536 KiB (64 MiB), parallelism=4, hash_len=32, salt_len=16)` — PHC string in `users.password_hash`. On successful login, `check_needs_rehash()` upgrades hashes transparently when parameters are raised. Hashing runs in the threadpool; a semaphore limits concurrent hashes to `2 × CPU` to bound memory (64 MiB each). Passwords longer than 128 characters are rejected before hashing (DoS guard). Passwords are never logged: the request logger redacts fields named `password`, `new_password`, `current_password`, `token`, `code`, `recovery_code`, `secret`.

## 5. Login, lockout and login responses

**Flow — `POST /auth/login {email, password}`:**

1. CSRF + Origin check (anonymous binding); rate limits `5/min per (IP, email)` and `20/min per IP`.
2. Look up user by `citext` email. If not found: verify the password against a fixed dummy Argon2id hash (equal cost) and return `401 auth.invalid_credentials`.
3. If `locked_until > now()`: return `429 auth.account_locked` with `details.retry_after_seconds` **without** verifying the password (so locking cannot be used as an oracle beyond the lock itself).
4. Verify password. On failure: increment `failed_login_count`; at **5 failures within 15 minutes** (counter window `LOGIN_LOCK_WINDOW_SECONDS`) set `locked_until = now() + 15 min`, reset the counter, write security event `account_locked`, email the user ("someone tried to sign in…" with reset link). Return `401 auth.invalid_credentials`.
5. On success: reset `failed_login_count`; check status (`suspended` → `403 auth.account_suspended`, `deactivated`/`anonymized` → `403 auth.account_inactive`).
6. Create session (§7): revoke the presented pre-login session (if any), issue a new token, set cookies, rotate CSRF.
7. Response:

| User | Response | Session state |
|---|---|---|
| No MFA, no admin role | `200 {mfa_required:false, mfa_enrollment_required:false, me:{…}}` | full |
| MFA enabled (any role) | `200 {mfa_required:true, me:null}` | MFA-pending: only `/auth/mfa/verify`, `/auth/me`, `/auth/csrf`, `/auth/logout`; others → `403 auth.mfa_required` |
| admin/super_admin without MFA | `200 {mfa_enrollment_required:true, me:{…}}` | enrolment-only: `/auth/mfa/setup`, `/auth/mfa/enable`, `/auth/me`, `/auth/csrf`, `/auth/logout`, `/auth/change-password`; others → `403 auth.mfa_enrollment_required` |

8. Security event `login_succeeded` / `login_failed` with IP, user agent, reason. `users.last_login_at` updated on full login (after MFA if required).

The lock is per account; the per-IP limits stop horizontal (credential-stuffing) attacks; a user under attack can still get in by resetting the password (reset clears the lock, §6).

## 6. Password reset and password change

**Forgot:** `POST /auth/forgot-password {email}` → always `202` (constant minimum latency). If an `active` or `pending_email` user exists and the per-email limit (3/h) is not exceeded, issue `email_verifications(purpose='password_reset')` token: 32 bytes urlsafe, SHA-256 stored, **1 hour** expiry, single use; previous reset tokens invalidated. Link `WEB_ORIGIN + "/reset-password#token=" + token` (fragment).

**Reset:** `POST /auth/reset-password {token, new_password}` → validate token (`auth.token_invalid` / `auth.token_expired`), password policy, re-hash, mark token used, **revoke all sessions** of the user, clear `failed_login_count`/`locked_until`, set `email_verified_at` if null (inbox ownership proven), security event `password_reset_completed`, mandatory confirmation email. The user then signs in (MFA still required if enabled — reset never bypasses MFA).

**Change (signed in):** `POST /auth/change-password {current_password, new_password}` → verify current (`422 auth.current_password_invalid`; counts toward lockout), policy, re-hash, **revoke all other sessions**, rotate the current session (new cookie), security event `password_changed`, mandatory email.

## 7. Session management

| Property | Value |
|---|---|
| Token | `secrets.token_urlsafe(32)` — 256-bit, opaque |
| Cookie | `dh_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/` (no `Domain` attribute → host-only). In development over `http://localhost`, `Secure` is dropped only when `ENV=development`. Cookie name prefix `__Host-` is not used because the dev setup runs over HTTP; production may enable `SESSION_COOKIE_NAME=__Host-dh_session` without code changes. |
| Server record | `user_sessions(id, user_id, token_hash SHA-256 unique, created_at, last_seen_at, idle_expires_at, absolute_expires_at, mfa_verified_at, mfa_pending bool, ip, user_agent, revoked_at, revoked_reason, rotated_from)` |
| Idle timeout | 7 days for users; **30 minutes** if the user holds `admin` or `super_admin` (evaluated per request, so a role grant shortens existing sessions) — baseline AM-08 |
| Absolute timeout | 30 days from creation for users; **12 hours** for sessions of users holding `admin`/`super_admin`; regardless of activity (rotation keeps the original `absolute_expires_at`) |
| Sliding | `last_seen_at`/`idle_expires_at` updated at most once per 60 s per session |
| Rotation | New token + new row (old row revoked with reason `rotated`) on: login, MFA verification (pending → verified), MFA enable, password change, role change of the user (next request), privilege-sensitive reactivation. Prevents session fixation. |
| Lookup | `SHA-256(cookie)` → indexed row; cached in Redis for 60 s keyed by hash (`session:{hash}` → user id, roles, flags); revocation deletes the cache key, so revocation is effective immediately on all API replicas. |
| Concurrent sessions | Max 20 active per user; creating the 21st revokes the least recently used. |
| Listing / revocation by user | `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `POST /auth/sessions/revoke-others`. |
| Logout | Revokes the row, clears cookie (`Max-Age=0`), rotates `dh_csrf`. |
| Cleanup | Daily job deletes rows expired/revoked > 30 days ago (security events keep the history for 1 year). |
| IP privacy | Session IP stored in full for 30 days for security review, then truncated (/24 IPv4, /48 IPv6). |

No session tokens appear in URLs, logs, error messages or WebSocket frames.

## 8. CSRF protection

Defence in depth for cookie-authenticated APIs:

1. **SameSite=Lax** on `dh_session` blocks cross-site POST/PUT/PATCH/DELETE with the cookie in all modern browsers.
2. **Double-submit token:** `dh_csrf` cookie (readable by JS, `Secure; SameSite=Lax; Path=/`) must equal header `X-CSRF-Token`. The token is HMAC-signed and bound to the session (or anonymous pre-session id) — `nonce.issued_at.HMAC-SHA256(CSRF_SECRET, binding|nonce|issued_at)` — so a cookie planted from a sibling subdomain cannot be paired with a victim session.
3. **Origin check:** for unsafe methods `Origin` (fallback `Referer`) must be in `CORS_ALLOWED_ORIGINS`.
4. **JSON-only bodies:** unsafe endpoints reject `application/x-www-form-urlencoded` and `text/plain` (`415`), preventing simple-form CSRF even if other checks regressed. Multipart is accepted only on three endpoints that also require the token.

Login, register, forgot/reset and verify-email (unauthenticated unsafe methods) are protected too, preventing login-CSRF. Failures → `403 csrf.missing|csrf.invalid` + security event `csrf_rejected`.

## 9. Multi-factor authentication (TOTP) and step-up

**Algorithm:** RFC 6238 TOTP via `pyotp` — SHA-1, 6 digits, 30-second period, accept current ±1 step. Replay protection: `users.mfa_last_used_step` stores the last accepted time-step; a code for the same or an earlier step is rejected.

**Enrolment** (`POST /auth/mfa/setup` → `POST /auth/mfa/enable`):

1. Setup requires the current password; generates a 160-bit base32 secret, stores it AES-256-GCM-encrypted (`MFA_ENCRYPTION_KEY`, 32 bytes, from secrets; key id stored for rotation) as *pending* for 15 min; returns `secret` and `otpauth://` URI (issuer `DataHub`). The QR code is rendered client-side; the secret is never logged.
2. Enable verifies one code against the pending secret, sets `mfa_enabled_at`, generates **10 recovery codes** (format `XXXXX-XXXXX`, base32, 50 bits each) shown once, stored as SHA-256 in `mfa_recovery_codes(user_id, code_hash, used_at)`, marks the session MFA-verified and rotates it. Security event `mfa_enabled`; mandatory email.

**Verification** (`POST /auth/mfa/verify {code | recovery_code}`): rate limited 5/min per session, 20/h per user; 10 consecutive failures revoke the MFA-pending session and email the user. A recovery code is single-use (`used_at` set), triggers event `mfa_recovery_code_used` and an email; when ≤ 2 remain, the UI prompts regeneration (re-enrol).

**Disable:** non-admin users only, with password + current TOTP. Users holding admin/super_admin cannot disable (`403 auth.mfa_cannot_disable`); removing the admin role first is the only path.

**Lost device:** user uses a recovery code; if none remain, a super_admin resets MFA via the operator CLI (`scripts/create-admin --reset-mfa <email>`) after out-of-band identity verification — the reset is audited, revokes all sessions and forces re-enrolment at next login. A super_admin who loses all factors is recovered the same way by the system owner with server access (break-glass, two-person procedure in the Deployment Plan).

**Step-up for financial and privileged actions.** Endpoints flagged `x-step-up-mfa` require `session.mfa_verified_at ≥ now() − 15 min`, otherwise `403 auth.step_up_required`; the UI opens a TOTP prompt, calls `POST /auth/mfa/verify` (which re-stamps `mfa_verified_at`) and retries with the same `Idempotency-Key`. Step-up applies to:

- Payouts: approve, reject, mark-paid, mark-failed, cancel (admin), reverse.
- Ledger: adjustments; pricing-rule creation.
- Users: suspend, reactivate, role changes, revoke sessions.
- Datasets: takedown; takedown-request decisions (`POST /admin/takedown-requests/{id}/decision`, AM-04). Exports: create.
- Settings: `PUT /admin/settings/{key}`.

## 10. Administrative authentication

- Admin and super_admin accounts are normal users with additional roles. The **first super_admin** is created only with the server-side CLI `scripts/create-admin` (prompts for email and password interactively, never via arguments or environment). There is no web sign-up path to admin.
- Further admins are created by a super_admin granting the role (`PUT /admin/users/{id}/roles`, step-up). Granting `admin`/`super_admin` forces MFA enrolment on the grantee's next request (`auth.mfa_enrollment_required`) and rotates their session.
- `ADMIN_MFA_REQUIRED=true` (default, must stay true in production; startup fails if false with `ENV=production`). With it, every endpoint flagged `x-admin-mfa` (all `/admin/*`, `/pricing-rules`, annotation project/assignment management) requires an MFA-verified session (`403 auth.mfa_required`).
- Admin sessions: 30-minute idle timeout, 12-hour absolute lifetime; step-up window 15 minutes (baseline AM-08).
- Optional `ADMIN_IP_ALLOWLIST` (CIDR list): when set, admin-flagged endpoints from other IPs return `403 permission.denied` and a security event.
- All admin mutations write `audit_logs` (actor, action, entity, before/after diff, IP, request_id). Viewing sensitive data (unmasked payout details, verification ID documents, audit log) is itself audited.
- Admins do not hold `payout.request` (baseline §6), which removes any self-payment path. Admins may create datasets (`dataset.create`, e.g. platform-owned data) but can never review them (SoD), and any earnings credited to a staff wallet cannot be withdrawn in v1. A staff member who also contributes privately uses a separate contributor account.

## 11. Authorization model (RBAC)

### 11.1 Roles and permissions (baseline §6 — canonical)

| Permission code | contributor | annotator | reviewer | admin | super_admin |
|---|:-:|:-:|:-:|:-:|:-:|
| `profile.self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `dataset.create`, `dataset.read.own` | ✓ | | | ✓ | ✓ |
| `payout.request` (also requires verified contributor) | ✓ | ✓ | | | |
| `message.self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `annotation.work` (assigned tasks only) | | ✓ | | | |
| `dataset.review` (assigned/claimed reviews only) | | | ✓ | ✓ | ✓ |
| `annotation.review` | | | ✓ | ✓ | ✓ |
| `dataset.read.any` | | | (only datasets in their review queue — resource rule, not the permission) | ✓ | ✓ |
| `user.read`, `user.manage`, `user.verify` | | | | ✓ | ✓ |
| `annotation.manage` | | | | ✓ | ✓ |
| `payout.approve`, `payout.record_payment` | | | | ✓ | ✓ |
| `finance.read` | | | | ✓ | ✓ |
| `finance.adjust` | | | | | ✓ |
| `dataset.export` | | | | ✓ | ✓ |
| `message.support` (support inbox) | | | | ✓ | ✓ |
| `analytics.read` | | | | ✓ | ✓ |
| `pricing.manage`, `role.manage`, `settings.manage`, `audit.read` | | | | | ✓ |

### 11.2 Enforcement layers

1. **Route dependency** `require(*codes, admin_mfa=False, step_up=False)` in each router: resolves the session, rejects limited states, checks `any(code in effective_permissions)`, MFA flags. Effective permissions are the union over the user's roles, read from `roles.permissions` and cached with the session for 60 s; role changes invalidate the cache immediately.
2. **Service-level resource checks** (§12) — every service function receives the `Actor` and checks ownership/assignment/state inside the same transaction that reads the row (`SELECT … FOR UPDATE` for mutations), preventing TOCTOU.
3. **Query scoping** — list queries are built from the actor (`WHERE owner_id = :actor` for own lists; `WHERE assignee_id = :actor` for my-tasks); there is no "list everything then filter" path.
4. **Database** — constraints back critical invariants: one open payout per user (partial unique index), one active assignment per task, unique approvals per approver, append-only ledger/audit triggers, CHECKs on non-negative balances.
5. **Frontend** hides controls by permission for UX only; it is never relied on.

### 11.3 403 vs 404

A resource the actor may not see at all returns `404 resource.not_found` (prevents IDOR enumeration). `403 permission.denied` is used when the actor lacks the permission for the entire endpoint, or can see the resource but not perform this action (e.g. a reviewer viewing but not finalizing another reviewer's review → `403 review.not_assignee`).

### 11.4 Role management rules

- `PUT /admin/users/{id}/roles` replaces the set; `contributor` can be removed only from staff accounts with no datasets/balance.
- `admin` may grant/remove `annotator` and `reviewer`. Only `super_admin` (`role.manage`) may grant/remove `admin` or `super_admin` (`403 user.role_escalation_forbidden`).
- Nobody may change their own roles (`403 permission.separation_of_duties`).
- The last active `super_admin` cannot be removed or suspended (`409 user.last_super_admin`).
- Role → permission mapping is seeded by migration; `GET /admin/roles` is read-only in v1. Changing the mapping requires a migration and a `DECISION_LOG.md` entry.

## 12. Resource-level rules, separation of duties, data scoping

### 12.1 Resource rules per module

| Module | Rule |
|---|---|
| Profile / Me | Only the caller's own records; no user id in `/me/*` paths. Payout-method details masked (last 4) for owners; full only for `payout.approve` (audited). |
| Datasets | Owner may read/update/delete/submit/withdraw their own dataset; mutations only in states allowed by §9 of the baseline (`dataset.not_editable`, `dataset.invalid_state`). Readers besides owner: reviewer holding an `in_progress` or `finalized` review of the dataset; `dataset.read.any`. |
| Files / previews / downloads | Visible to: dataset owner; reviewer of the dataset (as above); annotator with an **active assignment** on a task whose file is this file (preview + text; download only if the project allows); `dataset.read.any`. Quarantined/infected or taken-down files are never served (`file.unavailable`). Duplicate matches reveal other owners' file/dataset ids only to reviewers/admins. |
| Uploads | Only the owner of the dataset the session belongs to; dataset must be editable. |
| Review | Queue excludes own datasets. Claim creates exclusive assignment; only the assignee may set decisions, update, finalize or release (admins may release and read). |
| Finance (user) | Wallet, transactions, earnings, payouts: caller's own only. Cancel only own `requested` payouts. |
| Finance (admin) | `finance.read` to view; `payout.approve` / `payout.record_payment` / `finance.adjust` / `pricing.manage` to act; SoD below. |
| Annotation | Annotator: only tasks with an active assignment to them; writes only in `assigned|in_progress|changes_requested`. Reviewer: may list the review queue, claim tasks they did not annotate, and decide only tasks they claimed. `annotation.manage`: all project/task administration. |
| Messaging | Conversation access: participants, plus `message.support` holders for support/dataset conversations. Contributors may link only their own datasets. Attachments readable by conversation participants/staff only after `clean` scan. |
| Notifications | Own only. |
| Exports | `dataset.export` + admin MFA + step-up to create; any `dataset.export` holder may see and download jobs (shared admin workspace); every URL issuance audited. |
| Admin users | `user.read` to view; `user.manage` to change; actions on admin/super_admin accounts require super_admin; no self-suspension/self-role change. |
| Settings / audit / pricing | super_admin only (`settings.manage`, `audit.read`, `pricing.manage`). |

### 12.2 State-dependent authorization

Authorization is evaluated together with the state machine (baseline §9): e.g. owner `PATCH /datasets/{id}` is allowed only in `draft|changes_requested`; `mark-paid` only from `approved`; annotation draft only by the active assignee in `in_progress`. These checks happen after locking the row.

### 12.3 Separation of duties (SoD)

| Rule | Enforced at | Error |
|---|---|---|
| A reviewer cannot claim/review a dataset they own | claim-review; queue filter | `permission.separation_of_duties` |
| An annotation cannot be reviewed by its annotator (any annotator who held an assignment on the task) | annotation claim-review/review; queue filter | `permission.separation_of_duties` |
| A payout cannot be approved, rejected, marked paid/failed or reversed by its recipient | admin payout actions | `permission.separation_of_duties` |
| Payouts ≥ `payout_dual_approval_threshold_micros` (default $100, HA-07) need 2 **distinct** approvers | approve | `payout.already_approved_by_you` |
| Adjustments cannot target the actor's own wallet | adjustments | `permission.separation_of_duties` |
| Users cannot change their own roles, suspend themselves, or decide their own verification | admin users / verifications | `permission.separation_of_duties` |
| Pricing changes and reversals are super_admin-only; approving/paying payouts is admin-level — a super_admin who performs an adjustment is recorded so a second super_admin can review it in the audit log | role design | — |

### 12.4 Data minimisation in responses

- Contributors never see reviewer identities or internal review comments (`ReviewFeedback` projection).
- Contributors see payout approvers as "DataHub finance".
- Reviewers see contributor display names only; legal name, DOB, phone and ID documents are visible only to `user.verify`.
- Annotators see the source file and project instructions, never the contributor's identity.

## 13. Rate limiting and abuse protection

Redis sliding-window limiter; keys hashed (`rl:{class}:{sha256(key)}`), responses carry `RateLimit` and on rejection `Retry-After`.

| Action | Limit | Key | On exceed |
|---|---|---|---|
| Login | 5 / min; 20 / min | IP + email; IP | `429 rate_limited` |
| Account lockout | 5 failed passwords within 15 min → locked 15 min | account | `429 auth.account_locked` + email |
| MFA verify | 5 / min; 20 / h; 10 consecutive failures revoke pending session | session; user | `429 rate_limited` |
| Register | 5 / h | IP | `429 rate_limited` |
| Forgot password | 3 / h; 10 / h | email; IP | silently not sent (still `202`) / `429` for IP |
| Resend verification | 3 / h | user | `429 rate_limited` |
| Verify-email / reset-password submit | 10 / h | IP | `429 rate_limited` |
| Change password, MFA setup/disable, add payout method | 5 / h | user | `429 rate_limited` |
| Contact form; public takedown notice (`POST /public/takedown-requests`, AM-04) | 5 / h each (+ honeypot) | IP | `429` / silent drop |
| Withdrawal request | 10 / h | user | `429 rate_limited` |
| Authenticated reads / writes | 600 / min; 120 / min | user | `429 rate_limited` |
| Upload control calls | 600 / min | user | `429 rate_limited` |
| Presigned URL issuance | 120 / min | user | `429 rate_limited` |
| Messages / attachments | 30 / min; 60 / h | user | `429 rate_limited` |
| Exports | 10 / h | user | `429 rate_limited` |
| WebSocket connect | 10 / min, ≤ 5 concurrent | user | close 4429 |
| Global safety net | 1,200 / min | IP | `429 rate_limited` |
| Maintenance mode (AM-06) | `maintenance_mode=true` | all non-exempt endpoints | `503 service_unavailable`, `details.reason="maintenance"`; `/healthz`, `/readyz`, `/auth/*`, `/admin/*` and admin-MFA endpoints keep working, so admins can still sign in |

Full per-endpoint classes: `API_DOCUMENTATION.md` §8. Auth-class limiters fail **closed** if Redis is unavailable; others fail open with an alert. Rate-limit hits are recorded as `rate_limited` security events (sampled 1:10 for read/write classes). The client IP is taken from `X-Forwarded-For` only when the immediate peer is the trusted proxy (`TRUSTED_PROXIES`).

Additional abuse controls: upload quota (200 GB unreviewed per user), one open payout per user, maximum 5 payout methods, payout-method changes email the user, new-device login email (first login from a new user-agent family + /24), suspicious patterns (≥ 3 accounts sharing a payout account number) flagged for admin review in the verification queue.

## 14. Account suspension, deactivation and deletion

**Suspend** (`POST /admin/users/{id}/suspend`, `user.manage`, step-up, reason required):

1. `status: active → suspended`, `suspension_reason`, audit row.
2. **All sessions revoked** in the same transaction (rows + Redis cache keys); `session.revoked` published → open WebSockets closed with 4401 within 5 s.
3. Open upload sessions aborted (S3 AbortMultipartUpload); `submitted` datasets stay in the queue (reviewer may still process; admin may take down).
4. Claimed dataset reviews and annotation reviews released; `assigned|in_progress` annotation tasks unassigned (drafts kept).
5. Open payouts are **not** auto-cancelled; admins see a "recipient suspended" banner and decide (reject/cancel/pay). No new payout requests possible.
6. Mandatory email with the reason and appeal contact.

**Reactivate:** `suspended → active` (step-up); user signs in again; nothing is automatically restored (tasks stay unassigned).

**Deactivate / delete:** self-service `POST /me/deletion-request` → admin processes per the Retention policy: `deactivated` (sessions revoked, login refused) → `anonymized` (PII replaced, email tombstoned). Financial records, agreements and audit rows are kept 7 years (A-15) linked to the pseudonymous user id.

## 15. Session revocation

| Trigger | Scope | Mechanism |
|---|---|---|
| Logout | current session | row revoked, cookie cleared |
| `DELETE /auth/sessions/{id}` | that session | row revoked |
| `POST /auth/sessions/revoke-others` | all but current | rows revoked |
| Password change | all others; current rotated | |
| Password reset | all | |
| MFA enable / reset by CLI | rotate current / all | |
| Role change | target's sessions rotated (privileges recomputed); removal of admin role revokes MFA-step-up windows | |
| Suspension, deactivation, anonymisation | all | + WebSocket close |
| `POST /admin/users/{id}/revoke-sessions` | all | step-up |
| Idle / absolute expiry | that session | lazy on next request + daily cleanup |
| 10 failed MFA attempts | the MFA-pending session | |
| Security incident (operator) | all users | `scripts/revoke-all-sessions` (truncates active set, flushes `session:*` cache) |

Revocation is effective on the next request on every replica (Redis cache key deleted; DB is the authority on cache miss) and within 5 s for WebSockets.

## 16. Security events and audit

`security_events` (retained 1 year) records: `login_succeeded`, `login_failed`, `account_locked`, `logout`, `password_changed`, `password_reset_requested`, `password_reset_completed`, `email_verified`, `mfa_enabled`, `mfa_disabled`, `mfa_failed`, `mfa_recovery_code_used`, `session_revoked`, `csrf_rejected`, `permission_denied`, `rate_limited`, `payout_method_changed` — with user id (if known), hashed email for unknown-user attempts, IP, user agent, request id and details. Viewable by `audit.read` (`GET /admin/security-events`). Alerts: > 50 `login_failed` / 5 min platform-wide, any `account_locked` on an admin, `permission_denied` bursts (> 20 / min per user) — routed to the ops channel.

`audit_logs` (retained 7 years, append-only by trigger) records every state transition and admin action (baseline §9).

## 17. Authorization testing strategy

1. **Generated matrix tests (pytest, real Postgres):** a fixture set creates one user per role (plus a multi-role user and a `pending_email` user), each with owned and non-owned resources (datasets, files, uploads, reviews, payouts, tasks, conversations). A parametrised test iterates over every operation in `openapi.yaml` × every persona, builds a schema-valid request from the examples, and asserts the expected outcome from Appendix A: allowed (2xx or a business 4xx that is *not* 401/403/404-for-authz), `403 permission.denied`, or `404 resource.not_found` for non-owned resources. Any operation without an expectation fails the suite, so new endpoints cannot ship untested.
2. **Coverage guard:** a test asserts that every FastAPI route has a `require(...)` dependency (or is explicitly whitelisted as public/internal) and that its permission equals the `x-permission` in `openapi.yaml`.
3. **IDOR tests:** for every path with an id, a second user of the same role requests the first user's resource → `404`.
4. **Gate tests:** `pending_email`, MFA-pending, enrolment-required, suspended, onboarding-missing and unverified-contributor personas against representative endpoints; admin endpoint without MFA → `auth.mfa_required`; step-up endpoints with `mfa_verified_at` 16 minutes old → `auth.step_up_required`.
5. **Separation-of-duties tests:** one negative test per row in §12.3 (self-review, self-approval, second approval by same admin, self-adjustment, self-role-change, last super_admin).
6. **Session tests:** idle/absolute expiry with frozen time (`time-machine`), rotation on login/MFA/password change (old token rejected), revocation propagation across two app instances sharing Redis, cookie attributes (HttpOnly/Secure/SameSite/Path).
7. **CSRF tests:** missing header, mismatched header, token bound to another session, wrong Origin, form-encoded body → all 403/415.
8. **Credential tests:** enumeration (register/forgot responses and timing within ±50 ms for known vs unknown emails over 50 samples), lockout after 5 failures within 15 min and unlock after 15 min, token single-use and expiry, Argon2 parameters and rehash, password-policy reasons.
9. **Rate-limit tests:** each auth class triggers 429 with `Retry-After`; Redis-down behaviour (auth fails closed).
10. **E2E (Playwright):** login + MFA for admin, step-up dialog on payout approval, suspended user kicked out of an open tab, contributor cannot reach admin routes (UI + API).
11. **CI gate:** matrix and authz suites run on every pull request; a failing or skipped authorization test blocks merge. Security review checklist requires updating Appendix A when adding endpoints.

## 18. Configuration reference

| Setting (env) | Default | Notes |
|---|---|---|
| `SESSION_COOKIE_NAME` | `dh_session` | `__Host-dh_session` optional in production |
| `CSRF_COOKIE_NAME` | `dh_csrf` | |
| `SESSION_IDLE_SECONDS_USER` | 604800 (7 d) | |
| `SESSION_IDLE_SECONDS_ADMIN` | 1800 (30 min) | AM-08 |
| `SESSION_ABSOLUTE_SECONDS` | 2592000 (30 d) | users |
| `SESSION_ABSOLUTE_SECONDS_ADMIN` | 43200 (12 h) | AM-08; sessions of users holding admin/super_admin |
| `STEP_UP_SECONDS` | 900 (15 min) | |
| `ADMIN_MFA_REQUIRED` | `true` | must be true in production (startup check) |
| `ADMIN_IP_ALLOWLIST` | empty | CIDR list |
| `MFA_ENCRYPTION_KEY` | — (secret, required) | 32-byte base64; key id for rotation |
| `CSRF_SECRET` | — (secret, required) | 32+ bytes random; rotation invalidates outstanding CSRF tokens only |
| `WEB_ORIGIN` | `http://localhost:3410` (dev) | used to build email links |
| `PASSWORD_BREACH_CHECK` | `true` prod / `false` dev | HIBP k-anonymity |
| `ARGON2_TIME_COST` / `ARGON2_MEMORY_KIB` / `ARGON2_PARALLELISM` | 3 / 65536 / 4 | raising triggers rehash on login |
| `LOGIN_LOCK_THRESHOLD` / `LOGIN_LOCK_WINDOW_SECONDS` / `LOGIN_LOCK_SECONDS` | 5 / 900 / 900 | AM-08 |
| `EMAIL_TOKEN_TTL_SECONDS` / `RESET_TOKEN_TTL_SECONDS` | 86400 / 3600 | |
| `CORS_ALLOWED_ORIGINS` | web origin | also used for Origin checks and WebSocket |
| `TRUSTED_PROXIES` | Caddy container network | for client-IP extraction |

## Appendix A — Endpoint × role authorization matrix

Legend: **✓** allowed · **M** allowed with an MFA-verified admin session · **S** allowed with MFA step-up (≤ 15 min) · **ᴿ** additionally subject to the resource rule in the last column (non-matching resources → 404 or 403 as specified) · **—** denied (`403 permission.denied`) · **net** internal network only. Columns: con = contributor, ann = annotator, rev = reviewer, adm = admin, sup = super_admin (each tested as a single-role user; multi-role users get the union). Public endpoints are also callable without a session. All non-public endpoints additionally require an `active` (or for auth endpoints, `pending_email`) account and pass capability gates (§1). This table is generated from the same endpoint catalogue as `openapi.yaml` and is the expected-result source for the matrix tests (§17).

| Method | Path | Permission | con | ann | rev | adm | sup | Resource rule |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| GET | `/api/v1/healthz` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/readyz` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/metrics` | `internal` | net | net | net | net | net |  |
| GET | `/api/v1/auth/csrf` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/register` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/login` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/mfa/verify` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/logout` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/verify-email` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/resend-verification` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/forgot-password` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/reset-password` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/change-password` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/auth/me` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/auth/sessions` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own sessions only |
| DELETE | `/api/v1/auth/sessions/{session_id}` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own sessions only |
| POST | `/api/v1/auth/sessions/revoke-others` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own sessions only |
| POST | `/api/v1/auth/mfa/setup` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/mfa/enable` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/mfa/disable` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | denied for admin/super_admin (`auth.mfa_cannot_disable`) |
| GET | `/api/v1/me/profile` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| PATCH | `/api/v1/me/profile` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| POST | `/api/v1/me/onboarding` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| GET | `/api/v1/me/payout-methods` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | self only (no id in path) |
| POST | `/api/v1/me/payout-methods` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | self only (no id in path) |
| DELETE | `/api/v1/me/payout-methods/{method_id}` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | self only (no id in path) |
| GET | `/api/v1/me/verification` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| POST | `/api/v1/me/verification` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| POST | `/api/v1/me/deletion-request` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| GET | `/api/v1/me/notification-preferences` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| PATCH | `/api/v1/me/notification-preferences` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| GET | `/api/v1/public/pricing` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/public/formats` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/public/contact` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/public/takedown-requests` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/datasets` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | lists only caller's datasets |
| GET | `/api/v1/datasets` | `dataset.read.own` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | lists only caller's datasets |
| GET | `/api/v1/datasets/{dataset_id}` | `dataset.read.own` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| PATCH | `/api/v1/datasets/{dataset_id}` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| DELETE | `/api/v1/datasets/{dataset_id}` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| POST | `/api/v1/datasets/{dataset_id}/submit` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| POST | `/api/v1/datasets/{dataset_id}/withdraw` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| GET | `/api/v1/datasets/{dataset_id}/files` | `dataset.read.own` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| DELETE | `/api/v1/datasets/{dataset_id}/files/{file_id}` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| GET | `/api/v1/datasets/{dataset_id}/reviews` | `dataset.read.own` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| GET | `/api/v1/datasets/{dataset_id}/estimate` | `dataset.read.own` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| GET | `/api/v1/files/{file_id}` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | owner · reviewer of the dataset · assignee of a task on the file · `dataset.read.any` |
| GET | `/api/v1/files/{file_id}/preview/{page}` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | owner · reviewer of the dataset · assignee of a task on the file · `dataset.read.any` |
| GET | `/api/v1/files/{file_id}/text` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | owner · reviewer of the dataset · assignee of a task on the file · `dataset.read.any` |
| POST | `/api/v1/files/{file_id}/download-url` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | owner · reviewer of the dataset · assignee of a task on the file · `dataset.read.any` |
| POST | `/api/v1/datasets/{dataset_id}/uploads` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | dataset owner; dataset draft/changes_requested |
| POST | `/api/v1/uploads/{upload_id}/part-urls` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner of the upload session's dataset |
| GET | `/api/v1/uploads/{upload_id}` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner of the upload session's dataset |
| POST | `/api/v1/uploads/{upload_id}/complete` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner of the upload session's dataset |
| DELETE | `/api/v1/uploads/{upload_id}` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner of the upload session's dataset |
| GET | `/api/v1/reviews/queue` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | excludes own datasets |
| POST | `/api/v1/datasets/{dataset_id}/claim-review` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | dataset not owned by caller (SoD) |
| GET | `/api/v1/reviews/{review_id}` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | GET: assignee or `dataset.read.any`; PATCH: assignee |
| PUT | `/api/v1/reviews/{review_id}/files/{file_id}` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee reviewer only |
| POST | `/api/v1/reviews/{review_id}/files/bulk` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee reviewer only |
| PATCH | `/api/v1/reviews/{review_id}` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | GET: assignee or `dataset.read.any`; PATCH: assignee |
| GET | `/api/v1/reviews/{review_id}/summary` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee reviewer only |
| POST | `/api/v1/reviews/{review_id}/finalize` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee reviewer only |
| POST | `/api/v1/reviews/{review_id}/release` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee or admin |
| GET | `/api/v1/reviews/history` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | own reviews (admin: any via reviewer_id) |
| GET | `/api/v1/wallet` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own wallet only |
| GET | `/api/v1/wallet/transactions` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own wallet only |
| GET | `/api/v1/earnings` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own wallet only |
| POST | `/api/v1/payouts` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own payouts only |
| GET | `/api/v1/payouts` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own payouts only |
| GET | `/api/v1/payouts/{payout_id}` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own payouts only |
| POST | `/api/v1/payouts/{payout_id}/cancel` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own payouts only |
| GET | `/api/v1/admin/finance/overview` | `finance.read` | — | — | — | M | M |  |
| GET | `/api/v1/admin/payouts` | `finance.read` | — | — | — | M | M |  |
| GET | `/api/v1/admin/payouts/{payout_id}` | `finance.read` | — | — | — | M | M |  |
| POST | `/api/v1/admin/payouts/{payout_id}/approve` | `payout.approve` | — | — | — | Sᴿ | Sᴿ | actor ≠ payout recipient; 2nd approver ≠ 1st |
| POST | `/api/v1/admin/payouts/{payout_id}/reject` | `payout.approve` | — | — | — | Sᴿ | Sᴿ | actor ≠ payout recipient; 2nd approver ≠ 1st |
| POST | `/api/v1/admin/payouts/{payout_id}/mark-paid` | `payout.record_payment` | — | — | — | Sᴿ | Sᴿ | actor ≠ payout recipient; 2nd approver ≠ 1st |
| POST | `/api/v1/admin/payouts/{payout_id}/mark-failed` | `payout.record_payment` | — | — | — | Sᴿ | Sᴿ | actor ≠ payout recipient; 2nd approver ≠ 1st |
| POST | `/api/v1/admin/payouts/{payout_id}/cancel` | `payout.approve` | — | — | — | S | S |  |
| POST | `/api/v1/admin/payouts/{payout_id}/reverse` | `finance.adjust` | — | — | — | — | Sᴿ | actor ≠ payout recipient; 2nd approver ≠ 1st |
| POST | `/api/v1/admin/payouts/{payout_id}/proof` | `payout.record_payment` | — | — | — | M | M |  |
| POST | `/api/v1/admin/adjustments` | `finance.adjust` | — | — | — | — | Sᴿ | target user ≠ actor |
| GET | `/api/v1/admin/ledger` | `finance.read` | — | — | — | M | M |  |
| GET | `/api/v1/pricing-rules` | `finance.read` | — | — | — | M | M |  |
| POST | `/api/v1/admin/pricing-rules` | `pricing.manage` | — | — | — | — | S |  |
| GET | `/api/v1/admin/finance/reconciliation` | `finance.read` | — | — | — | M | M |  |
| GET | `/api/v1/annotation/projects` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/projects` | `annotation.manage` | — | — | — | M | M |  |
| GET | `/api/v1/annotation/projects/{project_id}` | `annotation.manage` | — | — | — | M | M |  |
| PATCH | `/api/v1/annotation/projects/{project_id}` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/projects/{project_id}/generate-tasks` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/projects/{project_id}/close` | `annotation.manage` | — | — | — | M | M |  |
| GET | `/api/v1/annotation/projects/{project_id}/tasks` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/tasks/{task_id}/assign` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/tasks/bulk-assign` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/tasks/{task_id}/unassign` | `annotation.manage` | — | — | — | M | M |  |
| GET | `/api/v1/annotation/my-tasks` | `annotation.work` | — | ✓ᴿ | — | — | — | own tasks/rewards |
| GET | `/api/v1/annotation/tasks/{task_id}` | `annotation.work` or `annotation.review` or `annotation.manage` | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee · claimant reviewer · `annotation.manage` |
| POST | `/api/v1/annotation/tasks/{task_id}/start` | `annotation.work` | — | ✓ᴿ | — | — | — | active assignee only |
| PUT | `/api/v1/annotation/tasks/{task_id}/draft` | `annotation.work` | — | ✓ᴿ | — | — | — | active assignee only |
| POST | `/api/v1/annotation/tasks/{task_id}/submit` | `annotation.work` | — | ✓ᴿ | — | — | — | active assignee only |
| GET | `/api/v1/annotation/tasks/{task_id}/versions` | `annotation.work` or `annotation.review` or `annotation.manage` | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee · claimant reviewer · `annotation.manage` |
| GET | `/api/v1/annotation/my-rewards` | `annotation.work` | — | ✓ᴿ | — | — | — | own tasks/rewards |
| GET | `/api/v1/annotation/review-queue` | `annotation.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | excludes tasks the caller annotated |
| POST | `/api/v1/annotation/tasks/{task_id}/claim-review` | `annotation.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | not the task's annotator; review: claimant only |
| POST | `/api/v1/annotation/tasks/{task_id}/review` | `annotation.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | not the task's annotator; review: claimant only |
| GET | `/api/v1/annotation/reviews/history` | `annotation.review` | — | — | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/conversations` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| POST | `/api/v1/conversations` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| GET | `/api/v1/conversations/{conversation_id}` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| PATCH | `/api/v1/conversations/{conversation_id}` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| GET | `/api/v1/conversations/{conversation_id}/messages` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| POST | `/api/v1/conversations/{conversation_id}/messages` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| POST | `/api/v1/conversations/{conversation_id}/read` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| POST | `/api/v1/conversations/{conversation_id}/attachments` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| GET | `/api/v1/attachments/{attachment_id}/download-url` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant of the attachment's conversation, or uploader, or `message.support` |
| GET | `/api/v1/ws` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/notifications` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own notifications only |
| GET | `/api/v1/notifications/unread-count` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own notifications only |
| POST | `/api/v1/notifications/{notification_id}/read` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own notifications only |
| POST | `/api/v1/notifications/read-all` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own notifications only |
| GET | `/api/v1/admin/users` | `user.read` | — | — | — | M | M |  |
| GET | `/api/v1/admin/users/{user_id}` | `user.read` | — | — | — | M | M |  |
| POST | `/api/v1/admin/users/{user_id}/suspend` | `user.manage` | — | — | — | Sᴿ | Sᴿ | target ≠ self; target holding admin/super_admin requires super_admin |
| POST | `/api/v1/admin/users/{user_id}/reactivate` | `user.manage` | — | — | — | Sᴿ | Sᴿ | target ≠ self; target holding admin/super_admin requires super_admin |
| PUT | `/api/v1/admin/users/{user_id}/roles` | `user.manage` | — | — | — | Sᴿ | Sᴿ | target ≠ self; target holding admin/super_admin requires super_admin |
| POST | `/api/v1/admin/users/{user_id}/revoke-sessions` | `user.manage` | — | — | — | Sᴿ | Sᴿ | target ≠ self; target holding admin/super_admin requires super_admin |
| GET | `/api/v1/admin/verifications` | `user.verify` | — | — | — | M | M |  |
| POST | `/api/v1/admin/verifications/{verification_id}/decision` | `user.verify` | — | — | — | Mᴿ | Mᴿ | subject ≠ actor |
| GET | `/api/v1/admin/datasets` | `dataset.read.any` | — | — | — | M | M |  |
| GET | `/api/v1/admin/datasets/{dataset_id}` | `dataset.read.any` | — | — | — | M | M |  |
| POST | `/api/v1/admin/datasets/{dataset_id}/takedown` | `dataset.read.any` | — | — | — | S | S |  |
| POST | `/api/v1/admin/files/{file_id}/rescan` | `dataset.read.any` | — | — | — | M | M |  |
| GET | `/api/v1/admin/takedown-requests` | `user.manage` | — | — | — | M | M |  |
| POST | `/api/v1/admin/takedown-requests/{takedown_id}/decision` | `user.manage` | — | — | — | S | S |  |
| POST | `/api/v1/admin/exports` | `dataset.export` | — | — | — | S | S |  |
| GET | `/api/v1/admin/exports` | `dataset.export` | — | — | — | M | M |  |
| GET | `/api/v1/admin/exports/{export_id}` | `dataset.export` | — | — | — | M | M |  |
| POST | `/api/v1/admin/exports/{export_id}/download-url` | `dataset.export` | — | — | — | M | M |  |
| GET | `/api/v1/admin/analytics/overview` | `analytics.read` | — | — | — | M | M |  |
| GET | `/api/v1/admin/audit-logs` | `audit.read` | — | — | — | — | M |  |
| GET | `/api/v1/admin/security-events` | `audit.read` | — | — | — | — | M |  |
| GET | `/api/v1/admin/settings` | `settings.manage` | — | — | — | — | M |  |
| PUT | `/api/v1/admin/settings/{key}` | `settings.manage` | — | — | — | — | S |  |
| GET | `/api/v1/admin/roles` | `user.read` | — | — | — | M | M |  |
