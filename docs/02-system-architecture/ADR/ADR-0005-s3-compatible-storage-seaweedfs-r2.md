# ADR-0005: S3-compatible object storage: SeaweedFS in dev, R2 or S3 in prod

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0005 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "S3-compatible object storage: SeaweedFS in dev, R2 or S3 in prod" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-03, A-15.
- **Decisions.** This ADR (ADR-0005). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §3; HLD §4.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

DataHub stores up to 20 TB in year 1 (A-03) with files up to 5 GB, and needs private buckets, multipart uploads, presigned URLs and lifecycle rules. MASTER Part 6 suggests MinIO for local development, but MinIO community container images are no longer freely distributed, so a different S3-compatible server is needed for dev/CI.

## Decision

Use the S3 API exclusively through `core.storage` (boto3). Development and CI run SeaweedFS (`chrislusf/seaweedfs`) as `datahub_s3` (S3 API host port 9410, filer UI 9411). Production uses Cloudflare R2 (preferred, no egress fees) or AWS S3. One private bucket `datahub-private` with server-generated keys. Code uses only the S3 subset supported by all three: multipart create/upload-part/list-parts/complete/abort, presigned PUT/GET, HEAD, GET, PUT, DELETE, ListObjectsV2. Separate internal and public endpoints are configured (`S3_ENDPOINT_INTERNAL`, `S3_ENDPOINT_PUBLIC`).

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| MinIO | Previous default for local S3; images no longer freely distributed, licence and supply uncertainty. |
| Local filesystem in dev, S3 in prod | Different code paths; multipart/presign behaviour untested until production. |
| Garage or LocalStack | Garage lacks some multipart features we rely on; LocalStack is heavier and its free tier is changing. |
| Database BLOBs | Unworkable at multi-TB scale and for direct browser uploads. |

## Tradeoffs

+ Identical code path in dev, CI and prod; presigned multipart tested locally.
+ R2's zero egress fits preview-heavy review/annotation traffic.
− Small behavioural differences between providers (checksum headers, CORS syntax); covered by an integration test suite run against SeaweedFS and a staging R2 bucket.
− Dev requires public-vs-internal endpoint handling because the browser and containers see different hostnames.

## Consequences

- Bucket CORS must expose `ETag`; lifecycle rule aborts incomplete multipart uploads after 1 day and expires `exports/` after 7 days.
- Production bucket versioning enabled for RPO of object data.
