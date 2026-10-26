# ADR-0010: ClamAV malware scanning, fail-closed

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0010 |
| Version | 1.1 (amended by baseline AM-01 / D-014) |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "ClamAV malware scanning, fail-closed" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-10.
- **Decisions.** This ADR (ADR-0010). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §3, §7, §8.3; SDD §3.2.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

Uploaded files and attachments are untrusted and are later downloaded by reviewers, annotators and admins and bundled into exports. The platform pays for accepted data, so a file that was never scanned must not become payable or distributable.

## Decision

Scan every non-container file (including each extracted ZIP member and every message attachment and payout proof) with ClamAV clamd (`clamav/clamav:stable`, INSTREAM on internal port 3310) inside the processing worker, streaming the same bytes used for hashing. Outcomes: `clean` → continue; `infected` → move to `quarantine/`, status `quarantined`, security event; `error`/timeout → retry ×3 with backoff, then `failed` (`scan_error`). Only `scan_status = clean` files are eligible for review acceptance, earnings, annotation and export. ZIP containers get `skipped_container`; their members are scanned individually. Signatures update via freshclam.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Fail-open (accept on scanner error) | Better availability, but violates A-10 and risks distributing malware. |
| Commercial scanning API (e.g. VirusTotal) | Higher detection rates, but sends confidential documents to a third party. |
| No scanning, rely on rendering isolation | Leaves downloads and exports unprotected. |

## Tradeoffs

+ Strong guarantee: no unscanned file reaches payment or export.
+ Self-hosted; documents never leave our infrastructure.
− ClamAV outages delay processing; mitigated by retries, alerts and admin rescan.
− clamd needs ≈ 1.5–3 GB RAM; accounted for in VM sizing.

## Consequences

- Amended by baseline AM-01 (`DECISION_LOG.md` D-014): because clamd cannot scan a single stream ≥ 4 GiB, the per-file limit (`max_file_bytes`) is 4,000,000,000 bytes for every upload and every extracted ZIP member, and clamd runs with `StreamMaxLength 4000M`, `MaxScanSize 4000M`, `MaxFileSize 4000M`. Every object is scanned whole — there is no windowed/partial scan mode. ZIP containers are hashed but not scanned (`skipped_container`); each member is scanned individually.
- Worker readiness and scan error rates are monitored.
