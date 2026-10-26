"""Reusable example payloads (consistent ids/values across the docs)."""
U_CON = "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f01"   # contributor
U_ADM = "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f02"   # admin
U_ADM2 = "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f03"  # second admin
U_REV = "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f04"   # reviewer
U_ANN = "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f05"   # annotator
SES = "01930b70-1111-7a00-8000-0000000000a1"
SES2 = "01930b70-1111-7a00-8000-0000000000a2"
DS = "01930b71-2222-7b00-8000-0000000000d1"
F1 = "01930b72-3333-7c00-8000-0000000000f1"
F2 = "01930b72-3333-7c00-8000-0000000000f2"
UP = "01930b73-4444-7d00-8000-0000000000b1"
RV = "01930b74-5555-7e00-8000-0000000000c1"
J1 = "01930b75-6666-7f00-8000-0000000000e1"
L1 = "01930b75-6666-7f00-8000-0000000000e2"
PO = "01930b76-7777-7000-8000-000000000101"
PM = "01930b76-7777-7000-8000-000000000102"
PRJ = "01930b77-8888-7100-8000-000000000201"
TK = "01930b77-8888-7100-8000-000000000202"
AN = "01930b77-8888-7100-8000-000000000203"
AR = "01930b77-8888-7100-8000-000000000204"
RW = "01930b77-8888-7100-8000-000000000205"
CV = "01930b78-9999-7200-8000-000000000301"
MS = "01930b78-9999-7200-8000-000000000302"
AT = "01930b78-9999-7200-8000-000000000303"
NT = "01930b79-aaaa-7300-8000-000000000401"
EX = "01930b7a-bbbb-7400-8000-000000000501"
EXF = "01930b7a-bbbb-7400-8000-000000000502"
PR = "01930b7b-cccc-7500-8000-000000000601"
ADJ = "01930b7b-cccc-7500-8000-000000000602"
VER = "01930b7c-dddd-7600-8000-000000000701"
AUD = "01930b7d-eeee-7700-8000-000000000801"
T = "2026-10-26T08:30:00Z"
T2 = "2026-10-26T09:15:00Z"
SHA = "9f2c4d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d"

USER = {"id": U_CON, "email": "sophea@example.com", "display_name": "Sophea K.", "status": "active", "roles": ["contributor"],
        "email_verified_at": "2026-10-20T03:00:00Z", "verification_status": "approved", "onboarding_completed_at": "2026-10-20T03:05:00Z",
        "mfa_enabled": False, "created_at": "2026-10-20T02:58:00Z", "last_login_at": T}
SESSION_STATE = {"id": SES, "mfa_verified": False, "mfa_required": False, "mfa_enrollment_required": False, "step_up_valid_until": None,
                 "idle_expires_at": "2026-11-02T08:30:00Z", "absolute_expires_at": "2026-11-25T08:30:00Z"}
ME = {"user": USER, "permissions": ["profile.self", "dataset.create", "dataset.read.own", "payout.request", "message.self"],
      "session": SESSION_STATE, "capabilities": {"can_upload": True, "can_withdraw": True, "can_be_assigned_annotation": False, "limited_reason": None}}
SESSION = {"id": SES, "created_at": T, "last_seen_at": T2, "idle_expires_at": "2026-11-02T09:15:00Z", "absolute_expires_at": "2026-11-25T08:30:00Z",
           "ip": "203.0.113.24", "user_agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0", "current": True, "mfa_verified_at": None}
PROFILE = {"user_id": U_CON, "display_name": "Sophea K.", "legal_name": "Sophea Keo", "country": "KH", "phone": "+85512345678",
           "date_of_birth": "1995-04-12", "preferred_language": "km", "timezone": "Asia/Phnom_Penh", "bio": None, "version": 3, "updated_at": T}
PAYOUT_METHOD = {"id": PM, "type": "aba_pay", "label": "My ABA account", "is_default": True,
                 "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}, "created_at": T}
VERIFICATION = {"id": VER, "user_id": U_CON, "status": "pending", "legal_name": "Sophea Keo", "country": "KH", "date_of_birth": "1995-04-12",
                "phone": "+85512345678", "id_document": {"filename": "national-id.jpg", "size_bytes": 412339, "content_type": "image/jpeg"},
                "decision_reason": None, "decided_by": None, "decided_at": None, "submitted_at": T}
DATASET = {"id": DS, "code": "DS-2026-000123", "owner_id": U_CON, "owner_display_name": "Sophea K.", "title": "Khmer newspaper scans 1990–1999",
           "description": "Scanned front pages of Phnom Penh newspapers, 300 dpi.", "data_class": "raw", "category": "news",
           "languages": ["km"], "tags": ["newspaper", "ocr"], "source_description": "Personal archive, scanned by me.",
           "contains_personal_data": False, "personal_data_notes": None, "status": "draft", "version_number": 1, "file_count": 2,
           "ready_file_count": 2, "failed_file_count": 0, "total_bytes": 734003200, "accepted_bytes": None, "earned_micros": None,
           "license_version": "CA-2026-10", "takedown_reason": None, "submitted_at": None, "finalized_at": None,
           "created_at": T, "updated_at": T2, "version": 4}
FILE = {"id": F1, "dataset_id": DS, "parent_file_id": None, "original_filename": "phnom-penh-post-1994-03.pdf",
        "relative_path": "1994/phnom-penh-post-1994-03.pdf", "member_path": None, "extension": "pdf", "declared_mime": "application/pdf",
        "detected_mime": "application/pdf", "size_bytes": 367001600, "sha256": SHA, "processing_status": "ready", "scan_status": "clean",
        "failure_code": None, "failure_message": None, "is_container": False, "page_count": 48,
        "previews": [{"page": 1, "width": 1654, "height": 2339, "content_type": "image/webp"}], "text_available": False,
        "duplicates": [{"kind": "near", "method": "dhash", "distance": 3, "matched_file_id": None, "matched_dataset_id": None,
                        "matched_previously_accepted": True, "same_owner": False}],
        "review_decision": None, "created_at": T, "uploaded_at": T, "processed_at": T2}
UPLOAD = {"upload_id": UP, "dataset_id": DS, "file_id": F2, "filename": "scans-1995.zip", "size_bytes": 1073741824, "part_size": 16777216,
          "part_count": 64, "status": "uploading", "uploaded_parts": [{"part_number": 1, "etag": "\"a54357aff0632cce46d942af68356b38\"", "size_bytes": 16777216}],
          "uploaded_bytes": 16777216, "expires_at": "2026-10-27T08:30:00Z", "created_at": T, "completed_at": None}
REVIEW = {"id": RV, "dataset_id": DS, "dataset_version_number": 1, "reviewer_id": U_REV, "reviewer_name": "Dara R.", "status": "in_progress",
          "decision": None, "data_class": "raw",
          "checklist": {"rights_plausible": True, "matches_description": True, "language_correct": True, "no_unconsented_personal_data": True,
                        "no_copyright_concern": None, "quality_acceptable": True, "metadata_complete": True},
          "quality_scores": {"legibility": 4, "completeness": 5, "accuracy": None, "relevance": 5, "labeling_quality": None},
          "overall_quality": 4.67, "internal_comments": "Check page 12 for faded print.", "feedback": None, "claimed_at": T, "finalized_at": None,
          "released_at": None, "version": 2}
FILE_REVIEW = {"file_id": F1, "decision": "accepted", "reason_code": None, "comment": None, "labeled_upgrade": False, "reviewer_id": U_REV, "reviewed_at": T2}
SUMMARY = {"review_id": RV, "total_files": 2, "decided_files": 2, "undecided_files": 0, "not_reviewable_files": 0, "accepted_files": 1, "rejected_files": 1,
           "accepted_bytes": 367001600, "rejected_bytes": 367001600, "payable_bytes": 367001600, "non_payable_accepted_bytes": 0,
           "labeled_upgrade_files": 0, "data_class": "raw", "rate_micros_per_gb": 1000000, "payable_micros": 367001,
           "rejections_by_reason": {"illegible": 1}, "allowed_decisions": ["partial", "request_changes"]}
WALLET = {"user_id": U_CON, "currency": "USD", "estimated_micros": 734003, "pending_micros": 0, "available_micros": 12367001,
          "reserved_micros": 10000000, "paid_micros": 25000000, "adjustments_micros": 0, "approved_lifetime_micros": 47367001, "updated_at": T2}
LEDGER_LINE = {"id": L1, "journal_id": J1, "kind": "dataset_earning", "wallet_id": "01930b75-6666-7f00-8000-0000000000e9", "user_id": U_CON,
               "bucket": "available", "amount_micros": 367001, "source_type": "dataset_review", "source_id": RV,
               "description": "Earning for “Khmer newspaper scans 1990–1999” (v1)", "created_by": U_REV, "created_at": T2}
EARNING = {"id": "01930b75-6666-7f00-8000-0000000000e3", "user_id": U_CON, "source_type": "dataset_review", "source_id": RV, "dataset_id": DS,
           "file_id": F1, "task_id": None, "accepted_bytes": 367001600, "data_class": "raw", "rate_micros_per_gb": 1000000, "pricing_rule_id": PR,
           "labeled_upgrade": False, "previously_paid_rate_micros_per_gb": None, "amount_micros": 367001, "journal_id": J1, "created_at": T2}
APPROVAL = {"id": "01930b76-7777-7000-8000-000000000103", "payout_id": PO, "approver_id": U_ADM, "approver_name": "Admin Vanna", "comment": None, "created_at": T2}
PAYOUT = {"id": PO, "code": "PO-2026-000042", "user_id": U_CON, "user_display_name": "Sophea K.", "amount_micros": 10000000, "currency": "USD", "status": "requested",
          "payout_method": {"id": PM, "type": "aba_pay", "label": "My ABA account", "details": {"account_name": "KEO SOPHEA", "account_number": "•••• 4821"}},
          "note": None, "approvals_required": 1, "approvals": [], "record": None, "rejection_reason": None, "failure_reason": None,
          "cancellation_reason": None, "reversal_reason": None, "created_at": T, "updated_at": T, "version": 1}
PAYOUT_PAID = dict(PAYOUT, status="paid", approvals=[APPROVAL], version=3, updated_at="2026-10-27T02:00:00Z",
                   record={"id": "01930b76-7777-7000-8000-000000000104", "payout_id": PO, "payment_reference": "ABA-20261027-558812", "method": "aba_pay",
                           "paid_at": "2026-10-27T01:55:00Z", "recorded_by": U_ADM, "notes": None, "proof": None, "created_at": "2026-10-27T02:00:00Z"})
ADJUSTMENT = {"id": ADJ, "user_id": U_CON, "direction": "credit", "amount_micros": 500000, "reason_code": "correction",
              "reason": "Rate rounding correction for dataset v1 (ticket #42).", "journal_id": J1, "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f09", "created_at": T2}
PRICING = {"id": PR, "data_class": "raw", "rate_micros_per_gb": 1000000, "effective_from": "2026-10-01T00:00:00Z", "effective_to": None,
           "note": "Launch rate (HA-06).", "created_by": "01930b6e-8f2a-7c41-9a0e-5b7d2c1e4f09", "created_at": "2026-09-30T00:00:00Z"}
PROGRESS = {"total": 120, "unassigned": 40, "assigned": 20, "in_progress": 15, "submitted": 10, "in_review": 5, "approved": 28, "changes_requested": 2, "cancelled": 0}
PROJECT = {"id": PRJ, "name": "Khmer newspaper transcription — batch 1", "instructions": "Transcribe each page exactly as printed. Keep COENG sequences.",
           "annotation_types": ["transcription", "page_label"], "label_set": ["headline", "article", "advertisement", "mixed"], "metadata_schema": [
               {"key": "publication_date", "label": "Publication date", "type": "date", "options": [], "required": True}],
           "task_unit": "page", "reward_per_task_micros": 0, "reward_per_page_micros": 150000, "deadline": "2026-12-15T00:00:00Z",
           "review_required": True, "status": "active", "dataset_ids": [DS], "progress": PROGRESS, "created_by": U_ADM, "created_at": T,
           "closed_at": None, "version": 1}
ANN_DATA = {"pages": [{"page": 3, "transcription": "ព័ត៌មានថ្ងៃនេះ", "corrected_text": None, "page_label": "article", "regions": []}],
            "classification": [], "metadata": {"publication_date": "1994-03-12"}, "notes": None}
ANNOTATION = {"id": AN, "task_id": TK, "data": ANN_DATA, "version": 7, "content_sha256": SHA, "updated_by": U_ANN, "updated_at": T2}
ANN_REVIEW = {"id": AR, "task_id": TK, "annotation_version": 8, "reviewer_id": U_REV, "reviewer_name": "Dara R.", "decision": "approve", "score": 5,
              "comments": "Accurate.", "page_comments": [], "claimed_at": T2, "decided_at": "2026-10-26T10:00:00Z"}
TASK = {"id": TK, "project_id": PRJ, "project_name": PROJECT["name"], "dataset_id": DS, "file_id": F1, "original_filename": FILE["original_filename"],
        "page_number": 3, "page_count": 1, "status": "in_progress", "assignee_id": U_ANN, "assignee_name": "Bopha A.", "reviewer_id": None,
        "due_at": "2026-11-05T00:00:00Z", "reward_micros": 150000, "annotation_version": 7, "submitted_at": None, "approved_at": None,
        "latest_review": None, "created_at": T}
ANN_VERSION = {"id": "01930b77-8888-7100-8000-000000000206", "annotation_id": AN, "version": 7, "kind": "draft", "data": ANN_DATA,
               "content_sha256": SHA, "created_by": U_ANN, "created_at": T2}
REWARD = {"id": RW, "user_id": U_ANN, "task_id": TK, "project_id": PRJ, "project_name": PROJECT["name"], "annotation_review_id": AR, "pages": 1,
          "amount_micros": 150000, "journal_id": J1, "created_at": "2026-10-26T10:00:00Z"}
ATTACH = {"id": AT, "filename": "receipt.pdf", "content_type": "application/pdf", "size_bytes": 84211, "scan_status": "pending", "message_id": None,
          "uploaded_by": U_CON, "created_at": T}
MESSAGE = {"id": MS, "conversation_id": CV, "sender_id": U_CON, "sender_name": "Sophea K.", "sender_is_staff": False,
           "body": "Hello, my dataset has been in review for a week — any update?", "attachments": [], "created_at": T}
CONVERSATION = {"id": CV, "kind": "dataset", "subject": "Question about newspaper dataset", "status": "open", "dataset_id": DS, "created_by": U_CON,
                "assigned_admin_id": None, "participants": [{"user_id": U_CON, "display_name": "Sophea K.", "is_staff": False, "last_read_at": T}],
                "unread_count": 0, "last_message_at": T, "last_message_preview": "Hello, my dataset has been in review for a week — any update?",
                "created_at": T, "updated_at": T}
NOTIF = {"id": NT, "type": "dataset_approved", "title": "Dataset approved", "body": "“Khmer newspaper scans 1990–1999” was approved. $0.36 credited.",
         "link": f"/datasets/{DS}", "data": {"dataset_id": DS}, "read_at": None, "created_at": T2}
EXPORT = {"id": EX, "code": "EX-2026-000007", "status": "completed", "requested_by": U_ADM,
          "filters": {"dataset_ids": [], "categories": ["news"], "languages": ["km"], "min_quality": 4, "data_class": None, "finalized_from": None, "finalized_to": None},
          "format": "zip_originals", "include_metadata": True, "include_annotations": True, "progress_percent": 100, "dataset_count": 12,
          "file_count": 1840, "total_bytes": 48318382080, "files": [{"id": EXF, "name": "datahub-export-01930b7a-part-001.zip", "size_bytes": 3998712041, "sha256": SHA}],
          "error": None, "created_at": T, "started_at": T, "completed_at": T2, "expires_at": "2026-11-02T09:15:00Z"}
AUDIT = {"id": AUD, "actor_id": U_ADM, "actor_email": "vanna@datahub.example", "action": "payout.approve", "entity_type": "payout_request",
         "entity_id": PO, "before": {"status": "requested"}, "after": {"status": "approved"}, "ip": "198.51.100.7",
         "user_agent": "Mozilla/5.0", "request_id": "req_01JBA7Q4M8", "created_at": T2}
SETTING = {"key": "payout_dual_approval_threshold_micros", "value": 100000000, "value_type": "integer",
           "description": "Payouts ≥ this amount need two distinct approvers (HA-07).", "updated_by": None, "updated_at": T, "version": 1}

TAKEDOWN = {"id": "01930b7f-0000-7900-8000-000000000a01", "source": "public_form", "status": "received", "claim_type": "copyright",
            "dataset_id": DS, "dataset_code": "DS-2026-000123", "dataset_status": "approved", "file_id": None, "requester_user_id": None,
            "requester_name": "Chan Vuthy", "requester_email": "rights@publisher.example", "requester_organization": "Angkor Press Co.",
            "description": "Pages 1–48 of this dataset are scans of our 1994 newspaper editions, reproduced without permission.",
            "evidence_url": "https://publisher.example/catalogue/1994", "decided_by": None, "decided_at": None, "decision_notes": None,
            "created_at": T, "updated_at": T}

def page(items, total=None):
    return {"items": items, "page": 1, "page_size": 25, "total": total if total is not None else len(items)}
