# DataHub

DataHub is a private data-acquisition, dataset review, annotation and manual contributor-payment platform. Contributors submit authorized documents; reviewers accept eligible unique bytes; the platform records versioned earnings; administrators manage manual payouts; and annotators complete reviewed, separately rewarded tasks.

> **Current state:** the 35-document baseline and Phase A foundation are complete. The verified local stack includes the web/API foundations, PostgreSQL, Redis, private S3-compatible storage, ClamAV, Mailpit, Celery worker/beat and automatic Alembic migrations. Product features begin in Phase B and the release remains NO-GO. See [project status](docs/PROJECT_STATUS.md) and [release readiness](docs/RELEASE_READINESS.md).

## Architecture and stack

The approved v1 architecture is a modular monolith: Next.js 15/React 19/TypeScript frontend; FastAPI/Pydantic/SQLAlchemy/Alembic backend; PostgreSQL 17; Redis 8 and Celery 5; private S3-compatible storage (SeaweedFS locally, R2 or S3 in production); ClamAV; SMTP; Caddy; Docker Compose. Financial values are integer micro-USD in an append-only balanced ledger. Files upload directly to private object storage through resumable multipart URLs and remain unavailable for payment until safe processing and review.

Monorepo layout:

```text
apps/web/                 Next.js application
apps/api/                 FastAPI application, workers, migrations and tests
packages/shared/          generated API types and shared constants
infrastructure/           Docker, deployment and monitoring configuration
tests/e2e/                Playwright journeys
scripts/                  administration, backup, restore and validation tools
docs/                     normative product and engineering documentation
```

## Documentation-first gate

No application code may be started until all 35 mandatory documents are reviewed, internally consistent, traced and marked complete in `docs/PROJECT_STATUS.md`. The canonical decisions are [ENGINEERING_BASELINE.md](docs/ENGINEERING_BASELINE.md); unresolved human approvals include legal terms, privacy/jurisdiction, tax/KYC, production accounts, payout dual control and labeled-upgrade policy.

Core references:

- [Business requirements](docs/01-business-product/BRD.md), [product requirements](docs/01-business-product/PRD.md), [SRS](docs/01-business-product/SRS.md), and [user stories](docs/01-business-product/USER_STORIES.md)
- [Architecture](docs/02-system-architecture/SAD.md), [database schema](docs/02-system-architecture/DATABASE_SCHEMA.md), [ERD](docs/02-system-architecture/ERD.md), and [ADRs](docs/02-system-architecture/ADR/README.md)
- [API guide](docs/04-backend-api/API_DOCUMENTATION.md) and [OpenAPI 3.1 contract](docs/04-backend-api/openapi.yaml)
- [Test plan](docs/06-testing-security/TEST_PLAN.md), [security requirements](docs/06-testing-security/SECURITY_REQUIREMENTS.md), and [threat model](docs/06-testing-security/THREAT_MODEL.md)
- [Deployment](docs/07-deployment-operations/DEPLOYMENT_PLAN.md), [Docker/CI](docs/07-deployment-operations/DOCKER_CICD.md), and [backup/DR](docs/07-deployment-operations/BACKUP_DISASTER_RECOVERY.md)

## Prerequisites

- Docker Engine 27+ with Compose v2
- Git
- Optional native development: Node.js 22, pnpm 10, Python 3.13 and `uv`
- At least 12 GB RAM and 20 GB free disk for the complete local stack and test fixtures

Never use production documents, credentials, payment evidence or identities in local development.

## Environment setup

1. Copy `.env.example` to `.env` and replace development-only random secrets. Never commit `.env`.
2. Start services: `docker compose up -d --build`.
3. Check health: `docker compose ps` and open web `http://localhost:3410`, API docs `http://localhost:8410/docs`, Mailpit `http://localhost:8425`.
4. Compose runs `alembic upgrade head` through the one-shot `migrate` service before the API and worker start. Verify with `docker compose exec api alembic current`.
5. Initial-administrator creation is a Phase B deliverable. No default administrator or test identity is seeded.

Approved local host ports are web 3410, API 8410, PostgreSQL 5440, Redis 6390, S3 9410/9411 and Mailpit 8425/1035. ClamAV is internal only.

## Development commands

```bash
docker compose up -d --build
docker compose logs -f api worker web
docker compose exec api alembic current
(cd apps/api && uv sync --all-groups && uv run ruff check src tests && uv run mypy src && uv run pytest)
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @datahub/web lint
corepack pnpm --filter @datahub/web typecheck
corepack pnpm --filter @datahub/web test -- --run
corepack pnpm --filter @datahub/web build
python scripts/verify_docs.py
docker compose down
```

These Phase A commands are verified. Data volumes are intentionally retained by ordinary `docker compose down`; deleting volumes is destructive and is never part of routine setup.

## Service startup without Compose

- Backend: from `apps/api`, install the locked `uv` environment, apply Alembic migrations and run the FastAPI app on port 8410.
- Worker/beat: from the same environment, run the declared Celery app with separate worker and beat processes.
- Frontend: from `apps/web`, install the frozen pnpm lockfile and start Next.js on port 3410 with `/api` rewritten to the backend.
- PostgreSQL, Redis, S3, ClamAV and SMTP remain required dependencies; use Compose for the supported local configuration.

## Tests

The release suite includes pytest unit/integration/API tests against real PostgreSQL, Vitest/Testing Library/axe component tests, Playwright end-to-end journeys, OpenAPI and migration validation, dependency/container scans, performance tests, multipart interruption tests, financial race tests and isolated backup restoration. A test is not “passed” until executed against a named build and recorded in project/release status.

## Production deployment

The recommended initial topology is a hardened single compute VM in Singapore plus managed private R2/S3, Caddy HTTPS, monitored PostgreSQL backup, SMTP, Sentry and Prometheus-compatible monitoring. Kubernetes is intentionally excluded. Follow the [Deployment Plan](docs/07-deployment-operations/DEPLOYMENT_PLAN.md); production requires owner-provided hosting/domain/provider access (HA-05), approved legal/payout policies, immutable release artifacts, staging E2E/security checks, a successful restore drill and manual production approval. Never run unreviewed migrations or claim the site is live without URL smoke verification.

## Security notes

Uploaded content is hostile: never execute it, expose buckets publicly or bypass ClamAV. Secrets belong in the environment/secret manager. Administrators require MFA; backend authorization and resource scoping are mandatory. DataHub does not initiate real transfers in v1—an authorized administrator records a separately completed external payment. Report suspected vulnerabilities privately to the project owner; do not include private data or secrets in an issue.

## Operating guides

- [Administrator guide](docs/08-user-documentation/ADMIN_GUIDE.md)
- [Contributor guide](docs/08-user-documentation/CONTRIBUTOR_GUIDE.md)
- [Annotator guide](docs/08-user-documentation/ANNOTATOR_GUIDE.md)
- [Reviewer guide](docs/08-user-documentation/REVIEWER_GUIDE.md)

## Troubleshooting

- Unhealthy API: check PostgreSQL/Redis readiness, migrations and redacted API logs.
- Processing stuck: verify worker queue, ClamAV and object-storage access; do not manually mark a file clean.
- Upload completion rejected: compare the authoritative multipart part list and ETags; resume missing parts.
- Email absent: inspect the durable outbox and Mailpit/provider response; do not roll back the committed business event.
- Ledger mismatch: stop affected financial mutations and follow the reconciliation incident runbook; never edit ledger rows.
- Restore/deployment failure: enter maintenance mode and follow the documented rollback/DR procedure.

## License and legal status

Repository source licensing has not yet been selected by the project owner. Product Terms, Privacy Policy and Contributor Agreement are drafts requiring qualified legal review before public launch. No licence to third-party submitted data is implied by this repository.
