# ADR-0006: Direct-to-S3 multipart resumable uploads with presigned part URLs

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0006 |
| Version | 1.1 (amended by baseline AM-01) |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "Direct-to-S3 multipart resumable uploads with presigned part URLs" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-03, A-09.
- **Decisions.** This ADR (ADR-0006). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §7, §12 (Uploads); HLD §4.3; SDD §3.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

Contributors upload files up to 4 GB (4,000,000,000 bytes, baseline AM-01) and datasets up to 50 GB, often over unreliable networks in Cambodia. Target: ≥ 99 % upload success on the resumable path. Proxying bytes through the API would tie up API workers, bandwidth and disk, and make resumption hard.

## Decision

The browser uploads directly to object storage using S3 multipart upload. The API: initialises the upload (validations, `CreateMultipartUpload`, `upload_sessions` row), returns presigned `UploadPart` URLs (15 min) for requested part numbers, reports already-uploaded parts via S3 `ListParts` for resume, and completes the upload after verifying ETags and object size. Part size 16 MiB, raised to keep ≤ 10,000 parts. Abandoned sessions are aborted after 24 h by `uploads.expire_sessions` and by a bucket lifecycle backstop. Processing starts only after completion via `processing.process_file`.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| tus protocol server (tusd) | Excellent resumability, but adds a service, stores bytes on its disk then copies to S3. |
| Upload through API with streaming to S3 | Simple client, but API bandwidth and timeouts become the bottleneck; resumption needs custom chunk state. |
| Single presigned PUT per file | Simplest, but no resume; a multi-GB file restarting from zero after every network drop is unacceptable on Cambodian links (S3 also caps a single PUT at 5 GB). |

## Tradeoffs

+ API never touches file bytes; scales with request count only.
+ Resume is exact because S3 is the source of truth for uploaded parts.
− The client upload engine is non-trivial (concurrency, retries, IndexedDB persistence).
− Integrity of the uploaded content is only verified at processing (SHA-256 computed by the worker); part ETags guard transport.

## Consequences

- CORS on the bucket and CSP `connect-src` must include the public S3 endpoint.
- Quotas (`max_file_bytes`, `max_dataset_bytes`, `user_pending_quota_bytes`) are enforced at init using declared size and re-checked at complete using the real object size.
