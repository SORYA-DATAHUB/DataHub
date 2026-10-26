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
| `deletion.invalid_state` | 409 | This deletion request cannot change from its current status. | Decision on processing/completed/rejected/cancelled request, or invalid transition. |
| `deletion.has_blockers` | 409 | This account deletion still has unresolved blockers. | Approval/processing attempted while open payout, positive balance, active review/task or legal hold exists; details.blockers. |
| `job.not_requeueable` | 409 | Only failed or dead idempotent jobs can be re-enqueued. | Job is not failed/dead or task is not in the explicit safe-requeue registry. |
| `job.already_inflight` | 409 | An equivalent job is already queued or running. | Unique task_name/args_hash in-flight guard found an existing job. |
| `legal_hold.invalid_state` | 409 | The legal hold is already in the requested state. | Set on an already-held record or release on a record without an active hold. |
| `takedown.invalid_state` | 409 | This takedown request has already been decided. | Decision on a request in actioned/rejected/withdrawn, or a transition not allowed from the current status (details.status). |
| `takedown.dataset_not_taken_down` | 409 | Take the dataset down before marking the request actioned. | decision=actioned, linked dataset not taken_down and apply_takedown=false. |
| `takedown.no_target` | 422 | This request is not linked to a dataset. | decision=actioned with apply_takedown=true but dataset_id is null (set it with dataset_id in the decision). |
| `export.not_ready` | 409 | This export has not completed. | download-url before completed. |
| `export.expired` | 409 | This export has expired. Create a new one. | download-url after expires_at. |
| `export.empty_selection` | 422 | No datasets match the selection. | Filters match zero approved/partially approved datasets. |
| `settings.unknown_key` | 404 | Unknown setting. | PUT on a key outside the registry. |
| `settings.invalid_value` | 422 | Invalid value for this setting. | Type/range check failure; details.constraint. |