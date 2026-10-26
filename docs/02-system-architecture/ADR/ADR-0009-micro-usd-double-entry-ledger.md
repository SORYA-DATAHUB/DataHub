# ADR-0009: Integer micro-USD amounts and an append-only double-entry ledger

## Document control

| Field | Value |
|---|---|
| ADR | ADR-0009 |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Accepted (2026-10-26) |
| Document status | Baseline |
| Deciders | CTO role |
| Canonical source | [`../../ENGINEERING_BASELINE.md`](../../ENGINEERING_BASELINE.md) |

## Header

- **Purpose.** Record the decision "Integer micro-USD amounts and an append-only double-entry ledger" with its context, alternatives and consequences.
- **Scope.** DataHub v1 architecture; applies to all environments unless stated.
- **Assumptions.** A-04, A-06, A-07.
- **Decisions.** This ADR (ADR-0009). Related ADRs are listed in [README.md](README.md).
- **Dependencies.** Baseline §8; SDD §5, §6, §11.
- **Acceptance criteria.** Implementation and all architecture documents (SAD, HLD, LLD, SDD, DFD) are consistent with the Decision section; any deviation requires a superseding ADR and a `DECISION_LOG.md` entry.

---

## Status

Accepted — 2026-10-26.

## Context

Contributors earn $1.00/GB (raw) and $1.50/GB (labeled) on accepted bytes; annotators earn per task/page; payouts are manual. Requirements: exact arithmetic, separate estimated/pending/approved/available/reserved/paid/adjustment figures, traceability to source events, no duplicate earnings on retries, no double-spending under concurrent withdrawals.

## Decision

Store all amounts as integer micro-USD (`BIGINT`, 1 USD = 1,000,000); rates as `rate_micros_per_gb`; compute `floor(bytes × rate / 1e9)` per file with Python `int`. Record every movement as a journal in `ledger_journals` (unique `idempotency_key`, `kind`, `source_type`, `source_id`, `created_by`) with lines in `wallet_transactions(journal_id, wallet_id, bucket, amount_micros)`. User wallets have buckets `pending`, `available`, `reserved`, `paid`; system wallets (`system_dataset_purchases`, `system_annotation_labor`, `system_adjustments`, `system_payouts_settled`) use `main`. A deferred constraint trigger enforces Σ lines = 0 per journal; triggers block UPDATE/DELETE. Cached balances on `wallets` are updated in the same transaction after `SELECT … FOR UPDATE`; `finance.reconcile` verifies them nightly.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Decimal/NUMERIC amounts | Exact, but easy to mix with floats in Python/JS and rounding rules get scattered; integers are simpler and faster. |
| Mutable balance columns only | Simple, but no audit trail, impossible to reconcile, retries can double-credit. |
| Single-entry transaction log | Traceable, but no structural guarantee that money is conserved between buckets. |
| External ledger service (e.g. TigerBeetle) | Very robust, but an extra system without need at our scale. |

## Tradeoffs

+ Money conservation is a database-level invariant; every balance is explainable by lines.
+ Idempotency keys make finalize/payout retries safe.
− More rows and more complex queries for balance history; mitigated by cached balances.
− Corrections are new journals (adjustments, reversals), never edits — operators need training.

## Consequences

- Idempotency keys: `dataset_review:{review_id}:earning`, `annotation_review:{review_id}:reward`, `payout:{payout_id}:reserve|release|settle|reversal`, `adjustment:{adjustment_id}`.
- Payout amounts must be multiples of 10,000 micros (whole cents).
