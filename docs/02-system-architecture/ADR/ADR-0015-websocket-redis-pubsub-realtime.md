# ADR-0015: WebSocket with Redis pub/sub for realtime events

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0015 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "WebSocket with Redis pub/sub for realtime events" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-03.
- **Decisions.** This ADR (ADR-0015). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §12 (Messaging); HLD §7.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

Contributor–admin chat, support inbox and in-app notifications should appear in real time, messages must be durably stored, and the solution must work with multiple API processes or replicas.

## Decision

Expose `WS /api/v1/ws` from `datahub_api` (async endpoint, cookie auth + Origin check). Messages and notifications are **persisted in Postgres first**; after commit the producer publishes a small event (`message.created`, `notification.created`, `conversation.updated`) to Redis channel `user:{user_id}` for each recipient. Every API process subscribes for its connected users and forwards events. Clients refetch via REST on reconnect to fill gaps. Heartbeat pings every 25 s; reconnect with exponential backoff.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Server-Sent Events | Simpler one-way push, but still needs the same fan-out; WS keeps the door open for typing indicators and acknowledgements. |
| Polling | Simplest, but higher load and latency at 200 concurrent sessions. |
| Hosted realtime service (Pusher, Ably) | No infrastructure, but sends message metadata to a third party and adds cost. |
| Postgres LISTEN/NOTIFY | No Redis dependency, but ties up DB connections per API process and has payload limits. |

## Tradeoffs

+ Works across replicas without sticky sessions.
+ Durability from Postgres; Redis loss only delays delivery until refetch.
− Pub/sub is fire-and-forget; correctness depends on refetch-on-reconnect.
− Long-lived connections count against API process limits; monitored.

## Consequences

- Session revocation publishes on `session:{session_id}` so open sockets close.
- Caddy must pass WebSocket upgrades on `/api/v1/ws`.
