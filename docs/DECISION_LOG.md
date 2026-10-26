# DataHub — Decision Log

| Field | Value |
|---|---|
| Purpose | Chronological record of every material product/technical decision, its rationale and who must approve it. |
| Scope | All decisions affecting scope, architecture, money, security, legal posture. Detailed technical rationale lives in `02-system-architecture/ADR/`. |
| Status | Living document |

| # | Date | Decision | Rationale | Type | Approval |
|---|---|---|---|---|---|
| D-001 | 2026-10-26 | Repository is a new implementation (directory was empty). Monorepo at `~/learn/DataHub`. | Inspection found no prior code. | Process | Engineering |
| D-002 | 2026-10-26 | Canonical decisions consolidated in `ENGINEERING_BASELINE.md`; baseline wins over other docs until amended here. | One source of truth for 35 documents written in parallel. | Process | CTO |
| D-003 | 2026-10-26 | Modular monolith (FastAPI) + Celery workers; no Kubernetes. | Team size, expected load (A-03). ADR-0001, ADR-0013. | Architecture | Engineering |
| D-004 | 2026-10-26 | Money in integer micro-USD; append-only double-entry ledger; floor per file. | No float, exact, auditable. ADR-0009. | Financial | Engineering (policy HA-06/07/08 owner) |
| D-005 | 2026-10-26 | Dev object storage = SeaweedFS (not MinIO). | MinIO container images are no longer freely published; SeaweedFS speaks S3 incl. multipart. ADR-0005. | Technical | Engineering |
| D-006 | 2026-10-26 | Server-side page rendering instead of PDF.js. | Uniform page model for PDF/TIFF/images, no active PDF content in the browser, annotation coordinates per page image. ADR-0007. Deviation from requested stack — documented. | Technical | Engineering |
| D-007 | 2026-10-26 | Opaque DB sessions in HttpOnly cookie + double-submit CSRF; TOTP MFA mandatory for admin roles. | Instant revocation, no token theft via JS. ADR-0008. | Security | Security |
| D-008 | 2026-10-26 | Contributor verification gates withdrawals and annotation work, not uploads. | Lets new users contribute immediately while protecting money flows. A-08. | Product | Owner (confirm) |
| D-009 | 2026-10-26 | Contributor licence model drafted as non-exclusive perpetual licence, not IP assignment. | Brief forbids assuming IP transfer. | Legal | **HA-02 pending** |
| D-010 | 2026-10-26 | Raw→labeled upgrade earns only the rate difference, reviewer-confirmed. | Prevents double compensation while rewarding labeling. | Financial | **HA-08 pending** |
| D-011 | 2026-10-26 | Dual approval for payouts ≥ $100. | Separation of duties for manual transfers. | Financial | **HA-07 pending** |
| D-013 | 2026-10-26 | Direct browser→S3 multipart confirmed feasible on SeaweedFS 4.47. | Spike (scratch): PutBucketCors honoured, CORS preflight 200 exposing `ETag`, presigned `UploadPart` PUT 200, `ListParts` returns uploaded parts (resume), `CompleteMultipartUpload` size correct. Pitfall: bucket names must be ≥ 3 chars. | Technical | Engineering |
| D-012 | 2026-10-26 | Dev host ports 3410/8410/5440/6390/9410/8425 chosen. | Host already uses 3200, 5434, 8000, 8080. | Ops | Engineering |
