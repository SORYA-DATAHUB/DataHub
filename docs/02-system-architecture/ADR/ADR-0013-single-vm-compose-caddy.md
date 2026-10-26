# ADR-0013: Single-VM Docker Compose with Caddy for production (no Kubernetes)

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0013 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "Single-VM Docker Compose with Caddy for production (no Kubernetes)" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-03.
- **Decisions.** This ADR (ADR-0013). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** MASTER Parts 6, 23; SAD §8–9; DEPLOYMENT_PLAN.md.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

Initial load (A-03) fits comfortably on one server. Availability target is 99.5 % monthly, RTO 4 h, RPO 24 h. The team is small and MASTER Part 6 forbids Kubernetes without justification. HTTPS must be automatic, and object storage should be managed to protect 20 TB of data independently of the VM.

## Decision

Run production on one Linux VM with Docker Compose: `datahub_caddy` (Caddy 2, automatic HTTPS, the only public listener on 80/443), `datahub_web`, `datahub_api`, `datahub_worker`, `datahub_beat`, `datahub_postgres`, `datahub_redis`, `datahub_clamav`. Object storage is managed (R2 or S3); email via SMTP provider. Images are versioned by git SHA; migrations run as a one-off container before restart. Nightly `pg_dump` goes to a separate backup bucket; storage versioning protects objects.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Kubernetes (managed) | Self-healing and rolling deploys, but high operational complexity and cost for one small app. |
| PaaS (Render, Fly.io, Railway) | Less ops, but limits on long-running workers, private networking, ClamAV memory and cost at multi-TB data scale. |
| Multiple VMs from day one | Higher availability, but more cost and orchestration than A-03 requires. |

## Tradeoffs

+ Low cost and simple mental model; identical topology to dev compose.
+ Caddy handles certificates and HTTP/2/3 with minimal config.
− VM is a single point of failure; RTO 4 h relies on documented rebuild + restore.
− Rolling deploys cause brief restarts; mitigated by health checks and short restarts during low traffic.

## Consequences

- Firewall exposes only 80/443 and SSH from admin IPs.
- Scaling path to split workers, multiple API replicas and managed Postgres is documented in SAD §9.
