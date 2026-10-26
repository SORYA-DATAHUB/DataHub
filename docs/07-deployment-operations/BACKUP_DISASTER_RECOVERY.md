# DataHub — Backup & Disaster Recovery Plan

## Document control

| Field | Value |
|---|---|
| Purpose | Define protected data, backup schedules, restoration, verification and disaster response. |
| Scope | PostgreSQL, private object storage, deployment/configuration metadata, secrets recovery references and audit evidence. |
| Assumptions | Initial production is a single compute VM with managed S3/R2; repositories and images are separately versioned; A-15 retention applies. |
| Decisions | Encrypted daily offsite backups, object versioning/protection or nightly protected copy, quarterly isolated restore, target RPO 24 hours and RTO 4 hours; optional WAL archiving targets 15 minutes. |
| Dependencies | Deployment Plan, retention policy, Security Requirements, Docker/CI/CD and provider selection HA-05. |
| Acceptance criteria | Automated backup jobs are monitored; an isolated full restore meets RPO/RTO and integrity checks before production readiness. |

## 1. Objectives and recovery tiers

The initial service target is RPO ≤ 24 hours for PostgreSQL and protected object copies, and RTO ≤ 4 hours for core read/write service after incident declaration. Optional WAL archiving improves the database target to 15 minutes after it is configured and restore-tested. Object uploads use provider durability plus AWS versioning or the AM-13 nightly R2-to-backup-provider copy; loss of a just-uploaded object before database registration must not produce an accepted dataset. Configuration/IaC is recovered from signed/versioned Git and immutable container images.

| Data | Protection | Retention target | Recovery priority |
|---|---|---|---|
| PostgreSQL | daily encrypted logical/custom-format backup; optional tested WAL archive | 35 days for recovery copies; financial/audit records remain in authoritative data for 7 years per policy | P0 |
| Source objects, previews, proofs, exports | AWS versioning or nightly R2 copy to separate provider, lifecycle rules | backup copies/noncurrent versions 35 days; live source by dataset policy; exports 7 days; rejected 90 days | P0 source/proof; P2 previews/exports |
| Deployment config | Git, image registry, encrypted secret-manager records | release history + provider retention | P0 |
| Redis | no authoritative business backup | none; reconstruct queues/outbox from PostgreSQL | P1 |
| Logs/metrics | provider retention and restricted export | security logs per policy | P2 |

Provider-specific retention must be validated against legal holds and HA-03/04. Backups never silently extend ordinary object retention beyond disclosed policy; expired backup copies become inaccessible through rotation, with deletion requests recorded until expiry.

## 2. Security and separation

- Encrypt in transit and at rest; backup archives receive client/provider encryption and checksum manifests.
- Backup credentials are distinct from runtime credentials, read/write only to the backup prefix, stored in the approved secret manager and rotated.
- Production administrators cannot delete immutable backup generations using normal runtime credentials. Break-glass access requires MFA, reason, two-person notification and audit.
- Restore environments use isolated networking, no outbound email, synthetic replacement secrets and access limited to drill responders.
- Never place plaintext database dumps, `.env` files or proof documents in Git, CI artifacts or operator laptops.

## 3. Backup procedures

### 3.1 PostgreSQL

The daily scheduled backup container/script runs `pg_dump --format=custom --no-owner --no-acl`, writes to a restrictive temporary location, computes SHA-256, encrypts/uploads the archive and manifest, verifies remote size/checksum, then removes the local temporary file. Optional WAL/PITR is enabled only after its own recovery drill. The job emits `datahub_backup_success_timestamp`, duration, size and failure metrics; a failure or no success within 26 hours alerts immediately.

### 3.2 Object storage

Enable private-bucket public-access block, AWS versioning when S3 is selected, deletion protection where supported, lifecycle by documented prefixes/tags and inventory reports. Because R2 has no versioning, AM-13 requires a nightly `rclone sync` to a separate Backblaze B2/provider bucket with deleted copies retained for 35 days. A daily job compares database object keys against storage inventory and samples SHA-256. Without a separate protected copy, provider-account compromise remains an unacceptable production gap.

### 3.3 Configuration and secrets

Git retains Compose, Caddy, monitoring and migration definitions. The secret manager's documented recovery/export mechanism protects secret metadata; actual values are not copied into application backups. Maintain an offline, access-controlled recovery sheet listing owners, provider account recovery, domain registrar, secret locations and rotation order—never secret values in this repository.

## 4. Restore procedure

1. Incident commander declares target recovery time/build and freezes writes or enables maintenance mode.
2. Provision an isolated PostgreSQL 17 target and fresh private bucket/prefix; record operators and timestamps.
3. Select the newest valid backup before the recovery point; verify signature/checksum and malware-safe handling.
4. Restore roles/schema/data using restricted credentials; apply only migrations belonging to the selected application build.
5. If PITR is configured, replay WAL to the target time and verify recovery timeline.
6. Restore/reattach object versions and configure fresh scoped credentials; never make the bucket public.
7. Run integrity checks in §5. Rebuild derived previews, search projections and notifications only after authoritative records pass.
8. Start API/workers with email disabled, run smoke and authorization/financial tests, then rotate secrets potentially exposed by the incident.
9. Obtain incident-commander and service-owner approval before DNS/traffic cutover.
10. Monitor errors, queue backlog, storage misses and ledger reconciliation; preserve the failed environment for forensics where lawful.

## 5. Integrity verification

Required checks are migration head; table counts versus manifest/tolerance; foreign keys; no orphaned required object keys; sampled/full SHA-256 by incident severity; all ledger journals zero-sum; cached wallet balances reconcile; no negative available/reserved balances; earning/payout idempotency uniqueness; audit sequence/time coverage; and successful controlled login, private download, upload-processing, message, annotation and export smoke tests.

Restore is not successful until these checks pass. Any discrepancy creates an incident record and blocks traffic.

## 6. Failure scenarios

| Scenario | Immediate action | Recovery |
|---|---|---|
| Database corruption/deletion | maintenance mode, stop writers, preserve logs | PITR/backup to clean DB; integrity suite; credential rotation |
| Compute VM loss | provision replacement from deployment automation | restore DB if local, attach provider services, deploy immutable release, smoke/cutover |
| Bucket deletion/object corruption | revoke destructive credential, legal hold if needed | restore versions/replica; compare inventory and checksums; regenerate derivatives |
| Provider region/account unavailable | incident declaration and owner/provider escalation | use secondary provider/region if configured; otherwise restore latest offsite copies |
| Ransomware/credential compromise | isolate systems, revoke sessions/keys, preserve evidence | restore to clean account/environment from immutable generation; rotate all secrets |
| Redis loss | stop/restart workers safely | rebuild pending work from DB job/outbox states; idempotent replay and reconcile |
| Bad deployment/migration | stop rollout; assess schema compatibility | image rollback when compatible or approved forward-fix/DB restore; never ad-hoc edit production |

## 7. Restore testing

Before launch and quarterly thereafter, restore a randomly selected daily backup and relevant object versions into an isolated environment. At least annually exercise a total compute-loss scenario and provider/account recovery. Record backup IDs, selected point, start/end time, achieved RPO/RTO, commands/tool versions, integrity results, defects, owner and remediation due date. Failed drills create a release/operations blocker until corrected and repeated.

## 8. Incident roles and communication

The incident commander coordinates; SRE restores infrastructure; database owner validates PostgreSQL; Security preserves evidence and directs credential rotation; Finance validates ledger/wallet/payout state; Product validates workflows; Legal/Privacy decides notification obligations. Status communication must exclude credentials and private document contents. Regulatory/user notification timelines require qualified legal confirmation for applicable jurisdictions.

## 9. Data deletion, legal holds and backup expiry

Deletion removes live objects and schedules/records backup expiry; immutable backups are not rewritten unless the selected system safely supports it. Restored old backups must immediately reapply the deletion/takedown tombstone log before serving traffic. Legal holds suspend deletion only for documented scope and authority. Backup destruction events are provider-audited and retained as evidence.

## 10. Monitoring and acceptance checklist

- [ ] Last database backup age ≤ 24 hours and WAL/RPO mechanism healthy.
- [ ] Remote checksum verification succeeded and retention lifecycle is active.
- [ ] Object versioning/protection and public-access block verified.
- [ ] Backup/runtime credentials separated, scoped and rotated.
- [ ] Quarterly isolated restore passed within RPO/RTO.
- [ ] Ledger, object and workflow integrity checks passed.
- [ ] Alert routing and break-glass contacts tested.
- [ ] Evidence linked in `RELEASE_READINESS.md`; no real private data retained in drill artifacts beyond policy.
