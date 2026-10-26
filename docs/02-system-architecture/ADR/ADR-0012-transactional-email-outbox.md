# ADR-0012: Transactional outbox for email

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0012 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "Transactional outbox for email" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-12.
- **Decisions.** This ADR (ADR-0012). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §13 (`messaging.send_email`); SDD §8.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

Important events (email verification, password reset, dataset decisions, payout updates) must reach users by email even when the browser is closed. Sending email inside the request transaction couples latency and failures to the SMTP provider; sending after commit can lose the email if the process crashes; enqueuing before commit can send email for rolled-back changes.

## Decision

Write an `email_outbox` row (recipient, template, context, status `pending`) **in the same transaction** as the business change and its `notifications` row. After commit, enqueue `messaging.send_email(outbox_id)` on the `email` queue. The worker claims the row (`FOR UPDATE SKIP LOCKED`, status `pending`), renders and sends via SMTP with `Message-ID` derived from the outbox id, then marks `sent`; transient failures retry with backoff up to 8 attempts, then `failed` with alert. A periodic sweep re-enqueues rows left `pending` (SDD §8).

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Send synchronously in the request | Simple, but slow requests and lost business transactions when SMTP fails. |
| Enqueue Celery task without outbox | Can lose emails between commit and enqueue, or send emails for rolled-back changes. |
| Provider-specific API with webhooks | Richer tracking, but vendor lock-in; A-12 requires any SMTP. |

## Tradeoffs

+ Email intent is durable and consistent with business data.
+ Admin visibility of failed emails.
− At-least-once delivery: rare duplicates possible (mitigated by stable Message-ID).
− One extra table and a sweep job.

## Consequences

- No document content or secrets in email bodies; links point back to the app.
- Notification preferences are checked when the outbox row is created.
