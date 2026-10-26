# DataHub — Deployment Plan

## Document control

| Field | Value |
|---|---|
| Document ID | DH-OPS-DEPLOY (mandatory document #32) |
| Version | 1.0 |
| Date | 2026-10-26 |
| Status | Baseline — describes the **planned** deployment; updated when the code and infrastructure exist |
| Owner | DevOps role (CTO role approves; system owner approves production go-live) |
| Canonical source | [`../ENGINEERING_BASELINE.md`](../ENGINEERING_BASELINE.md) (§5 ports, §13 jobs, §14 NFR targets, §16 AM-01…AM-14) |
| Related | [DOCKER_CICD.md](DOCKER_CICD.md) · [BACKUP_DISASTER_RECOVERY.md](BACKUP_DISASTER_RECOVERY.md) · [SAD §8–9](../02-system-architecture/SAD.md) · [HLD §8–9](../02-system-architecture/HLD.md) · [ADR-0013](../02-system-architecture/ADR/ADR-0013-single-vm-compose-caddy.md) · [RELEASE_READINESS.md](../RELEASE_READINESS.md) · [RISK_REGISTER.md](../RISK_REGISTER.md) |

> **Deployment status (2026-10-26): DataHub has NOT been deployed to staging or production.** No hosting account, domain, DNS zone, SMTP account, object-storage credentials or Sentry DSN exist yet (HA-05, R-08). Everything below is the plan and the automation to be built; §18 lists the exact steps the owner must complete before the first deployment. Nothing in this document may be read as a claim that DataHub is live.

## Header

- **Purpose.** Define how DataHub is run in development, staging and production: infrastructure, provider and cost, DNS, HTTPS, database and storage provisioning, first-time and routine deployment steps, migration strategy, monitoring, health checks, release verification, rollback, and the operational runbooks required by MASTER Part 24.
- **Scope.** All environments and all runtime components of baseline §5 plus the production-only `datahub_caddy`. Image build and CI/CD mechanics are in [DOCKER_CICD.md](DOCKER_CICD.md); backup mechanics and disaster recovery are in [BACKUP_DISASTER_RECOVERY.md](BACKUP_DISASTER_RECOVERY.md).
- **Assumptions.** A-03 (≤ 2,000 users, ≤ 200 concurrent sessions, ≤ 50 concurrent uploads, ≤ 20 TB in year 1); per-file limit 4,000,000,000 bytes (AM-01); users are mostly in Cambodia (A-01, A-02); a small team with one on-call engineer during business hours (Asia/Phnom_Penh, UTC+7); prices in §4 are indicative list prices excluding VAT, gathered for planning and to be confirmed at order time.
- **Decisions.**
  - D-DEP-01 Production is one Linux VM running Docker Compose with Caddy (ADR-0013), on **Hetzner Cloud**, with objects in **Cloudflare R2**, DNS on **Cloudflare**, SMTP via **Postmark** (Brevo as the cheaper alternative), errors in **Sentry**, external probes via **Uptime Kuma** on a separate small VM and cron heartbeats via **healthchecks.io**.
  - D-DEP-02 Recommended VM: **Hetzner CCX33** (8 dedicated vCPU, 32 GB RAM), matching SAD §8.2 sizing. **CPX41** (8 shared vCPU, 16 GB RAM) is the budget option with the reduced memory limits of DOCKER_CICD §3.3.
  - D-DEP-03 Three environments: development (local Compose), staging (small VM, separate bucket, Mailpit, no real personal data), production.
  - D-DEP-04 Schema changes follow expand/contract (DATABASE_SCHEMA §8.4); migrations run before new code starts; rollback never requires a schema downgrade.
  - D-DEP-05 DNS records point directly to the VM ("DNS only", not proxied) at launch so Caddy obtains certificates with the HTTP-01/TLS-ALPN challenge; Cloudflare proxying can be enabled later (§6.4).
  - D-DEP-06 Production go-live requires every item of [RELEASE_READINESS.md](../RELEASE_READINESS.md) to have evidence, and the owner's approval in the GitHub `production` environment.
- **Dependencies.** HA-05 (accounts and credentials), HA-01–HA-04 (legal approvals before public launch), HA-07 (dual-approval threshold); ENGINEERING_BASELINE §5, §13, §14; SAD §8–9; HLD §4.2, §8; DATABASE_SCHEMA §8.4–§8.6; FILE_UPLOAD_STORAGE §17, §20; AUTH_AUTHORIZATION §9–§10; DATA_RETENTION_DELETION §8.
- **Acceptance criteria.**
  1. Each MASTER document #32 topic (environment strategy, dev, staging, prod, infrastructure, DNS, HTTPS, DB and storage provisioning, deployment steps, migrations, monitoring, health checks, release verification, rollback) has its own section.
  2. A provider is recommended with a monthly cost table and explicit assumptions, plus an AWS comparison (MASTER Part 23 items 1–2).
  3. Every MASTER Part 24 tracked signal maps to a metric and at least one alert with a runbook.
  4. All nine MASTER Part 24 runbooks exist with detection, diagnosis, resolution, verification and escalation steps.
  5. The production owner checklist (§18) is complete enough that, once done, an engineer can deploy without further questions.
  6. The document states that production has not been deployed.

---

## 1. Environment strategy

| Aspect | Development | Staging | Production |
|---|---|---|---|
| Purpose | Feature work, unit/integration/E2E tests | Release candidate verification, E2E, ZAP, restore drills, demos | Real users and real data |
| Where | Developer machine (≈ 7.5 GB RAM host supported) | Hetzner CPX31 (4 vCPU / 8 GB) | Hetzner CCX33 (8 vCPU / 32 GB) |
| Orchestration | `compose.yaml` | `compose.prod.yaml` with staging `.env` | `compose.prod.yaml` |
| URL | `http://localhost:3410` | `https://staging.<domain>` | `https://<domain>` (`www.` redirects) |
| Object storage | SeaweedFS `datahub_s3` | R2 bucket `datahub-staging-private` | R2 bucket `datahub-private` |
| Email | Mailpit (UI `http://localhost:8425`) | Mailpit, reachable only via SSH tunnel (no real email sent) | Postmark SMTP |
| Data | Seed data (`python -m datahub.cli seed-dev`) | Synthetic seed data and clearly marked test accounts (`*@example.org`); **no real personal data, no production copies** | Real data only; never seed data, test identities or fictional financial records (MASTER Part 18) |
| Images | Built locally | Release candidates `X.Y.Z-rc.N` and releases | Releases `X.Y.Z` only, by digest |
| Deploy trigger | Developer | `release.yml` automatically on every tag | `release.yml` after manual approval |
| Backups | none | nightly DB dump (7-day retention) for drills | full policy (BACKUP_DISASTER_RECOVERY) |
| Monitoring | logs only | Sentry environment `staging`, Uptime Kuma probe (no paging) | full alerting |
| `DATAHUB_ENV` | `development` | `staging` | `production` |

Promotion: commit → PR (CI) → `main` (CI builds `sha-` images) → tag `vX.Y.Z-rc.N` (staging) → tag `vX.Y.Z` (staging again, then approval → production). The same image digest runs in staging and production.

## 2. Development environment

Complete setup and commands: [README.md](../../README.md) and DOCKER_CICD §3. Summary:

1. `cp .env.example .env` (dev-only values; never real credentials).
2. `docker compose up -d` — starts web, api, worker, beat, postgres, redis, s3, clamav, mailpit; the one-shot `migrate` runs `alembic upgrade head` and creates the bucket.
3. `docker compose exec api python -m datahub.cli create-admin --email admin@example.org` (password prompted with hidden input).
4. Open `http://localhost:3410`; emails at `http://localhost:8425`; S3 filer UI at `http://localhost:9411`.

Host ports are fixed by baseline §5 to avoid this host's busy ports 3200, 5434, 8000 and 8080.

## 3. Staging environment

| Item | Specification |
|---|---|
| VM | Hetzner CPX31 (4 vCPU, 8 GB RAM, 160 GB disk), same location as production, Ubuntu 24.04 LTS |
| Memory limits | DOCKER_CICD §3.3 "dev" column (fits 8 GB); `CELERY_CONCURRENCY=2` |
| Database | `datahub_postgres` on the VM; nightly dump to the backup bucket under `staging/` (7 days) |
| Storage | R2 bucket `datahub-staging-private`, own token scoped to that bucket, same CORS/lifecycle as production with origin `https://staging.<domain>` |
| Email | Mailpit container (no published port); `ssh -L 8425:localhost:8425 deploy@staging` after binding Mailpit UI to `127.0.0.1:8425` on the VM |
| Access | Public HTTPS (needed for E2E and ZAP) but `X-Robots-Tag: noindex` and a banner "STAGING — test data only"; admin endpoints restricted with `ADMIN_IP_ALLOWLIST` to the office/VPN and the CI runner egress is not needed (E2E uses non-admin flows plus a staging admin over the allow-listed tunnel) |
| Data refresh | `python -m datahub.cli seed-dev --reset` (refuses in production) |
| Use | Every release candidate; monthly restore drill target (BACKUP_DISASTER_RECOVERY §8) |

## 4. Production environment, provider and cost

### 4.1 Recommendation

| Component | Choice | Reason |
|---|---|---|
| Compute | Hetzner Cloud **CCX33**: 8 dedicated vCPU, 32 GB RAM, 240 GB NVMe; location **Singapore (`sin`)** if CCX33 is offered there at order time, otherwise Falkenstein/Helsinki | Lowest price for dedicated cores and RAM in its class; Singapore is ≈ 30–50 ms from Phnom Penh. Latency matters only for API calls: file bytes go directly between the browser and R2. |
| Block storage | Hetzner Volume 100 GB mounted at `/mnt/datahub-scratch` (`noexec,nosuid,nodev`) | Worker scratch on a separate filesystem so a hostile archive cannot fill the database disk |
| VM protection | Hetzner automated backups (daily VM image, 7 retained) | Faster RTO for OS-level failures; not a substitute for `pg_dump` |
| Object storage | **Cloudflare R2**, bucket `datahub-private`, location hint Asia-Pacific | No egress fees (reviewers, annotators and exports read a lot); S3-compatible (ADR-0005) |
| Off-site backups | **Backblaze B2** buckets `datahub-backups-db` and `datahub-backups-objects` | Different provider from R2 (AM-13); application keys without delete rights |
| DNS | Cloudflare (free plan) | Fast propagation, DNSSEC, API for automation |
| TLS | Caddy 2 automatic HTTPS (Let's Encrypt, ZeroSSL fallback) | No manual certificate handling (ADR-0013) |
| Email | **Postmark** transactional stream (Brevo as alternative) | High deliverability, SMTP + DKIM; Postmark approves accounts manually before full sending |
| Errors | Sentry (Developer/free plan, 5k errors/month) | `SENTRY_DSN`; upgrade if quota is exceeded |
| Uptime | Uptime Kuma on a Hetzner CX22 in a **different location**; healthchecks.io (free) for cron heartbeats | An external probe must survive the production VM failing |

### 4.2 Monthly cost estimate (indicative, USD, excluding VAT)

Assumptions: 1 EUR ≈ 1.10 USD; EU list prices (Singapore list prices are higher and include less traffic, so confirm in the Hetzner console); R2 Standard storage $0.015/GB-month with no egress fees, Class A operations $4.50/million, Class B $0.36/million; Backblaze B2 ≈ $6.95/TB-month; ≈ 15,000 transactional emails/month; storage counted in decimal TB; prices verified by the owner at order time (§18).

| Item | 10 TB stored | 20 TB stored | Notes |
|---|---|---|---|
| Production VM CCX33 + IPv4 | ≈ $55–60 | ≈ $55–60 | CPX41 option: ≈ $32–35 |
| Hetzner VM backups (+20 %) | ≈ $11–12 | ≈ $11–12 | |
| Volume 100 GB (scratch) | ≈ $5 | ≈ $5 | |
| Staging VM CPX31 + IPv4 | ≈ $18–20 | ≈ $18–20 | |
| Uptime Kuma VM CX22 + IPv4 | ≈ $5 | ≈ $5 | |
| R2 storage | ≈ $150 | ≈ $300 | 10 GB free tier ignored |
| R2 operations | ≈ $5–10 | ≈ $8–15 | 16 MiB multipart parts, previews, listings |
| B2 object backup copy (+ 30-day deleted-object retention ≈ 5 %) | ≈ $73 | ≈ $146 | AM-13 |
| B2 database dumps (30 daily + 12 monthly, ≈ 0.3 TB) | ≈ $2 | ≈ $3 | Grows with DB size |
| Email (Postmark 10k–50k tier) | ≈ $15–20 | ≈ $15–20 | Brevo: free up to 300/day, paid ≈ $9+ |
| Sentry, healthchecks.io, Cloudflare DNS | $0 | $0 | Free plans |
| Domain | ≈ $1–2 | ≈ $1–2 | Annual fee spread monthly; `.com.kh` priced differently |
| GitHub / GHCR | $0–8 | $0–8 | Private package storage beyond the plan quota is billed; keep the last 20 releases |
| **Total** | **≈ $340–370** | **≈ $570–600** | Storage is ≈ 65–75 % of cost |

Traffic note: the nightly R2 → B2 object sync runs on the VM, so new objects count against the VM's outbound traffic (≈ 1.7 TB/month at 20 TB/year growth; the initial seed equals the bucket size). EU Hetzner servers include 20 TB/month; Singapore includes much less and bills overage, so the location decision (§18 step 2) must account for this.

### 4.3 Alternative: AWS (ap-southeast-1, Singapore), indicative on-demand

| Item | 10 TB | 20 TB | Notes |
|---|---|---|---|
| EC2 m7i.2xlarge (8 vCPU / 32 GB) + 100 GB gp3 | ≈ $360 | ≈ $360 | ≈ $250 with a 1-year Savings Plan; Lightsail 32 GB plan ≈ $165 is the cheaper AWS option without RDS |
| RDS PostgreSQL 17 db.m7g.large Single-AZ + 100 GB gp3 + backups | ≈ $160 | ≈ $160 | Multi-AZ doubles this; gives PITR natively |
| S3 Standard ($0.025/GB) + versioning overhead | ≈ $265 | ≈ $530 | Versioning replaces the B2 copy (AM-13) |
| Data transfer out (assume 1 TB/month to users and exports) | ≈ $120 | ≈ $120 | R2 has no egress fees |
| SES, CloudWatch basics | ≈ $10 | ≈ $10 | |
| **Total** | **≈ $900–920** | **≈ $1,180** | ≈ 2–2.6× the Hetzner + R2 plan |

AWS becomes preferable if the organisation already has AWS credits/contracts, needs managed PITR/HA from day one, or requires a single vendor for compliance. The application is portable: only `S3_*` variables and the DB host change.

## 5. Infrastructure requirements

| Requirement | Production | Staging |
|---|---|---|
| OS | Ubuntu 24.04 LTS, `unattended-upgrades` (security only), automatic reboot window Sunday 20:00–21:00 UTC | same |
| Container runtime | Docker Engine (current stable) + Compose v2 plugin from Docker's apt repository | same |
| CPU / RAM | 8 vCPU / 32 GB (16 GB budget option) | 4 vCPU / 8 GB |
| Disk | 240 GB NVMe (OS, images, Postgres data at `/srv/datahub/pgdata`, Redis AOF); alert at 75 % | 160 GB |
| Scratch | 100 GB volume at `/mnt/datahub-scratch`, `noexec,nosuid,nodev` | 40 GB volume |
| Network | Public IPv4 + IPv6; Hetzner Cloud Firewall: inbound **22/tcp from admin IPs only**, **80/tcp**, **443/tcp**, **443/udp** (HTTP/3); everything else denied; outbound open | same |
| Host firewall | Docker publishes only Caddy's ports; no other service has `ports:` in `compose.prod.yaml` (Docker bypasses `ufw` for published ports, so the Cloud Firewall is the authoritative filter) | same |
| SSH | Key-only (`PasswordAuthentication no`, `PermitRootLogin no`), named personal accounts in group `sudo`, user `deploy` (no sudo; member of `docker`; `authorized_keys` forced command to `deploy.sh` for CI), `fail2ban` for sshd | same |
| Time | `systemd-timesyncd` enabled, timezone UTC | same |
| Directory layout | `/srv/datahub/{compose.prod.yaml,Caddyfile,.env,release.env,release.env.previous,secrets/,pgdata/,releases.log}`, `/etc/datahub/backup.env`, `/usr/local/bin/dhc` | same |

`dhc` is a wrapper installed at bootstrap: `docker compose -f /srv/datahub/compose.prod.yaml --env-file /srv/datahub/.env --env-file /srv/datahub/release.env "$@"`. Runbooks below use it.

## 6. Domain, DNS and HTTPS

### 6.1 DNS records (Cloudflare zone of the HA-05 domain)

| Name | Type | Value | Proxy | Purpose |
|---|---|---|---|---|
| `@` | A / AAAA | production VM IPv4 / IPv6 | DNS only | App |
| `www` | CNAME | `@` | DNS only | Redirects to apex (Caddy) |
| `staging` | A / AAAA | staging VM | DNS only | Staging |
| `@` | CAA | `0 issue "letsencrypt.org"`, `0 issue "sectigo.com"` (ZeroSSL), `0 iodef "mailto:<ops mailbox>"` | – | Restricts certificate issuance |
| `@` | TXT (SPF) | `v=spf1 include:spf.mtasv.net ~all` (Postmark; use the provider's include) | – | Email |
| provider DKIM selector | TXT / CNAME | values from Postmark | – | Email signing |
| `pm-bounces` | CNAME | `pm.mtasv.net` | – | Postmark Return-Path |
| `_dmarc` | TXT | `v=DMARC1; p=quarantine; rua=mailto:<ops mailbox>; adkim=s; aspf=r` | – | Email policy (start `p=none` for 2 weeks, then `quarantine`) |

DNSSEC is enabled at the registrar. TTL 300 s for A/AAAA during launch week, then 3600 s. The R2 bucket uses the R2 S3 endpoint and needs no DNS record; an R2 custom domain is only introduced with the CDN step (SAD §9 S6).

### 6.2 HTTPS (Caddy)

`infrastructure/deployment/Caddyfile` (planned content):

```caddyfile
{
	email {$ACME_EMAIL}
}

www.{$DATAHUB_DOMAIN} {
	redir https://{$DATAHUB_DOMAIN}{uri} permanent
}

{$DATAHUB_DOMAIN} {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		X-Frame-Options "DENY"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		-Server
	}
	@metrics path /metrics /api/v1/metrics
	respond @metrics 404

	@api path /api/*
	handle @api {
		request_body {
			max_size 11MB
		}
		reverse_proxy datahub_api:8000 {
			lb_try_duration 10s
			health_uri /api/v1/healthz
		}
	}
	handle {
		reverse_proxy datahub_web:3000 {
			lb_try_duration 10s
		}
	}
	log {
		output stdout
		format json
	}
}
```

- Content-Security-Policy is emitted by the Next.js app (nonce-based), not by Caddy.
- `max_size 11MB` covers the 10 MB attachment/proof uploads; dataset files never pass through Caddy (presigned R2 URLs).
- HSTS `preload` is added only after one month without HTTPS issues.
- Certificates live in volume `caddy_data`; renewal is automatic ≈ 30 days before expiry. Alert if expiry < 14 days (§12).
- WebSocket `/api/v1/ws` is proxied by the same `reverse_proxy` (Caddy handles `Upgrade` transparently).

### 6.3 TLS verification

After first issuance: `curl -sI https://<domain>/` shows `strict-transport-security`; SSL Labs grade ≥ A; `curl -s https://<domain>/api/v1/metrics` returns 404.

### 6.4 Enabling Cloudflare proxy later (optional)

Switch records to "Proxied", set SSL mode **Full (strict)**, add Cloudflare IP ranges to Caddy `trusted_proxies` and to `TRUSTED_PROXY_CIDRS` handling via `CF-Connecting-IP`, and restrict the Hetzner firewall 80/443 to Cloudflare ranges. Recorded as a DECISION_LOG entry when done.

## 7. Database provisioning

1. Postgres 17 runs as `datahub_postgres` with data on local NVMe `/srv/datahub/pgdata` (owner uid 999, mode 0700).
2. Production settings (`command:` flags, 32 GB VM): `shared_buffers=2GB`, `effective_cache_size=12GB`, `work_mem=16MB`, `maintenance_work_mem=512MB`, `max_connections=150`, `wal_level=replica`, `max_wal_size=4GB`, `checkpoint_timeout=15min`, `log_min_duration_statement=500`, `log_lock_waits=on`, `idle_in_transaction_session_timeout=60s`, `password_encryption=scram-sha-256`. For the 16 GB VM halve `shared_buffers` and `effective_cache_size`.
3. Roles (DOCKER_CICD §5.3): `datahub_owner` (cluster owner), `datahub_migrator`, `datahub_app`, `datahub_retention`, `datahub_backup`. Created once by `deploy.sh --init-roles`, passwords read from `/srv/datahub/secrets/`. Grants on tables are applied by migration `0008_h_hardening` and re-applied after every migration by `ALTER DEFAULT PRIVILEGES`.
4. Connection budget: api 4 processes × (pool 10 + overflow 10) = 80, worker 6 × 2 = 12, beat 2, exporters/backup 5 → < 100 of 150.
5. Extensions required by revision 0001 (`citext`, `pg_trgm`, `btree_gist`, `pgcrypto`) ship with the official image.
6. Optional WAL archiving with pgBackRest for 15-minute RPO: BACKUP_DISASTER_RECOVERY §3.2.
7. Scale-out path: managed PostgreSQL 17 when the DB exceeds 200 GB or PITR/HA is needed (SAD §9 S4).

## 8. Storage provisioning

| Step | Production action |
|---|---|
| 1 | Create R2 bucket `datahub-private`, location hint Asia-Pacific, **public access disabled** (no r2.dev subdomain, no custom domain). |
| 2 | Create R2 API token "datahub-app-prod": Object Read & Write, **this bucket only** → `S3_ACCESS_KEY` / `S3_SECRET_KEY`. |
| 3 | Create a temporary token "datahub-storage-admin" (Admin Read & Write) and run once: `dhc run --rm -e S3_ACCESS_KEY=… -e S3_SECRET_KEY=… api python -m datahub.cli storage-setup` → applies CORS (`AllowedOrigins: ["https://<domain>"]`, methods PUT/GET/HEAD, `ExposeHeaders: ["ETag"]`) and lifecycle (abort incomplete multipart after 1 day, expire `exports/` after 8 days, expire `quarantine/` after 30 days), then verifies the preflight. Revoke the admin token afterwards. |
| 4 | Endpoint values: `S3_ENDPOINT_INTERNAL` = `S3_ENDPOINT_PUBLIC` = `https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`, path-style addressing. |
| 5 | Backup buckets on B2 (`datahub-backups-db`, `datahub-backups-objects`) with SSE-B2 encryption, lifecycle and append-only keys: BACKUP_DISASTER_RECOVERY §4. |
| 6 | Capacity and cost alerts: Cloudflare R2 usage notifications at 8 TB and 16 TB; storage-growth metric alert (§12). |

R2 has no object versioning; protection against deletion/corruption is the nightly copy to B2 with 30-day retention of deleted objects (AM-13). On AWS S3 instead: versioning on, noncurrent versions expire after 30 days, Block Public Access on, bucket policy denying non-TLS access.

## 9. Other external services

| Service | Configuration |
|---|---|
| Postmark | Server "DataHub Production", transactional message stream; verify sender signature/domain (DKIM, Return-Path); SMTP token → `SMTP_USER` and `SMTP_PASSWORD` (Postmark uses the server token for both); `SMTP_HOST=smtp.postmarkapp.com`, `SMTP_PORT=587`, `SMTP_TLS=starttls`; bounce and spam-complaint webhooks are **not** used in v1 (no inbound integrations, SAD §6) — bounces are reviewed in the Postmark UI weekly. |
| Sentry | Projects `datahub-api` (api + worker, distinguished by `server_name`) and `datahub-web`; environments `staging`, `production`; release = `X.Y.Z`; data scrubbing on; IP addresses not stored; alert rule "new issue in production" → ops email. |
| healthchecks.io | Checks: `backup-db` (daily, grace 2 h), `backup-objects` (daily, grace 4 h), `restore-test` (monthly, grace 3 days), `beat-heartbeat` (every 15 min, grace 15 min; pinged by `admin.requeue_stalled`). Notifications to the ops email and the on-call phone. |
| Uptime Kuma | HTTP monitors every 60 s: `https://<domain>/` (expects 200), `https://<domain>/api/v1/readyz` (expects 200 and body `"status":"ok"`), TLS expiry; keyword monitor for staging. Status page optional. |

## 10. Deployment steps

### 10.1 First-time production bootstrap (after §18 owner checklist)

1. Create the VM, volume, firewall and SSH keys (§5); attach the volume and add it to `/etc/fstab` with `noexec,nosuid,nodev`.
2. Harden the OS (§5), install Docker Engine and the Compose plugin, create users `deploy` and operators.
3. Clone the `infrastructure/deployment/` files of the release tag into `/srv/datahub/` (`compose.prod.yaml`, `Caddyfile`, `deploy.sh`, `dhc`).
4. Write `/srv/datahub/.env` (non-secret settings: `DATAHUB_ENV=production`, `PUBLIC_BASE_URL`, `S3_*` endpoint/bucket/region, `SMTP_HOST/PORT/FROM/TLS`, `CLAMAV_*`, `LOG_LEVEL`, `CELERY_CONCURRENCY`, `WEB_API_INTERNAL_URL`, `TRUSTED_PROXY_CIDRS`, `DATAHUB_DOMAIN`, `ACME_EMAIL`, `GHCR_OWNER`, `SUPPORT_INBOX_EMAIL`, `ADMIN_MFA_REQUIRED=true`).
5. Write each secret to `/srv/datahub/secrets/<NAME>` (mode 0400): `SECRET_KEY`, `FIELD_ENCRYPTION_KEYS`, `DATABASE_URL`, `MIGRATOR_DATABASE_URL`, `REDIS_URL`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `SMTP_USER`, `SMTP_PASSWORD`, `SENTRY_DSN`, plus role passwords for `--init-roles`.
6. Log in to GHCR read-only on the VM: `docker login ghcr.io` with a fine-grained token `read:packages` (stored by Docker in `/home/deploy/.docker/config.json`, mode 0600).
7. `deploy.sh --init-roles X.Y.Z`: starts postgres and redis, creates roles, runs `migrate`, starts clamav (waits up to 5 min for signatures), api, web, worker, beat, caddy.
8. Run storage setup (§8 step 3) and verify CORS.
9. Create the first super_admin: `dhc exec api python -m datahub.cli create-admin --email <owner email>`; log in, enrol TOTP MFA, store recovery codes in the password manager. Create the second super_admin the same way (required for the two-person break-glass, §17).
10. Install backup timers (BACKUP_DISASTER_RECOVERY §3.4): `systemctl enable --now datahub-backup-db.timer datahub-backup-objects.timer`; run each once manually and confirm the healthchecks.io ping.
11. Start the `monitoring` profile: `dhc --profile monitoring up -d`; confirm alerts reach the ops mailbox with a test alert.
12. Run the release verification (§14) and record evidence in RELEASE_READINESS.md.
13. Keep `maintenance_mode=true` and `legal_docs_approved=false` until HA-01–HA-04 are approved and the owner authorises go-live; then set both through the admin settings page (audited).

### 10.2 Routine release

Performed by `release.yml` (DOCKER_CICD §7). Human steps:

1. Release PR merged with migration notes (phase, lock risk, reversibility) and CHANGELOG entry.
2. Maintainer tags `vX.Y.Z-rc.1` → staging deploy + E2E + ZAP; fix and re-tag until green.
3. Maintainer tags `vX.Y.Z` → staging redeploy → approvers review evidence → approve `production`.
4. `deploy.sh X.Y.Z` runs on production: pre-deploy backup, migrations, restart, health wait.
5. On-call engineer watches the 30-minute monitor job and dashboards; decides rollback if needed (§15).
6. Announce in the ops channel; update `docs/PROJECT_STATUS.md` release history.

Deploy window: Tuesday–Thursday 13:00–15:00 UTC (20:00–22:00 Asia/Phnom_Penh); no releases on Fridays, public holidays in Cambodia, or during payout-processing days announced by finance. Emergency security patches may be released any time with owner approval.

### 10.3 Planned maintenance

Set `maintenance_mode=true` (AM-06: non-admin API calls return 503 `maintenance`; health, auth and admin still work), announce ≥ 48 h in advance (SRS NFR-AVL-01 allows ≤ 4 h/month), perform the work, verify, set it back to `false`.

## 11. Migration strategy

1. **Expand/contract only** (DATABASE_SCHEMA §8.4): release N adds (nullable columns, new tables, `NOT VALID` constraints then `VALIDATE`, `CREATE INDEX CONCURRENTLY`); backfills are separate idempotent, batched revisions; release N+1 or later contracts (drops, `SET NOT NULL` via validated CHECK).
2. Forbidden in one step on large tables: renames, rewriting type changes, volatile defaults, non-concurrent indexes on `dataset_files`, `wallet_transactions`, `audit_logs`, `messages`.
3. Every revision sets `SET LOCAL lock_timeout = '5s'` and `statement_timeout = '15min'` (except concurrent index builds). A lock timeout fails the deploy safely before any restart; retry in a quieter window.
4. Migrations run **before** new code starts, as `datahub_migrator`, in the one-shot `migrate` container. The old code keeps running during the migration and must work with the expanded schema — guaranteed by rule 1 and tested in CI (`migrations` job runs the previous release's API test smoke subset against the new schema).
5. Contract migrations ship only after the previous release has run ≥ 7 days in production without rollback (DOCKER_CICD §9).
6. Ledger tables (`ledger_journals`, `wallet_transactions`) and `audit_logs` are append-only with mutation-blocking triggers; migrations never rewrite their rows. Corrections are new journals.
7. Seed rows that are part of the schema contract (roles, system wallets, pricing rules, settings) are inserted by migrations with fixed UUIDs; users are never seeded (DATABASE_SCHEMA §8.5).
8. Pre-deploy encrypted `pg_dump` is mandatory before every production migration (DOCKER_CICD §7.3 step 4).
9. Readiness reports a pending migration (`/api/v1/readyz` check `migrations`), so a forgotten migration is visible immediately.

## 12. Monitoring

### 12.1 Stack

- **Metrics:** Prometheus (profile `monitoring`, 15-day retention, scrape every 15 s) scrapes `datahub_api:8000/api/v1/metrics` (internal network only), `celery-exporter` (queue lengths, task events), `postgres-exporter`, `redis-exporter`, `node-exporter` (host CPU, RAM, disk, the backup textfile collector). Alertmanager sends to the ops mailbox (SMTP) and, for `critical`, also to the on-call phone via healthchecks.io-style integration (Telegram bot or SMS gateway chosen by the owner).
- **Dashboards:** Grafana `infrastructure/monitoring/grafana/datahub-overview.json`: Traffic & errors · Latency · Queues & tasks · Uploads & processing · Storage · Email & notifications · Auth & security · Finance · Host & containers. Grafana listens on `127.0.0.1:3000` of the host only; access via `ssh -L 3001:127.0.0.1:3000`.
- **Errors:** Sentry (api, worker, web).
- **Logs:** structlog JSON to stdout → Docker `json-file` (20 MB × 5 per container); `dhc logs -f --since 1h api worker`. Never logged: passwords, session tokens, CSRF tokens, MFA secrets, payout-method details, document contents, presigned URLs' signatures (MASTER Part 24). Log retention 30 days (R-27) when a log shipper is added; v1 relies on rotated local files.
- **External:** Uptime Kuma (availability, TLS expiry), healthchecks.io (cron heartbeats).

If the 16 GB VM is chosen and memory is tight, the `monitoring` profile can run on the Uptime Kuma VM instead, scraping over a WireGuard tunnel; the metrics endpoints stay closed to the internet.

### 12.2 Tracked signals and metrics (MASTER Part 24)

| Signal | Metrics (Prometheus names) | Source |
|---|---|---|
| API errors | `datahub_http_requests_total{method,route,status}`; Sentry issue count | api |
| Request latency | `datahub_http_request_duration_seconds` (histogram, by route template) | api |
| Database health | `pg_up`, `pg_stat_activity_count{state}`, `pg_stat_database_deadlocks`, `pg_database_size_bytes`, `datahub_db_pool_checked_out`, `datahub_db_pool_timeouts_total` | postgres-exporter, api |
| Worker failures | `datahub_task_failures_total{task}`, `datahub_task_retries_total{task}`, `celery_task_failed_total`, `celery_workers` | worker, celery-exporter |
| Queue backlog | `datahub_queue_depth{queue}`, `datahub_queue_oldest_age_seconds{queue}` | api collector (Redis `LLEN` + `background_job_records`) |
| Upload failures | `datahub_upload_failures_total{reason}`, `datahub_uploads_completed_total`, `datahub_file_processing_failures_total{failure_code}`, `datahub_files_stuck{status}` (`uploaded` > 5 min, `processing` > 70 min) | api, worker |
| Malware scanning | `datahub_scan_results_total{result}`, `datahub_clamav_up` | worker |
| Storage usage | `datahub_storage_bytes{class}` (Σ object sizes from the DB, 15-min collector), `node_filesystem_avail_bytes{mountpoint}`, `datahub_storage_growth_bytes_24h` | api collector, node-exporter |
| Export failures | `datahub_export_jobs_total{status}`, `datahub_export_duration_seconds` | worker |
| Failed notifications | `datahub_email_outbox_pending`, `datahub_email_outbox_oldest_pending_age_seconds`, `datahub_email_send_failures_total`, `datahub_ws_publish_failures_total` | api collector, worker |
| Authentication anomalies | `datahub_auth_login_failures_total`, `datahub_auth_lockouts_total`, `datahub_auth_mfa_failures_total`, `datahub_security_events_total{type}`, `datahub_rate_limited_total{policy}` | api |
| Payment workflow errors | `datahub_ledger_reconcile_mismatches`, `datahub_reconcile_last_success_timestamp_seconds`, `datahub_payout_action_errors_total{action}`, `datahub_payouts_open_age_seconds_max`, `datahub_idempotency_conflicts_total` | worker, api |
| Application availability | Uptime Kuma probe of `/` and `/api/v1/readyz`; `up{job}` | external, Prometheus |
| Backups | `datahub_backup_last_success_timestamp_seconds{kind}`, `datahub_backup_size_bytes{kind}` (textfile collector written by `backup.sh`) | node-exporter |
| TLS | Uptime Kuma certificate expiry | external |

Labels never contain user IDs, emails or file names (cardinality and privacy).

### 12.3 Alerts

Severity: **critical** = page on-call any time; **warning** = email, handle next business hours.

| ID | Alert | Condition (for) | Severity | Runbook |
|---|---|---|---|---|
| AL-01 | SiteDown | Uptime Kuma: `/` or `/api/v1/readyz` failing from outside (3 consecutive checks) | critical | RB-01 |
| AL-02 | APIHighErrorRate | 5xx / all requests > 2 % (10 min) | critical | RB-01 |
| AL-03 | APILatencyHigh | p95 `datahub_http_request_duration_seconds` (non-file routes) > 0.3 s (15 min) | warning | RB-01 |
| AL-04 | PostgresDown | `pg_up == 0` (1 min) or `/readyz` check `postgres` failing | critical | RB-02 |
| AL-05 | DBPoolExhausted | `increase(datahub_db_pool_timeouts_total[5m]) > 0` or connections > 85 % of `max_connections` (5 min) | warning | RB-02 |
| AL-06 | QueueBacklog | `datahub_queue_oldest_age_seconds{queue="processing"} > 900` (10 min) or `{queue="email"} > 600` | warning | RB-03 |
| AL-07 | WorkerDown | `celery_workers == 0` (3 min) | critical | RB-01 |
| AL-08 | ProcessingFailuresSpike | `increase(datahub_file_processing_failures_total[1h]) > 20` excluding `type_mismatch`/`disallowed_type` | warning | RB-03 |
| AL-09 | FilesStuck | `datahub_files_stuck > 0` (30 min) | warning | RB-03 |
| AL-10 | ClamAVDown | `datahub_clamav_up == 0` (10 min) | critical | RB-03 |
| AL-11 | UploadFailureRate | upload failures / (completed + failures) > 5 % (30 min) | warning | RB-03 |
| AL-12 | ExportFailed | `increase(datahub_export_jobs_total{status="failed"}[1h]) > 0` | warning | RB-06 |
| AL-13 | EmailOutboxStuck | `datahub_email_outbox_oldest_pending_age_seconds > 600` or send failures > 10 in 15 min (SAD QAS-11: alert within 10 min) | warning | RB-01 (SMTP section) |
| AL-14 | LoginFailureSpike | `increase(datahub_auth_login_failures_total[10m]) > 100` or lockouts > 20 in 10 min | warning | RB-08 |
| AL-15 | MFAFailureSpike / AdminAnomaly | `increase(datahub_auth_mfa_failures_total[10m]) > 20` or security event `admin_ip_denied` | critical | RB-08 |
| AL-16 | LedgerReconcileMismatch | `datahub_ledger_reconcile_mismatches > 0` | critical | RB-05 |
| AL-17 | ReconcileNotRun | `time() - datahub_reconcile_last_success_timestamp_seconds > 93600` (26 h) | warning | RB-05 |
| AL-18 | PayoutActionErrors | `increase(datahub_payout_action_errors_total[1h]) > 3` | warning | RB-05 |
| AL-19 | DiskSpaceLow | root or scratch filesystem > 75 % used (warning), > 90 % (critical) | warning / critical | RB-07 |
| AL-20 | ObjectStorageGrowth | `datahub_storage_bytes` total > 80 % of the monthly budgeted capacity, or 24 h growth > 3× 7-day average | warning | RB-07 |
| AL-21 | BackupMissing | healthchecks.io `backup-db` or `backup-objects` late, or `time() - datahub_backup_last_success_timestamp_seconds{kind="db"} > 93600` | critical | RB-09 |
| AL-22 | TLSCertExpiring | certificate expires in < 14 days | warning | RB-01 |
| AL-23 | HostMemoryPressure | available memory < 10 % (10 min) or any container OOM-killed | warning | RB-01 |
| AL-24 | BeatHeartbeatMissing | healthchecks.io `beat-heartbeat` late | warning | RB-01 |
| AL-25 | SentryNewIssue | new issue in production | warning | triage per issue |

Alert rules live in `infrastructure/monitoring/alerts.yml`; each rule carries a `runbook` annotation pointing to the section below. Alerts are tested in staging (fire each rule once) before go-live.

## 13. Health checks

| Check | Endpoint / command | Meaning | Used by |
|---|---|---|---|
| API liveness | `GET /api/v1/healthz` → 200 `{"status":"ok","version":…}` | Process up; no dependency checks | Docker healthcheck, Caddy `health_uri`, deploy version check |
| API readiness | `GET /api/v1/readyz` → 200 when Postgres (`SELECT 1` + Alembic head), Redis `PING`, S3 `HeadBucket` respond within 2 s; 503 otherwise; ClamAV failure → `degraded` (API serves, processing pauses) | Dependencies | Uptime Kuma, deploy health wait, release verification |
| Web | `GET /healthz` on the web container | Next.js server up | Docker healthcheck |
| Worker | `celery -A datahub.worker inspect ping` | Worker consuming | Docker healthcheck |
| Beat | `python -m datahub.cli beat-health --max-age 900` (heartbeat key written by `admin.requeue_stalled` every 5 min) | Scheduling pipeline alive | Docker healthcheck, healthchecks.io |
| Postgres | `pg_isready` | Accepting connections | Docker healthcheck |
| Redis | `redis-cli ping` | Up | Docker healthcheck |
| ClamAV | `clamdcheck.sh` (clamd `PING`) | Signatures loaded | Docker healthcheck (start period 300 s) |
| Caddy | admin API `127.0.0.1:2019/config/` | Proxy up | Docker healthcheck |

Docker restarts unhealthy containers (`restart: unless-stopped` plus healthcheck-based restarts by the `deploy.sh`-installed `datahub-autoheal` systemd timer, which restarts any container unhealthy for > 5 min and logs it). Liveness checks never depend on other services, so an outage of Postgres does not cause restart storms of api/web.

## 14. Release verification

Automated (`verify-production` job) and then manually confirmed by the on-call engineer; evidence (job URL, screenshots where useful) is attached to the GitHub Release.

| # | Check | Pass condition |
|---|---|---|
| V-01 | Version | `/api/v1/healthz` `version` equals `X.Y.Z`; web footer build id equals the git SHA |
| V-02 | Readiness | `/api/v1/readyz` 200 with `postgres`, `redis`, `s3`, `clamav`, `migrations` all `ok` |
| V-03 | TLS and headers | HSTS present, certificate valid ≥ 14 days, `/api/v1/metrics` returns 404 publicly |
| V-04 | Public pages | `/`, `/pricing`, `/login` return 200 and render (Playwright `@prod-smoke`) |
| V-05 | Login | Production smoke account `smoke@<domain>` (contributor role only, flagged test account, no payout method) logs in and out |
| V-06 | Upload path | Smoke account obtains a presigned part URL for a 1 MB file in its "[SMOKE TEST]" draft dataset, uploads it, completes; the file reaches `ready` within 2 min; the draft is then withdrawn (purged after 30 days, R-02). Never submitted, never paid. |
| V-07 | Realtime | WebSocket `/api/v1/ws` connects with the smoke session |
| V-08 | Email | A password-reset email to the smoke mailbox arrives within 2 min (Postmark activity shows delivered) |
| V-09 | Workers | `celery inspect ping` OK; queue depths near 0 after 10 min |
| V-10 | Errors | No new Sentry issues tagged `X.Y.Z` with > 5 events in 30 min; 5xx ratio < 0.5 % |
| V-11 | Admin | A super_admin logs in with MFA and opens Finance → Reconciliation (last run status `ok`) |

No real money is moved during verification (MASTER Part 25). The release is "verified" only when V-01 to V-11 pass.

## 15. Rollback procedure

1. **Decide** (on-call engineer, informing the owner): roll back if V-checks fail, AL-02/AL-16 fire after the deploy, or a release-blocking bug is confirmed. Prefer rollback over hot-fix when users are affected.
2. **Roll back code:** `ssh <operator>@<prod> sudo -u deploy /srv/datahub/deploy.sh --rollback` (switches to `release.env.previous`, skips migrations, restarts api/web/worker/beat, waits for health). Alternatively run `release.yml` with `version=<previous>` and `target=production` (requires approval).
3. **Verify:** V-01 (previous version), V-02, V-04, V-05; watch AL-02 for 15 min.
4. **Schema:** stays at the new revision (expand-only). Downgrade only per DOCKER_CICD §9 when the release notes mark the migration reversible and data-safe, with CTO approval.
5. **Data damage:** if the faulty release wrote wrong data, set `maintenance_mode=true`, assess scope from `audit_logs` and ledger, fix with corrective actions (adjustment journals, re-processing). Restoring the pre-deploy backup is the last resort, requires owner approval, and follows BACKUP_DISASTER_RECOVERY §7.3.
6. **Record:** `releases.log`, incident note in `docs/PROJECT_STATUS.md`, follow-up issue.

## 16. Runbooks

Conventions: `dhc` = production Compose wrapper (§5). SQL is run read-only first: `dhc exec postgres psql -U datahub_owner -d datahub`. Every manual data change is done through the application (admin UI/API/CLI) so it is audited; direct SQL writes are forbidden except where a runbook explicitly says so and the CTO role approves.

### RB-01 Service outage (site down, 5xx, worker/beat down, SMTP failing)

- **Detect:** AL-01, AL-02, AL-07, AL-13, AL-22, AL-23, AL-24; user reports.
- **Diagnose:**
  1. `dhc ps` — which containers are not `healthy`?
  2. `dhc logs --since 30m <service>` — crash loop, OOM (`docker inspect datahub_<svc> --format '{{.State.OOMKilled}}'`), config error.
  3. `curl -s https://<domain>/api/v1/readyz` — which dependency fails? (Postgres → RB-02; S3 → check Cloudflare status page and token; ClamAV → RB-03.)
  4. Host: `df -h`, `free -m`, `uptime`; Hetzner console for VM/network incidents.
  5. Recent change? `tail /srv/datahub/releases.log`.
- **Resolve:**
  - Crashed container: `dhc up -d <service>`; if OOM, raise its limit temporarily in `compose.prod.yaml` and open an issue.
  - Bad release: rollback (§15).
  - Disk full: RB-07.
  - Caddy/TLS: `dhc logs caddy` for ACME errors; ensure 80/443 open and DNS A/AAAA correct; Caddy retries automatically.
  - SMTP failures (AL-13): check Postmark status and credentials (`dhc logs worker | grep send_email`); outbox rows stay `pending` and are retried with backoff — after fixing, `admin.requeue_stalled` re-enqueues them; no manual resend needed.
  - Beat missing: `dhc restart beat`; confirm exactly one beat container.
  - VM lost: disaster recovery (BACKUP_DISASTER_RECOVERY §7.2).
- **Verify:** `/api/v1/readyz` 200; Uptime Kuma green for 15 min; error rate < 0.5 %.
- **Escalate / communicate:** if not resolved in 30 min, notify the owner; status note on the login page via `maintenance_mode` if the outage is planned work; post-incident review for any outage > 15 min (counts against 99.5 % = 3.6 h/month).

### RB-02 Database connection failure

- **Detect:** AL-04, AL-05; `/readyz` `postgres` failing; API 503/500 with `OperationalError` in logs.
- **Diagnose:**
  1. `dhc ps postgres`; `dhc logs --since 30m postgres` (crash, `could not write`, `too many connections`, recovery in progress).
  2. Disk: `df -h /srv/datahub/pgdata` (Postgres stops writing when full).
  3. Connections: `SELECT state, count(*) FROM pg_stat_activity GROUP BY 1;` and long transactions `SELECT pid, now()-xact_start AS age, state, left(query,80) FROM pg_stat_activity WHERE xact_start IS NOT NULL ORDER BY age DESC LIMIT 10;`
  4. Locks: `SELECT * FROM pg_locks WHERE NOT granted;`
  5. Credentials changed? Compare secret files with roles (`dhc logs api | grep "password authentication failed"`).
- **Resolve:**
  - Container down: `dhc up -d postgres`; wait for crash recovery to finish (logs `database system is ready`), then `dhc restart api worker beat`.
  - Pool exhaustion / runaway query: `SELECT pg_cancel_backend(<pid>);` then `pg_terminate_backend` if needed; find the endpoint/task from `application_name` and `request_id` in logs; open a bug.
  - Disk full: RB-07, then start Postgres.
  - Data directory corruption or unrecoverable crash: stop writers (`dhc stop api worker beat`), escalate to the CTO role and follow BACKUP_DISASTER_RECOVERY §7.1.
- **Verify:** `pg_isready`; `/readyz` 200; `datahub_db_pool_timeouts_total` flat; run `dhc exec api python -m datahub.cli finance-reconcile` (read-only) after any crash.
- **Escalate:** > 30 min or any suspicion of data loss → owner + CTO role.

### RB-03 Failed upload processing

- **Detect:** AL-06 (processing backlog), AL-08, AL-09, AL-10, AL-11; contributor reports "stuck processing".
- **Diagnose:**
  1. Backlog vs. failures: Grafana "Uploads & processing"; `dhc exec api celery -A datahub.worker inspect active`.
  2. Stuck files: `SELECT processing_status, scan_status, failure_code, count(*) FROM dataset_files WHERE processing_status IN ('uploaded','processing','failed') AND updated_at > now() - interval '24 hours' GROUP BY 1,2,3;`
  3. Job errors: `SELECT task_name, status, attempts, last_error, finished_at FROM background_job_records WHERE task_name LIKE 'datahub.processing.%' AND status <> 'succeeded' ORDER BY created_at DESC LIMIT 20;`
  4. ClamAV: `dhc ps clamav`, `dhc logs --since 1h clamav` (signature reload, OOM).
  5. Storage: S3 errors in worker logs (`storage_unavailable`, 403 → token revoked/expired).
  6. Scratch disk: `df -h /mnt/datahub-scratch`.
- **Resolve:**
  - ClamAV down: `dhc restart clamav`, wait ≤ 5 min for `healthy`. Files wait fail-closed (`scan_status` stays `pending`/`error`, never payable, A-10); after recovery admins trigger `POST /admin/files/{id}/rescan` for files with `scan_status='error'` (bulk: Admin → Datasets → Files → filter "scan error" → Rescan).
  - Files `uploaded` > 5 min or `processing` beyond the task hard limit: `admin.requeue_stalled` re-enqueues them every 5 min (AM-10); if it is not running, see RB-01 (beat). Force a run: `dhc exec worker celery -A datahub.worker call datahub.admin.requeue_stalled`.
  - Genuine content failures (`type_mismatch`, `disallowed_type`, `nested_archive`, zip limits): expected; the contributor sees the reason; no action.
  - Infected files: moved to `quarantine/`, `quarantined`; check the security dashboard; if many from one account, RB-08.
  - Backlog only (healthy but slow): temporarily raise `CELERY_CONCURRENCY` within memory limits, or start a second worker for `-Q processing` (SAD §9 S2).
- **Verify:** stuck count 0; backlog age < 5 min; sample affected dataset shows files `ready`.
- **Communicate:** reply to the contributor's support conversation with the outcome; uploads themselves are never lost (objects stay in R2).

### RB-04 Stuck annotation task

- **Detect:** project dashboard shows tasks past `due_at`; annotator reports a lock/409 loop; reviewer queue not moving.
- **Diagnose:**
  1. Tasks overdue or idle: `SELECT t.id, t.status, t.current_assignee_id, t.current_reviewer_id, t.due_at, t.updated_at FROM annotation_tasks t WHERE t.status IN ('assigned','in_progress','in_review','changes_requested') AND (t.due_at < now() OR t.updated_at < now() - interval '7 days') ORDER BY t.updated_at LIMIT 50;`
  2. Active assignment consistency: `SELECT task_id, count(*) FROM annotation_assignments WHERE status='active' GROUP BY 1 HAVING count(*) > 1;` (must be empty — partial unique index).
  3. 409 loops: client keeps an old `If-Match` version; check `annotations.version` against the client's version in API logs (`request_id`).
  4. Annotator account suspended or lost the `annotator` role?
- **Resolve:**
  - Inactive annotator: admin uses `POST /annotation/tasks/{id}/unassign` (UI: Project → Tasks → Unassign) then `POST /annotation/tasks/{id}/assign` to another annotator. Drafts are preserved in `annotation_versions`; the new assignee continues from the latest draft.
  - Reviewer inactive on `in_review`: admin releases the review claim from the annotation review queue (task returns to `submitted`) so another reviewer can claim it.
  - Persistent 409: ask the user to reload the editor (fetches the server copy); if the version keeps changing, look for a second open tab/device (two sessions in `user_sessions`).
  - Project closed while tasks were open: tasks are `cancelled` by design; no reward.
- **Verify:** task moves to the expected status; annotator sees it in "My tasks"; audit log shows the reassignment.
- **Never:** edit `annotations` or `annotation_versions` rows directly.

### RB-05 Wallet reconciliation problem

- **Detect:** AL-16 (mismatch), AL-17 (reconcile not run), AL-18; in-app notification to super_admins; contributor reports a wrong balance.
- **Diagnose:**
  1. Report: `GET /admin/finance/reconciliation` (UI: Finance → Reconciliation) lists failed checks: (1) cached balance ≠ Σ lines per wallet/bucket, (2) journal not zero-sum, (3) reserved ≠ open payouts, (4) paid ≠ paid − reversed payouts, (5) system purchases ≠ dataset earnings.
  2. Re-run on demand (read-only): `dhc exec api python -m datahub.cli finance-reconcile`.
  3. For a wallet: `SELECT bucket, sum(amount_micros) FROM wallet_transactions WHERE wallet_id = '<id>' GROUP BY bucket;` compared with `SELECT pending_micros, available_micros, reserved_micros, paid_micros FROM wallets WHERE id = '<id>';`
  4. Recent journals for that wallet with `idempotency_key`, `kind`, `created_by`, and the matching `audit_logs` rows.
- **Resolve:**
  - **Immediately:** finance admins stop approving and marking payouts paid until resolved (announced in the admin channel). Contributors can still request payouts; requests wait.
  - Check type (1) only (lines correct, cache wrong): `dhc exec api python -m datahub.cli finance-rebuild-cache --wallet-id <id>` recomputes cached columns from lines under `FOR UPDATE` and writes an audit row. Requires CTO approval.
  - Types (2)–(5) (ledger lines wrong): never update or delete ledger rows (triggers block it). A super_admin posts a corrective adjustment (`POST /admin/adjustments`, step-up MFA) with a reason referencing the incident; a second admin reviews it. Root-cause the code path; add a regression test.
  - Reconcile not running (AL-17): RB-01 (beat/worker), then re-run.
- **Verify:** reconcile reports 0 mismatches; affected users' wallet pages match; resume payout processing.
- **Escalate:** any mismatch → owner and finance lead the same day; mismatches affecting paid amounts → treat as incident (RB-08 communication steps).

### RB-06 Failed export

- **Detect:** AL-12; admin sees export `failed` with `error_code`.
- **Diagnose:**
  1. `SELECT code, status, attempts, error_code, error_message, file_count, total_bytes, started_at, failed_at FROM export_jobs WHERE status = 'failed' ORDER BY failed_at DESC LIMIT 10;`
  2. Worker logs for the job's `celery_task_id`: time limit (4 h hard), S3 write errors, scratch disk full, objects missing (purged by retention or takedown after selection).
  3. Size: very large selections can exceed the time limit.
- **Resolve:**
  - Transient (S3/network, worker restart): create the export again with the same filters (`POST /admin/exports`); exports are idempotent per job and cheap to recreate.
  - Time limit / size: split the selection (by dataset, date range or category) into several exports.
  - Missing objects: expected if data was taken down/purged; exclude those datasets.
  - Scratch full: RB-07.
- **Verify:** new job `completed`; download URL works; manifest row count equals `file_count`.
- **Note:** export packages expire after 7 days (A-15); expired is not failed.

### RB-07 Storage capacity warning

- **Detect:** AL-19 (VM disk), AL-20 (object storage growth), R2 billing notification.
- **Diagnose:**
  1. VM: `df -h`; `docker system df`; `du -sh /srv/datahub/pgdata /var/lib/docker/containers /mnt/datahub-scratch`.
  2. Postgres: `SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;`
  3. Objects: Grafana "Storage" (`datahub_storage_bytes{class}`); top uploaders in the last 24 h (Admin → Analytics); is `retention.purge` running (`background_job_records`)?
- **Resolve:**
  - VM disk: `docker image prune -a --filter "until=720h"` (keeps the current and previous release images in use), clear orphaned scratch files older than 24 h (`find /mnt/datahub-scratch -mindepth 1 -mmin +1440 -delete` — only when no export/processing task is running), check container log rotation; grow the disk (Hetzner rescale or larger volume) if growth is organic.
  - Object storage: verify lifecycle rules applied (`storage-setup --verify`); verify `retention.purge` runs; an abusive uploader → suspend (RB-08) and the `user_pending_quota_bytes` setting; organic growth → update the budget with the owner (R-11) and the cost table §4.2.
- **Verify:** usage below the warning threshold; growth rate explained.

### RB-08 Security incident

- **Detect:** AL-14, AL-15, Sentry anomalies, malware spikes, ZAP/Trivy critical finding being exploited, external report (`security@` mailbox), unusual admin actions in `audit_logs`, leaked credential.
- **Severity:** SEV-1 confirmed compromise of admin accounts, secrets, data or money; SEV-2 suspected compromise or active attack without confirmed impact; SEV-3 vulnerability without exploitation.
- **Contain (SEV-1/2), in order, recording times:**
  1. Open an incident note (time-stamped log in the private incident folder); appoint an incident lead.
  2. If data or money is at risk: `maintenance_mode=true` (admins keep access); finance stops payouts.
  3. Revoke sessions of affected accounts (`POST /admin/users/{id}/revoke-sessions`) or all sessions (`dhc exec api python -m datahub.cli revoke-all-sessions`); suspend compromised accounts.
  4. Rotate exposed secrets (DOCKER_CICD §8): R2 token, SMTP token, DB/Redis passwords, `SECRET_KEY`; redeploy with `deploy.sh --restart`.
  5. Block abusive IPs at the Hetzner firewall or `ADMIN_IP_ALLOWLIST` for admin paths.
- **Preserve evidence:** export `audit_logs`, `security_events`, Caddy and API logs for the window to the backup bucket `evidence/` prefix (read-only key); take a Hetzner snapshot of the VM before cleanup; do not wipe anything until the lead agrees.
- **Eradicate and recover:** patch the vulnerability (emergency release with owner approval), rebuild the VM from a clean image if the host is compromised (BACKUP_DISASTER_RECOVERY §7.2), restore data only from backups older than the compromise.
- **Notify:** owner immediately; legal counsel for personal-data breaches — notification duties and deadlines depend on HA-03 (Cambodian PDP law; GDPR 72 h if EU residents are affected); affected users with plain-language facts; payment partners if payout data is involved.
- **Close:** post-incident review within 5 business days, action items in `RISK_REGISTER.md`.

### RB-09 Backup restoration

Full procedures: [BACKUP_DISASTER_RECOVERY.md](BACKUP_DISASTER_RECOVERY.md) §7. Summary:

- **Detect / trigger:** AL-21 (backup missing — fix the backup first: check `journalctl -u datahub-backup-db`, B2 key validity, disk; run `scripts/backup.sh --kind manual`), data loss, DB corruption, VM loss, faulty release with data damage.
- **Decide:** owner approves any production restore that discards data written after the backup point.
- **Restore:** `scripts/restore.sh --from <backup object> --target production` (stops writers, decrypts with the escrowed age key, `pg_restore`, runs `retention-purge --replay-since <backup timestamp>` per DATA_RETENTION_DELETION RT-06, integrity checks, restarts).
- **Verify:** integrity checks of BACKUP_DISASTER_RECOVERY §9 all pass; release verification V-01–V-11.
- **Communicate:** announce the data-loss window to affected users (uploads during the window must be re-done; their objects may still exist in R2 and can be re-linked by the admin tool `python -m datahub.cli reconcile-objects --since <ts>`).

## 17. Break-glass: super_admin account recovery (two-person procedure)

Used when a super_admin has lost the TOTP device and all recovery codes (AUTH_AUTHORIZATION §9).

1. The requester contacts the second super_admin (or the owner) by a known phone number; identity is verified out of band (video call + known personal detail).
2. Two people are present (in person or on a recorded call): the operator with SSH access and the approver (owner or the other super_admin).
3. The operator runs `dhc exec api python -m datahub.cli create-admin --reset-mfa --email <account email>`; the CLI asks the approver to type their own email and current TOTP code, writes a `security_events` row and an `audit_logs` row naming both people, revokes all sessions of the account and forces MFA re-enrolment.
4. The requester logs in, re-enrols MFA, stores new recovery codes.
5. The incident note records date, people, reason. If **both** super_admins are locked out, the owner and one engineer perform the same steps; the CLI then accepts the owner's confirmation phrase stored in the password manager vault instead of a TOTP.

## 18. Production deployment status and owner checklist (HA-05)

**Status:** not deployed. Automation will be completed in the implementation phases; deployment is blocked until the owner completes the steps below. Each step lists what the engineer needs back. Credentials are handed over only through the password manager vault "DataHub Production" (never chat or email).

| # | Owner action | Deliverable to the engineer |
|---|---|---|
| 1 | Choose and register the production domain (and confirm the brand name); move its DNS to Cloudflare (free plan); enable DNSSEC at the registrar. | Domain name; Cloudflare API token limited to **Zone → DNS → Edit** for this zone |
| 2 | Open a Hetzner Cloud account (company billing), create project `datahub`; decide the location (Singapore vs. EU, considering latency and included traffic, §4.2); approve the monthly budget in §4.2. | Project member invitation for the engineer (role Member); chosen location |
| 3 | Order (or let the engineer order): production CCX33 (or CPX41 if the budget option is approved) with Hetzner backups, 100 GB volume, staging CPX31, monitoring CX22 in a different location. Provide the list of admin IP addresses for SSH. | Server IPs; admin IP list |
| 4 | Enable Cloudflare R2 (payment method required); create buckets `datahub-private` and `datahub-staging-private` (location hint Asia-Pacific, public access off); create tokens: app-prod (Object Read & Write, `datahub-private` only), app-staging (Object Read & Write, staging bucket only), storage-admin (temporary, Admin Read & Write). Set R2 usage notifications at 8 TB and 16 TB. | Account ID; three key pairs in the vault |
| 5 | Open a Backblaze B2 account; create private buckets `datahub-backups-db` and `datahub-backups-objects` with default encryption (SSE-B2) and the lifecycle rules of BACKUP_DISASTER_RECOVERY §4; create application keys **without `deleteFiles`** for each bucket, plus one restore key (read-only). | Key IDs/keys in the vault |
| 6 | Generate the backup encryption key pair on your own computer (`age-keygen -o datahub-backup.key`); store the private key in the vault **and** on an offline medium in a sealed envelope in the office safe; give only the public key (`age1…`) to the engineer. | age public key |
| 7 | Open a Postmark account (or Brevo); add the sending domain; publish the DKIM and Return-Path records (or let the engineer do it with the DNS token); request production sending approval. | SMTP server token; confirmed sender address (e.g. `no-reply@<domain>`) and support mailbox address |
| 8 | Create a Sentry organisation with projects `datahub-api` and `datahub-web`. | Two DSNs |
| 9 | Create a healthchecks.io account (ops mailbox) and decide the on-call notification channel (Telegram, SMS or phone app). | Ping URLs; on-call contact |
| 10 | GitHub: ensure the repository is owned by the organisation account; enable GHCR; create Environments `staging` and `production`; set **required reviewers** for `production` (owner + one engineer); restrict `production` deployments to tags `v*.*.*`; protect `main` and tags. | `GHCR_OWNER` value; confirmation |
| 11 | Provide an operations mailbox (e.g. `ops@<domain>`) used for ACME, alerts and DMARC reports, and `security@<domain>` for vulnerability reports. | Addresses |
| 12 | Approve the dual-approval payout threshold (HA-07, default $100.00) and labeled-upgrade policy (HA-08). | Decision recorded in `DECISION_LOG.md` |
| 13 | Obtain legal approval of Contributor Agreement, Terms, Privacy Policy, licence model, personal-data and tax rules (HA-01–HA-04) and the backup-retention disclosure (BACKUP_DISASTER_RECOVERY §6). | Signed-off texts; enables `legal_docs_approved=true` |
| 14 | Name two people who will hold super_admin accounts (needed for the two-person break-glass, §17). | Names and emails |
| 15 | After the engineer reports RELEASE_READINESS evidence complete: approve the production deployment in GitHub and authorise switching `maintenance_mode` off. | Approval in the GitHub `production` environment |

Engineer actions after steps 1–11: §10.1 bootstrap, §14 verification, BACKUP_DISASTER_RECOVERY §8 first restore drill. The application is reported as live only after V-01–V-11 pass on the production URL.

## 19. Operations handover

| Item | Location |
|---|---|
| Architecture and topology | SAD §4, §8; HLD §8 |
| Environment variables | DOCKER_CICD §4 |
| Deploy / rollback | §10, §15; DOCKER_CICD §7–§9 |
| Runbooks | §16 |
| Backup / restore | BACKUP_DISASTER_RECOVERY |
| Admin setup | §10.1 step 9; README "First administrator" |
| Credentials | Password manager vault "DataHub Production" (owner-controlled) |
| Release history | `/srv/datahub/releases.log`, GitHub Releases, `docs/PROJECT_STATUS.md` |
| Readiness evidence | [RELEASE_READINESS.md](../RELEASE_READINESS.md) |
| Risks | [RISK_REGISTER.md](../RISK_REGISTER.md) (R-07 memory, R-08 credentials, R-11 storage cost, R-13 single VM) |

On-call: business hours Monday–Saturday 08:00–20:00 Asia/Phnom_Penh for warnings; critical alerts page the on-call engineer at any time. Weekly ops review: alerts fired, backup status, storage growth, Sentry top issues, pending security updates.
