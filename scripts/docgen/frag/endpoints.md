### 10.1 Health

#### `GET /api/v1/healthz` — Liveness probe

- **Access:** Public (no session)
- **Rate limit:** Not rate-limited (health probes; internal metrics).

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
- **Rate limit:** 5 / min per (IP + email) and 20 / min per IP; account lockout after 10 consecutive failures (15 min).

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

Revokes the current session row, clears `dh_session` and rotates `dh_csrf`. Idempotent: an already-invalid session still gets 204 with cleared cookies.

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/verify-email` — Confirm email with token

- **Access:** Public (no session) · CSRF required
- **Rate limit:** 10 / h per IP (verify-email, reset-password).

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

Revokes a session belonging to the caller. Revoking the current session is equivalent to logout.

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/sessions/revoke-others` — Revoke all my other sessions

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions · CSRF
- **Rate limit:** 120 / min per user.

**Response `200 OK`** (`RevokeResult`):
```json
{"revoked": 2}
```

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/auth/mfa/setup` — Start TOTP enrolment

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions · CSRF
- **Rate limit:** 5 / h per user (change-password, MFA setup/disable, payout-method create).

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

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 412, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `verification.underage` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `precondition.failed`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 413, 415, 422, 429, 500

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 201, 400, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.current_password_invalid` (422), `payout_method.limit_reached` (409), `payout_method.invalid_details` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `DELETE /api/v1/me/payout-methods/{method_id}` — Remove a payout method

- **Access:** `payout.request` · CSRF
- **Rate limit:** 120 / min per user.

Soft-deletes (kept for historical payouts which store a snapshot).

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `payout_method.in_use` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 201, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `verification.already_pending` (409), `verification.already_approved` (409), `verification.underage` (422), `message.attachment_too_large` (413), `message.attachment_type_not_allowed` (415)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 202, 400, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `account.deletion_blocked` (409), `account.deletion_pending` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 413, 415, 422, 429, 500

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 429, 500

**Common errors:** `rate_limited`, `internal_error`

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
    "max_file_bytes": 5000000000,
    "max_dataset_bytes": 50000000000,
    "user_pending_quota_bytes": 200000000000,
    "max_files_per_dataset": 2000,
    "part_size_bytes": 16777216
  }
}
```

**Status codes:** 200, 429, 500

**Common errors:** `rate_limited`, `internal_error`

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

**Status codes:** 202, 400, 403, 413, 415, 422, 429, 500

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 201, 400, 401, 403, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `auth.onboarding_required` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

#### `GET /api/v1/datasets/{dataset_id}` — Get a dataset

- **Access:** `dataset.read.own`
- **Rate limit:** 600 / min per user.

Owner, or a holder of `dataset.read.any` (admin), or the reviewer whose claimed review targets this dataset. Others get 404.

**Response `200 OK`** (`Dataset`):
```json
{
  "id": "01930b71-2222-7b00-8000-0000000000d1",
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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 409, 412, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `dataset.not_editable` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `precondition.failed`, `rate_limited`, `internal_error`

#### `DELETE /api/v1/datasets/{dataset_id}` — Delete a draft or withdrawn dataset

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 120 / min per user.

Owner only; status `draft` or `withdrawn` and never finalized. Aborts open upload sessions, soft-deletes rows, objects purged by `retention.purge` after 30 days (A-15).

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `dataset.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/datasets/{dataset_id}/submit` — Submit for review

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 120 / min per user.

`draft|changes_requested → submitted`. Preconditions: no open upload sessions; every file terminal (`ready|failed|quarantined`); ≥ 1 `ready`; metadata valid. Resubmission after `changes_requested` creates a new `dataset_versions` row (version_number+1) and snapshots the file list. Owner is notified (`dataset_received`).

**Response `200 OK`** (`Dataset`):
```json
{
  "id": "01930b71-2222-7b00-8000-0000000000d1",
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

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `dataset.invalid_state` (409), `dataset.files_not_terminal` (409), `dataset.no_ready_files` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/datasets/{dataset_id}/withdraw` — Withdraw a dataset

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 120 / min per user.

`draft|submitted|changes_requested → withdrawn` (not once claimed: `in_review`). Owner only.

**Response `200 OK`** (`Dataset`):
```json
{
  "id": "01930b71-2222-7b00-8000-0000000000d1",
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

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `dataset.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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
      "scan_mode": "full",
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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

#### `DELETE /api/v1/datasets/{dataset_id}/files/{file_id}` — Remove a file from a dataset

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 120 / min per user.

Owner; dataset `draft` or `changes_requested`. Removing an archive removes its members. Object deleted asynchronously.

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `dataset.not_editable` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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
  "scan_mode": "full",
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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `rate_limited`, `internal_error`

#### `GET /api/v1/files/{file_id}/preview/{page}` — Redirect to a page preview image

- **Access:** any signed-in user
- **Rate limit:** 120 / min per user (presigned URL issuance, preview redirects).

302 to a presigned GET (5 min) of `datasets/{dataset_id}/files/{file_id}/previews/page-{n}.webp` with `response-content-type=image/webp` and `Cache-Control: private, max-age=300`. Same visibility as GET file. Preview of quarantined/infected files is never served.

**Response `302 Found`** — no JSON body.

**Status codes:** 302, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `file.not_ready` (409), `file.no_preview` (404), `file.unavailable` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `file.not_ready` (409), `file.no_preview` (404), `file.unavailable` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `file.not_ready` (409), `file.unavailable` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 201, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `dataset.not_editable` (409), `dataset.file_limit_exceeded` (409), `upload.file_too_large` (413), `upload.dataset_too_large` (413), `upload.quota_exceeded` (413), `upload.type_not_allowed` (415), `upload.storage_unavailable` (500), `auth.onboarding_required` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `upload.invalid_state` (409), `upload.expired` (409), `upload.part_number_invalid` (422), `upload.storage_unavailable` (500)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Endpoint-specific errors:** `upload.storage_unavailable` (500)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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
  "scan_mode": "full",
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

**Status codes:** 202, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `upload.invalid_state` (409), `upload.expired` (409), `upload.parts_mismatch` (422), `upload.file_too_large` (413), `upload.dataset_too_large` (413), `upload.quota_exceeded` (413), `dataset.not_editable` (409), `upload.storage_unavailable` (500)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `DELETE /api/v1/uploads/{upload_id}` — Abort an upload

- **Access:** `dataset.create` · CSRF
- **Rate limit:** 600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof).

AbortMultipartUpload, session `aborted`, file row deleted. Idempotent for already aborted/expired sessions.

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `upload.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

#### `POST /api/v1/datasets/{dataset_id}/claim-review` — Claim a submitted dataset for review

- **Access:** `dataset.review` · CSRF
- **Rate limit:** 120 / min per user.

`submitted → in_review`; creates `dataset_reviews` (`in_progress`) with the caller as assignee. Uses `SELECT … FOR UPDATE SKIP LOCKED`-style guard; a concurrent claim gets 409. Owner cannot claim.

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

**Status codes:** 201, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `review.already_claimed` (409), `dataset.invalid_state` (409), `permission.separation_of_duties` (403)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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
      "scan_mode": "full",
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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `review.not_assignee` (403), `review.invalid_state` (409), `review.reason_required` (422), `review.file_not_reviewable` (422), `review.labeled_upgrade_not_applicable` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `review.not_assignee` (403), `review.invalid_state` (409), `review.reason_required` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 409, 412, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `review.not_assignee` (403), `review.invalid_state` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `precondition.failed`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `review.not_assignee` (403), `review.invalid_state` (409), `review.incomplete` (422), `review.decision_inconsistent` (422), `review.feedback_required` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `review.not_assignee` (403), `review.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 201, 400, 401, 403, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `payout.insufficient_balance` (409), `payout.open_request_exists` (409), `payout.amount_below_minimum` (422), `payout.amount_above_maximum` (422), `payout.amount_not_whole_cents` (422), `payout.verification_required` (403), `payout.method_invalid` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `idempotency.key_required`, `rate_limited`, `internal_error`

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

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

#### `GET /api/v1/payouts/{payout_id}` — One of my payouts

- **Access:** `payout.request`
- **Rate limit:** 600 / min per user.

Owner only (admins use /admin/payouts/{id}). Proof file metadata visible; approver identities shown as 'DataHub finance'.

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

#### `POST /api/v1/payouts/{payout_id}/cancel` — Cancel my pending withdrawal

- **Access:** `payout.request` · CSRF
- **Rate limit:** 120 / min per user.
- **Headers:** `Idempotency-Key` (optional)

`requested → cancelled` only (approved payouts can be cancelled by admins). Writes `payout_release` journal.

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
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

**Status codes:** 200, 400, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `payout.invalid_state` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

### 10.10 Admin finance

#### `GET /api/v1/admin/finance/overview` — Finance dashboard figures

- **Access:** `finance.read` · admin MFA session
- **Rate limit:** 600 / min per user.

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
- **Query:** `status` — Filter (repeatable).; `user_id` — Filter.; `method` — Filter.; `min_amount_micros` — Filter.; `max_amount_micros` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`, `amount_micros`, `updated_at`)

**Response `200 OK`** (`PaginatedPayout`):
```json
{
  "items": [
    {
      "id": "01930b76-7777-7000-8000-000000000101",
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

Unmasked payout-method details only for `payout.approve` holders; access is audited (`payout.view_details`).

**Response `200 OK`** (`Payout`):
```json
{
  "id": "01930b76-7777-7000-8000-000000000101",
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

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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
    "scan_mode": "full",
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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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
    "scan_mode": "full",
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

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `annotation.not_assignee` (403), `annotation.invalid_state` (409), `annotation.project_closed` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `annotation.version_conflict` (409), `annotation.not_assignee` (403), `annotation.invalid_state` (409), `annotation.validation_failed` (422), `precondition.required` (400)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 409, 412, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `annotation.version_conflict` (409), `annotation.not_assignee` (403), `annotation.invalid_state` (409), `annotation.validation_failed` (422)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `precondition.failed`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 201, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `annotation.already_claimed` (409), `annotation.invalid_state` (409), `permission.separation_of_duties` (403)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `annotation.invalid_state` (409), `annotation.comments_required` (422), `permission.separation_of_duties` (403), `permission.denied` (403)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `csrf.missing`, `csrf.invalid`, `idempotency.key_invalid`, `idempotency.key_reused`, `idempotency.in_progress`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 201, 400, 401, 403, 413, 415, 422, 429, 500

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 400, 401, 403, 404, 413, 415, 422, 429, 500

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

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

**Status codes:** 201, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `message.conversation_closed` (409), `message.attachment_unavailable` (409)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/conversations/{conversation_id}/read` — Mark read up to a message

- **Access:** `message.self` · CSRF
- **Rate limit:** 120 / min per user.

**Request** (`ReadMarker`, application/json):
```json
{"last_read_message_id": "01930b78-9999-7200-8000-000000000302"}
```

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 400, 401, 403, 404, 413, 415, 422, 429, 500

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `request.malformed`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 201, 401, 403, 404, 413, 415, 422, 429, 500

**Endpoint-specific errors:** `message.attachment_too_large` (413), `message.attachment_type_not_allowed` (415)

**Common errors:** `request.unsupported_media_type`, `request.payload_too_large`, `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 404, 409, 422, 429, 500

**Endpoint-specific errors:** `message.attachment_unavailable` (409)

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

#### `GET /api/v1/ws` — WebSocket upgrade (realtime events)

- **Access:** any signed-in user · allowed for pending_email / MFA-pending sessions
- **Rate limit:** 10 connection attempts / min per user; max 5 concurrent sockets per user.

`GET /api/v1/ws` with `Upgrade: websocket`. Cookie-authenticated; Origin must be in `CORS_ALLOWED_ORIGINS`. Server→client events `message.created`, `notification.created`, `conversation.updated`. Protocol in API_DOCUMENTATION.md §9.

**Response `101 Switching Protocols`** — no JSON body.

**Status codes:** 101, 401, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `rate_limited`, `internal_error`

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

**Status codes:** 200, 401, 403, 422, 429, 500

**Common errors:** `validation_error`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

#### `GET /api/v1/notifications/unread-count` — Unread count

- **Access:** `profile.self`
- **Rate limit:** 600 / min per user.

**Response `200 OK`** (`UnreadCount`):
```json
{"unread": 3}
```

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `rate_limited`, `internal_error`

#### `POST /api/v1/notifications/{notification_id}/read` — Mark one read

- **Access:** `profile.self` · CSRF
- **Rate limit:** 120 / min per user.

**Response `204 No Content`** — no JSON body.

**Status codes:** 204, 401, 403, 404, 422, 429, 500

**Common errors:** `validation_error`, `resource.not_found`, `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

#### `POST /api/v1/notifications/read-all` — Mark all read

- **Access:** `profile.self` · CSRF
- **Rate limit:** 120 / min per user.

**Response `200 OK`** (`CountResult`):
```json
{"count": 3}
```

**Status codes:** 200, 401, 403, 429, 500

**Common errors:** `auth.not_authenticated`, `auth.session_expired`, `auth.email_unverified`, `auth.mfa_required`, `permission.denied`, `csrf.missing`, `csrf.invalid`, `rate_limited`, `internal_error`

### 10.14 Admin users

#### `GET /api/v1/admin/users` — Search users

- **Access:** `user.read` · admin MFA session
- **Rate limit:** 600 / min per user.
- **Query:** `q` — Case-insensitive search text.; `role` — Filter.; `status` — Filter.; `verification_status` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`, `email`, `last_login_at`)

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
- **Query:** `q` — Case-insensitive search text.; `status` — Filter (repeatable).; `data_class` — Filter.; `language` — Filter.; `category` — Filter.; `min_quality` — Overall quality ≥.; `owner_id` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`, `updated_at`, `title`, `total_bytes`, `submitted_at`, `finalized_at`, `overall_quality`)

**Response `200 OK`** (`PaginatedDataset`):
```json
{
  "items": [
    {
      "id": "01930b71-2222-7b00-8000-0000000000d1",
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

Full dataset record with all reviews (including internal comments and reviewer identities), version history, licence acceptance evidence and earning total. Files are fetched via `GET /datasets/{id}/files` (admins have `dataset.read.any`).

**Response `200 OK`** (`AdminDatasetDetail`):
```json
{
  "dataset": {
    "id": "01930b71-2222-7b00-8000-0000000000d1",
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
  "scan_mode": "full",
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

### 10.16 Exports

#### `POST /api/v1/admin/exports` — Create an export job

- **Access:** `dataset.export` · admin MFA session · **step-up MFA ≤ 15 min** · CSRF
- **Rate limit:** 10 / h per user.

Only approved/partially_approved datasets and accepted files are exportable; taken_down excluded. Background `exports.build_export` streams objects into ZIP parts ≤ 5 GB at `exports/{job_id}/{file}.zip`. Logged with dataset ids (audit). Expires after 7 days (A-15).

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
- **Query:** `status` — Filter.; `requested_by` — Filter.; `page`, `page_size`, `sort` (sortable: `created_at`)

**Response `200 OK`** (`PaginatedExportJob`):
```json
{
  "items": [
    {
      "id": "01930b7a-bbbb-7400-8000-000000000501",
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
          "size_bytes": 4831838208,
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

**Response `200 OK`** (`ExportJob`):
```json
{
  "id": "01930b7a-bbbb-7400-8000-000000000501",
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
      "size_bytes": 4831838208,
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
- **Query:** `actor_id` — Filter.; `action` — Exact or prefix (`payout.`).; `entity_type` — Filter.; `entity_id` — Filter.; `request_id` — Filter.; `from` — Inclusive lower bound (created_at).; `to` — Exclusive upper bound (created_at).; `page`, `page_size`, `sort` (sortable: `created_at`)

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
