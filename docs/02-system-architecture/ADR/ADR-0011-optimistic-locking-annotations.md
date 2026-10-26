# ADR-0011: Optimistic locking for annotation drafts

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0011 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "Optimistic locking for annotation drafts" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-02, A-14.
- **Decisions.** This ADR (ADR-0011). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §11; SDD §7.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

Annotators autosave frequently; the same task can be open in two tabs or devices, and admins can reassign tasks. Work must never be silently overwritten (MASTER Part 12). Hard locks with leases are fragile with autosave and closed tabs.

## Decision

`annotations` has one row per task with an integer `version`. `PUT /annotation/tasks/{id}/draft` requires `If-Match: <version>`; the update is `UPDATE … SET data=:data, version=version+1 WHERE task_id=:id AND version=:v`. Zero rows → `409 version_conflict` returning the server copy and version; the editor shows a comparison and lets the user choose. Only the active assignee may write. Each save that changes the content hash inserts `annotation_versions` (last 50 drafts kept, all submitted versions kept). Submit also requires `If-Match`.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Pessimistic task lock with lease/heartbeat | Prevents conflicts but locks get stuck on crashed tabs and need admin unlocks. |
| Last-write-wins | Simple, loses work. |
| Real-time collaborative editing (CRDT/OT) | Unnecessary for single-assignee tasks; heavy. |

## Tradeoffs

+ No lost updates; no stuck locks.
+ Version history doubles as draft recovery.
− Users occasionally see a conflict dialog (mostly with two tabs).
− Version rows grow; compacted to last 50 drafts.

## Consequences

- Transcription text is stored verbatim (no NFC) and compared byte-exact for hashing.
- Same pattern reused for `system_settings` edits.
