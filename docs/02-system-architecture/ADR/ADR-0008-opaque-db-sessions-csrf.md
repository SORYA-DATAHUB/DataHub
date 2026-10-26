# ADR-0008: Opaque DB-backed sessions in HttpOnly cookies with double-submit CSRF instead of JWT

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0008 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "Opaque DB-backed sessions in HttpOnly cookies with double-submit CSRF instead of JWT" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-13.
- **Decisions.** This ADR (ADR-0008). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §3 (Auth); HLD §6; AUTH_AUTHORIZATION.md.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

Requirements include session expiry, revocation (single session, all others, admin revoke), admin MFA state per session, and protection against token theft via XSS. The app and API share one origin (ADR-0003).

## Decision

Issue a 256-bit random opaque token in cookie `dh_session` (`HttpOnly; Secure; SameSite=Lax; Path=/`); store only its SHA-256 in `user_sessions` with user, IP, user agent, `expires_at`, `revoked_at`, `mfa_verified_at`. Every request looks up the session (indexed hash). Unsafe methods require CSRF double-submit: cookie `dh_csrf` (readable by JS) must equal header `X-CSRF-Token`, plus an `Origin`/`Referer` check. Passwords use Argon2id; TOTP (pyotp) is mandatory for admin and super_admin. Sessions rotate on login, MFA verification and password change.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| JWT access + refresh tokens | Stateless verification, but revocation needs a denylist (state anyway), tokens in JS storage are XSS-exposed, and per-session MFA state is awkward. |
| JWT in HttpOnly cookie | Avoids JS exposure but still hard to revoke immediately and larger cookies; no benefit at our scale. |
| External IdP (Keycloak, Auth0) | Feature-rich, but extra service or vendor cost and data residency questions for a single-organisation v1. |

## Tradeoffs

+ Immediate revocation and per-session MFA state; token theft from DB is useless (hash only).
+ HttpOnly cookie not readable by injected scripts.
− One indexed DB lookup per request (≈ sub-millisecond; can be cached in Redis for a few seconds if needed).
− CSRF protection must be implemented explicitly (double-submit + Origin check).

## Consequences

- WebSocket upgrade authenticates via the same cookie plus an Origin allow-list.
- Rate limiting and lockout on auth endpoints are recorded in `security_events`.
