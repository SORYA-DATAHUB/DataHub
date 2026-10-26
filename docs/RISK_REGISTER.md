# DataHub — Risk Register

| Field | Value |
|---|---|
| Purpose | Track business, technical, security, legal and operational risks with owners and mitigations. |
| Scope | Whole programme; reviewed at every phase gate. |
| Scale | Likelihood (L) and Impact (I) 1–5; Score = L×I. ≥ 15 = critical. |

| ID | Risk | L | I | Score | Mitigation | Owner | Status |
|---|---|:-:|:-:|:-:|---|---|---|
| R-01 | Contributors upload copyrighted or stolen documents; platform pays for data it cannot lawfully use. | 4 | 5 | 20 | Rights declaration at onboarding and per dataset; reviewer checklist `copyright_concern`; takedown workflow; licence terms (HA-02) reviewed by counsel. | Owner / Legal | Open |
| R-02 | Personal data (ID cards, medical, bank statements) collected without lawful basis. | 4 | 5 | 20 | `contains_personal_data` flag, reviewer reason `personal_data`, restricted access, retention limits, legal review HA-03. | Legal / DPO | Open |
| R-03 | Payment fraud: duplicate/self-generated junk data to farm earnings. | 4 | 4 | 16 | Exact + near-duplicate detection, quality review before credit, verification before withdrawal, payout dual approval, analytics on per-user acceptance rate. | Finance | Open |
| R-04 | Double payment through retries or race conditions. | 3 | 5 | 15 | Idempotency keys, unique constraints, wallet row locks, zero-sum trigger, nightly reconciliation, concurrency tests (Scenario 7). | Engineering | Open |
| R-05 | Malware distributed via uploads to reviewers/annotators. | 3 | 5 | 15 | ClamAV fail-closed, server-rendered previews only, downloads as attachment, no execution. | Security | Open |
| R-06 | Archive bombs / zip-slip exhaust worker disk or overwrite files. | 3 | 4 | 12 | Streaming expansion with ratio/size/member limits, sanitised names, objects never written to filesystem paths from names. | Engineering | Open |
| R-07 | Host machine memory pressure (dev host ~7.5 GB RAM, heavy swap) makes ClamAV (~1.2 GB) and Next.js builds unstable. | 4 | 2 | 8 | Memory limits per container, worker concurrency 2, ClamAV can be paused in dev; prod VM sized 8–16 GB. | DevOps | Open |
| R-08 | Production credentials/hosting not available → no live deployment. | 5 | 3 | 15 | Deployment automation completed and documented; exact checklist for owner (HA-05). | Owner | Open |
| R-09 | Khmer text corrupted by normalisation or unsafe string slicing. | 3 | 4 | 12 | Store transcription verbatim, NFC only at export copy, grapheme-aware UI, tests with Khmer fixtures. | Engineering | Open |
| R-10 | Admin account compromise → mass export / fraudulent payouts. | 2 | 5 | 10 | TOTP MFA, step-up for finance, audit logs, dual approval, export logging, session revocation. | Security | Open |
| R-11 | Storage cost growth beyond budget (20 TB/year). | 3 | 3 | 9 | R2 (no egress), lifecycle deletion of rejected data after 90 days, quotas. | Owner | Open |
| R-12 | Legal documents (ToS, privacy, agreement) used in production without counsel review. | 3 | 5 | 15 | Pages carry a draft banner controlled by setting `legal_docs_approved=false`; release readiness gate. | Owner | Open |
| R-13 | Single VM is a single point of failure. | 3 | 3 | 9 | Daily backups off-site, object storage on managed provider, documented RTO 4 h restore runbook, tested restore. | DevOps | Open |
