# DataHub — Release Readiness

## Purpose and scope

This is the evidence ledger for deciding whether a specific DataHub build may be released. It covers documentation, product, quality, security, infrastructure and real-world verification. It does not replace test reports or human approvals.

## Current verdict

**NOT READY — documentation baseline and Phase A foundation verified; product implementation incomplete.** Local production images, dependency health, automatic migration, readiness and background-queue smoke tests have passed. No staging or production deployment, complete product workflow, release security evidence or production URL is claimed.

## Status vocabulary

- **Verified:** executed evidence exists for the named build/environment.
- **Implemented, unverified:** code/config exists but required evidence does not.
- **Blocked:** requires missing external access or authority.
- **Awaiting approval:** human legal/business/security decision.
- **Not completed:** required work does not exist.

## Gate checklist

| Gate | Current state | Required evidence |
|---|---|---|
| 35 mandatory documents | Verified | `PROJECT_STATUS.md` 35/35; 239 unique requirements; generated API/auth contracts synchronized |
| Phase A foundation | Verified | Locked dependencies; API/web images; healthy Compose dependencies; migration at head; readiness and Celery probe passed |
| Requirements traceability | Draft exists | Every release requirement maps to design, implementation and passed test |
| Core product workflows | Not completed | Passed TC-CRIT-001–020 on release build |
| Authorization/resource isolation | Not completed | Automated role matrix and horizontal-access report |
| Financial integrity | Not completed | arithmetic, zero-sum, idempotency, race and reconciliation evidence |
| Upload/file safety | Not completed | resume, hash, malware fail-closed, archive abuse and private-link evidence |
| Annotation/editor/export | Not completed | real controlled-document E2E and export manifest validation |
| Accessibility/responsive UI | Not completed | axe plus manual keyboard/zoom/Khmer/viewports report |
| Security | Not completed | reviewed SAST/dependency/container/DAST results; no blocking findings |
| Performance/reliability | Not completed | signed load and fault-injection report meeting targets |
| Backup/restore | Not completed | isolated restore report meeting RPO/RTO and integrity checks |
| Staging deployment | Blocked / not completed | HA-05 access, healthy staging URL and smoke/E2E results |
| Legal/privacy/IP/tax | Awaiting approval | recorded HA-01–04 approvals and policy versions |
| Payout/labeled upgrade policy | Awaiting approval | HA-07 and HA-08 owner decisions |
| Production deployment | Blocked / not completed | credentials/domain, approved release, migration/health/rollback evidence |

## External blockers and approvals

- HA-01 Terms, Privacy Policy and Contributor Agreement: legal counsel.
- HA-02 licence model and HA-03 applicable privacy jurisdictions: legal counsel/owner.
- HA-04 tax, withholding and KYC thresholds: finance/legal.
- HA-05 hosting, domain/DNS, SMTP, storage and monitoring credentials: owner.
- HA-07 dual-payout approval threshold and HA-08 labeled-upgrade policy: owner/finance.

## Release evidence record

For each candidate add build SHA/tag, artifact digests/SBOM, migration revision, staging URL, test report links, scan disposition, backup/restore drill, approvers, deployment time, production URL, smoke results, monitoring observation window and rollback decision. Never replace an earlier record; append a dated candidate section.

## Go/no-go rule

Release is **NO-GO** while any critical workflow, authorization, financial, file-safety, restore or legal gate is incomplete; while a severity-1/2 defect or critical/high exploitable vulnerability is open; or while rollback/monitoring/backup cannot be demonstrated. Only the authorized owner may approve production after all technical gates are verified and human approvals are recorded.
