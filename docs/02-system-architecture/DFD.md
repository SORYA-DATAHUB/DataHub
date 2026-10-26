# DataHub — Data Flow Diagrams (DFD)

## Document control

| Field | Value |
|---|---|
| Document ID | DH-ARCH-DFD |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | CTO role |
| Canonical source | [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) |
| Related | [SAD](SAD.md) §7 trust zones · [HLD](HLD.md) · [SDD](SDD.md) · `../06-testing-security/THREAT_MODEL.md` · `../05-data-annotation/DATA_PRIVACY_OWNERSHIP.md` · `../05-data-annotation/DATA_RETENTION_DELETION.md` |

## Header

- **Purpose.** Show how data moves through DataHub — browser, backend API, file storage, processing workers, database, annotation editor, review engine, wallet ledger and export service — and where it crosses trust boundaries, with a classification for every store and flow. This is the input to the threat model (STRIDE per element) and to privacy/retention policies.
- **Scope.** All v1 data flows at level 0 (context) and level 1 (major processes), plus detail views for upload/processing, review→ledger, annotation and export. Excludes CI/CD and backup pipelines (covered in DOCKER_CICD.md and BACKUP_DISASTER_RECOVERY.md).
- **Assumptions.** A-02 (verbatim Khmer transcription), A-04 (micro-USD), A-05 (payout method details admin-visible JSON), A-08 (verification data), A-10 (fail-closed scanning), A-13 (UTC), A-15 (retention).
- **Decisions.** ADR-0005, ADR-0006 (browser ↔ storage direct flows), ADR-0007 (only server-rendered derivatives reach the viewer), ADR-0008 (session tokens never stored in clear), ADR-0009 (ledger), ADR-0012 (outbox), ADR-0015 (realtime).
- **Dependencies.** [SAD.md](SAD.md) trust zones Z0–Z5; baseline §§6, 8, 10, 12, 13.
- **Acceptance criteria.**
  1. Level 0 and level 1 DFDs include every element listed in MASTER Part 5 item 13.
  2. Every trust boundary is drawn and listed with its controls.
  3. Every data store has a classification (public/internal/confidential/restricted).
  4. Every flow crossing a boundary is listed with classification and protection.
  5. Mermaid diagrams render.

---

## 1. Notation

| DFD element | Mermaid shape | Example |
|---|---|---|
| External entity | Rectangle | `Contributor` |
| Process | Rounded rectangle | `P2 Upload service` |
| Data store | Cylinder | `D1 Postgres` |
| Trust boundary | Subgraph | `TB2 Application zone` |

Process numbers `P1…P9` and store numbers `D1…D4` are stable identifiers reused by THREAT_MODEL.md.

## 2. Data classification

| Class | Definition | Handling | Examples in DataHub |
|---|---|---|---|
| **Public** | Intended for anyone | No restriction; cacheable | Pricing (`GET /public/pricing`), supported formats, marketing pages, legal texts |
| **Internal** | Operational data without personal or content value | Authenticated staff/services only; not in client bundles | Aggregated analytics, system settings, job records, structured logs without PII, metrics |
| **Confidential** | Personal data or customer content; disclosure harms users or the Platform | Authenticated + authorised per resource; TLS in transit; provider encryption at rest; presigned URLs ≤ 15 min; excluded from logs | Uploaded documents and archive members, previews and extracted text, dataset metadata, annotations, reviews and feedback, messages and attachments, user profiles (name, email, phone, country), notifications, earning records, wallet balances, exports, audit logs |
| **Restricted** | Secrets or high-risk personal/financial data; compromise enables fraud or account takeover | Need-to-know (specific permission + MFA for admins); never logged; hashed or encrypted where applicable; access audited | Password hashes (Argon2id), session token hashes, CSRF secrets, TOTP secrets and recovery codes, verification ID documents and date of birth, payout method details (bank account, wallet IDs), payment references and proofs, ledger lines, S3/SMTP/DB credentials, `SECRET_KEY` |

Rules: data inherits the highest class of its inputs (e.g. an export containing documents is Confidential; an admin report containing payout methods is Restricted). Restricted fields are excluded from Sentry events, structured logs and error `details`.

## 3. Level 0 — Context DFD

```mermaid
flowchart LR
    contributor["Contributor"]
    annotator["Annotator"]
    reviewer["Reviewer"]
    admin["Admin and Super admin"]
    smtp["SMTP provider"]
    datahub(["P0 DataHub system"])
    contributor -->|"registration, profile, verification docs, payout methods, dataset files and metadata, withdrawal requests, messages"| datahub
    datahub -->|"previews, review feedback, wallet balances, payout status, notifications, messages"| contributor
    annotator -->|"annotation drafts and submissions"| datahub
    datahub -->|"tasks, page images, extracted text, reviewer feedback, rewards"| annotator
    reviewer -->|"file decisions, quality scores, annotation reviews"| datahub
    datahub -->|"review queue, documents, duplicate warnings, payable summary"| reviewer
    admin -->|"user decisions, payout approvals, payment references and proofs, adjustments, export requests, settings"| datahub
    datahub -->|"user and finance data, audit logs, analytics, export packages"| admin
    datahub -->|"transactional email"| smtp
    smtp -->|"email delivery"| contributor
```

## 4. Level 1 — System DFD with trust boundaries

```mermaid
flowchart TB
    subgraph TB0 ["TB0 Internet - untrusted"]
        user["Users: contributor, annotator, reviewer, admin"]
        subgraph browser ["Browser"]
            ui(["P1 Web UI and Annotation editor"])
        end
    end
    subgraph TB1 ["TB1 Edge"]
        edge(["Caddy TLS termination"])
    end
    subgraph TB2 ["TB2 Application zone"]
        apiauth(["P2 API gateway: session, CSRF, RBAC"])
        upl(["P3 Upload service"])
        rev(["P5 Review engine"])
        led(["P6 Wallet ledger"])
        ann(["P7 Annotation service"])
        msgp(["P8 Messaging and notifications"])
    end
    subgraph TB3 ["TB3 Processing zone - hostile content"]
        proc(["P4 Processing workers"])
        expo(["P9 Export service"])
        clam(["ClamAV"])
        mailer(["Email sender"])
    end
    subgraph TB4 ["TB4 Data zone"]
        db[("D1 Postgres")]
        rds[("D2 Redis")]
    end
    subgraph TB5 ["TB5 External managed services"]
        s3[("D3 Object storage datahub-private")]
        smtp["SMTP provider"]
    end
    user --> ui
    ui -->|"HTTPS JSON, cookies"| edge
    edge --> apiauth
    apiauth --> upl
    apiauth --> rev
    apiauth --> led
    apiauth --> ann
    apiauth --> msgp
    ui -->|"presigned PUT parts: original bytes"| s3
    s3 -->|"presigned GET: previews, downloads, exports"| ui
    upl -->|"multipart control, ListParts"| s3
    upl -->|"upload_sessions, dataset_files"| db
    upl -->|"enqueue process_file"| rds
    rds -->|"tasks"| proc
    proc -->|"stream originals"| s3
    proc -->|"bytes"| clam
    proc -->|"previews, text, members"| s3
    proc -->|"hash, MIME, scan status, previews, duplicates"| db
    rev -->|"file decisions, finalize"| db
    rev -->|"credit earnings"| led
    led -->|"journals, lines, balances, payouts"| db
    ann -->|"drafts, versions, reviews"| db
    ann -->|"credit rewards"| led
    msgp -->|"messages, notifications, outbox"| db
    msgp -->|"PUBLISH events"| rds
    rds -->|"WS events"| apiauth
    apiauth -->|"WebSocket push"| ui
    rds -->|"send_email"| mailer
    mailer -->|"outbox rows"| db
    mailer -->|"SMTP TLS"| smtp
    apiauth -->|"export request"| rds
    rds -->|"build_export"| expo
    expo -->|"read approved files and annotations"| db
    expo -->|"read files, write ZIP"| s3
```

## 5. Level 1 detail views

### 5.1 Upload and processing (P1, P3, P4)

```mermaid
flowchart LR
    ui(["P1 Browser upload engine"])
    upl(["P3.1 Authorise and validate init"])
    sign(["P3.2 Presign part URLs"])
    comp(["P3.3 Complete and verify"])
    proc(["P4.1 Sniff, hash, scan"])
    prev(["P4.2 Render previews and extract text"])
    zipx(["P4.3 Expand archive with limits"])
    dup(["P4.4 Detect duplicates"])
    s3[("D3 Object storage")]
    db[("D1 Postgres")]
    q[("D2 Redis queue")]
    ui -->|"filename, size, relative path - Confidential"| upl
    upl -->|"quota and eligibility read"| db
    upl -->|"dataset_files pending_upload, upload_sessions initiated"| db
    ui -->|"part numbers"| sign
    sign -->|"URLs valid 15 min"| ui
    ui -->|"original bytes over TLS - Confidential"| s3
    ui -->|"part ETags"| comp
    comp -->|"ListParts, Complete, HEAD"| s3
    comp -->|"file uploaded"| db
    comp -->|"process_file"| q
    q --> proc
    s3 -->|"stream"| proc
    proc -->|"sha256, mime, scan_status"| db
    proc --> prev
    proc --> zipx
    prev -->|"page images, text"| s3
    prev -->|"file_previews"| db
    zipx -->|"member objects"| s3
    zipx -->|"member file rows"| db
    proc --> dup
    dup -->|"dataset_duplicates"| db
```

### 5.2 Review engine to wallet ledger (P5, P6)

```mermaid
flowchart LR
    rv["Reviewer"]
    c["Contributor"]
    ad["Admin"]
    rev(["P5 Review engine"])
    calc(["P6.1 Earning calculator"])
    jr(["P6.2 Journal poster"])
    pay(["P6.3 Payout workflow"])
    rec(["P6.4 Reconciliation"])
    db[("D1 Postgres: dataset_reviews, earning_records, ledger_journals, wallet_transactions, wallets, payout_requests")]
    s3[("D3 payout proofs")]
    rv -->|"decisions, quality scores, data_class"| rev
    rev -->|"accepted files and bytes"| calc
    calc -->|"pricing_rules read"| db
    calc -->|"earning_records - Confidential"| db
    calc -->|"amount and idempotency key"| jr
    jr -->|"journal and balanced lines - Restricted"| db
    c -->|"withdrawal request, Idempotency-Key"| pay
    ad -->|"approve, reject, payment reference, proof"| pay
    pay -->|"reserve, release, settle, reversal"| jr
    pay -->|"proof file"| s3
    pay -->|"payout_requests, approvals, records"| db
    rec -->|"recompute sums nightly"| db
    rec -->|"mismatch alert"| ad
```

### 5.3 Annotation editor (P1, P7)

```mermaid
flowchart LR
    an["Annotator"]
    ed(["P1.2 Annotation editor in browser"])
    tsk(["P7.1 Task and assignment service"])
    drf(["P7.2 Draft store with If-Match"])
    arv(["P7.3 Annotation review"])
    jr(["P6.2 Journal poster"])
    db[("D1 annotations, annotation_versions, annotation_tasks, annotation_reviews")]
    s3[("D3 page images and text")]
    rv["Reviewer"]
    an -->|"keystrokes, labels, metadata"| ed
    ed -->|"GET task"| tsk
    tsk -->|"task, instructions, version"| ed
    s3 -->|"presigned page images"| ed
    ed -->|"PUT draft JSON verbatim Khmer - Confidential"| drf
    drf -->|"conditional update, version history"| db
    drf -->|"409 with server copy on conflict"| ed
    rv -->|"decision, score, comments"| arv
    arv -->|"read versions and diff"| db
    arv -->|"approve: reward"| jr
```

### 5.4 Export service (P9)

```mermaid
flowchart LR
    ad["Admin with dataset.export"]
    req(["P9.1 Export request API"])
    bld(["P9.2 Build export worker"])
    dl(["P9.3 Download URL issuer"])
    db[("D1 export_jobs, export_files, datasets, annotations, audit_logs")]
    s3[("D3 exports prefix")]
    q[("D2 exports queue")]
    ad -->|"filters: category, language, quality, raw or labeled, format, include annotations"| req
    req -->|"export_jobs queued, audit"| db
    req -->|"build_export"| q
    q --> bld
    bld -->|"select approved accepted files and approved annotations"| db
    s3 -->|"stream source files"| bld
    bld -->|"ZIP with manifest, metadata, NFC normalized copy of annotations"| s3
    bld -->|"export_files, status completed, expires 7 days"| db
    ad -->|"request download"| dl
    dl -->|"audit who and when"| db
    dl -->|"presigned GET 5 min"| ad
```

## 6. Trust boundaries

| Boundary | Between | Crossing flows | Controls |
|---|---|---|---|
| TB0 → TB1 | Browser and Caddy | All HTTP/WS traffic | TLS 1.2+, HSTS, request size limits, security headers (CSP, X-Content-Type-Options, Referrer-Policy, frame-ancestors none) |
| TB1 → TB2 | Caddy and web/API | Proxied requests | Internal network only; API trusts `X-Forwarded-For` only from Caddy; rate limiting; session + CSRF + RBAC + resource checks |
| TB0 → TB5 | Browser and object storage | Presigned PUT parts, presigned GET | Signature scoped to one key/part/method; 15 min (PUT) / 5 min (GET); server-generated keys; bucket private; CORS limited to app origin; `Content-Disposition: attachment` on downloads |
| TB2 → TB3 | API and workers | Task messages via Redis | Messages carry IDs only (no file content, no secrets); JSON serializer; workers re-read state from DB |
| TB3 internal | Worker and hostile file content | Streams from S3 | Magic-byte detection, size/ratio/depth limits, defusedxml, render limits, task time limits, `noexec` scratch, no execution of content, ClamAV fail-closed |
| TB2/TB3 → TB4 | Services and data stores | SQL, Redis commands | Least-privilege DB roles, Redis password, no published ports in prod |
| TB2/TB3 → TB5 | Services and managed services | S3 API, SMTP | TLS, bucket-scoped credentials, SMTP credentials in secrets, no PII to Sentry |

## 7. Flow inventory (boundary-crossing flows)

| ID | Flow | From → To | Class | Protection |
|---|---|---|---|---|
| F01 | Credentials at login | Browser → API | Restricted | TLS; Argon2id; never logged; rate-limited |
| F02 | Session cookie `dh_session` | Browser ↔ API | Restricted | HttpOnly, Secure, SameSite=Lax; DB stores SHA-256 only |
| F03 | TOTP code / recovery code | Browser → API | Restricted | TLS; single-use recovery codes hashed |
| F04 | Profile and verification data | Browser → API → D1/D3 | Restricted (ID docs, DOB) / Confidential | `user.verify` permission + admin MFA to view; audit on access |
| F05 | Payout method details | Browser → API → D1 | Restricted | Admin-visible only; masked in contributor UI after save; never sent to any external system automatically |
| F06 | Original file bytes | Browser → D3 | Confidential | Presigned PUT, TLS, private bucket |
| F07 | File stream to worker | D3 → P4 | Confidential, hostile | Internal endpoint; limits and fail-closed scan |
| F08 | Previews and text | D3 → Browser | Confidential | Authorised `GET /files/{id}/preview/{page}` → presigned 5 min |
| F09 | Review decisions and finalize | Browser → API → D1 | Confidential | `dataset.review`, assignee check, no self-review, Idempotency-Key |
| F10 | Ledger journal lines | P6 → D1 | Restricted | Append-only triggers, balanced journals, unique keys, reconcile |
| F11 | Withdrawal request | Browser → API → D1 | Restricted | `payout.request`, verified contributor, wallet lock, Idempotency-Key |
| F12 | Payment reference and proof | Admin browser → API → D1/D3 | Restricted | `payout.record_payment`, MFA, recorder ≠ recipient, proof scanned and private |
| F13 | Annotation drafts | Editor → API → D1 | Confidential | `annotation.work`, active assignee, If-Match |
| F14 | Messages and attachments | Browser → API → D1/D3 | Confidential | Participant check; attachments ≤ 10 MB scanned before visible |
| F15 | Realtime events | API → Browser (WS) | Confidential | Cookie auth + Origin check; per-user channels; payload minimal |
| F16 | Email content | Worker → SMTP → user | Confidential | TLS to provider; no document content or secrets in email; links to app only |
| F17 | Export package | D3 → Admin browser | Confidential | `dataset.export` + MFA; presigned 5 min; expires 7 days; audit of who/when/which datasets |
| F18 | Error events | Services → Sentry | Internal | PII scrubbing, no request bodies, no cookies |

## 8. Data stores

| Store | Contents | Class (highest) | Encryption at rest | Retention (A-15) |
|---|---|---|---|---|
| D1 Postgres | All entities, ledger, audit, outbox | Restricted | Encrypted volume (VM disk encryption / managed DB) | Financial and audit 7 years; security events 1 year; others per DATA_RETENTION_DELETION.md |
| D2 Redis | Task messages (IDs), rate-limit counters, pub/sub transient events | Internal | Not persisted beyond AOF (optional) | Minutes to hours |
| D3 Object storage `datahub-private` | Originals, members, previews, attachments, verification docs, payout proofs, exports | Restricted (ID docs, proofs) / Confidential | Provider SSE (R2/S3); versioning on | Rejected 90 days; drafts 30 days; abandoned uploads 24 h; exports 7 days |
| D4 Backups | `pg_dump` archives in separate bucket | Restricted | Provider SSE + client-side encryption of dumps | 30 daily + 12 monthly (per BACKUP_DISASTER_RECOVERY.md) |
