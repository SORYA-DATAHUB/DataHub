# DataHub — Threat Modeling Report

## Document control

| Field | Value |
|---|---|
| Purpose | Identify abuse paths, required controls, residual risk and verification for DataHub. |
| Scope | Browser, API, database, Redis, workers, private object storage, ClamAV, SMTP, operator access, backups and exports. |
| Assumptions | Single operator, modular monolith, direct S3 multipart upload, manual external payouts and trust boundaries in DFD. |
| Decisions | STRIDE plus business-abuse analysis; private-by-default resources; fail-closed file acceptance; double-entry append-only ledger. |
| Dependencies | SAD/HLD/DFD, Security Requirements, Auth specification, File Upload specification, pricing policy and Risk Register. |
| Acceptance criteria | Every high/critical threat has preventive/detective controls, an owner, verification and explicit residual-risk disposition. |

## 1. Method and assets

STRIDE is applied to each trust-boundary crossing. Likelihood and impact are Low/Medium/High; Critical denotes high likelihood and high impact or catastrophic financial/private-data impact. Primary assets are credentials/sessions, private source documents, annotation outputs, rights/provenance evidence, financial ledger and payout evidence, encryption/secrets, audit records, exports/backups and service availability.

Threat actors include opportunistic attackers, malicious contributors, compromised accounts, dishonest or mistaken staff, compromised dependencies/providers and tenants trying to cross resource boundaries.

## 2. Trust boundaries

1. Untrusted browser ↔ HTTPS edge/API.
2. Browser ↔ object storage through short-lived, operation-scoped presigned requests.
3. API/worker trusted network ↔ PostgreSQL, Redis, ClamAV and storage.
4. Worker ↔ hostile uploaded bytes and document parsers.
5. Platform ↔ SMTP, DNS and monitoring providers.
6. Staff administrative session ↔ high-impact financial/export/security operations.
7. Production ↔ encrypted offsite backups and restore environment.

## 3. Threat register

| ID / STRIDE | Threat and abuse path | L/I | Required mitigations | Verification / residual risk |
|---|---|---|---|---|
| TM-01 S | Credential stuffing/account takeover | H/H Critical | Argon2id, generic errors, IP+account limits, secure opaque sessions, reset replay prevention, admin MFA, anomaly events | TC-ID-003/TC-CRIT-003; contributor MFA absent in v1 leaves Medium residual |
| TM-02 S/E | Session theft/fixation or privilege retained after role/suspension change | M/H | Rotate at login/MFA/password change, hash tokens, Secure/HttpOnly/SameSite cookies, revoke sessions and re-evaluate user/role state | TC-CRIT-002, TC-ID-004; XSS remains key dependency |
| TM-03 T | CSRF on payout, review, settings or message mutation | M/H | Same-origin deployment, double-submit token, Origin validation, no unsafe GET, SameSite cookie | TC-AZ-004; Low residual |
| TM-04 E/I | Broken object-level authorization exposes another user's dataset/task/message | H/H Critical | Permission dependency plus service resource checks, non-disclosing 404, scoped queries, signed URL issued only after check | TC-CRIT-004/017; authorization matrix mandatory |
| TM-05 E | Role/permission escalation or admin bypass | M/H Critical | Super-admin-only role/settings controls, MFA, SoD, audited role changes, deny by default | TC-AZ-003; insider collusion Medium residual |
| TM-06 T/E | SQL/command/template injection | M/H | SQLAlchemy parameters, no shell with user input, strict Pydantic schemas/enums, safe renderers, SAST | Negative API corpus + Semgrep/ZAP; parser CVEs remain Medium |
| TM-07 T/I | Stored/reflected XSS in metadata, annotations, filenames or chat | H/H | React escaping, sanitize any rich text, forbid HTML/SVG uploads, CSP, content disposition attachment | TC-MSG-001 + ZAP; Low/Medium residual |
| TM-08 T/D | Malicious upload, executable content or malware | H/H Critical | Magic+extension allowlist, private quarantine, ClamAV fail-closed, no execution, least-privileged isolated workers, patched parsers | TC-CRIT-006; zero-day malware Medium residual |
| TM-09 T/D | ZIP traversal, symlink/device member, nesting or decompression bomb | H/H Critical | Stream parse; reject absolute/`..`/symlink/device; count, depth, ratio and uncompressed limits; never extract to executable FS | TC-CRIT-007; crafted parser exploit Medium residual |
| TM-10 I | Presigned URL leakage/replay or permanent public object | M/H | Private bucket/public-access block, random non-user keys, short expiry, exact method/key, TLS, no URL logging, lifecycle | expiry/ACL integration tests; user endpoint compromise Medium |
| TM-11 R/T | Contributor denies rights declaration or staff alters provenance/review | M/H | Versioned agreement acceptance, per-submit declarations, immutable versions/audit, actor/time/IP/request IDs | Audit tests; legal enforceability requires HA-01–03 |
| TM-12 T | Exact/near duplicate submission earns twice | H/H Critical | SHA-256 global duplicate lookup, accepted-content history, reviewer warning, unique earning source/idempotency key | TC-CRIT-008/011; semantic near-duplicates Medium residual |
| TM-13 T/E | Review replay or race double-credits wallet | M/H Critical | locked review/wallet rows, terminal state, unique idempotency key, append-only zero-sum journal | TC-CRIT-009/011, TC-FI-005 |
| TM-14 T/E | Concurrent withdrawals overspend available balance | M/H Critical | wallet `FOR UPDATE`, one open request, nonnegative constraints, atomic reservation journal | TC-CRIT-012; DB outage handled by rollback |
| TM-15 R/T | Fake payment confirmation/reference/proof or self-approval | M/H Critical | MFA, permission, distinct actor/recipient, dual approval threshold, unique reference, explicit external confirmation, private scanned proof, audit | TC-CRIT-013; colluding admins Medium/High pending HA-07 |
| TM-16 T | Ledger/audit alteration or deletion | M/H Critical | DB append-only triggers, restricted runtime DB role, zero-sum deferred constraint, encrypted backups, reconciliation | TC-FI-005/006/008; DBA capability requires monitored break-glass |
| TM-17 I | Sensitive data leaks through logs, analytics, errors, monitoring or email | M/H | structured allowlisted logs, redaction, generic errors, metadata minimization, no content/tokens, provider DPAs | log-seed scanning and review; vendor exposure Medium pending HA-03 |
| TM-18 I/E | Unauthorized bulk export or export-link sharing | M/H Critical | admin permission+MFA, filters only accepted authorized data, background private artifact, short expiry, manifest and audit | TC-CRIT-018; authorized insider exfiltration Medium/High |
| TM-19 T | Annotation overwrite/version conflict | M/M | optimistic version, 409 conflict, autosave recovery, assignment/resource check, immutable versions | TC-CRIT-015; Low residual |
| TM-20 D | API, worker, queue, storage or parser resource exhaustion | H/M | quotas, rate limits, timeouts, bounded concurrency/retries, queue separation, backpressure, alerts | TC-OP-001–006; single-VM failure Medium/High accepted for initial scale |
| TM-21 D/T | Redis loss causes duplicate/lost task or notification | M/M | task idempotency, late ack, durable DB job/outbox state, reconciliation; Redis not source of business truth | TC-OP-003/004; temporary delivery delay Medium |
| TM-22 T/E | Dependency/container/supply-chain compromise | M/H Critical | locks, hash verification where supported, least privilege, SBOM, Trivy/audit/SAST, reviewed pinned images, protected CI | CI scans; upstream zero-day Medium |
| TM-23 I/T | Backup theft, corruption or unrecoverable restore | M/H Critical | encrypted offsite copies, separate credentials, immutability/versioning, checksums, least access, quarterly restore | TC-CRIT-019; provider/account compromise Medium |
| TM-24 S/E | SMTP/domain spoofing or malicious verification link | M/M | authenticated provider, SPF/DKIM/DMARC, HTTPS canonical origin, single-use short-lived token, no secret in logs | staging mail tests/DNS checks; phishing Medium |
| TM-25 E/R | Insider abuses admin search, review, export, payout or takedown | M/H Critical | least privilege, MFA, SoD, reason fields, immutable audit, alerts for bulk/high-value actions, periodic access review | quarterly review; collusion remains Medium/High |
| TM-26 I | Confidential/personal/copyrighted data is accepted unlawfully | H/H Critical | declarations, sensitive-content flags, restricted review, takedown/legal hold, data minimization and legal review gates | policy workflow tests; legal residual cannot be accepted until HA-01–04 |

## 4. Attack trees for highest-risk outcomes

### 4.1 Obtain a private dataset

An attacker may compromise a session, exploit BOLA, steal a presigned URL, gain an admin role, obtain an export/backup, or exploit storage configuration. Defense requires independent identity, resource authorization, private bucket, short-lived URLs, MFA/SoD, export audit, encrypted backup and monitoring controls; no single UI visibility rule is sufficient.

### 4.2 Extract unearned funds

Paths include duplicate content, review replay, arithmetic manipulation, concurrent reservations, fake payment evidence, self-approval and ledger editing. Controls are exact hashes, versioned pricing, integer micros, locked/idempotent transactions, dual control, unique references, append-only balanced journals and reconciliation.

### 4.3 Execute or weaponize uploaded content

Paths include MIME spoofing, parser vulnerability, active HTML/SVG, macro documents, ZIP traversal/bomb and malware. Controls are quarantine, magic allowlists, active-format prohibition, fail-closed scanning, bounded parsing in least-privileged workers, generated previews and prompt patching.

## 5. Privacy and abuse cases

The system must treat rights declarations as claims requiring review, not proof of ownership. Reviewers need a restricted escalation path for IDs, medical/financial records, minors, credentials, confidential business records and mass personal data. Search, preview, messaging attachments, notification text and export manifests minimize data. Takedown, legal hold and deletion events must preserve only the lawful audit/financial evidence described by policy.

## 6. Security validation and ownership

Security owns quarterly threat-model review and pre-release review after auth, storage, finance, export or topology changes. Engineering maps mitigations to automated cases; SRE validates network/storage/backups; Finance validates payout SoD and reconciliation; Legal owns HA-01–04. A new trust boundary or high-impact workflow requires a threat-model update before merge.

## 7. Residual risks and release decisions

Release is blocked by unresolved Critical findings, public storage, bypassable malware scan, missing admin MFA, untested financial idempotency, failed restore, or absent legal approval for contributor/privacy/licence terms. Accepted initial risks include a single-VM compute topology and no mandatory contributor MFA, subject to monitoring and documented owner acceptance. HA-01–HA-05 and HA-07/08 remain human decisions; documentation does not constitute approval.

