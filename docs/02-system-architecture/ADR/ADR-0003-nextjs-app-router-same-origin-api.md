# ADR-0003: Next.js App Router with same-origin /api proxy

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0003 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "Next.js App Router with same-origin /api proxy" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-02.
- **Decisions.** This ADR (ADR-0003). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §3; HLD §1.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

The UI is large (public, contributor, annotator, reviewer, admin areas) and needs a modern component ecosystem (shadcn/ui, TanStack Query, React Hook Form). Authentication uses HttpOnly cookies (ADR-0008); cookies must be first-party and CSRF exposure minimal. Cross-origin API calls would need permissive CORS with credentials and `SameSite=None` cookies.

## Decision

Use Next.js 15 App Router with React 19 and TypeScript 5. The browser always calls the API on the **same origin** under `/api/v1`: in development Next.js `rewrites` proxy `/api/*` to `datahub_api`; in production Caddy routes `/api/*` (including WebSocket upgrades) directly to `datahub_api` and everything else to `datahub_web`. Next.js holds no business logic or DB access; Server Components may call the internal API URL forwarding the user's cookie. API types are generated from OpenAPI into `packages/shared`.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Separate API subdomain with CORS | Requires `SameSite=None` or shared parent-domain cookies and credentialed CORS; larger CSRF surface and more config. |
| Next.js Route Handlers as a BFF proxying every call | Extra hop and duplicated error handling; still needs an internal API; complicates WebSocket and streaming. |
| Vite SPA served by Caddy | Simpler build, but loses server components for public pages, `next/font` self-hosting and file-based routing conventions. |

## Tradeoffs

+ First-party `SameSite=Lax` cookies work everywhere; no CORS for the app.
+ One public origin simplifies CSP and TLS.
− Dev and prod route the API differently (rewrite vs Caddy); covered by E2E tests in both modes.
− Next.js rewrites do not proxy WebSockets reliably in dev; the dev WS client connects via the rewrite path when supported and otherwise directly to `ws://localhost:8410/api/v1/ws` with the API cookie domain `localhost`.

## Consequences

- `NEXT_PUBLIC_*` variables contain no secrets.
- CSP `connect-src` lists self and the S3 public endpoint only.
