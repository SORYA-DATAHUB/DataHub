# DataHub — Database Schema Documentation

## Document control

| Field | Value |
|---|---|
| Document | `docs/02-system-architecture/DATABASE_SCHEMA.md` (mandatory document #12) |
| Version | v1.0 |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | CTO role (data architecture) |
| Canonical source | `docs/ENGINEERING_BASELINE.md` §8, §9, §10 — the baseline wins on conflict |
| Companion documents | `ERD.md` (diagrams of the same tables), `LLD.md` (services that own each table) |
| Change control | Any column/constraint change after v1.0 requires an Alembic revision **and** an update to this document in the same pull request; contract-level changes are recorded in `DECISION_LOG.md`. |

## Purpose

Define every PostgreSQL 17 table of DataHub — columns, types, nullability, defaults, primary keys, foreign keys with `ON DELETE` behaviour, indexes, unique / partial-unique / exclusion constraints, check constraints, triggers, relationships and retention — so that the SQLAlchemy models and Alembic migrations can be written mechanically from this document. **Column names in this document are the implementation contract.**

## Scope

- All 54 tables enumerated in baseline §10 (identity 11, datasets 9, review 3, finance 9, annotation 9, communication 6, operations 7). No other tables exist in v1.
- Database-level integrity mechanisms: ledger triggers, zero-sum constraint trigger, partial unique indexes, the `pricing_rules` exclusion constraint, audit-log immutability.
- Enum strategy, identifier strategy, timestamp strategy, soft-delete/anonymisation strategy, retention rules, Alembic migration strategy and migration tests.
- Out of scope: query-level design (see `LLD.md`), object-storage layout (see `docs/04-backend-api/FILE_UPLOAD_STORAGE_SPEC.md`), backup procedure (see `docs/07-deployment-operations/BACKUP_DR_PLAN.md`).

## Assumptions

| ID | Assumption |
|---|---|
| A-04 | (baseline) Money is integer micro-USD in `BIGINT` columns suffixed `_micros`; payouts are whole cents (`amount_micros % 10000 = 0`). |
| A-13 | (baseline) Every timestamp is `timestamptz`, stored and compared in UTC. |
| A-15 | (baseline) Retention defaults: rejected dataset objects 90 d; withdrawn drafts 30 d; abandoned upload sessions 24 h; exports 7 d; audit/financial records 7 y; security events 1 y. |
| A-DB-01 | The database role used by the application (`datahub_app`) owns no DDL rights in production; migrations run as `datahub_migrator`. |
| A-DB-02 | Row volumes in year 1 stay below: `dataset_files` 20 M, `wallet_transactions` 5 M, `audit_logs` 30 M, `messages` 2 M. Declarative partitioning is therefore not used in v1; `BRIN` indexes on append-only time columns keep scans cheap. |
| A-DB-03 | The server encoding is `UTF8`, collation `C.UTF-8` for deterministic byte ordering; human-facing sorting of Khmer/English names is done in the application or with explicit `COLLATE "und-x-icu"`. |
| A-DB-04 | Required extensions are available in all environments: `citext`, `btree_gist`, `pg_trgm` (all ship with PostgreSQL contrib). |

## Decisions

| ID | Decision | Rationale |
|---|---|---|
| D-DB-01 | **Enums are `VARCHAR(32)` + named `CHECK` constraints**, never native PostgreSQL `ENUM` types. | Adding/removing a value is a single `ALTER TABLE … DROP CONSTRAINT / ADD CONSTRAINT … NOT VALID` + `VALIDATE`, which is transactional and expand/contract-friendly; native enums cannot drop values and `ALTER TYPE … ADD VALUE` has transaction restrictions. Python `StrEnum` classes in each module's `models.py` are the single source for allowed values; a migration test asserts the CHECK lists equal the `StrEnum` members. |
| D-DB-02 | **Primary keys are `uuid` generated in the application** as UUIDv7 (`uuid6.uuid7()` until stdlib `uuid.uuid7` is available in the pinned Python), with **no database default**. | Time-ordered keys keep B-tree inserts local; IDs are known before insert so that polymorphic references (e.g. `ledger_journals.source_id`) and storage keys can be built inside the same transaction. |
| D-DB-03 | Users are **never hard-deleted**; account deletion is **anonymisation** (§7). Foreign keys to `users` are `ON DELETE RESTRICT`. | Financial and audit records must remain attributable for 7 years (A-15). |
| D-DB-04 | Composition children (rows meaningless without their parent, e.g. `file_previews`) use `ON DELETE CASCADE`; every reference into finance, review or audit tables uses `ON DELETE RESTRICT`. | Hard deletion is only possible for data that never entered review/finance (e.g. withdrawn drafts), which is exactly what retention needs. |
| D-DB-05 | Ledger tables (`ledger_journals`, `wallet_transactions`) are append-only, enforced by triggers; `audit_logs` is append-only except for a guarded retention purge. | Baseline §8.5 and §9. |
| D-DB-06 | `wallets` holds cached per-bucket balances **for user wallets only**; system wallets keep no cached balance (computed from lines). | Avoids a hot row lock on system wallets that every journal would otherwise contend on; user wallets must be locked anyway (§8.5 concurrency rule). |
| D-DB-07 | `updated_at` is maintained by the application (SQLAlchemy `onupdate=func.now()`), not by triggers. | Keeps trigger surface limited to integrity rules; bulk SQL updates in services must set `updated_at` explicitly (lint rule in code review checklist). |
| D-DB-08 | Content-hash duplicate payment is prevented at the database level by two partial unique indexes on `earning_records.sha256` (first payment, labeled upgrade) in addition to service-level advisory locks. | "Do not allow the same approval action to credit a contributor twice" must hold even under concurrent finalisation of two datasets containing the same file. |
| D-DB-09 | Free-text search uses `pg_trgm` GIN indexes (not `tsvector`). | Khmer has no inter-word spaces; trigram matching works on character sequences for both Khmer and English without a Khmer text-search dictionary. |
| D-DB-10 | Sensitive secrets stored in the database (TOTP secrets, one-time email link context) are encrypted at application level (`cryptography` MultiFernet, key from `FIELD_ENCRYPTION_KEYS`) and stored as `bytea`. Tokens (sessions, email links, recovery codes) are stored only as SHA-256 hashes. | A database dump alone never yields a usable credential. |

## Dependencies

- `docs/ENGINEERING_BASELINE.md` v1.0 (§6 roles, §7 formats, §8 money, §9 state machines, §10 tables, §11 annotation, §13 jobs).
- `docs/_source/MASTER_PROMPT.md` Part 7 (database implementation), Parts 9–14.
- `ERD.md` v1.0 and `LLD.md` v1.0 (same baseline date) — must stay consistent with this document.
- PostgreSQL 17 with extensions `citext`, `btree_gist`, `pg_trgm`; SQLAlchemy 2.0; Alembic.

## Acceptance criteria

1. Every table named in baseline §10 is specified in §4 with all columns, types, nullability and defaults; no other table is required by `LLD.md`.
2. Every baseline §10 "key constraint" appears verbatim in §5 and in the owning table section.
3. All money columns are `BIGINT` and end in `_micros`; all byte sizes are `BIGINT` and end in `_bytes`; all status/enum columns are `VARCHAR(32)` (or `VARCHAR(64)` where the value list is long, stated explicitly) with a named CHECK.
4. The ledger triggers in §6 reject: an unbalanced journal at commit, a journal with < 2 lines, any `UPDATE`/`DELETE`/`TRUNCATE` on journals or lines, a bucket that does not match the wallet kind.
5. `alembic upgrade head` on an empty PostgreSQL 17 database followed by `alembic check` reports no drift between models and schema (§8.6).
6. Retention for every table is stated (§4 per table and summarised in §7.3).

---

## 1. Global conventions

### 1.1 Naming

| Object | Convention | Example |
|---|---|---|
| Table | plural `snake_case` | `dataset_files` |
| Column | `snake_case`; FK = `<entity>_id`; actor FKs end `_by` (e.g. `decided_by`) | `owner_id`, `decided_by` |
| Money | `BIGINT`, suffix `_micros` (1 USD = 1,000,000) | `amount_micros` |
| Rate | `BIGINT`, `rate_micros_per_gb` | `rate_micros_per_gb` |
| Byte size | `BIGINT`, suffix `_bytes` | `size_bytes` |
| Status / enum | `VARCHAR(32)` + CHECK `ck_<table>_<column>_enum` | `ck_datasets_status_enum` |
| Timestamps | `timestamptz`, suffix `_at` | `submitted_at` |
| Booleans | positive phrasing, `NOT NULL` with default | `is_container`, `labeled_upgrade` |
| Hashes | `bytea` of exact length (CHECK `octet_length`) | `sha256` (32 bytes) |
| Object storage keys | `VARCHAR(512)`, suffix `_object_key` or `storage_key` | `storage_key` |

Constraint names follow the SQLAlchemy `MetaData(naming_convention=…)` used by Alembic:

```python
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
```

Partial unique indexes and exclusion constraints are named explicitly (`uq_<table>_<purpose>`, `ex_<table>_<purpose>`). Any generated name longer than 63 bytes is replaced by an explicit shorter name in the model (PostgreSQL truncates silently otherwise; a migration test asserts no name exceeds 63 bytes).

### 1.2 Identifiers and timestamps

- `id uuid PRIMARY KEY` — UUIDv7 generated by the application (D-DB-02); no DB default.
- Mutable tables: `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` (app-maintained, D-DB-07).
- Append-only tables (`ledger_journals`, `wallet_transactions`, `audit_logs`, `security_events`, `agreement_acceptances`, `payout_approvals`, `payout_adjustments`, `pricing_rules`, `annotation_versions`, `dataset_versions`): `created_at` only (plus a domain time such as `occurred_at` where noted).
- Optimistic locking columns: `lock_version integer NOT NULL DEFAULT 1` mapped with SQLAlchemy `version_id_col`; `annotations.version` (baseline §11) is the optimistic lock for annotation drafts and is checked against `If-Match`.

### 1.3 Types used

| Logical type | PostgreSQL type |
|---|---|
| identifier | `uuid` |
| email | `citext` (with CHECK that the stored value is lower-case) |
| money / rates | `bigint` |
| byte sizes | `bigint` |
| short enum | `varchar(32)` |
| short text | `varchar(n)` with explicit n |
| long text | `text` (length checked by CHECK where a limit matters) |
| JSON | `jsonb` (shape validated by Pydantic before write) |
| list of short strings | `text[]` |
| IP address | `inet` |
| hash | `bytea` |
| counts / page numbers | `integer` (`smallint` for scores 1–5 and attempts) |
| similarity | `numeric(5,4)` (non-monetary) |

Floating-point types (`real`, `double precision`) are **not used anywhere** in the schema.

### 1.4 Required extensions and helper functions (revision 0001)

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Helper trigger functions (`dh_forbid_mutation`, `dh_ledger_check_journal_balanced`, `dh_ledger_check_bucket`, `dh_pricing_rules_guard`, `dh_audit_logs_guard`) are defined in §6.

### 1.5 Legend for table sections

`Null`: `N` = `NOT NULL`, `Y` = nullable. `FK → t(c) [R|C|SN]` = foreign key with `ON DELETE RESTRICT`, `CASCADE`, `SET NULL`. All FKs are `ON UPDATE NO ACTION` (primary keys never change). FK columns always have a supporting index (either listed explicitly or as the leading column of a listed composite/unique index).

---

## 2. Table inventory

| # | Domain | Table | Owning module | Mutability | Retention (summary) |
|---|---|---|---|---|---|
| 1 | Identity | `users` | identity | mutable, never deleted | anonymised on deletion; row kept |
| 2 | Identity | `user_profiles` | identity | mutable | PII nulled on anonymisation |
| 3 | Identity | `roles` | identity | seed + super_admin edits | permanent |
| 4 | Identity | `user_roles` | identity | mutable | deleted on anonymisation |
| 5 | Identity | `user_sessions` | identity | mutable | deleted 30 d after expiry/revocation |
| 6 | Identity | `email_verifications` | identity | mutable | deleted 30 d after expiry/consumption |
| 7 | Identity | `contributor_verifications` | identity | mutable until decided | PII nulled 7 y after last financial activity |
| 8 | Identity | `payout_methods` | identity | soft-delete | details redacted on anonymisation; row kept 7 y |
| 9 | Identity | `agreement_acceptances` | identity | append-only | 7 y after account closure |
| 10 | Identity | `security_events` | identity | append-only | 1 y |
| 11 | Identity | `mfa_recovery_codes` | identity | mutable | deleted on regeneration / MFA disable / anonymisation |
| 12 | Datasets | `datasets` | datasets | mutable | row kept while referenced by review/finance; drafts purged |
| 13 | Datasets | `dataset_versions` | datasets | append-only | with dataset |
| 14 | Datasets | `dataset_files` | datasets | mutable | objects purged per §7.3; rows kept while referenced |
| 15 | Datasets | `dataset_metadata` | datasets | mutable | with dataset |
| 16 | Datasets | `upload_sessions` | datasets | mutable | deleted 30 d after terminal state |
| 17 | Datasets | `upload_parts` | datasets | cache | deleted with session |
| 18 | Datasets | `dataset_licenses` | datasets | mutable (revocation) | with dataset; 7 y if earnings exist |
| 19 | Datasets | `dataset_duplicates` | datasets (processing writes) | upsert | with file |
| 20 | Datasets | `file_previews` | datasets (processing writes) | regenerable | with file / object purge |
| 21 | Review | `dataset_reviews` | review | mutable until finalized | 7 y (financial evidence) |
| 22 | Review | `dataset_file_reviews` | review | mutable until finalized | 7 y |
| 23 | Review | `dataset_quality_scores` | review | mutable until finalized | 7 y |
| 24 | Finance | `pricing_rules` | finance | append-only (+close) | permanent |
| 25 | Finance | `wallets` | finance | cached balances | permanent |
| 26 | Finance | `ledger_journals` | finance | append-only | permanent (≥ 7 y) |
| 27 | Finance | `wallet_transactions` | finance | append-only | permanent (≥ 7 y) |
| 28 | Finance | `earning_records` | finance | append-only except release fields | permanent (≥ 7 y) |
| 29 | Finance | `payout_requests` | finance | state machine | permanent (≥ 7 y) |
| 30 | Finance | `payout_approvals` | finance | append-only | permanent (≥ 7 y) |
| 31 | Finance | `payout_records` | finance | insert + proof attach | permanent (≥ 7 y) |
| 32 | Finance | `payout_adjustments` | finance | append-only | permanent (≥ 7 y) |
| 33 | Annotation | `annotation_projects` | annotation | mutable | permanent |
| 34 | Annotation | `annotation_project_datasets` | annotation | mutable while draft/active | with project |
| 35 | Annotation | `annotation_tasks` | annotation | state machine | permanent |
| 36 | Annotation | `annotation_assignments` | annotation | mutable | permanent |
| 37 | Annotation | `annotations` | annotation | optimistic-locked | permanent |
| 38 | Annotation | `annotation_versions` | annotation | append-only + draft compaction | last 50 drafts + all submitted |
| 39 | Annotation | `annotation_reviews` | annotation | mutable until completed | permanent |
| 40 | Annotation | `annotation_feedback` | annotation | mutable | permanent |
| 41 | Annotation | `annotation_rewards` | annotation | append-only | permanent (≥ 7 y) |
| 42 | Communication | `conversations` | messaging | mutable | 3 y after close |
| 43 | Communication | `conversation_participants` | messaging | mutable | with conversation |
| 44 | Communication | `messages` | messaging | append-only (+moderation hide) | with conversation |
| 45 | Communication | `message_attachments` | messaging | mutable (scan) | with message; unattached 24 h |
| 46 | Communication | `notifications` | messaging | mutable (read) | read 180 d, unread 365 d |
| 47 | Communication | `email_outbox` | messaging | state machine | 90 d after terminal |
| 48 | Operations | `audit_logs` | core (written by all) | append-only | 7 y |
| 49 | Operations | `export_jobs` | exports | state machine | 1 y (objects 7 d) |
| 50 | Operations | `export_files` | exports | mutable (purge) | with job; object 7 d |
| 51 | Operations | `system_settings` | admin | mutable | permanent |
| 52 | Operations | `background_job_records` | core | mutable | succeeded 30 d, failed/dead 180 d |
| 53 | Operations | `takedown_requests` | admin | state machine | 7 y |
| 54 | Operations | `deletion_requests` | identity | state machine | 7 y |

---

## 3. Enum value catalogue (CHECK constraints, D-DB-01)

| Constraint | Column | Allowed values |
|---|---|---|
| `ck_users_status_enum` | `users.status` | `pending_email`, `active`, `suspended`, `deactivated`, `anonymized` |
| `ck_users_verification_status_enum` | `users.verification_status` | `unverified`, `pending`, `approved`, `rejected`, `needs_info` |
| `ck_user_sessions_revoked_reason_enum` | `user_sessions.revoked_reason` | `logout`, `user_revoked`, `revoke_others`, `admin_revoked`, `password_changed`, `password_reset`, `account_suspended`, `account_deactivated`, `mfa_changed`, `expired` |
| `ck_email_verifications_purpose_enum` | `email_verifications.purpose` | `email_verify`, `password_reset` |
| `ck_contributor_verifications_status_enum` | `contributor_verifications.status` | `pending`, `approved`, `rejected`, `needs_info` |
| `ck_payout_methods_method_type_enum` | `payout_methods.method_type`, `payout_requests.method_type`, `payout_records.method_type` | `bank_transfer`, `aba_pay`, `wise`, `paypal`, `other` |
| `ck_agreement_acceptances_agreement_type_enum` | `agreement_acceptances.agreement_type` | `terms_of_service`, `privacy_policy`, `contributor_agreement`, `rights_declaration`, `annotator_agreement` |
| `ck_security_events_event_type_enum` | `security_events.event_type` (`varchar(64)`) | `login_succeeded`, `login_failed`, `login_blocked_status`, `account_locked`, `logout`, `mfa_challenge_succeeded`, `mfa_challenge_failed`, `mfa_enabled`, `mfa_disabled`, `mfa_recovery_code_used`, `password_changed`, `password_reset_requested`, `password_reset_completed`, `email_verified`, `session_revoked`, `sessions_revoked_by_admin`, `csrf_rejected`, `permission_denied`, `rate_limited`, `file_quarantined`, `role_changed`, `account_suspended`, `account_reactivated` |
| `ck_security_events_severity_enum` | `security_events.severity` | `info`, `warning`, `critical` |
| `ck_datasets_status_enum` | `datasets.status` | `draft`, `submitted`, `in_review`, `approved`, `partially_approved`, `rejected`, `changes_requested`, `withdrawn`, `taken_down` |
| `ck_datasets_data_class_enum` | `datasets.data_class`, `dataset_reviews.data_class_declared`, `dataset_reviews.data_class_final`, `pricing_rules.data_class`, `earning_records.data_class` | `raw`, `labeled` |
| `ck_dataset_files_processing_status_enum` | `dataset_files.processing_status` | `pending_upload`, `uploaded`, `processing`, `ready`, `failed`, `quarantined` |
| `ck_dataset_files_scan_status_enum` | `dataset_files.scan_status` | `pending`, `clean`, `infected`, `error`, `skipped_container` |
| `ck_dataset_files_format_enum` | `dataset_files.format` | `pdf`, `docx`, `doc`, `odt`, `rtf`, `txt`, `jpeg`, `png`, `bmp`, `tiff`, `csv`, `json`, `jsonl`, `xml`, `xlsx`, `zip`, `other` |
| `ck_dataset_files_failure_code_enum` | `dataset_files.failure_code` (`varchar(64)`) | `type_mismatch`, `disallowed_type`, `nested_archive`, `archive_limits_exceeded`, `unsafe_member_path`, `encrypted_content`, `corrupt_file`, `size_mismatch`, `scan_size_limit`, `scan_error`, `infected`, `processing_error` |
| `ck_dataset_metadata_value_type_enum` | `dataset_metadata.value_type` | `text`, `integer`, `number`, `boolean`, `date`, `json` |
| `ck_upload_sessions_status_enum` | `upload_sessions.status` | `initiated`, `uploading`, `completed`, `aborted`, `expired` |
| `ck_upload_sessions_abort_reason_enum` | `upload_sessions.abort_reason` | `user_cancelled`, `file_removed`, `dataset_withdrawn`, `size_mismatch`, `quota_exceeded` |
| `ck_dataset_licenses_grant_type_enum` | `dataset_licenses.grant_type` | `non_exclusive_perpetual`, `exclusive_assignment` |
| `ck_dataset_duplicates_kind_enum` | `dataset_duplicates.kind` | `exact`, `near` |
| `ck_dataset_duplicates_method_enum` | `dataset_duplicates.method` | `sha256`, `simhash`, `phash` |
| `ck_file_previews_kind_enum` | `file_previews.kind` | `page_image`, `image`, `thumbnail`, `text`, `table`, `member_list` |
| `ck_dataset_reviews_status_enum` | `dataset_reviews.status` | `in_progress`, `finalized`, `released` |
| `ck_dataset_reviews_decision_enum` | `dataset_reviews.decision` | `approve`, `partial`, `reject`, `request_changes` |
| `ck_dataset_file_reviews_decision_enum` | `dataset_file_reviews.decision` | `accepted`, `rejected` |
| `ck_dataset_file_reviews_reason_code_enum` | `dataset_file_reviews.reason_code` (`varchar(64)`) | `exact_duplicate`, `near_duplicate`, `low_quality`, `illegible`, `wrong_language`, `out_of_scope`, `personal_data`, `rights_concern`, `corrupt_or_empty`, `malicious`, `metadata_mismatch`, `not_eligible_format`, `other` |
| `ck_dataset_quality_scores_dimension_enum` | `dataset_quality_scores.dimension` | `legibility`, `completeness`, `language_accuracy`, `metadata_accuracy`, `label_accuracy`, `uniqueness` |
| `ck_wallets_kind_enum` | `wallets.kind` | `user`, `system` |
| `ck_wallets_system_code_enum` | `wallets.system_code` (`varchar(64)`) | `system_dataset_purchases`, `system_annotation_labor`, `system_adjustments`, `system_payouts_settled` |
| `ck_ledger_journals_kind_enum` | `ledger_journals.kind` | `dataset_earning`, `annotation_reward`, `earning_release`, `payout_reserve`, `payout_release`, `payout_settle`, `payout_reversal`, `adjustment_credit`, `adjustment_debit` |
| `ck_ledger_journals_source_type_enum` | `ledger_journals.source_type` | `dataset_review`, `annotation_review`, `payout_request`, `payout_adjustment` |
| `ck_wallet_transactions_bucket_enum` | `wallet_transactions.bucket` | `pending`, `available`, `reserved`, `paid`, `main` |
| `ck_earning_records_source_type_enum` | `earning_records.source_type` | `dataset_review`, `annotation_review` |
| `ck_earning_records_zero_reason_enum` | `earning_records.zero_reason` | `already_paid`, `duplicate_in_submission`, `rounding`, `zero_rate` |
| `ck_earning_records_bucket_enum` | `earning_records.credited_bucket` | `pending`, `available` |
| `ck_payout_requests_status_enum` | `payout_requests.status` | `requested`, `approved`, `paid`, `rejected`, `cancelled`, `failed`, `reversed` |
| `ck_payout_adjustments_direction_enum` | `payout_adjustments.direction` | `credit`, `debit` |
| `ck_payout_adjustments_reason_code_enum` | `payout_adjustments.reason_code` | `correction`, `bonus`, `clawback`, `fraud_recovery`, `goodwill`, `other` |
| `ck_annotation_projects_status_enum` | `annotation_projects.status` | `draft`, `active`, `closed` |
| `ck_annotation_projects_task_unit_enum` | `annotation_projects.task_unit` | `file`, `page` |
| `ck_annotation_projects_annotation_types_subset` | `annotation_projects.annotation_types` | subset of `transcription`, `text_correction`, `classification`, `metadata`, `page_label` (`bbox` reserved, added by a later expand migration) |
| `ck_annotation_tasks_status_enum` | `annotation_tasks.status` | `unassigned`, `assigned`, `in_progress`, `submitted`, `in_review`, `approved`, `changes_requested`, `cancelled` |
| `ck_annotation_assignments_status_enum` | `annotation_assignments.status` | `active`, `ended` |
| `ck_annotation_assignments_end_reason_enum` | `annotation_assignments.end_reason` | `unassigned`, `reassigned`, `approved`, `cancelled` |
| `ck_annotation_versions_kind_enum` | `annotation_versions.kind` | `draft`, `submitted` |
| `ck_annotation_reviews_status_enum` | `annotation_reviews.status` | `in_progress`, `completed`, `cancelled` |
| `ck_annotation_reviews_decision_enum` | `annotation_reviews.decision` | `approve`, `request_changes` |
| `ck_annotation_feedback_severity_enum` | `annotation_feedback.severity` | `info`, `minor`, `major`, `critical` |
| `ck_conversations_kind_enum` | `conversations.kind` | `support`, `dataset`, `payout`, `annotation_task` |
| `ck_conversations_status_enum` | `conversations.status` | `open`, `awaiting_user`, `closed` |
| `ck_conversation_participants_role_enum` | `conversation_participants.role` | `requester`, `support`, `reviewer`, `annotator`, `observer` |
| `ck_messages_kind_enum` | `messages.kind` | `user`, `system` |
| `ck_message_attachments_scan_status_enum` | `message_attachments.scan_status` | `pending`, `clean`, `infected`, `error` |
| `ck_notifications_type_enum` | `notifications.type` (`varchar(64)`) | `email_verified`, `verification_approved`, `verification_rejected`, `verification_needs_info`, `dataset_received`, `dataset_processing_finished`, `dataset_approved`, `dataset_partially_approved`, `dataset_rejected`, `dataset_changes_requested`, `dataset_taken_down`, `earnings_credited`, `earnings_released`, `withdrawal_requested`, `withdrawal_approved`, `withdrawal_rejected`, `withdrawal_cancelled`, `payment_recorded`, `payment_failed`, `payment_reversed`, `adjustment_posted`, `annotation_assigned`, `annotation_unassigned`, `annotation_returned`, `annotation_approved`, `support_message`, `export_ready`, `export_failed` |
| `ck_email_outbox_status_enum` | `email_outbox.status` | `pending`, `sending`, `sent`, `failed`, `cancelled` |
| `ck_audit_logs_actor_type_enum` | `audit_logs.actor_type` | `user`, `system` |
| `ck_export_jobs_status_enum` | `export_jobs.status` | `queued`, `running`, `completed`, `failed`, `expired` |
| `ck_export_jobs_manifest_format_enum` | `export_jobs.manifest_format` | `jsonl`, `csv`, `json` |
| `ck_system_settings_value_type_enum` | `system_settings.value_type` | `integer`, `boolean`, `string`, `string_list`, `json` |
| `ck_background_job_records_status_enum` | `background_job_records.status` | `queued`, `running`, `retrying`, `succeeded`, `failed`, `dead` |
| `ck_takedown_requests_claim_type_enum` | `takedown_requests.claim_type` | `copyright`, `privacy`, `illegal_content`, `consent_withdrawn`, `other` |
| `ck_takedown_requests_status_enum` | `takedown_requests.status` | `received`, `under_review`, `actioned`, `rejected`, `withdrawn` |
| `ck_takedown_requests_source_enum` | `takedown_requests.source` | `public_form`, `user`, `admin` |
| `ck_deletion_requests_status_enum` | `deletion_requests.status` | `requested`, `processing`, `completed`, `rejected`, `cancelled` |

---

## 4. Tables

### 4.1 Identity

#### 4.1.1 `users`

Account root. Never hard-deleted (D-DB-03). Retention: row permanent; PII anonymised on completed deletion request (§7.2).

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK `pk_users` |
| `email` | citext | N | — | `uq_users_email`; CHECK `ck_users_email_lower`: `email::text = lower(email::text)`; CHECK `ck_users_email_length`: `char_length(email) BETWEEN 3 AND 254` |
| `password_hash` | varchar(255) | Y | — | Argon2id PHC string; CHECK `ck_users_password_hash_present`: `status = 'anonymized' OR password_hash IS NOT NULL` |
| `display_name` | varchar(100) | N | — | CHECK `ck_users_display_name_length`: `char_length(btrim(display_name)) BETWEEN 2 AND 100` |
| `status` | varchar(32) | N | `'pending_email'` | `ck_users_status_enum` |
| `verification_status` | varchar(32) | N | `'unverified'` | `ck_users_verification_status_enum`; mirror of latest `contributor_verifications.status` |
| `email_verified_at` | timestamptz | Y | — | CHECK `ck_users_active_requires_verified_email`: `status <> 'active' OR email_verified_at IS NOT NULL` |
| `onboarding_completed_at` | timestamptz | Y | — | set when contributor agreement + rights declaration accepted (A-09) |
| `mfa_enabled` | boolean | N | `false` | CHECK `ck_users_mfa_secret_when_enabled`: `NOT mfa_enabled OR mfa_secret_encrypted IS NOT NULL` |
| `mfa_secret_encrypted` | bytea | Y | — | MultiFernet ciphertext of base32 TOTP secret (D-DB-10); also holds the pending secret during setup |
| `mfa_enabled_at` | timestamptz | Y | — | |
| `failed_login_count` | integer | N | `0` | CHECK `ck_users_failed_login_count_nonneg`: `>= 0`; reset on success |
| `locked_until` | timestamptz | Y | — | temporary lockout after 10 consecutive failures (15 min) |
| `last_login_at` | timestamptz | Y | — | |
| `password_changed_at` | timestamptz | Y | — | |
| `suspended_at` | timestamptz | Y | — | |
| `suspended_by` | uuid | Y | — | FK → `users(id)` [R] |
| `suspension_reason` | text | Y | — | CHECK `ck_users_suspension_reason_when_suspended`: `status <> 'suspended' OR suspension_reason IS NOT NULL` |
| `deactivated_at` | timestamptz | Y | — | |
| `anonymized_at` | timestamptz | Y | — | CHECK `ck_users_anonymized_at`: `(status = 'anonymized') = (anonymized_at IS NOT NULL)` |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `ix_users_status (status)`; `ix_users_verification_status (verification_status) WHERE verification_status IN ('pending','needs_info')`; `ix_users_created_at (created_at)`; `ix_users_display_name_trgm` GIN (`display_name gin_trgm_ops`); `ix_users_email_trgm` GIN (`(email::text) gin_trgm_ops`) for admin search; `ix_users_suspended_by (suspended_by)`.

Relationships: 1–1 `user_profiles`; 1–N `user_roles`, `user_sessions`, `email_verifications`, `contributor_verifications`, `payout_methods`, `agreement_acceptances`, `security_events`, `mfa_recovery_codes`, `datasets` (owner), `notifications`, …; 0..1 `wallets` (kind `user`).

#### 4.1.2 `user_profiles`

1–1 extension of `users` with personal data (A-08). Retention: PII columns set to NULL on anonymisation.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `user_id` | uuid | N | — | PK `pk_user_profiles`; FK → `users(id)` [C] |
| `legal_name` | varchar(200) | Y | — | |
| `country_code` | char(2) | Y | — | CHECK `ck_user_profiles_country_code_format`: `country_code ~ '^[A-Z]{2}$'` (ISO 3166-1 alpha-2) |
| `date_of_birth` | date | Y | — | 18+ enforced in application (age depends on current date; not expressible as immutable CHECK) |
| `phone` | varchar(32) | Y | — | E.164; CHECK `ck_user_profiles_phone_format`: `phone ~ '^\+[1-9][0-9]{6,14}$'` |
| `organization` | varchar(200) | Y | — | |
| `preferred_locale` | varchar(10) | N | `'en'` | CHECK `ck_user_profiles_preferred_locale_enum`: `IN ('en','km')` |
| `timezone` | varchar(64) | Y | — | IANA name; validated against `zoneinfo.available_timezones()` |
| `notification_preferences` | jsonb | N | `'{}'::jsonb` | `{"<notification type>": {"email": bool}}`; in-app notifications are always on; absent key = default from `messaging.NOTIFICATION_DEFAULTS` |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

#### 4.1.3 `roles`

Role catalogue with permission codes (baseline §6). Seeded by migration with `contributor`, `annotator`, `reviewer`, `admin`, `super_admin`. Retention: permanent.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `code` | varchar(32) | N | — | `uq_roles_code`; CHECK `ck_roles_code_format`: `code ~ '^[a-z][a-z_]{1,31}$'` |
| `name` | varchar(64) | N | — | display name |
| `description` | text | N | `''` | |
| `permissions` | text[] | N | `'{}'` | permission codes from baseline §6; CHECK `ck_roles_permissions_format`: `array_position(permissions, NULL) IS NULL` |
| `is_system` | boolean | N | `true` | system roles cannot be deleted or renamed |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

#### 4.1.4 `user_roles`

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `user_id` | uuid | N | — | PK part 1; FK → `users(id)` [C] |
| `role_id` | uuid | N | — | PK part 2; FK → `roles(id)` [R] |
| `granted_by` | uuid | Y | — | FK → `users(id)` [R]; NULL = system (registration, seed script) |
| `granted_at` | timestamptz | N | `now()` | |

PK `pk_user_roles (user_id, role_id)` (baseline §10). Indexes: `ix_user_roles_role_id (role_id)`; `ix_user_roles_granted_by (granted_by)`. Retention: rows deleted on anonymisation (role history remains in `audit_logs`).

#### 4.1.5 `user_sessions`

Opaque-session store (baseline §3 Auth). The raw 256-bit token lives only in the `dh_session` cookie; the DB keeps its SHA-256. Retention: deleted by `retention.purge` 30 days after `expires_at` or `revoked_at`.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | N | — | FK → `users(id)` [C] |
| `token_hash` | bytea | N | — | `uq_user_sessions_token_hash`; CHECK `ck_user_sessions_token_hash_len`: `octet_length(token_hash) = 32` |
| `created_at` | timestamptz | N | `now()` | |
| `last_seen_at` | timestamptz | N | `now()` | updated at most once per 60 s per session |
| `expires_at` | timestamptz | N | — | absolute expiry (`SESSION_ABSOLUTE_TTL`); CHECK `ck_user_sessions_expiry_after_create`: `expires_at > created_at` |
| `mfa_verified_at` | timestamptz | Y | — | required (non-NULL) for admin endpoints when `ADMIN_MFA_REQUIRED` |
| `revoked_at` | timestamptz | Y | — | |
| `revoked_reason` | varchar(32) | Y | — | `ck_user_sessions_revoked_reason_enum`; CHECK `ck_user_sessions_revocation_consistent`: `(revoked_at IS NULL) = (revoked_reason IS NULL)` |
| `ip_address` | inet | Y | — | IP at creation |
| `last_ip_address` | inet | Y | — | |
| `user_agent` | varchar(512) | Y | — | truncated |

Indexes: `ix_user_sessions_user_id_active (user_id) WHERE revoked_at IS NULL`; `ix_user_sessions_user_id (user_id)`; `ix_user_sessions_expires_at (expires_at)`.

#### 4.1.6 `email_verifications`

Single-use email tokens for email verification and password reset (`purpose`). Retention: deleted 30 days after `expires_at`/`consumed_at`.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | N | — | FK → `users(id)` [C] |
| `purpose` | varchar(32) | N | — | `ck_email_verifications_purpose_enum` |
| `email` | citext | N | — | address the token was sent to; CHECK `ck_email_verifications_email_lower`: `email::text = lower(email::text)` |
| `token_hash` | bytea | N | — | `uq_email_verifications_token_hash`; CHECK `octet_length(token_hash) = 32` (`ck_email_verifications_token_hash_len`) |
| `expires_at` | timestamptz | N | — | verify: 24 h; reset: 60 min |
| `consumed_at` | timestamptz | Y | — | |
| `invalidated_at` | timestamptz | Y | — | set when a newer token for the same purpose is issued |
| `requested_ip` | inet | Y | — | |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `ix_email_verifications_user_id_purpose_open (user_id, purpose) WHERE consumed_at IS NULL AND invalidated_at IS NULL`; `ix_email_verifications_expires_at (expires_at)`.

#### 4.1.7 `contributor_verifications`

Eligibility review submissions (A-08). Latest row per user is current. Retention: `legal_name`, `date_of_birth`, `phone`, ID document are nulled/purged 7 years after the user's last ledger activity or 90 days after a `rejected` decision when the user has no ledger activity.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | N | — | FK → `users(id)` [R] |
| `status` | varchar(32) | N | `'pending'` | `ck_contributor_verifications_status_enum` |
| `legal_name` | varchar(200) | Y | — | NOT NULL at insert (app); nullable only for retention purge |
| `country_code` | char(2) | Y | — | CHECK `^[A-Z]{2}$` (`ck_contributor_verifications_country_code_format`) |
| `date_of_birth` | date | Y | — | 18+ validated at submission |
| `phone` | varchar(32) | Y | — | E.164 CHECK as in `user_profiles` |
| `payout_method_id` | uuid | Y | — | FK → `payout_methods(id)` [R]; method declared at submission |
| `id_document_object_key` | varchar(512) | Y | — | optional ID scan in private bucket `kyc/{user_id}/{verification_id}/{uuid}` |
| `id_document_file_name` | varchar(255) | Y | — | |
| `id_document_mime` | varchar(255) | Y | — | sniffed (JPEG/PNG/PDF only) |
| `id_document_sha256` | bytea | Y | — | CHECK `octet_length = 32` when not NULL |
| `id_document_scan_status` | varchar(32) | Y | — | CHECK `IN ('pending','clean','infected','error')`; document visible to admins only when `clean` |
| `submitted_at` | timestamptz | N | `now()` | |
| `decided_at` | timestamptz | Y | — | |
| `decided_by` | uuid | Y | — | FK → `users(id)` [R]; CHECK `ck_contributor_verifications_not_self`: `decided_by IS NULL OR decided_by <> user_id` |
| `decision_reason` | text | Y | — | required for `rejected`/`needs_info`: CHECK `ck_contributor_verifications_reason_required`: `status NOT IN ('rejected','needs_info') OR decision_reason IS NOT NULL` |
| `admin_notes` | text | Y | — | internal only |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Checks: `ck_contributor_verifications_decided_consistent`: `(status = 'pending') = (decided_at IS NULL)`.
Indexes: `uq_contributor_verifications_one_pending` UNIQUE `(user_id) WHERE status = 'pending'`; `ix_contributor_verifications_user_id_submitted_at (user_id, submitted_at DESC)`; `ix_contributor_verifications_status_submitted_at (status, submitted_at)` (admin queue); `ix_contributor_verifications_payout_method_id`; `ix_contributor_verifications_decided_by`.

#### 4.1.8 `payout_methods`

User-entered payout destinations (A-05). Never auto-executed. Soft-deleted (`deleted_at`) because payout requests reference them. Retention: `details` replaced by `{"redacted": true}` on anonymisation; row kept 7 years after last payout.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | N | — | FK → `users(id)` [R] |
| `method_type` | varchar(32) | N | — | `ck_payout_methods_method_type_enum` |
| `label` | varchar(100) | N | — | user nickname, e.g. "ABA savings" |
| `details` | jsonb | N | — | per-type shape validated by Pydantic discriminated union (LLD §identity) |
| `display_hint` | varchar(64) | N | — | masked summary, e.g. `ABA ••• 4821` |
| `is_default` | boolean | N | `false` | |
| `deleted_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `uq_payout_methods_one_default` UNIQUE `(user_id) WHERE is_default AND deleted_at IS NULL`; `ix_payout_methods_user_id_active (user_id) WHERE deleted_at IS NULL`.

#### 4.1.9 `agreement_acceptances`

Append-only evidence of legal acceptances (HA-01/HA-02). Retention: 7 years after account closure.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | N | — | FK → `users(id)` [R] |
| `agreement_type` | varchar(32) | N | — | `ck_agreement_acceptances_agreement_type_enum` |
| `agreement_version` | varchar(32) | N | — | e.g. `2026-10-26` |
| `content_sha256` | bytea | N | — | hash of the exact text shown; CHECK `octet_length = 32` |
| `dataset_id` | uuid | Y | — | FK → `datasets(id)` [R]; set for per-dataset `rights_declaration` |
| `accepted_at` | timestamptz | N | `now()` | |
| `ip_address` | inet | Y | — | |
| `user_agent` | varchar(512) | Y | — | |

Indexes: `uq_agreement_acceptances_account_level` UNIQUE `(user_id, agreement_type, agreement_version) WHERE dataset_id IS NULL`; `uq_agreement_acceptances_dataset_level` UNIQUE `(dataset_id, agreement_type, agreement_version) WHERE dataset_id IS NOT NULL`; `ix_agreement_acceptances_user_id (user_id)`.

#### 4.1.10 `security_events`

Append-only security telemetry (SEC requirements). Retention: 1 year (A-15), purged daily by `retention.purge`.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | Y | — | FK → `users(id)` [R]; NULL for unknown-account events |
| `event_type` | varchar(64) | N | — | `ck_security_events_event_type_enum` |
| `severity` | varchar(32) | N | `'info'` | `ck_security_events_severity_enum` |
| `email_attempted` | citext | Y | — | only for `login_failed` on unknown email |
| `ip_address` | inet | Y | — | |
| `user_agent` | varchar(512) | Y | — | |
| `request_id` | varchar(64) | Y | — | |
| `details` | jsonb | N | `'{}'::jsonb` | never contains secrets |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `ix_security_events_user_id_created_at (user_id, created_at DESC)`; `ix_security_events_event_type_created_at (event_type, created_at DESC)`; `ix_security_events_ip_address_created_at (ip_address, created_at DESC)`; `ix_security_events_created_at_brin` BRIN (`created_at`).

#### 4.1.11 `mfa_recovery_codes`

Ten single-use recovery codes per MFA enrolment (80-bit random, shown once). Retention: deleted on regeneration, MFA disable and anonymisation.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | N | — | FK → `users(id)` [C] |
| `code_hash` | bytea | N | — | SHA-256 of normalised code; CHECK `octet_length = 32` |
| `used_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `uq_mfa_recovery_codes_user_id_code_hash` UNIQUE `(user_id, code_hash)`.

### 4.2 Datasets

#### 4.2.1 `datasets`

Contributor submission container. State machine: baseline §9 / `LLD.md` §5.4. Retention: drafts never submitted and `withdrawn` drafts are hard-deleted 30 days after `withdrawn_at` (cascade to children; objects deleted first); `rejected` datasets keep the row but objects are purged after 90 days (`objects_purged_at`); approved datasets are kept indefinitely (licensed content).

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `owner_id` | uuid | N | — | FK → `users(id)` [R] |
| `title` | varchar(200) | N | — | CHECK `ck_datasets_title_length`: `char_length(btrim(title)) BETWEEN 3 AND 200` |
| `description` | text | N | `''` | CHECK `ck_datasets_description_length`: `char_length(description) <= 10000` |
| `data_class` | varchar(32) | N | — | `ck_datasets_data_class_enum` (declared by contributor; final value set at finalize) |
| `category` | varchar(64) | N | — | CHECK `ck_datasets_category_format`: `category ~ '^[a-z][a-z0-9_]{1,63}$'`; allowed list in `system_settings.dataset_categories` (validated by app) |
| `primary_language` | varchar(16) | N | — | BCP-47 primary tag or `mixed`; CHECK `ck_datasets_primary_language_format`: `primary_language ~ '^([a-z]{2,3}(-[A-Za-z0-9]{2,8})*|mixed)$'` |
| `languages` | text[] | N | `'{}'` | all languages present; CHECK `ck_datasets_languages_max`: `cardinality(languages) <= 10` |
| `tags` | text[] | N | `'{}'` | CHECK `ck_datasets_tags_max`: `cardinality(tags) <= 20` |
| `source_description` | text | N | `''` | provenance statement; CHECK `char_length <= 5000` |
| `status` | varchar(32) | N | `'draft'` | `ck_datasets_status_enum` |
| `current_version_no` | integer | N | `0` | 0 until first submit; CHECK `>= 0` |
| `file_count` | integer | N | `0` | top-level, non-removed files (archive members excluded); CHECK `>= 0` |
| `total_bytes` | bigint | N | `0` | Σ `size_bytes` of top-level non-removed files (declared at upload init, corrected at complete); CHECK `>= 0` |
| `accepted_bytes` | bigint | Y | — | snapshot at finalize; CHECK `>= 0` |
| `rejected_bytes` | bigint | Y | — | snapshot at finalize; CHECK `>= 0` |
| `earning_micros` | bigint | Y | — | dataset earning credited at finalize; CHECK `>= 0` |
| `quality_score` | smallint | Y | — | 0–100 (mean of `dataset_quality_scores` × 20); CHECK `BETWEEN 0 AND 100` |
| `rights_declared_at` | timestamptz | Y | — | required before submit |
| `submitted_at` | timestamptz | Y | — | latest submit time |
| `finalized_at` | timestamptz | Y | — | CHECK `ck_datasets_finalized_at`: `status NOT IN ('approved','partially_approved','rejected') OR finalized_at IS NOT NULL` |
| `withdrawn_at` | timestamptz | Y | — | CHECK `ck_datasets_withdrawn_at`: `(status = 'withdrawn') = (withdrawn_at IS NOT NULL)` |
| `taken_down_at` | timestamptz | Y | — | |
| `taken_down_by` | uuid | Y | — | FK → `users(id)` [R] |
| `takedown_reason` | text | Y | — | CHECK `ck_datasets_takedown_fields`: `status <> 'taken_down' OR (taken_down_at IS NOT NULL AND takedown_reason IS NOT NULL)` |
| `objects_purged_at` | timestamptz | Y | — | storage objects deleted by retention |
| `lock_version` | integer | N | `1` | optimistic lock for `PATCH /datasets/{id}` |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `ix_datasets_owner_id_created_at (owner_id, created_at DESC)`; `ix_datasets_status_submitted_at (status, submitted_at)` (review queue: `status='submitted'` oldest first); `ix_datasets_category (category)`; `ix_datasets_primary_language (primary_language)`; `ix_datasets_data_class (data_class)`; `ix_datasets_quality_score (quality_score) WHERE quality_score IS NOT NULL`; `ix_datasets_tags` GIN (`tags`); `ix_datasets_languages` GIN (`languages`); `ix_datasets_title_trgm` GIN (`title gin_trgm_ops`); `ix_datasets_taken_down_by (taken_down_by)`.

#### 4.2.2 `dataset_versions`

Immutable snapshot written at each submit / resubmit (baseline §9). Retention: with dataset.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `dataset_id` | uuid | N | — | FK → `datasets(id)` [C] |
| `version_no` | integer | N | — | CHECK `>= 1` |
| `submitted_by` | uuid | N | — | FK → `users(id)` [R] |
| `submitted_at` | timestamptz | N | `now()` | |
| `change_note` | text | Y | — | contributor note on resubmission; CHECK `char_length <= 2000` |
| `file_count` | integer | N | — | CHECK `>= 0` |
| `total_bytes` | bigint | N | — | CHECK `>= 0` |
| `snapshot` | jsonb | N | — | `{title, description, data_class, category, primary_language, languages, tags, source_description, metadata:{…}, license:{…}, files:[{id, sha256, size_bytes, processing_status, scan_status}]}` |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `uq_dataset_versions_dataset_id_version_no` UNIQUE `(dataset_id, version_no)`; `ix_dataset_versions_submitted_by`.

#### 4.2.3 `dataset_files`

One row per uploaded file **and** per extracted archive member. Retention: object bytes purged per §7.3 (`object_purged_at`); rows kept while referenced by reviews/earnings/annotation tasks; otherwise deleted with dataset.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `dataset_id` | uuid | N | — | FK → `datasets(id)` [C] |
| `parent_file_id` | uuid | Y | — | FK → `dataset_files(id)` [C]; set for archive members |
| `member_path` | varchar(1024) | Y | — | sanitised path inside the ZIP; CHECK `ck_dataset_files_member_fields`: `(parent_file_id IS NULL) = (member_path IS NULL)` |
| `original_filename` | varchar(255) | N | — | NFC-normalised display name (never used as storage key) |
| `relative_path` | varchar(1024) | Y | — | folder-upload path (sanitised); display only |
| `storage_key` | varchar(512) | N | — | `uq_dataset_files_storage_key`; server-generated `datasets/{dataset_id}/files/{file_id}/original` |
| `extension` | varchar(16) | N | — | lower-case, without dot; CHECK `ck_dataset_files_extension_format`: `extension ~ '^[a-z0-9]{0,16}$'` |
| `declared_mime` | varchar(255) | Y | — | browser-supplied, untrusted |
| `detected_mime` | varchar(255) | Y | — | libmagic result |
| `format` | varchar(32) | Y | — | `ck_dataset_files_format_enum`; set by sniffer |
| `size_bytes` | bigint | N | — | declared at init, replaced by `HeadObject` size at complete; CHECK `ck_dataset_files_size_bytes_nonneg`: `>= 0` |
| `sha256` | bytea | Y | — | CHECK `ck_dataset_files_sha256_len`: `sha256 IS NULL OR octet_length(sha256) = 32` |
| `simhash` | bigint | Y | — | 64-bit SimHash of extracted text (near-duplicate) |
| `phash` | bigint | Y | — | 64-bit perceptual hash of first page/image (near-duplicate) |
| `processing_status` | varchar(32) | N | `'pending_upload'` | `ck_dataset_files_processing_status_enum` |
| `scan_status` | varchar(32) | N | `'pending'` | `ck_dataset_files_scan_status_enum` |
| `scan_signature` | varchar(255) | Y | — | ClamAV signature name when `infected` |
| `scan_engine_version` | varchar(128) | Y | — | clamd `VERSION` response at scan time |
| `scanned_at` | timestamptz | Y | — | |
| `failure_code` | varchar(64) | Y | — | `ck_dataset_files_failure_code_enum`; CHECK `ck_dataset_files_failure_code_when_failed`: `processing_status NOT IN ('failed','quarantined') OR failure_code IS NOT NULL` |
| `failure_detail` | text | Y | — | safe, user-displayable message |
| `is_container` | boolean | N | `false` | ZIP container; never payable |
| `page_count` | integer | Y | — | CHECK `>= 0` |
| `previewable` | boolean | N | `false` | |
| `annotatable` | boolean | N | `false` | per baseline §7 |
| `text_object_key` | varchar(512) | Y | — | extracted UTF-8 text `datasets/{dataset_id}/files/{file_id}/text.txt` |
| `extracted_metadata` | jsonb | N | `'{}'::jsonb` | e.g. `{width_px, height_px, pdf_title, sheet_names, row_count, encoding}` |
| `processing_attempts` | smallint | N | `0` | CHECK `>= 0` |
| `uploaded_at` | timestamptz | Y | — | |
| `processing_started_at` | timestamptz | Y | — | used by stuck-job sweeper |
| `processed_at` | timestamptz | Y | — | |
| `removed_at` | timestamptz | Y | — | soft removal by owner when the row is already referenced by an earlier review |
| `object_purged_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Checks:
- `ck_dataset_files_ready_integrity`: `processing_status <> 'ready' OR (sha256 IS NOT NULL AND scan_status IN ('clean','skipped_container') AND format IS NOT NULL)` — fail-closed rule (A-10): a `ready` file has always been scanned clean (or is a container whose members are scanned individually).
- `ck_dataset_files_container_scan`: `(scan_status = 'skipped_container') <= is_container` (only containers may skip scanning).
- `ck_dataset_files_quarantine`: `processing_status <> 'quarantined' OR scan_status = 'infected'`.

Indexes: `ix_dataset_files_dataset_id_sha256 (dataset_id, sha256)` (baseline §10); `ix_dataset_files_sha256 (sha256)` (global, baseline §10); `uq_dataset_files_parent_file_id_member_path` UNIQUE `(parent_file_id, member_path)` (archive expansion idempotency, baseline §13); `ix_dataset_files_dataset_id_processing_status (dataset_id, processing_status)`; `ix_dataset_files_processing_sweep (processing_started_at) WHERE processing_status = 'processing'`; `ix_dataset_files_uploaded_sweep (updated_at) WHERE processing_status = 'uploaded'`; `ix_dataset_files_simhash (simhash) WHERE simhash IS NOT NULL`; `ix_dataset_files_phash (phash) WHERE phash IS NOT NULL`; `ix_dataset_files_parent_file_id (parent_file_id)`.

#### 4.2.4 `dataset_metadata`

Typed key/value metadata per dataset (baseline §10). Retention: with dataset.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `dataset_id` | uuid | N | — | FK → `datasets(id)` [C] |
| `key` | varchar(64) | N | — | CHECK `ck_dataset_metadata_key_format`: `key ~ '^[a-z][a-z0-9_]{0,63}$'` |
| `value_type` | varchar(32) | N | — | `ck_dataset_metadata_value_type_enum` |
| `value_text` | text | Y | — | CHECK `char_length(value_text) <= 2000` |
| `value_integer` | bigint | Y | — | |
| `value_number` | numeric(20,6) | Y | — | non-monetary only |
| `value_boolean` | boolean | Y | — | |
| `value_date` | date | Y | — | |
| `value_json` | jsonb | Y | — | ≤ 16 KiB (app) |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Checks: `ck_dataset_metadata_one_value`: `num_nonnulls(value_text, value_integer, value_number, value_boolean, value_date, value_json) = 1`; `ck_dataset_metadata_value_matches_type`: `(value_type = 'text' AND value_text IS NOT NULL) OR (value_type = 'integer' AND value_integer IS NOT NULL) OR (value_type = 'number' AND value_number IS NOT NULL) OR (value_type = 'boolean' AND value_boolean IS NOT NULL) OR (value_type = 'date' AND value_date IS NOT NULL) OR (value_type = 'json' AND value_json IS NOT NULL)`.
Indexes: `uq_dataset_metadata_dataset_id_key` UNIQUE `(dataset_id, key)`; `ix_dataset_metadata_key_value_text (key, value_text) WHERE value_type = 'text'`.

#### 4.2.5 `upload_sessions`

S3 multipart upload state per file (baseline §9, §12 Uploads). Retention: sessions not completed within 24 h become `expired` (S3 multipart aborted); terminal rows deleted 30 days later.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK; returned to client as `upload_id` |
| `dataset_id` | uuid | N | — | FK → `datasets(id)` [C] |
| `file_id` | uuid | N | — | FK → `dataset_files(id)` [C]; `uq_upload_sessions_file_id` UNIQUE |
| `user_id` | uuid | N | — | FK → `users(id)` [R] |
| `s3_upload_id` | varchar(1024) | N | — | multipart `UploadId` from storage |
| `storage_key` | varchar(512) | N | — | equals `dataset_files.storage_key` |
| `original_filename` | varchar(255) | N | — | |
| `declared_size_bytes` | bigint | N | — | CHECK `ck_upload_sessions_declared_size_positive`: `> 0` |
| `declared_mime` | varchar(255) | Y | — | |
| `part_size_bytes` | bigint | N | — | CHECK `ck_upload_sessions_part_size_range`: `BETWEEN 5242880 AND 5368709120` |
| `part_count` | integer | N | — | CHECK `ck_upload_sessions_part_count_range`: `BETWEEN 1 AND 10000` |
| `client_fingerprint` | varchar(128) | Y | — | SHA-256 hex of `name|size|lastModified|relative_path` for resume lookup |
| `status` | varchar(32) | N | `'initiated'` | `ck_upload_sessions_status_enum` |
| `expires_at` | timestamptz | N | — | `created_at + upload_session_ttl_hours` (default 24 h) |
| `completed_at` | timestamptz | Y | — | CHECK `(status = 'completed') = (completed_at IS NOT NULL)` (`ck_upload_sessions_completed_at`) |
| `aborted_at` | timestamptz | Y | — | |
| `abort_reason` | varchar(32) | Y | — | `ck_upload_sessions_abort_reason_enum` |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `ix_upload_sessions_expiry_open (expires_at) WHERE status IN ('initiated','uploading')`; `ix_upload_sessions_user_id_status (user_id, status)`; `uq_upload_sessions_resume` UNIQUE `(dataset_id, client_fingerprint) WHERE status IN ('initiated','uploading') AND client_fingerprint IS NOT NULL`; `ix_upload_sessions_dataset_id (dataset_id)`.

#### 4.2.6 `upload_parts`

Optional cache of parts confirmed by the client/`ListParts` (baseline §10 "optional cache"). S3 `ListParts` remains the source of truth. Retention: cascades with session.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `upload_session_id` | uuid | N | — | PK part 1; FK → `upload_sessions(id)` [C] |
| `part_number` | integer | N | — | PK part 2; CHECK `BETWEEN 1 AND 10000` |
| `etag` | varchar(128) | N | — | |
| `size_bytes` | bigint | N | — | CHECK `> 0` |
| `uploaded_at` | timestamptz | N | `now()` | |

PK `pk_upload_parts (upload_session_id, part_number)`.

#### 4.2.7 `dataset_licenses`

Licence terms the contributor grants for a dataset (HA-02 default: perpetual, worldwide, non-exclusive). Retention: with dataset; kept ≥ 7 years if the dataset earned money.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `dataset_id` | uuid | N | — | FK → `datasets(id)` [C] |
| `license_code` | varchar(64) | N | `'datahub-contributor-v1'` | |
| `license_version` | varchar(32) | N | — | |
| `grant_type` | varchar(32) | N | `'non_exclusive_perpetual'` | `ck_dataset_licenses_grant_type_enum` |
| `territory` | varchar(32) | N | `'worldwide'` | |
| `contributor_is_rights_holder` | boolean | N | — | |
| `rights_holder_name` | varchar(200) | Y | — | CHECK `ck_dataset_licenses_rights_holder`: `contributor_is_rights_holder OR rights_holder_name IS NOT NULL` |
| `source_url` | varchar(2048) | Y | — | |
| `attribution_text` | varchar(500) | Y | — | |
| `agreement_acceptance_id` | uuid | Y | — | FK → `agreement_acceptances(id)` [R] (the `rights_declaration` row) |
| `accepted_by` | uuid | N | — | FK → `users(id)` [R] |
| `accepted_at` | timestamptz | N | `now()` | |
| `effective_from` | timestamptz | Y | — | set at finalize with payment (licence takes effect on acceptance + payment, HA-02) |
| `revoked_at` | timestamptz | Y | — | takedown / consent withdrawal |
| `revocation_reason` | text | Y | — | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `uq_dataset_licenses_one_active` UNIQUE `(dataset_id) WHERE revoked_at IS NULL`; `ix_dataset_licenses_accepted_by`; `ix_dataset_licenses_agreement_acceptance_id`.

#### 4.2.8 `dataset_duplicates`

Duplicate matches found by `processing.detect_duplicates`. Exact matches against previously **accepted** files are payment-blocking (baseline §8.3); near matches are reviewer flags. Retention: with `file_id` row.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `file_id` | uuid | N | — | FK → `dataset_files(id)` [C] — the new file |
| `matched_file_id` | uuid | N | — | FK → `dataset_files(id)` [C] — the earlier file |
| `kind` | varchar(32) | N | — | `ck_dataset_duplicates_kind_enum` |
| `method` | varchar(32) | N | — | `ck_dataset_duplicates_method_enum` |
| `similarity` | numeric(5,4) | N | — | 1.0000 for exact; CHECK `BETWEEN 0 AND 1` |
| `hamming_distance` | smallint | Y | — | for simhash/phash; CHECK `BETWEEN 0 AND 64` |
| `same_dataset` | boolean | N | — | |
| `matched_was_accepted` | boolean | N | — | matched file had an `accepted` file review at detection time |
| `matched_owner_is_same` | boolean | N | — | |
| `detected_at` | timestamptz | N | `now()` | refreshed on upsert |

Checks: `ck_dataset_duplicates_not_self`: `file_id <> matched_file_id`; `ck_dataset_duplicates_exact_method`: `(kind = 'exact') = (method = 'sha256')`.
Indexes: `uq_dataset_duplicates_file_id_matched_file_id_kind` UNIQUE `(file_id, matched_file_id, kind)` (upsert key, baseline §13); `ix_dataset_duplicates_matched_file_id (matched_file_id)`.

#### 4.2.9 `file_previews`

Server-rendered preview artefacts (ADR-0007). Regenerable; deleted with file or on object purge.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `file_id` | uuid | N | — | FK → `dataset_files(id)` [C] |
| `kind` | varchar(32) | N | — | `ck_file_previews_kind_enum` |
| `page_number` | integer | Y | — | 1-based; CHECK `ck_file_previews_page_number`: `page_number IS NULL OR page_number >= 1`; required for `page_image` (`ck_file_previews_page_required`: `kind <> 'page_image' OR page_number IS NOT NULL`) |
| `storage_key` | varchar(512) | N | — | `uq_file_previews_storage_key`; `datasets/{dataset_id}/files/{file_id}/previews/{kind}-{page:05d}.webp` |
| `mime_type` | varchar(64) | N | — | `image/webp`, `image/png`, `text/plain; charset=utf-8`, `application/json` |
| `width_px` | integer | Y | — | ≤ 4096 |
| `height_px` | integer | Y | — | ≤ 4096 |
| `size_bytes` | bigint | N | — | CHECK `>= 0` |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `uq_file_previews_file_id_kind_page_number` UNIQUE `(file_id, kind, page_number) NULLS NOT DISTINCT`.

### 4.3 Review

#### 4.3.1 `dataset_reviews`

One row per reviewer claim of a dataset version (baseline §9). Retention: 7 years minimum (evidence for earnings); permanent in v1.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `dataset_id` | uuid | N | — | FK → `datasets(id)` [R] |
| `dataset_version_id` | uuid | N | — | FK → `dataset_versions(id)` [R] |
| `reviewer_id` | uuid | N | — | FK → `users(id)` [R] |
| `status` | varchar(32) | N | `'in_progress'` | `ck_dataset_reviews_status_enum` |
| `decision` | varchar(32) | Y | — | `ck_dataset_reviews_decision_enum`; CHECK `ck_dataset_reviews_decision_when_finalized`: `(status = 'finalized') = (decision IS NOT NULL)` |
| `data_class_declared` | varchar(32) | N | — | copy of `datasets.data_class` at claim |
| `data_class_final` | varchar(32) | Y | — | reviewer-confirmed class; CHECK `status <> 'finalized' OR data_class_final IS NOT NULL` (`ck_dataset_reviews_class_when_finalized`) |
| `checklist` | jsonb | N | `'{}'::jsonb` | `{"rights_plausible": bool, "language_matches": bool, "content_legible": bool, "no_sensitive_personal_data": bool, "metadata_accurate": bool, "not_spam_or_generated": bool}` |
| `internal_comments` | text | Y | — | reviewer/admin only |
| `feedback_to_contributor` | text | Y | — | required for `reject` / `request_changes` (CHECK `ck_dataset_reviews_feedback_required`: `decision NOT IN ('reject','request_changes') OR feedback_to_contributor IS NOT NULL`) |
| `accepted_file_count` | integer | Y | — | snapshot at finalize |
| `rejected_file_count` | integer | Y | — | |
| `accepted_bytes` | bigint | Y | — | CHECK `>= 0` |
| `rejected_bytes` | bigint | Y | — | CHECK `>= 0` |
| `payable_bytes` | bigint | Y | — | bytes that earned > 0 |
| `earning_micros` | bigint | Y | — | CHECK `>= 0`; equals journal amount (0 when no journal) |
| `pricing_rule_id` | uuid | Y | — | FK → `pricing_rules(id)` [R] (added in revision 0005) |
| `ledger_journal_id` | uuid | Y | — | FK → `ledger_journals(id)` [R] (added in revision 0005) |
| `finalize_idempotency_key` | varchar(128) | Y | — | client `Idempotency-Key` used at finalize |
| `claimed_at` | timestamptz | N | `now()` | |
| `finalized_at` | timestamptz | Y | — | |
| `released_at` | timestamptz | Y | — | |
| `release_reason` | varchar(500) | Y | — | |
| `lock_version` | integer | N | `1` | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `uq_dataset_reviews_one_active` UNIQUE `(dataset_id) WHERE status = 'in_progress'`; `uq_dataset_reviews_one_finalized_per_version` UNIQUE `(dataset_version_id) WHERE status = 'finalized'`; `ix_dataset_reviews_reviewer_id_status (reviewer_id, status)`; `ix_dataset_reviews_dataset_id_created_at (dataset_id, created_at DESC)`; `ix_dataset_reviews_finalized_at (finalized_at) WHERE status = 'finalized'`; `ix_dataset_reviews_pricing_rule_id`; `ix_dataset_reviews_ledger_journal_id`.

Separation of duties (`reviewer_id <> datasets.owner_id`) is enforced in `review.service.claim` (cross-table, not expressible as CHECK).

#### 4.3.2 `dataset_file_reviews`

Per-file decision inside a review (partial approval, baseline §10). Retention: as `dataset_reviews`.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `review_id` | uuid | N | — | FK → `dataset_reviews(id)` [R] |
| `file_id` | uuid | N | — | FK → `dataset_files(id)` [R] |
| `decision` | varchar(32) | N | — | `ck_dataset_file_reviews_decision_enum` |
| `reason_code` | varchar(64) | Y | — | `ck_dataset_file_reviews_reason_code_enum`; CHECK `ck_dataset_file_reviews_reason_when_rejected`: `decision <> 'rejected' OR reason_code IS NOT NULL` |
| `comment` | text | Y | — | CHECK `char_length <= 2000`; shown to contributor |
| `labeled_upgrade` | boolean | N | `false` | HA-08 tick; CHECK `ck_dataset_file_reviews_upgrade_only_accepted`: `NOT labeled_upgrade OR decision = 'accepted'` |
| `decided_by` | uuid | N | — | FK → `users(id)` [R] |
| `decided_at` | timestamptz | N | `now()` | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `uq_dataset_file_reviews_review_id_file_id` UNIQUE `(review_id, file_id)` (baseline §10); `ix_dataset_file_reviews_file_id_decision (file_id, decision)` (used by duplicate detection's "previously accepted" check); `ix_dataset_file_reviews_decided_by`.

#### 4.3.3 `dataset_quality_scores`

Reviewer scores per quality dimension (1–5). Retention: as `dataset_reviews`.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `review_id` | uuid | N | — | FK → `dataset_reviews(id)` [R] |
| `dataset_id` | uuid | N | — | FK → `datasets(id)` [R] (denormalised for filtering) |
| `dimension` | varchar(32) | N | — | `ck_dataset_quality_scores_dimension_enum` |
| `score` | smallint | N | — | CHECK `ck_dataset_quality_scores_score_range`: `BETWEEN 1 AND 5` |
| `comment` | varchar(1000) | Y | — | |
| `scored_by` | uuid | N | — | FK → `users(id)` [R] |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `uq_dataset_quality_scores_review_id_dimension` UNIQUE `(review_id, dimension)`; `ix_dataset_quality_scores_dataset_id`; `ix_dataset_quality_scores_scored_by`.

### 4.4 Finance

All finance tables are retained permanently in v1 (≥ 7 years required, A-15). Ledger rules: baseline §8.5. Triggers: §6.

#### 4.4.1 `pricing_rules`

Versioned price per GB per data class. Append-only except that `effective_to` of the open rule may be set once when a successor is created (guard trigger `trg_pricing_rules_guard`, §6.4). Seed (revision 0005): `raw` 1,000,000 and `labeled` 1,500,000 micros/GB effective `2026-01-01T00:00:00Z`, open-ended.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `data_class` | varchar(32) | N | — | `ck_pricing_rules_data_class_enum` (`raw`, `labeled`) |
| `rate_micros_per_gb` | bigint | N | — | CHECK `ck_pricing_rules_rate_positive`: `> 0` |
| `currency` | char(3) | N | `'USD'` | CHECK `ck_pricing_rules_currency_usd`: `currency = 'USD'` (A-04) |
| `effective_from` | timestamptz | N | — | |
| `effective_to` | timestamptz | Y | — | exclusive upper bound; NULL = open-ended; CHECK `ck_pricing_rules_range_valid`: `effective_to IS NULL OR effective_to > effective_from` |
| `reason` | text | N | — | CHECK `char_length(btrim(reason)) >= 5` |
| `created_by` | uuid | Y | — | FK → `users(id)` [R]; NULL for seed |
| `created_at` | timestamptz | N | `now()` | |

Constraints: `uq_pricing_rules_data_class_effective_from` UNIQUE `(data_class, effective_from)` (baseline §10); **exclusion constraint** `ex_pricing_rules_no_overlap`:

```sql
ALTER TABLE pricing_rules ADD CONSTRAINT ex_pricing_rules_no_overlap
  EXCLUDE USING gist (
    data_class WITH =,
    tstzrange(effective_from, effective_to, '[)') WITH &&
  );
```

(`btree_gist` provides the `=` operator class for `varchar` inside GiST.) Lookup of the rule in force at instant `t`: `WHERE data_class = :c AND effective_from <= :t AND (effective_to IS NULL OR effective_to > :t)`.

#### 4.4.2 `wallets`

One wallet per user (`kind = 'user'`, created lazily by `finance.service.get_or_create_user_wallet` with `INSERT … ON CONFLICT (owner_user_id) DO NOTHING`) plus four system wallets seeded by revision 0005. User wallets carry cached bucket balances updated in the same transaction as the lines (D-DB-06); `finance.reconcile` verifies them nightly.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `kind` | varchar(32) | N | — | `ck_wallets_kind_enum` |
| `owner_user_id` | uuid | Y | — | FK → `users(id)` [R]; `uq_wallets_owner_user_id` UNIQUE |
| `system_code` | varchar(64) | Y | — | `ck_wallets_system_code_enum`; `uq_wallets_system_code` UNIQUE |
| `currency` | char(3) | N | `'USD'` | CHECK `= 'USD'` |
| `pending_micros` | bigint | N | `0` | CHECK `ck_wallets_pending_nonneg`: `>= 0` |
| `available_micros` | bigint | N | `0` | CHECK `ck_wallets_available_nonneg`: `>= 0` |
| `reserved_micros` | bigint | N | `0` | CHECK `ck_wallets_reserved_nonneg`: `>= 0` |
| `paid_micros` | bigint | N | `0` | CHECK `ck_wallets_paid_nonneg`: `>= 0` |
| `journal_count` | bigint | N | `0` | incremented per journal touching the wallet; cheap change detector for caches |
| `last_journal_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Checks: `ck_wallets_kind_owner`: `(kind = 'user' AND owner_user_id IS NOT NULL AND system_code IS NULL) OR (kind = 'system' AND owner_user_id IS NULL AND system_code IS NOT NULL)`; `ck_wallets_system_no_cache`: `kind = 'user' OR (pending_micros = 0 AND available_micros = 0 AND reserved_micros = 0 AND paid_micros = 0)`.

#### 4.4.3 `ledger_journals`

Journal header (baseline: "spec's transaction header"). Append-only (`trg_ledger_journals_immutable`); must have ≥ 2 balanced lines at commit (`trg_ledger_journals_has_lines`).

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `kind` | varchar(32) | N | — | `ck_ledger_journals_kind_enum` |
| `idempotency_key` | varchar(200) | N | — | `uq_ledger_journals_idempotency_key` UNIQUE; formats in baseline §8.5 plus `dataset_review:{review_id}:release` for `earning_release` |
| `source_type` | varchar(32) | N | — | `ck_ledger_journals_source_type_enum` |
| `source_id` | uuid | N | — | id of the source row (polymorphic, not FK-enforced; integrity guaranteed by typed FKs on the source side, e.g. `dataset_reviews.ledger_journal_id`) |
| `user_id` | uuid | N | — | FK → `users(id)` [R]; beneficiary (every v1 journal touches exactly one user wallet) |
| `amount_micros` | bigint | N | — | absolute journal amount = Σ positive lines; CHECK `ck_ledger_journals_amount_positive`: `> 0` |
| `currency` | char(3) | N | `'USD'` | CHECK `= 'USD'` |
| `description` | varchar(500) | N | — | human-readable, shown in wallet history |
| `created_by` | uuid | Y | — | FK → `users(id)` [R]; NULL = system job |
| `request_id` | varchar(64) | Y | — | correlation with `audit_logs.request_id` |
| `created_at` | timestamptz | N | `now()` | |

Checks: `ck_ledger_journals_kind_source`: `(kind = 'dataset_earning' AND source_type = 'dataset_review') OR (kind = 'earning_release' AND source_type = 'dataset_review') OR (kind = 'annotation_reward' AND source_type = 'annotation_review') OR (kind IN ('payout_reserve','payout_release','payout_settle','payout_reversal') AND source_type = 'payout_request') OR (kind IN ('adjustment_credit','adjustment_debit') AND source_type = 'payout_adjustment')`.
Indexes: `ix_ledger_journals_source_type_source_id (source_type, source_id)`; `ix_ledger_journals_user_id_created_at (user_id, created_at DESC)`; `ix_ledger_journals_kind_created_at (kind, created_at DESC)`; `ix_ledger_journals_created_by`; `ix_ledger_journals_created_at_brin` BRIN (`created_at`).

#### 4.4.4 `wallet_transactions`

Journal **lines**. Append-only (`trg_wallet_transactions_immutable`); bucket must match wallet kind (`trg_wallet_transactions_bucket`); per-journal sum must be zero at commit (`trg_wallet_transactions_balanced`, deferred).

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `journal_id` | uuid | N | — | FK → `ledger_journals(id)` [R] |
| `line_no` | smallint | N | — | 1-based within journal; CHECK `>= 1` |
| `wallet_id` | uuid | N | — | FK → `wallets(id)` [R] |
| `bucket` | varchar(32) | N | — | `ck_wallet_transactions_bucket_enum`; user wallets: `pending`/`available`/`reserved`/`paid`; system wallets: `main` |
| `amount_micros` | bigint | N | — | CHECK `ck_wallet_transactions_amount_nonzero`: `amount_micros <> 0` |
| `balance_after_micros` | bigint | Y | — | cached bucket balance after this line (user wallets only, computed under the wallet lock); NULL for system wallets; CHECK `balance_after_micros IS NULL OR balance_after_micros >= 0` |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `uq_wallet_transactions_journal_id_line_no` UNIQUE `(journal_id, line_no)`; `ix_wallet_transactions_wallet_id_bucket_created_at (wallet_id, bucket, created_at DESC)`; `ix_wallet_transactions_wallet_id_created_at (wallet_id, created_at DESC)`.

#### 4.4.5 `earning_records`

Per-file (dataset) or per-task (annotation) earning evidence, including zero-amount outcomes, with the rates in force at finalization (baseline §8.4). Append-only except the release columns (`released_at`, `release_journal_id`) written once by `finance.release_pending`.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | N | — | FK → `users(id)` [R]; beneficiary |
| `source_type` | varchar(32) | N | — | `ck_earning_records_source_type_enum` |
| `source_id` | uuid | N | — | review id (dataset or annotation) |
| `dataset_review_id` | uuid | Y | — | FK → `dataset_reviews(id)` [R] |
| `annotation_review_id` | uuid | Y | — | FK → `annotation_reviews(id)` [R] (added in revision 0006) |
| `dataset_id` | uuid | Y | — | FK → `datasets(id)` [R] |
| `file_id` | uuid | Y | — | FK → `dataset_files(id)` [R]; NULL for annotation rewards |
| `annotation_task_id` | uuid | Y | — | FK → `annotation_tasks(id)` [R] (added in revision 0006) |
| `sha256` | bytea | Y | — | copy of file hash; CHECK `octet_length = 32` when not NULL |
| `data_class` | varchar(32) | Y | — | final class applied |
| `accepted_bytes` | bigint | Y | — | CHECK `>= 0` |
| `pricing_rule_id` | uuid | Y | — | FK → `pricing_rules(id)` [R] |
| `rate_micros_per_gb` | bigint | Y | — | rate copied from rule; CHECK `> 0` |
| `previously_paid_rate_micros_per_gb` | bigint | Y | — | for labeled upgrade: rate of the earlier base payment |
| `is_labeled_upgrade` | boolean | N | `false` | |
| `amount_micros` | bigint | N | — | CHECK `ck_earning_records_amount_nonneg`: `>= 0` |
| `zero_reason` | varchar(32) | Y | — | `ck_earning_records_zero_reason_enum`; CHECK `ck_earning_records_zero_reason_iff_zero`: `(amount_micros = 0) = (zero_reason IS NOT NULL)` |
| `journal_id` | uuid | Y | — | FK → `ledger_journals(id)` [R]; credit journal; CHECK `ck_earning_records_journal_when_positive`: `amount_micros = 0 OR journal_id IS NOT NULL` |
| `credited_bucket` | varchar(32) | Y | — | `ck_earning_records_bucket_enum`; NULL when amount = 0 |
| `hold_until` | timestamptz | Y | — | set when `credited_bucket = 'pending'` (A-07) |
| `released_at` | timestamptz | Y | — | |
| `release_journal_id` | uuid | Y | — | FK → `ledger_journals(id)` [R] |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Checks: `ck_earning_records_source_fk`: `(source_type = 'dataset_review' AND dataset_review_id = source_id AND file_id IS NOT NULL AND sha256 IS NOT NULL AND accepted_bytes IS NOT NULL) OR (source_type = 'annotation_review' AND annotation_review_id = source_id AND annotation_task_id IS NOT NULL AND file_id IS NULL)`; `ck_earning_records_upgrade_rate`: `NOT is_labeled_upgrade OR previously_paid_rate_micros_per_gb IS NOT NULL`; `ck_earning_records_pending_hold`: `credited_bucket IS DISTINCT FROM 'pending' OR hold_until IS NOT NULL`.

Indexes:
- `uq_earning_records_source_type_source_id_file_id` UNIQUE `(source_type, source_id, file_id) NULLS NOT DISTINCT` (baseline §10; NULLS NOT DISTINCT makes the annotation case — `file_id` NULL — unique per review).
- `uq_earning_records_sha256_base_payment` UNIQUE `(sha256) WHERE source_type = 'dataset_review' AND amount_micros > 0 AND NOT is_labeled_upgrade` (D-DB-08: content is paid at most once at base rate).
- `uq_earning_records_sha256_upgrade_payment` UNIQUE `(sha256) WHERE amount_micros > 0 AND is_labeled_upgrade` (at most one labeled upgrade per content).
- `ix_earning_records_user_id_created_at (user_id, created_at DESC)`; `ix_earning_records_release_due (hold_until) WHERE credited_bucket = 'pending' AND released_at IS NULL`; `ix_earning_records_dataset_id`; `ix_earning_records_file_id`; `ix_earning_records_journal_id`; plus FK indexes on `dataset_review_id`, `annotation_review_id`, `annotation_task_id`, `pricing_rule_id`, `release_journal_id`.

#### 4.4.6 `payout_requests`

Withdrawal requests (baseline §8.7, state machine §9).

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | N | — | FK → `users(id)` [R] |
| `wallet_id` | uuid | N | — | FK → `wallets(id)` [R] |
| `payout_method_id` | uuid | N | — | FK → `payout_methods(id)` [R] |
| `method_type` | varchar(32) | N | — | snapshot; `ck_payout_requests_method_type_enum` |
| `method_snapshot` | jsonb | N | — | copy of `payout_methods.details` + `display_hint` at request time (admin view) |
| `amount_micros` | bigint | N | — | CHECK `ck_payout_requests_amount_positive`: `> 0`; CHECK `ck_payout_requests_amount_whole_cents`: `amount_micros % 10000 = 0` |
| `currency` | char(3) | N | `'USD'` | CHECK `= 'USD'` |
| `status` | varchar(32) | N | `'requested'` | `ck_payout_requests_status_enum` |
| `approvals_required` | smallint | N | — | 1 or 2 (≥ `payout_dual_approval_threshold_micros` → 2); CHECK `BETWEEN 1 AND 2` |
| `approvals_count` | smallint | N | `0` | CHECK `ck_payout_requests_approvals_count_range`: `approvals_count BETWEEN 0 AND approvals_required` |
| `client_idempotency_key` | varchar(128) | N | — | from `Idempotency-Key` header |
| `request_fingerprint` | bytea | N | — | SHA-256 of `(amount_micros, payout_method_id)` to detect key reuse with a different body |
| `contributor_note` | varchar(500) | Y | — | |
| `admin_note` | text | Y | — | internal |
| `requested_at` | timestamptz | N | `now()` | |
| `approved_at` | timestamptz | Y | — | CHECK `ck_payout_requests_approved_at`: `status NOT IN ('approved','paid','failed','reversed') OR approved_at IS NOT NULL` |
| `rejected_at` | timestamptz | Y | — | |
| `rejected_by` | uuid | Y | — | FK → `users(id)` [R] |
| `rejection_reason` | text | Y | — | CHECK `status <> 'rejected' OR rejection_reason IS NOT NULL` (`ck_payout_requests_rejection_reason`) |
| `cancelled_at` | timestamptz | Y | — | |
| `cancelled_by` | uuid | Y | — | FK → `users(id)` [R] |
| `cancel_reason` | text | Y | — | |
| `failed_at` | timestamptz | Y | — | |
| `failed_by` | uuid | Y | — | FK → `users(id)` [R] |
| `failure_reason` | text | Y | — | CHECK `status <> 'failed' OR failure_reason IS NOT NULL` (`ck_payout_requests_failure_reason`) |
| `paid_at` | timestamptz | Y | — | copy of `payout_records.paid_at`; CHECK `ck_payout_requests_paid_at`: `status NOT IN ('paid','reversed') OR paid_at IS NOT NULL` |
| `reversed_at` | timestamptz | Y | — | |
| `reversed_by` | uuid | Y | — | FK → `users(id)` [R] |
| `reversal_reason` | text | Y | — | CHECK `status <> 'reversed' OR reversal_reason IS NOT NULL` |
| `reserve_journal_id` | uuid | N | — | FK → `ledger_journals(id)` [R] |
| `release_journal_id` | uuid | Y | — | FK → `ledger_journals(id)` [R]; set on reject/cancel/fail |
| `settle_journal_id` | uuid | Y | — | FK → `ledger_journals(id)` [R]; set on paid |
| `reversal_journal_id` | uuid | Y | — | FK → `ledger_journals(id)` [R] |
| `lock_version` | integer | N | `1` | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Checks: `ck_payout_requests_release_journal`: `(status IN ('rejected','cancelled','failed')) = (release_journal_id IS NOT NULL)`; `ck_payout_requests_settle_journal`: `(status IN ('paid','reversed')) = (settle_journal_id IS NOT NULL)`; `ck_payout_requests_reversal_journal`: `(status = 'reversed') = (reversal_journal_id IS NOT NULL)`.
Indexes: `uq_payout_requests_user_id_client_idempotency_key` UNIQUE `(user_id, client_idempotency_key)` (baseline §10); `uq_payout_requests_one_open` UNIQUE `(user_id) WHERE status IN ('requested','approved')` (baseline §10); `ix_payout_requests_status_requested_at (status, requested_at)`; `ix_payout_requests_user_id_created_at (user_id, created_at DESC)`; FK indexes on `wallet_id`, `payout_method_id`, journal columns, actor columns.

#### 4.4.7 `payout_approvals`

One row per approving admin. Append-only.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `payout_id` | uuid | N | — | FK → `payout_requests(id)` [R] |
| `approver_id` | uuid | N | — | FK → `users(id)` [R] |
| `approval_no` | smallint | N | — | 1 or 2; CHECK `BETWEEN 1 AND 2` |
| `note` | varchar(1000) | Y | — | |
| `session_mfa_verified_at` | timestamptz | N | — | copy of approver's `user_sessions.mfa_verified_at` (evidence of step-up) |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `uq_payout_approvals_payout_id_approver_id` UNIQUE `(payout_id, approver_id)` (baseline §10: two **distinct** approvers); `uq_payout_approvals_payout_id_approval_no` UNIQUE `(payout_id, approval_no)`; `ix_payout_approvals_approver_id`.

#### 4.4.8 `payout_records`

Confirmation of an external manual payment (Part 11 steps 6–9). Insert-once; only the proof columns may be filled later (once).

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `payout_id` | uuid | N | — | FK → `payout_requests(id)` [R]; `uq_payout_records_payout_id` UNIQUE (baseline §10) |
| `method_type` | varchar(32) | N | — | copy of request method |
| `payment_reference` | varchar(200) | N | — | CHECK `ck_payout_records_reference_nonblank`: `char_length(btrim(payment_reference)) > 0` |
| `amount_micros` | bigint | N | — | must equal request amount (service); CHECK `> 0` and `% 10000 = 0` |
| `external_fee_micros` | bigint | N | `0` | informational (fee borne by platform); CHECK `>= 0` |
| `paid_at` | timestamptz | N | — | date/time of the external transfer (not in the future: service) |
| `recorded_by` | uuid | N | — | FK → `users(id)` [R]; ≠ recipient (service) |
| `notes` | text | Y | — | |
| `proof_object_key` | varchar(512) | Y | — | `payouts/{payout_id}/proof/{uuid}` private |
| `proof_file_name` | varchar(255) | Y | — | |
| `proof_mime` | varchar(255) | Y | — | PDF/PNG/JPEG only |
| `proof_size_bytes` | bigint | Y | — | ≤ 10 MB |
| `proof_sha256` | bytea | Y | — | |
| `proof_scan_status` | varchar(32) | Y | — | CHECK `IN ('pending','clean','infected','error')` |
| `proof_uploaded_by` | uuid | Y | — | FK → `users(id)` [R] |
| `proof_uploaded_at` | timestamptz | Y | — | CHECK `ck_payout_records_proof_fields`: `(proof_object_key IS NULL) = (proof_uploaded_at IS NULL)` |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `uq_payout_records_method_type_payment_reference` UNIQUE `(method_type, payment_reference)` (baseline §8.7 "unique per method"); FK indexes on `recorded_by`, `proof_uploaded_by`.

#### 4.4.9 `payout_adjustments`

Administrative corrections (super_admin, `finance.adjust`). Append-only; each row has exactly one journal.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK; journal idempotency key `adjustment:{id}` |
| `user_id` | uuid | N | — | FK → `users(id)` [R] |
| `wallet_id` | uuid | N | — | FK → `wallets(id)` [R] |
| `direction` | varchar(32) | N | — | `ck_payout_adjustments_direction_enum` |
| `amount_micros` | bigint | N | — | CHECK `> 0` |
| `reason_code` | varchar(32) | N | — | `ck_payout_adjustments_reason_code_enum` |
| `reason` | text | N | — | CHECK `char_length(btrim(reason)) >= 10` |
| `related_type` | varchar(32) | Y | — | CHECK `IN ('dataset','dataset_review','payout_request','annotation_task')` |
| `related_id` | uuid | Y | — | CHECK `(related_type IS NULL) = (related_id IS NULL)` |
| `journal_id` | uuid | N | — | FK → `ledger_journals(id)` [R]; `uq_payout_adjustments_journal_id` UNIQUE |
| `client_idempotency_key` | varchar(128) | N | — | |
| `created_by` | uuid | N | — | FK → `users(id)` [R]; CHECK `ck_payout_adjustments_not_self`: `created_by <> user_id` |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `uq_payout_adjustments_created_by_client_idempotency_key` UNIQUE `(created_by, client_idempotency_key)`; `ix_payout_adjustments_user_id_created_at (user_id, created_at DESC)`.

### 4.5 Annotation

Retention: annotation rows are permanent in v1 (they are licensed derivative data); `annotation_versions` drafts are compacted (last 50 drafts + all submitted, baseline §11).

#### 4.5.1 `annotation_projects`

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `name` | varchar(200) | N | — | `uq_annotation_projects_name` UNIQUE |
| `description` | text | N | `''` | |
| `instructions_md` | text | N | — | markdown, rendered sanitised; CHECK `char_length <= 50000` |
| `status` | varchar(32) | N | `'draft'` | `ck_annotation_projects_status_enum` |
| `annotation_types` | text[] | N | — | `ck_annotation_projects_annotation_types_subset`: `cardinality(annotation_types) >= 1 AND annotation_types <@ ARRAY['transcription','text_correction','classification','metadata','page_label']::text[]` |
| `label_set` | jsonb | N | `'[]'::jsonb` | `[{"code": "invoice", "label": "Invoice"}]`; required non-empty when `classification` selected (app) |
| `metadata_schema` | jsonb | N | `'[]'::jsonb` | `[{key,label,type:text|number|date|select,options,required}]` (baseline §11) |
| `task_unit` | varchar(32) | N | — | `ck_annotation_projects_task_unit_enum` |
| `primary_language` | varchar(16) | Y | — | expected content language |
| `reward_per_task_micros` | bigint | N | `0` | CHECK `>= 0` |
| `reward_per_page_micros` | bigint | N | `0` | CHECK `>= 0` |
| `deadline` | timestamptz | Y | — | |
| `review_required` | boolean | N | `true` | CHECK `ck_annotation_projects_review_required_v1`: `review_required` (always true in v1) |
| `created_by` | uuid | N | — | FK → `users(id)` [R] |
| `activated_at` | timestamptz | Y | — | |
| `closed_at` | timestamptz | Y | — | CHECK `(status = 'closed') = (closed_at IS NOT NULL)` |
| `closed_by` | uuid | Y | — | FK → `users(id)` [R] |
| `lock_version` | integer | N | `1` | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `ix_annotation_projects_status (status)`; FK indexes.

#### 4.5.2 `annotation_project_datasets`

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `project_id` | uuid | N | — | PK part 1; FK → `annotation_projects(id)` [C] |
| `dataset_id` | uuid | N | — | PK part 2; FK → `datasets(id)` [R]; dataset must be `approved`/`partially_approved` (service) |
| `added_by` | uuid | N | — | FK → `users(id)` [R] |
| `added_at` | timestamptz | N | `now()` | |

Indexes: `ix_annotation_project_datasets_dataset_id (dataset_id)`.

#### 4.5.3 `annotation_tasks`

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `project_id` | uuid | N | — | FK → `annotation_projects(id)` [R] |
| `dataset_id` | uuid | N | — | FK → `datasets(id)` [R] |
| `file_id` | uuid | N | — | FK → `dataset_files(id)` [R]; accepted, annotatable file |
| `page_number` | integer | Y | — | set when `task_unit = 'page'`; CHECK `page_number IS NULL OR page_number >= 1` |
| `page_count` | integer | N | `1` | pages covered (whole-file tasks: file page count; page tasks: 1); CHECK `>= 1` |
| `status` | varchar(32) | N | `'unassigned'` | `ck_annotation_tasks_status_enum` |
| `priority` | smallint | N | `0` | higher first |
| `current_assignee_id` | uuid | Y | — | FK → `users(id)` [R]; denormalised from the active assignment (kept after approval as the rewarded annotator); see `ck_annotation_tasks_assignee_state` below |
| `current_reviewer_id` | uuid | Y | — | FK → `users(id)` [R]; CHECK `(status = 'in_review') = (current_reviewer_id IS NOT NULL)` (`ck_annotation_tasks_reviewer_state`) |
| `review_round` | integer | N | `0` | incremented at each submit |
| `due_at` | timestamptz | Y | — | defaults to project deadline |
| `first_submitted_at` | timestamptz | Y | — | |
| `approved_at` | timestamptz | Y | — | CHECK `(status = 'approved') = (approved_at IS NOT NULL)` |
| `cancelled_at` | timestamptz | Y | — | |
| `lock_version` | integer | N | `1` | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Checks: `ck_annotation_tasks_assignee_state`: `(status = 'unassigned' AND current_assignee_id IS NULL) OR (status IN ('assigned','in_progress','submitted','in_review','changes_requested','approved') AND current_assignee_id IS NOT NULL) OR status = 'cancelled'` (unassigned ⇒ no assignee; every worked/approved state ⇒ assignee present; cancelled ⇒ either).

Indexes: `uq_annotation_tasks_project_id_file_id_page_number` UNIQUE `(project_id, file_id, page_number) NULLS NOT DISTINCT` (idempotent task generation); `ix_annotation_tasks_project_id_status (project_id, status)`; `ix_annotation_tasks_current_assignee_id_status (current_assignee_id, status)`; `ix_annotation_tasks_review_queue (first_submitted_at) WHERE status = 'submitted'`; `ix_annotation_tasks_file_id`; `ix_annotation_tasks_dataset_id`; `ix_annotation_tasks_current_reviewer_id`.

#### 4.5.4 `annotation_assignments`

History of who held a task.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `task_id` | uuid | N | — | FK → `annotation_tasks(id)` [R] |
| `annotator_id` | uuid | N | — | FK → `users(id)` [R] |
| `assigned_by` | uuid | N | — | FK → `users(id)` [R] |
| `status` | varchar(32) | N | `'active'` | `ck_annotation_assignments_status_enum` |
| `assigned_at` | timestamptz | N | `now()` | |
| `started_at` | timestamptz | Y | — | |
| `ended_at` | timestamptz | Y | — | CHECK `(status = 'ended') = (ended_at IS NOT NULL)` |
| `end_reason` | varchar(32) | Y | — | `ck_annotation_assignments_end_reason_enum`; CHECK `(status = 'ended') = (end_reason IS NOT NULL)` |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `uq_annotation_assignments_one_active` UNIQUE `(task_id) WHERE status = 'active'` (baseline §10); `ix_annotation_assignments_annotator_id_status (annotator_id, status)`; `ix_annotation_assignments_assigned_by`.

#### 4.5.5 `annotations`

Current working copy of a task's annotation (one per task). `version` is the optimistic lock compared with `If-Match`.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `task_id` | uuid | N | — | FK → `annotation_tasks(id)` [R]; `uq_annotations_task_id` UNIQUE (baseline §10) |
| `last_assignment_id` | uuid | N | — | FK → `annotation_assignments(id)` [R] |
| `last_editor_id` | uuid | N | — | FK → `users(id)` [R] |
| `data` | jsonb | N | `'{}'::jsonb` | baseline §11 shape; transcription stored verbatim (no NFC); CHECK `ck_annotations_data_object`: `jsonb_typeof(data) = 'object'`; size ≤ 2 MiB (app) |
| `content_sha256` | bytea | N | — | SHA-256 of canonical JSON (sorted keys, UTF-8, no normalisation) |
| `version` | integer | N | `1` | CHECK `>= 1`; incremented on every successful save |
| `submitted_version` | integer | Y | — | `version` at last submit |
| `last_saved_at` | timestamptz | N | `now()` | |
| `submitted_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: FK indexes on `last_assignment_id`, `last_editor_id`.

#### 4.5.6 `annotation_versions`

Version history (inserted only when `content_sha256` changes). Drafts beyond the latest 50 per annotation are deleted by `retention.purge`; `submitted` rows are never deleted.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `annotation_id` | uuid | N | — | FK → `annotations(id)` [R] |
| `task_id` | uuid | N | — | FK → `annotation_tasks(id)` [R] |
| `version_no` | integer | N | — | = `annotations.version` after the save; CHECK `>= 1` |
| `kind` | varchar(32) | N | — | `ck_annotation_versions_kind_enum` |
| `data` | jsonb | N | — | |
| `content_sha256` | bytea | N | — | |
| `author_id` | uuid | N | — | FK → `users(id)` [R] |
| `review_round` | integer | N | — | task round when written |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `uq_annotation_versions_annotation_id_version_no` UNIQUE `(annotation_id, version_no)`; `ix_annotation_versions_annotation_id_kind_created_at (annotation_id, kind, created_at DESC)`; `ix_annotation_versions_task_id`; `ix_annotation_versions_author_id`.

#### 4.5.7 `annotation_reviews`

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `task_id` | uuid | N | — | FK → `annotation_tasks(id)` [R] |
| `annotation_id` | uuid | N | — | FK → `annotations(id)` [R] |
| `annotation_version_id` | uuid | N | — | FK → `annotation_versions(id)` [R]; the `submitted` version under review |
| `annotator_id` | uuid | N | — | FK → `users(id)` [R]; author of the reviewed version (reward beneficiary) |
| `reviewer_id` | uuid | N | — | FK → `users(id)` [R]; CHECK `ck_annotation_reviews_not_self`: `reviewer_id <> annotator_id` |
| `review_round` | integer | N | — | |
| `status` | varchar(32) | N | `'in_progress'` | `ck_annotation_reviews_status_enum` |
| `decision` | varchar(32) | Y | — | `ck_annotation_reviews_decision_enum`; CHECK `(status = 'completed') = (decision IS NOT NULL)` |
| `score` | smallint | Y | — | CHECK `score IS NULL OR score BETWEEN 1 AND 5`; required when completed (`ck_annotation_reviews_score_when_completed`: `status <> 'completed' OR score IS NOT NULL`) |
| `comments` | text | Y | — | required for `request_changes` (CHECK `decision IS DISTINCT FROM 'request_changes' OR comments IS NOT NULL`) |
| `claimed_at` | timestamptz | N | `now()` | |
| `completed_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `uq_annotation_reviews_one_active` UNIQUE `(task_id) WHERE status = 'in_progress'`; `uq_annotation_reviews_task_id_review_round` UNIQUE `(task_id, review_round)`; `ix_annotation_reviews_reviewer_id_status (reviewer_id, status)`; FK indexes.

#### 4.5.8 `annotation_feedback`

Anchored reviewer comments.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `annotation_review_id` | uuid | N | — | FK → `annotation_reviews(id)` [R] |
| `task_id` | uuid | N | — | FK → `annotation_tasks(id)` [R] |
| `page_number` | integer | Y | — | CHECK `>= 1` |
| `field_path` | varchar(255) | Y | — | JSON pointer into `data`, e.g. `/pages/0/transcription` |
| `anchor` | jsonb | Y | — | `{"start": int, "end": int}` code-point offsets |
| `severity` | varchar(32) | N | `'minor'` | `ck_annotation_feedback_severity_enum` |
| `comment` | text | N | — | CHECK `char_length(btrim(comment)) BETWEEN 1 AND 4000` |
| `author_id` | uuid | N | — | FK → `users(id)` [R] |
| `resolved_at` | timestamptz | Y | — | |
| `resolved_by` | uuid | Y | — | FK → `users(id)` [R] |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `ix_annotation_feedback_task_id_created_at (task_id, created_at)`; `ix_annotation_feedback_annotation_review_id`; FK indexes.

#### 4.5.9 `annotation_rewards`

Reward computed once per approving review (baseline §10). Append-only.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `annotation_review_id` | uuid | N | — | FK → `annotation_reviews(id)` [R]; `uq_annotation_rewards_annotation_review_id` UNIQUE |
| `task_id` | uuid | N | — | FK → `annotation_tasks(id)` [R]; `uq_annotation_rewards_task_id` UNIQUE (a task is rewarded once) |
| `project_id` | uuid | N | — | FK → `annotation_projects(id)` [R] |
| `annotator_id` | uuid | N | — | FK → `users(id)` [R] |
| `reward_per_task_micros` | bigint | N | — | snapshot; CHECK `>= 0` |
| `reward_per_page_micros` | bigint | N | — | snapshot; CHECK `>= 0` |
| `page_count` | integer | N | — | CHECK `>= 1` |
| `amount_micros` | bigint | N | — | CHECK `ck_annotation_rewards_amount_formula`: `amount_micros = reward_per_task_micros + reward_per_page_micros * page_count` |
| `journal_id` | uuid | Y | — | FK → `ledger_journals(id)` [R]; CHECK `(amount_micros > 0) = (journal_id IS NOT NULL)` |
| `earning_record_id` | uuid | N | — | FK → `earning_records(id)` [R] |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `ix_annotation_rewards_annotator_id_created_at (annotator_id, created_at DESC)`; `ix_annotation_rewards_project_id`; FK indexes.

### 4.6 Communication

#### 4.6.1 `conversations`

Support / dataset / payout / annotation-task threads (Part 13). Retention: closed conversations (and their messages/attachments) are deleted 3 years after `closed_at` unless linked to a payout (then 7 years); on user anonymisation, messages are kept but the sender is shown as "Deleted user".

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `kind` | varchar(32) | N | `'support'` | `ck_conversations_kind_enum` |
| `subject` | varchar(200) | N | — | CHECK `char_length(btrim(subject)) BETWEEN 1 AND 200` |
| `status` | varchar(32) | N | `'open'` | `ck_conversations_status_enum` |
| `requester_id` | uuid | N | — | FK → `users(id)` [R]; contributor/annotator side of the thread |
| `created_by` | uuid | N | — | FK → `users(id)` [R]; may be an admin opening a thread to a user |
| `assigned_admin_id` | uuid | Y | — | FK → `users(id)` [R]; support owner |
| `dataset_id` | uuid | Y | — | FK → `datasets(id)` [R] |
| `payout_id` | uuid | Y | — | FK → `payout_requests(id)` [R] |
| `annotation_task_id` | uuid | Y | — | FK → `annotation_tasks(id)` [R] |
| `last_message_at` | timestamptz | Y | — | |
| `last_message_preview` | varchar(200) | Y | — | |
| `closed_at` | timestamptz | Y | — | CHECK `(status = 'closed') = (closed_at IS NOT NULL)` |
| `closed_by` | uuid | Y | — | FK → `users(id)` [R] |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Checks: `ck_conversations_link_matches_kind`: `(kind = 'support' AND num_nonnulls(dataset_id, payout_id, annotation_task_id) = 0) OR (kind = 'dataset' AND dataset_id IS NOT NULL AND payout_id IS NULL AND annotation_task_id IS NULL) OR (kind = 'payout' AND payout_id IS NOT NULL AND dataset_id IS NULL AND annotation_task_id IS NULL) OR (kind = 'annotation_task' AND annotation_task_id IS NOT NULL AND dataset_id IS NULL AND payout_id IS NULL)`.
Indexes: `ix_conversations_requester_id_last_message_at (requester_id, last_message_at DESC)`; `ix_conversations_status_last_message_at (status, last_message_at DESC)` (support inbox); `ix_conversations_assigned_admin_id_status (assigned_admin_id, status)`; `ix_conversations_dataset_id`; `ix_conversations_payout_id`; `ix_conversations_annotation_task_id`; `ix_conversations_subject_trgm` GIN (`subject gin_trgm_ops`).

#### 4.6.2 `conversation_participants`

Explicit participants; admins with `message.support` can read all `support`/`dataset`/`payout` conversations and are added as participants when they first reply.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `conversation_id` | uuid | N | — | PK part 1; FK → `conversations(id)` [C] |
| `user_id` | uuid | N | — | PK part 2; FK → `users(id)` [R] |
| `role` | varchar(32) | N | — | `ck_conversation_participants_role_enum` |
| `joined_at` | timestamptz | N | `now()` | |
| `last_read_message_id` | uuid | Y | — | FK → `messages(id)` [SN] |
| `last_read_at` | timestamptz | Y | — | |
| `unread_count` | integer | N | `0` | maintained on message insert / read; CHECK `>= 0` |
| `muted` | boolean | N | `false` | suppresses email (not in-app) |
| `left_at` | timestamptz | Y | — | |

Indexes: `ix_conversation_participants_user_id_unread (user_id) WHERE unread_count > 0`; `ix_conversation_participants_user_id (user_id)`; `ix_conversation_participants_last_read_message_id`.

#### 4.6.3 `messages`

Append-only message history (moderation can set `hidden_at`).

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `conversation_id` | uuid | N | — | FK → `conversations(id)` [C] |
| `sender_id` | uuid | Y | — | FK → `users(id)` [R]; NULL for `system` messages |
| `kind` | varchar(32) | N | `'user'` | `ck_messages_kind_enum`; CHECK `ck_messages_sender_kind`: `(kind = 'system') = (sender_id IS NULL)` |
| `body` | text | N | — | plain text, NFC-normalised; CHECK `ck_messages_body_length`: `char_length(body) BETWEEN 0 AND 10000` (empty only with attachments, enforced in service) |
| `client_message_id` | uuid | Y | — | client-generated, makes send idempotent |
| `hidden_at` | timestamptz | Y | — | |
| `hidden_by` | uuid | Y | — | FK → `users(id)` [R] |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `ix_messages_conversation_id_created_at (conversation_id, created_at)`; `uq_messages_conversation_id_sender_id_client_message_id` UNIQUE `(conversation_id, sender_id, client_message_id) WHERE client_message_id IS NOT NULL`; `ix_messages_body_trgm` GIN (`body gin_trgm_ops`) (conversation search, D-DB-09); `ix_messages_sender_id`.

#### 4.6.4 `message_attachments`

Files ≤ 10 MB attached to messages; uploaded first (`message_id` NULL), linked on send, visible only when `scan_status = 'clean'`. Retention: unattached rows/objects deleted after 24 h; otherwise with conversation.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `conversation_id` | uuid | N | — | FK → `conversations(id)` [C] |
| `message_id` | uuid | Y | — | FK → `messages(id)` [C] |
| `uploader_id` | uuid | N | — | FK → `users(id)` [R] |
| `original_filename` | varchar(255) | N | — | |
| `storage_key` | varchar(512) | N | — | `uq_message_attachments_storage_key`; `messages/{conversation_id}/{attachment_id}` |
| `detected_mime` | varchar(255) | N | — | allow-list: PDF, PNG, JPEG, TXT, CSV, DOCX, XLSX |
| `size_bytes` | bigint | N | — | CHECK `ck_message_attachments_size_range`: `size_bytes BETWEEN 1 AND 10485760` |
| `sha256` | bytea | N | — | CHECK `octet_length = 32` |
| `scan_status` | varchar(32) | N | `'pending'` | `ck_message_attachments_scan_status_enum` |
| `scan_signature` | varchar(255) | Y | — | |
| `scanned_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `ix_message_attachments_message_id`; `ix_message_attachments_conversation_id`; `ix_message_attachments_unattached (created_at) WHERE message_id IS NULL`; `ix_message_attachments_uploader_id`.

#### 4.6.5 `notifications`

In-app notifications (Part 13 list). Retention: read notifications deleted after 180 days; unread after 365 days.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | N | — | FK → `users(id)` [C] |
| `type` | varchar(64) | N | — | `ck_notifications_type_enum` |
| `title` | varchar(200) | N | — | rendered from message catalogue at insert |
| `body` | varchar(1000) | N | `''` | |
| `link_path` | varchar(500) | Y | — | relative app path only; CHECK `ck_notifications_link_relative`: `link_path IS NULL OR link_path ~ '^/[^/]'` |
| `entity_type` | varchar(32) | Y | — | |
| `entity_id` | uuid | Y | — | |
| `data` | jsonb | N | `'{}'::jsonb` | |
| `dedupe_key` | varchar(200) | Y | — | e.g. `dataset:{id}:processing_finished:v{n}` |
| `read_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `ix_notifications_user_id_created_at (user_id, created_at DESC)`; `ix_notifications_user_id_unread (user_id) WHERE read_at IS NULL`; `uq_notifications_user_id_dedupe_key` UNIQUE `(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL`.

#### 4.6.6 `email_outbox`

Transactional outbox for email (baseline §13). Retention: rows deleted 90 days after reaching `sent`/`failed`/`cancelled`; `sensitive_context_encrypted` is set to NULL immediately after sending.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | Y | — | FK → `users(id)` [SN] |
| `to_email` | citext | N | — | |
| `template` | varchar(64) | N | — | CHECK `template ~ '^[a-z][a-z0-9_]{1,63}$'`; e.g. `verify_email`, `password_reset`, `notification` |
| `locale` | varchar(10) | N | `'en'` | |
| `subject` | varchar(255) | N | — | |
| `context` | jsonb | N | `'{}'::jsonb` | non-sensitive template variables |
| `sensitive_context_encrypted` | bytea | Y | — | MultiFernet ciphertext (e.g. one-time link) (D-DB-10) |
| `status` | varchar(32) | N | `'pending'` | `ck_email_outbox_status_enum` |
| `attempts` | smallint | N | `0` | CHECK `BETWEEN 0 AND 20` |
| `next_attempt_at` | timestamptz | N | `now()` | |
| `last_error` | text | Y | — | |
| `provider_message_id` | varchar(255) | Y | — | |
| `dedupe_key` | varchar(200) | Y | — | `uq_email_outbox_dedupe_key` UNIQUE (partial `WHERE dedupe_key IS NOT NULL`) |
| `sent_at` | timestamptz | Y | — | CHECK `(status = 'sent') = (sent_at IS NOT NULL)` |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `ix_email_outbox_dispatch (next_attempt_at) WHERE status IN ('pending','sending')`; `ix_email_outbox_user_id`.

### 4.7 Operations

#### 4.7.1 `audit_logs`

Append-only audit trail for every state transition and privileged read/export (baseline §9 last paragraph). Immutable except guarded retention purge (§6.5). Retention: 7 years.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `occurred_at` | timestamptz | N | `now()` | |
| `actor_type` | varchar(32) | N | — | `ck_audit_logs_actor_type_enum` |
| `actor_id` | uuid | Y | — | FK → `users(id)` [R]; CHECK `(actor_type = 'user') = (actor_id IS NOT NULL)` |
| `actor_roles` | text[] | N | `'{}'` | roles at the time of action |
| `action` | varchar(100) | N | — | `<module>.<entity>.<verb>`, e.g. `finance.payout.approve`; CHECK `action ~ '^[a-z_]+(\.[a-z_]+){1,3}$'` |
| `entity_type` | varchar(64) | N | — | table name of the primary entity |
| `entity_id` | uuid | Y | — | |
| `changes` | jsonb | N | `'{}'::jsonb` | `{field: [before, after]}`, secrets redacted |
| `before` | jsonb | Y | — | full redacted snapshot for state transitions |
| `after` | jsonb | Y | — | |
| `metadata` | jsonb | N | `'{}'::jsonb` | e.g. export filters, reason text |
| `ip_address` | inet | Y | — | |
| `user_agent` | varchar(512) | Y | — | |
| `request_id` | varchar(64) | Y | — | |
| `session_id` | uuid | Y | — | not an FK (sessions are purged) |

Indexes: `ix_audit_logs_entity_type_entity_id_occurred_at (entity_type, entity_id, occurred_at DESC)`; `ix_audit_logs_actor_id_occurred_at (actor_id, occurred_at DESC)`; `ix_audit_logs_action_occurred_at (action, occurred_at DESC)`; `ix_audit_logs_request_id (request_id)`; `ix_audit_logs_occurred_at_brin` BRIN (`occurred_at`).

#### 4.7.2 `export_jobs`

Admin export jobs (Part 14). Retention: row kept 1 year (who exported what); objects expire after `export_retention_days` (default 7).

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `requested_by` | uuid | N | — | FK → `users(id)` [R] |
| `status` | varchar(32) | N | `'queued'` | `ck_export_jobs_status_enum` |
| `filters` | jsonb | N | — | `{dataset_ids?, categories?, languages?, min_quality?, data_class?, statuses:['approved','partially_approved'], date_from?, date_to?}` |
| `include_files` | boolean | N | `true` | |
| `include_metadata` | boolean | N | `true` | |
| `include_annotations` | boolean | N | `false` | approved annotations only |
| `manifest_format` | varchar(32) | N | `'jsonl'` | `ck_export_jobs_manifest_format_enum` |
| `dataset_ids` | uuid[] | N | `'{}'` | resolved snapshot of included datasets (set when job starts) |
| `dataset_count` | integer | Y | — | |
| `file_count` | integer | Y | — | |
| `total_bytes` | bigint | Y | — | uncompressed payload; CHECK `>= 0` |
| `progress_percent` | smallint | N | `0` | CHECK `BETWEEN 0 AND 100` |
| `progress_detail` | jsonb | N | `'{}'::jsonb` | `{phase, files_done, bytes_done}` |
| `celery_task_id` | varchar(155) | Y | — | |
| `attempts` | smallint | N | `0` | |
| `started_at` | timestamptz | Y | — | |
| `completed_at` | timestamptz | Y | — | CHECK `status NOT IN ('completed','expired') OR completed_at IS NOT NULL` |
| `failed_at` | timestamptz | Y | — | |
| `error_code` | varchar(64) | Y | — | CHECK `status <> 'failed' OR error_code IS NOT NULL` |
| `error_message` | text | Y | — | |
| `expires_at` | timestamptz | Y | — | `completed_at + export_retention_days` |
| `expired_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `ix_export_jobs_requested_by_created_at (requested_by, created_at DESC)`; `ix_export_jobs_status_created_at (status, created_at DESC)`; `ix_export_jobs_expiry (expires_at) WHERE status = 'completed'`; `ix_export_jobs_dataset_ids` GIN (`dataset_ids`).

#### 4.7.3 `export_files`

ZIP parts produced by an export (split at 4 GB per part).

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `export_job_id` | uuid | N | — | FK → `export_jobs(id)` [C] |
| `part_no` | integer | N | — | CHECK `>= 1` |
| `storage_key` | varchar(512) | N | — | `uq_export_files_storage_key`; `exports/{export_job_id}/datahub-export-{job_id}-part{n:03d}.zip` (deterministic → rebuild overwrites same key) |
| `file_name` | varchar(255) | N | — | |
| `content_type` | varchar(64) | N | `'application/zip'` | |
| `size_bytes` | bigint | N | — | CHECK `>= 0` |
| `sha256` | bytea | N | — | CHECK `octet_length = 32` |
| `download_count` | integer | N | `0` | |
| `object_deleted_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |

Indexes: `uq_export_files_export_job_id_part_no` UNIQUE `(export_job_id, part_no)`.

#### 4.7.4 `system_settings`

Business-tunable settings (secrets never stored here — they live in environment, see LLD core settings). Cached in Redis for 60 s; cache busted on write. Retention: permanent; changes audited.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `key` | varchar(64) | N | — | PK; CHECK `key ~ '^[a-z][a-z0-9_]{1,63}$'` |
| `value` | jsonb | N | — | |
| `value_type` | varchar(32) | N | — | `ck_system_settings_value_type_enum`; CHECK `ck_system_settings_value_matches_type`: `(value_type = 'integer' AND jsonb_typeof(value) = 'number') OR (value_type = 'boolean' AND jsonb_typeof(value) = 'boolean') OR (value_type = 'string' AND jsonb_typeof(value) = 'string') OR (value_type = 'string_list' AND jsonb_typeof(value) = 'array') OR (value_type = 'json' AND jsonb_typeof(value) IN ('object','array'))` |
| `description` | text | N | — | |
| `is_public` | boolean | N | `false` | exposed via `/public/*` (e.g. min withdrawal) |
| `updated_by` | uuid | Y | — | FK → `users(id)` [R] |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Seeded keys (revision 0001; finance keys in 0005): `earning_hold_days`=0, `min_withdrawal_micros`=10000000, `max_withdrawal_micros`=5000000000, `payout_dual_approval_threshold_micros`=100000000, `labeled_upgrade_enabled`=true, `max_file_bytes`=5000000000, `max_dataset_bytes`=50000000000, `user_pending_quota_bytes`=200000000000, `max_files_per_dataset`=2000, `upload_session_ttl_hours`=24, `extra_allowed_extensions`=[], `dataset_categories`=["books","newspapers","government_documents","academic","forms","receipts_invoices","handwriting","religious_texts","web_text","legal","medical","other"], `export_retention_days`=7, `rejected_object_retention_days`=90, `withdrawn_draft_retention_days`=30, `annotation_draft_versions_keep`=50, `registration_open`=true, `maintenance_banner`="", `clamd_max_scan_bytes`=4000000000.

#### 4.7.5 `background_job_records`

Admin-visible record of Celery task executions (baseline §13). Retention: `succeeded` 30 days; `failed`/`dead` 180 days.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `task_name` | varchar(128) | N | — | e.g. `datahub.processing.process_file` |
| `queue` | varchar(32) | N | — | CHECK `IN ('default','processing','exports','email')` |
| `celery_task_id` | varchar(155) | Y | — | |
| `args_hash` | bytea | N | — | SHA-256 of canonical JSON args |
| `args` | jsonb | N | `'{}'::jsonb` | ids only, never secrets |
| `entity_type` | varchar(64) | Y | — | |
| `entity_id` | uuid | Y | — | |
| `status` | varchar(32) | N | `'queued'` | `ck_background_job_records_status_enum` |
| `attempts` | smallint | N | `0` | |
| `max_attempts` | smallint | N | `3` | |
| `last_error` | text | Y | — | truncated to 4,000 chars |
| `enqueued_at` | timestamptz | N | `now()` | |
| `started_at` | timestamptz | Y | — | |
| `finished_at` | timestamptz | Y | — | |
| `next_retry_at` | timestamptz | Y | — | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `uq_background_job_records_inflight` UNIQUE `(task_name, args_hash) WHERE status IN ('queued','running','retrying')` (de-duplicates in-flight enqueues); `ix_background_job_records_status_updated_at (status, updated_at DESC)`; `ix_background_job_records_entity (entity_type, entity_id)`.

#### 4.7.6 `takedown_requests`

Rights-holder / privacy complaints and resulting admin actions. Retention: 7 years.

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `source` | varchar(32) | N | — | `ck_takedown_requests_source_enum` |
| `dataset_id` | uuid | Y | — | FK → `datasets(id)` [R] |
| `file_id` | uuid | Y | — | FK → `dataset_files(id)` [R] |
| `requester_user_id` | uuid | Y | — | FK → `users(id)` [R] |
| `requester_name` | varchar(200) | N | — | |
| `requester_email` | citext | N | — | |
| `requester_organization` | varchar(200) | Y | — | |
| `claim_type` | varchar(32) | N | — | `ck_takedown_requests_claim_type_enum` |
| `description` | text | N | — | CHECK `char_length BETWEEN 20 AND 10000` |
| `evidence_url` | varchar(2048) | Y | — | |
| `status` | varchar(32) | N | `'received'` | `ck_takedown_requests_status_enum` |
| `decided_by` | uuid | Y | — | FK → `users(id)` [R] |
| `decided_at` | timestamptz | Y | — | |
| `decision_notes` | text | Y | — | |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `ix_takedown_requests_status_created_at (status, created_at)`; `ix_takedown_requests_dataset_id`; `ix_takedown_requests_file_id`; FK indexes.

#### 4.7.7 `deletion_requests`

Account deletion requests (`POST /me/deletion-request`). Retention: 7 years (evidence of erasure).

| Column | Type | Null | Default | Constraints / notes |
|---|---|---|---|---|
| `id` | uuid | N | — | PK |
| `user_id` | uuid | N | — | FK → `users(id)` [R] |
| `status` | varchar(32) | N | `'requested'` | `ck_deletion_requests_status_enum` |
| `reason` | text | Y | — | |
| `requested_at` | timestamptz | N | `now()` | |
| `scheduled_for` | timestamptz | N | — | `requested_at + 14 days` grace (user may cancel) |
| `blockers` | jsonb | N | `'[]'::jsonb` | e.g. `["open_payout","positive_balance","review_in_progress"]` evaluated at processing |
| `decided_by` | uuid | Y | — | FK → `users(id)` [R] |
| `decided_at` | timestamptz | Y | — | |
| `decision_notes` | text | Y | — | |
| `completed_at` | timestamptz | Y | — | CHECK `(status = 'completed') = (completed_at IS NOT NULL)` |
| `created_at` | timestamptz | N | `now()` | |
| `updated_at` | timestamptz | N | `now()` | |

Indexes: `uq_deletion_requests_one_open` UNIQUE `(user_id) WHERE status IN ('requested','processing')`; `ix_deletion_requests_due (scheduled_for) WHERE status = 'requested'`.

---

## 5. Baseline key constraints — traceability

| Baseline §10 constraint | Implemented as |
|---|---|
| `users.email` unique (citext, lower) | `uq_users_email` on `citext` + `ck_users_email_lower` |
| `user_roles (user_id, role_id)` PK | `pk_user_roles` |
| `dataset_files (dataset_id, sha256)` index + global index on `sha256` | `ix_dataset_files_dataset_id_sha256`, `ix_dataset_files_sha256` |
| `dataset_file_reviews (review_id, file_id)` unique | `uq_dataset_file_reviews_review_id_file_id` |
| `earning_records (source_type, source_id, file_id)` unique | `uq_earning_records_source_type_source_id_file_id` (NULLS NOT DISTINCT) |
| `ledger_journals.idempotency_key` unique | `uq_ledger_journals_idempotency_key` |
| `payout_requests (user_id, client_idempotency_key)` unique | `uq_payout_requests_user_id_client_idempotency_key` |
| one open payout per user `WHERE status IN ('requested','approved')` | `uq_payout_requests_one_open` |
| `payout_approvals (payout_id, approver_id)` unique | `uq_payout_approvals_payout_id_approver_id` |
| `payout_records.payout_id` unique | `uq_payout_records_payout_id` |
| `annotation_assignments` one active per task | `uq_annotation_assignments_one_active` |
| `annotations (task_id)` unique with `version int` | `uq_annotations_task_id` + `annotations.version` |
| `annotation_rewards.annotation_review_id` unique | `uq_annotation_rewards_annotation_review_id` |
| `pricing_rules (data_class, effective_from)` unique + non-overlapping | `uq_pricing_rules_data_class_effective_from` + `ex_pricing_rules_no_overlap` |
| archive members keyed `(parent_file_id, member_path)` (§13) | `uq_dataset_files_parent_file_id_member_path` |
| duplicates upsert on `(file_id, matched_file_id, kind)` (§13) | `uq_dataset_duplicates_file_id_matched_file_id_kind` |
| CHECK on cached balances (§8.5) | `ck_wallets_*_nonneg` |
| payout whole cents (§8.7) | `ck_payout_requests_amount_whole_cents` |

Additional partial unique indexes introduced here: `uq_contributor_verifications_one_pending`, `uq_payout_methods_one_default`, `uq_upload_sessions_resume`, `uq_dataset_licenses_one_active`, `uq_dataset_reviews_one_active`, `uq_dataset_reviews_one_finalized_per_version`, `uq_earning_records_sha256_base_payment`, `uq_earning_records_sha256_upgrade_payment`, `uq_annotation_reviews_one_active`, `uq_messages_conversation_id_sender_id_client_message_id`, `uq_notifications_user_id_dedupe_key`, `uq_email_outbox_dedupe_key`, `uq_background_job_records_inflight`, `uq_deletion_requests_one_open`, `uq_agreement_acceptances_account_level`, `uq_agreement_acceptances_dataset_level`.

---

## 6. Triggers and database functions

All functions are `LANGUAGE plpgsql`, `SECURITY INVOKER`, created in revision 0001 (generic) or 0005 (ledger). Errors use SQLSTATE `restrict_violation` (23001) or `check_violation` (23514), which `core.errors` maps to HTTP 500 `integrity_violation` and reports to Sentry at error level (they indicate a defect, never a user error).

### 6.1 Append-only guard (ledger and other immutable tables)

```sql
CREATE OR REPLACE FUNCTION dh_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- ledger_journals
CREATE TRIGGER trg_ledger_journals_immutable
  BEFORE UPDATE OR DELETE ON ledger_journals
  FOR EACH ROW EXECUTE FUNCTION dh_forbid_mutation();
CREATE TRIGGER trg_ledger_journals_no_truncate
  BEFORE TRUNCATE ON ledger_journals
  FOR EACH STATEMENT EXECUTE FUNCTION dh_forbid_mutation();

-- wallet_transactions
CREATE TRIGGER trg_wallet_transactions_immutable
  BEFORE UPDATE OR DELETE ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION dh_forbid_mutation();
CREATE TRIGGER trg_wallet_transactions_no_truncate
  BEFORE TRUNCATE ON wallet_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION dh_forbid_mutation();
```

The same `dh_forbid_mutation` row trigger (`BEFORE UPDATE OR DELETE`) is attached to `payout_approvals`, `payout_adjustments` and `annotation_rewards` (`trg_<table>_immutable`). Test fixtures never truncate ledger tables; the test database is recreated per session (§8.6).

### 6.2 Per-journal zero-sum (deferred constraint triggers)

```sql
CREATE OR REPLACE FUNCTION dh_ledger_check_journal_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_journal_id uuid;
  v_lines      integer;
  v_sum        numeric;
  v_positive   numeric;
  v_amount     bigint;
BEGIN
  IF TG_TABLE_NAME = 'ledger_journals' THEN
    v_journal_id := NEW.id;
  ELSE
    v_journal_id := NEW.journal_id;
  END IF;

  SELECT count(*),
         coalesce(sum(amount_micros), 0),
         coalesce(sum(amount_micros) FILTER (WHERE amount_micros > 0), 0)
    INTO v_lines, v_sum, v_positive
    FROM wallet_transactions
   WHERE journal_id = v_journal_id;

  SELECT amount_micros INTO v_amount FROM ledger_journals WHERE id = v_journal_id;

  IF v_lines < 2 THEN
    RAISE EXCEPTION 'journal % has % line(s); at least 2 required', v_journal_id, v_lines
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_sum <> 0 THEN
    RAISE EXCEPTION 'journal % is unbalanced: sum = %', v_journal_id, v_sum
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_positive <> v_amount THEN
    RAISE EXCEPTION 'journal % amount % does not equal sum of debits %', v_journal_id, v_amount, v_positive
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_wallet_transactions_balanced
  AFTER INSERT ON wallet_transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION dh_ledger_check_journal_balanced();

CREATE CONSTRAINT TRIGGER trg_ledger_journals_has_lines
  AFTER INSERT ON ledger_journals
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION dh_ledger_check_journal_balanced();
```

Because both triggers are `INITIALLY DEFERRED`, the service inserts the header and lines in any order inside one transaction; the check runs at `COMMIT` and an unbalanced journal aborts the whole transaction (including the business state change that caused it). Services must never `SET CONSTRAINTS … IMMEDIATE` on these triggers except in tests.

### 6.3 Bucket/wallet-kind consistency

```sql
CREATE OR REPLACE FUNCTION dh_ledger_check_bucket() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_kind varchar(32);
BEGIN
  SELECT kind INTO v_kind FROM wallets WHERE id = NEW.wallet_id;
  IF (v_kind = 'user'   AND NEW.bucket NOT IN ('pending','available','reserved','paid'))
  OR (v_kind = 'system' AND NEW.bucket <> 'main') THEN
    RAISE EXCEPTION 'bucket % not allowed for % wallet %', NEW.bucket, v_kind, NEW.wallet_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wallet_transactions_bucket
  BEFORE INSERT ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION dh_ledger_check_bucket();
```

### 6.4 Pricing-rule guard

```sql
CREATE OR REPLACE FUNCTION dh_pricing_rules_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'pricing_rules rows cannot be deleted' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.effective_to IS NOT NULL
     OR NEW.effective_to IS NULL
     OR (NEW.id, NEW.data_class, NEW.rate_micros_per_gb, NEW.currency, NEW.effective_from,
         NEW.reason, NEW.created_by, NEW.created_at)
        IS DISTINCT FROM
        (OLD.id, OLD.data_class, OLD.rate_micros_per_gb, OLD.currency, OLD.effective_from,
         OLD.reason, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'pricing_rules: only closing an open rule (setting effective_to once) is allowed'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pricing_rules_guard
  BEFORE UPDATE OR DELETE ON pricing_rules
  FOR EACH ROW EXECUTE FUNCTION dh_pricing_rules_guard();
```

### 6.5 Audit-log guard

```sql
CREATE OR REPLACE FUNCTION dh_audit_logs_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'restrict_violation';
  END IF;
  -- DELETE: only the retention job, only rows past retention
  IF coalesce(current_setting('datahub.audit_purge', true), 'off') <> 'on'
     OR OLD.occurred_at >= now() - interval '7 years' THEN
    RAISE EXCEPTION 'audit_logs delete not permitted' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_audit_logs_guard
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION dh_audit_logs_guard();
```

`retention.purge` runs `SET LOCAL datahub.audit_purge = 'on'` inside its own transaction before deleting expired audit rows. In addition, production grants: `datahub_app` has `INSERT, SELECT` only on `audit_logs`, `ledger_journals`, `wallet_transactions`; the purge uses role `datahub_retention` with `DELETE` on `audit_logs`.

### 6.6 Trigger tests (mandatory)

`tests/db/test_ledger_triggers.py` asserts: unbalanced journal → commit fails with `check_violation`; single-line journal → fails; journal amount ≠ Σ positives → fails; `UPDATE`/`DELETE`/`TRUNCATE` on journals/lines → `restrict_violation`; `main` bucket on a user wallet → fails; pricing rule overlap → `exclusion_violation`; pricing rule second close → fails; audit update → fails; audit delete without GUC → fails.

---

## 7. Soft-delete, anonymisation and retention

### 7.1 Strategy

| Pattern | Used for | Mechanism |
|---|---|---|
| Never delete | `users`, finance tables, review tables, `audit_logs` (< 7 y), annotation rows | FKs `RESTRICT`; immutability triggers where append-only |
| Soft delete (`deleted_at` / `removed_at` / `hidden_at`) | `payout_methods`, `dataset_files` (removed after review history exists), `messages` (moderation) | default queries filter `… IS NULL` via repository helpers |
| Hard delete by retention | sessions, email tokens, upload sessions, unreferenced drafts, notifications, outbox, job records, security events, compacted draft versions | `retention.purge` (daily, batched 5,000 rows per transaction, `ORDER BY` PK to keep locks short) |
| Object purge, row kept | rejected datasets' files, expired exports | `object_purged_at` / `object_deleted_at` set after successful S3 delete |
| Anonymisation | user deletion | §7.2 |

### 7.2 Account anonymisation (deletion request completed)

Executed by `identity.service.anonymize_user(db, user_id, actor)` in one transaction, after the 14-day grace and only if no blockers (open payout, `available + pending + reserved > 0` — the user must withdraw or explicitly forfeit via adjustment —, dataset `in_review`, active annotation assignment):

1. `users`: `email = 'deleted+' || id || '@anonymized.invalid'`, `display_name = 'Deleted user'`, `password_hash = NULL`, `mfa_enabled = false`, `mfa_secret_encrypted = NULL`, `status = 'anonymized'`, `anonymized_at = now()`.
2. `user_profiles`: `legal_name, country_code, date_of_birth, phone, organization, timezone = NULL`, `notification_preferences = '{}'`.
3. Delete `user_sessions`, `email_verifications`, `mfa_recovery_codes`, `user_roles`, `notifications`; cancel pending `email_outbox` rows.
4. `payout_methods.details = '{"redacted": true}'`, `display_hint = 'redacted'`, `deleted_at = now()`.
5. Draft/withdrawn datasets: purged (rows + objects). Submitted-but-unfinalized datasets block deletion (blocker `review_in_progress`) or are withdrawn first by the user. Approved datasets remain (licence granted, HA-02) with `owner_id` pointing at the anonymised user.
6. `contributor_verifications` PII kept until financial retention expiry (7 y after last journal), then nulled by `retention.purge`; ID document objects deleted immediately if no ledger activity exists.
7. `audit_logs`, ledger, payout rows untouched (lawful retention of financial records, HA-03/HA-04 pending legal confirmation).
8. Write `audit_logs` (`identity.user.anonymize`) and `deletion_requests.status = 'completed'`.

### 7.3 Retention matrix (executed by `retention.purge`, beat daily 02:30 UTC)

| Data | Rule | Action |
|---|---|---|
| `upload_sessions` open past `expires_at` | 24 h (A-15) | `uploads.expire_sessions` (every 15 min): abort S3 multipart, status `expired`, delete `pending_upload` file row |
| `upload_sessions` terminal | 30 d after `updated_at` | delete row (cascades `upload_parts`) |
| `datasets` `withdrawn` never finalized, no reviews | 30 d after `withdrawn_at` (A-15) | delete objects, then delete dataset row (cascade) |
| `datasets` `draft` untouched | 180 d after `updated_at`, after 2 reminder emails | delete objects, then row |
| `datasets` `rejected` | 90 d after `finalized_at` (A-15) | delete file/preview/text objects; set `object_purged_at`/`objects_purged_at`; rows kept (review evidence) |
| `dataset_files` `quarantined` | 30 d after `processed_at` | delete quarantined object; row kept |
| `export_files` objects | `export_retention_days` (7 d) | `exports.expire`: delete objects, `object_deleted_at`, job → `expired` |
| `export_jobs` rows | 1 y | delete (cascade files) |
| `user_sessions` | 30 d after expiry/revocation | delete |
| `email_verifications` | 30 d after expiry/consumption | delete |
| `security_events` | 1 y (A-15) | delete |
| `audit_logs` | 7 y (A-15) | delete with guard GUC (§6.5) |
| ledger / payout / earning / review tables | ≥ 7 y; permanent in v1 | none |
| `notifications` | read 180 d / unread 365 d | delete |
| `email_outbox` | 90 d after terminal | delete |
| `message_attachments` unattached | 24 h | delete object + row |
| `conversations` closed | 3 y (7 y if `payout_id` set) | delete objects, rows (cascade) |
| `background_job_records` | succeeded 30 d; failed/dead 180 d | delete |
| `annotation_versions` drafts | keep latest 50 per annotation | delete older `draft` rows |
| `contributor_verifications` PII | 7 y after last ledger activity; 90 d after rejection without ledger activity | null PII columns, delete ID object |

All retention periods marked A-15 are pending legal review (HA-03); values are read from `system_settings` where a key exists.

---

## 8. Migration strategy (Alembic)

### 8.1 Rules

1. **No manual schema changes** in any environment. The production DB role used by the app has no DDL privileges (A-DB-01); `alembic upgrade head` runs as a one-off release step (`datahub_migrator`) before new app containers start.
2. Models (`modules/<m>/models.py`) and migrations must agree: CI runs `alembic check` (autogenerate diff must be empty). Objects autogenerate cannot see (triggers, functions, exclusion constraints, partial-index predicates, seed data) are written by hand with `op.execute()` and covered by tests.
3. Every revision has a working `downgrade()` until the release that contains it ships to production; after that, rollbacks are forward-fixes (new revision).
4. Data migrations (backfills) are separate revisions from schema changes, batched (≤ 10,000 rows per statement) and idempotent.
5. Constraint/index names come from `NAMING_CONVENTION` (§1.1); hand-written names follow the same prefixes.

### 8.2 File and revision naming

- Directory: `apps/api/alembic/versions/`.
- File name: `<rev>_<phase>_<slug>.py`, e.g. `0005_e_finance_ledger.py`.
- Revision id: the 4-digit sequence string (`"0005"`); `down_revision` the previous one; linear history enforced by a CI check (`alembic heads` must return exactly one head).
- `alembic.ini`: `file_template = %%(rev)s_%%(slug)s`, `truncate_slug_length = 40`; `env.py` sets `target_metadata` with naming convention, `compare_type=True`, `compare_server_default=True`, and `transaction_per_migration=True`.

### 8.3 One revision per implementation phase (initial build)

During the initial build (Phases A–H of the master prompt) each phase contributes exactly one schema revision; corrections before the phase is merged amend that revision; after merge, a new revision is added.

| Rev | Phase | Contents |
|---|---|---|
| `0001_a_foundation` | A | extensions (§1.4); functions `dh_forbid_mutation`, `dh_audit_logs_guard`; tables `system_settings` (+ seed), `audit_logs` (+ guard trigger), `background_job_records` |
| `0002_b_identity` | B | `users`, `user_profiles`, `roles` (+ seed of 5 roles & permissions), `user_roles`, `user_sessions`, `email_verifications`, `payout_methods`, `contributor_verifications`, `agreement_acceptances` (without `dataset_id`), `security_events`, `mfa_recovery_codes`, `deletion_requests`, `notifications`, `email_outbox` |
| `0003_c_datasets` | C | `datasets`, `dataset_versions`, `dataset_files`, `dataset_metadata`, `upload_sessions`, `upload_parts`, `dataset_licenses`, `dataset_duplicates`, `file_previews`; adds `agreement_acceptances.dataset_id` + its partial unique indexes |
| `0004_d_review` | D | `dataset_reviews` (without `pricing_rule_id`, `ledger_journal_id`), `dataset_file_reviews`, `dataset_quality_scores`, `takedown_requests` |
| `0005_e_finance` | E | ledger functions/triggers (§6.1–6.4); `pricing_rules` (+ exclusion constraint, guard trigger, seed), `wallets` (+ 4 system wallets), `ledger_journals`, `wallet_transactions`, `earning_records` (without annotation FKs), `payout_requests`, `payout_approvals`, `payout_records`, `payout_adjustments`; adds `dataset_reviews.pricing_rule_id`, `dataset_reviews.ledger_journal_id`; seeds finance `system_settings` keys |
| `0006_f_annotation` | F | all nine annotation tables; adds `earning_records.annotation_review_id`, `earning_records.annotation_task_id` and the final form of `ck_earning_records_source_fk` (replacing the dataset-only form from 0005) |
| `0007_g_communication_exports` | G | `conversations`, `conversation_participants`, `messages`, `message_attachments`, `export_jobs`, `export_files` |
| `0008_h_hardening` | H | performance indexes found during load tests, `pg_trgm` search indexes if deferred, role grants (`datahub_app`, `datahub_retention`) |

After v1.0 release: one revision per change, named `<NNNN>_<slug>.py`.

### 8.4 Expand/contract (zero-downtime) rules

Every post-release change that is not purely additive is split across releases:

1. **Expand** (release N): add nullable column / new table / new CHECK value (`DROP CONSTRAINT` + `ADD CONSTRAINT … NOT VALID` + `VALIDATE CONSTRAINT`) / new index `CREATE INDEX CONCURRENTLY` (in an `autocommit_block()`). Code writes both old and new shapes.
2. **Migrate**: backfill revision (batched, idempotent), deployed with N or N+1.
3. **Contract** (release N+1 or later, after all running code no longer reads the old shape): drop old column/constraint, set `NOT NULL` (via `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE` → `SET NOT NULL` → drop the helper CHECK).

Forbidden in a single step on large tables: column rename, type change that rewrites the table, `ADD COLUMN … DEFAULT <volatile>`, non-concurrent index creation on `dataset_files`, `wallet_transactions`, `audit_logs`, `messages`. Every migration sets `SET LOCAL lock_timeout = '5s'` and `statement_timeout = '15min'` (except concurrent index builds).

### 8.5 Seed data

Seeds that are part of the schema contract are inserted by migrations with fixed UUIDs (so they are identical across environments): 5 roles, 4 system wallets, 2 initial pricing rules, default `system_settings`. Users (including the first super_admin) are **never** seeded by migrations; `scripts/create-admin` creates them.

### 8.6 Migration tests (CI, real PostgreSQL 17 service container)

| Test | Assertion |
|---|---|
| `test_upgrade_head_from_empty` | `alembic upgrade head` succeeds on an empty database |
| `test_no_model_drift` | `alembic check` reports no differences |
| `test_stairway` | for each revision r: `upgrade r` → `downgrade r-1` → `upgrade r` succeeds (catches broken downgrades) |
| `test_single_head` | exactly one head |
| `test_enum_checks_match_python` | every `ck_*_enum` value list equals its `StrEnum` |
| `test_identifier_lengths` | no constraint/index name exceeds 63 bytes |
| `test_every_fk_indexed` | every FK column set is the prefix of some index |
| `test_money_columns` | every column ending `_micros` is `bigint`; every `_bytes` column is `bigint`; no `real`/`double precision` columns exist |
| `test_ledger_triggers` etc. | §6.6 |
| `test_seed_data` | roles, system wallets, pricing rules and settings present with fixed IDs |
