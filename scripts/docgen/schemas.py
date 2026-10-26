"""DataHub OpenAPI component schemas (source of truth for docs/04-backend-api/openapi.yaml)."""

def ref(n):
    return {"$ref": f"#/components/schemas/{n}"}

def arr(x, **kw):
    d = {"type": "array", "items": x}
    d.update(kw)
    return d

def nul(x):
    if "$ref" in x or "allOf" in x or "anyOf" in x:
        return {"anyOf": [x, {"type": "null"}]}
    y = dict(x)
    t = y.get("type", "string")
    y["type"] = [t, "null"] if isinstance(t, str) else list(t) + ["null"]
    if "enum" in y:
        y["enum"] = list(y["enum"]) + [None]
    return y

def obj(props, req=(), closed=False, desc=None):
    d = {"type": "object", "properties": props}
    if req:
        d["required"] = list(req)
    if closed:
        d["additionalProperties"] = False
    if desc:
        d["description"] = desc
    return d

def en(*vals, desc=None):
    d = {"type": "string", "enum": list(vals)}
    if desc:
        d["description"] = desc
    return d

def s(minl=None, maxl=None, fmt=None, pattern=None, desc=None):
    d = {"type": "string"}
    if minl is not None: d["minLength"] = minl
    if maxl is not None: d["maxLength"] = maxl
    if fmt: d["format"] = fmt
    if pattern: d["pattern"] = pattern
    if desc: d["description"] = desc
    return d

UUID = {"type": "string", "format": "uuid"}
DT = {"type": "string", "format": "date-time"}
DATE = {"type": "string", "format": "date"}
BOOL = {"type": "boolean"}
INT = {"type": "integer"}
def micros(desc="Integer micro-USD (1 USD = 1,000,000).", signed=False):
    d = {"type": "integer", "format": "int64", "description": desc}
    if not signed:
        d["minimum"] = 0
    return d
BYTES = {"type": "integer", "format": "int64", "minimum": 0, "description": "Size in bytes."}
SHA256 = s(pattern="^[0-9a-f]{64}$", desc="Lower-case hex SHA-256.")
ANY = {}

# ---------------- enums (baseline §9 exact) ----------------
ENUMS = {
    "RoleName": en("contributor", "annotator", "reviewer", "admin", "super_admin"),
    "PermissionCode": en("profile.self", "dataset.create", "dataset.read.own", "payout.request", "message.self",
                         "annotation.work", "dataset.review", "annotation.review", "dataset.read.any", "user.read",
                         "user.manage", "user.verify", "annotation.manage", "payout.approve", "payout.record_payment",
                         "finance.read", "finance.adjust", "dataset.export", "message.support", "analytics.read",
                         "pricing.manage", "role.manage", "settings.manage", "audit.read"),
    "UserStatus": en("pending_email", "active", "suspended", "deactivated", "anonymized"),
    "UserVerificationStatus": en("unverified", "pending", "approved", "rejected", "needs_info"),
    "ContributorVerificationStatus": en("pending", "approved", "rejected", "needs_info"),
    "UploadSessionStatus": en("initiated", "uploading", "completed", "aborted", "expired"),
    "FileProcessingStatus": en("pending_upload", "uploaded", "processing", "ready", "failed", "quarantined"),
    "ScanStatus": en("pending", "clean", "infected", "error", "skipped_container"),
    "FileFailureCode": en("type_mismatch", "disallowed_type", "nested_archive", "corrupt", "archive_limit_exceeded",
                          "unsafe_member_path", "encrypted", "scan_error", "infected", "size_mismatch", "processing_error",
                          desc="Machine-readable reason for processing_status failed/quarantined."),
    "DatasetStatus": en("draft", "submitted", "in_review", "approved", "partially_approved", "rejected",
                        "changes_requested", "withdrawn", "taken_down"),
    "DataClass": en("raw", "labeled"),
    "DatasetCategory": en("books", "news", "government", "academic", "legal", "religious", "business", "forms",
                          "handwriting", "historical", "web_text", "other"),
    "ReviewStatus": en("in_progress", "finalized", "released"),
    "ReviewDecision": en("approve", "partial", "reject", "request_changes"),
    "FileReviewDecision": en("accepted", "rejected"),
    "FileRejectReason": en("duplicate", "near_duplicate", "low_quality", "illegible", "wrong_language", "out_of_scope",
                           "personal_data", "copyright_concern", "corrupt", "malware", "metadata_mismatch", "other"),
    "DuplicateKind": en("exact", "near"),
    "AnnotationTaskStatus": en("unassigned", "assigned", "in_progress", "submitted", "in_review", "approved",
                               "changes_requested", "cancelled"),
    "AnnotationProjectStatus": en("active", "closed", desc="Not a §9 state machine; projects are active until closed (terminal)."),
    "AnnotationType": en("transcription", "text_correction", "classification", "metadata", "page_label",
                         desc="`bbox` is reserved for v2 and rejected in v1."),
    "TaskUnit": en("file", "page"),
    "AnnotationReviewDecision": en("approve", "request_changes"),
    "PayoutStatus": en("requested", "approved", "paid", "rejected", "cancelled", "failed", "reversed"),
    "PayoutMethodType": en("bank_transfer", "aba_pay", "wise", "paypal", "other"),
    "ExportStatus": en("queued", "running", "completed", "failed", "expired"),
    "ExportFormat": en("zip_originals", "jsonl_text",
                       desc="zip_originals = original files + manifest.jsonl (+annotations); jsonl_text = extracted/annotated text only, packaged in ZIP."),
    "ConversationStatus": en("open", "awaiting_user", "closed"),
    "ConversationKind": en("support", "dataset"),
    "AttachmentScanStatus": en("pending", "clean", "infected", "error"),
    "JournalKind": en("dataset_earning", "annotation_reward", "earning_release", "payout_reserve", "payout_release",
                      "payout_settle", "adjustment_credit", "adjustment_debit", "payout_reversal"),
    "LedgerBucket": en("pending", "available", "reserved", "paid", "main"),
    "AdjustmentDirection": en("credit", "debit"),
    "AdjustmentReason": en("correction", "bonus", "chargeback", "duplicate_payment", "takedown_clawback", "other"),
    "NotificationType": en("email_verified", "contributor_approved", "contributor_rejected", "verification_needs_info",
                           "dataset_received", "dataset_processing_finished", "dataset_approved",
                           "dataset_partially_approved", "dataset_rejected", "dataset_changes_requested",
                           "dataset_taken_down", "earnings_credited", "withdrawal_requested", "withdrawal_approved",
                           "withdrawal_rejected", "payment_recorded", "payout_failed", "payout_reversed",
                           "annotation_assigned", "annotation_returned", "annotation_approved", "support_message",
                           "export_completed", "security_alert"),
    "SecurityEventType": en("login_succeeded", "login_failed", "account_locked", "logout", "password_changed",
                            "password_reset_requested", "password_reset_completed", "email_verified", "mfa_enabled",
                            "mfa_disabled", "mfa_failed", "mfa_recovery_code_used", "session_revoked",
                            "csrf_rejected", "permission_denied", "rate_limited", "payout_method_changed"),
    "Language": s(pattern="^[a-z]{2,3}$", desc="ISO 639-1/639-3 code, e.g. `km`, `en`."),
}

def build():
    S = {}
    S.update(ENUMS)
    E = lambda n: ref(n)

    # ---------- errors / pagination ----------
    S["ErrorEnvelope"] = obj({"error": obj({
        "code": s(desc="Stable dotted error code, see API_DOCUMENTATION.md §6."),
        "message": s(desc="Human-readable English message; never contains secrets."),
        "details": nul({"type": "object", "description": "Code-specific structured details (e.g. `fields` for validation)."}),
        "request_id": s(desc="Echo of X-Request-ID; quote it in support requests."),
    }, ["code", "message", "details", "request_id"])}, ["error"])
    S["ValidationFieldError"] = obj({"loc": arr({"type": ["string", "integer"]}), "msg": s(), "type": s()}, ["loc", "msg", "type"])
    S["PaginationMeta"] = obj({"page": {"type": "integer", "minimum": 1}, "page_size": {"type": "integer", "minimum": 1, "maximum": 100},
                               "total": {"type": "integer", "minimum": 0}}, ["page", "page_size", "total"])
    S["OkStatus"] = obj({"status": s()}, ["status"])
    S["CountResult"] = obj({"count": {"type": "integer", "minimum": 0}}, ["count"])
    S["PresignedUrl"] = obj({"url": s(fmt="uri"), "expires_at": DT, "method": en("GET", "PUT")}, ["url", "expires_at", "method"])

    # ---------- health ----------
    S["Health"] = obj({"status": en("ok"), "version": s(), "time": DT}, ["status"])
    S["Readiness"] = obj({"status": en("ok", "degraded", "unavailable"),
                          "checks": {"type": "object", "additionalProperties": en("ok", "fail", "skipped")}}, ["status", "checks"])

    # ---------- identity ----------
    S["User"] = obj({
        "id": UUID, "email": s(fmt="email"), "display_name": s(maxl=80), "status": E("UserStatus"),
        "roles": arr(E("RoleName")), "email_verified_at": nul(DT), "verification_status": E("UserVerificationStatus"),
        "onboarding_completed_at": nul(DT), "mfa_enabled": BOOL, "created_at": DT, "last_login_at": nul(DT),
    }, ["id", "email", "display_name", "status", "roles", "verification_status", "mfa_enabled", "created_at"])
    S["SessionState"] = obj({
        "id": UUID, "mfa_verified": BOOL, "mfa_required": BOOL, "mfa_enrollment_required": BOOL,
        "step_up_valid_until": nul(DT), "idle_expires_at": DT, "absolute_expires_at": DT,
    }, ["id", "mfa_verified", "mfa_required", "mfa_enrollment_required", "idle_expires_at", "absolute_expires_at"])
    S["Me"] = obj({
        "user": E("User"), "permissions": arr(E("PermissionCode")), "session": E("SessionState"),
        "capabilities": obj({"can_upload": BOOL, "can_withdraw": BOOL, "can_be_assigned_annotation": BOOL,
                             "limited_reason": nul(s())}, ["can_upload", "can_withdraw", "can_be_assigned_annotation"]),
    }, ["user", "permissions", "session", "capabilities"])
    S["Session"] = obj({
        "id": UUID, "created_at": DT, "last_seen_at": DT, "idle_expires_at": DT, "absolute_expires_at": DT,
        "ip": s(), "user_agent": s(maxl=512), "current": BOOL, "mfa_verified_at": nul(DT),
    }, ["id", "created_at", "last_seen_at", "idle_expires_at", "absolute_expires_at", "current"])
    S["SessionList"] = obj({"items": arr(E("Session"))}, ["items"])
    S["CsrfToken"] = obj({"csrf_token": s(desc="Same value as the dh_csrf cookie; send as X-CSRF-Token.")}, ["csrf_token"])
    PW = s(minl=12, maxl=128, desc="Min 12 chars, max 128; checked against common-password list.")
    S["RegisterRequest"] = obj({
        "email": s(fmt="email", maxl=254), "password": PW, "display_name": s(minl=2, maxl=80),
        "accept_terms": {"type": "boolean", "const": True}, "accept_privacy": {"type": "boolean", "const": True},
        "terms_version": s(maxl=32),
    }, ["email", "password", "display_name", "accept_terms", "accept_privacy", "terms_version"], closed=True)
    S["LoginRequest"] = obj({"email": s(fmt="email", maxl=254), "password": s(minl=1, maxl=128)}, ["email", "password"], closed=True)
    S["LoginResponse"] = obj({"mfa_required": BOOL, "mfa_enrollment_required": BOOL, "me": nul(E("Me"))},
                             ["mfa_required", "mfa_enrollment_required", "me"])
    S["MfaVerifyRequest"] = obj({"code": s(pattern="^[0-9]{6}$"), "recovery_code": s(pattern="^[A-Z2-7]{5}-[A-Z2-7]{5}$")}, closed=True,
                                desc="Exactly one of `code` or `recovery_code`.")
    S["MfaSetupRequest"] = obj({"password": s(minl=1, maxl=128)}, ["password"], closed=True)
    S["MfaSetupResponse"] = obj({"secret": s(desc="Base32 TOTP secret (shown once)."), "otpauth_uri": s(),
                                 "issuer": s(), "algorithm": en("SHA1"), "digits": {"type": "integer", "const": 6},
                                 "period": {"type": "integer", "const": 30}}, ["secret", "otpauth_uri", "issuer", "algorithm", "digits", "period"])
    S["MfaEnableRequest"] = obj({"code": s(pattern="^[0-9]{6}$")}, ["code"], closed=True)
    S["MfaEnableResponse"] = obj({"recovery_codes": arr(s(pattern="^[A-Z2-7]{5}-[A-Z2-7]{5}$"), minItems=10, maxItems=10)}, ["recovery_codes"])
    S["MfaDisableRequest"] = obj({"password": s(minl=1, maxl=128), "code": s(pattern="^[0-9]{6}$")}, ["password", "code"], closed=True)
    S["TokenRequest"] = obj({"token": s(minl=43, maxl=43, pattern="^[A-Za-z0-9_-]{43}$")}, ["token"], closed=True)
    S["EmailRequest"] = obj({"email": s(fmt="email", maxl=254)}, ["email"], closed=True)
    S["ResetPasswordRequest"] = obj({"token": s(minl=43, maxl=43, pattern="^[A-Za-z0-9_-]{43}$"), "new_password": PW}, ["token", "new_password"], closed=True)
    S["ChangePasswordRequest"] = obj({"current_password": s(minl=1, maxl=128), "new_password": PW}, ["current_password", "new_password"], closed=True)
    S["Accepted"] = obj({"status": en("accepted"), "message": s()}, ["status", "message"])

    # ---------- me ----------
    S["Profile"] = obj({
        "user_id": UUID, "display_name": s(minl=2, maxl=80), "legal_name": nul(s(maxl=160)),
        "country": nul(s(pattern="^[A-Z]{2}$")), "phone": nul(s(pattern="^\\+[1-9][0-9]{6,14}$")),
        "date_of_birth": nul(DATE), "preferred_language": en("en", "km"), "timezone": s(maxl=64),
        "bio": nul(s(maxl=1000)), "version": INT, "updated_at": DT,
    }, ["user_id", "display_name", "preferred_language", "timezone", "version", "updated_at"])
    S["ProfileUpdate"] = obj({
        "display_name": s(minl=2, maxl=80), "legal_name": nul(s(maxl=160)), "country": nul(s(pattern="^[A-Z]{2}$")),
        "phone": nul(s(pattern="^\\+[1-9][0-9]{6,14}$")), "date_of_birth": nul(DATE),
        "preferred_language": en("en", "km"), "timezone": s(maxl=64), "bio": nul(s(maxl=1000)),
    }, closed=True)
    S["OnboardingRequest"] = obj({
        "agreement_version": s(maxl=32), "accept_contributor_agreement": {"type": "boolean", "const": True},
        "rights_declaration": {"type": "boolean", "const": True, "description": "I own or have the right to license what I upload."},
        "acknowledge_no_personal_data_without_consent": {"type": "boolean", "const": True},
    }, ["agreement_version", "accept_contributor_agreement", "rights_declaration", "acknowledge_no_personal_data_without_consent"], closed=True)
    S["PayoutMethod"] = obj({
        "id": UUID, "type": E("PayoutMethodType"), "label": s(maxl=60), "is_default": BOOL,
        "details": {"type": "object", "description": "Type-specific details. Account numbers are masked (last 4) for the owner; shown in full only to payout.approve holders."},
        "created_at": DT,
    }, ["id", "type", "label", "is_default", "details", "created_at"])
    S["PayoutMethodCreate"] = obj({
        "type": E("PayoutMethodType"), "label": s(minl=1, maxl=60), "is_default": BOOL,
        "details": {"type": "object", "description": "bank_transfer: bank_name, account_name, account_number, swift_code?; aba_pay: account_name, account_number, phone?; wise: email, account_name; paypal: email; other: instructions (≤500)."},
        "current_password": s(minl=1, maxl=128, desc="Re-authentication for a payout-sensitive change."),
    }, ["type", "label", "details", "current_password"], closed=True)
    S["PayoutMethodList"] = obj({"items": arr(E("PayoutMethod"))}, ["items"])
    S["ContributorVerification"] = obj({
        "id": UUID, "user_id": UUID, "status": E("ContributorVerificationStatus"), "legal_name": s(), "country": s(),
        "date_of_birth": DATE, "phone": s(), "id_document": nul(obj({"filename": s(), "size_bytes": BYTES, "content_type": s(), "url": nul(s(fmt="uri", desc="Presigned GET (5 min, attachment); present only for user.verify holders.")), "url_expires_at": nul(DT)})),
        "decision_reason": nul(s()), "decided_by": nul(UUID), "decided_at": nul(DT), "submitted_at": DT,
    }, ["id", "user_id", "status", "legal_name", "country", "date_of_birth", "phone", "submitted_at"])
    S["VerificationSubmit"] = obj({
        "legal_name": s(minl=2, maxl=160), "country": s(pattern="^[A-Z]{2}$"), "date_of_birth": DATE,
        "phone": s(pattern="^\\+[1-9][0-9]{6,14}$"),
        "id_document": {"type": "string", "contentMediaType": "application/octet-stream", "description": "Optional PDF/JPEG/PNG ≤ 10 MB."},
    }, ["legal_name", "country", "date_of_birth", "phone"])
    S["DeletionRequestCreate"] = obj({"confirm_email": s(fmt="email"), "reason": nul(s(maxl=1000))}, ["confirm_email"], closed=True)
    S["DeletionRequest"] = obj({"id": UUID, "status": en("pending", "processing", "completed", "rejected"), "created_at": DT,
                                "scheduled_for": nul(DT)}, ["id", "status", "created_at"])
    S["NotificationPreferences"] = obj({
        "email": {"type": "object", "additionalProperties": BOOL, "description": "Map NotificationType → send email. Security, payment and account-status emails are mandatory and ignore false."},
        "mandatory_email_types": arr(E("NotificationType")),
    }, ["email", "mandatory_email_types"])
    S["NotificationPreferencesUpdate"] = obj({"email": {"type": "object", "additionalProperties": BOOL}}, ["email"], closed=True)

    # ---------- public ----------
    S["PublicPricing"] = obj({
        "currency": en("USD"), "bytes_per_gb": {"type": "integer", "const": 1000000000},
        "rates": arr(obj({"data_class": E("DataClass"), "rate_micros_per_gb": micros(), "effective_from": DT}, ["data_class", "rate_micros_per_gb", "effective_from"])),
        "min_withdrawal_micros": micros(), "max_withdrawal_micros": micros(),
    }, ["currency", "bytes_per_gb", "rates", "min_withdrawal_micros", "max_withdrawal_micros"])
    S["FormatRule"] = obj({"extension": s(), "mime_types": arr(s()), "allowed": BOOL,
                           "preview": en("page_images", "image", "text", "table", "member_list", "none"),
                           "annotatable": en("page_level", "text", "no"), "payable": en("yes", "no", "members_only", "reviewer_decides"),
                           "notes": nul(s())}, ["extension", "mime_types", "allowed", "preview", "annotatable", "payable"])
    S["FormatList"] = obj({"items": arr(E("FormatRule")), "limits": obj({
        "max_file_bytes": BYTES, "max_dataset_bytes": BYTES, "user_pending_quota_bytes": BYTES,
        "max_files_per_dataset": INT, "part_size_bytes": BYTES})}, ["items", "limits"])
    S["ContactRequest"] = obj({"name": s(minl=1, maxl=120), "email": s(fmt="email", maxl=254), "subject": s(minl=3, maxl=150),
                               "message": s(minl=10, maxl=5000)}, ["name", "email", "subject", "message"], closed=True)

    # ---------- datasets ----------
    DS_PROPS = {
        "title": s(minl=3, maxl=200), "description": s(maxl=5000), "data_class": E("DataClass"),
        "category": E("DatasetCategory"), "languages": arr(E("Language"), minItems=1, maxItems=5, uniqueItems=True),
        "tags": arr(s(minl=1, maxl=40), maxItems=20, uniqueItems=True), "source_description": s(maxl=2000),
        "contains_personal_data": BOOL, "personal_data_notes": nul(s(maxl=2000)),
    }
    S["DatasetCreate"] = obj(dict(DS_PROPS, rights_declaration_accepted={"type": "boolean", "const": True},
                                  license_version=s(maxl=32, desc="Version of the Contributor Agreement licence being granted.")),
                             ["title", "data_class", "category", "languages", "contains_personal_data", "rights_declaration_accepted", "license_version"], closed=True)
    S["DatasetUpdate"] = obj(dict(DS_PROPS), closed=True, desc="Allowed while status ∈ {draft, changes_requested}.")
    S["Dataset"] = obj(dict(DS_PROPS,
        id=UUID, owner_id=UUID, owner_display_name=s(), status=E("DatasetStatus"), version_number=INT,
        file_count=INT, ready_file_count=INT, failed_file_count=INT, total_bytes=BYTES, accepted_bytes=nul(BYTES),
        earned_micros=nul(micros()), license_version=s(), takedown_reason=nul(s()),
        submitted_at=nul(DT), finalized_at=nul(DT), created_at=DT, updated_at=DT, version=INT),
        ["id", "owner_id", "title", "data_class", "category", "languages", "status", "version_number", "file_count", "total_bytes", "created_at", "updated_at", "version"])
    S["DatasetEstimate"] = obj({
        "dataset_id": UUID, "is_estimate": {"type": "boolean", "const": True}, "data_class": E("DataClass"),
        "rate_micros_per_gb": micros(), "eligible_bytes": BYTES, "excluded_bytes": BYTES,
        "excluded_breakdown": obj({"duplicates_bytes": BYTES, "failed_or_quarantined_bytes": BYTES, "containers_bytes": BYTES, "processing_bytes": BYTES}),
        "estimated_micros": micros(), "computed_at": DT,
    }, ["dataset_id", "is_estimate", "data_class", "rate_micros_per_gb", "eligible_bytes", "excluded_bytes", "estimated_micros", "computed_at"])
    S["DuplicateMatch"] = obj({"kind": E("DuplicateKind"), "method": en("sha256", "simhash", "dhash"), "distance": INT,
                               "matched_file_id": nul(UUID), "matched_dataset_id": nul(UUID), "matched_previously_accepted": BOOL,
                               "same_owner": BOOL}, ["kind", "method", "distance", "matched_previously_accepted"],
                              desc="matched_* ids are null for contributors when the match belongs to another user.")
    S["FilePreview"] = obj({"page": {"type": "integer", "minimum": 1}, "width": INT, "height": INT, "content_type": en("image/webp")}, ["page", "width", "height", "content_type"])
    S["DatasetFile"] = obj({
        "id": UUID, "dataset_id": UUID, "parent_file_id": nul(UUID), "original_filename": s(maxl=255),
        "relative_path": nul(s(maxl=1024)), "member_path": nul(s(maxl=1024)), "extension": s(), "declared_mime": nul(s()),
        "detected_mime": nul(s()), "size_bytes": BYTES, "sha256": nul(SHA256), "processing_status": E("FileProcessingStatus"),
        "scan_status": E("ScanStatus"), "scan_mode": nul(en("full", "windowed", desc="windowed = file > 2,000,000,000 bytes scanned in overlapping windows (ClamAV single-file limit); flagged to reviewers.")),
        "failure_code": nul(E("FileFailureCode")), "failure_message": nul(s()),
        "is_container": BOOL, "page_count": nul(INT), "previews": arr(E("FilePreview")), "text_available": BOOL,
        "duplicates": arr(E("DuplicateMatch")), "review_decision": nul(E("FileReviewDecision")),
        "created_at": DT, "uploaded_at": nul(DT), "processed_at": nul(DT),
    }, ["id", "dataset_id", "original_filename", "extension", "size_bytes", "processing_status", "scan_status", "is_container", "created_at"])
    S["FileText"] = obj({"file_id": UUID, "text": s(), "truncated": BOOL, "source": en("extracted", "plain"), "char_count": INT},
                        ["file_id", "text", "truncated", "source", "char_count"])
    S["DownloadUrlRequest"] = obj({"reason": nul(s(maxl=200))}, closed=True)

    # ---------- uploads ----------
    S["UploadInitRequest"] = obj({
        "filename": s(minl=1, maxl=255), "size_bytes": {"type": "integer", "format": "int64", "minimum": 1},
        "content_type": s(maxl=255, desc="Browser-declared MIME; advisory only."),
        "relative_path": nul(s(maxl=1024, desc="webkitRelativePath for folder uploads; metadata only.")),
        "last_modified": nul(DT),
    }, ["filename", "size_bytes"], closed=True)
    S["UploadPart"] = obj({"part_number": {"type": "integer", "minimum": 1, "maximum": 10000}, "etag": s(maxl=128), "size_bytes": BYTES}, ["part_number", "etag"])
    S["UploadSession"] = obj({
        "upload_id": UUID, "dataset_id": UUID, "file_id": UUID, "filename": s(), "size_bytes": BYTES,
        "part_size": BYTES, "part_count": {"type": "integer", "minimum": 1, "maximum": 10000}, "status": E("UploadSessionStatus"),
        "uploaded_parts": arr(E("UploadPart")), "uploaded_bytes": BYTES, "expires_at": DT, "created_at": DT, "completed_at": nul(DT),
    }, ["upload_id", "dataset_id", "file_id", "filename", "size_bytes", "part_size", "part_count", "status", "expires_at", "created_at"])
    S["PartUrlsRequest"] = obj({"part_numbers": arr({"type": "integer", "minimum": 1, "maximum": 10000}, minItems=1, maxItems=100, uniqueItems=True)}, ["part_numbers"], closed=True)
    S["PartUrlsResponse"] = obj({"urls": arr(obj({"part_number": INT, "url": s(fmt="uri")}, ["part_number", "url"])), "expires_at": DT}, ["urls", "expires_at"])
    S["UploadCompleteRequest"] = obj({"parts": arr(obj({"part_number": {"type": "integer", "minimum": 1, "maximum": 10000}, "etag": s(minl=1, maxl=128)}, ["part_number", "etag"], closed=True), minItems=1, maxItems=10000),
                                      "client_sha256": nul(SHA256)}, ["parts"], closed=True)

    # ---------- review ----------
    S["ReviewChecklist"] = obj({k: nul(BOOL) for k in ["rights_plausible", "matches_description", "language_correct",
                                                       "no_unconsented_personal_data", "no_copyright_concern", "quality_acceptable", "metadata_complete"]})
    SC = {"type": "integer", "minimum": 1, "maximum": 5}
    S["QualityScores"] = obj({k: nul(SC) for k in ["legibility", "completeness", "accuracy", "relevance", "labeling_quality"]})
    S["Review"] = obj({
        "id": UUID, "dataset_id": UUID, "dataset_version_number": INT, "reviewer_id": UUID, "reviewer_name": s(),
        "status": E("ReviewStatus"), "decision": nul(E("ReviewDecision")), "data_class": E("DataClass"),
        "checklist": E("ReviewChecklist"), "quality_scores": E("QualityScores"), "overall_quality": nul({"type": "number", "minimum": 1, "maximum": 5}),
        "internal_comments": nul(s(maxl=10000)), "feedback": nul(s(maxl=10000)), "claimed_at": DT, "finalized_at": nul(DT),
        "released_at": nul(DT), "version": INT,
    }, ["id", "dataset_id", "dataset_version_number", "reviewer_id", "status", "data_class", "checklist", "quality_scores", "claimed_at", "version"])
    S["ReviewDetail"] = obj({"review": E("Review"), "dataset": E("Dataset"), "files": arr(E("DatasetFile")),
                             "file_reviews": arr(E("FileReview")), "summary": E("ReviewSummary"), "history": arr(E("Review"))},
                            ["review", "dataset", "files", "file_reviews", "summary", "history"])
    S["ReviewUpdate"] = obj({"checklist": E("ReviewChecklist"), "quality_scores": E("QualityScores"),
                             "internal_comments": nul(s(maxl=10000)), "feedback": nul(s(maxl=10000)), "data_class": E("DataClass")}, closed=True)
    S["FileReview"] = obj({"file_id": UUID, "decision": E("FileReviewDecision"), "reason_code": nul(E("FileRejectReason")),
                           "comment": nul(s(maxl=2000)), "labeled_upgrade": BOOL, "reviewer_id": UUID, "reviewed_at": DT},
                          ["file_id", "decision", "labeled_upgrade", "reviewer_id", "reviewed_at"])
    S["FileReviewInput"] = obj({"decision": E("FileReviewDecision"), "reason_code": nul(E("FileRejectReason")),
                                "comment": nul(s(maxl=2000)), "labeled_upgrade": {"type": "boolean", "default": False}}, ["decision"], closed=True)
    S["FileReviewBulk"] = obj({"file_ids": arr(UUID, minItems=1, maxItems=2000, uniqueItems=True), "decision": E("FileReviewDecision"),
                               "reason_code": nul(E("FileRejectReason")), "comment": nul(s(maxl=2000))}, ["file_ids", "decision"], closed=True)
    S["FileReviewBulkResult"] = obj({"updated": INT, "skipped": arr(obj({"file_id": UUID, "code": s()}, ["file_id", "code"]))}, ["updated", "skipped"])
    S["ReviewSummary"] = obj({
        "review_id": UUID, "total_files": INT, "decided_files": INT, "undecided_files": INT, "not_reviewable_files": INT,
        "accepted_files": INT, "rejected_files": INT, "accepted_bytes": BYTES, "rejected_bytes": BYTES,
        "payable_bytes": BYTES, "non_payable_accepted_bytes": BYTES, "labeled_upgrade_files": INT,
        "data_class": E("DataClass"), "rate_micros_per_gb": micros(), "payable_micros": micros(),
        "rejections_by_reason": {"type": "object", "additionalProperties": INT},
        "allowed_decisions": arr(E("ReviewDecision")),
    }, ["review_id", "total_files", "decided_files", "undecided_files", "accepted_files", "rejected_files", "accepted_bytes",
        "rejected_bytes", "payable_bytes", "data_class", "rate_micros_per_gb", "payable_micros", "allowed_decisions"])
    S["FinalizeRequest"] = obj({"decision": E("ReviewDecision"), "feedback": s(maxl=10000, desc="Required (≥ 10 chars) unless decision = approve."),
                                "data_class": E("DataClass")}, ["decision"], closed=True)
    S["FinalizeResult"] = obj({"review": E("Review"), "dataset_status": E("DatasetStatus"), "earning": nul(obj({
        "journal_id": UUID, "amount_micros": micros(), "records": INT, "credited_bucket": en("available", "pending")}, ["journal_id", "amount_micros", "records", "credited_bucket"]))},
        ["review", "dataset_status", "earning"])
    S["ReviewQueueItem"] = obj({"dataset_id": UUID, "title": s(), "owner_display_name": s(), "data_class": E("DataClass"),
                                "category": E("DatasetCategory"), "languages": arr(E("Language")), "file_count": INT, "total_bytes": BYTES,
                                "submitted_at": DT, "version_number": INT, "has_duplicate_flags": BOOL, "contains_personal_data": BOOL,
                                "status": E("DatasetStatus"), "claimed_review_id": nul(UUID)},
                               ["dataset_id", "title", "data_class", "file_count", "total_bytes", "submitted_at", "status"])
    S["ReviewFeedback"] = obj({"review_id": UUID, "dataset_version_number": INT, "decision": nul(E("ReviewDecision")),
                               "feedback": nul(s()), "finalized_at": nul(DT), "accepted_bytes": BYTES, "rejected_bytes": BYTES,
                               "earned_micros": micros(), "file_decisions": arr(obj({"file_id": UUID, "original_filename": s(), "decision": E("FileReviewDecision"),
                                                                                    "reason_code": nul(E("FileRejectReason")), "comment": nul(s())}))},
                              ["review_id", "dataset_version_number", "decision", "finalized_at", "file_decisions"],
                              desc="Contributor-safe projection: no reviewer identity, no internal comments.")
    S["ReviewFeedbackList"] = obj({"items": arr(E("ReviewFeedback"))}, ["items"])

    # ---------- finance ----------
    S["Wallet"] = obj({
        "user_id": UUID, "currency": en("USD"), "estimated_micros": micros("Not in ledger: estimate for unfinalized datasets."),
        "pending_micros": micros(), "available_micros": micros(), "reserved_micros": micros(), "paid_micros": micros(),
        "adjustments_micros": micros(signed=True, desc="Net Σ adjustment journals (signed)."),
        "approved_lifetime_micros": micros("Σ dataset_earning + annotation_reward."), "updated_at": DT,
    }, ["user_id", "currency", "estimated_micros", "pending_micros", "available_micros", "reserved_micros", "paid_micros", "adjustments_micros", "approved_lifetime_micros", "updated_at"])
    S["LedgerLine"] = obj({
        "id": UUID, "journal_id": UUID, "kind": E("JournalKind"), "wallet_id": UUID, "user_id": nul(UUID), "bucket": E("LedgerBucket"),
        "amount_micros": micros(signed=True, desc="Signed integer micro-USD; Σ per journal = 0."),
        "source_type": s(), "source_id": UUID, "description": s(), "created_by": nul(UUID), "created_at": DT,
    }, ["id", "journal_id", "kind", "wallet_id", "bucket", "amount_micros", "source_type", "source_id", "created_at"])
    S["EarningRecord"] = obj({
        "id": UUID, "user_id": UUID, "source_type": en("dataset_review", "annotation_review"), "source_id": UUID,
        "dataset_id": nul(UUID), "file_id": nul(UUID), "task_id": nul(UUID), "accepted_bytes": nul(BYTES), "data_class": nul(E("DataClass")),
        "rate_micros_per_gb": nul(micros()), "pricing_rule_id": nul(UUID), "labeled_upgrade": BOOL,
        "previously_paid_rate_micros_per_gb": nul(micros()), "amount_micros": micros(), "journal_id": UUID, "created_at": DT,
    }, ["id", "user_id", "source_type", "source_id", "labeled_upgrade", "amount_micros", "journal_id", "created_at"])
    S["PayoutApproval"] = obj({"id": UUID, "payout_id": UUID, "approver_id": UUID, "approver_name": s(), "comment": nul(s()), "created_at": DT},
                              ["id", "payout_id", "approver_id", "created_at"])
    S["PayoutRecord"] = obj({"id": UUID, "payout_id": UUID, "payment_reference": s(), "method": E("PayoutMethodType"), "paid_at": DT,
                             "recorded_by": UUID, "notes": nul(s()), "proof": nul(obj({"filename": s(), "size_bytes": BYTES, "content_type": s(), "uploaded_at": DT, "url": nul(s(fmt="uri", desc="Presigned GET (5 min, attachment) for the recipient and finance.read holders.")), "url_expires_at": nul(DT)})),
                             "created_at": DT}, ["id", "payout_id", "payment_reference", "method", "paid_at", "recorded_by", "created_at"])
    S["Payout"] = obj({
        "id": UUID, "user_id": UUID, "user_display_name": s(), "amount_micros": micros(), "currency": en("USD"), "status": E("PayoutStatus"),
        "payout_method": obj({"id": UUID, "type": E("PayoutMethodType"), "label": s(), "details": {"type": "object"}}, ["id", "type", "label"]),
        "note": nul(s(maxl=500)), "approvals_required": {"type": "integer", "minimum": 1, "maximum": 2}, "approvals": arr(E("PayoutApproval")),
        "record": nul(E("PayoutRecord")), "rejection_reason": nul(s()), "failure_reason": nul(s()), "cancellation_reason": nul(s()),
        "reversal_reason": nul(s()), "created_at": DT, "updated_at": DT, "version": INT,
    }, ["id", "user_id", "amount_micros", "currency", "status", "payout_method", "approvals_required", "approvals", "created_at", "updated_at", "version"])
    S["PayoutCreate"] = obj({"amount_micros": {"type": "integer", "format": "int64", "minimum": 10000, "multipleOf": 10000},
                             "payout_method_id": UUID, "note": nul(s(maxl=500))}, ["amount_micros", "payout_method_id"], closed=True)
    S["ReasonRequest"] = obj({"reason": s(minl=5, maxl=2000)}, ["reason"], closed=True)
    S["OptionalReason"] = obj({"reason": nul(s(maxl=2000))}, closed=True)
    S["ApproveRequest"] = obj({"comment": nul(s(maxl=2000))}, closed=True)
    S["MarkPaidRequest"] = obj({"payment_reference": s(minl=3, maxl=120), "paid_at": DT, "notes": nul(s(maxl=2000))},
                               ["payment_reference", "paid_at"], closed=True)
    S["Adjustment"] = obj({"id": UUID, "user_id": UUID, "direction": E("AdjustmentDirection"), "amount_micros": micros(),
                           "reason_code": E("AdjustmentReason"), "reason": s(), "journal_id": UUID, "created_by": UUID, "created_at": DT},
                          ["id", "user_id", "direction", "amount_micros", "reason_code", "reason", "journal_id", "created_by", "created_at"])
    S["AdjustmentCreate"] = obj({"user_id": UUID, "direction": E("AdjustmentDirection"), "amount_micros": {"type": "integer", "format": "int64", "minimum": 1},
                                 "reason_code": E("AdjustmentReason"), "reason": s(minl=10, maxl=2000), "related_entity": nul(obj({"type": s(), "id": UUID}))},
                                ["user_id", "direction", "amount_micros", "reason_code", "reason"], closed=True)
    S["PricingRule"] = obj({"id": UUID, "data_class": E("DataClass"), "rate_micros_per_gb": micros(), "effective_from": DT,
                            "effective_to": nul(DT), "note": nul(s()), "created_by": UUID, "created_at": DT},
                           ["id", "data_class", "rate_micros_per_gb", "effective_from", "created_by", "created_at"])
    S["PricingRuleCreate"] = obj({"data_class": E("DataClass"), "rate_micros_per_gb": {"type": "integer", "format": "int64", "minimum": 1, "maximum": 1000000000},
                                  "effective_from": DT, "note": s(minl=5, maxl=1000)}, ["data_class", "rate_micros_per_gb", "effective_from", "note"], closed=True)
    S["PricingRuleList"] = obj({"items": arr(E("PricingRule"))}, ["items"])
    S["FinanceOverview"] = obj({
        "currency": en("USD"), "liabilities": obj({"pending_micros": micros(), "available_micros": micros(), "reserved_micros": micros()}),
        "paid_lifetime_micros": micros(), "paid_this_month_micros": micros(), "earned_this_month_micros": micros(),
        "open_payouts": obj({"requested_count": INT, "requested_micros": micros(), "approved_count": INT, "approved_micros": micros(),
                             "awaiting_second_approval_count": INT}),
        "last_reconciliation": nul(obj({"run_at": DT, "status": en("ok", "mismatch")})),
    }, ["currency", "liabilities", "paid_lifetime_micros", "open_payouts"])
    S["Reconciliation"] = obj({"run_at": nul(DT), "status": en("ok", "mismatch", "never_run"), "wallets_checked": INT,
                               "journal_imbalances": INT, "mismatches": arr(obj({"wallet_id": UUID, "bucket": E("LedgerBucket"),
                                                                                 "cached_micros": micros(signed=True), "computed_micros": micros(signed=True)}))},
                              ["run_at", "status", "wallets_checked", "journal_imbalances", "mismatches"])
    S["RewardTotals"] = obj({"approved_count": INT, "total_micros": micros(), "pending_review_count": INT}, ["approved_count", "total_micros"])

    # ---------- annotation ----------
    S["MetadataField"] = obj({"key": s(pattern="^[a-z][a-z0-9_]{0,39}$"), "label": s(maxl=80), "type": en("text", "number", "date", "select"),
                              "options": arr(s(maxl=80), maxItems=100), "required": BOOL}, ["key", "label", "type", "required"], closed=True)
    PROJ = {"name": s(minl=3, maxl=150), "instructions": s(maxl=50000, desc="Markdown, rendered sanitised."),
            "annotation_types": arr(E("AnnotationType"), minItems=1, uniqueItems=True),
            "label_set": arr(s(minl=1, maxl=80), maxItems=200, uniqueItems=True), "metadata_schema": arr(E("MetadataField"), maxItems=50),
            "task_unit": E("TaskUnit"), "reward_per_task_micros": micros(), "reward_per_page_micros": micros(), "deadline": nul(DT)}
    S["AnnotationProjectCreate"] = obj(dict(PROJ, dataset_ids=arr(UUID, minItems=1, maxItems=200, uniqueItems=True)),
                                       ["name", "instructions", "annotation_types", "task_unit", "reward_per_task_micros", "dataset_ids"], closed=True)
    S["AnnotationProjectUpdate"] = obj(dict(PROJ, dataset_ids=arr(UUID, maxItems=200, uniqueItems=True)), closed=True,
                                       desc="task_unit and annotation_types are immutable once tasks exist; reward changes apply to tasks approved after the change.")
    S["AnnotationProgress"] = obj({k: INT for k in ["total", "unassigned", "assigned", "in_progress", "submitted", "in_review", "approved", "changes_requested", "cancelled"]})
    S["AnnotationProject"] = obj(dict(PROJ, id=UUID, status=E("AnnotationProjectStatus"), review_required={"type": "boolean", "const": True},
                                      dataset_ids=arr(UUID), progress=E("AnnotationProgress"), created_by=UUID, created_at=DT, closed_at=nul(DT), version=INT),
                                 ["id", "name", "annotation_types", "task_unit", "reward_per_task_micros", "status", "dataset_ids", "progress", "created_at", "version"])
    S["GenerateTasksRequest"] = obj({"dataset_ids": arr(UUID, maxItems=200), "file_ids": arr(UUID, maxItems=10000), "dry_run": {"type": "boolean", "default": False}}, closed=True)
    S["GenerateTasksResult"] = obj({"created": INT, "skipped_existing": INT, "skipped_ineligible": INT, "dry_run": BOOL}, ["created", "skipped_existing", "skipped_ineligible", "dry_run"])
    S["AssignRequest"] = obj({"annotator_id": UUID, "due_at": nul(DT)}, ["annotator_id"], closed=True)
    S["BulkAssignRequest"] = obj({"assignments": arr(obj({"task_id": UUID, "annotator_id": UUID}, ["task_id", "annotator_id"], closed=True), minItems=1, maxItems=500),
                                  "due_at": nul(DT)}, ["assignments"], closed=True)
    S["BulkAssignResult"] = obj({"assigned": INT, "failed": arr(obj({"task_id": UUID, "code": s()}, ["task_id", "code"]))}, ["assigned", "failed"])
    S["AnnotationPage"] = obj({"page": {"type": "integer", "minimum": 1}, "transcription": nul(s(maxl=200000, desc="Stored verbatim (no NFC).")),
                               "corrected_text": nul(s(maxl=200000)), "page_label": nul(s(maxl=80)), "regions": arr(ANY, maxItems=0, description="Reserved for bbox (v2); must be empty in v1.")},
                              ["page"], closed=True)
    S["AnnotationData"] = obj({"pages": arr(E("AnnotationPage"), maxItems=500), "classification": arr(s(maxl=80), maxItems=50),
                               "metadata": {"type": "object", "additionalProperties": {"type": ["string", "number", "null"]}}, "notes": nul(s(maxl=10000))},
                              ["pages"], closed=True)
    S["Annotation"] = obj({"id": UUID, "task_id": UUID, "data": E("AnnotationData"), "version": {"type": "integer", "minimum": 0},
                           "content_sha256": SHA256, "updated_by": UUID, "updated_at": DT}, ["id", "task_id", "data", "version", "content_sha256", "updated_at"])
    S["AnnotationReview"] = obj({"id": UUID, "task_id": UUID, "annotation_version": INT, "reviewer_id": UUID, "reviewer_name": s(),
                                 "decision": nul(E("AnnotationReviewDecision")), "score": nul({"type": "integer", "minimum": 1, "maximum": 5}),
                                 "comments": nul(s()), "page_comments": arr(obj({"page": INT, "comment": s()})), "claimed_at": DT, "decided_at": nul(DT)},
                                ["id", "task_id", "annotation_version", "reviewer_id", "claimed_at"])
    S["AnnotationTask"] = obj({
        "id": UUID, "project_id": UUID, "project_name": s(), "dataset_id": UUID, "file_id": UUID, "original_filename": s(),
        "page_number": nul({"type": "integer", "minimum": 1}), "page_count": INT, "status": E("AnnotationTaskStatus"),
        "assignee_id": nul(UUID), "assignee_name": nul(s()), "reviewer_id": nul(UUID), "due_at": nul(DT), "reward_micros": micros(),
        "annotation_version": nul(INT), "submitted_at": nul(DT), "approved_at": nul(DT), "latest_review": nul(E("AnnotationReview")), "created_at": DT,
    }, ["id", "project_id", "dataset_id", "file_id", "page_count", "status", "reward_micros", "created_at"])
    S["AnnotationTaskDetail"] = obj({"task": E("AnnotationTask"), "project": obj({"id": UUID, "name": s(), "instructions": s(), "annotation_types": arr(E("AnnotationType")),
                                                                                   "label_set": arr(s()), "metadata_schema": arr(E("MetadataField"))}),
                                     "file": E("DatasetFile"), "annotation": nul(E("Annotation")), "reviews": arr(E("AnnotationReview"))},
                                    ["task", "project", "file", "annotation", "reviews"])
    S["DraftRequest"] = obj({"data": E("AnnotationData")}, ["data"], closed=True)
    S["DraftSaved"] = obj({"version": INT, "content_sha256": SHA256, "version_created": BOOL, "saved_at": DT}, ["version", "content_sha256", "version_created", "saved_at"])
    S["SubmitAnnotationRequest"] = obj({"version": {"type": "integer", "minimum": 1}}, ["version"], closed=True)
    S["AnnotationVersion"] = obj({"id": UUID, "annotation_id": UUID, "version": INT, "kind": en("draft", "submitted"), "data": E("AnnotationData"),
                                  "content_sha256": SHA256, "created_by": UUID, "created_at": DT}, ["id", "annotation_id", "version", "kind", "content_sha256", "created_by", "created_at"])
    S["AnnotationReviewRequest"] = obj({"decision": E("AnnotationReviewDecision"), "score": {"type": "integer", "minimum": 1, "maximum": 5},
                                        "comments": nul(s(maxl=10000)), "page_comments": arr(obj({"page": {"type": "integer", "minimum": 1}, "comment": s(minl=1, maxl=2000)}, ["page", "comment"], closed=True), maxItems=500)},
                                       ["decision", "score"], closed=True)
    S["AnnotationReviewResult"] = obj({"task": E("AnnotationTask"), "review": E("AnnotationReview"), "reward": nul(E("Reward"))}, ["task", "review", "reward"])
    S["Reward"] = obj({"id": UUID, "user_id": UUID, "task_id": UUID, "project_id": UUID, "project_name": s(), "annotation_review_id": UUID,
                       "pages": INT, "amount_micros": micros(), "journal_id": UUID, "created_at": DT},
                      ["id", "user_id", "task_id", "project_id", "annotation_review_id", "amount_micros", "journal_id", "created_at"])

    # ---------- messaging ----------
    S["Participant"] = obj({"user_id": UUID, "display_name": s(), "is_staff": BOOL, "last_read_at": nul(DT)}, ["user_id", "display_name", "is_staff"])
    S["Conversation"] = obj({"id": UUID, "kind": E("ConversationKind"), "subject": s(), "status": E("ConversationStatus"), "dataset_id": nul(UUID),
                             "created_by": UUID, "assigned_admin_id": nul(UUID), "participants": arr(E("Participant")), "unread_count": INT,
                             "last_message_at": nul(DT), "last_message_preview": nul(s(maxl=140)), "created_at": DT, "updated_at": DT},
                            ["id", "kind", "subject", "status", "created_by", "participants", "unread_count", "created_at", "updated_at"])
    S["ConversationCreate"] = obj({"subject": s(minl=3, maxl=150), "body": s(minl=1, maxl=10000), "dataset_id": nul(UUID),
                                   "participant_user_id": nul(UUID), "attachment_ids": arr(UUID, maxItems=5, uniqueItems=True)},
                                  ["subject", "body"], closed=True)
    S["ConversationUpdate"] = obj({"status": E("ConversationStatus"), "assigned_admin_id": nul(UUID), "subject": s(minl=3, maxl=150)}, closed=True)
    S["Attachment"] = obj({"id": UUID, "filename": s(maxl=255), "content_type": s(), "size_bytes": BYTES, "scan_status": E("AttachmentScanStatus"),
                           "message_id": nul(UUID), "uploaded_by": UUID, "created_at": DT}, ["id", "filename", "content_type", "size_bytes", "scan_status", "uploaded_by", "created_at"])
    S["AttachmentUpload"] = obj({"file": {"type": "string", "contentMediaType": "application/octet-stream", "description": "≤ 10 MB; pdf, png, jpg, txt, csv, docx, xlsx, zip."}}, ["file"])
    S["Message"] = obj({"id": UUID, "conversation_id": UUID, "sender_id": UUID, "sender_name": s(), "sender_is_staff": BOOL,
                        "body": s(), "attachments": arr(E("Attachment")), "created_at": DT}, ["id", "conversation_id", "sender_id", "sender_is_staff", "body", "attachments", "created_at"])
    S["MessageCreate"] = obj({"body": s(minl=1, maxl=10000), "attachment_ids": arr(UUID, maxItems=5, uniqueItems=True)}, ["body"], closed=True)
    S["ReadMarker"] = obj({"last_read_message_id": UUID}, ["last_read_message_id"], closed=True)
    S["ConversationDetail"] = obj({"conversation": E("Conversation"), "first_message": nul(E("Message"))}, ["conversation"])
    S["Notification"] = obj({"id": UUID, "type": E("NotificationType"), "title": s(), "body": s(), "link": nul(s(desc="Relative app path.")),
                             "data": {"type": "object"}, "read_at": nul(DT), "created_at": DT}, ["id", "type", "title", "body", "data", "created_at"])
    S["UnreadCount"] = obj({"unread": INT}, ["unread"])

    # ---------- admin ----------
    S["AdminUserDetail"] = obj({"user": E("User"), "profile": E("Profile"), "verification": nul(E("ContributorVerification")),
                                "wallet": nul(E("Wallet")), "stats": obj({"datasets": INT, "accepted_bytes": BYTES, "tasks_approved": INT, "open_payouts": INT}),
                                "active_sessions": INT, "suspension_reason": nul(s())}, ["user", "profile", "stats", "active_sessions"])
    S["AdminDatasetDetail"] = obj({"dataset": E("Dataset"), "reviews": arr(E("Review")),
                                   "versions": arr(obj({"version_number": INT, "submitted_at": nul(DT), "file_count": INT, "total_bytes": BYTES}, ["version_number", "file_count", "total_bytes"])),
                                   "duplicate_flagged_files": INT, "earned_micros": micros(),
                                   "license": obj({"license_version": s(), "accepted_at": DT, "accepted_ip": nul(s())}, ["license_version", "accepted_at"])},
                                  ["dataset", "reviews", "versions", "duplicate_flagged_files", "earned_micros", "license"])
    S["SuspendRequest"] = obj({"reason": s(minl=5, maxl=2000), "notify_user": {"type": "boolean", "default": True}}, ["reason"], closed=True)
    S["RolesUpdate"] = obj({"roles": arr(E("RoleName"), minItems=1, uniqueItems=True), "reason": s(minl=5, maxl=1000)}, ["roles", "reason"], closed=True)
    S["VerificationDecision"] = obj({"decision": en("approved", "rejected", "needs_info"), "reason": nul(s(maxl=2000, desc="Required for rejected/needs_info."))},
                                    ["decision"], closed=True)
    S["TakedownRequest"] = obj({"reason_code": en("rights_claim", "personal_data", "illegal_content", "policy_violation", "owner_request", "other"),
                                "reason": s(minl=10, maxl=5000), "notify_owner": {"type": "boolean", "default": True}}, ["reason_code", "reason"], closed=True)
    S["ExportFilters"] = obj({"dataset_ids": arr(UUID, maxItems=1000), "categories": arr(E("DatasetCategory")), "languages": arr(E("Language")),
                              "min_quality": nul({"type": "number", "minimum": 1, "maximum": 5}), "data_class": nul(E("DataClass")),
                              "finalized_from": nul(DT), "finalized_to": nul(DT)}, closed=True)
    S["ExportCreate"] = obj({"filters": E("ExportFilters"), "format": E("ExportFormat"), "include_metadata": {"type": "boolean", "default": True},
                             "include_annotations": {"type": "boolean", "default": False}, "note": nul(s(maxl=500))}, ["filters", "format"], closed=True)
    S["ExportFile"] = obj({"id": UUID, "name": s(), "size_bytes": BYTES, "sha256": SHA256}, ["id", "name", "size_bytes", "sha256"])
    S["ExportJob"] = obj({"id": UUID, "status": E("ExportStatus"), "requested_by": UUID, "filters": E("ExportFilters"), "format": E("ExportFormat"),
                          "include_metadata": BOOL, "include_annotations": BOOL, "progress_percent": {"type": "integer", "minimum": 0, "maximum": 100},
                          "dataset_count": INT, "file_count": INT, "total_bytes": BYTES, "files": arr(E("ExportFile")), "error": nul(s()),
                          "created_at": DT, "started_at": nul(DT), "completed_at": nul(DT), "expires_at": nul(DT)},
                         ["id", "status", "requested_by", "filters", "format", "progress_percent", "files", "created_at"])
    S["ExportDownloadRequest"] = obj({"file_id": UUID}, ["file_id"], closed=True)
    S["AnalyticsOverview"] = obj({"from": DATE, "to": DATE, "users": obj({"registered": INT, "verified_contributors": INT, "active_30d": INT}),
                                  "datasets": obj({"submitted": INT, "approved": INT, "partially_approved": INT, "rejected": INT, "changes_requested": INT}),
                                  "bytes": obj({"uploaded": BYTES, "accepted_raw": BYTES, "accepted_labeled": BYTES}),
                                  "finance": obj({"earned_micros": micros(), "paid_micros": micros()}),
                                  "annotation": obj({"tasks_approved": INT, "avg_review_score": nul({"type": "number"})}),
                                  "review": obj({"median_hours_to_finalize": nul({"type": "number"}), "queue_depth": INT}),
                                  "series": arr(obj({"date": DATE, "uploaded_bytes": BYTES, "accepted_bytes": BYTES, "earned_micros": micros(), "paid_micros": micros()}))},
                                 ["from", "to", "users", "datasets", "bytes", "finance", "annotation", "review", "series"])
    S["AuditLog"] = obj({"id": UUID, "actor_id": nul(UUID), "actor_email": nul(s()), "action": s(desc="e.g. dataset.submit, payout.approve."),
                         "entity_type": s(), "entity_id": nul(s()), "before": nul({"type": "object"}), "after": nul({"type": "object"}),
                         "ip": nul(s()), "user_agent": nul(s()), "request_id": nul(s()), "created_at": DT},
                        ["id", "action", "entity_type", "created_at"])
    S["SecurityEvent"] = obj({"id": UUID, "user_id": nul(UUID), "email": nul(s()), "event_type": E("SecurityEventType"), "ip": nul(s()),
                              "user_agent": nul(s()), "details": {"type": "object"}, "created_at": DT}, ["id", "event_type", "details", "created_at"])
    S["SystemSetting"] = obj({"key": s(pattern="^[a-z][a-z0-9_]{1,63}$"), "value": ANY, "value_type": en("integer", "boolean", "string", "string_list"),
                              "description": s(), "updated_by": nul(UUID), "updated_at": DT, "version": INT},
                             ["key", "value", "value_type", "description", "updated_at", "version"])
    S["SystemSettingList"] = obj({"items": arr(E("SystemSetting"))}, ["items"])
    S["SettingUpdate"] = obj({"value": ANY, "reason": s(minl=5, maxl=1000)}, ["value", "reason"], closed=True)
    S["RoleDefinition"] = obj({"name": E("RoleName"), "description": s(), "permissions": arr(E("PermissionCode")), "user_count": INT,
                               "requires_mfa": BOOL}, ["name", "description", "permissions", "user_count", "requires_mfa"])
    S["RoleList"] = obj({"items": arr(E("RoleDefinition"))}, ["items"])
    S["RevokeResult"] = obj({"revoked": INT}, ["revoked"])
    return S

PAGINATED = ["User", "Dataset", "DatasetFile", "ReviewQueueItem", "Review", "LedgerLine", "EarningRecord", "Payout",
             "AnnotationProject", "AnnotationTask", "AnnotationVersion", "AnnotationReview", "Reward", "Conversation",
             "Message", "Notification", "ExportJob", "AuditLog", "SecurityEvent", "ContributorVerification", "Adjustment"]

def paginated(S):
    for n in PAGINATED:
        S[f"Paginated{n}"] = {"allOf": [ref("PaginationMeta"), obj({"items": arr(ref(n))}, ["items"])]}
    S["PaginatedRewardWithTotals"] = {"allOf": [ref("PaginatedReward"), obj({"totals": ref("RewardTotals")}, ["totals"])]}
    return S
