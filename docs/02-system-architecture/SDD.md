# DataHub — System Design Document (SDD)

## Document control

| Field | Value |
|---|---|
| Document ID | DH-ARCH-SDD |
| Version | 1.1 (baseline §16 AM-01, AM-02, AM-03, AM-06, AM-10 applied) |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | CTO role |
| Canonical source | [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) |
| Related | [SAD](SAD.md) · [HLD](HLD.md) · [DFD](DFD.md) · [ADR index](ADR/README.md) · LLD.md · DATABASE_SCHEMA.md · `../01-business-product/PRICING_PAYOUT_POLICY.md` |

## Header

- **Purpose.** Specify how DataHub's components interact at runtime: the request pipeline and every critical business lifecycle (upload, review, earnings, payout, annotation, notification), plus error recovery, scalability, concurrency control and reliability patterns, precisely enough to implement and test against.
- **Scope.** Runtime behaviour of `datahub_web`, `datahub_api`, `datahub_worker`, `datahub_beat`, `datahub_postgres`, `datahub_redis`, object storage, `datahub_clamav` and SMTP. Class-level design is in LLD.md; table definitions in DATABASE_SCHEMA.md.
- **Assumptions.** A-03 (scale), A-04 (micro-USD), A-06 (withdrawal min/max), A-07 (hold period default 0), A-08 (verification gates withdrawals and annotation assignment), A-09 (upload preconditions), A-10 (fail-closed scan), A-12 (SMTP), A-14 (annotation reward), A-15 (retention).
- **Decisions.** ADR-0004 (Celery), ADR-0006 (multipart uploads), ADR-0008 (sessions + CSRF), ADR-0009 (ledger), ADR-0010 (ClamAV fail-closed), ADR-0011 (optimistic locking), ADR-0012 (outbox), ADR-0014 (RBAC), ADR-0015 (realtime).
- **Dependencies.** Baseline §§6–13 (permissions, formats, money rules, state machines, tables, API, jobs); HA-07 (dual-approval threshold), HA-08 (labeled upgrade).
- **Acceptance criteria.**
  1. Each lifecycle named in MASTER Part 5 item 10 has a sequence diagram whose status values match baseline §9 exactly.
  2. Every money-moving step names its journal kind and idempotency key from baseline §8.5.
  3. Every concurrency hazard identified has a named control (lock, constraint, version, guard).
  4. Every background task in baseline §13 has a retry/idempotency rule.
  5. All Mermaid diagrams render.

---

## 1. Component interactions

| From → To | Mechanism | Purpose | Sync/async |
|---|---|---|---|
| Browser → Caddy (prod) / Next.js (dev) | HTTPS | Pages and `/api/v1` | Sync |
| Browser → Object storage | Presigned PUT part / GET (public endpoint) | Upload bytes, view previews, download | Sync, direct |
| Browser ↔ API | WebSocket `/api/v1/ws` | Realtime events | Async push |
| Next.js server → API | HTTP to `http://datahub_api:8000` with forwarded cookie | Server-rendered shells (`/auth/me`) | Sync |
| API → Postgres | psycopg 3 pool | All reads/writes in one transaction per request | Sync |
| API → Redis | redis-py | Rate limits, enqueue tasks, PUBLISH events | Sync, after commit for enqueue/publish |
| API → Object storage | S3 API (internal endpoint) | Multipart control, ListParts, HEAD, small PUTs (attachments, proofs), presign (public endpoint client) | Sync |
| Worker → Object storage | S3 API (internal endpoint) | Stream originals, write derivatives, members, exports | Sync within task |
| Worker → ClamAV | clamd INSTREAM TCP 3310 | Malware scan | Sync within task |
| Worker → SMTP | SMTP + TLS | Send outbox email | Sync within task |
| Worker → Redis | PUBLISH | `notification.created` after job commits | Async |
| Beat → Redis | Enqueue periodic tasks | Schedules | Async |
| API process ↔ API process | Redis pub/sub channels `user:{user_id}`, `session:{session_id}` | WebSocket fan-out across replicas | Async |

## 2. Request lifecycle

Middleware and dependency order (outermost first): **request id → structured logging → rate limit → session auth → CSRF → permission → handler (service, transaction) → audit**. Audit rows are written by the service **inside** the handler transaction so the change and its audit trail commit atomically; the audit stage after the handler records security events for denied/failed requests.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant C as Caddy or Next.js rewrite
    participant RID as RequestId MW
    participant LOG as Logging MW
    participant RL as RateLimit MW
    participant SES as Session dependency
    participant CS as CSRF guard
    participant PERM as require permission
    participant H as Handler and Service
    participant R as Redis
    participant DB as Postgres
    B->>C: HTTPS request with dh_session and dh_csrf cookies
    C->>RID: forward with X-Forwarded-For
    RID->>RID: accept valid X-Request-ID or generate new id
    RID->>LOG: bind request_id, method, path to structlog context
    LOG->>RL: continue
    RL->>R: INCR counter for ip and route bucket with TTL
    alt limit exceeded
        RL-->>B: 429 rate_limited with Retry-After
    end
    RL->>SES: continue
    SES->>DB: SELECT user_sessions by sha256 of token join users
    alt missing, expired, revoked or user not allowed
        SES-->>B: 401 unauthenticated
    end
    SES->>DB: touch last_seen_at at most once per minute
    SES->>CS: actor and session resolved
    alt unsafe method and header differs from cookie or bad Origin
        CS-->>B: 403 csrf_failed
    end
    CS->>PERM: continue
    PERM->>PERM: check permission code in actor roles and MFA for admin routes
    alt not permitted
        PERM->>DB: insert security_events permission_denied
        PERM-->>B: 403 forbidden
    end
    PERM->>H: invoke handler
    H->>DB: BEGIN
    H->>DB: resource checks, row locks, business writes
    H->>DB: insert audit_logs with actor, action, before and after diff, ip, request_id
    H->>DB: COMMIT
    H->>R: after commit enqueue tasks and PUBLISH events
    H-->>LOG: response
    LOG->>LOG: log status, duration_ms, user_id, no secrets
    LOG-->>B: JSON response with X-Request-ID header
```

Rules:

- Public endpoints (`/public/*`, `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/csrf`, `/healthz`, `/readyz`) skip the session dependency but not rate limiting; unsafe ones still require the CSRF double-submit token (obtained from `GET /auth/csrf`).
- Unhandled exceptions → 500 `internal_error` with `request_id`, transaction rolled back, Sentry event (PII scrubbed).
- Request timeouts: Caddy upstream 60 s for API JSON routes; DB `statement_timeout` 15 s for request sessions, 10 min for worker sessions.

## 3. Upload lifecycle

States: `upload_sessions.status` `initiated → uploading → completed | aborted | expired`; `dataset_files.processing_status` `pending_upload → uploaded → processing → ready | failed | quarantined`; `scan_status` `pending | clean | infected | error | skipped_container`.

### 3.1 Init, parts, resume, complete

```mermaid
sequenceDiagram
    autonumber
    actor U as Contributor browser
    participant A as datahub_api
    participant DB as Postgres
    participant S3 as Object storage
    participant R as Redis
    U->>A: POST /datasets/ID/uploads with filename, size, relative_path
    A->>DB: check A-09 onboarding, dataset owner, status draft or changes_requested
    A->>DB: check max_file_bytes, max_dataset_bytes, user_pending_quota_bytes, 2000 files
    A->>S3: CreateMultipartUpload on internal endpoint, server-generated key
    S3-->>A: s3_upload_id
    A->>DB: insert dataset_files pending_upload and upload_sessions initiated with expires_at now plus 24h
    A-->>U: upload_id, part_size 16 MiB, part_count, expires_at
    loop batches of part numbers
        U->>A: POST /uploads/ID/part-urls with part_numbers
        A->>DB: session owner check, status initiated or uploading, set uploading
        A->>A: presign UploadPart with public endpoint client, 15 min
        A-->>U: presigned PUT URLs
        par up to 4 parts in parallel
            U->>S3: PUT part bytes
            S3-->>U: 200 with ETag
        end
    end
    Note over U,S3: Network failure or tab reload interrupts the transfer
    U->>A: GET /uploads/ID
    A->>S3: ListParts
    S3-->>A: uploaded part numbers, sizes, ETags
    A-->>U: status and uploaded parts
    U->>A: POST /uploads/ID/part-urls for missing parts only
    U->>S3: PUT missing parts
    U->>A: POST /uploads/ID/complete with part_number and etag list
    A->>DB: SELECT upload_sessions FOR UPDATE, guard status uploading
    A->>S3: ListParts and compare ETags and count
    A->>S3: CompleteMultipartUpload
    A->>S3: HeadObject to verify size equals declared size
    alt size mismatch or ETag mismatch
        A->>S3: AbortMultipartUpload or DeleteObject
        A->>DB: session aborted, file failed with size_mismatch
        A-->>U: 422 upload_invalid
    else ok
        A->>DB: session completed, file uploaded, audit
        A->>DB: COMMIT
        A->>R: enqueue processing.process_file on processing queue
        A-->>U: 200 file uploaded
    end
```

`DELETE /uploads/{id}` aborts the multipart upload and marks the session `aborted` and the file row deleted. `uploads.expire_sessions` (beat 15 min) finds `initiated|uploading` sessions past `expires_at`, calls `AbortMultipartUpload`, sets `expired` (status guard makes reruns harmless).

### 3.2 Processing and archive expansion

```mermaid
sequenceDiagram
    autonumber
    participant Q as Redis processing queue
    participant W as datahub_worker
    participant DB as Postgres
    participant S3 as Object storage
    participant CL as datahub_clamav
    participant R as Redis pub/sub
    Q->>W: processing.process_file file_id
    W->>DB: UPDATE dataset_files SET processing where id and status uploaded
    alt zero rows updated
        W->>W: already processing or done, ack and exit
    end
    W->>S3: GetObject range for first 8 KiB
    W->>W: libmagic sniff, validate MIME family vs extension, disallowed types, macro Office
    alt mismatch or disallowed
        W->>DB: status failed with type_mismatch or disallowed_type
    else zip container
        W->>S3: GetObject stream in 8 MiB chunks
        W->>W: sha256 incremental
        W->>DB: sha256 stored, scan skipped_container, status ready, never payable
        W->>Q: enqueue processing.expand_archive
    else document, image or data file
        W->>S3: GetObject stream in 8 MiB chunks
        W->>W: sha256 incremental
        W->>CL: INSTREAM same chunks, whole object, size at most 4000000000 bytes
        CL-->>W: OK or FOUND or error
        alt FOUND
            W->>S3: copy to quarantine prefix and delete original
            W->>DB: scan infected, status quarantined, security_events
        else clamd error or timeout
            W->>DB: scan error, keep processing, attempts plus one
            W->>W: raise Retry with backoff, after 3 attempts status failed scan_error
        else clean
            W->>W: render pages with pypdfium2 or Pillow, extract text, limits 500 pages, 4096 px
            W->>S3: PUT previews and text
            W->>DB: scan clean, insert file_previews, page_count, metadata, status ready
            W->>Q: enqueue processing.detect_duplicates
        end
    end
    W->>DB: COMMIT and update background_job_records
    W->>DB: when all files in dataset terminal insert notification and email_outbox dataset processing finished
    W->>R: PUBLISH notification.created
```

Archive expansion (`processing.expand_archive`): reads the central directory first and rejects if members > 10,000, Σ uncompressed > 20 GB, any member ratio > 100:1, absolute paths, `..`, symlinks or device entries; a member whose uncompressed size exceeds `max_file_bytes` (4,000,000,000 B, AM-01) is not extracted and is recorded `failed: archive_limit_exceeded`. Each accepted member is streamed (decompressed with a byte counter that aborts at the declared size + 1) into `datasets/{dataset_id}/files/{file_id}/members/{member_file_id}` and inserted as a `dataset_files` row with `parent_file_id` and `member_path` (unique pair → rerun-safe), status `uploaded`, then `processing.process_file` is enqueued for it. Nested ZIP members are inserted as `failed: nested_archive`. The container itself is hashed but not scanned: it ends `ready` with `scan_status=skipped_container` and is never payable; every member is scanned whole on its own (AM-01 — there is no windowed scanning).

`processing.detect_duplicates`: exact = same `sha256` as any file in another dataset whose review decision was `accepted` (or in the same dataset) → `dataset_duplicates(kind=exact)`; near = same normalised-text SimHash within distance 3 or same perceptual image hash → `kind=near` for reviewer attention. Upsert on `(file_id, matched_file_id, kind)`.

Submit: `POST /datasets/{id}/submit` requires all files terminal (`ready|failed|quarantined`) and ≥ 1 `ready`; sets `submitted`, creates a `dataset_versions` row, notifies the contributor ("dataset received").

## 4. Dataset review lifecycle

`datasets.status`: `submitted → in_review → approved | partially_approved | rejected | changes_requested`; `dataset_reviews.status`: `in_progress → finalized | released`.

```mermaid
sequenceDiagram
    autonumber
    actor RV as Reviewer
    participant A as datahub_api
    participant DB as Postgres
    participant F as finance service
    participant R as Redis
    RV->>A: GET /reviews/queue
    A->>DB: submitted datasets excluding own, oldest first
    RV->>A: POST /datasets/ID/claim-review
    A->>DB: SELECT datasets FOR UPDATE, guard status submitted, owner not reviewer
    A->>DB: insert dataset_reviews in_progress, dataset in_review, audit
    A-->>RV: review id
    loop each file
        RV->>A: GET /files/ID and preview pages
        RV->>A: PUT /reviews/ID/files/FILE with decision, reason_code, comment, labeled_upgrade
        A->>DB: upsert dataset_file_reviews unique review_id and file_id
    end
    RV->>A: PATCH /reviews/ID checklist, quality scores, data_class
    RV->>A: GET /reviews/ID/summary
    A->>DB: accepted and rejected bytes, duplicates, computed payable estimate
    A-->>RV: summary with final payable amount
    RV->>A: POST /reviews/ID/finalize with decision, feedback, Idempotency-Key
    A->>DB: BEGIN and SELECT dataset_reviews FOR UPDATE
    alt already finalized
        A-->>RV: 200 stored result, no new writes
    else in_progress and reviewer is assignee
        A->>DB: validate every ready file has a decision for approve or partial
        A->>F: credit_dataset_earning review_id inside same transaction
        F-->>A: earning total micros
        A->>DB: review finalized with decision, dataset status mapped, audit
        A->>DB: insert notifications and email_outbox for contributor
        A->>DB: COMMIT
        A->>R: PUBLISH notification.created and enqueue send_email
        A-->>RV: 200 finalized with payable amount
    end
```

Decision → dataset status mapping: `approve` → `approved` (all ready files accepted); `partial` → `partially_approved` (≥ 1 accepted, ≥ 1 rejected); `reject` → `rejected` (no earnings); `request_changes` → `changes_requested` (no earnings; contributor edits and resubmits, which creates a new `dataset_versions` row and returns to `submitted`). `POST /reviews/{id}/release` sets the review `released` and the dataset back to `submitted`. Takedown (`taken_down`) is an admin action independent of review.

## 5. Earnings lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant RS as review service
    participant FS as finance service
    participant DB as Postgres
    RS->>FS: credit_dataset_earning review_id, actor
    FS->>DB: SELECT pricing_rules effective at now for data_class
    FS->>DB: SELECT accepted files with processing ready, scan clean, not container
    FS->>DB: pg_advisory_xact_lock hashtext content_sha256 for each distinct hash in sorted order
    loop each accepted file
        FS->>DB: check dataset_duplicates exact against previously accepted files
        FS->>DB: recheck earning_records for same content_sha256 already paid, under the lock
        alt never paid
            FS->>FS: earning equals floor of accepted_bytes times rate over 1e9
        else paid at raw, dataset labeled, labeled_upgrade ticked
            FS->>FS: earning equals labeled rate minus rate previously paid, never negative
        else already paid or exact duplicate
            FS->>FS: earning 0 with reason
        end
        FS->>DB: INSERT earning_records with content_sha256 and pricing_tier, unique source_type, source_id, file_id and unique content_sha256, pricing_tier where amount above 0
    end
    alt total greater than 0
        FS->>DB: INSERT ledger_journals kind dataset_earning, key dataset_review REVIEW_ID earning, ON CONFLICT DO NOTHING
        alt conflict
            FS-->>RS: existing journal, no new lines
        else inserted
            FS->>DB: SELECT wallets FOR UPDATE in ascending id order, user wallet and system_dataset_purchases
            FS->>DB: INSERT wallet_transactions user available or pending plus X, system main minus X
            FS->>DB: UPDATE cached balances, CHECK non-negative
        end
    end
    FS-->>RS: total micros
    Note over DB: deferred trigger at COMMIT verifies sum of lines per journal equals 0
```

- Bucket: `available` when `earning_hold_days = 0` (A-07 default), else `pending` with `earning_records.hold_until = finalized_at + earning_hold_days`. `finance.release_pending` (hourly) posts one `earning_release` journal per matured earning record (user.pending −X, user.available +X) keyed `earning_release:{earning_record_id}` (baseline AM-02).
- Annotation rewards follow the same pattern — including the hold rule (`pending` + `hold_until` when `earning_hold_days > 0`, AM-02) — with kind `annotation_reward`, key `annotation_review:{review_id}:reward`, system wallet `system_annotation_labor` (§7).
- Adjustments (`POST /admin/adjustments`, `finance.adjust`, super_admin) post `adjustment_credit|adjustment_debit` keyed `adjustment:{adjustment_id}`; debits cannot drive `available` negative.
- All amounts are Python `int` micro-USD; display rounds down to cents.

## 6. Payout lifecycle

`payout_requests.status`: `requested → approved → paid`; `requested → rejected | cancelled`; `approved → cancelled | failed`; `paid → reversed`.

```mermaid
sequenceDiagram
    autonumber
    actor C as Contributor
    actor A1 as Admin 1
    actor A2 as Admin 2
    participant API as datahub_api
    participant DB as Postgres
    C->>API: POST /payouts amount, payout_method_id, Idempotency-Key
    API->>DB: SELECT payout_requests by user and client_idempotency_key
    alt existing request with same key
        API-->>C: 200 existing payout
    end
    API->>DB: SELECT wallets FOR UPDATE for user wallet
    API->>API: verification approved, account active, multiple of 10000, min and max, amount within available
    API->>DB: INSERT payout_requests requested, partial unique index one open payout
    API->>DB: journal payout_reserve key payout ID reserve, available minus X, reserved plus X
    API->>DB: notification and outbox for admins and contributor, audit, COMMIT
    API-->>C: 201 requested
    A1->>API: POST /admin/payouts/ID/approve
    API->>DB: SELECT payout_requests FOR UPDATE, guard requested, approver not recipient
    API->>DB: INSERT payout_approvals unique payout_id and approver_id
    alt amount at or above dual approval threshold and approvals_count is 1
        API-->>A1: 200 still requested, awaiting second approval
        A2->>API: POST /admin/payouts/ID/approve
        API->>DB: second distinct approval, status approved
    else below threshold
        API->>DB: status approved
    end
    Note over A1,A2: Admin transfers money outside DataHub
    A1->>API: POST /admin/payouts/ID/proof multipart file
    API->>DB: store proof key, scan queued
    A1->>API: POST /admin/payouts/ID/mark-paid payment_reference, paid_at
    API->>DB: SELECT payout_requests FOR UPDATE, guard approved, recorder not recipient
    API->>DB: SELECT wallets FOR UPDATE for user wallet
    API->>DB: INSERT payout_records unique payout_id, reference unique per method
    API->>DB: journal payout_settle key payout ID settle, reserved minus X, paid plus X
    API->>DB: status paid, notification and outbox payment recorded, audit, COMMIT
    API-->>A1: 200 paid
```

Alternative paths (each in one transaction with wallet lock and status guard):

| Action | From status | Journal | Key |
|---|---|---|---|
| Reject (admin) | `requested` | `payout_release` reserved −X, available +X | `payout:{payout_id}:release` |
| Cancel (contributor) | `requested` | `payout_release` | `payout:{payout_id}:release` |
| Cancel (admin) | `approved` | `payout_release` | `payout:{payout_id}:release` |
| Mark failed | `approved` | `payout_release` | `payout:{payout_id}:release` |
| Reverse (super_admin) | `paid` | `payout_reversal` paid −X, available +X | `payout:{payout_id}:reversal` |

## 7. Annotation lifecycle

`annotation_tasks.status`: `unassigned → assigned → in_progress → submitted → in_review → approved | changes_requested → in_progress`; reassign `assigned|in_progress → unassigned`; close project → `cancelled`.

```mermaid
sequenceDiagram
    autonumber
    actor AD as Admin
    actor AN as Annotator
    actor RV as Reviewer
    participant API as datahub_api
    participant DB as Postgres
    AD->>API: POST /annotation/projects/ID/generate-tasks
    API->>DB: tasks per accepted annotatable file or page, status unassigned, idempotent on project, file, page
    AD->>API: POST /annotation/tasks/ID/assign annotator_id
    API->>DB: annotator role and verification approved, partial unique one active assignment
    API->>DB: task assigned, notification annotation assigned
    AN->>API: POST /annotation/tasks/ID/start
    API->>DB: guard assigned and assignee, status in_progress, create annotations version 0
    AN->>API: GET /annotation/tasks/ID returns data, version and preview pages
    loop autosave after 5 s idle or on blur
        AN->>API: PUT /annotation/tasks/ID/draft with If-Match version N
        API->>DB: UPDATE annotations SET data, version N plus 1 WHERE task_id and version N
        alt one row updated
            API->>DB: insert annotation_versions when content hash changed, compact drafts to last 50
            API-->>AN: 200 with ETag version N plus 1
        else zero rows
            API-->>AN: 409 version_conflict with server copy and version
            AN->>AN: show diff, user chooses keep server or overwrite with new If-Match
        end
    end
    AN->>API: POST /annotation/tasks/ID/submit with If-Match
    API->>DB: Pydantic validation of data against project schema, status submitted, version marked submitted
    RV->>API: POST /annotation/tasks/ID/claim-review
    API->>DB: guard submitted, reviewer not annotator, status in_review
    RV->>API: POST /annotation/tasks/ID/review decision, score, comments
    API->>DB: BEGIN, SELECT annotation_tasks FOR UPDATE, guard in_review
    API->>DB: insert annotation_reviews and annotation_feedback
    alt approve
        API->>DB: status approved, insert annotation_rewards unique annotation_review_id
        API->>DB: wallets FOR UPDATE, journal annotation_reward key annotation_review REVIEW_ID reward
    else request_changes
        API->>DB: status changes_requested, annotator may restart to in_progress
    end
    API->>DB: notification and outbox, audit, COMMIT
```

Reward = `reward_per_task_micros` + `reward_per_page_micros × pages` (A-14). Only the active assignee may write drafts; an unassigned annotator's open editor receives 403 on the next save.

## 8. Notification lifecycle (transactional email outbox)

```mermaid
sequenceDiagram
    autonumber
    participant S as Domain service
    participant DB as Postgres
    participant R as Redis
    participant H as WS hub in datahub_api
    participant B as Browser
    participant W as datahub_worker email queue
    participant M as SMTP provider
    S->>DB: business change in transaction
    S->>DB: INSERT notifications for recipient
    S->>DB: INSERT email_outbox pending if preference allows and event is email-worthy
    S->>DB: COMMIT
    S->>R: PUBLISH notification.created on user channel
    R->>H: deliver to subscribed connections
    H->>B: WS event notification.created
    B->>B: invalidate unread-count and notification list
    S->>R: enqueue messaging.send_email outbox_id
    R->>W: deliver task
    W->>DB: SELECT email_outbox FOR UPDATE SKIP LOCKED where id and status pending
    alt not pending
        W->>W: already sent or claimed, ack
    else pending
        W->>W: render template, plain text and HTML
        W->>M: SMTP send with Message-ID equal to outbox id
        alt accepted
            W->>DB: status sent, sent_at
        else transient failure
            W->>DB: attempts plus one, last_error
            W->>W: retry with exponential backoff up to 8 attempts
        else permanent failure or attempts exhausted
            W->>DB: status failed, alert metric
        end
    end
```

Crash window between COMMIT and enqueue: the outbox row stays `pending`. Recovery is a periodic sweep `admin.requeue_stalled` (beat every 5 min) that re-enqueues `email_outbox` rows `pending` for > 2 min, `dataset_files` stuck in `uploaded` for > 5 min, and `export_jobs` `queued` for > 5 min. Because every target task is guarded by status, a duplicate enqueue is harmless. The sweep was adopted as baseline amendment AM-10 (`DECISION_LOG.md` D-023). Duplicate SMTP delivery is possible only if the worker dies after SMTP accept and before the status update; the stable `Message-ID` lets receiving providers de-duplicate.

## 9. Error recovery

| Failure | Detection | Recovery | Data safety |
|---|---|---|---|
| Browser loses network mid-upload | Part PUT fails | Retry part 5× with backoff; on reload resume via `GET /uploads/{id}` (ListParts) | Parts already in S3 kept until session expiry (24 h) |
| Presigned URL expired (15 min) | 403 from S3 | Client requests new part URLs | None lost |
| Upload never completed | `uploads.expire_sessions` | AbortMultipartUpload, session `expired`; lifecycle rule backstop | No orphan parts after 1 day |
| Worker killed mid-task | `acks_late` + `reject_on_worker_lost` | Task redelivered; status guard / upserts make rerun safe | Idempotent |
| File stuck in `processing` | `background_job_records` heartbeat older than hard limit | Admin `POST /admin/files/{id}/rescan` resets to `uploaded` and re-enqueues | Previews overwritten at same keys |
| ClamAV unavailable | Connection error / `/readyz` of worker | Retry ×3, then `failed: scan_error`; admin rescan later | Never payable (fail-closed) |
| SMTP failure | Exception / non-2xx | Outbox retry up to 8 attempts, then `failed` + alert; admin can requeue | Notification still in-app |
| Redis restart | Connection errors | Celery reconnects; pub/sub clients reconnect; queued but unstarted tasks may be lost → `admin.requeue_stalled` re-enqueues from DB state | DB is source of truth |
| Postgres unavailable | `/readyz` fails | Caddy returns 503 from API; workers retry; restore from backup if corrupt | RPO 24 h (15 min with WAL) |
| Finalize/payout request retried by client | Same `Idempotency-Key` or finalized status | Return stored result | Unique keys prevent duplicates |
| Ledger cache drift | `finance.reconcile` nightly | Alert; super_admin investigates; cache recomputed from lines (lines are authoritative) | Lines immutable |
| Payment bounced after `paid` | Admin report | `POST /admin/payouts/{id}/reverse` (`payout_reversal`) | Full trail retained |
| Export fails | Task exception | Status `failed` with error; admin re-requests; rebuild overwrites same key | No partial download exposed |

## 10. Scalability

- **Stateless tiers:** `datahub_web`, `datahub_api` and `datahub_worker` hold no local state (sessions in Postgres, fan-out in Redis, files in S3), so replicas can be added behind Caddy or on additional VMs (SAD §9).
- **No bytes through the API:** uploads and downloads go browser ↔ S3; API CPU/bandwidth scale with request count, not data volume.
- **Queue isolation:** `processing`, `exports`, `email`, `default` can be consumed by separate worker pools so long exports cannot starve file processing or email.
- **Streaming everywhere:** hashing, scanning, ZIP expansion and export building stream in 8 MiB chunks with bounded memory (< 512 MiB per task).
- **Database:** every list endpoint is paginated (max 100) on indexed columns; hot paths (`user_sessions.token_hash`, `dataset_files.sha256`, `ledger_journals.idempotency_key`, status + created_at composite indexes) are indexed; analytics move to a read replica at step S5.
- **WebSocket:** each API process holds ≤ 2,000 sockets; per-user Redis channels keep fan-out O(recipients).

## 11. Concurrency control

| Hazard | Control |
|---|---|
| Two withdrawals spending the same balance | `SELECT … FROM wallets WHERE id = :id FOR UPDATE` before balance check; partial unique index one open payout per user; CHECK `available ≥ 0` on cached balance |
| Duplicate earnings on retried finalize | Review row `FOR UPDATE` + status guard; `earning_records (source_type, source_id, file_id)` unique; `ledger_journals.idempotency_key` unique |
| Same content paid twice by concurrent finalizations of different datasets | `pg_advisory_xact_lock(hashtext(content_sha256))` per file in sorted order before the eligibility recheck; partial unique index `earning_records (content_sha256, pricing_tier) WHERE amount_micros > 0` (AM-03) |
| Pending earnings released twice | One `earning_release` journal per earning record, key `earning_release:{earning_record_id}` (AM-02) + `released_at IS NULL` guard |
| Deadlock between wallets | Lock all wallets touched by a journal in ascending `wallets.id` order |
| Two reviewers claiming the same dataset | `datasets` row `FOR UPDATE` + guard `status = 'submitted'`; per-reviewer cap `review_max_active_claims` (AM-09) |
| Double approval by same admin | `payout_approvals (payout_id, approver_id)` unique |
| Two `mark-paid` calls | `payout_records.payout_id` unique + status guard `approved` |
| Concurrent annotation saves | Optimistic locking: `If-Match` version, conditional UPDATE, 409 with server copy (ADR-0011) |
| Two active assignees for one task | Partial unique index one active `annotation_assignments` row per task |
| Double processing of a file | Conditional UPDATE `uploaded → processing`; zero rows → exit |
| Duplicate archive members on rerun | Unique `(parent_file_id, member_path)` |
| Outbox email sent twice by two workers | `FOR UPDATE SKIP LOCKED` + `status = 'pending'` guard |
| Overlapping pricing rules | Exclusion constraint on `pricing_rules` per `data_class` |
| Concurrent settings edits | `system_settings.version` optimistic check |

## 12. Reliability patterns

1. **Retries with exponential backoff and jitter** — Celery `autoretry_for` transient errors (S3 5xx, clamd connection, SMTP 4xx, DB serialization/deadlock), bounded attempts per task (HLD §5).
2. **Idempotent tasks** — every task re-reads state and acts only if the guard holds; side-effects use deterministic keys (preview keys, member keys, export keys, journal keys).
3. **`acks_late` + `reject_on_worker_lost` + prefetch 1** — a task is acknowledged only after success, so a crashed worker's task is redelivered.
4. **Status guards** — conditional UPDATEs (`WHERE status = :expected`) for every state transition in baseline §9; affected-row count checked.
5. **Transactional outbox** — durable intent written in the business transaction (ADR-0012); delivery retried independently.
6. **Reconciliation** — `finance.reconcile` nightly recomputes Σ lines per (wallet, bucket), compares with cached balances, checks every journal sums to 0 and every `earning_records` row has a journal; mismatches → alert + `GET /admin/finance/reconciliation` report. Read-only.
7. **Timeouts everywhere** — HTTP upstream, DB statement timeouts, S3 client connect/read timeouts (5 s / 60 s), clamd socket timeout 120 s, SMTP 30 s, Celery soft/hard limits.
8. **Health checks** — `/healthz` (process alive), `/readyz` (DB, Redis, S3 HEAD bucket); compose healthchecks gate dependent services; Docker `restart: unless-stopped`.
9. **Fail-closed security dependencies** — scanning errors never produce `clean`; missing CSRF or session store errors deny the request.
10. **Observability for recovery** — `background_job_records`, Prometheus metrics (queue depth, task failures, outbox pending age, upload failures, reconcile mismatches) and alerts as specified in the monitoring runbooks.
