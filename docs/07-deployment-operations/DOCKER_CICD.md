# DataHub — Docker & CI/CD Documentation

## Document control

| Field | Value |
|---|---|
| Document ID | DH-OPS-CICD (mandatory document #33) |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Baseline — describes the **planned** implementation; updated when the code lands |
| Owner | DevOps role (CTO role approves) |
| Canonical source | [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) (§3 stack, §4 layout, §5 ports, §16 AM-01…AM-14) |
| Related | [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md) · [BACKUP_DISASTER_RECOVERY.md](BACKUP_DISASTER_RECOVERY.md) · [SAD](../02-system-architecture/SAD.md) · [HLD](../02-system-architecture/HLD.md) · [ADR-0013](../02-system-architecture/ADR/ADR-0013-single-vm-compose-caddy.md) · [RELEASE_READINESS.md](../RELEASE_READINESS.md) |

## Header

- **Purpose.** Specify how DataHub is containerised, configured, built, tested, scanned, versioned, released and rolled back, so that the Dockerfiles, `compose.yaml`, `infrastructure/deployment/compose.prod.yaml`, `.env.example` and the GitHub Actions workflows can be written directly from this document.
- **Scope.** Container images for `apps/api` (API, worker, beat, migrations share one image) and `apps/web`; the development Compose stack; the production Compose configuration; the environment variable reference; the CI workflow `.github/workflows/ci.yml` and the release workflow `.github/workflows/release.yml`; secrets handling; release tagging; rollback. Server provisioning, DNS, runbooks and monitoring thresholds are in [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md); backups are in [BACKUP_DISASTER_RECOVERY.md](BACKUP_DISASTER_RECOVERY.md).
- **Assumptions.** A-03 (initial scale fits one VM); A-12 (any SMTP provider); the development host has about **7.5 GB RAM** (R-07), so the dev stack must fit in ≈ 5.5 GB of container memory limits; GitHub is the code host and GitHub Container Registry (GHCR) the image registry; no application code exists yet (documentation phase).
- **Decisions.**
  - D-CI-01 One backend image (`datahub-api`) runs four process types: `api`, `worker`, `beat`, `migrate` (SAD §2).
  - D-CI-02 Images are built **once** per commit on `main`, tagged `sha-<git-sha>`, and **promoted** (re-tagged, not rebuilt) to `X.Y.Z` on release. Production always deploys by image **digest** (ADR-0013 "images versioned by git SHA").
  - D-CI-03 Production deploys only from a semver tag `vX.Y.Z` on `main`, through the GitHub Environment `production` with required reviewers — never automatically from a merge (MASTER Part 22).
  - D-CI-04 Web runtime is **Node.js 22 LTS** (`node:22-alpine`), as stated in SAD §3. Node.js 20 reached end of life on 2026-04-30 and is not used.
  - D-CI-05 The environment variable names in §4 are canonical; names used in earlier documents are mapped in §4.4 and must be aligned to these names in code.
  - D-CI-06 Container memory limits are mandatory in every Compose file (§3.3) so ClamAV or a Next.js build cannot exhaust a small host.
- **Dependencies.** ENGINEERING_BASELINE §3–§5, §13, AM-01 (clamd 4,000 MB limits), AM-10 (`admin.requeue_stalled`), AM-13 (object-storage backups); DATABASE_SCHEMA §8.4–§8.6 (expand/contract, migration tests); FILE_UPLOAD_STORAGE §17, §20 (lifecycle, CORS, `storage-setup`); AUTH_AUTHORIZATION §10 (admin CLI, `ADMIN_MFA_REQUIRED`); HA-05 (registry organisation, production credentials).
- **Acceptance criteria.**
  1. Every container in baseline §5 appears in §3 with image, port, healthcheck, volumes and memory limit.
  2. Every environment variable the application reads is listed in §4 with dev value, production source and secret flag.
  3. The CI pipeline covers all 12 MASTER Part 22 stages with a named job each; the release pipeline covers all 9 release steps.
  4. Production cannot be deployed without a human approval recorded in GitHub.
  5. Rollback to the previous release is a single documented command that needs no rebuild.
  6. No secret value appears in this document, in images, or in the repository.

---

## 1. Repository artefacts (planned)

| Path | Content |
|---|---|
| `compose.yaml` | Development stack (§3) |
| `.env.example` | Development defaults for every variable in §4 (no real credentials) |
| `infrastructure/docker/api.Dockerfile` | Backend image, multi-stage (§2.1) |
| `infrastructure/docker/web.Dockerfile` | Web image, multi-stage (§2.2) |
| `infrastructure/docker/clamav/clamd.conf` | clamd limits per AM-01 |
| `infrastructure/docker/seaweedfs/s3.json` | Development-only S3 identity (keys equal `.env.example`) |
| `infrastructure/deployment/compose.prod.yaml` | Production stack (§5) |
| `infrastructure/deployment/Caddyfile` | Reverse proxy and TLS (DEPLOYMENT_PLAN §6) |
| `infrastructure/deployment/deploy.sh` | Server-side deploy / rollback script (§8) |
| `infrastructure/deployment/storage/{cors.json,lifecycle.json}` | Bucket configuration (FILE_UPLOAD_STORAGE §17, §20) |
| `infrastructure/monitoring/prometheus.yml`, `alerts.yml`, `alertmanager.yml`, `grafana/datahub-overview.json` | Optional Compose profile `monitoring` |
| `scripts/create_admin.py` | Host wrapper for `python -m datahub.cli create-admin` |
| `scripts/backup.sh`, `scripts/restore.sh`, `scripts/restore_test.sh` | Backup and restore (BACKUP_DISASTER_RECOVERY.md) |
| `scripts/export_openapi.py` | Writes the live OpenAPI document for drift checks |
| `.github/workflows/ci.yml`, `.github/workflows/release.yml` | Pipelines (§6, §7) |
| `.github/dependabot.yml` | Weekly updates for `pip` (uv), `npm`, `docker`, `github-actions` |

## 2. Dockerfiles

### 2.1 `infrastructure/docker/api.Dockerfile`

Build context is the repository root. Stages:

| Stage | Base | Purpose |
|---|---|---|
| `base` | `python:3.13-slim-bookworm` | OS packages needed at runtime: `libmagic1` (python-magic), `ca-certificates`, `tini`. `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1`. |
| `builder` | `base` | Copies the pinned `uv` binary from `ghcr.io/astral-sh/uv` (explicit version tag). `uv sync --frozen --no-dev` into `/opt/venv` (dependency layer first, from `pyproject.toml` + `uv.lock` only, for cache reuse), then copies `src/`, `alembic/`, `alembic.ini` and installs the project. |
| `dev` | `builder` | `uv sync --frozen` (adds dev dependencies: pytest, ruff, mypy, import-linter). Source is bind-mounted by Compose; Uvicorn runs with `--reload`. Runs as uid 10001. |
| `runtime` | `base` | Copies `/opt/venv` and `/app` from `builder`. Creates group/user `datahub` **uid/gid 10001**, no shell, no home. `USER 10001:10001`. No compilers, no `uv`, no package manager cache. |

Runtime image contract:

```dockerfile
# runtime stage (abridged)
ARG DATAHUB_VERSION
ARG GIT_SHA
ENV PATH="/opt/venv/bin:${PATH}" DATAHUB_VERSION=${DATAHUB_VERSION} GIT_SHA=${GIT_SHA}
WORKDIR /app
USER 10001:10001
EXPOSE 8000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "--factory", "datahub.main:create_app", "--host", "0.0.0.0", "--port", "8000"]
```

Process commands (same image, set in Compose):

| Process | Command |
|---|---|
| api (dev) | `uvicorn --factory datahub.main:create_app --host 0.0.0.0 --port 8000 --reload` |
| api (prod) | `uvicorn --factory datahub.main:create_app --host 0.0.0.0 --port 8000 --workers 4 --timeout-graceful-shutdown 30` |
| worker | `celery -A datahub.worker worker -Q default,processing,exports,email --concurrency ${CELERY_CONCURRENCY} --prefetch-multiplier 1 -n worker@%h -l ${LOG_LEVEL}` |
| beat | `celery -A datahub.worker beat --schedule /var/lib/celery/beat-schedule -l ${LOG_LEVEL}` |
| migrate | `alembic upgrade head` (dev: followed by `python -m datahub.cli storage-setup`) |

Client IP is derived by the application's proxy-headers middleware from `X-Forwarded-For` only when the peer is in `TRUSTED_PROXY_CIDRS` (LLD §2); Uvicorn's own proxy-header trust is left at its default (loopback only).

`DATAHUB_VERSION` and `GIT_SHA` are baked in as build arguments; `GET /api/v1/healthz` returns `version`, which release verification compares with the deployed tag.

### 2.2 `infrastructure/docker/web.Dockerfile`

| Stage | Base | Purpose |
|---|---|---|
| `deps` | `node:22-alpine` | `npm ci` from `apps/web/package.json` + `package-lock.json`. |
| `dev` | `deps` | `npm run dev -- --hostname 0.0.0.0 --port 3000`; source bind-mounted. |
| `builder` | `deps` | Copies `apps/web` and `packages/shared` (generated API types); `NEXT_TELEMETRY_DISABLED=1`; `npm run build` with `output: "standalone"` in `next.config.ts`. |
| `runner` | `node:22-alpine` | Copies `.next/standalone`, `.next/static`, `public`. User `datahub` uid/gid **10001**. `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`. `CMD ["node", "server.js"]`. |

The web image contains no secrets. `WEB_API_INTERNAL_URL` is read **at runtime** (server-side fetches and development rewrites), so the same image runs in staging and production. The health route is `GET /healthz` on the web origin (outside `/api/*`, which Caddy and the dev rewrite send to the API).

### 2.3 Image hardening rules (checked in CI)

1. Non-root user 10001 in every runtime stage; `read_only: true` root filesystem in production with explicit `tmpfs` for `/tmp`.
2. Base images pinned by tag in Dockerfiles and by **digest** in production Compose; Dependabot proposes bumps.
3. `.dockerignore` excludes `.git`, `.env*`, `node_modules`, `.next`, `.venv`, `tests/e2e`, `docs`.
4. No `ADD` from URLs; no `curl | sh`.
5. `hadolint` passes with no warnings at level `warning` or above; Trivy reports no fixable CRITICAL/HIGH vulnerabilities (§6.3).
6. OCI labels: `org.opencontainers.image.source`, `.revision` (git SHA), `.version`, `.created`.

## 3. Docker Compose — development (`compose.yaml`)

### 3.1 Services

All services join network `datahub_net`. Host ports follow baseline §5 exactly; nothing binds 3200, 5434, 8000 or 8080.

| Service | Container | Image / build | Host → container port | Healthcheck (interval / start period) | Volumes | Depends on (condition) |
|---|---|---|---|---|---|---|
| `web` | `datahub_web` | `web.Dockerfile` target `dev` | **3410** → 3000 | `wget -q -O /dev/null http://127.0.0.1:3000/healthz` (30 s / 60 s) | bind `./apps/web`, bind `./packages/shared`, volume `datahub_web_node_modules:/app/node_modules` | `api` (healthy) |
| `api` | `datahub_api` | `api.Dockerfile` target `dev` | **8410** → 8000 | `python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/healthz', timeout=3)"` (15 s / 30 s) | bind `./apps/api/src`, bind `./apps/api/alembic` | `postgres`, `redis`, `s3` (healthy); `migrate` (completed successfully) |
| `worker` | `datahub_worker` | same as `api` | – | `celery -A datahub.worker inspect ping -d worker@$$HOSTNAME --timeout 10` (60 s / 60 s) | bind `./apps/api/src`; volume `datahub_scratch:/scratch` | `postgres`, `redis`, `s3`, `clamav` (healthy); `migrate` (completed) |
| `beat` | `datahub_beat` | same as `api` | – | `python -m datahub.cli beat-health --max-age 900` (60 s / 120 s) | volume `datahub_beat:/var/lib/celery` | `redis` (healthy); `migrate` (completed) |
| `migrate` | `datahub_migrate` | same as `api` | – | one-shot, `restart: "no"` | bind `./apps/api/src`, `./apps/api/alembic` | `postgres`, `s3` (healthy) |
| `postgres` | `datahub_postgres` | `postgres:17` | **5440** → 5432 | `pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB` (10 s / 20 s) | `datahub_pgdata:/var/lib/postgresql/data` | – |
| `redis` | `datahub_redis` | `redis:8-alpine` | **6390** → 6379 | `redis-cli --no-auth-warning -a $$REDIS_PASSWORD ping` (10 s / 10 s) | `datahub_redisdata:/data` | – |
| `s3` | `datahub_s3` | `chrislusf/seaweedfs` (explicit release tag) | **9410** → 8333 (S3 API), **9411** → 8888 (filer UI) | `wget -q -O /dev/null http://127.0.0.1:9333/cluster/status` (15 s / 30 s) | `datahub_s3data:/data`; bind `./infrastructure/docker/seaweedfs/s3.json` (read-only) | – |
| `clamav` | `datahub_clamav` | `clamav/clamav:stable` | – (internal 3310) | `clamdcheck.sh` (30 s / **300 s**, retries 10) | `datahub_clamdb:/var/lib/clamav`; bind `clamd.conf` (read-only) | – |
| `mailpit` | `datahub_mailpit` | `axllent/mailpit` (explicit release tag) | **8425** → 8025 (UI), **1035** → 1025 (SMTP) | `/mailpit readyz` (30 s / 10 s) | `datahub_mailpit:/data` (`MP_DATABASE=/data/mailpit.db`) | – |

Notes:

- `s3` runs `weed server -dir=/data -s3 -s3.port=8333 -s3.config=/etc/seaweedfs/s3.json -filer -filer.port=8888 -master.volumeSizeLimitMB=1024`. The bucket `datahub-private` (and its CORS and lifecycle rules) is created by `python -m datahub.cli storage-setup` inside `migrate`; the command is idempotent.
- `clamav` uses `infrastructure/docker/clamav/clamd.conf`: `StreamMaxLength 4000M`, `MaxScanSize 4000M`, `MaxFileSize 4000M` (AM-01), `MaxFiles 10000`, `MaxRecursion 16`, `MaxScanTime 600000`, `AlertExceedsMax yes`, `AlertEncrypted yes`, `AlertOLE2Macros yes`, `ConcurrentDatabaseReload no` (halves peak memory during signature reloads; scanning pauses for ≈ 30 s during each reload, and the worker retries).
- `redis` runs `redis-server --requirepass $$REDIS_PASSWORD --appendonly yes --maxmemory 200mb --maxmemory-policy noeviction`. `noeviction` is required because Redis is the Celery broker; evicting queue keys would drop tasks.
- `postgres` runs with `-c shared_buffers=128MB -c max_connections=100 -c log_min_duration_statement=500` in development.
- In development the application connects to Postgres as the database owner `datahub`; production uses separate roles (§5.3).
- Restart policy: `unless-stopped` for long-running services in both environments.

### 3.2 Volumes

| Volume | Mounted in | Content | Safe to delete in dev? |
|---|---|---|---|
| `datahub_pgdata` | postgres | Database | Yes — `docker compose down -v` wipes all dev data |
| `datahub_redisdata` | redis | AOF of queues | Yes |
| `datahub_s3data` | s3 | Object data | Yes (dev objects lost) |
| `datahub_clamdb` | clamav | Signature database (≈ 300 MB) | Yes, but the next start downloads signatures again |
| `datahub_mailpit` | mailpit | Captured dev emails | Yes |
| `datahub_scratch` | worker | Processing temp files | Yes |
| `datahub_beat` | beat | Beat schedule file | Yes |
| `datahub_web_node_modules` | web | Container-side `node_modules` | Yes |

### 3.3 Memory limits

Set with `deploy.resources.limits.memory` (honoured by Docker Compose v2 without Swarm). Dev limits fit a ≈ 7.5 GB host; production limits assume the recommended 32 GB VM (DEPLOYMENT_PLAN §3.2), with the 16 GB budget option shown.

| Service | Dev limit | Prod limit (32 GB VM) | Prod limit (16 GB VM) | Rationale |
|---|---|---|---|---|
| clamav | **1.5 G** | 3 G | 2 G | Signature DB ≈ 1.2 GB resident; reload peak covered by `ConcurrentDatabaseReload no` |
| worker | **1 G** | 6 G | 3 G | Streaming processing; PDF page rendering is the peak consumer; concurrency 2 / 6 / 4 |
| api | **512 M** | 2 G | 1 G | 1 Uvicorn process in dev, 4 in prod |
| web | **512 M** | 1 G | 768 M | `NODE_OPTIONS=--max-old-space-size=384` in dev |
| postgres | **512 M** | 8 G | 4 G | `shared_buffers` 128 MB / 2 GB / 1 GB |
| s3 (SeaweedFS, dev only) | 512 M | – | – | Production uses R2 |
| redis | 256 M | 1 G | 512 M | `maxmemory` set 20 % below the limit |
| beat | 256 M | 256 M | 256 M | Scheduler only |
| migrate (one-shot) | 256 M | 512 M | 512 M | Alembic only |
| mailpit (dev only) | 128 M | – | – | |
| caddy (prod only) | – | 256 M | 256 M | |
| **Total of long-running limits** | **≈ 5.1 G** | **≈ 21.5 G** | **≈ 11.8 G** | Leaves OS page cache headroom |

### 3.4 Everyday commands (development)

| Task | Command |
|---|---|
| Start everything | `docker compose up -d` |
| Watch start-up | `docker compose ps` (ClamAV shows `health: starting` for 2–3 min on first start while it loads signatures) |
| Stop (keep data) | `docker compose down` |
| Stop and wipe all dev data | `docker compose down -v` |
| Logs | `docker compose logs -f api worker` (any service names) |
| Run migrations manually | `docker compose exec api alembic upgrade head` (also run automatically by the one-shot `migrate` service on every `up`) |
| New migration | `docker compose exec api alembic revision --autogenerate -m "<slug>"`, then edit to follow expand/contract (DATABASE_SCHEMA §8.4) |
| Create first super_admin | `docker compose exec api python -m datahub.cli create-admin --email admin@example.org` (prompts twice for the password with hidden input; never pass it as an argument or env var) |
| Backend tests | `docker compose exec api pytest` |
| Frontend tests | `cd apps/web && npm run test` |
| End-to-end tests | `cd tests/e2e && npx playwright test` (stack must be running; `E2E_BASE_URL` defaults to `http://localhost:3410`) |
| Restart workers after code change | `docker compose restart worker beat` (Celery does not auto-reload) |
| Rebuild images after dependency change | `docker compose build api web && docker compose up -d` |
| Open a DB shell | `docker compose exec postgres psql -U datahub -d datahub` |
| Export OpenAPI | `docker compose exec api python scripts/export_openapi.py --out /tmp/openapi.json` (CI compares with `docs/04-backend-api/openapi.yaml`) |

## 4. Environment variable reference

### 4.1 Application variables (`.env.example`)

Read by `datahub.core.config.Settings` (pydantic-settings). Precedence: process environment, then files in `/run/secrets/<VARIABLE_NAME>` (Compose secrets, production), then defaults. Settings validation **refuses to start** in `staging`/`production` when a guard in the "Rules" column fails.

| Variable | Used by | Required | Dev value in `.env.example` | Production value / source | Secret | Rules / description |
|---|---|---|---|---|---|---|
| `DATAHUB_ENV` | api, worker, beat, migrate, web | yes | `development` | `production` (staging: `staging`) | no | One of `development`, `test`, `staging`, `production`. Enables production guards; disables Swagger UI outside `development`. |
| `SECRET_KEY` | api, worker | yes | `dev-only-not-a-secret-0123456789abcdef0123456789abcdef` | 48 random bytes, base64 (`openssl rand -base64 48`), Compose secret | **yes** | ≥ 32 bytes. HMAC key for CSRF tokens and signed links. Rotation invalidates outstanding CSRF tokens and email links only. |
| `DATABASE_URL` | api, worker, beat | yes | `postgresql+psycopg://datahub:datahub_dev_password@datahub_postgres:5432/datahub` | `postgresql+psycopg://datahub_app:<secret>@datahub_postgres:5432/datahub` | **yes** (contains password) | Runtime role has DML only and no DDL rights (DATABASE_SCHEMA, Assumptions). |
| `REDIS_URL` | api, worker, beat | yes | `redis://:datahub_dev_redis@datahub_redis:6379/0` | same shape, production password | **yes** | DB index in the URL (0) holds cache, rate limits and pub/sub; Celery broker and results use DB index **1** on the same server. |
| `S3_ENDPOINT_INTERNAL` | api, worker | yes | `http://datahub_s3:8333` | `https://<cloudflare-account-id>.r2.cloudflarestorage.com` | no | All server-side S3 calls (HLD §4.2). |
| `S3_ENDPOINT_PUBLIC` | api | yes | `http://localhost:9410` | same as internal (or an R2 custom domain) | no | Used **only** to sign presigned URLs for browsers. |
| `S3_ACCESS_KEY` | api, worker | yes | `datahub-dev-access` | R2 API token access key, scoped to the bucket, Object Read & Write | **yes** | |
| `S3_SECRET_KEY` | api, worker | yes | `datahub-dev-secret` | R2 API token secret | **yes** | |
| `S3_BUCKET` | api, worker | yes | `datahub-private` | `datahub-private` (staging: `datahub-staging-private`) | no | 3–63 characters, lowercase, digits and hyphens (S3 naming; SeaweedFS rejects shorter names). |
| `S3_REGION` | api, worker | yes | `us-east-1` | `auto` (R2) or the AWS region | no | |
| `CLAMAV_HOST` | worker, api (`/readyz`) | yes | `datahub_clamav` | `datahub_clamav` | no | |
| `CLAMAV_PORT` | worker, api | yes | `3310` | `3310` | no | Never published to the host. |
| `SMTP_HOST` | worker | yes | `datahub_mailpit` | provider host (e.g. `smtp.postmarkapp.com`) | no | |
| `SMTP_PORT` | worker | yes | `1025` (container port; host port 1035) | `587` | no | |
| `SMTP_USER` | worker | prod | empty | provider SMTP user / server token | **yes** | |
| `SMTP_PASSWORD` | worker | prod | empty | provider SMTP password / token | **yes** | |
| `SMTP_FROM` | worker | yes | `DataHub Dev <no-reply@datahub.test>` | `DataHub <no-reply@<production domain>>` (domain verified with SPF/DKIM) | no | |
| `SMTP_TLS` | worker | yes | `none` | `starttls` | no | `none` \| `starttls` \| `tls`. `none` refused in staging/production. |
| `PUBLIC_BASE_URL` | api, worker, web | yes | `http://localhost:3410` | `https://<production domain>` | no | Links in emails, CORS origin, WebSocket/CSRF `Origin` allow-list, cookie `Secure`. Must be `https://` in staging/production. |
| `ADMIN_MFA_REQUIRED` | api | yes | `true` | `true` | no | Startup fails if `false` in staging/production (AUTH_AUTHORIZATION §10). |
| `SENTRY_DSN` | api, worker, web | no | empty | Sentry project DSN (HA-05) | low | Empty disables Sentry. PII scrubbing always on; request bodies never sent. |
| `LOG_LEVEL` | api, worker, beat | no | `INFO` | `INFO` | no | `DEBUG` never in production (volume, not content: content is never logged at any level). |
| `CELERY_CONCURRENCY` | worker | no | `2` | `6` (32 GB VM) / `4` (16 GB VM) | no | Processes per worker container. |
| `WEB_API_INTERNAL_URL` | web | yes | `http://datahub_api:8000` | `http://datahub_api:8000` | no | Server-side fetches from Next.js; target of the dev `/api/*` rewrite. |

### 4.2 Additional application variables required by the design

These are defined by other baseline documents and are part of `.env.example`.

| Variable | Used by | Required | Dev value | Production value / source | Secret | Description |
|---|---|---|---|---|---|---|
| `FIELD_ENCRYPTION_KEYS` | api, worker | yes | `ZGV2LW9ubHktZmVybmV0LWtleS0zMi1ieXRlcyEhISE=` (dev-only) | Comma-separated Fernet keys; first encrypts, all decrypt; generate with `python -m datahub.cli gen-fernet-key` | **yes** | Application-level encryption of TOTP secrets and payout-method details (DATABASE_SCHEMA D-DB-10). Losing every key makes MFA secrets unreadable: keys are part of the backup key escrow (BACKUP_DISASTER_RECOVERY §5). |
| `MIGRATOR_DATABASE_URL` | migrate | prod | empty (falls back to `DATABASE_URL`) | `postgresql+psycopg://datahub_migrator:<secret>@datahub_postgres:5432/datahub` | **yes** | DDL role used only by the `migrate` container. |
| `TRUSTED_PROXY_CIDRS` | api | prod | empty | `172.30.0.0/24` (the fixed subnet of the production Compose network, §5.1) | no | Peers allowed to set `X-Forwarded-For`. |
| `ADMIN_IP_ALLOWLIST` | api | no | empty | empty, or office/VPN CIDRs | no | When set, admin endpoints from other IPs return 403. |
| `SUPPORT_INBOX_EMAIL` | worker | yes | `support@datahub.test` | support mailbox on the production domain | no | Receives contact-form copies. |

### 4.3 Container-level and deployment variables

| Variable | Where | Dev value | Production source | Secret | Description |
|---|---|---|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | postgres container | `datahub` / `datahub` | `datahub_owner` / `datahub` | no | Cluster owner; application roles are created by migration `0008_h_hardening` plus `deploy.sh --init-roles`. |
| `POSTGRES_PASSWORD` | postgres container | `datahub_dev_password` | Compose secret | **yes** | Owner password; used only for maintenance and backups. |
| `REDIS_PASSWORD` | redis container | `datahub_dev_redis` | Compose secret | **yes** | Must match the password in `REDIS_URL`. |
| `DATAHUB_DOMAIN` | caddy | – | the HA-05 domain | no | Site address in the Caddyfile. |
| `ACME_EMAIL` | caddy | – | operations mailbox | no | Let's Encrypt / ZeroSSL account contact. |
| `GHCR_OWNER` | compose.prod | – | GitHub organisation that owns the repository (HA-05) | no | Image path `ghcr.io/${GHCR_OWNER}/datahub-api`. |
| `API_IMAGE`, `WEB_IMAGE` | compose.prod | – | written by `deploy.sh` into `/srv/datahub/release.env`, e.g. `ghcr.io/<owner>/datahub-api@sha256:…` | no | Digest-pinned images. |
| `DATAHUB_VERSION` | compose.prod, image build | `dev` | release tag `X.Y.Z` | no | Reported by `/api/v1/healthz`. |
| `E2E_BASE_URL` | Playwright | `http://localhost:3410` | staging or production URL in release jobs | no | |

Backup configuration (`/etc/datahub/backup.env`) is specified in BACKUP_DISASTER_RECOVERY §3.4.

### 4.4 Canonical name mapping (alignment required)

Earlier documents used other names for the same settings. Code uses the canonical name; the documents listed are corrected during implementation.

| Name used elsewhere | Canonical name | Where it appears |
|---|---|---|
| `ENV` | `DATAHUB_ENV` | AUTH_AUTHORIZATION §10 |
| `S3_ENDPOINT` | `S3_ENDPOINT_INTERNAL` | FILE_UPLOAD_STORAGE §20 |
| `S3_PUBLIC_ENDPOINT` | `S3_ENDPOINT_PUBLIC` | FILE_UPLOAD_STORAGE §20 |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | `S3_ACCESS_KEY` / `S3_SECRET_KEY` | SAD §6, LLD §2 |
| `S3_BUCKET_PRIVATE` | `S3_BUCKET` | LLD §2 |
| `CLAMD_HOST` / `CLAMD_PORT` | `CLAMAV_HOST` / `CLAMAV_PORT` | LLD §2 |
| `SMTP_USERNAME`, `SMTP_STARTTLS`, `MAIL_FROM` | `SMTP_USER`, `SMTP_TLS`, `SMTP_FROM` | LLD §2 |
| `APP_BASE_URL`, `WEB_ORIGIN`, `CORS_ALLOWED_ORIGINS` | `PUBLIC_BASE_URL` (CORS origin derived from it) | LLD §2, FILE_UPLOAD_STORAGE §20 |
| `CSRF_SECRET` | `SECRET_KEY` | AUTH_AUTHORIZATION, API_DOCUMENTATION |
| `MFA_ENCRYPTION_KEY`, `APP_ENCRYPTION_KEY` | `FIELD_ENCRYPTION_KEYS` | AUTH_AUTHORIZATION §9, SRS SEC-14 |
| `TRUSTED_PROXIES` | `TRUSTED_PROXY_CIDRS` | AUTH_AUTHORIZATION |
| `CELERY_BROKER_URL` | derived from `REDIS_URL` (DB index 1) | LLD §2 |

Session lifetimes, lockout thresholds, Argon2 parameters and other business tunables are **not** environment variables; they are `system_settings` keys or code constants (AM-08).

## 5. Production container configuration (`infrastructure/deployment/compose.prod.yaml`)

### 5.1 Differences from development

| Aspect | Development | Production |
|---|---|---|
| Images | Built locally, `dev` targets, source bind mounts | `runtime`/`runner` targets from GHCR, pinned by digest; no bind mounts of source |
| Published ports | Baseline §5 ports on the host | **Only `datahub_caddy` publishes 80/tcp, 443/tcp, 443/udp**. Postgres, Redis, API, web, ClamAV are unreachable from outside the Docker network. |
| Network | `datahub_net` (default subnet) | `datahub_net` with fixed subnet `172.30.0.0/24` (referenced by `TRUSTED_PROXY_CIDRS`) |
| Object storage | `datahub_s3` SeaweedFS | Cloudflare R2 bucket `datahub-private` (no S3 container) |
| Mail | `datahub_mailpit` | External SMTP provider over STARTTLS 587 (no Mailpit) |
| Secrets | `.env` | `/srv/datahub/.env` (non-secret settings, mode 0640) + Compose `secrets:` files in `/srv/datahub/secrets/` (mode 0400, root-owned, directory 0700) |
| Filesystem | writable | `read_only: true` for api, web, beat, caddy; `tmpfs: /tmp` (size 256m); worker scratch is a host directory on a separate volume mounted `noexec,nosuid,nodev` |
| Capabilities | default | `cap_drop: [ALL]`; caddy adds `NET_BIND_SERVICE`; `security_opt: ["no-new-privileges:true"]` |
| Logging | default | `json-file` driver, `max-size: 20m`, `max-file: 5` per container (≈ 100 MB cap each) |
| Restart | `unless-stopped` | `unless-stopped` |
| Stop grace | default | api 30 s, worker **120 s** (warm shutdown; unfinished tasks are redelivered because `acks_late=True`), beat 10 s |
| Swagger UI | on | off (`DATAHUB_ENV=production`) |

### 5.2 Production services

| Service | Container | Healthcheck | Volumes / mounts |
|---|---|---|---|
| `caddy` | `datahub_caddy` | `wget -q -O /dev/null http://127.0.0.1:2019/config/` | `./Caddyfile` (ro), `caddy_data:/data` (certificates — back up not required, re-issued automatically), `caddy_config:/config` |
| `web` | `datahub_web` | `wget … http://127.0.0.1:3000/healthz` | none |
| `api` | `datahub_api` | `…/api/v1/healthz` (liveness only — a dependency outage must not cause restart loops) | none |
| `worker` | `datahub_worker` | `celery inspect ping` | `/mnt/datahub-scratch:/scratch` (noexec) |
| `beat` | `datahub_beat` | `python -m datahub.cli beat-health --max-age 900` | `beat_schedule:/var/lib/celery` |
| `migrate` | `datahub_migrate` | one-shot, profile `migrate` (run explicitly by `deploy.sh`) | none |
| `postgres` | `datahub_postgres` | `pg_isready` | `/srv/datahub/pgdata:/var/lib/postgresql/data` (local NVMe) |
| `redis` | `datahub_redis` | `redis-cli ping` | `redis_data:/data` (AOF) |
| `clamav` | `datahub_clamav` | `clamdcheck.sh`, start period 300 s | `clamdb:/var/lib/clamav` |
| Profile `monitoring` | `datahub_prometheus`, `datahub_alertmanager`, `datahub_grafana`, `datahub_node_exporter`, `datahub_postgres_exporter`, `datahub_redis_exporter`, `datahub_celery_exporter` | each image's own probe | `prometheus_data` (15-day retention), `grafana_data` |

`datahub_beat` must run as **exactly one** instance (SAD §10, constraint 7); the production file sets no `replicas` for it and `deploy.sh` refuses `--scale beat=N` with N ≠ 1.

### 5.3 Database roles in production

| Role | Rights | Used by |
|---|---|---|
| `datahub_owner` | Cluster/database owner | Maintenance only; backups use a dedicated `datahub_backup` role with `pg_read_all_data` |
| `datahub_migrator` | DDL on schema `public` | `migrate` container (`MIGRATOR_DATABASE_URL`) |
| `datahub_app` | DML only; `INSERT, SELECT` only on `audit_logs`, `ledger_journals`, `wallet_transactions` | api, worker, beat (`DATABASE_URL`) |
| `datahub_retention` | `DELETE` on `audit_logs` (partition drop) | `retention.purge` (DATABASE_SCHEMA §6) |
| `datahub_backup` | `pg_read_all_data` | `scripts/backup.sh` |

## 6. CI pipeline (`.github/workflows/ci.yml`)

Triggers: `pull_request` (all branches), `push` to `main`, `schedule` (nightly 19:00 UTC = 02:00 Asia/Phnom_Penh), `workflow_dispatch`. Runner `ubuntu-24.04`. Concurrency group per ref; superseded PR runs are cancelled. `main` is protected: all required jobs green, one approving review, linear history, no direct pushes.

### 6.1 Jobs (MASTER Part 22 stages 1–12)

| # | Stage | Job name | Tools / commands | Blocks merge |
|---|---|---|---|---|
| 1 | Check formatting | `format` | `uv run ruff format --check` (api); `npx prettier --check .` (web, e2e) | yes |
| 2 | Linters | `lint` | `ruff check`; `lint-imports` (import-linter: module boundary contracts from SAD §5); `npm run lint` (ESLint incl. jsx-a11y); `hadolint` on both Dockerfiles; `actionlint` on workflows | yes |
| 3 | Type checks | `typecheck` | `uv run mypy src` (strict); `npx tsc --noEmit` (web and e2e) | yes |
| 4 | Unit tests | `test-unit` | `pytest -m "not integration" --cov` with a PostgreSQL 17 service container (baseline §3: tests use real Postgres); `npm run test -- --coverage` (Vitest). Coverage gates: backend ≥ 85 % lines, `finance` and `identity` modules ≥ 95 %; web ≥ 70 % | yes |
| 5 | Integration tests | `test-integration` | `pytest -m integration` against service containers `postgres:17`, `redis:8-alpine`, SeaweedFS, `clamav/clamav:stable` (start period 300 s, signatures cached with `actions/cache`), Mailpit. Includes EICAR quarantine, ZIP-bomb limits, multipart resume, ledger concurrency, authorisation matrix | yes |
| 6 | Validate migrations | `migrations` | DATABASE_SCHEMA §8.6 tests (`upgrade head` from empty, `alembic check`, stairway, single head, enum checks, identifier lengths, FK indexes, money columns); `alembic upgrade head --sql` piped to `squawk` (rejects unsafe DDL: non-concurrent index on large tables, volatile defaults, table rewrites) | yes |
| 7 | Validate OpenAPI | `openapi` | `scripts/export_openapi.py` → diff with `docs/04-backend-api/openapi.yaml` (any drift fails); `openapi-spec-validator`; regenerate `packages/shared` types with `openapi-typescript` and fail on diff | yes |
| 8 | Scan dependencies | `dependency-scan` | `uv export --frozen --no-dev \| pip-audit -r /dev/stdin --strict`; `npm audit --omit=dev --audit-level=high` (web, e2e); licence check (`pip-licenses`, `license-checker`) rejects AGPL/GPL in runtime deps | yes (high/critical) |
| 9 | Build frontend | `build-web` | `npm ci && npm run build` (standalone output); bundle size report as job summary | yes |
| 10 | Build images | `build-images` | `docker buildx build` for `api.Dockerfile` (target `runtime`) and `web.Dockerfile` (target `runner`), GitHub Actions cache. PRs: build only. `main`: push `ghcr.io/${GHCR_OWNER}/datahub-api:sha-<git-sha>` and `…/datahub-web:sha-<git-sha>` | yes |
| 11 | Security checks | `security` | `gitleaks detect` (full history on `main`, diff on PR); Trivy image scan of both images (fail on fixable CRITICAL/HIGH); `trivy config` on Dockerfiles and Compose files; `bandit -r src -ll` | yes |
| 12 | Versioned artefacts | `artifacts` | Uploads: image digests (`digests.json`), CycloneDX SBOMs (`trivy image --format cyclonedx`), `openapi.json`, coverage and test reports (JUnit), Playwright report. Retention 90 days | – |
| – | E2E smoke on PR | `e2e-smoke` | `docker compose up -d --wait` with the PR images, `create-admin` non-interactive test mode (`DATAHUB_ENV=test` only), `npx playwright test --grep @smoke` | yes |
| – | Nightly DAST | `zap-baseline` | Schedule only: OWASP ZAP baseline scan (`zaproxy/action-baseline`) against **staging** with `.zap/rules.tsv`; new High alerts open a GitHub issue labelled `security` | – |
| – | Nightly full E2E | `e2e-nightly` | Schedule only: full Playwright suite (Chromium, Firefox, WebKit; mobile viewports) against a fresh Compose stack | – |

Job dependencies: `format`, `lint`, `typecheck`, `dependency-scan` run in parallel; `test-unit`, `migrations`, `openapi` after `lint`; `test-integration` after `test-unit`; `build-web` after `typecheck`; `build-images` after `test-integration` and `build-web`; `security` and `e2e-smoke` after `build-images`; `artifacts` last.

### 6.2 Test data rules in CI

Seed data (`python -m datahub.cli seed-dev`) exists only for `development`/`test`/`staging` and refuses to run when `DATAHUB_ENV=production`. Test identities use the reserved domain `example.org`. CI never connects to production.

### 6.3 Security scanning summary

| Scanner | Scope | When | Fail threshold |
|---|---|---|---|
| `pip-audit` | Python runtime dependencies (from `uv.lock`) | every CI run + nightly | any known vulnerability with a fix |
| `npm audit` | web + e2e production dependencies | every CI run + nightly | high or critical |
| Trivy (image) | `datahub-api`, `datahub-web` images, OS + language packages | every image build + nightly against the deployed digests | fixable CRITICAL/HIGH |
| Trivy (config) | Dockerfiles, Compose files | every CI run | HIGH misconfiguration |
| gitleaks | Repository content and history | every CI run; also pre-commit hook | any finding (allow-list only for documented dev-only values in `.env.example`, `infrastructure/docker/seaweedfs/s3.json`) |
| bandit | Backend source | every CI run | medium severity, medium confidence |
| OWASP ZAP baseline | Staging URL, unauthenticated | nightly | new High alert → issue (release blocker until triaged) |
| Dependabot | pip/npm/docker/actions | weekly | PRs go through the full pipeline |

Accepted risks are recorded in `.trivyignore` / `.zap/rules.tsv` with an expiry date and a link to a `DECISION_LOG.md` entry; expired exceptions fail the build.

## 7. Release and deployment pipeline (`.github/workflows/release.yml`)

### 7.1 Release tagging

- Semantic Versioning `vMAJOR.MINOR.PATCH`; pre-releases `vX.Y.Z-rc.N`. MAJOR = breaking API contract or a contract-phase migration that requires downtime; MINOR = features, expand migrations; PATCH = fixes only.
- Commits follow Conventional Commits; `CHANGELOG.md` is updated in the release PR. A release PR also states for every migration: phase (expand / migrate / contract), lock risk, and whether it is reversible.
- A maintainer creates the tag on a commit of `main` that already has green CI and pushed `sha-` images. Tags are protected (only maintainers).

| Image tag | Created by | Mutable? | Used for |
|---|---|---|---|
| `sha-<40-char git sha>` | `ci.yml` on `main` | no | Traceability; staging of untagged builds |
| `X.Y.Z` (and `X.Y.Z-rc.N`) | `release.yml` (re-tag of the `sha-` digest) | no | Releases |
| `X.Y` | `release.yml` | yes (moves to latest patch) | Human convenience only — **never** referenced by deployments |
| `latest` | not produced | – | – |

Deployments always reference `@sha256:` digests resolved from the `X.Y.Z` tag.

### 7.2 Jobs (MASTER Part 22 release steps)

Trigger: `push` of tags `v*.*.*`; `workflow_dispatch` with inputs `version` (existing tag) and `target` (`staging` | `production`) for redeploys and rollbacks.

| Order | Job name | GitHub Environment | What it does |
|---|---|---|---|
| 1 | `verify-tag` | – | Tag is on `main`; CI for that commit succeeded; `CHANGELOG.md` has the version; `sha-` images exist. |
| 2 | `promote-images` | – | `docker buildx imagetools create` re-tags `sha-<sha>` → `X.Y.Z`, `X.Y`; records digests; attaches SBOMs and `openapi.json` to the GitHub Release. Optional keyless `cosign sign` of the digests. |
| 3 | `deploy-staging` | `staging` | SSH (environment secret `DEPLOY_SSH_KEY`, pinned `DEPLOY_KNOWN_HOSTS`) to the staging VM as user `deploy`; runs `/srv/datahub/deploy.sh X.Y.Z` (pre-deploy backup → migrate → restart → health wait). |
| 4 | `smoke-staging` | `staging` | `/api/v1/readyz` = 200 with all checks `ok`; `/api/v1/healthz` `version` = `X.Y.Z`; `npx playwright test --grep @smoke` against staging. |
| 5 | `e2e-staging` | `staging` | Full Playwright suite against staging with the staging test accounts and marked test data; ZAP baseline. Release candidates (`-rc.N`) stop here. |
| 6 | `approve-production` | `production` | **Manual gate**: Environment protection rules — required reviewers (owner + one engineer other than the tagger), deployment restricted to tags `v*.*.*` without suffix, wait timer 0. Reviewers check the staging evidence and the migration notes. |
| 7 | `deploy-production` | `production` | Same `deploy.sh X.Y.Z` on the production VM: pre-deploy encrypted `pg_dump`, `migrate` (expand-only migrations), rolling restart, health wait. |
| 8 | `verify-production` | `production` | Health/version checks via the public URL, read-only smoke tests (`@prod-smoke`: public pages, login of the production smoke account, presign of a 1 MB test part, WebSocket connect), TLS certificate validity ≥ 14 days. |
| 9 | `monitor-production` | `production` | 30-minute watch: queries Prometheus (via SSH tunnel) for 5xx ratio, p95 latency, task failure rate, and Sentry for new issues in release `X.Y.Z`. Breach → job fails, notifies the on-call channel with the rollback command. **No automatic rollback** — a human decides (§9). |

### 7.3 `deploy.sh` contract (runs on the VM)

1. Lock (`flock /run/datahub-deploy.lock`); abort if another deploy runs.
2. Pre-flight: free disk ≥ 20 % on `/` and the scratch volume; `docker compose config` valid; images pull by digest; Caddy and Postgres healthy.
3. Save current `release.env` as `release.env.previous`; write the new digests.
4. Pre-deploy backup: `scripts/backup.sh --kind pre-deploy --label X.Y.Z` (must succeed).
5. Migrate: `docker compose --profile migrate run --rm migrate`. Failure → stop, nothing restarted, old version keeps serving.
6. Restart in order: `api`, `web` (`docker compose up -d --no-deps`), wait healthy; then `worker` (warm shutdown, 120 s), then `beat`.
7. Health wait (≤ 5 min): container health, `/api/v1/readyz` through Caddy, version match.
8. Append a line to `/srv/datahub/releases.log` (UTC time, version, digests, operator, result) and to `audit` via `python -m datahub.cli record-release`.

Expected interruption: a few seconds per API restart (Caddy retries upstream connections for 10 s: `lb_try_duration 10s`). WebSocket clients reconnect automatically (HLD §7).

## 8. Secrets handling

| Rule | Implementation |
|---|---|
| No secrets in git | `.env*` ignored except `.env.example`; gitleaks in pre-commit and CI; dev-only values are visibly fake (`dev-only…`, `datahub_dev_…`). |
| No secrets in images | Build args carry only version/sha; Trivy secret scanner on images. |
| Source of truth | The owner's password manager vault "DataHub Production" (1Password or Bitwarden) holds every production secret, the age backup private key and the break-glass procedure. |
| Delivery to the VM | Owner (or a delegated DevOps engineer) creates files in `/srv/datahub/secrets/` over SSH; Compose mounts them as `/run/secrets/<NAME>`. CI never sees application secrets. |
| CI secrets | Per GitHub Environment: `DEPLOY_SSH_KEY` (ed25519, restricted to `deploy.sh` via `command=` in `authorized_keys`), `DEPLOY_KNOWN_HOSTS`. GHCR access uses the workflow `GITHUB_TOKEN` (`packages: write` only in image jobs). |
| Least privilege | R2 token scoped to one bucket; backup credentials separate and append-only (BACKUP_DISASTER_RECOVERY §4); SMTP token send-only; Sentry DSN is ingest-only. |
| Logging | structlog redaction of keys matching `password|token|secret|authorization|cookie|dsn|key`; request bodies never logged; document content never logged (MASTER Part 24). |
| Rotation | `SECRET_KEY`, DB passwords, Redis password, S3 and SMTP credentials: every 12 months and immediately after staff departure or suspected exposure. `FIELD_ENCRYPTION_KEYS`: prepend a new key, run `python -m datahub.cli reencrypt-fields`, then remove the old key in the next release. |

## 9. Rollback process

| Situation | Action | Command |
|---|---|---|
| New release misbehaves, migrations were expand-only (the rule) | Redeploy the previous version's images; schema stays (old code is compatible by the expand/contract rule) | On the VM: `/srv/datahub/deploy.sh --rollback` (uses `release.env.previous`, skips migrations); or GitHub: run `release.yml` with `version=<previous X.Y.Z>`, `target=production` (still needs approval) |
| A migration itself failed | Nothing to roll back: `deploy.sh` stops before restarting; fix forward with a new patch release | – |
| A migration must be reverted (only if the release notes mark it reversible and data-safe) | Rollback images first, then downgrade with explicit approval of the CTO role | `docker compose --profile migrate run --rm migrate alembic downgrade <revision>` |
| Data corruption caused by the release | Stop writes (`maintenance_mode=true`), assess, restore the pre-deploy backup only with owner approval (loses writes since the deploy) | BACKUP_DISASTER_RECOVERY §7.3 |

Contract-phase migrations are released only after the previous release has run in production for at least 7 days without rollback, so a one-step rollback is always available.
