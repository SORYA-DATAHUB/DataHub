# DataHub — File Upload & Storage Specification

| Field | Value |
|---|---|
| **Purpose** | Define exactly how dataset files (and the smaller attachment types) travel from a contributor's browser into private object storage, how they are validated, scanned, hashed, de-duplicated, previewed, served and eventually deleted — with the limits, keys, failure handling and performance targets the implementation must meet. |
| **Scope** | Resumable multipart dataset uploads (`/datasets/{id}/uploads`, `/uploads/*`), the `processing` worker pipeline (sniffing, hashing, ClamAV, duplicates, archive expansion, previews, text extraction), preview/download URL issuance (`/files/*`), exports storage, message attachments, verification ID documents, payout proofs, bucket configuration (CORS, lifecycle, encryption, versioning) for SeaweedFS (dev) and Cloudflare R2 / AWS S3 (prod). Out of scope: review decisions (Data Quality & Review Specification), earnings math (Pricing & Payout Policy), backup schedules (Backup & DR Plan). |
| **Assumptions** | A-03 scale (≤ 50 concurrent uploads, single file ≤ 4 GB (4,000,000,000 B, baseline AM-01), dataset ≤ 50 GB, ≤ 20 TB year 1); A-10 ClamAV fail-closed; A-11 no LibreOffice; A-15 retention defaults; modern evergreen browsers (Chrome/Edge/Firefox/Safari, last 2 versions) with `fetch`, `XMLHttpRequest` upload progress, `File.slice`, `localStorage`. |
| **Decisions** | Browser uploads **directly to S3** with presigned UploadPart URLs; the API never proxies file bytes. Always S3 multipart (even 1-part files) with 16 MiB parts. Presigned PUT 15 min / GET 5 min, signed for the public S3 endpoint host. Server-generated object keys only. Magic-byte type detection is authoritative. Single streaming pass computes SHA-256, sniffs type and feeds clamd. Exact duplicates by SHA-256; near duplicates by 64-bit SimHash (text, Hamming ≤ 3) and 64-bit dHash (images/pages, Hamming ≤ 5). Previews are server-rendered WebP. Incomplete multipart uploads are aborted after 24 h. |
| **Dependencies** | `ENGINEERING_BASELINE.md` §3, §7, §8.3, §9, §13; `API_DOCUMENTATION.md` (Uploads, Files, Exports, Messaging sections); `AUTH_AUTHORIZATION.md` §12 (file visibility rules); `openapi.yaml` schemas `UploadSession`, `DatasetFile`, `PresignedUrl`; libmagic, pypdfium2, Pillow, python-docx, openpyxl, striprtf, defusedxml, boto3, clamd. |
| **Acceptance criteria** | (1) A 4 GB (4,000,000,000 B) file uploads over a connection interrupted 3 times and resumed after a page reload without re-sending completed parts (E2E). (2) A renamed executable (`.exe` → `.pdf`) ends `failed: type_mismatch`/`disallowed_type`. (3) EICAR test file ends `quarantined` and is never previewable/downloadable/payable. (4) Zip-slip, zip-bomb (ratio > 100:1), > 10,000 members, symlink and nested-zip fixtures are all neutralised as specified in §13. (5) Same bytes uploaded twice produce an `exact` duplicate flag; a re-scanned copy of a page produces a `near` flag. (6) No object key contains user-supplied text (static test over key builders). (7) Presigned URLs expire on time (PUT 15 min, GET 5 min) and downloads always arrive as attachments. (8) Abandoned uploads leave no storage after 24 h (lifecycle + job). (9) Throughput ≥ 2 GB/min per worker for hash+scan on the reference host. |

**Document control:** Version 1.1 · 2026-10-26 · Status: Baseline (v1.1: baseline §16 AM-01, AM-13 applied) · Owner: Backend lead · Changes via `DECISION_LOG.md`.

---

## Contents

1. Architecture overview
2. Limits and quotas
3. Allowed formats matrix
4. Resumable multipart upload protocol
5. Temporary upload authorization (presigned PUT)
6. Client behaviour (progress, retries, resume, cancellation)
7. Processing pipeline and file states
8. File validation (magic bytes, extension agreement, structure)
9. Malware scanning (ClamAV, fail-closed)
10. Content hashing
11. Duplicate detection (exact and near)
12. Preview generation and text extraction
13. Archive (ZIP) security
14. Secure object keys and bucket layout
15. Download and preview authorization
16. Encryption
17. Storage lifecycle and retention
18. Failure recovery
19. Large-file performance
20. Storage CORS and bucket configuration
21. Other uploads: message attachments, verification documents, payout proofs
22. Observability and audit
23. Test plan hooks

---

## 1. Architecture overview

```
Browser ──(1) POST /datasets/{id}/uploads ───────────────► API ──CreateMultipartUpload──► S3
Browser ◄─ upload_id, part_size, part_count ───────────── API
Browser ──(2) POST /uploads/{id}/part-urls ─────────────► API ──presign UploadPart (public host)
Browser ──(3) PUT part bytes (presigned, 16 MiB each) ──────────────────────────────────► S3
Browser ◄─ ETag (CORS ExposeHeaders) ─────────────────────────────────────────────────── S3
Browser ──(4) POST /uploads/{id}/complete {parts} ──────► API ──ListParts / Complete / Head─► S3
                                                          API ──enqueue processing.process_file──► Redis
Worker  ◄─ task ─ Redis;  Worker ──GetObject stream──► S3;  Worker ──INSTREAM──► clamd
Worker  ──PutObject previews/text, member objects──► S3;  Worker ──rows──► Postgres
Browser ──GET /files/{id}/preview/{n} ─► API ─302─► presigned GET (5 min) ─► S3
```

- Two boto3 clients: **internal** (`S3_ENDPOINT`, e.g. `http://datahub_s3:8333` in dev) for server-side operations, and **presign** (`S3_PUBLIC_ENDPOINT`, e.g. `http://localhost:9410` in dev, the storage public hostname in prod) used *only* to generate URLs. SigV4 signs the `Host` header, so a URL presigned for the internal hostname would fail in the browser.
- Bucket: single private bucket `datahub-private` (`S3_BUCKET`). Block-public-access on; no public ACLs; no bucket website hosting.
- The API container never stores file bytes on local disk. Workers stream; temporary files (only for formats whose libraries need a path, e.g. pypdfium2 rendering of large PDFs) go to a per-task `tmpfs`/scratch dir with `0700`, deleted in `finally`.

## 2. Limits and quotas

All values are `system_settings` keys (super_admin, `PUT /admin/settings/{key}`) with the baseline defaults below; the API reads them with a 30 s cache.

| Limit | Setting | Default | Enforced at | Error |
|---|---|---|---|---|
| Max single file (also every extracted ZIP member) | `max_file_bytes` | 4,000,000,000 B (4 GB decimal, baseline AM-01) — the setting validator refuses values above 4,000,000,000 because clamd cannot scan a single stream ≥ 4 GiB | init (declared size), complete (HeadObject size), archive expansion (member declared/actual size) | `413 upload.file_too_large`; member → `failed: archive_limit_exceeded` |
| Max dataset size | `max_dataset_bytes` | 50,000,000,000 B (50 GB) | init (Σ dataset files incl. pending sessions + new), complete | `413 upload.dataset_too_large` |
| Unreviewed storage per user | `user_pending_quota_bytes` | 200,000,000,000 B (200 GB) | init and complete | `413 upload.quota_exceeded` (`details.used_bytes`, `details.quota_bytes`) |
| Files per dataset (excluding archive members) | `max_files_per_dataset` | 2,000 | init | `409 dataset.file_limit_exceeded` |
| Part size | — (computed) | 16 MiB (16,777,216 B); raised to `ceil(size / 10,000)` rounded up to whole MiB if needed so parts ≤ 10,000 | init | — |
| Concurrent open upload sessions per user | `max_open_uploads_per_user` | 20 | init | `429 rate_limited` |
| Upload session lifetime | — | 24 h from init | part-urls / complete | `409 upload.expired` |
| Part URL validity | — | 15 min | S3 | `403` from S3 → client refreshes URLs |
| ZIP limits | baseline §7 | ≤ 10,000 members; ≤ 20 GB uncompressed total; per-member ratio ≤ 100:1; depth 1 | worker | file/member `failed` |
| Message attachment | — | 10 MB (10,000,000 B) | API (streamed count) | `413 message.attachment_too_large` |
| Verification ID document, payout proof | — | 10 MB | API | `413` / `415` |

**Quota accounting.** "Unreviewed storage" = Σ `size_bytes` of the user's files (and open upload sessions' declared sizes) in datasets with status `draft`, `submitted`, `in_review`, `changes_requested`. Bytes leave the quota when the dataset is finalized (approved/partially approved/rejected), withdrawn or deleted. Archive members are **not** double-counted: quota counts the uploaded container bytes; expansion is bounded by the ZIP limits. Quota checks run inside a transaction holding a per-user advisory lock (`pg_advisory_xact_lock(hash(user_id))`) so parallel inits cannot jointly exceed it. A declared `size_bytes` that differs from the completed object's real size fails completion (`upload.parts_mismatch`) and the session is aborted.

## 3. Allowed formats matrix

Canonical: baseline §7; published to clients by `GET /public/formats`.

| Ext | libmagic MIME (authoritative) | Allowed | Preview | Annotatable | Payable | Structural check |
|---|---|:-:|---|:-:|:-:|---|
| pdf | `application/pdf` | ✓ | page images (first 500 pages) | ✓ page-level | ✓ | pypdfium2 opens; page count; encrypted PDFs (user password) → `failed: encrypted` |
| docx | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | ✓ | extracted text | ✓ text | ✓ | ZIP container check (§13 limits), `[Content_Types].xml` main part = document (not `macroEnabled`), defusedxml parse |
| doc | `application/msword` | ✓ | none (download only) | ✗ | ✓ | OLE2 header; ClamAV `AlertOLE2Macros` → macros flagged to reviewer |
| odt | `application/vnd.oasis.opendocument.text` | ✓ | extracted text | ✓ text | ✓ | `mimetype` member equals type; defusedxml `content.xml` |
| rtf | `text/rtf` | ✓ | extracted text | ✓ text | ✓ | striprtf parse; objects (`\object`) stripped from preview |
| txt | `text/plain` | ✓ | text (first 1 MB) | ✓ text | ✓ | UTF-8/UTF-16 detection; invalid sequences replaced in preview only |
| jpg/jpeg, png, bmp | `image/jpeg`, `image/png`, `image/bmp` | ✓ | WebP derivative ≤ 4096 px | ✓ page-level | ✓ | Pillow `verify()` + load with pixel cap (§12) |
| tiff/tif | `image/tiff` | ✓ | page images (multi-page, ≤ 500) | ✓ page-level | ✓ | Pillow frame iteration |
| csv | `text/csv` or `text/plain` | ✓ | first 200 rows table | ✗ | ✓ | `csv.Sniffer` on first 64 KiB; consistent column count in sample |
| json / jsonl | `application/json` or `text/plain` | ✓ | pretty text (first 1 MB) | ✗ | ✓ | full streaming parse (`json` / per-line for jsonl); depth ≤ 64 |
| xml | `text/xml`, `application/xml` | ✓ | text | ✗ | ✓ | defusedxml (no DTD, no external entities, no entity expansion) |
| xlsx | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ✓ | first sheet, 200 rows | ✗ | ✓ | openpyxl `read_only=True, data_only=True`; ZIP limits |
| zip | `application/zip` | ✓ container | member list | ✗ | container never payable; members individually | §13 |
| other | — | only if extension ∈ `extra_allowed_extensions` | none | ✗ | reviewer decides | magic must not be in the deny-list |

**Always denied** (`failed: disallowed_type`) regardless of extension: executables and libraries (PE, ELF, Mach-O, `application/x-dosexec`, `application/x-executable`, `application/x-sharedlib`), scripts (`text/x-shellscript`, `text/x-python`, `application/javascript`, `.bat/.cmd/.ps1/.vbs`), HTML/XHTML/SVG, macro-enabled Office (`docm`, `xlsm`, `pptm`, `dotm`), Java archives (`jar`), APK, disk images (ISO/DMG/VHD), and archives other than ZIP (`7z`, `rar`, `tar`, `gz`, `bz2`, `xz`) — ZIP-in-ZIP is not expanded (`nested_archive`).

## 4. Resumable multipart upload protocol

### 4.1 Initiate — `POST /api/v1/datasets/{dataset_id}/uploads`

Request: `{filename, size_bytes, content_type, relative_path?, last_modified?}`.

Server (one transaction):

1. Authorize: caller owns the dataset; dataset status `draft|changes_requested`; user `can_upload`.
2. Sanitise `filename`: NFC, strip directory components (`/`, `\`), remove control chars and `\u202E`-style bidi overrides, collapse whitespace, strip leading dots, trim to 255 bytes UTF-8; empty → `unnamed`. Lower-cased extension = text after the last dot (≤ 10 chars). The sanitised name and `relative_path` are **metadata only**.
3. Pre-check extension against the allow-list + `extra_allowed_extensions` (`415 upload.type_not_allowed`). This is a UX guard; the authoritative check is §8.
4. Enforce limits and quota (§2) under the per-user advisory lock.
5. Generate `file_id` (UUID v7) and insert `dataset_files(processing_status='pending_upload', scan_status='pending')`.
6. `CreateMultipartUpload(Bucket, Key="datasets/{dataset_id}/files/{file_id}/original", ContentType="application/octet-stream", ContentDisposition="attachment", Metadata={"file-id": file_id, "dataset-id": dataset_id})` via the internal client. Storing a neutral content type and `attachment` disposition means a leaked or mis-signed URL still never renders the file inline.
7. Insert `upload_sessions(id=upload_id, file_id, dataset_id, user_id, s3_upload_id, size_bytes, part_size, part_count, status='initiated', expires_at=now()+24h)`.

Response `201`: `{upload_id, file_id, part_size, part_count, expires_at, status:"initiated", uploaded_parts:[]}`.

Part size: `part_size = max(16 MiB, ceil_to_MiB(ceil(size_bytes / 10000)))`; `part_count = ceil(size_bytes / part_size)` (≤ 10,000; for the 4,000,000,000 B maximum this is 239 parts of 16 MiB). All parts except the last are exactly `part_size`; S3's 5 MiB minimum applies to every part except the last, which 16 MiB satisfies.

### 4.2 Part URLs — `POST /api/v1/uploads/{upload_id}/part-urls`

Request `{part_numbers:[…]}` (1–100 distinct numbers within `1..part_count`). Response: one presigned `UploadPart` URL per part, valid **15 minutes**, plus `expires_at`. The first call moves the session to `uploading`. See §5 for signing details.

### 4.3 Status / resume — `GET /api/v1/uploads/{upload_id}`

The server calls `ListParts` (following `NextPartNumberMarker` pagination, max 1,000 per page) and returns `uploaded_parts:[{part_number, etag, size_bytes}]` and `uploaded_bytes`. S3 is the source of truth; the optional `upload_parts` table is only a cache refreshed from ListParts. Parts whose size ≠ expected (`part_size`, or the remainder for the last part) are reported so the client re-uploads them.

### 4.4 Complete — `POST /api/v1/uploads/{upload_id}/complete`

Request `{parts:[{part_number, etag}], client_sha256?}`.

1. Lock the session row. If `completed` → return the file (idempotent `202`). If `aborted|expired` → `409`.
2. `ListParts`; require every part `1..part_count` present, ETags equal to the client list (quotes normalised), sizes as expected, Σ sizes = declared `size_bytes`; otherwise `422 upload.parts_mismatch` with `details.missing_parts` / `details.mismatched_parts`.
3. Re-check dataset/quota limits with real size.
4. `CompleteMultipartUpload`, then `HeadObject` and compare `ContentLength`.
5. `dataset_files.processing_status = 'uploaded'`, `uploaded_at`, `upload_sessions.status = 'completed'`; commit; enqueue `processing.process_file(file_id)` (transactional outbox, so a crash between commit and enqueue is recovered by the outbox relay).
6. `client_sha256`, if supplied, is stored and compared after server hashing; a mismatch marks the file `failed: size_mismatch` (data corrupted in transit or client bug).

### 4.5 Abort — `DELETE /api/v1/uploads/{upload_id}`

`AbortMultipartUpload`, session `aborted`, file row deleted, quota released. Idempotent.

### 4.6 Session state machine (baseline §9)

`initiated → uploading → completed | aborted | expired`. `uploads.expire_sessions` (beat, every 15 min) moves sessions past `expires_at` to `expired`, aborts the S3 upload, deletes the `pending_upload` file row and releases quota. A bucket lifecycle rule (§17) is the backstop.

## 5. Temporary upload authorization (presigned PUT)

| Property | Value |
|---|---|
| Operation | `UploadPart` only (`PUT ?partNumber=n&uploadId=…`). No presigned `PutObject`, `CreateMultipartUpload`, `Complete` or `Abort` — those are server-side. |
| Signature | AWS SigV4, query-string auth, `X-Amz-Expires=900` (15 min); region `S3_REGION` (`us-east-1` for SeaweedFS, `auto` for R2). |
| Host | Signed for `S3_PUBLIC_ENDPOINT` (browser-reachable). Path-style addressing (`S3_FORCE_PATH_STYLE=true`) for SeaweedFS; virtual-hosted or path style for R2/S3 per provider. |
| Scope | Bound to exact bucket, key, `uploadId`, `partNumber`. A URL cannot write any other key or part. |
| Credentials | Signing uses a dedicated IAM/R2 token restricted to `s3:PutObject` (UploadPart) on `datasets/*` plus the server operations it needs; separate keys for workers (read/write) and the presign client where the provider supports it. |
| Issuance control | Only for sessions owned by the caller in `initiated|uploading` and not expired; ≤ 100 URLs per call; rate class `upload`. URLs are never logged (log scrubber removes `X-Amz-Signature`). |
| Size enforcement | S3 rejects parts > 5 GiB; DataHub enforces exact sizes at completion (ListParts) and total size at HeadObject. A client that uploads garbage only wastes its own quota-bounded session. |
| Revocation | Aborting/expiring the session invalidates the `uploadId`, making outstanding URLs useless. |

## 6. Client behaviour (web uploader)

- **Selection:** multiple files, folder upload (`webkitdirectory`, `relative_path` captured), drag & drop (files and folders via `DataTransferItem.webkitGetAsEntry`), ZIPs.
- **Pre-checks** from `GET /public/formats`: extension, size, dataset remaining bytes, quota (from `GET /auth/me` capabilities + dataset totals). Rejected files listed with reasons before any upload.
- **Concurrency:** up to 3 files in parallel, 4 parts per file in flight (≤ 12 concurrent PUTs), adaptive: drop to 2 parts per file after two consecutive part timeouts.
- **Part upload:** `XMLHttpRequest` PUT of `file.slice(start, end)` with no extra headers (avoids CORS preflight variability; `Content-Type` is not signed and not needed). Read `ETag` from the response (requires `ExposeHeaders: ETag`).
- **Retries:** each part retried up to 5 times with exponential backoff (1, 2, 4, 8, 16 s ± 20 % jitter). HTTP 403 with `Request has expired` → fetch fresh part URLs and retry without counting as a failure. Network `offline` event pauses all queues; `online` resumes.
- **Progress:** per-file bytes = Σ completed part sizes + in-flight `upload.onprogress` loaded; overall = Σ files; speed = EWMA over 5 s windows; ETA = remaining / speed.
- **Persistence for resume:** `localStorage["dh.upload." + upload_id] = {upload_id, dataset_id, file_id, name, size, lastModified, relative_path, part_size, part_count, created_at}` written right after init, deleted after complete/abort/expire. On page load the uploader lists persisted sessions for the current dataset, calls `GET /uploads/{id}` and offers "Resume". Browsers cannot persist `File` handles, so the user re-selects the file (or the folder); the client matches by `name + size + lastModified` and only uploads parts missing from ListParts.
- **Cancellation:** per-file "Cancel" aborts in-flight XHRs and calls `DELETE /uploads/{id}`; "Cancel all" does the same for every active session.
- **Completion:** after all parts → `complete`; UI shows "Uploaded — processing" and then subscribes to file status via polling `GET /datasets/{id}/files?processing_status=…` every 5 s (and `notification.created` for `dataset_processing_finished`).
- **Tab close guard:** `beforeunload` prompt while uploads are active.

## 7. Processing pipeline and file states

`processing.process_file(file_id)` on queue `processing` (Celery `acks_late=True`, `prefetch_multiplier=1`, `max_retries=3`, exponential backoff 30 s → 8 min, soft time limit 2 h, hard 2 h 10 min).

| Step | Action | Outcome on failure |
|---|---|---|
| 0 | Status guard: `UPDATE … SET processing_status='processing' WHERE id=:id AND processing_status IN ('uploaded','processing')` (re-entry allowed after crash) | none → task exits (already handled) |
| 1 | `HeadObject`: size = recorded size | `failed: size_mismatch` |
| 2 | **Single streaming pass** over `GetObject` (8 MiB chunks): SHA-256 update; first 64 KiB buffered for libmagic; chunks forwarded to clamd INSTREAM (§9) | stream errors → retry |
| 3 | Type decision (§8) | `failed: type_mismatch` / `disallowed_type` |
| 4 | Scan verdict (§9) | infected → `quarantined`; error → retry, then `failed: scan_error` (`scan_status=error`) |
| 5 | Exact duplicate lookup (§11) | flags only |
| 6 | Structural validation + metadata (page count, dimensions, encoding, row counts) (§8) | `failed: corrupt` / `encrypted` |
| 7 | ZIP → `processing.expand_archive` (§13); container gets `scan_status=skipped_container` (members are scanned individually), `is_container=true` | member-level failures |
| 8 | Previews and text extraction (§12) in a sandboxed subprocess | preview failures do not fail the file (`previews` partial + warning) unless the document cannot be opened (→ step 6 failure) |
| 9 | Near-duplicate fingerprints (§11) | flags only |
| 10 | `processing_status='ready'`, `processed_at`; if every file of the dataset is terminal → notification `dataset_processing_finished` | — |

File states (baseline §9): `pending_upload → uploaded → processing → ready | failed | quarantined`; scan states `pending | clean | infected | error | skipped_container`. Only `ready` + `clean` (or members of a `skipped_container` that are themselves `clean`) files are reviewable and payable (baseline §8.3). A stuck-task sweeper (beat, every 15 min) re-enqueues files in `processing` with `updated_at` older than 2 h 30 min (max 3 sweeps, then `failed: processing_error`).

## 8. File validation

1. **Magic bytes are authoritative.** `python-magic` (libmagic, MIME mode) on the first 64 KiB; OOXML/ODF are recognised by libmagic and confirmed by inspecting the ZIP's `[Content_Types].xml` / `mimetype` member. The browser-declared `content_type` is stored for diagnostics only.
2. **Extension ↔ MIME agreement.** Each allowed extension maps to a MIME family (table §3). Mismatch → `failed: type_mismatch` (e.g. `photo.pdf` that is a JPEG). Text formats (`txt/csv/json/jsonl/xml`) share `text/plain` tolerance and are disambiguated by the structural parse. Unknown extension listed in `extra_allowed_extensions` passes if the MIME is not in the deny-list.
3. **Deny-list** (§3) wins over everything, including admin-added extensions.
4. **Structural checks** per type (§3). Parsers run with limits: XML via defusedxml (forbid DTD/entities), JSON depth ≤ 64 and string ≤ 100 MB, CSV field ≤ 10 MB, Pillow `MAX_IMAGE_PIXELS = 200,000,000` (decompression-bomb guard: larger → `failed: corrupt` with reason `image_too_large`), pypdfium2 with page render limits.
5. **No execution.** Uploaded bytes are never executed, imported, `eval`-ed, or opened by a shell; no macros are run; no LibreOffice; no external entity or URL fetching; workers have no outbound internet egress except to S3/Redis/Postgres/clamd (network policy in Deployment Plan).
6. **Names.** Original filenames and archive member paths are sanitised (§4.1, §13) and used only as display metadata and in `Content-Disposition` (RFC 6266 `filename*=UTF-8''…` percent-encoded, plus ASCII fallback).

## 9. Malware scanning (ClamAV, fail-closed)

| Item | Specification |
|---|---|
| Engine | `clamav/clamav:stable`, `clamd` on internal port 3310 (no host port), `freshclam` updates every 2 h |
| Protocol | `zINSTREAM` with 8 MiB chunks streamed from the S3 read pass (no temp file) |
| clamd.conf | `StreamMaxLength 4000M`, `MaxFileSize 4000M`, `MaxScanSize 4000M` (baseline AM-01),  `MaxFiles 10000`, `MaxRecursion 16`, `MaxScanTime 600000`, `AlertExceedsMax yes`, `AlertEncrypted yes`, `AlertBrokenExecutables yes`, `AlertOLE2Macros yes`, `ConcurrentDatabaseReload no` |
| Size limitation | clamd cannot scan a single stream ≥ 4 GiB. DataHub therefore caps every uploaded file **and every extracted ZIP member** at 4,000,000,000 B (AM-01), so every scannable object is scanned **whole** in one INSTREAM — there is no windowed/partial scanning and no `scan_mode` field. ZIP containers are hashed but not scanned (`scan_status=skipped_container`); each member is scanned individually. A `Heuristics.Limits.Exceeded` verdict is never treated as clean. |
| Verdicts | `OK` → `clean`. `FOUND` → `infected`, file `quarantined` (object moved to `quarantine/{file_id}/original`, original key deleted, signature name stored, admin notified, contributor sees "blocked by security scan"). `Heuristics.Limits.Exceeded`, `Heuristics.Encrypted.*` → treated as **not clean**: `failed` (`archive_limit_exceeded` / `encrypted`). Connection error/timeout → retry (3× task retries + up to 6 h deferred retries), then `scan_status=error`, `failed: scan_error`. |
| Fail-closed rule | A file whose `scan_status ≠ clean` can never be reviewed as accepted, previewed to anyone but admins, exported, annotated or paid. If clamd is down, files wait in `processing`; `/readyz` reports `degraded`; an alert fires after 15 min. There is **no** configuration to skip scanning. |
| Rescan | `POST /admin/files/{id}/rescan` (and an automatic rescan of `error` files after signature updates). Already-accepted files that become `infected` on rescan are quarantined, removed from exports, and an admin task is opened to decide on a clawback adjustment. |
| Attachments/proofs/ID docs | Same engine; visible to others only after `clean`. |

Compensating controls for residual scanner limits: content is never executed (§8.5), downloads are forced attachments with neutral MIME (§15), previews are re-encoded images/escaped text produced in a sandbox (§12), and storage is on a separate origin from the app.

## 10. Content hashing

- **Algorithm:** SHA-256 over the exact stored bytes, lower-case hex, computed by the worker in the single streaming pass (§7 step 2) — never trusted from the client. ZIP members are hashed while being extracted.
- **Storage:** `dataset_files.sha256` (`char(64)`), indexes `(dataset_id, sha256)` and global `(sha256)` (baseline §10).
- **Integrity:** optional `client_sha256` cross-check (§4.4); export manifests include per-file SHA-256; export ZIP parts carry their own SHA-256 (`ExportFile.sha256`).
- **Use:** exact duplicate detection, payment eligibility (a SHA-256 already paid earns 0 unless labeled upgrade, baseline §8.4), takedown matching (a taken-down hash is blocked on future uploads: `failed: disallowed_type` with reason `blocked_hash` and admin alert).

## 11. Duplicate detection

Results stored in `dataset_duplicates(file_id, matched_file_id, kind exact|near, method sha256|simhash|dhash, distance, matched_previously_accepted bool)`, upsert on `(file_id, matched_file_id, kind)`.

### 11.1 Exact (`kind=exact`, `method=sha256`)

After hashing, look up the global SHA-256 index (excluding the file itself and deleted files):

| Match | Effect |
|---|---|
| Same dataset (another file with identical bytes) | Later file flagged; reviewer should reject as `duplicate`; never paid twice within a dataset (earning computed once per SHA-256 per review). |
| Previously **accepted** file (any owner) | `matched_previously_accepted=true`; **not payable** (baseline §8.3) except the labeled-upgrade differential (§8.4). |
| Unaccepted file of same owner (e.g. earlier draft) | Informational flag. |
| File of another owner, not accepted | Flag for reviewer (possible rights issue); other owner's ids hidden from contributors. |

### 11.2 Near duplicates — text (`method=simhash`)

- Input: extracted text (§12) of text-bearing files (docx, odt, rtf, txt, csv, json(l), xml, xlsx) when ≥ 200 characters after normalisation. (PDF text layers are not extracted in v1; PDFs use page dHash.)
- Normalisation (fingerprint only, not stored text): NFC, lower-case, remove ZWSP/ZWNJ/ZWJ and punctuation, collapse whitespace.
- Features: character 5-gram shingles (works for Khmer, which has no word spaces), each hashed with 64-bit xxHash; SimHash 64-bit with equal weights.
- Match: **Hamming distance ≤ 3**. Candidate search by pigeonhole banding: the 64 bits are split into 4 bands of 16 bits stored in indexed `smallint` columns; any pair within distance 3 shares at least one identical band; candidates are then verified with `bit_count(a # b) <= 3`.

### 11.3 Near duplicates — images and pages (`method=dhash`)

- Input: each rendered preview page (PDF/TIFF) and each image, computed on the preview raster before WebP encoding: grayscale, resize to 9×8, compare adjacent pixels → 64-bit difference hash. Stored per page in `file_previews.dhash`.
- Match: **Hamming distance ≤ 5**. Candidate search with 6 bands (sizes 11/11/11/11/10/10 bits; distance ≤ 5 guarantees one identical band), then exact verification.
- File-level flag when ≥ 1 page matches (details list matching pages for reviewers); for multi-page documents the reviewer workspace shows the matched page pairs side by side.

Near duplicates are **flags for the reviewer**, never automatic rejections (baseline §8.3). Fingerprints for rejected/withdrawn files are kept until object purge so repeat submissions are still caught.

## 12. Preview generation and text extraction

Runs in the processing worker inside a **sandboxed subprocess** per file: `RLIMIT_AS` 2 GiB, `RLIMIT_CPU` 300 s, `RLIMIT_NOFILE` 256, no network namespace access beyond the parent's pipes, wall-clock timeout 10 min (20 min for > 100-page documents), non-root user, read-only root filesystem, scratch dir `0700`.

| Source | Output | Parameters |
|---|---|---|
| PDF | `previews/page-{n}.webp`, n = 1…min(pages, 500) | pypdfium2 render at 150 DPI, longest side ≤ 2048 px (≤ 4096 for pages with small text detected by size), WebP quality 80, sRGB, metadata stripped |
| TIFF | page images (≤ 500 frames) | Pillow, same encoding |
| JPEG/PNG/BMP | `previews/page-1.webp` | EXIF orientation applied then **EXIF/GPS stripped**, longest side ≤ 4096 px |
| DOCX/ODT/RTF/TXT/CSV/JSON/XML/XLSX | `text.txt` (UTF-8, first 1 MB) and structured previews (CSV/XLSX first 200 rows as JSON table in `text.txt` companion `table.json`) | python-docx (DOCX) · defusedxml on `content.xml` (ODT) · striprtf (RTF) · openpyxl read-only (XLSX) · stdlib decoders (TXT/CSV/JSON/XML) |
| DOC | none (download only) | — |
| ZIP | member list (from DB rows) | — |

- Keys: `datasets/{dataset_id}/files/{file_id}/previews/page-{n}.webp`, `…/text.txt`, `…/table.json`. Written with `ContentType` set explicitly (`image/webp`, `text/plain; charset=utf-8`, `application/json`) and `ContentDisposition: inline` for previews.
- `file_previews(file_id, page, width, height, dhash, bytes)` rows inserted in batches.
- Text and tables are returned through the API as JSON strings and rendered by React as text (escaped) — never as HTML. Previews of a page beyond 500 → `404 file.no_preview`; the reviewer may download the original.
- Annotation workspaces use the same preview images; zoom up to 400 % uses the 2048/4096 px raster.
- Previews are regenerated (idempotently overwriting the same keys) on rescan or when rendering parameters change (`preview_version` column).

## 13. Archive (ZIP) security

`processing.expand_archive(file_id)` after the container passes type and size checks:

1. **Read the central directory** via ranged GETs (seekable S3 reader; no full download). Reject (`failed: corrupt`) if the central directory is malformed or inconsistent with local headers.
2. **Limits (baseline §7)** checked *before* extracting anything, from central-directory metadata:
   - members ≤ 10,000 (directories excluded) — else container `failed: archive_limit_exceeded`;
   - Σ declared uncompressed sizes ≤ 20 GB — else `archive_limit_exceeded`;
   - every member's declared uncompressed size ≤ `max_file_bytes` (4,000,000,000 B, AM-01) — larger members are not extracted and are recorded `failed: archive_limit_exceeded`;
   - also the expanded members must fit the dataset limit (50 GB) and member count does not count toward the 2,000-file limit.
3. **Per-member checks:**
   - Name sanitisation: decode as UTF-8 (flag bit 11) else CP437; normalise NFC; reject absolute paths, drive letters, `..` segments, backslash traversal, empty names, names > 1,024 bytes → member `failed: unsafe_member_path` (recorded with sanitised display path).
   - Type entries: symlinks (Unix mode `S_IFLNK` in external attributes), device/FIFO/socket entries → skipped and recorded `failed: unsafe_member_path`; directories → skipped silently.
   - Encrypted members (general-purpose bit 0) → `failed: encrypted`.
   - Compression methods allowed: stored (0), deflate (8); others → `failed: corrupt`.
   - Nested archives (zip/7z/rar/tar/gz detected by magic) → member stored but **not expanded**, `failed: nested_archive` (depth ≤ 1).
4. **Streaming extraction with live bomb guards:** each member is decompressed in 1 MiB chunks; the worker counts actual output bytes and aborts the member as `failed: archive_limit_exceeded` if output exceeds its declared size, or if `output / compressed_size > 100` (per-member ratio limit), or if the running total exceeds 20 GB. Output is streamed to a **new S3 object** (`datasets/{dataset_id}/files/{member_file_id}/original`, multipart for > 16 MiB) — never to a local executable path, never executed.
5. Each member becomes a `dataset_files` row with `parent_file_id = container`, `member_path` (sanitised), keyed unique on `(parent_file_id, member_path)` for idempotent re-runs, and then goes through the full pipeline (§7) on its own — magic sniffing, scanning, hashing, duplicates, previews.
6. The container: `is_container=true`, `scan_status=skipped_container`, never payable; preview = member list. If the container itself fails a pre-extraction limit, no members are created and the whole archive is `failed`.
7. Office OOXML/ODF files (which are ZIPs) are *not* expanded as archives, but their internal ZIP is opened with the same limits (member count ≤ 10,000, ratio ≤ 100:1, total ≤ 2 GB uncompressed) during structural validation and text extraction.

## 14. Secure object keys and bucket layout

All keys are built by `core/storage.keys` from server-generated UUIDs only; user-supplied names never appear in keys, so path traversal, Unicode spoofing, key collisions and enumeration by name are impossible.

| Object | Key |
|---|---|
| Dataset file original | `datasets/{dataset_id}/files/{file_id}/original` |
| Page preview | `datasets/{dataset_id}/files/{file_id}/previews/page-{n}.webp` |
| Extracted text / table | `datasets/{dataset_id}/files/{file_id}/text.txt`, `…/table.json` |
| ZIP member | `datasets/{dataset_id}/files/{member_file_id}/original` (own file id) |
| Quarantined original | `quarantine/{file_id}/original` |
| Export package part | `exports/{job_id}/{file}.zip` where `{file}` = `datahub-export-{first 8 chars of job_id}-part-{nnn}` |
| Message attachment | `attachments/{attachment_id}/original` |
| Verification ID document | `verifications/{verification_id}/id-document` |
| Payout proof | `payouts/{payout_id}/proof/{attachment_id}` |

UUIDs are v7 (time-ordered) for index locality; they are unguessable enough for defence in depth (74 random bits) but authorization never relies on secrecy of keys — every URL is issued only after an authorization check. A static unit test asserts that key builders accept only UUID/int arguments.

## 15. Download and preview authorization

| Request | Check | URL |
|---|---|---|
| `GET /files/{id}/preview/{page}` | File visibility rule (`AUTH_AUTHORIZATION.md` §12.1); file `ready`, `scan_status` clean (or member of skipped container and itself clean); dataset not `taken_down` (admins excepted for investigation) | `302` → presigned GET, **5 min**, `response-content-type=image/webp`, `response-cache-control=private, max-age=300` |
| `GET /files/{id}/text` | Same | JSON body (no URL) |
| `POST /files/{id}/download-url` | Same + annotators only if project allows downloads; audited (`file.download_url`: actor, file, IP) | presigned GET **5 min**, `response-content-disposition=attachment; filename="<ascii>"; filename*=UTF-8''<pct-encoded sanitised name>`, `response-content-type=<detected MIME or application/octet-stream>` |
| `POST /admin/exports/{id}/download-url` | `dataset.export`, admin MFA; job `completed`, not expired; audited | presigned GET 5 min, attachment |
| `GET /attachments/{id}/download-url` | conversation participant/staff; attachment `clean` | presigned GET 5 min, attachment |
| Verification ID document | `user.verify` only, URL embedded in the verification response, audited | presigned GET 5 min, attachment |
| Payout proof | payout recipient or `finance.read`; embedded in payout record | presigned GET 5 min, attachment |

Rules: URLs are generated per request, never stored, never placed in emails, never logged; responses that contain them send `Cache-Control: no-store`. Browsers fetch from the storage origin, which is separate from the app origin, so any active content could not access app cookies — and content is forced to download anyway. No permanent or public links exist (bucket is private, no public-read policy).

## 16. Encryption

| Layer | Measure |
|---|---|
| Browser ↔ app | TLS 1.2+ (TLS 1.3 preferred) via Caddy auto-HTTPS; HSTS |
| Browser ↔ storage | HTTPS to R2/S3 public endpoint (presigned URLs are `https://` in production; the API refuses to start in production if `S3_PUBLIC_ENDPOINT` is not https) |
| API/worker ↔ storage | HTTPS in production; in development the internal Docker network uses HTTP to SeaweedFS (dev data only) |
| API ↔ Postgres/Redis | Internal network; TLS enabled when using managed services (`sslmode=verify-full`, `rediss://`) |
| At rest — objects | **Cloudflare R2:** all objects encrypted at rest (AES-256) by the provider, always on. **AWS S3:** default encryption SSE-S3 (AES-256), bucket policy denies `PutObject` without encryption; SSE-KMS optional (customer-managed key) if HA-03 legal review requires key control. **SeaweedFS (dev):** no at-rest encryption requirement (synthetic/test data only; real personal data must not be loaded into dev). |
| At rest — database/backups | Provider disk encryption; `pg_dump` backups encrypted with `age` before upload to the backup bucket (Backup & DR Plan). |
| Secrets | S3 keys, `MFA_ENCRYPTION_KEY`, `CSRF_SECRET` from environment/secret store, never in images or repos. |

## 17. Storage lifecycle and retention

Bucket lifecycle rules (configured by `infrastructure/deployment/storage/lifecycle.json`, applied by `scripts/storage-setup`):

| Rule | Filter | Action |
|---|---|---|
| `abort-incomplete-multipart` | whole bucket | `AbortIncompleteMultipartUpload` `DaysAfterInitiation: 1` (24 h) — backstop for `uploads.expire_sessions` |
| `expire-exports` | prefix `exports/` | Expire after 8 days (app marks `expired` at 7 days and deletes; rule is the backstop) |
| `expire-quarantine` | prefix `quarantine/` | Expire after 30 days |
| `noncurrent-versions` (AWS S3 / SeaweedFS with versioning on) | whole bucket | Noncurrent versions expire after 30 days |

Application retention (`retention.purge`, daily; A-15 defaults pending HA-03 legal review):

| Data | Retention | Deletion |
|---|---|---|
| Abandoned upload sessions | 24 h | abort multipart + delete rows |
| Withdrawn drafts / deleted drafts | 30 days | delete originals, previews, text, member objects (all versions) |
| Rejected dataset objects | 90 days after finalization | delete objects; rows kept (metadata, hashes, fingerprints) for audit and repeat detection |
| Quarantined objects | 30 days | delete; signature/hash kept |
| Exports | 7 days | delete objects; job row → `expired` |
| Accepted dataset objects | Indefinite (licensed platform data) | only via takedown/legal deletion workflow (deletes all versions, records `deletion_requests` outcome) |
| Message attachments | life of conversation + 2 years after close | delete |
| Verification ID documents | 1 year after decision, or at account anonymisation if earlier (final period subject to HA-03) | delete |
| Payout proofs | 7 years (financial record) | delete |

Versioning / object backup (baseline AM-13): AWS S3 and SeaweedFS buckets enable object versioning plus a lifecycle rule expiring noncurrent versions after 30 days (RPO protection against accidental deletes, baseline §14). Cloudflare R2 has no object versioning; on R2 a nightly `rclone sync` copies `datahub-private` to a separate backup bucket at a different provider/account, keeping deleted or overwritten objects for 30 days (rclone `--backup-dir` with dated folders purged after 30 days). Legal deletion removes every version and the replica copy.

## 18. Failure recovery

| Failure | Detection | Recovery |
|---|---|---|
| Browser tab closed / reload / crash | localStorage session record | Resume (§6): re-select file, `GET /uploads/{id}`, upload only missing parts |
| Part PUT network error / 5xx / timeout | XHR error | Retry ×5 with backoff; then mark file "paused – retry" in UI |
| Part URL expired (403) | S3 error body | Request fresh URLs; retry |
| Laptop sleeps > 15 min | URLs expired | Fresh URLs on wake; session valid for 24 h |
| Session older than 24 h | `409 upload.expired` | UI explains; user restarts that file (S3 data already aborted) |
| Complete request lost | Client timeout | Retry `complete` — idempotent; or `GET /uploads/{id}` shows `completed` |
| Part ETag mismatch / missing part | `422 upload.parts_mismatch` | Client re-uploads listed parts, retries complete |
| S3 unavailable at init/presign/complete | boto3 errors after 3 retries | `500 upload.storage_unavailable`; client retries with backoff; alert on rate |
| API crash after Complete but before commit | Session still `uploading`, object exists | Next `complete`/`GET` sees S3 upload no longer listed → HeadObject finds the object → server finalises idempotently |
| Enqueue lost | Outbox relay | Outbox row re-published; `process_file` is idempotent |
| Worker crash mid-processing | `acks_late` redelivery; stuck sweeper | Task re-runs from start (all writes idempotent: same keys overwritten, upserts) |
| ClamAV down | Connection errors; readyz degraded | Files wait in `processing`; deferred retries up to 6 h; then `scan_status=error`; admin rescan after recovery |
| Preview renderer crash/timeout | Subprocess exit/timeout | File still `ready` if structurally valid; `previews` partial; reviewer downloads original; rescan regenerates |
| Archive expansion interrupted | Redelivery | Members unique on `(parent_file_id, member_path)`; existing complete members skipped (size + sha256 present) |
| Dataset deleted during upload | Session check at complete | `409 dataset.not_editable`; upload aborted |
| Quota exceeded at complete (concurrent uploads) | Re-check | `413 upload.quota_exceeded`; session aborted, object deleted |

## 19. Large-file performance

- **No API in the data path:** bytes go browser → S3; the API handles only small JSON calls, so 50 concurrent 4 GB uploads do not load the API (A-03).
- **Part sizing:** 16 MiB balances retry cost (≤ 16 MiB re-sent per failure) against request overhead (239 requests for 4 GB). Concurrency 4 parts/file × 3 files saturates typical 100–500 Mbit/s links.
- **Presign batching:** up to 100 URLs per call; client requests the next batch when < 20 unused URLs remain.
- **Worker throughput target:** ≥ 2 GB/min per worker for hash + scan (baseline §14). Single pass (one `GetObject` stream feeds SHA-256 ≈ 1 GB/s and clamd); 8 MiB buffers; clamd with `MaxThreads` = CPU cores; `processing` workers concurrency = cores/2, prefetch 1 so a 4 GB file does not block other files queued on the same worker.
- **Memory:** never load a whole file; streaming everywhere; previews rendered page by page and uploaded immediately; ZIP via ranged reads.
- **Archives:** members extracted in parallel streams (up to 4) with bounded memory; DB inserts batched (500 rows).
- **Storage requests:** previews are small objects; batch `DeleteObjects` (1,000 keys) for purges; ListParts paginated.
- **Database:** file lists paginated (page_size ≤ 100); counters on `datasets` (`file_count`, `total_bytes`, `ready_file_count`) maintained transactionally to avoid `COUNT(*)` on hot paths.
- **Monitoring:** p95 time from `complete` to `ready` per GB; queue depth; clamd scan rate; S3 error rate (§22).

## 20. Storage CORS and bucket configuration

Browser direct upload requires CORS on the bucket so the browser may `PUT` cross-origin and read the `ETag` header.

**CORS configuration** (`infrastructure/deployment/storage/cors.json`; `AllowedOrigins` is set from `WEB_ORIGIN` by `scripts/storage-setup` — development value shown):

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:3410"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedHeaders": ["Content-Type", "Content-MD5", "x-amz-checksum-sha256"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

- `ExposeHeaders: ETag` is mandatory — without it the browser cannot read part ETags and completion fails.
- Production: exactly one origin, the production web origin (`https://` only); never `*`.
- Apply with `aws s3api put-bucket-cors --bucket datahub-private --cors-configuration file://cors.json --endpoint-url $S3_ENDPOINT` (works against SeaweedFS, which implements `PutBucketCors`, R2 and AWS S3). R2 can alternatively be configured via the Cloudflare dashboard/API with the same rule.
- `scripts/storage-setup` also: creates the bucket if missing, applies lifecycle (§17), enables versioning (AWS/SeaweedFS), sets public-access block (AWS), and verifies by issuing a preflight `OPTIONS` with the web origin and checking `Access-Control-Expose-Headers` contains `ETag`.

**Bucket policy (AWS S3):** deny `s3:*` when `aws:SecureTransport = false`; deny `PutObject` without server-side encryption; no `Principal: *` allows. **Credentials:** API key pair limited to the bucket (Get/Put/Delete/List/multipart operations); export builder and workers use a separate key pair; humans use console accounts with MFA.

**Dev specifics (SeaweedFS):** `datahub_s3` exposes the S3 API on host port 9410 (`S3_PUBLIC_ENDPOINT=http://localhost:9410`) and internally on `datahub_s3:8333` (`S3_ENDPOINT`); filer UI on 9411 (dev only). Path-style addressing.

## 21. Other uploads

| Type | Path | Limits | Storage | Visibility |
|---|---|---|---|---|
| Message attachment | `POST /conversations/{id}/attachments` (multipart, streamed through API) | ≤ 10 MB; pdf, png, jpeg, txt, csv, docx, xlsx, zip (zip not expanded) by magic bytes | `attachments/{attachment_id}/original`, `ContentDisposition: attachment` | Uploader immediately (status `pending`); other participants after `clean` |
| Verification ID document | `POST /me/verification` (multipart) | ≤ 10 MB; pdf, jpeg, png | `verifications/{verification_id}/id-document` | `user.verify` holders only (audited) |
| Payout proof | `POST /admin/payouts/{id}/proof` (multipart) | ≤ 10 MB; pdf, jpeg, png | `payouts/{payout_id}/proof/{attachment_id}` | Recipient + `finance.read` |

These small uploads pass through the API (Starlette spools to a temp file ≤ 10 MB, size counted while streaming; requests above 10 MB + 64 KiB are cut off with `413`), are type-checked by magic bytes, hashed, written to S3, and scanned asynchronously by the same ClamAV service before being shown to anyone other than the uploader.

## 22. Observability and audit

- Metrics (Prometheus): `upload_sessions_total{status}`, `upload_bytes_completed_total`, `upload_complete_seconds`, `processing_duration_seconds{step}`, `processing_files_total{outcome,failure_code}`, `clamav_scan_seconds`, `clamav_verdicts_total{verdict}`, `s3_requests_total{op,status}`, `presigned_urls_issued_total{kind}`, `archive_members_total{outcome}`, queue depth per Celery queue.
- Alerts: clamd unreachable > 15 min; processing queue age > 30 min; `upload.storage_unavailable` > 1 % of upload calls over 5 min; any `infected` verdict (info to admins); lifecycle/expiry job failures.
- Audit (`audit_logs`): upload init/complete/abort, file deletion, quarantine, rescan, every download-URL issuance for originals/exports/ID documents/proofs, takedown, purge runs (counts + keys hash).
- Logs never contain presigned URLs, object bytes, or extracted text; filenames are logged only as file ids.

## 23. Test plan hooks

| Test | Level |
|---|---|
| Part-size computation (edge sizes 1 B, 16 MiB, 16 MiB + 1, 4,000,000,000 B (max), 4,000,000,001 B (rejected), 160 GiB hypothetical) | unit |
| Init limits & quota with concurrent requests (advisory lock) | integration (Postgres) |
| Presigned URL host/expiry (`S3_PUBLIC_ENDPOINT`), expired URL → 403 | integration (SeaweedFS) |
| Complete with missing/mismatched parts; idempotent complete | integration |
| Resume after reload with ListParts (Playwright, throttled network, forced offline) | E2E |
| Magic-byte fixtures: renamed exe, HTML-as-txt, SVG, docm, PDF-as-JPEG | worker unit |
| EICAR plain, EICAR inside ZIP, encrypted ZIP | worker integration (real clamd) |
| ZIP fixtures: zip-slip (`../../etc/passwd`), absolute path, symlink, 10,001 members, 1 GB→10 MB bomb (ratio > 100), nested zip, CP437 names, bidi-override names | worker integration |
| Whole-stream scan of a 3.9 GB synthetic file within `MaxScanTime`; 4,000,000,001 B file and ZIP member rejected (AM-01) | nightly performance job |
| Exact/near duplicate: identical bytes; re-saved JPEG (dHash ≤ 5); text with minor edits (SimHash ≤ 3); Khmer text with ZWSP variations | unit + integration |
| Preview sandbox limits (huge-pixel PNG, 2,000-page PDF → 500 previews) | worker integration |
| Download URL headers: attachment disposition, forced content type, 5-min expiry | integration |
| Lifecycle/expiry jobs: abandoned session cleanup, export expiry, purge of rejected data | integration with frozen time |
| CORS preflight exposes `ETag` | storage-setup verification test |
| Throughput benchmark ≥ 2 GB/min per worker | performance |
