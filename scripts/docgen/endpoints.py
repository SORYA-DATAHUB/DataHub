"""Endpoint catalogue — canonical list from ENGINEERING_BASELINE §12."""
from examples import *  # noqa
from schemas import en, s, UUID, DT, DATE, BOOL, INT

EP = []

def ep(m, p, tag, summary, **kw):
    d = dict(m=m, p=p, tag=tag, sum=summary, auth="user", perm=None, desc="", q=[], paged=False, sort=None,
             body=None, ct="json", req=None, ok=200, resp=None, rex=None, val=[], err=[], idem=None, ifm=None,
             rl="read" if m == "GET" else "write", step=False, admin=False, verified=True, rh=[], csrf=None, onb=False)
    d.update(kw)
    if d["csrf"] is None:
        d["csrf"] = m not in ("GET", "HEAD", "OPTIONS") and d["auth"] != "internal"
    EP.append(d)

def q(name, schema, desc):
    return (name, schema, desc)

DFROM = q("from", DT, "Inclusive lower bound (created_at).")
DTO = q("to", DT, "Exclusive upper bound (created_at).")
QTEXT = q("q", s(maxl=200), "Case-insensitive search text.")

# ============================ HEALTH ============================
ep("GET", "/healthz", "Health", "Liveness probe", auth="public", rl="none", resp="Health",
   rex={"status": "ok", "version": "1.0.0", "time": T}, desc="Process is up. No dependency checks. Never rate-limited, never authenticated.")
ep("GET", "/readyz", "Health", "Readiness probe", auth="public", rl="none", resp="Readiness",
   rex={"status": "ok", "checks": {"postgres": "ok", "redis": "ok", "s3": "ok", "clamav": "ok", "migrations": "ok"}},
   desc="Checks Postgres (SELECT 1 + Alembic head), Redis PING, S3 HeadBucket, clamd PING. Returns **503** with the same body shape when any required check fails (ClamAV failure ⇒ `degraded`: API serves, processing pauses).",
   err=["service_unavailable"])
ep("GET", "/metrics", "Health", "Prometheus metrics (internal only)", auth="internal", rl="none", resp=None,
   desc="Prometheus text exposition (`text/plain; version=0.0.4`). Caddy returns 404 for this path on the public listener; reachable only on the internal Docker network by the Prometheus scraper.")

# ============================ AUTH ============================
ep("GET", "/auth/csrf", "Auth", "Issue CSRF token", auth="public", rl="public", resp="CsrfToken",
   rex={"csrf_token": "c1a9b0f2e5d84f6c.1730000000.Q2x8hFz0Yw0m3vV5J2t3p5r1Xk6b4N8o9Lq7s0dE1aA"},
   desc="Sets/refreshes the `dh_csrf` cookie (not HttpOnly, Secure, SameSite=Lax, Path=/) and returns the same value. The token is `nonce.timestamp.HMAC-SHA256(secret, session_binding|nonce|timestamp)`; binding is the session id hash, or an anonymous pre-session id for unauthenticated forms. Call on app boot and after login/logout (both rotate it).",
   verified=False)
ep("POST", "/auth/register", "Auth", "Register a new account", auth="public", rl="auth_register", body="RegisterRequest", ok=202, resp="Accepted",
   req={"email": "sophea@example.com", "password": "correct horse battery staple", "display_name": "Sophea K.", "accept_terms": True, "accept_privacy": True, "terms_version": "TOS-2026-10"},
   rex={"status": "accepted", "message": "If this email can be registered, we have sent a verification link."},
   desc="Creates a `pending_email` user with role `contributor` and sends a verification email (24 h link). **Enumeration-safe:** if the email already exists, the response is identical and the existing owner receives an 'account already exists' email instead. No session is created; the client shows 'check your inbox' and the user signs in normally (pending_email accounts may sign in with limited access).",
   val=["email: RFC 5322, ≤ 254 chars, lower-cased + NFC; stored citext", "password: 12–128 chars, not equal to email/local-part, not in the bundled common-password list (100k); HIBP k-anonymity check when `PASSWORD_BREACH_CHECK=true`", "display_name: 2–80 chars, trimmed, NFC, no control chars", "accept_terms/accept_privacy must be true; terms_version must equal the current published version"],
   err=["auth.password_policy"], verified=False)
ep("POST", "/auth/login", "Auth", "Sign in with email and password", auth="public", rl="auth_login", body="LoginRequest", resp="LoginResponse",
   req={"email": "sophea@example.com", "password": "correct horse battery staple"},
   rex={"mfa_required": False, "mfa_enrollment_required": False, "me": ME},
   desc="Verifies credentials (constant-time; dummy Argon2 hash when the email is unknown). On success: revokes the pre-login session if any, creates a new session (rotation), sets `dh_session` (HttpOnly, Secure, SameSite=Lax, Path=/) and a fresh `dh_csrf`. If the user has MFA enabled, the session is created in *MFA-pending* state and the response is `{mfa_required: true, me: null}`; the client must call `POST /auth/mfa/verify`. Admin/super_admin without MFA get `{mfa_enrollment_required: true}` and may only call MFA setup/enable, me, csrf, logout.",
   val=["email and password required; password ≤ 128 chars (longer input rejected before hashing to avoid DoS)"],
   err=["auth.invalid_credentials", "auth.account_locked", "auth.account_suspended", "auth.account_inactive"], verified=False,
   rh=["Set-Cookie"])
ep("POST", "/auth/mfa/verify", "Auth", "Verify TOTP / recovery code (login second factor or step-up)", rl="auth_mfa", body="MfaVerifyRequest", resp="Me",
   req={"code": "492817"}, rex=dict(ME, session=dict(SESSION_STATE, mfa_verified=True, step_up_valid_until="2026-10-26T08:45:00Z")),
   desc="Completes login for MFA-pending sessions and doubles as **step-up**: on an already verified session it re-stamps `mfa_verified_at`, opening a 15-minute window for financial/privileged actions. TOTP: SHA-1, 6 digits, 30 s, ±1 step; the last accepted step is stored to prevent replay. A recovery code is single-use and triggers a security email. Session id is rotated on first verification.",
   val=["exactly one of code (6 digits) or recovery_code (XXXXX-XXXXX base32)"], err=["auth.mfa_invalid_code", "auth.mfa_not_set_up"], verified=False)
ep("POST", "/auth/logout", "Auth", "Sign out current session", ok=204, rl="write", desc="Revokes the current session row, clears `dh_session` and rotates `dh_csrf`. Idempotent: an already-invalid session still gets 204 with cleared cookies.", verified=False)
ep("POST", "/auth/verify-email", "Auth", "Confirm email with token", auth="public", rl="auth_token", body="TokenRequest", resp="OkStatus",
   req={"token": "Jw0Qe3m8ZKcV9rT1xY4uB6nP2sD5fG7hJ0kL3zX8cVb"}, rex={"status": "verified"},
   desc="Token = 32 random bytes, base64url (43 chars). Looks up SHA-256(token) with purpose `email_verify`, checks expiry (24 h) and `used_at IS NULL`, then sets `email_verified_at`, status `pending_email → active`, marks the token used and invalidates other outstanding verify tokens. Works without a session (link opened on another device).",
   err=["auth.token_invalid", "auth.token_expired"], verified=False)
ep("POST", "/auth/resend-verification", "Auth", "Resend verification email", rl="auth_resend", ok=202, resp="Accepted",
   rex={"status": "accepted", "message": "Verification email sent."}, desc="For the signed-in `pending_email` user. Invalidates previous tokens and issues a new one.",
   err=["auth.email_already_verified"], verified=False)
ep("POST", "/auth/forgot-password", "Auth", "Request password-reset email", auth="public", rl="auth_forgot", body="EmailRequest", ok=202, resp="Accepted",
   req={"email": "sophea@example.com"}, rex={"status": "accepted", "message": "If an account exists for this email, a reset link has been sent."},
   desc="Enumeration-safe; identical response and similar latency whether or not the account exists. Sends a 1-hour single-use token (purpose `password_reset`). Suspended/anonymized accounts receive nothing.", verified=False)
ep("POST", "/auth/reset-password", "Auth", "Set new password with reset token", auth="public", rl="auth_token", body="ResetPasswordRequest", ok=204,
   req={"token": "Jw0Qe3m8ZKcV9rT1xY4uB6nP2sD5fG7hJ0kL3zX8cVb", "new_password": "a new long passphrase 2026"},
   desc="Validates token (1 h, single use), applies password policy, re-hashes with Argon2id, revokes **all** sessions, clears lockout counter, emails a confirmation. If the account was `pending_email`, the reset also verifies the email (the user proved inbox control).",
   err=["auth.token_invalid", "auth.token_expired", "auth.password_policy"], verified=False)
ep("POST", "/auth/change-password", "Auth", "Change password (signed in)", rl="auth_password", body="ChangePasswordRequest", ok=204,
   req={"current_password": "correct horse battery staple", "new_password": "a new long passphrase 2026"},
   desc="Requires current password. Revokes all other sessions and rotates the current one (new cookie).",
   err=["auth.current_password_invalid", "auth.password_policy"], verified=False)
ep("GET", "/auth/me", "Auth", "Current user, permissions and session state", resp="Me", rex=ME,
   desc="Single bootstrap call for the web app. Returns 401 when not signed in. Works in limited states (pending_email, MFA-pending) so the UI can route the user.", verified=False)
ep("GET", "/auth/sessions", "Auth", "List my active sessions", resp="SessionList", rex={"items": [SESSION, dict(SESSION, id=SES2, current=False, user_agent="Mozilla/5.0 (Android 14) Chrome/130.0")]},
   desc="Active (non-revoked, non-expired) sessions of the caller; `current` marks this one. IP shown as stored (truncated /24 for IPv4, /48 for IPv6 after 30 days).", verified=False)
ep("DELETE", "/auth/sessions/{session_id}", "Auth", "Revoke one of my sessions", ok=204,
   desc="Revokes a session belonging to the caller. Revoking the current session is equivalent to logout.", verified=False)
ep("POST", "/auth/sessions/revoke-others", "Auth", "Revoke all my other sessions", resp="RevokeResult", rex={"revoked": 2}, verified=False)
ep("POST", "/auth/mfa/setup", "Auth", "Start TOTP enrolment", rl="auth_password", body="MfaSetupRequest", resp="MfaSetupResponse",
   req={"password": "correct horse battery staple"},
   rex={"secret": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", "otpauth_uri": "otpauth://totp/DataHub:vanna%40datahub.example?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=DataHub&algorithm=SHA1&digits=6&period=30", "issuer": "DataHub", "algorithm": "SHA1", "digits": 6, "period": 30},
   desc="Generates a 160-bit secret, stores it encrypted (AES-256-GCM, key `MFA_ENCRYPTION_KEY`) as *pending* for 15 minutes. The UI renders the otpauth URI as a QR code client-side. Allowed for MFA-enrolment-required sessions.",
   err=["auth.current_password_invalid", "auth.mfa_already_enabled"], verified=False)
ep("POST", "/auth/mfa/enable", "Auth", "Confirm TOTP enrolment and get recovery codes", rl="auth_mfa", body="MfaEnableRequest", resp="MfaEnableResponse",
   req={"code": "492817"}, rex={"recovery_codes": ["K7QPA-M2XRD", "B4TNE-WZ6FH", "R3JVC-Q5LMA", "Z2HYD-7NKPE", "F6WRB-T3QJX", "M5CZK-L7NAR", "P2XVD-J4HTE", "W7NQF-C6RYB", "D3LTA-K5ZMH", "H7RPE-X2WQN"]},
   desc="Verifies a code against the pending secret, activates MFA, generates 10 recovery codes (shown once; stored as SHA-256), marks the session MFA-verified and rotates the session id (privilege change).",
   err=["auth.mfa_invalid_code", "auth.mfa_not_set_up", "auth.mfa_already_enabled"], verified=False)
ep("POST", "/auth/mfa/disable", "Auth", "Disable TOTP (non-admin roles only)", rl="auth_password", body="MfaDisableRequest", ok=204,
   req={"password": "correct horse battery staple", "code": "492817"},
   desc="Requires password and a current TOTP code. Forbidden for users holding admin or super_admin. Deletes secret and recovery codes; security email sent.",
   err=["auth.current_password_invalid", "auth.mfa_invalid_code", "auth.mfa_not_set_up", "auth.mfa_cannot_disable"])

# ============================ ME ============================
ep("GET", "/me/profile", "Me", "Get my profile", perm="profile.self", resp="Profile", rex=PROFILE, rh=["ETag"])
ep("PATCH", "/me/profile", "Me", "Update my profile", perm="profile.self", body="ProfileUpdate", resp="Profile", ifm="optional",
   req={"display_name": "Sophea K.", "timezone": "Asia/Phnom_Penh", "preferred_language": "km"}, rex=PROFILE,
   desc="Partial update. `legal_name`, `country`, `date_of_birth` become read-only while a verification is `pending` or `approved` (changing them requires a new verification submission).",
   val=["country ISO-3166 alpha-2", "phone E.164", "timezone must be a valid IANA name", "date_of_birth ≥ 18 years ago", "all strings NFC, no control characters"],
   err=["verification.underage"], rh=["ETag"])
ep("POST", "/me/onboarding", "Me", "Accept contributor agreement and rights declaration", perm="profile.self", body="OnboardingRequest", resp="Me",
   req={"agreement_version": "CA-2026-10", "accept_contributor_agreement": True, "rights_declaration": True, "acknowledge_no_personal_data_without_consent": True}, rex=ME,
   desc="Records `agreement_acceptances` (version, timestamp, IP, user agent) and sets `onboarding_completed_at`. Idempotent per agreement version. Required before creating datasets (A-09). When a new agreement version is published, users are prompted again and uploads are blocked until accepted.",
   val=["agreement_version must equal current published version", "all booleans must be true"])
ep("GET", "/me/payout-methods", "Me", "List my payout methods", perm="payout.request", resp="PayoutMethodList", rex={"items": [PAYOUT_METHOD]})
ep("POST", "/me/payout-methods", "Me", "Add a payout method", perm="payout.request", body="PayoutMethodCreate", ok=201, resp="PayoutMethod",
   req={"type": "aba_pay", "label": "My ABA account", "is_default": True, "details": {"account_name": "KEO SOPHEA", "account_number": "000124821"}, "current_password": "correct horse battery staple"},
   rex=PAYOUT_METHOD, rl="auth_password",
   desc="Requires current password (re-authentication). Max 5 methods. Emits security event `payout_method_changed` and a mandatory email. Details are never used for automatic transfers.",
   val=["per-type required details (see schema)", "account numbers 4–34 chars [A-Za-z0-9 -]", "emails RFC 5322", "label 1–60 chars"],
   err=["auth.current_password_invalid", "payout_method.limit_reached", "payout_method.invalid_details"])
ep("DELETE", "/me/payout-methods/{method_id}", "Me", "Remove a payout method", perm="payout.request", ok=204,
   desc="Soft-deletes (kept for historical payouts which store a snapshot).", err=["payout_method.in_use"])
ep("GET", "/me/verification", "Me", "Get my latest contributor verification", perm="profile.self", resp="ContributorVerification", rex=VERIFICATION,
   desc="Returns the latest verification row or **404** `resource.not_found` if never submitted (UI shows 'not started').")
ep("POST", "/me/verification", "Me", "Submit (or resubmit) contributor verification", perm="profile.self", body="VerificationSubmit", ct="multipart", ok=201,
   resp="ContributorVerification", req={"legal_name": "Sophea Keo", "country": "KH", "date_of_birth": "1995-04-12", "phone": "+85512345678", "id_document": "<binary national-id.jpg>"},
   rex=VERIFICATION, rl="upload",
   desc="multipart/form-data. Creates a new `pending` row (allowed when none, `rejected` or `needs_info`), mirrors `users.verification_status=pending`, notifies verifiers. The optional ID document (PDF/JPEG/PNG ≤ 10 MB) is magic-byte checked, ClamAV scanned and stored at `verifications/{verification_id}/id-document` — visible to `user.verify` holders only.",
   val=["age ≥ 18", "country alpha-2", "phone E.164", "id_document ≤ 10 MB, pdf/jpeg/png by magic bytes"],
   err=["verification.already_pending", "verification.already_approved", "verification.underage", "message.attachment_too_large", "message.attachment_type_not_allowed"])
ep("POST", "/me/deletion-request", "Me", "Request account deletion", perm="profile.self", body="DeletionRequestCreate", ok=202, resp="DeletionRequest",
   req={"confirm_email": "sophea@example.com", "reason": "No longer contributing."}, rex={"id": "01930b7e-ffff-7800-8000-000000000901", "status": "pending", "created_at": T, "scheduled_for": "2026-11-25T08:30:00Z"},
   desc="Creates a `deletion_requests` row processed by an admin per the Retention policy: account → `deactivated` then `anonymized`; financial and audit records retained 7 years (A-15) in pseudonymised form. Available balance must be withdrawn or explicitly forfeited (confirmation in UI).",
   err=["account.deletion_blocked", "account.deletion_pending"])
ep("GET", "/me/notification-preferences", "Me", "Get notification preferences", perm="profile.self", resp="NotificationPreferences",
   rex={"email": {"dataset_approved": True, "annotation_assigned": True, "support_message": True}, "mandatory_email_types": ["payment_recorded", "security_alert", "withdrawal_rejected", "payout_failed"]})
ep("PATCH", "/me/notification-preferences", "Me", "Update notification preferences", perm="profile.self", body="NotificationPreferencesUpdate", resp="NotificationPreferences",
   req={"email": {"annotation_assigned": False}}, rex={"email": {"dataset_approved": True, "annotation_assigned": False, "support_message": True}, "mandatory_email_types": ["payment_recorded", "security_alert", "withdrawal_rejected", "payout_failed"]},
   val=["keys must be NotificationType values; mandatory types ignore false"])

# ============================ PUBLIC ============================
ep("GET", "/public/pricing", "Public", "Current published rates", auth="public", rl="public", resp="PublicPricing",
   rex={"currency": "USD", "bytes_per_gb": 1000000000, "rates": [{"data_class": "raw", "rate_micros_per_gb": 1000000, "effective_from": "2026-10-01T00:00:00Z"}, {"data_class": "labeled", "rate_micros_per_gb": 1500000, "effective_from": "2026-10-01T00:00:00Z"}], "min_withdrawal_micros": 10000000, "max_withdrawal_micros": 5000000000},
   desc="Cached 60 s. Shows rules in force now (future rules are not published until effective).", verified=False)
ep("GET", "/public/formats", "Public", "Allowed formats and upload limits", auth="public", rl="public", resp="FormatList",
   rex={"items": [{"extension": "pdf", "mime_types": ["application/pdf"], "allowed": True, "preview": "page_images", "annotatable": "page_level", "payable": "yes", "notes": "First 500 pages rendered."},
                  {"extension": "zip", "mime_types": ["application/zip"], "allowed": True, "preview": "member_list", "annotatable": "no", "payable": "members_only", "notes": "Container never payable; members processed individually."}],
        "limits": {"max_file_bytes": 5000000000, "max_dataset_bytes": 50000000000, "user_pending_quota_bytes": 200000000000, "max_files_per_dataset": 2000, "part_size_bytes": 16777216}},
   desc="Machine-readable form of baseline §7 plus `extra_allowed_extensions`. Used by the uploader for client-side pre-checks.", verified=False)
ep("POST", "/public/contact", "Public", "Contact form", auth="public", rl="contact", body="ContactRequest", ok=202, resp="Accepted",
   req={"name": "Dara", "email": "dara@example.org", "subject": "Partnership", "message": "We have 20k scanned Khmer forms. Can we contribute?"},
   rex={"status": "accepted", "message": "Thanks — we will reply by email."},
   desc="Creates a support conversation (kind `support`, no user) visible in the admin inbox and an email to the support address. Honeypot field `website` (must be empty) silently drops bots with 202.", verified=False)

# ============================ DATASETS (owner) ============================
DS_SORT = ["created_at", "updated_at", "title", "total_bytes", "submitted_at"]
ep("POST", "/datasets", "Datasets", "Create a dataset (draft)", perm="dataset.create", body="DatasetCreate", ok=201, resp="Dataset", onb=True,
   req={"title": "Khmer newspaper scans 1990–1999", "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.", "data_class": "raw", "category": "news", "languages": ["km"], "tags": ["newspaper", "ocr"], "source_description": "Personal archive, scanned by me.", "contains_personal_data": False, "rights_declaration_accepted": True, "license_version": "CA-2026-10"},
   rex=dict(DATASET, file_count=0, ready_file_count=0, total_bytes=0, version=1), rh=["Location", "ETag"],
   desc="Creates `datasets` (status `draft`), `dataset_versions` v1 and `dataset_licenses` (licence version, acceptance time, IP). Requires email verified + onboarding (A-09).",
   val=["title 3–200 chars NFC trimmed", "languages 1–5 distinct ISO codes", "tags ≤ 20 × ≤ 40 chars", "personal_data_notes required when contains_personal_data=true", "license_version = current agreement version"],
   err=["auth.onboarding_required"])
ep("GET", "/datasets", "Datasets", "List my datasets", perm="dataset.read.own", paged=True, sort=DS_SORT, resp="PaginatedDataset", rex=page([DATASET]),
   q=[q("status", {"$ref": "#/components/schemas/DatasetStatus"}, "Filter by status (repeatable)."), q("data_class", {"$ref": "#/components/schemas/DataClass"}, "Filter."), QTEXT],
   desc="Only datasets owned by the caller (admins use `/admin/datasets`).")
ep("GET", "/datasets/{dataset_id}", "Datasets", "Get a dataset", perm="dataset.read.own", resp="Dataset", rex=DATASET, rh=["ETag"],
   desc="Owner, or a holder of `dataset.read.any` (admin), or the reviewer whose claimed review targets this dataset. Others get 404.")
ep("PATCH", "/datasets/{dataset_id}", "Datasets", "Update dataset metadata", perm="dataset.create", body="DatasetUpdate", resp="Dataset", ifm="optional",
   req={"description": "Scanned front pages, 300 dpi, 1990–1999. Some pages faded.", "tags": ["newspaper", "ocr", "1990s"]}, rex=DATASET, rh=["ETag"],
   desc="Owner only; status `draft` or `changes_requested`.", val=["as DatasetCreate; all fields optional"], err=["dataset.not_editable"])
ep("DELETE", "/datasets/{dataset_id}", "Datasets", "Delete a draft or withdrawn dataset", perm="dataset.create", ok=204,
   desc="Owner only; status `draft` or `withdrawn` and never finalized. Aborts open upload sessions, soft-deletes rows, objects purged by `retention.purge` after 30 days (A-15).",
   err=["dataset.invalid_state"])
ep("POST", "/datasets/{dataset_id}/submit", "Datasets", "Submit for review", perm="dataset.create", resp="Dataset", rex=dict(DATASET, status="submitted", submitted_at=T2, version=5),
   desc="`draft|changes_requested → submitted`. Preconditions: no open upload sessions; every file terminal (`ready|failed|quarantined`); ≥ 1 `ready`; metadata valid. Resubmission after `changes_requested` creates a new `dataset_versions` row (version_number+1) and snapshots the file list. Owner is notified (`dataset_received`).",
   err=["dataset.invalid_state", "dataset.files_not_terminal", "dataset.no_ready_files"])
ep("POST", "/datasets/{dataset_id}/withdraw", "Datasets", "Withdraw a dataset", perm="dataset.create", resp="Dataset", rex=dict(DATASET, status="withdrawn"),
   desc="`draft|submitted|changes_requested → withdrawn` (not once claimed: `in_review`). Owner only.", err=["dataset.invalid_state"])
ep("GET", "/datasets/{dataset_id}/files", "Datasets", "List files of a dataset", perm="dataset.read.own", paged=True, sort=["created_at", "original_filename", "size_bytes"],
   resp="PaginatedDatasetFile", rex=page([FILE]),
   q=[q("processing_status", {"$ref": "#/components/schemas/FileProcessingStatus"}, "Filter."), q("include_members", BOOL, "Include ZIP members (default true)."),
      q("parent_file_id", UUID, "Only members of this archive."), q("has_duplicates", BOOL, "Only files with duplicate flags.")],
   desc="Same visibility as GET dataset. Contributors see duplicate flags without the other owner's ids.")
ep("DELETE", "/datasets/{dataset_id}/files/{file_id}", "Datasets", "Remove a file from a dataset", perm="dataset.create", ok=204,
   desc="Owner; dataset `draft` or `changes_requested`. Removing an archive removes its members. Object deleted asynchronously.", err=["dataset.not_editable"])
ep("GET", "/datasets/{dataset_id}/reviews", "Datasets", "Review feedback for my dataset", perm="dataset.read.own", resp="ReviewFeedbackList",
   rex={"items": [{"review_id": RV, "dataset_version_number": 1, "decision": "partial", "feedback": "Page scans 13–20 are illegible.", "finalized_at": T2, "accepted_bytes": 367001600, "rejected_bytes": 367001600, "earned_micros": 367001,
                   "file_decisions": [{"file_id": F2, "original_filename": "pp-1994-04.pdf", "decision": "rejected", "reason_code": "illegible", "comment": "Too faded."}]}]},
   desc="Finalized reviews only, contributor-safe projection (no reviewer identity, no internal comments).")
ep("GET", "/datasets/{dataset_id}/estimate", "Datasets", "Estimated earnings for a dataset", perm="dataset.read.own", resp="DatasetEstimate",
   rex={"dataset_id": DS, "is_estimate": True, "data_class": "raw", "rate_micros_per_gb": 1000000, "eligible_bytes": 734003200, "excluded_bytes": 0,
        "excluded_breakdown": {"duplicates_bytes": 0, "failed_or_quarantined_bytes": 0, "containers_bytes": 0, "processing_bytes": 0}, "estimated_micros": 734003, "computed_at": T2},
   desc="Σ bytes of ready+clean, non-exact-duplicate, non-container files × current rate for the declared data_class (§8.6). Not a ledger figure; final amount set at review.")

# ============================ FILES ============================
ep("GET", "/files/{file_id}", "Files", "File metadata and previews", resp="DatasetFile", rex=FILE,
   desc="Visible to: dataset owner; reviewer with an in-progress/finalized review of the dataset; annotator with an active assignment on a task for this file; `dataset.read.any`. Otherwise 404.")
ep("GET", "/files/{file_id}/preview/{page}", "Files", "Redirect to a page preview image", ok=302, resp=None, rh=["Location"], rl="download",
   desc="302 to a presigned GET (5 min) of `datasets/{dataset_id}/files/{file_id}/previews/page-{n}.webp` with `response-content-type=image/webp` and `Cache-Control: private, max-age=300`. Same visibility as GET file. Preview of quarantined/infected files is never served.",
   err=["file.not_ready", "file.no_preview", "file.unavailable"])
ep("GET", "/files/{file_id}/text", "Files", "Extracted text (first 1 MB)", resp="FileText",
   rex={"file_id": F1, "text": "ព័ត៌មានថ្ងៃនេះ ...", "truncated": True, "source": "extracted", "char_count": 1048576},
   desc="UTF-8 text produced by processing (docx/odt/rtf/txt/csv/json/xml/xlsx). Returned as JSON string — the client renders it as text, never HTML.",
   err=["file.not_ready", "file.no_preview", "file.unavailable"])
ep("POST", "/files/{file_id}/download-url", "Files", "Presigned download URL for the original", body="DownloadUrlRequest", resp="PresignedUrl", rl="download",
   req={"reason": "Checking page 12"}, rex={"url": "https://s3.datahub.example/datahub-private/datasets/01930b71-2222-7b00-8000-0000000000d1/files/01930b72-3333-7c00-8000-0000000000f1/original?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300&response-content-disposition=attachment%3B%20filename%3D%22phnom-penh-post-1994-03.pdf%22&X-Amz-Signature=…", "expires_at": "2026-10-26T08:35:00Z", "method": "GET"},
   desc="Presigned GET valid 5 minutes with `response-content-disposition=attachment; filename*=UTF-8''<sanitised original name>` and `response-content-type` forced to the detected MIME (or application/octet-stream). Audited (`file.download_url`). Same visibility as GET file; annotators may download only if the project allows (default: preview only).",
   err=["file.not_ready", "file.unavailable"])

# ============================ UPLOADS ============================
ep("POST", "/datasets/{dataset_id}/uploads", "Uploads", "Initiate a resumable multipart upload", perm="dataset.create", body="UploadInitRequest", ok=201, resp="UploadSession",
   req={"filename": "scans-1995.zip", "size_bytes": 1073741824, "content_type": "application/zip", "relative_path": "archive/scans-1995.zip", "last_modified": "2026-09-01T10:00:00Z"},
   rex=dict(UPLOAD, status="initiated", uploaded_parts=[], uploaded_bytes=0), rl="upload", onb=True,
   desc="Owner; dataset `draft|changes_requested`. Checks extension allow-list (advisory), file/dataset/quota limits (sizes counted from declared size and re-checked on complete), creates `dataset_files` (`pending_upload`) and `upload_sessions` (`initiated`, expires 24 h), calls S3 CreateMultipartUpload on key `datasets/{dataset_id}/files/{file_id}/original`. part_size = max(16 MiB, ceil(size/10000) rounded up to 1 MiB).",
   val=["filename 1–255 chars after sanitisation (NFC, strip path, control chars, leading dots); stored as metadata only", "size_bytes 1 … max_file_bytes", "extension allowed (or in extra_allowed_extensions)"],
   err=["dataset.not_editable", "dataset.file_limit_exceeded", "upload.file_too_large", "upload.dataset_too_large", "upload.quota_exceeded", "upload.type_not_allowed", "upload.storage_unavailable", "auth.onboarding_required"])
ep("POST", "/uploads/{upload_id}/part-urls", "Uploads", "Presign part upload URLs", perm="dataset.create", body="PartUrlsRequest", resp="PartUrlsResponse", rl="upload",
   req={"part_numbers": [2, 3, 4, 5]}, rex={"urls": [{"part_number": 2, "url": "https://s3.datahub.example/datahub-private/datasets/…/original?partNumber=2&uploadId=…&X-Amz-Expires=900&X-Amz-Signature=…"}], "expires_at": "2026-10-26T08:45:00Z"},
   desc="Up to 100 presigned UploadPart PUT URLs, valid 15 minutes, signed for the **public** S3 endpoint host (`S3_PUBLIC_ENDPOINT`). First call moves the session `initiated → uploading`. Each URL is bound to the exact key, uploadId and partNumber; Content-Length is enforced by S3 against the signed payload size where supported.",
   val=["1–100 distinct part numbers within 1…part_count"], err=["upload.invalid_state", "upload.expired", "upload.part_number_invalid", "upload.storage_unavailable"])
ep("GET", "/uploads/{upload_id}", "Uploads", "Upload status and uploaded parts (resume)", perm="dataset.create", resp="UploadSession", rex=UPLOAD, rl="upload",
   desc="Authoritative list of uploaded parts from S3 ListParts (paginated server-side), so a client can resume after reload using the `upload_id` it kept in localStorage.",
   err=["upload.storage_unavailable"])
ep("POST", "/uploads/{upload_id}/complete", "Uploads", "Complete the multipart upload", perm="dataset.create", body="UploadCompleteRequest", ok=202, resp="DatasetFile", rl="upload",
   req={"parts": [{"part_number": 1, "etag": "\"a54357aff0632cce46d942af68356b38\""}, {"part_number": 2, "etag": "\"0c78aef83f66abc1fa1e8477f296d394\""}]},
   rex=dict(FILE, id=F2, original_filename="scans-1995.zip", extension="zip", processing_status="uploaded", scan_status="pending", sha256=None, previews=[], duplicates=[], page_count=None, is_container=True),
   desc="Verifies the client list against ListParts (all parts 1…N present, ETags equal, Σ sizes = size_bytes), calls CompleteMultipartUpload, HeadObject to confirm size, sets file `uploaded`, session `completed`, and enqueues `processing.process_file`. Idempotent: repeating on a completed session returns the same file with 202.",
   err=["upload.invalid_state", "upload.expired", "upload.parts_mismatch", "upload.file_too_large", "upload.dataset_too_large", "upload.quota_exceeded", "dataset.not_editable", "upload.storage_unavailable"])
ep("DELETE", "/uploads/{upload_id}", "Uploads", "Abort an upload", perm="dataset.create", ok=204, rl="upload",
   desc="AbortMultipartUpload, session `aborted`, file row deleted. Idempotent for already aborted/expired sessions.", err=["upload.invalid_state"])

# ============================ REVIEW ============================
ep("GET", "/reviews/queue", "Review", "Datasets awaiting review", perm="dataset.review", paged=True, sort=["submitted_at", "total_bytes"], resp="PaginatedReviewQueueItem",
   rex=page([{"dataset_id": DS, "title": DATASET["title"], "owner_display_name": "Sophea K.", "data_class": "raw", "category": "news", "languages": ["km"], "file_count": 2, "total_bytes": 734003200, "submitted_at": T2, "version_number": 1, "has_duplicate_flags": True, "contains_personal_data": False, "status": "submitted", "claimed_review_id": None}]),
   q=[q("status", en("submitted", "in_review"), "Default submitted."), q("data_class", {"$ref": "#/components/schemas/DataClass"}, "Filter."), q("category", {"$ref": "#/components/schemas/DatasetCategory"}, "Filter."),
      q("language", s(maxl=3), "Filter."), q("mine", BOOL, "Only reviews claimed by me.")],
   desc="FIFO by submitted_at by default. Excludes the caller's own datasets (separation of duties).")
ep("POST", "/datasets/{dataset_id}/claim-review", "Review", "Claim a submitted dataset for review", perm="dataset.review", ok=201, resp="Review", rex=REVIEW,
   desc="`submitted → in_review`; creates `dataset_reviews` (`in_progress`) with the caller as assignee. Uses `SELECT … FOR UPDATE SKIP LOCKED`-style guard; a concurrent claim gets 409. Owner cannot claim.",
   err=["review.already_claimed", "dataset.invalid_state", "permission.separation_of_duties"])
ep("GET", "/reviews/{review_id}", "Review", "Review workspace data", perm="dataset.review", resp="ReviewDetail",
   rex={"review": REVIEW, "dataset": dict(DATASET, status="in_review"), "files": [FILE], "file_reviews": [FILE_REVIEW], "summary": SUMMARY, "history": []},
   desc="Assignee reviewer, or `dataset.read.any`. Includes duplicate matches with matched ids, previous versions' finalized reviews (`history`).")
ep("PUT", "/reviews/{review_id}/files/{file_id}", "Review", "Set decision for one file", perm="dataset.review", body="FileReviewInput", resp="FileReview",
   req={"decision": "rejected", "reason_code": "illegible", "comment": "Pages 13–20 too faded to read.", "labeled_upgrade": False},
   rex=dict(FILE_REVIEW, decision="rejected", reason_code="illegible", comment="Pages 13–20 too faded to read."),
   desc="Upsert on (review_id, file_id). Assignee only; review `in_progress`.",
   val=["reason_code required when rejected", "labeled_upgrade only when dataset data_class=labeled, file sha256 previously paid at raw rate, HA-08 setting on", "file must be reviewable (ready, clean, not container)"],
   err=["review.not_assignee", "review.invalid_state", "review.reason_required", "review.file_not_reviewable", "review.labeled_upgrade_not_applicable"])
ep("POST", "/reviews/{review_id}/files/bulk", "Review", "Set decision for many files", perm="dataset.review", body="FileReviewBulk", resp="FileReviewBulkResult",
   req={"file_ids": [F1, F2], "decision": "accepted"}, rex={"updated": 2, "skipped": []},
   desc="Same rules as single; non-reviewable files are skipped with a code instead of failing the batch.",
   err=["review.not_assignee", "review.invalid_state", "review.reason_required"])
ep("PATCH", "/reviews/{review_id}", "Review", "Update checklist, scores, comments, data class", perm="dataset.review", body="ReviewUpdate", resp="Review", ifm="optional",
   req={"checklist": {"no_copyright_concern": True}, "quality_scores": {"accuracy": 4}, "feedback": "Good scans overall."}, rex=REVIEW, rh=["ETag"],
   desc="Assignee; partial merge into checklist/quality_scores; overall_quality recomputed as mean of non-null scores.", err=["review.not_assignee", "review.invalid_state"])
ep("GET", "/reviews/{review_id}/summary", "Review", "Accepted/rejected sizes and payable amount", perm="dataset.review", resp="ReviewSummary", rex=SUMMARY,
   desc="Computed live from file decisions with the pricing rule in force now; `allowed_decisions` drives the finalize dialog.")
ep("POST", "/reviews/{review_id}/finalize", "Review", "Finalize the review (creates earnings)", perm="dataset.review", body="FinalizeRequest", resp="FinalizeResult", idem="optional",
   req={"decision": "partial", "feedback": "Pages 13–20 are illegible; the rest is excellent.", "data_class": "raw"},
   rex={"review": dict(REVIEW, status="finalized", decision="partial", finalized_at=T2), "dataset_status": "partially_approved", "earning": {"journal_id": J1, "amount_micros": 367001, "records": 1, "credited_bucket": "available"}},
   desc="One DB transaction: lock review + dataset rows, validate consistency, set review `finalized`, dataset → `approved|partially_approved|rejected|changes_requested`, and for approve/partial write `earning_records` per payable file (§8.2–8.4, pricing rule pinned) plus one `dataset_earning` journal with idempotency key `dataset_review:{review_id}:earning`. Retries return the same result. Notifies owner (in-app + email).",
   val=["all reviewable files decided (except request_changes)", "approve ⇒ 0 rejected; partial ⇒ ≥1 accepted and ≥1 rejected; reject ⇒ 0 accepted", "feedback ≥ 10 chars unless approve"],
   err=["review.not_assignee", "review.invalid_state", "review.incomplete", "review.decision_inconsistent", "review.feedback_required"])
ep("POST", "/reviews/{review_id}/release", "Review", "Release (unclaim) a review", perm="dataset.review", resp="Review", rex=dict(REVIEW, status="released", released_at=T2),
   desc="Assignee or admin. Review → `released`, dataset `in_review → submitted`; file decisions are kept on the released review for history but not carried over.", err=["review.not_assignee", "review.invalid_state"])
ep("GET", "/reviews/history", "Review", "My past reviews", perm="dataset.review", paged=True, sort=["finalized_at", "claimed_at"], resp="PaginatedReview", rex=page([dict(REVIEW, status="finalized", decision="partial")]),
   q=[q("decision", {"$ref": "#/components/schemas/ReviewDecision"}, "Filter."), DFROM, DTO, q("reviewer_id", UUID, "Admins only: another reviewer.")])

# ============================ FINANCE (user) ============================
ep("GET", "/wallet", "Finance", "My balances", perm="payout.request", resp="Wallet", rex=WALLET,
   desc="Ledger-derived buckets (cached columns, reconciled nightly) plus the non-ledger estimate (§8.6). Reviewers without payout.request get 403.")
ep("GET", "/wallet/transactions", "Finance", "My ledger lines", perm="payout.request", paged=True, sort=["created_at"], resp="PaginatedLedgerLine", rex=page([LEDGER_LINE]),
   q=[q("kind", {"$ref": "#/components/schemas/JournalKind"}, "Filter."), q("bucket", {"$ref": "#/components/schemas/LedgerBucket"}, "Filter."), DFROM, DTO])
ep("GET", "/earnings", "Finance", "My earning records", perm="payout.request", paged=True, sort=["created_at", "amount_micros"], resp="PaginatedEarningRecord", rex=page([EARNING]),
   q=[q("dataset_id", UUID, "Filter."), q("source_type", en("dataset_review", "annotation_review"), "Filter."), DFROM, DTO])
ep("POST", "/payouts", "Finance", "Request a withdrawal", perm="payout.request", body="PayoutCreate", ok=201, resp="Payout", idem="required", rl="payout_request",
   req={"amount_micros": 10000000, "payout_method_id": PM, "note": None}, rex=PAYOUT, rh=["Location"],
   desc="Transaction: lock wallet row `FOR UPDATE`, check §8.7 rules after the lock, insert `payout_requests` (`requested`, approvals_required = 2 if amount ≥ threshold else 1, method snapshot), write `payout_reserve` journal (`payout:{id}:reserve`). The partial unique index guarantees one open payout per user even under races. `Idempotency-Key` is **required** and stored per user.",
   val=["amount multiple of 10,000 micros (whole cents)", "payout_min_micros ≤ amount ≤ payout_max_micros", "amount ≤ available", "verification approved, account active", "method owned by caller"],
   err=["payout.insufficient_balance", "payout.open_request_exists", "payout.amount_below_minimum", "payout.amount_above_maximum", "payout.amount_not_whole_cents", "payout.verification_required", "payout.method_invalid"])
ep("GET", "/payouts", "Finance", "My payouts", perm="payout.request", paged=True, sort=["created_at", "amount_micros"], resp="PaginatedPayout", rex=page([PAYOUT]),
   q=[q("status", {"$ref": "#/components/schemas/PayoutStatus"}, "Filter.")])
ep("GET", "/payouts/{payout_id}", "Finance", "One of my payouts", perm="payout.request", resp="Payout", rex=PAYOUT_PAID,
   desc="Owner only (admins use /admin/payouts/{id}). Proof file metadata visible; approver identities shown as 'DataHub finance'.")
ep("POST", "/payouts/{payout_id}/cancel", "Finance", "Cancel my pending withdrawal", perm="payout.request", resp="Payout", idem="optional",
   rex=dict(PAYOUT, status="cancelled", cancellation_reason="Cancelled by contributor", version=2),
   desc="`requested → cancelled` only (approved payouts can be cancelled by admins). Writes `payout_release` journal.", err=["payout.invalid_state"])

# ============================ FINANCE (admin) ============================
ep("GET", "/admin/finance/overview", "Admin finance", "Finance dashboard figures", perm="finance.read", admin=True, resp="FinanceOverview",
   rex={"currency": "USD", "liabilities": {"pending_micros": 0, "available_micros": 812440120, "reserved_micros": 45000000}, "paid_lifetime_micros": 2330000000,
        "paid_this_month_micros": 410000000, "earned_this_month_micros": 530120000, "open_payouts": {"requested_count": 4, "requested_micros": 45000000, "approved_count": 1, "approved_micros": 10000000, "awaiting_second_approval_count": 1},
        "last_reconciliation": {"run_at": "2026-10-26T00:10:00Z", "status": "ok"}})
ep("GET", "/admin/payouts", "Admin finance", "Payout requests", perm="finance.read", admin=True, paged=True, sort=["created_at", "amount_micros", "updated_at"], resp="PaginatedPayout", rex=page([PAYOUT]),
   q=[q("status", {"$ref": "#/components/schemas/PayoutStatus"}, "Filter (repeatable)."), q("user_id", UUID, "Filter."), q("method", {"$ref": "#/components/schemas/PayoutMethodType"}, "Filter."),
      q("min_amount_micros", {"type": "integer", "minimum": 0}, "Filter."), q("max_amount_micros", {"type": "integer", "minimum": 0}, "Filter."), DFROM, DTO])
ep("GET", "/admin/payouts/{payout_id}", "Admin finance", "Payout detail (full method details)", perm="finance.read", admin=True, resp="Payout",
   rex=dict(PAYOUT, payout_method=dict(PAYOUT["payout_method"], details={"account_name": "KEO SOPHEA", "account_number": "000124821"})),
   desc="Unmasked payout-method details only for `payout.approve` holders; access is audited (`payout.view_details`).")
ep("POST", "/admin/payouts/{payout_id}/approve", "Admin finance", "Approve a payout", perm="payout.approve", admin=True, step=True, idem="optional", body="ApproveRequest", resp="Payout",
   req={"comment": "Verified bank details."}, rex=dict(PAYOUT, status="approved", approvals=[APPROVAL], version=2),
   desc="Inserts `payout_approvals` (unique per approver). When approvals = approvals_required, status `requested → approved`; otherwise stays `requested`. Approver ≠ recipient; second approver ≠ first.",
   err=["payout.invalid_state", "payout.already_approved_by_you", "permission.separation_of_duties"])
ep("POST", "/admin/payouts/{payout_id}/reject", "Admin finance", "Reject a payout", perm="payout.approve", admin=True, step=True, idem="optional", body="ReasonRequest", resp="Payout",
   req={"reason": "Account name does not match verified legal name."}, rex=dict(PAYOUT, status="rejected", rejection_reason="Account name does not match verified legal name.", version=2),
   desc="`requested → rejected`, `payout_release` journal returns funds to available; contributor notified with the reason.", err=["payout.invalid_state", "permission.separation_of_duties"])
ep("POST", "/admin/payouts/{payout_id}/mark-paid", "Admin finance", "Record the external payment", perm="payout.record_payment", admin=True, step=True, idem="optional", body="MarkPaidRequest", resp="Payout",
   req={"payment_reference": "ABA-20261027-558812", "paid_at": "2026-10-27T01:55:00Z", "notes": None}, rex=PAYOUT_PAID,
   desc="Only after the admin has actually sent money outside DataHub. `approved → paid`; inserts `payout_records` and `payout_settle` journal (`payout:{id}:settle`). Recorder ≠ recipient. Proof may be attached before or after via `/proof`.",
   val=["payment_reference 3–120 chars, unique per method", "paid_at ≥ approval time and ≤ now + 5 min"],
   err=["payout.invalid_state", "payout.reference_duplicate", "payout.paid_at_invalid", "permission.separation_of_duties"])
ep("POST", "/admin/payouts/{payout_id}/mark-failed", "Admin finance", "Mark an approved payout as failed", perm="payout.record_payment", admin=True, step=True, idem="optional", body="ReasonRequest", resp="Payout",
   req={"reason": "Bank rejected transfer: account closed."}, rex=dict(PAYOUT, status="failed", failure_reason="Bank rejected transfer: account closed.", version=3),
   desc="`approved → failed` (transfer attempt failed before settlement); `payout_release` journal.", err=["payout.invalid_state", "permission.separation_of_duties"])
ep("POST", "/admin/payouts/{payout_id}/cancel", "Admin finance", "Cancel an approved payout", perm="payout.approve", admin=True, step=True, idem="optional", body="ReasonRequest", resp="Payout",
   req={"reason": "Contributor asked to change method."}, rex=dict(PAYOUT, status="cancelled", cancellation_reason="Contributor asked to change method.", version=3),
   desc="`approved → cancelled`; `payout_release` journal.", err=["payout.invalid_state"])
ep("POST", "/admin/payouts/{payout_id}/reverse", "Admin finance", "Reverse a paid payout (super_admin)", perm="finance.adjust", admin=True, step=True, idem="optional", body="ReasonRequest", resp="Payout",
   req={"reason": "Transfer bounced on 2026-10-29, bank ref R-7781."}, rex=dict(PAYOUT_PAID, status="reversed", reversal_reason="Transfer bounced on 2026-10-29, bank ref R-7781.", version=4),
   desc="`paid → reversed`; `payout_reversal` journal moves amount from `paid` back to `available`. super_admin only; actor ≠ recipient.", err=["payout.invalid_state", "permission.separation_of_duties"])
ep("POST", "/admin/payouts/{payout_id}/proof", "Admin finance", "Upload payment proof", perm="payout.record_payment", admin=True, body="AttachmentUpload", ct="multipart", ok=201, resp="PayoutRecord", rl="upload",
   req={"file": "<binary aba-receipt.pdf>"}, rex=dict(PAYOUT_PAID["record"], proof={"filename": "aba-receipt.pdf", "size_bytes": 84211, "content_type": "application/pdf", "uploaded_at": T2}),
   desc="multipart/form-data, PDF/PNG/JPEG ≤ 10 MB (magic bytes), ClamAV scanned, stored at `payouts/{payout_id}/proof/{attachment_id}`. Allowed while status `approved` (staged, attached on mark-paid) or `paid`. Replacing keeps the previous object (audited).",
   err=["payout.invalid_state", "payout.proof_invalid", "message.attachment_too_large"])
ep("POST", "/admin/adjustments", "Admin finance", "Manual ledger adjustment (super_admin)", perm="finance.adjust", admin=True, step=True, idem="optional", body="AdjustmentCreate", ok=201, resp="Adjustment",
   req={"user_id": U_CON, "direction": "credit", "amount_micros": 500000, "reason_code": "correction", "reason": "Rate rounding correction for dataset v1 (ticket #42)."}, rex=ADJUSTMENT,
   desc="Writes `payout_adjustments` + `adjustment_credit|adjustment_debit` journal (`adjustment:{id}`). Debits cannot drive available below 0. Actor ≠ target user. Never edits existing ledger lines.",
   err=["finance.adjustment_negative_balance", "permission.separation_of_duties"])
ep("GET", "/admin/ledger", "Admin finance", "Ledger lines (all wallets)", perm="finance.read", admin=True, paged=True, sort=["created_at"], resp="PaginatedLedgerLine", rex=page([LEDGER_LINE]),
   q=[q("user_id", UUID, "Filter."), q("wallet_id", UUID, "Filter."), q("journal_id", UUID, "Filter."), q("kind", {"$ref": "#/components/schemas/JournalKind"}, "Filter."), DFROM, DTO])
ep("GET", "/pricing-rules", "Admin finance", "Pricing rule history", perm="finance.read", admin=True, resp="PricingRuleList",
   rex={"items": [PRICING, dict(PRICING, id="01930b7b-cccc-7500-8000-000000000603", data_class="labeled", rate_micros_per_gb=1500000)]},
   desc="All rules, past, current and scheduled. Path is outside /admin per baseline §12 but requires admin MFA like other admin reads.")
ep("POST", "/admin/pricing-rules", "Admin finance", "Schedule a new rate (super_admin)", perm="pricing.manage", admin=True, step=True, idem="optional", body="PricingRuleCreate", ok=201, resp="PricingRule",
   req={"data_class": "labeled", "rate_micros_per_gb": 1750000, "effective_from": "2027-01-01T00:00:00Z", "note": "Owner-approved rate change (HA-06)."},
   rex=dict(PRICING, data_class="labeled", rate_micros_per_gb=1750000, effective_from="2027-01-01T00:00:00Z", note="Owner-approved rate change (HA-06)."),
   desc="Closes the previous open rule at effective_from (sets effective_to) and inserts the new one; rules are never edited. Reviews finalized after effective_from use the new rate.",
   err=["pricing.overlap", "pricing.effective_from_in_past"])
ep("GET", "/admin/finance/reconciliation", "Admin finance", "Latest ledger reconciliation result", perm="finance.read", admin=True, resp="Reconciliation",
   rex={"run_at": "2026-10-26T00:10:00Z", "status": "ok", "wallets_checked": 1843, "journal_imbalances": 0, "mismatches": []})

# ============================ ANNOTATION ============================
TASK_Q = [q("status", {"$ref": "#/components/schemas/AnnotationTaskStatus"}, "Filter (repeatable)."), q("assignee_id", UUID, "Filter."), q("dataset_id", UUID, "Filter."), q("overdue", BOOL, "due_at < now and not approved.")]
ep("GET", "/annotation/projects", "Annotation", "List annotation projects", perm="annotation.manage", admin=True, paged=True, sort=["created_at", "name", "deadline"], resp="PaginatedAnnotationProject", rex=page([PROJECT]),
   q=[q("status", {"$ref": "#/components/schemas/AnnotationProjectStatus"}, "Filter."), QTEXT])
ep("POST", "/annotation/projects", "Annotation", "Create an annotation project", perm="annotation.manage", admin=True, body="AnnotationProjectCreate", ok=201, resp="AnnotationProject",
   req={k: PROJECT[k] for k in ["name", "instructions", "annotation_types", "label_set", "metadata_schema", "task_unit", "reward_per_task_micros", "reward_per_page_micros", "deadline", "dataset_ids"]},
   rex=dict(PROJECT, progress={k: 0 for k in PROGRESS}), rh=["Location"],
   val=["annotation_types ⊆ v1 types (bbox rejected)", "label_set required when classification selected", "metadata_schema required when metadata selected; select fields need ≥1 option; keys unique", "reward_per_task_micros + reward_per_page_micros > 0", "datasets approved/partially_approved"],
   err=["annotation.dataset_ineligible"])
ep("GET", "/annotation/projects/{project_id}", "Annotation", "Project detail with progress", perm="annotation.manage", admin=True, resp="AnnotationProject", rex=PROJECT, rh=["ETag"])
ep("PATCH", "/annotation/projects/{project_id}", "Annotation", "Update a project", perm="annotation.manage", admin=True, body="AnnotationProjectUpdate", resp="AnnotationProject", ifm="optional",
   req={"deadline": "2026-12-31T00:00:00Z", "instructions": "Updated: mark illegible words with [?]."}, rex=PROJECT, rh=["ETag"],
   err=["annotation.project_closed", "annotation.immutable_field", "annotation.dataset_ineligible"])
ep("POST", "/annotation/projects/{project_id}/generate-tasks", "Annotation", "Split source files into tasks", perm="annotation.manage", admin=True, body="GenerateTasksRequest", resp="GenerateTasksResult",
   req={"dataset_ids": [DS], "dry_run": False}, rex={"created": 96, "skipped_existing": 24, "skipped_ineligible": 3, "dry_run": False},
   desc="One task per accepted, annotatable file (task_unit=file) or per page (task_unit=page, pages from page_count). Unique (project_id, file_id, page_number) makes it idempotent. Ineligible: rejected, non-annotatable formats (§7), failed/quarantined.",
   err=["annotation.project_closed"])
ep("POST", "/annotation/projects/{project_id}/close", "Annotation", "Close a project", perm="annotation.manage", admin=True, resp="AnnotationProject",
   rex=dict(PROJECT, status="closed", closed_at=T2), desc="All non-approved tasks → `cancelled`; annotators notified; approved rewards unaffected.", err=["annotation.project_closed"])
ep("GET", "/annotation/projects/{project_id}/tasks", "Annotation", "Tasks of a project", perm="annotation.manage", admin=True, paged=True, sort=["created_at", "due_at", "status"], resp="PaginatedAnnotationTask", rex=page([TASK]), q=TASK_Q)
ep("POST", "/annotation/tasks/{task_id}/assign", "Annotation", "Assign (or reassign) a task", perm="annotation.manage", admin=True, body="AssignRequest", resp="AnnotationTask",
   req={"annotator_id": U_ANN, "due_at": "2026-11-05T00:00:00Z"}, rex=dict(TASK, status="assigned", annotation_version=None),
   desc="Task `unassigned → assigned` (or reassigns an `assigned|in_progress` task: old assignment ended, draft kept). Annotator must hold `annotator`, be active and verification `approved` (A-08). Notifies annotator.",
   err=["annotation.invalid_state", "annotation.annotator_ineligible", "annotation.project_closed"])
ep("POST", "/annotation/tasks/bulk-assign", "Annotation", "Assign many tasks", perm="annotation.manage", admin=True, body="BulkAssignRequest", resp="BulkAssignResult",
   req={"assignments": [{"task_id": TK, "annotator_id": U_ANN}], "due_at": "2026-11-05T00:00:00Z"}, rex={"assigned": 1, "failed": []},
   desc="≤ 500 per call; each item validated independently; failures reported per task.", err=["annotation.project_closed"])
ep("POST", "/annotation/tasks/{task_id}/unassign", "Annotation", "Unassign a task", perm="annotation.manage", admin=True, resp="AnnotationTask", rex=dict(TASK, status="unassigned", assignee_id=None, assignee_name=None),
   desc="`assigned|in_progress → unassigned`; draft preserved for the next assignee.", err=["annotation.invalid_state"])
ep("GET", "/annotation/my-tasks", "Annotation", "My assigned tasks", perm="annotation.work", paged=True, sort=["due_at", "created_at", "status"], resp="PaginatedAnnotationTask", rex=page([TASK]),
   q=[q("status", {"$ref": "#/components/schemas/AnnotationTaskStatus"}, "Filter (repeatable)."), q("project_id", UUID, "Filter.")])
ep("GET", "/annotation/tasks/{task_id}", "Annotation", "Task workspace data", resp="AnnotationTaskDetail",
   rex={"task": TASK, "project": {k: PROJECT[k] for k in ["id", "name", "instructions", "annotation_types", "label_set", "metadata_schema"]}, "file": FILE, "annotation": ANNOTATION, "reviews": []},
   perm="annotation.work | annotation.review | annotation.manage",
   desc="Active assignee; reviewer who claimed the task (or browsing `annotation.review` queue items in `submitted`); `annotation.manage`. Others 404.", rh=["ETag"])
ep("POST", "/annotation/tasks/{task_id}/start", "Annotation", "Start working on a task", perm="annotation.work", resp="AnnotationTaskDetail",
   rex={"task": dict(TASK, status="in_progress"), "project": {k: PROJECT[k] for k in ["id", "name", "instructions", "annotation_types", "label_set", "metadata_schema"]}, "file": FILE, "annotation": dict(ANNOTATION, version=0), "reviews": []},
   desc="`assigned|changes_requested → in_progress`; creates the `annotations` row (version 0) if absent. Idempotent when already in_progress.", err=["annotation.not_assignee", "annotation.invalid_state", "annotation.project_closed"])
ep("PUT", "/annotation/tasks/{task_id}/draft", "Annotation", "Autosave draft (optimistic locking)", perm="annotation.work", body="DraftRequest", resp="DraftSaved", ifm="required", rl="autosave",
   req={"data": ANN_DATA}, rex={"version": 8, "content_sha256": SHA, "version_created": True, "saved_at": T2}, rh=["ETag"],
   desc="`If-Match: <version>` required (bare integer or quoted ETag). Atomic `UPDATE annotations SET … version=version+1 WHERE task_id=:id AND version=:v`; 0 rows → 409 `annotation.version_conflict` with `details.server_annotation`. Inserts an `annotation_versions` row only when content hash changes (keep last 50 drafts). Transcription stored verbatim (no NFC).",
   val=["structure per AnnotationData", "pages within file page range; one entry per page", "classification labels ∈ label_set", "metadata keys ∈ metadata_schema with matching types (required-ness checked at submit)", "regions must be empty (bbox reserved)", "body ≤ 2 MiB"],
   err=["annotation.version_conflict", "annotation.not_assignee", "annotation.invalid_state", "annotation.validation_failed", "precondition.required"])
ep("POST", "/annotation/tasks/{task_id}/submit", "Annotation", "Submit annotation for review", perm="annotation.work", body="SubmitAnnotationRequest", resp="AnnotationTask", ifm="optional",
   req={"version": 8}, rex=dict(TASK, status="submitted", submitted_at=T2, annotation_version=8),
   desc="`in_progress → submitted`; full validation (required metadata, every page has transcription/correction when those types are selected); records a `submitted` annotation_version. Version must equal current (409 otherwise).",
   err=["annotation.version_conflict", "annotation.not_assignee", "annotation.invalid_state", "annotation.validation_failed"])
ep("GET", "/annotation/tasks/{task_id}/versions", "Annotation", "Annotation version history", perm="annotation.work | annotation.review | annotation.manage", paged=True, sort=["version"], resp="PaginatedAnnotationVersion", rex=page([ANN_VERSION]),
   q=[q("kind", en("draft", "submitted"), "Filter.")], desc="Same visibility as GET task. Used for diff/compare in reviewer and draft recovery in the editor.")
ep("GET", "/annotation/my-rewards", "Annotation", "My annotation rewards", perm="annotation.work", paged=True, sort=["created_at", "amount_micros"], resp="PaginatedRewardWithTotals",
   rex=dict(page([REWARD]), totals={"approved_count": 1, "total_micros": 150000, "pending_review_count": 2}), q=[q("project_id", UUID, "Filter."), DFROM, DTO])
ep("GET", "/annotation/review-queue", "Annotation", "Submitted annotations awaiting review", perm="annotation.review", paged=True, sort=["submitted_at"], resp="PaginatedAnnotationTask", rex=page([dict(TASK, status="submitted")]),
   q=[q("project_id", UUID, "Filter."), q("mine", BOOL, "Only tasks I claimed (in_review).")], desc="Excludes tasks the caller annotated (separation of duties).")
ep("POST", "/annotation/tasks/{task_id}/claim-review", "Annotation", "Claim a submitted annotation for review", perm="annotation.review", ok=201, resp="AnnotationReview",
   rex=dict(ANN_REVIEW, decision=None, score=None, comments=None, decided_at=None), desc="`submitted → in_review`; creates `annotation_reviews` row for the current submitted version.",
   err=["annotation.already_claimed", "annotation.invalid_state", "permission.separation_of_duties"])
ep("POST", "/annotation/tasks/{task_id}/review", "Annotation", "Approve or request changes", perm="annotation.review", body="AnnotationReviewRequest", resp="AnnotationReviewResult", idem="optional",
   req={"decision": "approve", "score": 5, "comments": "Accurate.", "page_comments": []}, rex={"task": dict(TASK, status="approved", approved_at="2026-10-26T10:00:00Z"), "review": ANN_REVIEW, "reward": REWARD},
   desc="Claimant only. approve: `in_review → approved`, inserts `annotation_rewards` (unique per review) and `annotation_reward` journal (`annotation_review:{review_id}:reward`); amount = reward_per_task + reward_per_page × pages. request_changes: `in_review → changes_requested`, annotator notified.",
   err=["annotation.invalid_state", "annotation.comments_required", "permission.separation_of_duties", "permission.denied"])
ep("GET", "/annotation/reviews/history", "Annotation", "My annotation reviews", perm="annotation.review", paged=True, sort=["decided_at"], resp="PaginatedAnnotationReview", rex=page([ANN_REVIEW]),
   q=[q("project_id", UUID, "Filter."), q("decision", {"$ref": "#/components/schemas/AnnotationReviewDecision"}, "Filter."), DFROM, DTO])

# ============================ MESSAGING ============================
ep("GET", "/conversations", "Messaging", "List conversations", perm="message.self", paged=True, sort=["last_message_at", "created_at"], resp="PaginatedConversation", rex=page([CONVERSATION]),
   q=[q("status", {"$ref": "#/components/schemas/ConversationStatus"}, "Filter."), q("dataset_id", UUID, "Filter."), QTEXT,
      q("scope", en("mine", "support"), "support = admin inbox (message.support); default mine."), q("assigned_to", UUID, "Admin inbox filter."), q("unread", BOOL, "Only with unread.")],
   desc="`q` searches subject and message bodies (Postgres `simple` full-text + trigram).")
ep("POST", "/conversations", "Messaging", "Start a conversation", perm="message.self", body="ConversationCreate", ok=201, resp="ConversationDetail", rl="messaging",
   req={"subject": "Question about newspaper dataset", "body": "Hello, my dataset has been in review for a week — any update?", "dataset_id": DS, "attachment_ids": []},
   rex={"conversation": CONVERSATION, "first_message": MESSAGE},
   desc="Contributors open `support` (or `dataset` when dataset_id given — must own it) conversations with staff. Staff (`message.support`) may set `participant_user_id` to contact a user.",
   val=["subject 3–150", "body 1–10,000 chars, stored as plain text (rendered escaped with autolinks)", "≤ 5 attachments, owned by caller, unused, scan clean or pending"])
ep("GET", "/conversations/{conversation_id}", "Messaging", "Conversation detail", perm="message.self", resp="Conversation", rex=CONVERSATION, desc="Participants and `message.support` holders only.")
ep("PATCH", "/conversations/{conversation_id}", "Messaging", "Change status / assignment", perm="message.self", body="ConversationUpdate", resp="Conversation",
   req={"status": "closed"}, rex=dict(CONVERSATION, status="closed"),
   desc="Participants may close; only staff may set `awaiting_user` or `assigned_admin_id`. Emits `conversation.updated`.")
ep("GET", "/conversations/{conversation_id}/messages", "Messaging", "Messages (oldest→newest)", perm="message.self", paged=True, sort=["created_at"], resp="PaginatedMessage", rex=page([MESSAGE]),
   desc="Default sort `created_at`; page_size up to 100. Attachments with scan_status ≠ clean are listed (status shown) but not downloadable.")
ep("POST", "/conversations/{conversation_id}/messages", "Messaging", "Send a message", perm="message.self", body="MessageCreate", ok=201, resp="Message", rl="messaging",
   req={"body": "Thanks! Attached the receipt.", "attachment_ids": [AT]}, rex=dict(MESSAGE, body="Thanks! Attached the receipt.", attachments=[ATTACH]),
   desc="Contributor message on `closed`/`awaiting_user` conversation reopens it to `open`. Fan-out via Redis pub/sub `message.created` + notification `support_message` (+ email if the recipient is offline > 5 min).",
   err=["message.conversation_closed", "message.attachment_unavailable"])
ep("POST", "/conversations/{conversation_id}/read", "Messaging", "Mark read up to a message", perm="message.self", body="ReadMarker", ok=204, req={"last_read_message_id": MS})
ep("POST", "/conversations/{conversation_id}/attachments", "Messaging", "Upload an attachment", perm="message.self", body="AttachmentUpload", ct="multipart", ok=201, resp="Attachment", rl="attachment",
   req={"file": "<binary receipt.pdf>"}, rex=ATTACH,
   desc="multipart ≤ 10 MB; allowed by magic bytes: pdf, png, jpeg, txt, csv, docx, xlsx, zip (not expanded). Stored `attachments/{attachment_id}/original`, ClamAV scanned asynchronously; visible to other participants only when `clean`.",
   err=["message.attachment_too_large", "message.attachment_type_not_allowed"])
ep("GET", "/attachments/{attachment_id}/download-url", "Messaging", "Presigned attachment download", perm="message.self", resp="PresignedUrl", rl="download",
   rex={"url": "https://s3.datahub.example/datahub-private/attachments/01930b78-9999-7200-8000-000000000303/original?X-Amz-Expires=300&X-Amz-Signature=…", "expires_at": "2026-10-26T08:35:00Z", "method": "GET"},
   desc="Participants/staff of the attachment's conversation (uploader always). 5 min, `Content-Disposition: attachment`. Not a state change, so GET without CSRF.", err=["message.attachment_unavailable"])
ep("GET", "/ws", "Messaging", "WebSocket upgrade (realtime events)", ok=101, resp=None, rl="ws",
   desc="`GET /api/v1/ws` with `Upgrade: websocket`. Cookie-authenticated; Origin must be in `CORS_ALLOWED_ORIGINS`. Server→client events `message.created`, `notification.created`, `conversation.updated`. Protocol in API_DOCUMENTATION.md §9.", verified=False)

# ============================ NOTIFICATIONS ============================
ep("GET", "/notifications", "Notifications", "My notifications", paged=True, sort=["created_at"], resp="PaginatedNotification", rex=page([NOTIF]),
   q=[q("unread", BOOL, "Only unread."), q("type", {"$ref": "#/components/schemas/NotificationType"}, "Filter.")], perm="profile.self")
ep("GET", "/notifications/unread-count", "Notifications", "Unread count", resp="UnreadCount", rex={"unread": 3}, perm="profile.self")
ep("POST", "/notifications/{notification_id}/read", "Notifications", "Mark one read", ok=204, perm="profile.self")
ep("POST", "/notifications/read-all", "Notifications", "Mark all read", resp="CountResult", rex={"count": 3}, perm="profile.self")

# ============================ ADMIN USERS ============================
ep("GET", "/admin/users", "Admin users", "Search users", perm="user.read", admin=True, paged=True, sort=["created_at", "email", "last_login_at"], resp="PaginatedUser", rex=page([USER]),
   q=[QTEXT, q("role", {"$ref": "#/components/schemas/RoleName"}, "Filter."), q("status", {"$ref": "#/components/schemas/UserStatus"}, "Filter."),
      q("verification_status", {"$ref": "#/components/schemas/UserVerificationStatus"}, "Filter."), DFROM, DTO])
ep("GET", "/admin/users/{user_id}", "Admin users", "User detail", perm="user.read", admin=True, resp="AdminUserDetail",
   rex={"user": USER, "profile": PROFILE, "verification": dict(VERIFICATION, status="approved"), "wallet": WALLET, "stats": {"datasets": 3, "accepted_bytes": 367001600, "tasks_approved": 0, "open_payouts": 1}, "active_sessions": 2, "suspension_reason": None})
ep("POST", "/admin/users/{user_id}/suspend", "Admin users", "Suspend a user", perm="user.manage", admin=True, step=True, body="SuspendRequest", resp="User",
   req={"reason": "Repeated uploads of copyrighted books.", "notify_user": True}, rex=dict(USER, status="suspended"),
   desc="`active → suspended`; revokes all sessions immediately (and closes their WebSockets), cancels open upload sessions, releases claimed reviews/unassigns in-progress tasks, blocks payout approval (open payouts stay for admin decision). Admin cannot suspend admins/super_admins unless super_admin; nobody suspends themselves.",
   err=["user.invalid_state", "user.role_escalation_forbidden", "user.last_super_admin", "permission.separation_of_duties"])
ep("POST", "/admin/users/{user_id}/reactivate", "Admin users", "Reactivate a suspended user", perm="user.manage", admin=True, step=True, resp="User", rex=USER,
   desc="`suspended → active`. User must sign in again.", err=["user.invalid_state", "user.role_escalation_forbidden"])
ep("PUT", "/admin/users/{user_id}/roles", "Admin users", "Replace a user's roles", perm="user.manage", admin=True, step=True, body="RolesUpdate", resp="User",
   req={"roles": ["contributor", "annotator"], "reason": "Passed annotation trial."}, rex=dict(USER, roles=["contributor", "annotator"]),
   desc="Full replacement. Granting/removing `admin` or `super_admin` requires `role.manage` (super_admin). No self-changes. Last active super_admin cannot be removed. The target's sessions are rotated (privilege change); a granted admin role forces MFA enrolment on next request.",
   err=["user.role_escalation_forbidden", "user.last_super_admin", "permission.separation_of_duties"])
ep("POST", "/admin/users/{user_id}/revoke-sessions", "Admin users", "Revoke all sessions of a user", perm="user.manage", admin=True, step=True, resp="RevokeResult", rex={"revoked": 2},
   err=["user.role_escalation_forbidden"])
ep("GET", "/admin/verifications", "Admin users", "Contributor verification queue", perm="user.verify", admin=True, paged=True, sort=["submitted_at"], resp="PaginatedContributorVerification", rex=page([VERIFICATION]),
   q=[q("status", {"$ref": "#/components/schemas/ContributorVerificationStatus"}, "Default pending."), QTEXT])
ep("POST", "/admin/verifications/{verification_id}/decision", "Admin users", "Decide a verification", perm="user.verify", admin=True, body="VerificationDecision", resp="ContributorVerification",
   req={"decision": "approved", "reason": None}, rex=dict(VERIFICATION, status="approved", decided_by=U_ADM, decided_at=T2),
   desc="`pending → approved|rejected|needs_info`; mirrors users.verification_status; notifies user. Verifier ≠ subject. ID document access audited.",
   val=["reason required (≥ 5 chars) for rejected/needs_info"], err=["verification.invalid_state", "permission.separation_of_duties"])

# ============================ ADMIN DATASETS ============================
ep("GET", "/admin/datasets", "Admin datasets", "Search all datasets", perm="dataset.read.any", admin=True, paged=True, sort=DS_SORT + ["finalized_at", "overall_quality"], resp="PaginatedDataset", rex=page([DATASET]),
   q=[QTEXT, q("status", {"$ref": "#/components/schemas/DatasetStatus"}, "Filter (repeatable)."), q("data_class", {"$ref": "#/components/schemas/DataClass"}, "Filter."),
      q("language", s(maxl=3), "Filter."), q("category", {"$ref": "#/components/schemas/DatasetCategory"}, "Filter."), q("min_quality", {"type": "number", "minimum": 1, "maximum": 5}, "Overall quality ≥."),
      q("owner_id", UUID, "Filter."), DFROM, DTO])
ep("GET", "/admin/datasets/{dataset_id}", "Admin datasets", "Dataset detail (admin)", perm="dataset.read.any", admin=True, resp="AdminDatasetDetail",
   rex={"dataset": dict(DATASET, status="partially_approved"), "reviews": [dict(REVIEW, status="finalized", decision="partial")], "versions": [{"version_number": 1, "submitted_at": T2, "file_count": 2, "total_bytes": 734003200}],
        "duplicate_flagged_files": 1, "earned_micros": 367001, "license": {"license_version": "CA-2026-10", "accepted_at": T, "accepted_ip": "203.0.113.24"}},
   desc="Full dataset record with all reviews (including internal comments and reviewer identities), version history, licence acceptance evidence and earning total. Files are fetched via `GET /datasets/{id}/files` (admins have `dataset.read.any`).")
ep("POST", "/admin/datasets/{dataset_id}/takedown", "Admin datasets", "Take down a dataset", perm="dataset.read.any", admin=True, step=True, body="TakedownRequest", resp="Dataset",
   req={"reason_code": "rights_claim", "reason": "Publisher claim received 2026-10-25 (ticket #57).", "notify_owner": True}, rex=dict(DATASET, status="taken_down", takedown_reason="Publisher claim received 2026-10-25 (ticket #57)."),
   desc="Any status → `taken_down`; files become undownloadable/unpreviewable (except audit), excluded from exports and annotation (open tasks cancelled). Earnings already credited are **not** reversed automatically; a super_admin may post an `adjustment_debit` (`takedown_clawback`).", err=["dataset.invalid_state"])
ep("POST", "/admin/files/{file_id}/rescan", "Admin datasets", "Re-run malware scan / processing", perm="dataset.read.any", admin=True, ok=202, resp="DatasetFile", rex=dict(FILE, processing_status="processing", scan_status="pending"),
   desc="Re-enqueues `processing.process_file` with `force_rescan`; used after signature updates or `scan_status=error`. Not allowed for finalized-accepted files with clean status (no-op 202).")

# ============================ EXPORTS ============================
ep("POST", "/admin/exports", "Exports", "Create an export job", perm="dataset.export", admin=True, step=True, body="ExportCreate", ok=202, resp="ExportJob", rl="export",
   req={"filters": EXPORT["filters"], "format": "zip_originals", "include_metadata": True, "include_annotations": True, "note": "OCR training set v3"},
   rex=dict(EXPORT, status="queued", progress_percent=0, files=[], completed_at=None, started_at=None, expires_at=None, dataset_count=0, file_count=0, total_bytes=0),
   desc="Only approved/partially_approved datasets and accepted files are exportable; taken_down excluded. Background `exports.build_export` streams objects into ZIP parts ≤ 5 GB at `exports/{job_id}/{file}.zip`. Logged with dataset ids (audit). Expires after 7 days (A-15).",
   err=["export.empty_selection"])
ep("GET", "/admin/exports", "Exports", "List export jobs", perm="dataset.export", admin=True, paged=True, sort=["created_at"], resp="PaginatedExportJob", rex=page([EXPORT]),
   q=[q("status", {"$ref": "#/components/schemas/ExportStatus"}, "Filter."), q("requested_by", UUID, "Filter.")])
ep("GET", "/admin/exports/{export_id}", "Exports", "Export job status", perm="dataset.export", admin=True, resp="ExportJob", rex=EXPORT)
ep("POST", "/admin/exports/{export_id}/download-url", "Exports", "Presigned download for an export part", perm="dataset.export", admin=True, body="ExportDownloadRequest", resp="PresignedUrl", rl="download",
   req={"file_id": EXF}, rex={"url": "https://s3.datahub.example/datahub-private/exports/01930b7a-bbbb-7400-8000-000000000501/datahub-export-01930b7a-part-001.zip?X-Amz-Expires=300&X-Amz-Signature=…", "expires_at": "2026-10-26T09:20:00Z", "method": "GET"},
   desc="5-minute presigned GET; every issuance audited (`export.download_url`).", err=["export.not_ready", "export.expired"])

# ============================ ADMIN MISC ============================
ep("GET", "/admin/analytics/overview", "Admin", "Analytics overview", perm="analytics.read", admin=True, resp="AnalyticsOverview",
   q=[q("from", DATE, "Start date (UTC, inclusive); default 30 days ago."), q("to", DATE, "End date (UTC, inclusive); default today; range ≤ 366 days.")],
   rex={"from": "2026-09-27", "to": "2026-10-26", "users": {"registered": 412, "verified_contributors": 128, "active_30d": 203},
        "datasets": {"submitted": 96, "approved": 41, "partially_approved": 22, "rejected": 9, "changes_requested": 7},
        "bytes": {"uploaded": 2840000000000, "accepted_raw": 910000000000, "accepted_labeled": 120000000000},
        "finance": {"earned_micros": 1090000000, "paid_micros": 410000000}, "annotation": {"tasks_approved": 1880, "avg_review_score": 4.3},
        "review": {"median_hours_to_finalize": 19.5, "queue_depth": 14}, "series": [{"date": "2026-10-26", "uploaded_bytes": 92000000000, "accepted_bytes": 30000000000, "earned_micros": 31000000, "paid_micros": 0}]})
ep("GET", "/admin/audit-logs", "Admin", "Audit log", perm="audit.read", admin=True, paged=True, sort=["created_at"], resp="PaginatedAuditLog", rex=page([AUDIT]),
   q=[q("actor_id", UUID, "Filter."), q("action", s(maxl=100), "Exact or prefix (`payout.`)."), q("entity_type", s(maxl=50), "Filter."), q("entity_id", s(maxl=64), "Filter."), q("request_id", s(maxl=64), "Filter."), DFROM, DTO],
   desc="Read-only; audit rows are append-only (UPDATE/DELETE blocked by trigger). Viewing is itself audited.")
ep("GET", "/admin/security-events", "Admin", "Security events", perm="audit.read", admin=True, paged=True, sort=["created_at"], resp="PaginatedSecurityEvent",
   rex=page([{"id": "01930b7d-eeee-7700-8000-000000000802", "user_id": U_CON, "email": "sophea@example.com", "event_type": "login_failed", "ip": "203.0.113.24", "user_agent": "curl/8.5", "details": {"consecutive_failures": 3}, "created_at": T}]),
   q=[q("user_id", UUID, "Filter."), q("event_type", {"$ref": "#/components/schemas/SecurityEventType"}, "Filter."), q("ip", s(maxl=45), "Filter."), DFROM, DTO])
ep("GET", "/admin/settings", "Admin", "System settings", perm="settings.manage", admin=True, resp="SystemSettingList", rex={"items": [SETTING]})
ep("PUT", "/admin/settings/{key}", "Admin", "Update a system setting", perm="settings.manage", admin=True, step=True, body="SettingUpdate", resp="SystemSetting", ifm="optional",
   req={"value": 150000000, "reason": "Owner raised dual-approval threshold to $150 (HA-07)."}, rex=dict(SETTING, value=150000000, version=2, updated_by="01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f09"), rh=["ETag"],
   desc="Registry-validated keys only (see AUTH/API docs). Change is audited with before/after and takes effect within 30 s (settings cache TTL).", err=["settings.unknown_key", "settings.invalid_value"])
ep("GET", "/admin/roles", "Admin", "Role definitions and permissions", perm="user.read", admin=True, resp="RoleList",
   rex={"items": [{"name": "contributor", "description": "Uploads datasets and withdraws earnings.", "permissions": ["profile.self", "dataset.create", "dataset.read.own", "payout.request", "message.self"], "user_count": 398, "requires_mfa": False}]},
   desc="Read-only in v1: role → permission mapping is seeded by migration (baseline §6); changing it requires a migration + DECISION_LOG entry.")
