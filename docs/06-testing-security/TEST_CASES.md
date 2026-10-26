# DataHub — Test Cases & Acceptance Testing

## Document control

| Field | Value |
|---|---|
| Purpose | Provide executable acceptance cases for critical DataHub behavior. |
| Scope | Identity, datasets, upload/processing, review, finance, annotation, messaging, exports, security, accessibility and recovery. |
| Assumptions | Synthetic accounts and content; external transfers are observed manual actions and are never initiated by DataHub. |
| Decisions | `TC-CRIT-*` blocks release; requirement identifiers refer to the SRS; automation IDs become stable test names. |
| Dependencies | `TEST_PLAN.md`, SRS, OpenAPI, state machines, pricing policy and security controls. |
| Acceptance criteria | Each critical requirement has positive and negative coverage, expected result and evidence location. |

## 1. Execution record fields

Each run records build SHA, environment, case ID, timestamp, actor, fixture version, result, evidence URI, defect ID and tester. “Not run” and “blocked” are not passes.

## 2. Critical workflow cases

| ID | Requirement links | Preconditions / action | Expected result |
|---|---|---|---|
| TC-CRIT-001 Registration | SRS identity/auth requirements | Submit valid unique email/password, accept current agreement; verify one-time token | Account starts `pending_email`, verification activates it, token replay fails, audit/security events exist |
| TC-CRIT-002 Login/session | SRS-SEC auth | Login, rotate session, logout, reuse old cookie | Argon2id verified; cookie secure settings applied; old/revoked session is rejected |
| TC-CRIT-003 Admin MFA | SRS-SEC, RBAC | Admin without MFA calls privileged route, then completes TOTP | First call denied; second authorized according to permission; events audited |
| TC-CRIT-004 Horizontal isolation | SRS permissions | Contributor A guesses B's dataset/file/message IDs and signed-download route | 404/denial reveals no private metadata and no URL; attempt logged where specified |
| TC-CRIT-005 Multipart resume | upload reliability | Upload several parts, interrupt, query status, resend only missing parts, complete | Confirmed parts retained, completion is idempotent, bytes/hash match exactly |
| TC-CRIT-006 Type and malware | SRS file safety | Upload spoofed extension and EICAR fixture; simulate clamd unavailable | Spoof rejected; infected quarantined; unavailable scan never becomes payable/previewable |
| TC-CRIT-007 Archive safety | SRS file safety | ZIP includes `../`, absolute path, excessive ratio and nested ZIP | Unsafe members rejected without traversal; bounded resources; container earns zero |
| TC-CRIT-008 Duplicate | pricing/quality requirements | Approve hash once, submit identical bytes again | Exact duplicate flagged before review; second approval produces no dataset earning |
| TC-CRIT-009 Partial review | review/finance | Accept some clean files and reject corrupt/duplicate files; finalize twice | Accepted bytes equal eligible accepted files only; feedback/history preserved; one earning journal |
| TC-CRIT-010 Arithmetic | finance requirements | Approve boundary byte counts at versioned raw/labeled rates | Integer micro-USD formula floors per file exactly; stored pricing rule is immutable |
| TC-CRIT-011 Concurrent approval | financial integrity | Two transactions finalize same review simultaneously | One succeeds/equivalent response; one idempotent conflict/result; exactly one zero-sum journal |
| TC-CRIT-012 Concurrent withdrawal | payout requirements | Two requests race against one available balance | Wallet row lock permits no overspend; one reservation at most; available/reserved non-negative |
| TC-CRIT-013 Payout lifecycle | payout requirements | Eligible user requests; required distinct admins approve; recorder supplies external reference | Funds reserve once; SoD enforced; only explicit confirmation marks paid; audit/evidence linked |
| TC-CRIT-014 Payout failure | payout requirements | Reject requested payout; separately fail approved payout | Reserved amount releases once to available; retries do not duplicate release |
| TC-CRIT-015 Annotation conflict | annotation requirements | Two clients save same base version | First creates version; second receives 409 and retains recoverable draft; no overwrite |
| TC-CRIT-016 Annotation reward | annotation/finance | Reviewer approves submitted task twice | Task approved; exactly one separate annotation reward journal; dataset price unaffected |
| TC-CRIT-017 Messaging ACL | messaging requirements | Participant and non-participant fetch/post conversation and attachment | Participant succeeds; outsider denied; attachment scanned and private; read state durable |
| TC-CRIT-018 Export ACL | export requirements | Admin exports approved selection; contributor guesses job/object URL | Background package has manifest/lineage; expiring private link only for authorized admin; audit row exists |
| TC-CRIT-019 Restore | availability/recovery | Restore selected DB backup and object version set in isolation | Migration head, counts, FK checks, zero-sum ledger, sampled SHA-256 match within RPO/RTO |
| TC-CRIT-020 End-to-end | all core FRs | Execute TEST_PLAN §8 scenarios | Every state, notification and audit effect matches the normative lifecycle |

## 3. Identity and authorization boundary cases

| ID | Scenario | Expected result |
|---|---|---|
| TC-ID-001 | Duplicate normalized email | 409; no second account or verification mail |
| TC-ID-002 | Expired/used verification or reset token | Generic rejection; token digest only in DB; no account enumeration |
| TC-ID-003 | Repeated bad password | Progressive/rate limit and security event; valid login behavior follows lock policy |
| TC-ID-004 | Suspended user with existing session | Session denied/revoked; private objects cannot be presigned |
| TC-AZ-001 | Annotator opens unassigned task | Non-disclosing denial |
| TC-AZ-002 | Reviewer reviews own contribution/annotation | Separation-of-duties denial |
| TC-AZ-003 | Admin attempts super-admin pricing/role/settings action | 403; no mutation; audit/security event where required |
| TC-AZ-004 | CSRF absent/wrong and cross-origin unsafe request | 403 before mutation |

## 4. Upload, processing and review boundaries

| ID | Scenario | Expected result |
|---|---|---|
| TC-UP-001 | 0-byte, configured 4 GB boundary, and 4 GB + 1 byte | Policy-consistent validation at initiation and completion |
| TC-UP-002 | Dataset/user quota races | Atomic enforcement; no over-quota committed session |
| TC-UP-003 | Abandoned session past 24 h | Multipart aborted and temporary objects removed; durable audit/job evidence |
| TC-UP-004 | Client lies about parts/ETags | Object store remains authority; completion rejected without trusted match |
| TC-UP-005 | Preview parser crashes/timeouts | Worker retry bounded; file failed/quarantined safely; raw content never executed |
| TC-RV-001 | Finalize with nonterminal/unscanned file | 409; no final state or earning |
| TC-RV-002 | Request changes then resubmit | New dataset version, old immutable review/history retained |
| TC-RV-003 | Near duplicate | Warning shown; reviewer decision explicit; exact-duplicate rules unaffected |

## 5. Financial boundary cases

| ID | Scenario | Expected result |
|---|---|---|
| TC-FI-001 | 1 byte at each rate | Formula returns floored integer micros; never float |
| TC-FI-002 | Payout below min, above max, fractional cent, above available | 422/409; no ledger lines |
| TC-FI-003 | Same Idempotency-Key, same/different payload | Same result for same payload; conflict for changed payload |
| TC-FI-004 | Duplicate payment reference per method | Rejected by validation/unique constraint; request remains recoverable |
| TC-FI-005 | Journal lines do not sum to zero | Deferred database constraint rejects commit |
| TC-FI-006 | Update/delete ledger line or pricing rule in use | Database rejects mutation |
| TC-FI-007 | Raw content later submitted labeled | Default differential only when HA-08-approved flag/policy applies; never full duplicate payment |
| TC-FI-008 | Nightly reconciliation detects cache mismatch | Alert/security-operational record; no silent repair unless approved runbook action |

## 6. Annotation, messages, notifications and exports

| ID | Scenario | Expected result |
|---|---|---|
| TC-AN-001 | Autosave offline then reconnect | Local draft retained; server version checked; clear save state |
| TC-AN-002 | Submit missing required transcription/classification | 422 with field errors; remains editable |
| TC-AN-003 | Changes requested and corrected | Version history and reviewer feedback retained; legal transition only |
| TC-AN-004 | Khmer combining characters and zero-width policy | Exact typed transcription round-trips UTF-8 without unintended normalization |
| TC-MSG-001 | Stored-XSS payload in message | Rendered as inert text/sanitized allowed content; CSP holds |
| TC-NT-001 | Transaction commits but mail provider fails | Durable outbox retries; in-app notification exists; API mutation not rolled back |
| TC-EX-001 | Export worker retried after partial ZIP | Idempotent replacement/finalization; no public partial artifact |
| TC-EX-002 | Export expires | Object/link unavailable after retention; audit metadata retained |

## 7. UI, responsive and accessibility cases

| ID | Viewports / action | Expected result |
|---|---|---|
| TC-UI-001 | Required routes at 360×800, 768×1024, 1440×900 | No unintended horizontal overflow; navigation and primary actions usable |
| TC-UI-002 | Keyboard-only registration, upload, review, payout, editor | Logical focus, visible indicator, traps/restoration correct, no keyboard dead end |
| TC-UI-003 | axe on all route templates | No critical/serious violation; documented review of moderate findings |
| TC-UI-004 | 200% zoom and long Khmer labels | Content reflows; text not clipped; essential controls remain operable |
| TC-UI-005 | Loading/empty/network error/403/404/500/503 | Correct, actionable state without leaking sensitive details |
| TC-UI-006 | Destructive/financial action | Confirmation names target and amount; cancel safe; duplicate submit disabled/idempotent |

## 8. Performance, failure and operations cases

| ID | Load/fault | Expected result |
|---|---|---|
| TC-OP-001 | 200 active sessions and normal read mix | p95 < 300 ms, p99 < 1,000 ms and <0.5% application error excluding injected faults |
| TC-OP-002 | 50 concurrent multipart uploads | API remains responsive; no API byte proxying; success/resume metrics recorded |
| TC-OP-003 | Redis restart during queued work | Durable job semantics/retries recover; idempotency prevents duplicate effects |
| TC-OP-004 | Worker killed after side effect before ack | Replay converges to one side effect |
| TC-OP-005 | Database unavailable | Health readiness fails, bounded timeouts, no misleading success |
| TC-OP-006 | Disk/storage warning | Alert fires before exhaustion; uploads safely rejected when capacity policy reached |
| TC-OP-007 | Production rollback rehearsal | Previous immutable images start; schema compatibility/forward-fix plan succeeds |

## 9. Traceability and acceptance

The detailed SRS-to-test mapping is maintained in `../REQUIREMENTS_TRACEABILITY.md`; it may reference these stable IDs or more granular automated names. Release acceptance requires executed evidence for every `TC-CRIT-*`, not merely this specification. Human/legal approvals HA-01–HA-08 cannot be satisfied by software tests and remain explicit release blockers until recorded.
