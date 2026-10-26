# ADR-0014: Postgres-backed RBAC with permission codes

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0014 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "Postgres-backed RBAC with permission codes" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-08.
- **Decisions.** This ADR (ADR-0014). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §6; HLD §6; AUTH_AUTHORIZATION.md.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

Five roles (`contributor`, `annotator`, `reviewer`, `admin`, `super_admin`), users can hold several, and permissions must be enforced consistently in the API with resource-level checks and separation of duties. Super admins must be able to adjust role-permission mappings without a code deploy.

## Decision

Store roles in `roles` with `permissions text[]` of permission codes (e.g. `dataset.review`, `payout.approve`) and assignments in `user_roles (user_id, role_id)`. Endpoints declare `Depends(require("<code>"))`; services perform resource checks (ownership, assignment, reviewer assignee) and separation-of-duty checks. Admin endpoints additionally require `mfa_verified_at` on the session. Role changes are audited and take effect on the next request.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Hard-coded role checks in code | Simple but brittle; every policy change needs a deploy; roles leak into business logic. |
| Policy engine (OPA, Casbin, Cerbos) | Powerful ABAC, but another component and language for a small fixed permission set. |
| Postgres row-level security | Strong isolation, but complex with a pooled app role and cross-cutting admin queries. |

## Tradeoffs

+ Permission codes give a stable vocabulary shared by API docs, tests and UI gating.
+ Data-driven mappings, auditable changes.
− Resource-level rules still live in services and need dedicated tests.
− Misconfigured role permissions could over-grant; `role.manage` is super_admin only and audited.

## Consequences

- Seed migration creates the baseline §6 matrix.
- The UI hides actions by permission but the API is the enforcement point.
