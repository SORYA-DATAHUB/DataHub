# DataHub — Low-Level Design (LLD)

## Document control

| Field | Value |
|---|---|
| Document | `docs/02-system-architecture/LLD.md` (mandatory document #9) |
| Version | v1.1 (baseline §16 amendments AM-01…AM-10, AM-14 applied) |
| Date | 2026-10-26 |
| Status | Baseline |
| Owner | CTO role (backend architecture) |
| Canonical source | `docs/ENGINEERING_BASELINE.md` v1.1 (incl. §16 amendments) — the baseline wins on conflict |
| Companion documents | `DATABASE_SCHEMA.md` v1.1 (table/column contract), `ERD.md` v1.1, `HLD.md`, `SDD.md`, `docs/04-backend-api/API_DOCUMENTATION.md` |
| Change control | Signature or transaction-boundary changes require an update here in the same pull request; behavioural changes are recorded in `DECISION_LOG.md`. |

## Purpose

Specify the internal design of the FastAPI modular monolith (`apps/api`, package `datahub`) precisely enough to implement it without further design work: package layout per module, key classes and service functions with signatures, HTTP handler ↔ endpoint mapping, request validation rules, transaction boundaries and row locks, state-transition tables for every baseline §9 state machine, background-job designs, and the cross-cutting core components.

## Scope

- Backend only (`apps/api/src/datahub`). The web app is covered by the UI/UX documents.
- Modules: `core` (cross-cutting, at `datahub/core/`), `identity`, `datasets`, `processing`, `review`, `finance`, `annotation`, `messaging`, `exports`, `admin` (at `datahub/modules/<m>/`).
- All endpoints of baseline §12, all jobs of baseline §13 plus the supplementary jobs defined in §13 of this document, all state machines of baseline §9.
- Table and column names are those of `DATABASE_SCHEMA.md`; they are not repeated in full here.

## Assumptions

| ID | Assumption |
|---|---|
| A-03 | (baseline) ≤ 200 concurrent sessions, ≤ 50 concurrent uploads; one API process with 4 Uvicorn workers × 40 threadpool threads and 2 worker containers suffice for v1. |
| A-07 | (baseline) Earning hold defaults to 0 days; when > 0 credits land in `pending`. |
| A-10 | (baseline) Scanning is fail-closed. |
| A-LLD-01 | Handlers are synchronous (`def`), executed in Starlette's threadpool; only the WebSocket endpoint is `async` (baseline §3). |
| A-LLD-02 | Isolation level is PostgreSQL default `READ COMMITTED`; correctness for money and state transitions comes from explicit row locks (`SELECT … FOR UPDATE`), guarded `UPDATE … WHERE status = …`, unique constraints and advisory locks — not from `SERIALIZABLE`. |
| A-LLD-03 | clamd cannot scan a single stream ≥ 4 GiB (`StreamMaxLength`/`MaxScanSize` ceiling). Baseline AM-01 therefore fixes the per-file limit (`max_file_bytes`) at 4,000,000,000 bytes for uploads and extracted ZIP members; see D-LLD-07. |

## Decisions

| ID | Decision | Rationale |
|---|---|---|
| D-LLD-01 | **Services own transactions.** A public service function either *opens* a transaction (called from a router or task) or *joins* the caller's transaction (called from another service). `core.db.transactional` implements both: if `db.in_transaction()` it joins, otherwise it begins and commits. | One request = one business transaction; cross-module operations (e.g. review finalize + ledger credit + notifications) commit atomically. |
| D-LLD-02 | **Module dependency direction** (enforced by `import-linter` "layers" contracts in CI), lowest first: `core` → `messaging` → `identity` → `finance` → `datasets` → `review` → `processing`, `annotation` → `exports` → `admin`. A module may import the `service`/`schemas` of modules *below* it only. `messaging` sits below `identity` and is allowed the read-only lookups listed in §15 (recipient email, locale, notification preferences, support-role membership); orchestration that needs several high-level modules (account-deletion processing, admin search) lives in `admin`. | Prevents import cycles; keeps the ledger independent of review/annotation details (they pass typed inputs to finance). |
| D-LLD-03 | **Side effects outside the DB happen after commit**: Celery enqueue and WebSocket publish are registered with `core.db.after_commit(db, fn)`; email goes through the transactional outbox table. Sweeper jobs repair the rare case where the process dies between commit and enqueue. | No phantom jobs for rolled-back transactions; no lost work. |
| D-LLD-04 | **Global lock order** inside a transaction: `users` → `datasets` → `dataset_reviews` → `annotation_projects` → `annotation_tasks` → `annotation_reviews` → `payout_requests` → `wallets` (ascending `id` if several of one kind) → content-hash advisory locks (ascending hash). | Deadlock avoidance; every service in this document respects it. |
| D-LLD-05 | State transitions are implemented as **guarded updates** (`UPDATE … SET status = :to WHERE id = :id AND status = ANY(:from) RETURNING …`) or after `SELECT … FOR UPDATE`; a zero-row result raises `InvalidStateTransition` (HTTP 409). Transition tables live in one place per module (`models.py` constant `<ENTITY>_TRANSITIONS`). | Concurrency-safe and auditable. |
| D-LLD-06 | Errors are raised as `core.errors.AppError` subclasses and rendered by one exception handler into the baseline envelope `{"error":{"code","message","details","request_id"}}`. | Uniform client handling. |
| D-LLD-07 | Upload init and archive expansion reject files/members larger than `max_file_bytes` (default and maximum 4,000,000,000 bytes — baseline AM-01, `DECISION_LOG.md` D-014); every object is scanned whole (no windowed scan), because a file that cannot be scanned can never be accepted (A-10). The settings validator refuses values above 4,000,000,000. | Fail-closed scanning is non-negotiable; contributors learn the limit before uploading rather than after. |
| D-LLD-08 | Finance credit functions receive **typed input DTOs** from the calling module (e.g. `DatasetEarningInputs`) instead of reading review/annotation tables. | Respects the module table-ownership rule (baseline §4) and D-LLD-02. |

## Dependencies

- `docs/ENGINEERING_BASELINE.md` v1.0 (§3 stack, §4 layout, §6 permissions, §7 formats, §8 money, §9 state machines, §11 annotation, §12 API, §13 jobs).
- `docs/_source/MASTER_PROMPT.md` Parts 5 (items 9, 11, 12), 7, 9–14.
- `DATABASE_SCHEMA.md` v1.0, `ERD.md` v1.0.
- Libraries: FastAPI, Pydantic v2, pydantic-settings, SQLAlchemy 2.0 + psycopg 3, Alembic, Celery 5, redis-py (sync + asyncio), boto3, argon2-cffi, pyotp, cryptography, python-magic, pypdfium2, Pillow, python-docx, openpyxl, striprtf, defusedxml, structlog.

## Acceptance criteria

1. Every endpoint of baseline §12 maps to exactly one handler and one service function in §4–§12.
2. Every state machine of baseline §9 has a transition table (from, event, guard, to, side effects) in §14, and every transition writes `audit_logs`.
3. Every money-moving operation states its transaction boundary, its locks and its idempotency key, matching baseline §8.5.
4. Every job of baseline §13 has a design with trigger, idempotency mechanism and retry policy in §13.
5. Core components listed in the task brief (settings, DB session, errors, `require_permission`, audit writer, Redis sliding-window limiter, storage adapter with internal/public endpoints, clamd client, file sniffer) are specified with interfaces in §3.
6. No function in this document reads or writes a table owned by another module, except the read-only admin search joins listed in §12.4.

---

## 1. Package layout

```
apps/api/src/datahub/
├── main.py                    # create_app(): middleware, routers, exception handlers, lifespan
├── worker.py                  # Celery app, queues, beat schedule, task autodiscovery
├── core/
│   ├── config.py              # Settings (pydantic-settings), get_settings()
│   ├── db.py                  # engine, SessionLocal, get_db, transactional, after_commit, locks
│   ├── models_base.py         # DeclarativeBase with NAMING_CONVENTION, mixins (Timestamps, LockVersion)
│   ├── errors.py              # AppError hierarchy, exception handlers, error codes
│   ├── context.py             # RequestContext (request_id, ip, user_agent), contextvars
│   ├── security.py            # passwords (argon2id), tokens, sha256, TOTP, field encryption
│   ├── auth.py                # Actor, get_current_actor, session cookie handling
│   ├── permissions.py         # PERMISSIONS registry, require_permission, require_admin
│   ├── csrf.py                # CSRF middleware (double-submit, signed)
│   ├── audit.py               # audit writer
│   ├── ratelimit.py           # Redis sliding-window limiter + dependency factory
│   ├── storage.py             # S3 storage adapter (internal + public endpoints), key builders
│   ├── clamd.py               # clamd INSTREAM client
│   ├── sniffer.py             # file type detection & validation
│   ├── runtime_settings.py    # typed accessors for system_settings (Redis-cached)
│   ├── jobs.py                # DataHubTask base class, enqueue_after_commit, job records
│   ├── realtime.py            # Redis pub/sub publisher (sync) for WebSocket fan-out
│   ├── pagination.py          # PageParams, Page[T], sort parsing
│   ├── idempotency.py         # Idempotency-Key header dependency
│   ├── codes.py               # human reference codes DS-/PO-/EX-YYYY-NNNNNN (AM-07)
│   └── logging.py             # structlog config, request-id middleware, Sentry init
└── modules/
    └── <module>/
        ├── __init__.py
        ├── router.py          # APIRouter(s): handlers only — parse, authorise (deps), call service, map to schema
        ├── service.py         # business logic; owns transactions; the only public API of the module
        ├── models.py          # SQLAlchemy models for tables the module owns; StrEnums; transition tables
        ├── schemas.py         # Pydantic request/response models and cross-module DTOs
        ├── repository.py      # optional: query helpers used only by service.py
        └── tasks.py           # Celery tasks (thin: open session, call service, handle retry)
```

Module-specific extra files are listed in each module section (e.g. `processing/archive.py`). Tests mirror the layout under `apps/api/tests/<module>/`.

### 1.1 Rules

1. `router.py` never touches the session except to pass it to a service; it contains no business rules.
2. `service.py` functions take `db: Session` as first argument and an `actor: Actor` (or `actor_id: UUID | None` for system jobs) where a human is involved; they return ORM objects or DTOs, never `Response` objects.
3. Cross-module calls go through the other module's `service.py` only (baseline §4).
4. Every state-changing service function calls `core.audit.record(...)` before returning.
5. Every service function that lists data accepts `PageParams` and returns `Page[T]`.

### 1.2 Table ownership

| Module | Tables (writes) |
|---|---|
| identity | `users`, `user_profiles`, `roles`, `user_roles`, `user_sessions`, `email_verifications`, `contributor_verifications`, `payout_methods`, `agreement_acceptances`, `security_events`, `mfa_recovery_codes`, `deletion_requests` |
| datasets | `datasets`, `dataset_versions`, `dataset_files`, `dataset_metadata`, `upload_sessions`, `upload_parts`, `dataset_licenses`, `dataset_duplicates`, `file_previews` |
| processing | none (writes through `datasets.service` internal functions) |
| review | `dataset_reviews`, `dataset_file_reviews`, `dataset_quality_scores` |
| finance | `pricing_rules`, `wallets`, `ledger_journals`, `wallet_transactions`, `earning_records`, `payout_requests`, `payout_approvals`, `payout_records`, `payout_adjustments` |
| annotation | `annotation_projects`, `annotation_project_datasets`, `annotation_tasks`, `annotation_assignments`, `annotations`, `annotation_versions`, `annotation_reviews`, `annotation_feedback`, `annotation_rewards` |
| messaging | `conversations`, `conversation_participants`, `messages`, `message_attachments`, `notifications`, `email_outbox` |
| exports | `export_jobs`, `export_files` |
| admin | `system_settings`, `takedown_requests` |
| core | `audit_logs` (via `core.audit`), `background_job_records` (via `core.jobs`), `dataset_code_counters` (via `core.codes`, AM-07) |

---

## 2. Request pipeline

Middleware order (outermost first) in `main.create_app()`:

1. `RequestIdMiddleware` — reads `X-Request-ID` (if from trusted proxy and matches `^[A-Za-z0-9-]{8,64}$`) else generates UUIDv7; binds to structlog contextvars; echoes header.
2. `SecurityHeadersMiddleware` — `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cache-Control: no-store` on `/api/*`.
3. `ProxyHeadersMiddleware` — client IP from `X-Forwarded-For` only when the peer is in `TRUSTED_PROXY_CIDRS`.
4. `MaintenanceModeMiddleware` (baseline AM-06) — when runtime setting `maintenance_mode` is true, every request whose path is not under `/healthz`, `/readyz`, `/metrics`, `/api/v1/auth/`, `/api/v1/admin/` and is not one of the admin-MFA routes (route flag `admin_mfa=True`, e.g. `/pricing-rules`, annotation project management) is answered `503 service_unavailable` with `details.reason="maintenance"` and `Retry-After: 300`; WebSocket upgrades are refused the same way. Reads the setting through `runtime` (cache TTL ≤ 60 s).
5. `CSRFMiddleware` (§3.7).
6. `BodySizeLimitMiddleware` — 1 MiB for JSON; 10 MiB for attachment/proof multipart routes; uploads never pass through the API (presigned S3).
7. Routers (all under `/api/v1`), with dependencies: `get_db` → `get_current_actor` → `require_permission(...)` → `rate_limit(...)`.
8. Exception handlers (§3.3).

`/healthz` (process alive), `/readyz` (DB `SELECT 1`, Redis `PING`, S3 `HeadBucket`, clamd `PING` — each with 2 s timeout) and `/metrics` are mounted outside `/api/v1`; `/metrics` is served only when the request arrives on the internal network (Caddy does not route it publicly).

---

## 3. Core components (`datahub/core`)

### 3.1 Settings — `core/config.py`

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", frozen=True)

    ENV: Literal["development", "test", "staging", "production"] = "development"
    APP_BASE_URL: AnyHttpUrl                      # https://datahub.example.com (web origin)
    DATABASE_URL: PostgresDsn                     # postgresql+psycopg://...
    DB_POOL_SIZE: int = Field(10, ge=1, le=100)
    DB_MAX_OVERFLOW: int = Field(10, ge=0, le=100)
    DB_STATEMENT_TIMEOUT_MS: int = 30_000
    REDIS_URL: RedisDsn                           # cache, rate limit, pub/sub
    CELERY_BROKER_URL: RedisDsn                   # usually REDIS_URL with another DB index
    S3_ENDPOINT_INTERNAL: AnyHttpUrl              # http://datahub_s3:8333 — server-side calls
    S3_ENDPOINT_PUBLIC: AnyHttpUrl                # http://localhost:9410 or https://<r2 host> — presigned URLs
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY_ID: SecretStr
    S3_SECRET_ACCESS_KEY: SecretStr
    S3_BUCKET_PRIVATE: str = "datahub-private"
    S3_FORCE_PATH_STYLE: bool = True
    CLAMD_HOST: str = "datahub_clamav"
    CLAMD_PORT: int = 3310
    CLAMD_TIMEOUT_S: int = 900
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: SecretStr | None = None
    SMTP_STARTTLS: bool = True
    MAIL_FROM: EmailStr
    SUPPORT_INBOX_EMAIL: EmailStr
    SECRET_KEY: SecretStr                         # ≥ 32 bytes; HMAC for CSRF tokens
    FIELD_ENCRYPTION_KEYS: list[SecretStr]        # Fernet keys; first encrypts, all decrypt
    SESSION_ABSOLUTE_TTL_HOURS: int = 720          # 30 days (AM-08)
    SESSION_IDLE_TTL_MINUTES: int = 10080          # 7 days (AM-08)
    ADMIN_SESSION_ABSOLUTE_TTL_HOURS: int = 12     # sessions of users holding admin/super_admin (AM-08)
    ADMIN_SESSION_IDLE_TTL_MINUTES: int = 30       # (AM-08)
    STEP_UP_TTL_MINUTES: int = 15                  # finance/privileged step-up window (AM-08)
    LOGIN_LOCK_THRESHOLD: int = 5                  # failures within LOGIN_LOCK_WINDOW_MINUTES (AM-08)
    LOGIN_LOCK_WINDOW_MINUTES: int = 15
    LOGIN_LOCK_MINUTES: int = 15
    ADMIN_MFA_REQUIRED: bool = True
    COOKIE_SECURE: bool = True
    TRUSTED_PROXY_CIDRS: list[IPvAnyNetwork] = []
    WORKER_SCRATCH_DIR: Path = Path("/scratch")   # noexec volume for processing temp files
    LOG_LEVEL: str = "INFO"
    SENTRY_DSN: SecretStr | None = None

    @model_validator(mode="after")
    def _production_guards(self) -> "Settings":
        # production/staging: COOKIE_SECURE and ADMIN_MFA_REQUIRED must be True,
        # SECRET_KEY ≥ 32 bytes, ≥ 1 FIELD_ENCRYPTION_KEYS, APP_BASE_URL https.
        ...

@lru_cache
def get_settings() -> Settings: ...
```

Infrastructure and secrets come from environment; business tunables come from `system_settings` via `core/runtime_settings.py`:

```python
class RuntimeSettings:
    def get_int(self, db: Session, key: str) -> int
    def get_bool(self, db: Session, key: str) -> bool
    def get_str_list(self, db: Session, key: str) -> list[str]
    def invalidate(self, key: str) -> None      # called after PUT /admin/settings/{key} commits
runtime = RuntimeSettings()                      # Redis cache key "settings:{key}", TTL 60 s
```

### 3.2 Database session — `core/db.py`

```python
engine = create_engine(settings.DATABASE_URL, pool_size=..., max_overflow=..., pool_pre_ping=True,
                       connect_args={"options": f"-c statement_timeout={settings.DB_STATEMENT_TIMEOUT_MS}"})
SessionLocal = sessionmaker(engine, autoflush=False, expire_on_commit=False)

def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request; rolls back if still in a transaction; always closes."""

def transactional(fn):                       # decorator for service entry points (D-LLD-01)
    """If db.in_transaction(): run inside it. Else: with db.begin(): run; commit; then run after-commit hooks."""

def after_commit(db: Session, callback: Callable[[], None]) -> None:
    """Queue callback in db.info['after_commit']; executed by the SQLAlchemy 'after_commit' event;
    discarded on rollback. Exceptions in callbacks are logged and reported, never raised."""

def lock_for_update(db: Session, model: type[T], id: UUID, *, nowait: bool = False) -> T:
    """SELECT … FOR UPDATE; raises NotFound if absent."""

def advisory_xact_lock(db: Session, namespace: str, key: str) -> None:
    """pg_advisory_xact_lock(hashtextextended(namespace || ':' || key, 0))."""

def set_local_lock_timeout(db: Session, ms: int = 5000) -> None:
    """SET LOCAL lock_timeout; used by all finance transactions. Timeout → LockTimeout (HTTP 409 'busy_retry')."""
```

Celery tasks use `with SessionLocal() as db:` and call service functions decorated with `transactional`.

### 3.3 Errors — `core/errors.py`

```python
class AppError(Exception):
    code: str = "internal_error"
    http_status: int = 500
    def __init__(self, message: str, *, details: dict | list | None = None): ...
```

| Class | HTTP | `code` | Typical use |
|---|---|---|---|
| `ValidationFailed` | 422 | `validation_error` | business validation; Pydantic `RequestValidationError` is rendered with the same code and `details=[{loc, msg, type}]` |
| `Unauthenticated` | 401 | `unauthenticated` | no/expired/revoked session |
| `MfaRequired` | 403 | `mfa_required` | admin endpoint without `mfa_verified_at`; login step 2 pending |
| `MfaSetupRequired` | 403 | `mfa_setup_required` | admin/super_admin without MFA enabled |
| `PermissionDenied` | 403 | `forbidden` | missing permission or failed resource check |
| `CsrfRejected` | 403 | `csrf_failed` | CSRF token missing/mismatch |
| `AccountRestricted` | 403 | `account_restricted` | `pending_email` user calling a non-allowed endpoint; suspended user |
| `NotFound` | 404 | `not_found` | also used instead of 403 when revealing existence would leak data (e.g. other users' datasets) |
| `Conflict` | 409 | `conflict` | generic uniqueness conflict |
| `InvalidStateTransition` | 409 | `invalid_state` | guarded transition failed; `details={"current_status": …}` |
| `VersionConflict` | 409 | `version_conflict` | `If-Match`/`lock_version` mismatch; `details={"server_version": n, "server_copy": {...}}` for annotations |
| `IdempotencyKeyReused` | 409 | `idempotency_key_reused` | same key, different request fingerprint |
| `LockTimeout` | 409 | `busy_retry` | `lock_timeout` hit; client may retry |
| `InsufficientBalance` | 422 | `insufficient_balance` | payout amount > available |
| `QuotaExceeded` | 422 | `quota_exceeded` | dataset size, user pending quota, files per dataset |
| `PayloadTooLarge` | 413 | `payload_too_large` | body limits |
| `UnsupportedFileType` | 422 | `unsupported_file_type` | extension not allowed at upload init |
| `RateLimited` | 429 | `rate_limited` | sets `Retry-After` |
| `DependencyUnavailable` | 503 | `dependency_unavailable` | S3/clamd/Redis down on synchronous path |
| (unhandled / `IntegrityError` from triggers) | 500 | `internal_error` / `integrity_violation` | logged with stack, Sentry |

Handlers: `app_error_handler`, `validation_error_handler`, `integrity_error_handler` (maps known unique-constraint names to `Conflict` with a field hint, e.g. `uq_users_email` → `details={"field":"email"}`; unknown → 500), `unhandled_error_handler`. All include `request_id`.

### 3.4 Security primitives — `core/security.py`

```python
def hash_password(plain: str) -> str                       # argon2id, t=3, m=64 MiB, p=4
def verify_password(hash: str, plain: str) -> tuple[bool, bool]   # (ok, needs_rehash)
def new_token() -> str                                       # secrets.token_urlsafe(32) (256-bit)
def sha256(data: bytes | str) -> bytes
def constant_time_eq(a: bytes, b: bytes) -> bool
def totp_new_secret() -> str
def totp_verify(secret: str, code: str, *, last_used_step: int | None) -> int | None  # valid_window=1; returns step; rejects reuse
def encrypt_field(plain: bytes) -> bytes                     # MultiFernet
def decrypt_field(token: bytes) -> bytes
```

Password policy (`identity.schemas.PasswordStr`): 12–128 chars, not equal to/containing the email local part, not in the bundled top-100k breached list (`identity/data/common_passwords.txt.gz`).

### 3.5 Authentication — `core/auth.py`

```python
@dataclass(frozen=True, slots=True)
class Actor:
    user_id: UUID
    email: str
    status: str                         # users.status
    verification_status: str
    roles: frozenset[str]
    permissions: frozenset[str]
    session_id: UUID
    mfa_enabled: bool
    mfa_verified_at: datetime | None
    ip: str | None
    user_agent: str | None
    request_id: str

    def has(self, perm: str) -> bool

def get_current_actor(request: Request, db: Session = Depends(get_db)) -> Actor
def get_optional_actor(...) -> Actor | None
```

`get_current_actor`: read cookie `dh_session` → the registered authenticator (`register_authenticator(fn)` is called once by `main.create_app()` with `identity.service.authenticate_session`, so `core` never imports a module; `authenticate_token(db, raw_token)` exposes the same check to the WebSocket endpoint) → checks `revoked_at IS NULL`, `expires_at > now()`, idle timeout (`last_seen_at` + idle TTL; sessions of users holding admin/super_admin use `ADMIN_SESSION_IDLE_TTL_MINUTES` = 30 and an absolute limit of `created_at + ADMIN_SESSION_ABSOLUTE_TTL_HOURS` = 12 h, evaluated per request so a role grant shortens existing sessions — AM-08), user `status IN ('pending_email','active')`; touches `last_seen_at` at most once per 60 s (separate short transaction). Users in `pending_email` receive `AccountRestricted` except on the allow-list `{GET /auth/me, POST /auth/logout, POST /auth/verify-email, POST /auth/resend-verification, GET /auth/csrf}`. Sessions of MFA users with `mfa_verified_at IS NULL` are restricted to `{GET /auth/me, POST /auth/mfa/verify, POST /auth/logout}`. Permissions = union of `roles.permissions` for the user's roles, cached in Redis `perm:{user_id}` (TTL 300 s, busted on role change).

### 3.6 Permissions — `core/permissions.py`

```python
PERMISSIONS: Final[frozenset[str]] = frozenset({...})         # every code of baseline §6
ADMIN_PERMISSIONS: Final[frozenset[str]] = frozenset({"user.read","user.manage","user.verify",
    "annotation.manage","payout.approve","payout.record_payment","finance.read","finance.adjust",
    "dataset.export","message.support","analytics.read","pricing.manage","role.manage",
    "settings.manage","audit.read","dataset.read.any"})

def require_permission(*codes: str, any_of: bool = False, mfa: bool | None = None) -> Callable[..., Actor]:
    """Dependency factory. Resolves the Actor, then:
    - all codes (or any, if any_of) must be in actor.permissions, else PermissionDenied;
    - if mfa is True, or mfa is None and any code ∈ ADMIN_PERMISSIONS, and settings.ADMIN_MFA_REQUIRED:
        actor.mfa_enabled must be True (else MfaSetupRequired) and actor.mfa_verified_at not None (else MfaRequired);
    - logs a security_events 'permission_denied' (rate-limited per user per minute) on refusal.
    Returns the Actor."""

def require_admin() -> Callable[..., Actor]          # router-level dependency for /admin/*: any ADMIN_PERMISSIONS + MFA
```

Resource checks (ownership, assignment, separation of duties) are done inside services with helpers such as `datasets.service.assert_can_read_dataset(db, actor, dataset)`; `NotFound` is raised instead of `PermissionDenied` when the caller must not learn that the resource exists.

### 3.7 CSRF — `core/csrf.py`

- `GET /auth/csrf` sets cookie `dh_csrf` (not HttpOnly, `SameSite=Lax`, `Secure`) = `base64url(nonce || HMAC_SHA256(SECRET_KEY, nonce || session_id_or_anon))` and returns it in JSON.
- Middleware: for `POST/PUT/PATCH/DELETE` under `/api/v1` (except `POST /auth/login`, `POST /auth/register`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/verify-email`, `POST /public/contact`, which are protected by `SameSite=Lax` + `Origin` check + rate limit), require header `X-CSRF-Token` equal (constant-time) to the cookie and a valid HMAC bound to the current session id. `Origin`/`Referer`, when present, must equal `APP_BASE_URL`. Failure → `CsrfRejected` + `security_events.csrf_rejected`.
- The token is rotated on login, MFA verification and logout.

### 3.8 Audit writer — `core/audit.py`

```python
REDACT_KEYS: Final = {"password", "password_hash", "token", "token_hash", "mfa_secret_encrypted",
                      "code_hash", "details", "method_snapshot", "sensitive_context_encrypted"}

def record(db: Session, *, actor: Actor | None, action: str, entity_type: str, entity_id: UUID | None,
           before: Mapping | None = None, after: Mapping | None = None,
           metadata: Mapping | None = None) -> None:
    """Adds an audit_logs row to the current transaction (never commits by itself).
    changes = {k: [before[k], after[k]] for k where values differ}; values for REDACT_KEYS replaced by "[redacted]".
    actor None ⇒ actor_type='system'. ip/user_agent/request_id/session_id taken from Actor or core.context."""

def snapshot(obj: Base, fields: Iterable[str] | None = None) -> dict    # JSON-safe dict of column values
```

Audit actions are named `<module>.<entity>.<verb>` (e.g. `datasets.dataset.submit`, `finance.payout.mark_paid`, `exports.export.download_url`). Privileged reads that must be audited: export download URLs, KYC document view, payout method details view (`identity.payout_method.view_details`), admin file download URLs.

### 3.9 Rate limiter — `core/ratelimit.py`

Sliding-window log in Redis, one sorted set per (rule, subject), executed atomically by a Lua script:

```lua
-- KEYS[1]=key  ARGV: now_ms, window_ms, limit, member
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
local n = redis.call('ZCARD', KEYS[1])
if n >= tonumber(ARGV[3]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, n, tonumber(oldest[2]) + tonumber(ARGV[2]) - tonumber(ARGV[1])}
end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return {1, n + 1, 0}
```

```python
@dataclass(frozen=True)
class RateRule:
    name: str
    limit: int
    window_s: int
    key: Literal["ip", "user", "ip_email", "email"]
    fail_closed: bool = False

class RateLimiter:
    def hit(self, rule: RateRule, subject: str) -> RateResult     # RateResult(allowed, count, retry_after_ms)

def rate_limit(rule: RateRule) -> Callable[..., None]              # FastAPI dependency; raises RateLimited
```

Key: `rl:{rule.name}:{sha256(subject)[:16].hex()}`; member: `f"{now_ms}-{uuid4().hex}"`. Response headers `RateLimit-Limit`, `RateLimit-Remaining`, `Retry-After`. If Redis is unavailable: `fail_closed` rules raise `DependencyUnavailable`; others allow and log a warning.

| Rule | Limit | Key | Fail-closed |
|---|---|---|---|
| `login` | 5 / 60 s and 20 / 3600 s | ip_email; ip | yes |
| `mfa_verify` | 5 / 300 s | user | yes |
| `register` | 5 / 3600 s | ip | yes |
| `forgot_password` | 3 / 3600 s | email (+ 10/3600 s per ip) | yes |
| `resend_verification` | 3 / 3600 s | user | yes |
| `public_contact` | 5 / 3600 s | ip | yes |
| `upload_init` | 120 / 60 s | user | no |
| `upload_part_urls` | 600 / 60 s | user | no |
| `message_post` | 30 / 60 s | user | no |
| `attachment_upload` | 20 / 600 s | user | no |
| `annotation_draft` | 60 / 60 s | user | no |
| `payout_request` | 5 / 3600 s | user | yes |
| `download_url` | 300 / 3600 s | user | no |
| `authenticated_default` | 600 / 60 s | user | no |
| `anonymous_default` | 120 / 60 s | ip | no |

### 3.10 Storage adapter — `core/storage.py`

Two boto3 S3 clients share credentials: **internal** (`S3_ENDPOINT_INTERNAL`) for all server-side operations, **public** (`S3_ENDPOINT_PUBLIC`) used *only* to generate presigned URLs, because the host is part of the SigV4 signature and must be the host the browser contacts.

```python
class Storage:
    bucket: str
    # multipart (uploads)
    def create_multipart(self, key: str, content_type: str) -> str                       # → UploadId
    def presign_upload_part(self, key: str, upload_id: str, part_number: int, ttl_s: int = 900) -> str
    def list_parts(self, key: str, upload_id: str) -> list[PartInfo]                    # handles pagination
    def complete_multipart(self, key: str, upload_id: str, parts: list[CompletedPart]) -> str  # → ETag
    def abort_multipart(self, key: str, upload_id: str) -> None                         # NoSuchUpload ignored
    # objects
    def head(self, key: str) -> ObjectInfo | None                                        # size, etag, content_type
    def open_read(self, key: str, *, chunk_size: int = 8 * 1024 * 1024) -> Iterator[bytes]
    def download_to(self, key: str, path: Path) -> None
    def put_file(self, key: str, path: Path, content_type: str) -> None                 # multipart for > 64 MiB
    def put_bytes(self, key: str, data: bytes, content_type: str) -> None
    def copy(self, src: str, dst: str) -> None
    def delete(self, key: str) -> None
    def delete_many(self, keys: Sequence[str]) -> list[str]                            # batches of 1,000; returns failures
    def presign_get(self, key: str, *, filename: str | None, disposition: Literal["inline","attachment"],
                    content_type: str | None = None, ttl_s: int = 300) -> str
    def ping(self) -> None                                                              # HeadBucket

def keys() -> KeyBuilder   # dataset_file(dataset_id, file_id), preview(dataset_id, file_id, kind, page),
                           # text(dataset_id, file_id), quarantine(file_id), export_part(job_id, n),
                           # attachment(conversation_id, attachment_id), payout_proof(payout_id, uuid),
                           # kyc_document(user_id, verification_id, uuid)
```

Rules: keys are built only from server-generated UUIDs (never from user filenames); `presign_get` always sets `ResponseContentDisposition` (RFC 6266 `filename*=UTF-8''…` from the sanitised original filename) and `ResponseContentType`; `inline` is used only for preview images and `text/plain` derivatives; all other downloads are `attachment`. Bucket has no public policy; CORS on the bucket allows `PUT` from `APP_BASE_URL` (uploads) and exposes `ETag`.

### 3.11 ClamAV client — `core/clamd.py`

```python
@dataclass(frozen=True)
class ScanResult:
    status: Literal["clean", "infected", "error"]
    signature: str | None
    engine_version: str | None
    detail: str | None

class ClamdClient:
    def __init__(self, host: str, port: int, timeout_s: int): ...
    def ping(self) -> bool                                   # "zPING\0" → "PONG"
    def version(self) -> str                                 # "zVERSION\0"
    def scan_stream(self, chunks: Iterable[bytes], *, max_bytes: int) -> ScanResult
```

`scan_stream` protocol: send `zINSTREAM\0`; for each chunk (≤ 1 MiB) send 4-byte big-endian length + data; terminate with 4 zero bytes; read until `\0`. Responses: `stream: OK` → `clean`; `stream: <sig> FOUND` → `infected` (except `Heuristics.Limits.Exceeded*` → `error`, because it means "not fully scanned"); `INSTREAM size limit exceeded` / any other / socket error / timeout → `error`. If the stream exceeds `max_bytes`, the client stops and returns `error` with detail `scan_size_limit`. clamd is configured with `StreamMaxLength 4000M`, `MaxScanSize 4000M`, `MaxFileSize 4000M`, `AlertExceedsMax yes`, `AlertEncrypted yes` (encrypted archives/PDFs are reported, mapped to `failed: encrypted_content`). The client never raises for scan outcomes; only `ping`/`version` raise `DependencyUnavailable`.

### 3.12 File sniffer — `core/sniffer.py`

```python
@dataclass(frozen=True)
class SniffResult:
    format: str | None                 # dataset_files.format value
    detected_mime: str
    ok: bool
    failure_code: str | None           # type_mismatch | disallowed_type | corrupt_file | encrypted_content
    previewable: bool
    annotatable: bool
    page_count: int | None
    metadata: dict                     # → dataset_files.extracted_metadata

ALLOWED: Final[dict[str, FormatSpec]]  # extension → (format, accepted MIME set, previewable, annotatable) per baseline §7
DENY_MIME_PREFIXES: Final = ("application/x-dosexec", "application/x-executable", "application/x-sharedlib",
    "application/x-mach-binary", "text/x-shellscript", "text/x-python", "text/html", "image/svg+xml",
    "application/javascript", "application/x-msi", "application/java-archive")

def sniff(path: Path, extension: str, *, extra_allowed: set[str]) -> SniffResult
```

Algorithm:
1. `magic.from_buffer(first 8 KiB, mime=True)`; deny-list → `disallowed_type`.
2. Extension → `FormatSpec` (unknown and not in `extra_allowed_extensions` → `disallowed_type`); detected MIME must be in the spec's set (`text/plain` accepted for txt/csv/json/jsonl), else `type_mismatch`.
3. Structural validation (never executes content; all parsers run in the worker with resource limits):
   - PDF: `pypdfium2.PdfDocument(path)` → page count; password-protected → `encrypted_content`; open failure → `corrupt_file`.
   - DOCX/XLSX (ZIP-based OOXML): `zipfile` member list must contain `[Content_Types].xml`; any `vbaProject.bin` or macro content type → `disallowed_type`; XML parsed with `defusedxml` only.
   - ODT: `mimetype` member equals `application/vnd.oasis.opendocument.text`.
   - Images/TIFF: `PIL.Image.open` with `Image.MAX_IMAGE_PIXELS = 178_956_970` (decompression-bomb guard → `corrupt_file`), `verify()`, frame count for TIFF.
   - JSON/JSONL: files ≤ 64 MiB are fully parsed (`json.loads`; JSONL line by line); larger JSONL files are validated line by line while streaming, larger JSON files by parsing the first 1 MiB plus a streaming bracket/quote balance check; XML: `defusedxml.ElementTree.parse` with entity expansion forbidden; CSV: UTF-8/UTF-16 decode of first 1 MiB + `csv.Sniffer`.
   - DOC: OLE2 signature `D0 CF 11 E0`; macros (`Macros/` storage) → `disallowed_type`.
   - ZIP: `zipfile.is_zipfile`; container handling is in `processing/archive.py`.
4. Returns flags from baseline §7 table.

### 3.13 Jobs — `core/jobs.py`

```python
class DataHubTask(celery.Task):
    acks_late = True
    reject_on_worker_lost = True
    max_retries = 3
    retry_backoff = True          # 30 s, 120 s, 480 s (retry_backoff_max=600, jitter)
    def before_start(self, task_id, args, kwargs): ...   # upsert background_job_records → running, attempts+1
    def on_success(self, retval, task_id, args, kwargs): ...   # → succeeded
    def on_retry(self, exc, task_id, args, kwargs, einfo): ... # → retrying, last_error, next_retry_at
    def on_failure(self, exc, task_id, args, kwargs, einfo): ...  # → failed (or dead if retries exhausted)

def enqueue_after_commit(db: Session, task_name: str, *args, queue: str, countdown: int = 0) -> None
    """Inserts background_job_records (status queued) in the current transaction —
    ON CONFLICT on uq_background_job_records_inflight DO NOTHING (deduplicates) — and registers
    celery_app.send_task(task_name, args, queue=queue, countdown=countdown) via after_commit.
    Tasks are addressed by name, so a lower module can trigger a higher module's task without importing it
    (e.g. datasets → "datahub.processing.process_file")."""
```

Worker settings (`worker.py`): `task_acks_late=True`, `worker_prefetch_multiplier=1`, `broker_transport_options={"visibility_timeout": 21600}` (6 h, longer than the longest task), `task_time_limit` per task (below), `task_routes` per queue, JSON serializer only, `worker_max_tasks_per_child=200` (bounds memory of parser libraries).

### 3.14 Realtime publisher — `core/realtime.py`

```python
def publish(user_ids: Iterable[UUID], event: Literal["message.created","notification.created","conversation.updated"],
            payload: dict) -> None
    """PUBLISH ws:user:{user_id} {"event": ..., "data": payload}; called only via after_commit."""
```

### 3.15 Pagination and idempotency — `core/pagination.py`, `core/idempotency.py`

```python
class PageParams(BaseModel):
    page: int = Field(1, ge=1, le=10_000)
    page_size: int = Field(25, ge=1, le=100)
    sort: str | None = Field(None, pattern=r"^-?[a-z_]{1,40}(,-?[a-z_]{1,40}){0,2}$")   # validated against per-endpoint allow-list

class Page(BaseModel, Generic[T]):
    items: list[T]; page: int; page_size: int; total: int

def idempotency_key(required: bool) -> Callable[..., str | None]
    """Reads 'Idempotency-Key' header: 8–128 chars, ^[A-Za-z0-9_\-:.]+$; missing and required → ValidationFailed."""

def multi_value(enum_cls: type[StrEnum]) -> Callable[..., list[StrEnum] | None]
    """AM-05: every `status`/`*_status` filter accepts comma-separated values (`?status=a,b`) and repeated keys; values validated against the enum."""
```

List filters added by AM-05: `UserFilters.role` (`GET /admin/users`), `PayoutAdminFilters.user_id` (`GET /admin/payouts`), `AuditFilters.entity_type`, `.entity_id`, `.actor_id` (`GET /admin/audit-logs`).

### 3.16 Human reference codes — `core/codes.py` (AM-07)

```python
def next_code(db: Session, prefix: Literal["DS", "PO", "EX"], now: datetime) -> str
    """Joins the caller's tx: INSERT … ON CONFLICT (prefix, year) DO UPDATE SET last_value = last_value + 1 RETURNING last_value
    on dataset_code_counters; returns f"{prefix}-{year}-{n:06d}" (e.g. DS-2026-000123)."""
```

Called by `datasets.create_dataset` (`datasets.code`), `finance.request_payout` (`payout_requests.code`) and `exports.create_export` (`export_jobs.code`) inside their insert transaction. Codes are immutable, shown in the UI, matched exactly by admin `q` searches, and never used in URLs (UUIDs only).


---

## 4. Module `identity`

Layout: `router.py` (`auth_router` `/auth`, `me_router` `/me`, `admin_router` `/admin`), `service.py`, `models.py`, `schemas.py`, `repository.py`, `tasks.py`, `data/common_passwords.txt.gz`, `payout_method_schemas.py` (discriminated union per method type).

### 4.1 Endpoints → handlers → services

| Method & path | Handler | Dependency / permission | Service call |
|---|---|---|---|
| `GET /auth/csrf` | `get_csrf` | optional actor | `core.csrf.issue_token` |
| `POST /auth/register` | `register` | rate `register` | `register(db, data, ctx)` |
| `POST /auth/login` | `login` | rate `login` | `login(db, data, ctx) -> LoginResult` |
| `POST /auth/mfa/verify` | `mfa_verify` | actor (MFA-pending allowed), rate `mfa_verify` | `verify_mfa(db, actor, data)` |
| `POST /auth/logout` | `logout` | actor | `logout(db, actor)` |
| `POST /auth/verify-email` | `verify_email` | — | `verify_email(db, data.token, ctx)` |
| `POST /auth/resend-verification` | `resend_verification` | actor (pending_email allowed), rate | `resend_verification(db, actor)` |
| `POST /auth/forgot-password` | `forgot_password` | rate `forgot_password` | `request_password_reset(db, data.email, ctx)` (always 202) |
| `POST /auth/reset-password` | `reset_password` | — | `reset_password(db, data, ctx)` |
| `POST /auth/change-password` | `change_password` | `profile.self` | `change_password(db, actor, data)` |
| `GET /auth/me` | `me` | actor (restricted allowed) | `get_me(db, actor) -> MeOut` |
| `GET /auth/sessions` | `list_sessions` | `profile.self` | `list_sessions(db, actor)` |
| `DELETE /auth/sessions/{id}` | `revoke_session` | `profile.self` | `revoke_session(db, actor, session_id)` |
| `POST /auth/sessions/revoke-others` | `revoke_other_sessions` | `profile.self` | `revoke_other_sessions(db, actor)` |
| `POST /auth/mfa/setup` | `mfa_setup` | `profile.self` (MFA-setup-required allowed) | `start_mfa_setup(db, actor) -> MfaSetupOut` |
| `POST /auth/mfa/enable` | `mfa_enable` | same | `enable_mfa(db, actor, data) -> RecoveryCodesOut` |
| `POST /auth/mfa/disable` | `mfa_disable` | `profile.self` | `disable_mfa(db, actor, data)` (refused for admin/super_admin when `ADMIN_MFA_REQUIRED`) |
| `GET /me/profile` / `PATCH /me/profile` | `get_profile` / `update_profile` | `profile.self` | `get_profile`, `update_profile(db, actor, data)` |
| `POST /me/onboarding` | `complete_onboarding` | `profile.self` | `complete_onboarding(db, actor, data)` |
| `GET /me/payout-methods` / `POST` | `list_payout_methods` / `add_payout_method` | `profile.self` | `list_payout_methods`, `add_payout_method(db, actor, data)` |
| `DELETE /me/payout-methods/{id}` | `delete_payout_method` | `profile.self` | `delete_payout_method(db, actor, method_id)` |
| `GET /me/verification` / `POST` | `get_verification` / `submit_verification` | `profile.self` | `get_current_verification`, `submit_verification(db, actor, data)` |
| `POST /me/deletion-request` | `request_deletion` | `profile.self` | `request_account_deletion(db, actor, data)` |
| `GET /me/notification-preferences` / `PATCH` | `get_notification_prefs` / `update_notification_prefs` | `profile.self` | `get_notification_preferences`, `update_notification_preferences(db, actor, data)` |
| `GET /admin/users` | `admin_list_users` | `user.read` | `list_users(db, filters, page)` |
| `GET /admin/users/{id}` | `admin_get_user` | `user.read` | `get_user_admin_view(db, actor, user_id)` |
| `POST /admin/users/{id}/suspend` | `admin_suspend` | `user.manage` | `suspend_user(db, actor, user_id, data.reason)` |
| `POST /admin/users/{id}/reactivate` | `admin_reactivate` | `user.manage` | `reactivate_user(db, actor, user_id)` |
| `PUT /admin/users/{id}/roles` | `admin_set_roles` | `user.manage` (+ `role.manage` for admin roles) | `set_user_roles(db, actor, user_id, data.roles)` |
| `POST /admin/users/{id}/revoke-sessions` | `admin_revoke_sessions` | `user.manage` | `revoke_all_sessions(db, actor, user_id, reason="admin_revoked")` |
| `GET /admin/verifications` | `admin_list_verifications` | `user.verify` | `list_verifications(db, filters, page)` |
| `POST /admin/verifications/{id}/decision` | `admin_decide_verification` | `user.verify` | `decide_verification(db, actor, verification_id, data)` |
| `GET /admin/security-events` | `admin_security_events` | `audit.read` | `list_security_events(db, filters, page)` |
| `GET /admin/roles` | `admin_list_roles` | `user.read` | `list_roles(db)` |

### 4.2 Service interface (`identity/service.py`)

```python
def register(db, data: RegisterIn, ctx: RequestContext) -> User
def login(db, data: LoginIn, ctx: RequestContext) -> LoginResult      # LoginResult(session_token, session, mfa_required, mfa_setup_required)
def verify_mfa(db, actor: Actor, data: MfaVerifyIn) -> None            # TOTP or recovery code; sets user_sessions.mfa_verified_at
def logout(db, actor: Actor) -> None
def authenticate_session(db, raw_token: str) -> SessionContext | None
def verify_email(db, token: str, ctx: RequestContext) -> User
def resend_verification(db, actor: Actor) -> None
def request_password_reset(db, email: str, ctx: RequestContext) -> None
def reset_password(db, data: ResetPasswordIn, ctx: RequestContext) -> None
def change_password(db, actor: Actor, data: ChangePasswordIn) -> None
def get_me(db, actor: Actor) -> MeOut
def list_sessions(db, actor: Actor) -> list[SessionOut]
def revoke_session(db, actor: Actor, session_id: UUID) -> None
def revoke_other_sessions(db, actor: Actor) -> int
def revoke_all_sessions(db, actor: Actor | None, user_id: UUID, reason: str) -> int
def start_mfa_setup(db, actor: Actor) -> MfaSetupOut                    # secret + otpauth URI (issuer "DataHub")
def enable_mfa(db, actor: Actor, data: MfaEnableIn) -> list[str]        # returns 10 recovery codes once
def disable_mfa(db, actor: Actor, data: MfaDisableIn) -> None
def get_profile(db, actor: Actor) -> ProfileOut
def update_profile(db, actor: Actor, data: ProfilePatchIn) -> ProfileOut
def complete_onboarding(db, actor: Actor, data: OnboardingIn) -> MeOut
def list_payout_methods(db, actor: Actor) -> list[PayoutMethodOut]
def add_payout_method(db, actor: Actor, data: PayoutMethodIn) -> PayoutMethodOut
def delete_payout_method(db, actor: Actor, method_id: UUID) -> None
def get_payout_method_for_payout(db, user_id: UUID, method_id: UUID) -> PayoutMethod   # used by finance; active & owned
def get_current_verification(db, actor: Actor) -> VerificationOut | None
def submit_verification(db, actor: Actor, data: VerificationIn) -> VerificationOut
def decide_verification(db, actor: Actor, verification_id: UUID, data: VerificationDecisionIn) -> VerificationOut
def request_account_deletion(db, actor: Actor, data: DeletionRequestIn) -> DeletionRequest
def cancel_account_deletion(db, actor: Actor) -> None                    # POST /me/deletion-request with action=cancel
def get_notification_preferences(db, actor: Actor) -> NotificationPrefsOut
def update_notification_preferences(db, actor: Actor, data: NotificationPrefsIn) -> NotificationPrefsOut
def list_users(db, filters: UserFilters, page: PageParams) -> Page[UserListItem]
def get_user_admin_view(db, actor: Actor, user_id: UUID) -> UserAdminOut   # audited read
def suspend_user(db, actor: Actor, user_id: UUID, reason: str) -> User
def reactivate_user(db, actor: Actor, user_id: UUID) -> User
def set_user_roles(db, actor: Actor, user_id: UUID, roles: list[str]) -> list[str]
def list_verifications(db, filters: VerificationFilters, page: PageParams) -> Page[VerificationAdminItem]
def list_security_events(db, filters: SecurityEventFilters, page: PageParams) -> Page[SecurityEventOut]
def record_security_event(db, *, user_id: UUID | None, event_type: str, severity: str = "info",
                          ctx: RequestContext | None = None, details: dict | None = None) -> None
def deactivate_user(db, user_id: UUID, actor: Actor | None) -> None        # called by admin.service.process_deletion_request
def anonymize_user(db, user_id: UUID, actor: Actor | None) -> None         # DATABASE_SCHEMA §7.2
def user_ids_with_permission(db, permission: str) -> list[UUID]           # e.g. support / reviewer fan-out
```

### 4.3 Validation rules (`identity/schemas.py`)

| Schema | Field constraints |
|---|---|
| `RegisterIn` | `email: EmailStr` (≤ 254, lower-cased, IDN → punycode); `password: PasswordStr`; `display_name: str` 2–100 after strip, no control chars; `accept_terms: Literal[True]`; `accept_privacy: Literal[True]`; `locale: Literal["en","km"] = "en"` |
| `LoginIn` | `email: EmailStr`; `password: str` 1–128 |
| `MfaVerifyIn` | exactly one of `code: str` (`^\d{6}$`) or `recovery_code: str` (`^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$`, case-insensitive) |
| `ResetPasswordIn` | `token: str` 43 chars urlsafe; `new_password: PasswordStr` |
| `ChangePasswordIn` | `current_password: str`; `new_password: PasswordStr` (≠ current) |
| `ProfilePatchIn` | all optional: `display_name` 2–100; `legal_name` ≤ 200; `country_code` ISO-3166 alpha-2 (validated against `pycountry`-free embedded list); `phone` E.164; `organization` ≤ 200; `preferred_locale` `en|km`; `timezone` in `zoneinfo.available_timezones()` |
| `OnboardingIn` | `contributor_agreement_version: str` must equal current published version; `rights_declaration_version` likewise; `accept_contributor_agreement: Literal[True]`; `accept_rights_declaration: Literal[True]` |
| `PayoutMethodIn` | discriminated union on `method_type`: `bank_transfer{bank_name 2–100, account_name 2–200, account_number ^[0-9 -]{6,34}$, swift_code? ^[A-Z0-9]{8}([A-Z0-9]{3})?$, branch?}`; `aba_pay{account_name, account_number ^\d{9}$ or phone E.164}`; `wise{email EmailStr, account_holder}`; `paypal{email EmailStr}`; `other{description 10–500}`; `label` 1–100; `is_default: bool` |
| `VerificationIn` | `legal_name` 2–200; `country_code`; `date_of_birth: date` (age ≥ 18 at today UTC, ≤ 120 y); `phone` E.164; `payout_method_id: UUID` (owned, not deleted); `id_document_upload_id: UUID | None` (a staged upload made via `POST /me/verification` multipart part `id_document` ≤ 10 MB, PDF/JPEG/PNG) |
| `VerificationDecisionIn` | `decision: Literal["approved","rejected","needs_info"]`; `reason: str | None` 5–2000, required unless approved; `admin_notes ≤ 4000` |
| `UserRolesIn` | `roles: list[Literal[5 role codes]]` 1–5 unique; must contain `contributor` unless target is staff-only |
| `SuspendIn` | `reason` 10–2000 |
| `DeletionRequestIn` | `action: Literal["request","cancel"]`; for `request`: `reason ≤ 2000`, `confirm_email: EmailStr` equal to the account email, `password: str` (re-authentication); `cancel` allowed while the request is `requested` |
| `NotificationPrefsIn` | `dict[NotificationType, {email: bool}]`; types with mandatory email (`password_reset`, `payment_recorded`, `withdrawal_*`) cannot be disabled |

### 4.4 Transactions and locks

| Operation | Transaction | Locks / guards |
|---|---|---|
| `register` | 1 tx: insert `users`, `user_profiles`, `user_roles(contributor)`, `agreement_acceptances` (ToS, privacy), `email_verifications`, `email_outbox`, audit | `uq_users_email`; to prevent account enumeration an already-registered email gets the same `202 Accepted` response (AM-14; no session is created for anyone — the user signs in after verifying), no row is created and an "account already exists" email is sent instead (a race on the unique index is handled the same way) |
| `login` | tx A: read user, verify password (argon2 outside lock), update counters / create `user_sessions` + `security_events`, audit | `SELECT users … FOR UPDATE` only when updating counters; lockout via `locked_until` |
| `verify_email` | 1 tx | `SELECT email_verifications … FOR UPDATE` by `token_hash`; guarded `UPDATE users SET status='active' WHERE status='pending_email'` |
| `reset_password` | 1 tx: consume token, set hash, revoke all sessions (`password_reset`), security event, outbox "password changed" | token row `FOR UPDATE` |
| `enable_mfa` | 1 tx: set `mfa_enabled`, replace recovery codes, revoke other sessions (`mfa_changed`), mark current session `mfa_verified_at=now()` | `users FOR UPDATE` |
| `submit_verification` | 1 tx: insert `contributor_verifications(pending)`, `users.verification_status='pending'`, notify admins (`user.verify`) | `users FOR UPDATE`; `uq_contributor_verifications_one_pending` |
| `decide_verification` | 1 tx: guarded update `pending → decision`, mirror `users.verification_status`, notification + email | `users FOR UPDATE` then verification `FOR UPDATE` (lock order D-LLD-04) |
| `suspend_user` | 1 tx: guarded status update, revoke sessions, security event, email | `users FOR UPDATE` |
| `set_user_roles` | 1 tx: diff roles, insert/delete `user_roles`, security event `role_changed`; after commit bust `perm:{user_id}` | `users FOR UPDATE`; super_admin required to grant/revoke `admin`/`super_admin`; the last active super_admin cannot be demoted |
| `anonymize_user` | 1 tx (DATABASE_SCHEMA §7.2) | `users FOR UPDATE` |

### 4.5 Login algorithm

1. Rate-limit (`login`); normalise email; load user (constant-time dummy argon2 verify when not found).
2. If `locked_until > now()` → `429 auth.account_locked` with `Retry-After` (password not verified) + `security_events.login_failed` (`details.reason="locked"`).
3. Wrong password → `failed_login_count += 1` (counter window `LOGIN_LOCK_WINDOW_MINUTES` = 15, reset when the first failure in the window is older); at `LOGIN_LOCK_THRESHOLD` = 5 → `locked_until = now() + LOGIN_LOCK_MINUTES` (15 min), `account_locked` event + email; generic `401 auth.invalid_credentials` (AM-08).
4. Status `suspended|deactivated|anonymized` → generic 401 + `login_blocked_status`.
5. Success → reset counters, rehash if needed, create session (`expires_at = now() + SESSION_ABSOLUTE_TTL_HOURS`, or `+ ADMIN_SESSION_ABSOLUTE_TTL_HOURS` when the user holds admin/super_admin), set cookie `dh_session` (HttpOnly, Secure, SameSite=Lax, Path=/), rotate CSRF.
6. If `mfa_enabled` → response `{mfa_required: true}`; if user holds admin/super_admin and not `mfa_enabled` and `ADMIN_MFA_REQUIRED` → `{mfa_setup_required: true}` (session restricted to MFA setup endpoints until enabled).

### 4.6 Tasks

None of its own except via `admin.tasks.process_deletion_requests` (orchestration, §12). Emails are sent by `messaging.send_email`.

---

## 5. Module `datasets`

Layout: `router.py` (`router` for `/datasets`, `/uploads`, `/files`, `/public/formats`; `admin_router` for `/admin/datasets`, `/admin/files`), `service.py`, `uploads.py` (multipart helper functions used by `service.py`), `models.py`, `schemas.py`, `repository.py`, `tasks.py`.

### 5.1 Endpoints → handlers → services

| Method & path | Handler | Permission | Service call |
|---|---|---|---|
| `POST /datasets` | `create_dataset` | `dataset.create` | `create_dataset(db, actor, data)` |
| `GET /datasets` | `list_my_datasets` | `dataset.read.own` | `list_own_datasets(db, actor, filters, page)` |
| `GET /datasets/{id}` | `get_dataset` | `dataset.read.own` or `dataset.read.any` or `dataset.review` | `get_dataset_view(db, actor, dataset_id)` |
| `PATCH /datasets/{id}` | `update_dataset` | `dataset.create` (owner) | `update_dataset(db, actor, dataset_id, data, if_match)` |
| `DELETE /datasets/{id}` | `delete_dataset` | owner | `delete_draft_dataset(db, actor, dataset_id)` |
| `POST /datasets/{id}/submit` | `submit_dataset` | owner | `submit_dataset(db, actor, dataset_id, data)` |
| `POST /datasets/{id}/withdraw` | `withdraw_dataset` | owner | `withdraw_dataset(db, actor, dataset_id, data)` |
| `GET /datasets/{id}/files` | `list_files` | read access | `list_dataset_files(db, actor, dataset_id, filters, page)` |
| `DELETE /datasets/{id}/files/{file_id}` | `remove_file` | owner | `remove_file(db, actor, dataset_id, file_id)` |
| `GET /datasets/{id}/reviews` | `list_reviews_for_owner` | owner | `review.service.list_reviews_for_dataset_owner` (router in `review`, path kept) |
| `GET /datasets/{id}/estimate` | `get_estimate` | owner | `estimate_earnings(db, actor, dataset_id)` |
| `POST /datasets/{id}/uploads` | `init_upload` | owner, rate `upload_init` | `init_upload(db, actor, dataset_id, data)` |
| `POST /uploads/{id}/part-urls` | `get_part_urls` | uploader, rate | `presign_parts(db, actor, upload_id, data.part_numbers)` |
| `GET /uploads/{id}` | `get_upload` | uploader | `get_upload_status(db, actor, upload_id)` |
| `POST /uploads/{id}/complete` | `complete_upload` | uploader | `complete_upload(db, actor, upload_id, data.parts)` |
| `DELETE /uploads/{id}` | `abort_upload` | uploader | `abort_upload(db, actor, upload_id, reason="user_cancelled")` |
| `GET /files/{id}` | `get_file` | read access | `get_file_view(db, actor, file_id)` |
| `GET /files/{id}/preview/{page}` | `preview_redirect` | read access | `get_preview_url(db, actor, file_id, page)` → 302 |
| `GET /files/{id}/text` | `get_text` | read access | `get_text_excerpt(db, actor, file_id, offset, limit)` |
| `POST /files/{id}/download-url` | `download_url` | read access, rate `download_url` | `create_download_url(db, actor, file_id)` (audited) |
| `GET /public/formats` | `public_formats` | — | `list_formats(db)` |
| `GET /admin/datasets/{id}` | `admin_get_dataset` | `dataset.read.any` | `get_dataset_view(db, actor, dataset_id)` |
| `POST /admin/datasets/{id}/takedown` | `admin_takedown` (router in `admin`) | `user.manage` + `dataset.read.any` | `admin.service.take_down_dataset(db, actor, dataset_id, data)` → `datasets.service.take_down_dataset` |
| `POST /admin/files/{id}/rescan` | `admin_rescan` | `dataset.read.any` | `request_rescan(db, actor, file_id)` |

(`GET /admin/datasets` list/search is in `admin`, §12.)

Read access rule (`assert_can_read_dataset`): owner; or `dataset.read.any`; or reviewer holding an `in_progress` review of the dataset, or who finalized a review of it (checked through the `datasets.reviewer_access` read in §15). Otherwise `NotFound`. Annotators and annotation reviewers never use `/files/*`: `GET /annotation/tasks/{id}` returns short-lived presigned preview URLs and the text excerpt for the task's pages, produced by `datasets.service.issue_file_assets(db, file_id, pages)` after `annotation` has authorised the caller.

### 5.2 Service interface (`datasets/service.py`)

```python
def create_dataset(db, actor: Actor, data: DatasetCreateIn) -> Dataset
def list_own_datasets(db, actor: Actor, filters: DatasetOwnerFilters, page: PageParams) -> Page[DatasetListItem]
def get_dataset_view(db, actor: Actor, dataset_id: UUID) -> DatasetDetailOut
def assert_can_read_dataset(db, actor: Actor, dataset: Dataset) -> None
def update_dataset(db, actor: Actor, dataset_id: UUID, data: DatasetPatchIn, if_match: int) -> Dataset
def delete_draft_dataset(db, actor: Actor, dataset_id: UUID) -> None
def submit_dataset(db, actor: Actor, dataset_id: UUID, data: SubmitIn) -> DatasetVersion
def withdraw_dataset(db, actor: Actor, dataset_id: UUID, data: WithdrawIn) -> Dataset
def list_dataset_files(db, actor: Actor, dataset_id: UUID, filters: FileFilters, page: PageParams) -> Page[FileListItem]
def remove_file(db, actor: Actor, dataset_id: UUID, file_id: UUID) -> None
def estimate_earnings(db, actor: Actor, dataset_id: UUID) -> EstimateOut           # uses finance.service.get_current_rates
def init_upload(db, actor: Actor, dataset_id: UUID, data: UploadInitIn) -> UploadInitOut
def presign_parts(db, actor: Actor, upload_id: UUID, part_numbers: list[int]) -> PartUrlsOut
def get_upload_status(db, actor: Actor, upload_id: UUID) -> UploadStatusOut
def complete_upload(db, actor: Actor, upload_id: UUID, parts: list[CompletedPartIn]) -> FileOut
def abort_upload(db, actor: Actor | None, upload_id: UUID, reason: str) -> None
def expire_upload_sessions(db, now: datetime, batch: int = 200) -> int               # beat
def get_file_view(db, actor: Actor, file_id: UUID) -> FileDetailOut
def get_preview_url(db, actor: Actor, file_id: UUID, page: int) -> str
def get_text_excerpt(db, actor: Actor, file_id: UUID, offset: int, limit: int) -> TextExcerptOut
def create_download_url(db, actor: Actor, file_id: UUID) -> DownloadUrlOut
def take_down_dataset(db, actor: Actor, dataset_id: UUID, data: TakedownIn) -> Dataset
def request_rescan(db, actor: Actor, file_id: UUID) -> None
def list_formats(db) -> list[FormatOut]
# ── internal API for processing / review / annotation / exports ──
def claim_file_for_processing(db, file_id: UUID) -> FileProcessingInfo | None       # guarded uploaded→processing
def return_file_to_uploaded(db, file_id: UUID, error: str) -> None                  # transient failure before retry
def record_processing_result(db, file_id: UUID, result: ProcessingResult) -> DatasetFile
def create_archive_member(db, parent_file_id: UUID, member: ArchiveMemberIn) -> DatasetFile | None  # ON CONFLICT DO NOTHING
def upsert_duplicate(db, file_id: UUID, matched_file_id: UUID, kind: str, method: str, similarity: Decimal,
                     hamming_distance: int | None) -> None
def find_exact_matches(db, file_id: UUID, sha256: bytes) -> list[DuplicateCandidate]
def find_near_candidates(db, file_id: UUID, simhash: int | None, phash: int | None) -> list[DuplicateCandidate]
def get_review_file_set(db, dataset_version_id: UUID) -> list[ReviewableFile]      # files of the version snapshot
def mark_in_review(db, dataset_id: UUID) -> None                                     # submitted→in_review (from review.claim)
def mark_review_released(db, dataset_id: UUID) -> None                               # in_review→submitted
def apply_finalization(db, dataset_id: UUID, outcome: FinalizationOutcome) -> Dataset   # in_review→terminal/changes_requested
def list_annotatable_files(db, dataset_ids: list[UUID], accepted_file_ids: set[UUID]) -> list[AnnotatableFile]
def issue_file_assets(db, file_id: UUID, pages: list[int] | None) -> FileAssetsOut          # presigned previews + text; caller authorises
def lock_dataset(db, dataset_id: UUID) -> Dataset                                    # SELECT … FOR UPDATE
```

### 5.3 Validation rules

| Schema | Constraints |
|---|---|
| `DatasetCreateIn` | `title` 3–200 (strip, NFC); `description` ≤ 10,000; `data_class: Literal["raw","labeled"]`; `category` ∈ `system_settings.dataset_categories`; `primary_language` BCP-47 primary tag (`km`, `en`, …) or `mixed`; `languages` ≤ 10 unique; `tags` ≤ 20, each 1–40 chars `^[\w\- ]+$` (Unicode); `source_description` ≤ 5,000; `metadata: dict[str, MetadataValue]` ≤ 50 keys, key `^[a-z][a-z0-9_]{0,63}$`; `license: LicenseIn{contributor_is_rights_holder: bool, rights_holder_name?, source_url? (https?://, ≤ 2048), attribution_text? ≤ 500}` |
| `DatasetPatchIn` | same fields optional; header `If-Match: <lock_version>` required |
| `SubmitIn` | `rights_declaration: Literal[True]`; `rights_declaration_version` = current; `change_note ≤ 2000` (required on resubmission) |
| `WithdrawIn` | `reason ≤ 1000` |
| `UploadInitIn` | `filename` 1–255 (NFC; strip path separators, control chars; reserved names rejected); `size_bytes: int` 1 … `max_file_bytes` (≤ 4,000,000,000, AM-01); `declared_mime ≤ 255`; `relative_path ≤ 1024` (normalised, no `..`, no leading `/`); `client_fingerprint` `^[a-f0-9]{64}$` optional |
| `PartUrlsIn` | `part_numbers: list[int]` 1–100 items, each 1…`part_count`, unique |
| `CompleteIn` | `parts: list[{part_number 1–10000, etag 1–128}]` covering exactly 1…`part_count`, ascending |
| `TakedownIn` | `reason` 10–2000; `takedown_request_id: UUID | None`; `notify_owner: bool = True` |

### 5.4 Upload design

`init_upload` (1 tx):
1. `lock_dataset` (`FOR UPDATE`); owner check; status ∈ {`draft`, `changes_requested`}; actor `email_verified_at` and `onboarding_completed_at` set (A-09); user `active`.
2. Extension allowed (baseline §7 + `extra_allowed_extensions`) else `UnsupportedFileType`.
3. Resume: if `client_fingerprint` matches an open session (`uq_upload_sessions_resume`) return it (with uploaded parts from `list_parts`).
4. Quotas: `file_count + 1 ≤ max_files_per_dataset`; `total_bytes + size ≤ max_dataset_bytes`; user pending bytes (Σ `total_bytes` of the user's datasets in `draft|submitted|in_review|changes_requested`) + size ≤ `user_pending_quota_bytes`, computed under `advisory_xact_lock("upload_quota", user_id)`.
5. `part_size = max(16 MiB, ceil(size / 10_000) rounded up to 1 MiB)`; `part_count = ceil(size / part_size)`.
6. Insert `dataset_files` (`pending_upload`, `storage_key` built from new ids), `upload_sessions` (`initiated`, `expires_at = now() + upload_session_ttl_hours`); increment `datasets.file_count`, `total_bytes`.
7. IDs are generated in the application first, so the storage key is known; `storage.create_multipart` is called inside the transaction after all guards pass and before the inserts. If the transaction then fails, the orphan multipart is aborted by an `after_rollback` hook; any survivor is removed by the bucket lifecycle rule "abort incomplete multipart uploads after 2 days".

`complete_upload` (1 tx): session `FOR UPDATE`, status ∈ {`initiated`,`uploading`}, not expired; `storage.complete_multipart`; `storage.head` → actual size; if `actual ≠ declared_size_bytes` → delete object, file `failed/size_mismatch`, session `aborted/size_mismatch`, adjust dataset totals; else file → `uploaded` (`size_bytes = actual`, `uploaded_at`), session → `completed`; `enqueue_after_commit(db, "datahub.processing.process_file", file_id, queue="processing")`. Idempotent: a repeated complete on a `completed` session returns the file.

`abort_upload`: session `FOR UPDATE`; `storage.abort_multipart`; session → `aborted`; delete the `pending_upload` file row; decrement totals.

### 5.5 Submit / withdraw / finalize effects

`submit_dataset` (1 tx): `lock_dataset`; guards (state table §14.5): owner, status `draft|changes_requested`, no open upload sessions, all non-removed top-level files and members in terminal processing state (`ready|failed|quarantined`), ≥ 1 `ready` non-container file, active licence row, rights declaration accepted (`agreement_acceptances` row `rights_declaration` with `dataset_id`). Effects: `current_version_no += 1`, insert `dataset_versions` with snapshot, `status='submitted'`, `submitted_at`, `rights_declared_at`, notification `dataset_received` to owner, notify reviewers (users with `dataset.review`, batched, no email), audit.

`apply_finalization(db, dataset_id, outcome)` (joins review tx): guarded `in_review → {approved|partially_approved|rejected|changes_requested}`; sets `accepted_bytes`, `rejected_bytes`, `earning_micros`, `quality_score`, `data_class` (final), `finalized_at` (not for `changes_requested`); licence `effective_from = now()` when approved/partially approved.

`take_down_dataset` (joins the caller's tx): `lock_dataset`; any status → `taken_down`; revoke licence; abort open upload sessions. It is always invoked by `admin.service.take_down_dataset` (§12), which in the same transaction releases an `in_progress` review (`review.service.release_review(..., reason="taken_down")`), cancels annotation tasks on the dataset's files (`annotation.service.cancel_tasks_for_dataset`), marks the linked `takedown_requests` row `actioned` and notifies the owner. Earned money is not reversed automatically (a super_admin adjustment is used if required).

### 5.6 Tasks (`datasets/tasks.py`)

| Task | Queue | Trigger | Body |
|---|---|---|---|
| `datahub.uploads.expire_sessions` | default | beat every 15 min | `expire_upload_sessions(db, now)` — selects ≤ 200 sessions `WHERE status IN ('initiated','uploading') AND expires_at < now()` `FOR UPDATE SKIP LOCKED`, aborts S3 multipart (NoSuchUpload ignored), status `expired`, deletes the `pending_upload` file row, adjusts dataset totals; loops until none left. Idempotent by status guard. |

---

## 6. Module `processing`

Worker-side pipeline; owns no tables (writes via `datasets.service` internal API). Layout: `service.py` (pipeline orchestration), `pipeline.py` (pure steps), `archive.py` (ZIP expansion), `previews.py` (renderers), `dedupe.py` (SimHash/pHash), `tasks.py`, `schemas.py` (`ProcessingResult`, `ArchiveMemberIn`).

### 6.1 Interfaces

```python
# processing/service.py
def process_file(db, file_id: UUID) -> ProcessingOutcome
def expand_archive(db, container_file_id: UUID) -> ArchiveOutcome
def detect_duplicates(db, file_id: UUID) -> DuplicateOutcome
def sweep_stalled(db, now: datetime) -> int
def scan_aux_object(db, kind: Literal["message_attachment","payout_proof","kyc_document"], object_id: UUID) -> None

# processing/pipeline.py (pure, unit-testable, no DB)
def hash_and_stage(storage: Storage, key: str, dest: Path) -> tuple[bytes, int]          # sha256, size; streaming
def run_scan(clamd: ClamdClient, path: Path, max_bytes: int) -> ScanResult
def render_previews(path: Path, fmt: str, out_dir: Path, *, max_pages: int = 500) -> list[PreviewArtifact]
def extract_text(path: Path, fmt: str, *, max_bytes: int = 50 * 1024 * 1024) -> str | None
def compute_simhash(text: str) -> int                                                    # 64-bit, char 4-shingles (Khmer-safe)
def compute_phash(image_path: Path) -> int                                               # 64-bit DCT pHash

# processing/archive.py
def inspect_zip(path: Path, limits: ArchiveLimits) -> list[ZipMemberPlan]               # validates central directory
def extract_member(zf: ZipFile, member: ZipMemberPlan, dest: Path, limits: ArchiveLimits) -> Path
def sanitize_member_path(name: str) -> str | None                                        # None ⇒ unsafe
```

### 6.2 `process_file` algorithm

1. **Claim** (tx 1): `datasets.service.claim_file_for_processing` — `UPDATE dataset_files SET processing_status='processing', processing_started_at=now(), processing_attempts=processing_attempts+1 WHERE id=:id AND processing_status='uploaded' RETURNING …`. No row → exit (already processed / being processed). Commit.
2. **Stage** (no tx): stream object to `WORKER_SCRATCH_DIR/<file_id>/original` (noexec volume, deleted in `finally`), computing SHA-256 and size; size must equal `size_bytes` else result `failed/size_mismatch`.
3. **Sniff**: `core.sniffer.sniff`; not ok → `failed/<failure_code>`.
4. **Scan** (not for ZIP containers): `run_scan` with `max_bytes = max_file_bytes` (≤ 4,000,000,000; whole-object scan, AM-01). `infected` → copy object to `quarantine/<file_id>`, delete original key, result `quarantined/infected` with signature; `error` → transient retry (step 8); `error` with `scan_size_limit` → `failed/scan_size_limit`.
5. **Derivatives**: page images (PDF ≤ 500 pages via pypdfium2 at 150 DPI, long edge ≤ 2048 px; TIFF frames; images → WebP ≤ 4096 px), thumbnail, extracted text (PDF text layer, DOCX/ODT/RTF/TXT; first 1 MB stored as `text.txt` derivative, full text used only for SimHash), CSV/XLSX first 200 rows → JSON table, ZIP member list → JSON. Upload derivatives with `storage.put_file`.
6. **Persist** (tx 2): `record_processing_result` — guarded `processing → ready|failed|quarantined`; set `sha256`, `format`, `detected_mime`, `scan_*`, `page_count`, flags, `text_object_key`, `simhash`, `phash`, `extracted_metadata`, `processed_at`; replace `file_previews` rows; if quarantined → `security_events.file_quarantined` + notify admins; audit `processing.file.processed`. If every file of the dataset is now terminal → notification `dataset_processing_finished` (dedupe key `dataset:{id}:processing_finished:{current_version_no}:{count_terminal}`). After commit: enqueue `detect_duplicates(file_id)` when ready; enqueue `expand_archive(file_id)` for ZIP containers.
7. Cleanup scratch dir.
8. **Retry policy**: transient errors (S3 5xx/timeouts, clamd `error`/unavailable, `OperationalError`) → `return_file_to_uploaded` (tx) then `self.retry()` (×3, backoff 30/120/480 s). After the last retry → `failed` with `scan_error` (if scanning failed) or `processing_error`, `scan_status='error'`. Deterministic errors (corrupt/type) never retry.
9. Time limits: soft 1,800 s, hard 2,100 s; on soft limit the task records `processing_error` and exits.

### 6.3 `expand_archive` algorithm

1. Load container (must be `ready`, `is_container`). Stage it.
2. `inspect_zip`: reject (container → `failed/archive_limits_exceeded`, via a dedicated `record_processing_result` override) when members > 10,000, Σ declared uncompressed > 20 GB, or any member declared ratio > 100:1. Encrypted members → member `failed/encrypted_content`.
3. For each member (sorted by name): `sanitize_member_path` (NFC; reject absolute, drive letters, `..`, empty segments, symlink (external attr `S_IFLNK`), device files, names > 1024 bytes) → unsafe → member row `failed/unsafe_member_path`. Directories skipped. Nested `.zip` → member row `failed/nested_archive`.
4. Create member row with `create_archive_member` (`ON CONFLICT (parent_file_id, member_path) DO NOTHING` → idempotent re-runs), status `uploaded`; stream-extract to scratch while counting real bytes (abort member if real size > declared or ratio > 100:1 → `failed/archive_limits_exceeded`); upload to its own key; commit per batch of 50 members; enqueue `process_file(member_id)` after commit.
5. Members do not count against `max_files_per_dataset`; their bytes do not change `datasets.total_bytes` (container bytes already counted); they are reviewed and paid individually; the container is never payable (baseline §7).

### 6.4 `detect_duplicates` algorithm

1. Exact: `find_exact_matches` — other `dataset_files` with the same `sha256` (any dataset, excluding self, excluding containers) → `upsert_duplicate(kind='exact', method='sha256', similarity=1)`; `matched_was_accepted` = matched file has an `accepted` decision in a `finalized` review, obtained through `review.service.accepted_file_ids(db, file_ids)` (`processing` sits above `review`, D-LLD-02).
2. Near (text): candidates with Hamming distance ≤ 3 on `simhash` (pre-filtered with 4 × 16-bit band equality via expression indexes in revision 0008 if needed) → `kind='near'`, `method='simhash'`, similarity = 1 − d/64.
3. Near (image): `phash` Hamming ≤ 6 → `method='phash'`.
4. Upsert key `(file_id, matched_file_id, kind)`; idempotent.

### 6.5 `sweep_stalled` (beat every 10 min; files stuck in `processing` only)

- `processing` rows with `processing_started_at < now() − 45 min` → guarded back to `uploaded` and re-enqueued (if `processing_attempts ≥ 4` → `failed/processing_error`).
- Lost after-commit enqueues of `uploaded` files are handled by `datahub.admin.requeue_stalled` (§12.3, AM-10).

### 6.6 `scan_aux_object`

Scans message attachments, payout proofs and KYC documents (≤ 10 MB, `processing` queue): stream to clamd, sniff against the allow-list of the kind; updates the owning row through `messaging.service.set_attachment_scan_result`, `finance.service.set_proof_scan_result`, `identity.service.set_id_document_scan_result`; infected objects are deleted and a `file_quarantined` security event recorded. Retries ×3 then `error` (object stays invisible).


---

## 7. Module `review`

Layout: `router.py` (`/reviews/*`, `/datasets/{id}/claim-review`, `/datasets/{id}/reviews`), `service.py`, `models.py`, `schemas.py`, `repository.py`. No tasks.

### 7.1 Endpoints → handlers → services

| Method & path | Handler | Permission | Service call |
|---|---|---|---|
| `GET /reviews/queue` | `get_queue` | `dataset.review` | `get_queue(db, actor, filters, page)` (submitted datasets oldest first, excluding own; plus the actor's `in_progress` reviews) |
| `POST /datasets/{id}/claim-review` | `claim` | `dataset.review` | `claim_review(db, actor, dataset_id)` |
| `GET /reviews/{id}` | `get_review` | assignee or `dataset.read.any` | `get_review_workspace(db, actor, review_id)` |
| `PUT /reviews/{id}/files/{file_id}` | `set_file_decision` | assignee | `set_file_decision(db, actor, review_id, file_id, data)` |
| `POST /reviews/{id}/files/bulk` | `bulk_file_decisions` | assignee | `set_file_decisions_bulk(db, actor, review_id, data)` |
| `PATCH /reviews/{id}` | `update_review` | assignee | `update_review(db, actor, review_id, data, if_match)` |
| `GET /reviews/{id}/summary` | `get_summary` | assignee or `dataset.read.any` | `get_summary(db, actor, review_id)` |
| `POST /reviews/{id}/finalize` | `finalize` | assignee; `Idempotency-Key` (optional) | `finalize_review(db, actor, review_id, data, idempotency_key)` |
| `POST /reviews/{id}/release` | `release` | assignee, or `user.manage` (admin force-release) | `release_review(db, actor, review_id, data.reason)` |
| `GET /reviews/history` | `history` | `dataset.review` | `list_review_history(db, actor, filters, page)` |
| `GET /datasets/{id}/reviews` | `list_for_owner` | owner (`dataset.read.own`) | `list_reviews_for_dataset_owner(db, actor, dataset_id)` (contributor-safe fields only: decision, feedback, per-file decision/reason/comment, accepted bytes, earning) |

### 7.2 Service interface

```python
def get_queue(db, actor: Actor, filters: QueueFilters, page: PageParams) -> Page[QueueItem]
def claim_review(db, actor: Actor, dataset_id: UUID) -> DatasetReview
def get_review_workspace(db, actor: Actor, review_id: UUID) -> ReviewWorkspaceOut   # files, duplicates, metadata, history
def set_file_decision(db, actor: Actor, review_id: UUID, file_id: UUID, data: FileDecisionIn) -> DatasetFileReview
def set_file_decisions_bulk(db, actor: Actor, review_id: UUID, data: BulkFileDecisionIn) -> BulkResultOut
def update_review(db, actor: Actor, review_id: UUID, data: ReviewPatchIn, if_match: int) -> DatasetReview
def get_summary(db, actor: Actor, review_id: UUID) -> ReviewSummaryOut              # includes finance.preview_dataset_earning
def finalize_review(db, actor: Actor, review_id: UUID, data: FinalizeIn, idempotency_key: str | None) -> FinalizeOut
def release_review(db, actor: Actor | None, review_id: UUID, reason: str) -> DatasetReview
def list_review_history(db, actor: Actor, filters: HistoryFilters, page: PageParams) -> Page[ReviewHistoryItem]
def list_reviews_for_dataset_owner(db, actor: Actor, dataset_id: UUID) -> list[OwnerReviewOut]
def accepted_file_ids(db, file_ids: list[UUID]) -> set[UUID]                          # for processing.detect_duplicates
def accepted_file_ids_for_datasets(db, dataset_ids: list[UUID]) -> set[UUID]          # for annotation.generate_tasks / exports
def release_active_review_for_dataset(db, dataset_id: UUID, actor: Actor | None, reason: str) -> None
```

### 7.3 Validation rules

| Schema | Constraints |
|---|---|
| `FileDecisionIn` | `decision: Literal["accepted","rejected"]`; `reason_code` from the reason enum, required when rejected; `comment ≤ 2000`; `labeled_upgrade: bool = False` (only with `accepted`, only when dataset `data_class_final`/declared is `labeled` and `labeled_upgrade_enabled`) |
| `BulkFileDecisionIn` | `items: list[{file_id, decision, reason_code?, comment?, labeled_upgrade?}]` 1–500, unique `file_id`; or `{file_ids: [...] (1–2000), decision, reason_code?, comment?}` |
| `ReviewPatchIn` | `checklist: dict[ChecklistKey, bool]` (keys: `rights_plausible`, `language_matches`, `content_legible`, `no_sensitive_personal_data`, `metadata_accurate`, `not_spam_or_generated`); `quality_scores: list[{dimension, score 1–5, comment ≤ 1000}]` unique dimension; `internal_comments ≤ 10,000`; `feedback_to_contributor ≤ 10,000`; `data_class_final: Literal["raw","labeled"]`; header `If-Match` = `lock_version` |
| `FinalizeIn` | `decision: Literal["approve","partial","reject","request_changes"]`; `feedback: str` 0–10,000 (required ≥ 10 chars for reject/request_changes); `data_class_final?` |
| `ReleaseIn` | `reason` 3–500 |

### 7.4 Transactions and locks

| Operation | Tx | Locks / guards |
|---|---|---|
| `claim_review` | 1 tx | `datasets.lock_dataset` (FOR UPDATE); dataset `submitted`; actor ≠ owner; actor's `in_progress` dataset reviews < `review_max_active_claims` (default 5, AM-09) else `409 review.claim_limit_reached`; insert review (`in_progress`, `dataset_version_id` = current version, `data_class_declared`); `datasets.mark_in_review`; `uq_dataset_reviews_one_active` turns a concurrent double-claim into 409 `conflict` (`already_claimed`) |
| `set_file_decision(s)` | 1 tx | review `FOR UPDATE` (serialises with finalize); review `in_progress`, `reviewer_id = actor`; file ∈ version file set, reviewable (`ready`, not container, not removed); upsert on `uq_dataset_file_reviews_review_id_file_id` |
| `update_review` | 1 tx | review `FOR UPDATE`; `lock_version` match; upsert `dataset_quality_scores` on `(review_id, dimension)` |
| `finalize_review` | **1 tx** spanning review, datasets, finance, messaging, audit | read review → `datasets.lock_dataset` → review `FOR UPDATE` → (finance) user wallet `FOR UPDATE` → content advisory locks; `SET LOCAL lock_timeout = '5s'` |
| `release_review` | 1 tx | dataset `FOR UPDATE` → review `FOR UPDATE`; `in_progress → released`; `datasets.mark_review_released` |

### 7.5 `finalize_review` algorithm

1. Load review (no lock) → `dataset_id`; `datasets.lock_dataset(dataset_id)`; `SELECT review FOR UPDATE`.
2. **Idempotent replay**: if `status = 'finalized'`: when `decision == data.decision` and (`idempotency_key` is None or equals `finalize_idempotency_key`) return the stored `FinalizeOut` (HTTP 200); otherwise `InvalidStateTransition`.
3. Guards: `status = 'in_progress'`; `reviewer_id = actor.user_id`; `actor.user_id ≠ dataset.owner_id`; dataset `in_review`.
4. Build file set = `datasets.get_review_file_set(dataset_version_id)` restricted to reviewable files; decisions = review's file decisions.
   - `approve`: every reviewable file decided and all `accepted`.
   - `partial`: every reviewable file decided, ≥ 1 accepted and ≥ 1 rejected.
   - `reject`: every reviewable file decided and none accepted, *or* no decisions plus feedback (whole-dataset rejection: all reviewable files are recorded as `rejected` with `reason_code='other'` automatically).
   - `request_changes`: no per-file requirement; feedback required.
   - `approve`/`partial`: checklist has all six keys; quality scores for `legibility`, `completeness`, `language_accuracy`, `metadata_accuracy`, `uniqueness` (+ `label_accuracy` when final class is `labeled`).
5. `data_class_final = data.data_class_final or review.data_class_final or review.data_class_declared`.
6. Stats: accepted/rejected counts and bytes (Σ `size_bytes`).
7. For `approve`/`partial`: build `DatasetEarningInputs(review_id, dataset_id, beneficiary_user_id=owner_id, data_class=data_class_final, finalized_at=now(), files=[EarningFileInput(file_id, sha256, accepted_bytes=size_bytes, labeled_upgrade)])` for accepted files that are `ready`, `scan_status='clean'`, not containers (baseline §8.3); call `finance.service.credit_dataset_earning(db, review_id, actor, inputs)` → `journal | None` and `EarningSummary` (payable bytes, pricing rule id).
8. Update review: `status='finalized'`, `decision`, `data_class_final`, `feedback_to_contributor`, stats, `payable_bytes`, `earning_micros`, `pricing_rule_id`, `ledger_journal_id`, `finalize_idempotency_key`, `finalized_at`.
9. `datasets.apply_finalization(dataset_id, FinalizationOutcome(status, accepted_bytes, rejected_bytes, earning_micros, quality_score = round(mean(scores) × 20), data_class_final))`.
10. Notifications (+ email per preferences): `dataset_approved` | `dataset_partially_approved` | `dataset_rejected` | `dataset_changes_requested`; `earnings_credited` when earning > 0.
11. Audit: `review.review.finalize` (before/after), `datasets.dataset.<status>`, finance journal audit inside finance.
12. Commit. After commit: WebSocket `notification.created`.

Re-submission after `changes_requested` creates a new `dataset_versions` row and the next claim creates a new review; earlier reviews remain as history. If a later version is approved, files whose content was already paid earn 0 (`already_paid`), which prevents double payment across versions.

---

## 8. Module `finance`

Layout: `router.py` (`router`: `/wallet`, `/earnings`, `/payouts`, `/public/pricing`, `/pricing-rules`; `admin_router`: `/admin/finance/*`, `/admin/payouts/*`, `/admin/adjustments`, `/admin/ledger`, `/admin/pricing-rules`), `service.py`, `ledger.py` (journal primitive), `models.py`, `schemas.py` (incl. input DTOs), `repository.py`, `tasks.py`.

### 8.1 Endpoints → handlers → services

| Method & path | Handler | Permission | Service call |
|---|---|---|---|
| `GET /wallet` | `get_wallet` | `profile.self` | `get_wallet_summary(db, actor)` (estimated, pending, available, reserved, paid, adjustments, lifetime approved — baseline §8.6) |
| `GET /wallet/transactions` | `list_transactions` | `profile.self` | `list_wallet_lines(db, actor, filters, page)` |
| `GET /earnings` | `list_earnings` | `profile.self` | `list_earning_records(db, actor, filters, page)` |
| `POST /payouts` | `create_payout` | `payout.request`; `Idempotency-Key` **required**; rate `payout_request` | `request_payout(db, actor, data, idempotency_key)` |
| `GET /payouts` / `GET /payouts/{id}` | `list_payouts` / `get_payout` | `payout.request` | `list_own_payouts`, `get_own_payout` |
| `POST /payouts/{id}/cancel` | `cancel_payout` | `payout.request` (owner) | `cancel_payout_by_owner(db, actor, payout_id)` |
| `GET /public/pricing` | `public_pricing` | — | `get_public_pricing(db)` (current rates, min/max withdrawal, hold days) |
| `GET /admin/finance/overview` | `overview` | `finance.read` | `get_finance_overview(db, period)` |
| `GET /admin/payouts` / `GET /admin/payouts/{id}` | `admin_list_payouts` / `admin_get_payout` | `finance.read` | `list_payouts_admin`, `get_payout_admin` (method details audited) |
| `POST /admin/payouts/{id}/approve` | `approve` | `payout.approve` | `approve_payout(db, actor, payout_id, data)` |
| `POST /admin/payouts/{id}/reject` | `reject` | `payout.approve` | `reject_payout(db, actor, payout_id, data)` |
| `POST /admin/payouts/{id}/mark-paid` | `mark_paid` | `payout.record_payment`; `Idempotency-Key` optional | `mark_payout_paid(db, actor, payout_id, data)` |
| `POST /admin/payouts/{id}/mark-failed` | `mark_failed` | `payout.record_payment` | `mark_payout_failed(db, actor, payout_id, data)` |
| `POST /admin/payouts/{id}/cancel` | `admin_cancel` | `payout.approve` | `cancel_payout_by_admin(db, actor, payout_id, data)` |
| `POST /admin/payouts/{id}/reverse` | `reverse` | `finance.adjust` (super_admin) | `reverse_payout(db, actor, payout_id, data)` |
| `POST /admin/payouts/{id}/proof` | `upload_proof` | `payout.record_payment`; multipart ≤ 10 MB | `attach_payout_proof(db, actor, payout_id, upload)` |
| `POST /admin/adjustments` | `create_adjustment` | `finance.adjust`; `Idempotency-Key` required | `create_adjustment(db, actor, data, idempotency_key)` |
| `GET /admin/ledger` | `ledger` | `finance.read` | `list_journals(db, filters, page)` |
| `GET /pricing-rules` | `list_pricing_rules` | `finance.read` | `list_pricing_rules(db)` |
| `POST /admin/pricing-rules` | `create_pricing_rule` | `pricing.manage` | `create_pricing_rule(db, actor, data)` |
| `GET /admin/finance/reconciliation` | `reconciliation` | `finance.read` | `get_last_reconciliation(db)` |

### 8.2 Ledger primitive (`finance/ledger.py`)

```python
@dataclass(frozen=True)
class LineSpec:
    wallet: Wallet
    bucket: Literal["pending", "available", "reserved", "paid", "main"]
    amount_micros: int                     # signed, ≠ 0

def get_or_create_user_wallet(db, user_id: UUID) -> Wallet          # INSERT … ON CONFLICT (owner_user_id) DO NOTHING; then SELECT
def lock_user_wallet(db, user_id: UUID) -> Wallet                    # SELECT … FOR UPDATE; records lock in db.info["locked_wallets"]
def system_wallet(db, code: str) -> Wallet                           # cached per process (immutable rows)
def find_journal(db, idempotency_key: str) -> LedgerJournal | None
def post_journal(db, *, kind: str, idempotency_key: str, source_type: str, source_id: UUID, user_id: UUID,
                 lines: Sequence[LineSpec], description: str, created_by: UUID | None) -> LedgerJournal:
    """Preconditions: inside a transaction; every user wallet in `lines` is locked (asserted).
    1. Σ amounts == 0, ≥ 2 lines, amount = Σ positives (checked in Python before the DB trigger does).
    2. INSERT ledger_journals … ON CONFLICT (idempotency_key) DO NOTHING RETURNING id.
       No row → load existing; if kind/source/amount equal → return it (replay); else IdempotencyKeyReused.
    3. INSERT wallet_transactions (line_no 1..n); for user-wallet lines:
       UPDATE wallets SET <bucket>_micros = <bucket>_micros + :amt, journal_count = journal_count + 1,
              last_journal_at = now(), updated_at = now() WHERE id = :wallet_id RETURNING <bucket>_micros
       → balance_after_micros. CHECK (≥ 0) violation → InsufficientBalance (mapped from ck_wallets_*_nonneg).
    4. audit 'finance.journal.post'. Returns the journal."""
```

All amounts are Python `int`; the formula helper is `def earning_for(bytes_: int, rate_micros_per_gb: int) -> int: return (bytes_ * rate_micros_per_gb) // 1_000_000_000` (floor, baseline §8.2). No `float` or `Decimal` arithmetic on money anywhere (lint rule: `flake8` plugin bans `float(` in `finance/`).

### 8.3 Service interface

```python
def get_rate_in_force(db, data_class: str, at: datetime) -> PricingRule
def get_current_rates(db) -> dict[str, PricingRule]
def preview_dataset_earning(db, inputs: DatasetEarningInputs) -> EarningPreview     # read-only, no locks
def credit_dataset_earning(db, review_id: UUID, actor: Actor, inputs: DatasetEarningInputs
                           ) -> tuple[LedgerJournal | None, EarningSummary]
def credit_annotation_reward(db, annotation_review_id: UUID, actor: Actor, inputs: AnnotationRewardInputs
                             ) -> tuple[LedgerJournal | None, EarningRecord]
def release_pending_earnings(db, now: datetime, batch: int = 100) -> int
def reconcile(db) -> ReconciliationReport
def get_wallet_summary(db, actor: Actor) -> WalletSummaryOut
def list_wallet_lines(db, actor: Actor, filters: LineFilters, page: PageParams) -> Page[WalletLineOut]
def list_earning_records(db, actor: Actor, filters: EarningFilters, page: PageParams) -> Page[EarningRecordOut]
def request_payout(db, actor: Actor, data: PayoutRequestIn, idempotency_key: str) -> tuple[PayoutRequest, bool]  # (payout, created)
def list_own_payouts(db, actor: Actor, filters, page) -> Page[PayoutOut]
def get_own_payout(db, actor: Actor, payout_id: UUID) -> PayoutOut
def cancel_payout_by_owner(db, actor: Actor, payout_id: UUID) -> PayoutRequest
def approve_payout(db, actor: Actor, payout_id: UUID, data: ApproveIn) -> PayoutRequest
def reject_payout(db, actor: Actor, payout_id: UUID, data: RejectIn) -> PayoutRequest
def mark_payout_paid(db, actor: Actor, payout_id: UUID, data: MarkPaidIn) -> PayoutRequest
def mark_payout_failed(db, actor: Actor, payout_id: UUID, data: MarkFailedIn) -> PayoutRequest
def cancel_payout_by_admin(db, actor: Actor, payout_id: UUID, data: CancelIn) -> PayoutRequest
def reverse_payout(db, actor: Actor, payout_id: UUID, data: ReverseIn) -> PayoutRequest
def attach_payout_proof(db, actor: Actor, payout_id: UUID, upload: UploadFile) -> PayoutRecord
def set_proof_scan_result(db, payout_record_id: UUID, result: ScanResult) -> None
def create_adjustment(db, actor: Actor, data: AdjustmentIn, idempotency_key: str) -> PayoutAdjustment
def list_journals(db, filters: JournalFilters, page: PageParams) -> Page[JournalOut]
def list_pricing_rules(db) -> list[PricingRuleOut]
def create_pricing_rule(db, actor: Actor, data: PricingRuleIn) -> PricingRule
def get_finance_overview(db, period: DateRange) -> FinanceOverviewOut
def get_last_reconciliation(db) -> ReconciliationReport | None
def user_financial_blockers(db, user_id: UUID) -> list[str]               # for account deletion: open_payout, positive_balance
```

Input DTOs (`finance/schemas.py`, imported by `review` and `annotation`):

```python
class EarningFileInput(BaseModel):     file_id: UUID; sha256: bytes; accepted_bytes: int = Field(ge=0); labeled_upgrade: bool
class DatasetEarningInputs(BaseModel): review_id: UUID; dataset_id: UUID; beneficiary_user_id: UUID
                                       data_class: Literal["raw","labeled"]; finalized_at: datetime
                                       files: list[EarningFileInput]
class AnnotationRewardInputs(BaseModel): annotation_review_id: UUID; task_id: UUID; project_id: UUID
                                         annotator_id: UUID; reward_per_task_micros: int = Field(ge=0)
                                         reward_per_page_micros: int = Field(ge=0); page_count: int = Field(ge=1)
```

### 8.4 `credit_dataset_earning` (joins the finalize transaction)

1. `key = f"dataset_review:{review_id}:earning"`; if `find_journal(key)` or `earning_records` exist for `(dataset_review, review_id)` → return the existing result (replay).
2. `set_local_lock_timeout(5000)`; `wallet = get_or_create_user_wallet(beneficiary)`; `lock_user_wallet`.
3. `rule = get_rate_in_force(data_class, finalized_at)`.
4. Sort files by `content_sha256` (lower-case hex); `SELECT pg_advisory_xact_lock(hashtext(:content_sha256))` for each distinct hash in ascending order (baseline AM-03; ascending → no deadlock between concurrent finalizations sharing content), **then** re-check eligibility (step 5) under the locks.
5. For each file: duplicate within this submission (hash already seen) → 0 `duplicate_in_submission`. Else query paid records for the hash (`amount_micros > 0`, `source_type='dataset_review'`):
   - none → `pricing_tier = data_class` (`raw`|`labeled`), `amount = earning_for(accepted_bytes, rule.rate)`; 0 → `zero_reason='rounding'`.
   - base payment exists at tier `raw`, no `labeled_upgrade` row yet, `labeled_upgrade` ticked, `labeled_upgrade_enabled`, `data_class='labeled'`, `base.rate_micros_per_gb < rule.rate` → `pricing_tier='labeled_upgrade'`, `previously_paid_rate = base.rate`, `amount = earning_for(bytes, rule.rate − base.rate)`.
   - otherwise → 0 `already_paid`.
6. `total = Σ amount`. Insert `earning_records` (one per file). Each record stores `content_sha256` and `pricing_tier`; the partial unique index `uq_earning_records_content_tier_paid (content_sha256, pricing_tier) WHERE amount_micros > 0` (AM-03) makes any race that slipped past step 4 fail the whole transaction (retried by the client with the same idempotency key).
7. If `total > 0`: `bucket = 'pending' if earning_hold_days > 0 else 'available'`; `post_journal(kind='dataset_earning', key, source=('dataset_review', review_id), lines=[(user, bucket, +total), (system_dataset_purchases, main, −total)])`; set `journal_id`, `credited_bucket`, `hold_until` on the records.
8. Return `(journal, EarningSummary(total, payable_bytes, pricing_rule_id))`.

### 8.5 Payout operations (each is one transaction; lock order payout → wallet)

| Operation | Guards (all violations → 4xx without side effects) | Effects | Journal (key) |
|---|---|---|---|
| `request_payout` | key lookup first: existing `(user_id, client_idempotency_key)` → same `request_fingerprint` ⇒ return it (HTTP 200, `created=False`), different ⇒ `IdempotencyKeyReused`; user `active`; `verification_status='approved'`; method owned & not deleted; `amount % 10000 = 0`; `min_withdrawal ≤ amount ≤ max_withdrawal`; no open payout (`uq_payout_requests_one_open`); `available_micros ≥ amount` **after** `lock_user_wallet` | insert request (`requested`, `approvals_required = 2 if amount ≥ payout_dual_approval_threshold_micros else 1`, method snapshot); notify user `withdrawal_requested` (+ email) and admins with `payout.approve` (in-app) | `payout_reserve` `payout:{id}:reserve`: available −X, reserved +X |
| `approve_payout` | payout `FOR UPDATE`; status `requested`; approver ≠ recipient; approver not already in `payout_approvals`; session MFA verified | insert approval (`approval_no = approvals_count + 1`); `approvals_count += 1`; if `= approvals_required` → `approved`, `approved_at`, notify `withdrawal_approved` | — |
| `reject_payout` | `requested`; actor ≠ recipient; reason 5–2000 | → `rejected`; notify + email | `payout_release` `payout:{id}:release`: reserved −X, available +X |
| `cancel_payout_by_owner` | owner; `requested` | → `cancelled` | `payout_release` |
| `cancel_payout_by_admin` | `approved`; actor ≠ recipient; reason | → `cancelled` | `payout_release` |
| `mark_payout_paid` | `approved`; recorder ≠ recipient; `payment_reference` 1–200 non-blank, unique per method (`uq_payout_records_method_type_payment_reference` → 409); `paid_at ≤ now() + 5 min` and `≥ requested_at`; `amount_micros` = request amount | insert `payout_records`; → `paid`, `paid_at`; notify `payment_recorded` (+ email) | `payout_settle` `payout:{id}:settle`: reserved −X, paid +X |
| `mark_payout_failed` | `approved`; reason | → `failed`; notify `payment_failed` | `payout_release` |
| `reverse_payout` | `paid`; `finance.adjust`; actor ≠ recipient; reason ≥ 10 chars | → `reversed`; notify `payment_reversed` | `payout_reversal` `payout:{id}:reversal`: paid −X, available +X |
| `attach_payout_proof` | status `paid`; proof not yet attached; size ≤ 10 MB; sniffed PDF/PNG/JPEG | store object `payouts/{id}/proof/{uuid}`, proof columns, `proof_scan_status='pending'`; enqueue `scan_aux_object` | — |
| `create_adjustment` | `finance.adjust`; creator ≠ user; key unique per creator (replay returns existing); debit requires `available ≥ amount` | insert adjustment; notify `adjustment_posted` | `adjustment_credit`/`adjustment_debit` `adjustment:{id}`: user.available ±X, system_adjustments.main ∓X |
| `create_pricing_rule` | `pricing.manage`; `effective_from ≥ now()` (no retroactive pricing); rate > 0 | in one tx: close the open rule of that class (`effective_to = new.effective_from`, guard trigger allows once) and insert the new rule; exclusion constraint guarantees no overlap | — |

### 8.6 Validation rules

| Schema | Constraints |
|---|---|
| `PayoutRequestIn` | `amount_micros: int` > 0, multiple of 10,000 (also accepts `amount: str` `^\d{1,7}(\.\d{1,2})?$` USD converted exactly with integer parsing, never float); `payout_method_id: UUID`; `note ≤ 500` |
| `ApproveIn` | `note ≤ 1000` |
| `RejectIn` / `CancelIn` / `MarkFailedIn` | `reason` 5–2000 |
| `MarkPaidIn` | `payment_reference` 1–200 (strip; `^[\x20-\x7E]+$` printable ASCII); `paid_at: AwareDatetime`; `external_fee_micros ≥ 0`; `notes ≤ 2000` |
| `ReverseIn` | `reason` 10–2000 |
| `AdjustmentIn` | `user_id`; `direction: credit|debit`; `amount_micros` > 0, ≤ 10,000,000,000 ($10,000); `reason_code`; `reason` 10–2000; `related_type/related_id` both or neither |
| `PricingRuleIn` | `data_class`; `rate_micros_per_gb` 1 … 100,000,000; `effective_from: AwareDatetime` ≥ now; `reason` 5–2000 |

### 8.7 Tasks (`finance/tasks.py`)

| Task | Queue | Trigger | Design |
|---|---|---|---|
| `datahub.finance.release_pending` | default | beat hourly (minute 5) | `release_pending_earnings`: select ≤ 100 `earning_records` (dataset earnings **and** annotation rewards, AM-02) with `credited_bucket='pending' AND released_at IS NULL AND hold_until ≤ now()` `FOR UPDATE SKIP LOCKED`; per record its own tx: `lock_user_wallet`; `post_journal(kind='earning_release', key=f"earning_release:{earning_record_id}", source=('earning_record', id), lines=[(user,pending,−X),(user,available,+X)])`; update the record's `released_at`, `release_journal_id`; notify `earnings_released`. Idempotent by journal key + `released_at IS NULL` guard. Retries ×3. |
| `datahub.finance.reconcile` | default | beat nightly 01:30 UTC | read-only: (1) per user wallet and bucket Σ lines = cached column; (2) every journal Σ = 0 and amount = Σ positives; (3) Σ `reserved` lines per user = Σ amount of payouts in `requested|approved`; (4) Σ `paid` = Σ amount `paid` − reversed payouts; (5) Σ all `system_dataset_purchases` lines = −Σ `dataset_earning` journals amount. Report → Redis `finance:reconciliation:last` (TTL 8 d) and `audit_logs` (`finance.reconcile.run`, metadata summary). Mismatch → log `error`, Sentry event, in-app notification to super_admins. Never writes to the ledger. Time limit 1,800 s. |

---

## 9. Module `annotation`

Layout: `router.py` (`/annotation/*`), `service.py`, `validation.py` (annotation data validation against project config), `models.py`, `schemas.py`, `repository.py`, `tasks.py`.

### 9.1 Endpoints → handlers → services

| Method & path | Handler | Permission | Service call |
|---|---|---|---|
| `GET /annotation/projects` / `POST` | `list_projects` / `create_project` | `annotation.manage` | `list_projects`, `create_project(db, actor, data)` |
| `GET /annotation/projects/{id}` / `PATCH` | `get_project` / `update_project` | `annotation.manage` | `get_project_detail` (progress stats), `update_project(db, actor, project_id, data, if_match)` |
| `POST /annotation/projects/{id}/generate-tasks` | `generate_tasks` | `annotation.manage` | `generate_tasks(db, actor, project_id)` |
| `POST /annotation/projects/{id}/close` | `close_project` | `annotation.manage` | `close_project(db, actor, project_id, data)` |
| `GET /annotation/projects/{id}/tasks` | `list_project_tasks` | `annotation.manage` | `list_project_tasks(db, project_id, filters, page)` |
| `POST /annotation/tasks/{id}/assign` | `assign` | `annotation.manage` | `assign_task(db, actor, task_id, data.annotator_id)` |
| `POST /annotation/tasks/bulk-assign` | `bulk_assign` | `annotation.manage` | `bulk_assign(db, actor, data)` |
| `POST /annotation/tasks/{id}/unassign` | `unassign` | `annotation.manage` | `unassign_task(db, actor, task_id, data)` |
| `GET /annotation/my-tasks` | `my_tasks` | `annotation.work` | `list_my_tasks(db, actor, filters, page)` |
| `GET /annotation/tasks/{id}` | `get_task` | active assignee, `annotation.review` (claimed reviewer or queue view), or `annotation.manage` | `get_task_workspace(db, actor, task_id)` — project instructions, annotation (data + `version`), feedback, presigned page assets (`datasets.issue_file_assets`) |
| `POST /annotation/tasks/{id}/start` | `start` | `annotation.work` | `start_task(db, actor, task_id)` |
| `PUT /annotation/tasks/{id}/draft` | `save_draft` | `annotation.work`; header `If-Match` required; rate `annotation_draft` | `save_draft(db, actor, task_id, data, if_match)` |
| `POST /annotation/tasks/{id}/submit` | `submit` | `annotation.work`; `If-Match` | `submit_task(db, actor, task_id, if_match)` |
| `GET /annotation/tasks/{id}/versions` | `versions` | as `get_task` | `list_versions(db, actor, task_id, page)` (+ `?compare=a,b` diff) |
| `GET /annotation/my-rewards` | `my_rewards` | `annotation.work` | `list_my_rewards(db, actor, page)` |
| `GET /annotation/review-queue` | `review_queue` | `annotation.review` | `get_review_queue(db, actor, filters, page)` (excludes tasks the actor annotated) |
| `POST /annotation/tasks/{id}/claim-review` | `claim_review` | `annotation.review` | `claim_annotation_review(db, actor, task_id)` |
| `POST /annotation/tasks/{id}/review` | `review` | claimed reviewer; `Idempotency-Key` optional | `review_annotation(db, actor, task_id, data)` |
| `GET /annotation/reviews/history` | `review_history` | `annotation.review` | `list_annotation_review_history(db, actor, page)` |

### 9.2 Service interface

```python
def create_project(db, actor: Actor, data: ProjectCreateIn) -> AnnotationProject
def update_project(db, actor: Actor, project_id: UUID, data: ProjectPatchIn, if_match: int) -> AnnotationProject
def list_projects(db, filters: ProjectFilters, page: PageParams) -> Page[ProjectListItem]
def get_project_detail(db, project_id: UUID) -> ProjectDetailOut
def generate_tasks(db, actor: Actor, project_id: UUID) -> GenerateTasksOut           # {created, existing, skipped_not_annotatable}
def close_project(db, actor: Actor, project_id: UUID, data: CloseProjectIn) -> AnnotationProject
def list_project_tasks(db, project_id: UUID, filters: TaskFilters, page: PageParams) -> Page[TaskListItem]
def assign_task(db, actor: Actor, task_id: UUID, annotator_id: UUID) -> AnnotationAssignment
def bulk_assign(db, actor: Actor, data: BulkAssignIn) -> BulkAssignOut
def unassign_task(db, actor: Actor, task_id: UUID, data: UnassignIn) -> AnnotationTask
def list_my_tasks(db, actor: Actor, filters: MyTaskFilters, page: PageParams) -> Page[MyTaskItem]
def get_task_workspace(db, actor: Actor, task_id: UUID) -> TaskWorkspaceOut
def start_task(db, actor: Actor, task_id: UUID) -> AnnotationTask
def save_draft(db, actor: Actor, task_id: UUID, data: AnnotationDataIn, if_match: int) -> DraftSaveOut   # {version, saved_at, version_recorded}
def submit_task(db, actor: Actor, task_id: UUID, if_match: int) -> AnnotationTask
def list_versions(db, actor: Actor, task_id: UUID, page: PageParams) -> Page[VersionOut]
def list_my_rewards(db, actor: Actor, page: PageParams) -> Page[RewardOut]
def get_review_queue(db, actor: Actor, filters: ReviewQueueFilters, page: PageParams) -> Page[TaskListItem]
def claim_annotation_review(db, actor: Actor, task_id: UUID) -> AnnotationReview
def review_annotation(db, actor: Actor, task_id: UUID, data: AnnotationReviewIn) -> AnnotationReviewOut
def list_annotation_review_history(db, actor: Actor, page: PageParams) -> Page[AnnotationReviewOut]
def cancel_tasks_for_dataset(db, dataset_id: UUID, actor: Actor | None, reason: str) -> int
def approved_annotations_for_export(db, dataset_ids: list[UUID]) -> Iterator[ExportAnnotation]
```

### 9.3 Validation rules

| Schema | Constraints |
|---|---|
| `ProjectCreateIn` | `name` 3–200 unique; `instructions_md` 1–50,000; `annotation_types` 1–5 unique ⊆ v1 types; `label_set` 0–200 items `{code ^[a-z0-9_]{1,50}$, label 1–100}` unique code, required non-empty when `classification`; `metadata_schema` 0–50 items `{key ^[a-z][a-z0-9_]{0,63}$, label, type: text|number|date|select, options (select: 1–100), required: bool}`, required non-empty when `metadata`; `task_unit: file|page`; `reward_per_task_micros`, `reward_per_page_micros` 0 … 100,000,000; `deadline: AwareDatetime | None` (future); `dataset_ids` 1–100 (each `approved|partially_approved`) |
| `ProjectPatchIn` | draft: all fields; active: `instructions_md`, `deadline`, `label_set` (additions only), rewards, `dataset_ids` additions; closed: nothing |
| `AssignIn` / `BulkAssignIn` | `annotator_id`; bulk: `task_ids` 1–500 or `{project_id, count 1–500, annotator_id}` (oldest unassigned first) |
| `AnnotationDataIn` | `model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)`; `pages: list[PageAnnotation]` ≤ 500, unique `page` within the task's page range; `PageAnnotation{page ≥ 1, transcription ≤ 200,000 chars, corrected_text ≤ 200,000, page_label ≤ 100 ∈ label_set when present, regions: list = [] (must be empty in v1, bbox reserved)}`; `classification` ⊆ project `label_set` codes, ≤ 50; `metadata: dict` keys ∈ `metadata_schema`, values typed (text ≤ 2,000; number validated as `Decimal`, finite, stored as JSON string; date ISO `YYYY-MM-DD`; select ∈ options); `notes ≤ 10,000`. Text is stored **verbatim**: no NFC, no trimming; only NUL (`\x00`) and lone surrogates rejected (baseline §11). Serialised size ≤ 2 MiB. |
| Submit-time completeness | every page in range present; `transcription` non-empty for each page when type `transcription`; `corrected_text` when `text_correction`; ≥ 1 classification when `classification`; required metadata keys present when `metadata`; `page_label` per page when `page_label` |
| `AnnotationReviewIn` | `decision: approve|request_changes`; `score` 1–5; `comments ≤ 10,000` (required ≥ 5 chars for request_changes); `feedback: list[{page?, field_path? (JSON pointer ≤ 255), anchor? {start ≥ 0, end > start}, severity, comment 1–4000}]` ≤ 200 |

### 9.4 Transactions, locks and concurrency

| Operation | Tx | Locks / guards |
|---|---|---|
| `generate_tasks` | 1 tx per 1,000 tasks | project `FOR UPDATE`; project `draft|active` (draft → active, `activated_at`); accepted files via `review.accepted_file_ids_for_datasets`; annotatable files via `datasets.list_annotatable_files`; `INSERT … ON CONFLICT ON CONSTRAINT uq_annotation_tasks_project_id_file_id_page_number DO NOTHING` |
| `assign_task` | 1 tx | task `FOR UPDATE`; status `unassigned` (or `assigned|in_progress` = reassign: end current assignment `reassigned`); annotator: `annotation.work`, `active`, `verification_status='approved'` (A-08), `annotator_agreement` accepted, and `user_profiles.privacy_trained = true` when the task's dataset has `contains_personal_data` (AM-09); `uq_annotation_assignments_one_active` |
| `save_draft` | 1 tx | task row read `FOR SHARE` (blocks concurrent unassign/submit); actor is active assignee; task `in_progress` (auto-transition from `assigned`/`changes_requested`); optimistic: `UPDATE annotations SET data, content_sha256, version = version + 1, last_saved_at = now(), last_editor_id, last_assignment_id WHERE task_id = :t AND version = :if_match RETURNING version`; 0 rows → `VersionConflict` with server copy; first save (`if_match = 0`) → INSERT (unique `task_id`). If hash changed → insert `annotation_versions(kind='draft')`. Autosaves are not written to `audit_logs` (content history lives in `annotation_versions`); the implicit status transition on the first save is audited. |
| `submit_task` | 1 tx | task `FOR UPDATE`; `in_progress`; assignee; `annotations.version = if_match`; completeness validation; insert `annotation_versions(kind='submitted')`; `review_round += 1`; task → `submitted` |
| `claim_annotation_review` | 1 tx | task `FOR UPDATE`; `submitted`; actor ≠ author of the submitted version; insert review with `review_kind='primary'` (`uq_annotation_reviews_one_active`); task → `in_review` |
| QA sampling (AM-09) | 1 tx (inside `review_annotation` approve path) | with probability `annotation_qa_sample_rate` (default 0.10, deterministic `hash(task_id) mod 1000`) an approved task gets a second `annotation_reviews` row `review_kind='qa'`, `status='in_progress'` offered to a different reviewer; a QA review only records score/comments (feeds quality metrics) and never changes the task status or reward; released/cancelled claims set `status='cancelled'` |
| `review_annotation` | **1 tx** incl. finance | task `FOR UPDATE` → review `FOR UPDATE` → (finance) annotator wallet `FOR UPDATE`; review `in_progress` and reviewer = actor; replay: if review already `completed` with same decision → return stored result |
| `close_project` | 1 tx | project `FOR UPDATE`; bulk guarded update of non-approved tasks → `cancelled`; end active assignments (`cancelled`); in-progress reviews (primary and QA) → `cancelled` |

`review_annotation` approve path: review → `completed` (decision, score, comments); task → `approved`, `approved_at`; active assignment → `ended/approved`; `finance.credit_annotation_reward(db, review.id, actor, AnnotationRewardInputs(...page_count=task.page_count))` with key `annotation_review:{review_id}:reward`, lines `annotator.available +X` (or `annotator.pending +X` with `hold_until` on the earning record when `earning_hold_days > 0` — same hold rule as dataset earnings, AM-02), `system_annotation_labor.main −X` (skipped when X = 0, earning record with `zero_reason='zero_rate'`); insert `annotation_rewards` (`uq_annotation_rewards_annotation_review_id`, `uq_annotation_rewards_task_id`); notifications `annotation_approved` and `earnings_credited`. Request-changes path: review → `completed`; insert `annotation_feedback`; task → `changes_requested`, `current_reviewer_id = NULL`; notify `annotation_returned`.

Annotation compensation is kept separate from dataset purchase price by using a distinct journal kind and system wallet (`system_annotation_labor`).

### 9.5 Tasks

None scheduled; draft-version compaction runs in `retention.purge` (§13).


---

## 10. Module `messaging`

Layout: `router.py` (`/conversations`, `/attachments`, `/notifications`), `ws.py` (WebSocket endpoint `WS /api/v1/ws`), `service.py`, `notifications.py` (`NOTIFICATION_DEFAULTS`, title/body catalogue keys), `email.py` (SMTP sender, Jinja2 templates in `templates/email/{locale}/*.{txt,html}` with autoescape), `models.py`, `schemas.py`, `repository.py`, `tasks.py`.

### 10.1 Endpoints → handlers → services

| Method & path | Handler | Permission | Service call |
|---|---|---|---|
| `GET /conversations` | `list_conversations` | `message.self` (`?inbox=support` needs `message.support`) | `list_conversations(db, actor, filters, page)` (search `q` via trigram on subject and message bodies) |
| `POST /conversations` | `create_conversation` | `message.self` | `create_conversation(db, actor, data)` |
| `GET /conversations/{id}` / `PATCH` | `get_conversation` / `update_conversation` | participant or `message.support` | `get_conversation`, `update_conversation(db, actor, conversation_id, data)` |
| `GET /conversations/{id}/messages` / `POST` | `list_messages` / `post_message` | participant or `message.support`; rate `message_post` | `list_messages`, `post_message(db, actor, conversation_id, data)` |
| `POST /conversations/{id}/read` | `mark_read` | participant | `mark_conversation_read(db, actor, conversation_id, data)` |
| `POST /conversations/{id}/attachments` | `upload_attachment` | participant; multipart ≤ 10 MB; rate | `upload_attachment(db, actor, conversation_id, upload)` |
| `GET /attachments/{id}/download-url` | `attachment_url` | participant or `message.support`; `scan_status='clean'` | `create_attachment_download_url(db, actor, attachment_id)` |
| `WS /api/v1/ws` | `ws_endpoint` (async) | session cookie | `ws.serve(websocket)` |
| `GET /notifications` | `list_notifications` | `profile.self` | `list_notifications(db, actor, filters, page)` |
| `GET /notifications/unread-count` | `unread_count` | `profile.self` | `unread_notification_count(db, actor)` |
| `POST /notifications/{id}/read` | `mark_notification_read` | owner | `mark_notification_read(db, actor, notification_id)` |
| `POST /notifications/read-all` | `mark_all_read` | `profile.self` | `mark_all_notifications_read(db, actor)` |

### 10.2 Service interface

```python
def create_conversation(db, actor: Actor, data: ConversationCreateIn) -> Conversation        # with first message
def list_conversations(db, actor: Actor, filters: ConversationFilters, page: PageParams) -> Page[ConversationItem]
def get_conversation(db, actor: Actor, conversation_id: UUID) -> ConversationOut
def update_conversation(db, actor: Actor, conversation_id: UUID, data: ConversationPatchIn) -> Conversation
def list_messages(db, actor: Actor, conversation_id: UUID, page: PageParams) -> Page[MessageOut]
def post_message(db, actor: Actor, conversation_id: UUID, data: MessageCreateIn) -> Message
def mark_conversation_read(db, actor: Actor, conversation_id: UUID, data: MarkReadIn) -> None
def upload_attachment(db, actor: Actor, conversation_id: UUID, upload: UploadFile) -> AttachmentOut
def set_attachment_scan_result(db, attachment_id: UUID, result: ScanResult) -> None
def create_attachment_download_url(db, actor: Actor, attachment_id: UUID) -> DownloadUrlOut
def post_system_message(db, conversation_id: UUID, body: str) -> Message
# notifications — the single API every module uses
def notify(db, *, user_id: UUID, type: NotificationType, params: dict[str, str], link_path: str | None = None,
           entity_type: str | None = None, entity_id: UUID | None = None, dedupe_key: str | None = None,
           email: bool | None = None) -> Notification | None
def notify_many(db, user_ids: Iterable[UUID], **kwargs) -> int
def notify_permission_holders(db, permission: str, **kwargs) -> int
def list_notifications(db, actor: Actor, filters: NotificationFilters, page: PageParams) -> Page[NotificationOut]
def unread_notification_count(db, actor: Actor) -> int
def mark_notification_read(db, actor: Actor, notification_id: UUID) -> None
def mark_all_notifications_read(db, actor: Actor) -> int
# email
def enqueue_email(db, *, to_email: str, template: str, locale: str, subject: str, context: dict,
                  sensitive_context: dict | None = None, user_id: UUID | None = None,
                  dedupe_key: str | None = None) -> EmailOutbox
def send_outbox_email(db, outbox_id: UUID) -> None                     # task body
def dispatch_due_outbox(db, now: datetime, batch: int = 200) -> int    # sweeper
```

`notify` (joins caller's tx): renders title/body from the message catalogue (`notifications.<type>.title|body`, recipient locale); inserts `notifications` (`ON CONFLICT (user_id, dedupe_key) DO NOTHING`); decides email = explicit `email` arg, else `NOTIFICATION_DEFAULTS[type].email_default` overridden by the user's preference unless `email_mandatory`; recipients with status `suspended|deactivated|anonymized` get no email; registers `after_commit` publish of `notification.created` to `ws:user:{id}`.

### 10.3 Validation rules

| Schema | Constraints |
|---|---|
| `ConversationCreateIn` | `kind: support|dataset|payout|annotation_task`; `subject` 1–200; `body` 1–10,000; exactly the link id matching `kind` (`dataset_id` owned by requester, `payout_id` owned by requester, `annotation_task_id` assigned to requester) or, for staff opening a thread to a user, `requester_id` + `message.support`; `client_message_id: UUID?` |
| `ConversationPatchIn` | `status: open|awaiting_user|closed` (requester may only `closed`; reopen happens by posting); `assigned_admin_id` (support only; must hold `message.support`); `subject` 1–200 (support only) |
| `MessageCreateIn` | `body` 0–10,000 (NFC, control chars except `\n\t` removed); `attachment_ids` 0–5 (uploaded by actor to this conversation, unattached, `scan_status ∈ {pending, clean}`); body or attachments required; `client_message_id: UUID?` |
| `MarkReadIn` | `last_read_message_id: UUID` belonging to the conversation |
| attachment upload | ≤ 10,485,760 bytes (streamed to S3 with counting; exceeding aborts with 413); sniffed type ∈ {PDF, PNG, JPEG, TXT, CSV, DOCX, XLSX}; filename 1–255 |

### 10.4 Transactions

| Operation | Tx | Locks / guards |
|---|---|---|
| `post_message` | 1 tx | conversation `FOR UPDATE` (serialises status changes and `last_message_*`); access check; idempotent on `uq_messages_conversation_id_sender_id_client_message_id` (replay returns existing); link attachments (`UPDATE … WHERE message_id IS NULL AND uploader_id = actor`); status transition (§14.10); `unread_count += 1` for other participants; staff reply adds the staff member as participant (`support`); notifications `support_message` to the other side (email for the requester per preference; staff in-app only); after commit publish `message.created` / `conversation.updated` |
| `upload_attachment` | object put outside tx, then 1 tx insert row (`pending`) + enqueue `scan_aux_object`; on tx failure the object is deleted in `after_rollback` |
| `mark_conversation_read` | 1 tx | participant row update (`unread_count = 0`, monotonic `last_read_at`) |

### 10.5 WebSocket (`messaging/ws.py`)

1. Accept only if `Origin` equals `APP_BASE_URL`; authenticate cookie `dh_session` via `core.auth.authenticate_token` executed in the threadpool (`run_in_threadpool`); reject (close code 4401) when invalid or user restricted.
2. Subscribe with `redis.asyncio` to `ws:user:{user_id}`; forward JSON messages `{event, data}`; server ping every 25 s; client messages other than `{"type":"ping"}` are ignored.
3. Re-validate the session every 5 min (revoked → close 4401). One process can hold ≥ 2,000 sockets (A-03).
4. Events carry ids and minimal display data; clients refetch via REST (no sensitive payloads over WS).

### 10.6 Tasks

| Task | Queue | Trigger | Design |
|---|---|---|---|
| `datahub.messaging.send_email` | email | `enqueue_email` after commit (`outbox_id`) | guarded claim `UPDATE email_outbox SET status='sending', attempts = attempts + 1 WHERE id=:id AND status='pending' AND next_attempt_at <= now()`; 0 rows → exit. Render template (decrypt `sensitive_context_encrypted`), send via SMTP (timeout 30 s). Success → `sent`, `sent_at`, `provider_message_id`, `sensitive_context_encrypted = NULL`. SMTP 4xx/network → `pending`, `next_attempt_at = now() + min(2^attempts min, 6 h)`; after 8 attempts or SMTP 5xx → `failed` (`last_error`). Idempotent by status guard; at-least-once delivery accepted (duplicate email only if the process dies between SMTP accept and commit). |
| `datahub.messaging.dispatch_outbox` | email | beat every 1 min | re-enqueue `send_email` for `pending` rows with `next_attempt_at <= now()`; resets `sending` rows older than 10 min to `pending` |

---

## 11. Module `exports`

Layout: `router.py` (`/admin/exports`), `service.py`, `builder.py` (streaming ZIP writer, manifest writers), `models.py`, `schemas.py`, `tasks.py`.

### 11.1 Endpoints → handlers → services

| Method & path | Handler | Permission | Service call |
|---|---|---|---|
| `POST /admin/exports` | `create_export` | `dataset.export` | `create_export(db, actor, data)` |
| `GET /admin/exports` | `list_exports` | `dataset.export` | `list_exports(db, filters, page)` |
| `GET /admin/exports/{id}` | `get_export` | `dataset.export` | `get_export(db, export_id)` (progress, parts) |
| `POST /admin/exports/{id}/download-url` | `export_download_url` | `dataset.export`; rate `download_url` | `create_export_download_url(db, actor, export_id, data.part_no)` (5-min presigned, `attachment`, audited, `download_count += 1`) |

### 11.2 Service interface and validation

```python
def create_export(db, actor: Actor, data: ExportCreateIn) -> ExportJob
def list_exports(db, filters: ExportFilters, page: PageParams) -> Page[ExportOut]
def get_export(db, export_id: UUID) -> ExportDetailOut
def create_export_download_url(db, actor: Actor, export_id: UUID, part_no: int) -> DownloadUrlOut
def build_export(db, export_id: UUID, *, task_id: str) -> None
def expire_exports(db, now: datetime) -> int
```

`ExportCreateIn`: `dataset_ids: list[UUID]` 0–1,000 (empty = use filters); `categories` ⊆ configured categories; `languages` ≤ 20; `min_quality` 0–100; `data_class: raw|labeled|null`; `date_from/date_to` (`date_from ≤ date_to`); `include_files`, `include_metadata`, `include_annotations` (at least one true); `manifest_format: jsonl|csv|json`. Only datasets in `approved|partially_approved` and not `taken_down` are eligible; only accepted files are included.

### 11.3 `build_export` design (`datahub.exports.build_export`, queue `exports`)

1. Guarded start: `UPDATE export_jobs SET status='running', started_at=coalesce(started_at, now()), attempts=attempts+1, celery_task_id=:tid WHERE id=:id AND status IN ('queued','running')` (`running` accepted only on retry of the same job); else exit.
2. Resolve and snapshot `dataset_ids` (stored on the job), accepted files (`review.accepted_file_ids_for_datasets`), approved annotations (`annotation.approved_annotations_for_export`).
3. Stream: for each file, `storage.open_read` → `zipfile.ZipFile(..., mode="w", allowZip64=True)` entry `datasets/{dataset_id}/files/{file_id}__{sanitised_name}`; manifest rows `{dataset_id, title, category, languages, data_class, quality_score, license_code, file_id, original_filename, sha256, size_bytes, format, page_count}`; annotations `annotations/{dataset_id}/{task_id}.json` = `{task, page, data (verbatim), normalized (NFC copy of all text fields), reviewer score, approved_at}` (baseline §11); `README.txt` with licence terms and export metadata.
4. Parts: when the current part reaches 4 GB, close it, `put_file` to the deterministic key `exports/{job_id}/datahub-export-{job_id}-part{n:03d}.zip`, upsert `export_files` on `(export_job_id, part_no)` — a retry rebuilds and overwrites the same keys (baseline §13).
5. Progress committed every 50 files (short tx).
6. Complete (tx): `completed`, `completed_at`, `expires_at = now() + export_retention_days`, counts; notify requester `export_ready`; audit `exports.export.complete` with `dataset_ids`.
7. Retry ×2 on transient errors (backoff 60/300 s); then `failed` (`error_code`), notify `export_failed`. Time limits soft 4 h, hard 4.5 h. Scratch usage ≤ one part (4 GB) + one file.

`datahub.exports.expire` (default, beat daily 02:00): for `completed` jobs with `expires_at < now()`: `storage.delete_many(part keys)`, set `export_files.object_deleted_at`, job → `expired`, `expired_at`. Status-guarded, idempotent.

---

## 12. Module `admin`

Layout: `router.py` (`/admin/datasets` search, `/admin/datasets/{id}/takedown`, `/admin/analytics/overview`, `/admin/audit-logs`, `/admin/settings`, `/admin/takedown-requests`; public `POST /public/contact`), `service.py`, `settings_registry.py`, `repository.py` (cross-module read-only queries, §15), `models.py` (`system_settings`, `takedown_requests`), `schemas.py`, `tasks.py` (`retention.purge`, `process_deletion_requests`).

### 12.1 Endpoints → handlers → services

| Method & path | Handler | Permission | Service call |
|---|---|---|---|
| `GET /admin/datasets` | `search_datasets` | `dataset.read.any` | `search_datasets(db, filters, page)` (q trigram on title, status, data_class, language, category, min_quality, owner email/id, date range) |
| `POST /admin/datasets/{id}/takedown` | `takedown` | `user.manage` + `dataset.read.any` | `take_down_dataset(db, actor, dataset_id, data)` |
| `GET /admin/analytics/overview?from&to` | `analytics_overview` | `analytics.read` | `get_analytics_overview(db, from_, to)` (cached 5 min in Redis) |
| `GET /admin/audit-logs` | `audit_logs` | `audit.read` | `list_audit_logs(db, filters, page)` (actor, action prefix, entity, date range) |
| `GET /admin/settings` | `list_settings` | `settings.manage` | `list_settings(db)` |
| `PUT /admin/settings/{key}` | `put_setting` | `settings.manage` | `update_setting(db, actor, key, data.value)` |
| `GET /admin/takedown-requests` (AM-04) | `list_takedowns` | `user.manage` | `list_takedown_requests(db, filters, page)` (status — comma-separated, claim_type, source, dataset_id, q, date range) |
| `POST /admin/takedown-requests/{id}/decision` (AM-04; step-up) | `decide_takedown` | `user.manage` | `decide_takedown_request(db, actor, request_id, data)` (`actioned` requires the dataset to be `taken_down`, or `apply_takedown=true` which calls `take_down_dataset` in the same tx) |
| `POST /public/takedown-requests` (AM-04; no login, rate `public_contact` 5/h/IP) | `public_takedown` | — | `submit_takedown_request(db, data, ctx)` → `takedown_requests` row `source='public_form'`, `received`; acknowledgement email; notify `user.manage` holders |
| `POST /public/contact` | `public_contact` | rate `public_contact` | `submit_public_contact(db, data, ctx)` |

The three takedown-request endpoints were adopted by baseline AM-04 (`DECISION_LOG.md` D-017) and are specified in `API_DOCUMENTATION.md` / `openapi.yaml`.

### 12.2 Service interface

```python
def search_datasets(db, filters: AdminDatasetFilters, page: PageParams) -> Page[AdminDatasetItem]
def take_down_dataset(db, actor: Actor, dataset_id: UUID, data: TakedownIn) -> DatasetOut
def get_analytics_overview(db, from_: date, to: date) -> AnalyticsOverviewOut
def list_audit_logs(db, filters: AuditFilters, page: PageParams) -> Page[AuditLogOut]
def list_settings(db) -> list[SettingOut]
def update_setting(db, actor: Actor, key: str, value: Any) -> SettingOut
def list_takedown_requests(db, filters, page) -> Page[TakedownRequestOut]
def decide_takedown_request(db, actor: Actor, request_id: UUID, data: TakedownDecisionIn) -> TakedownRequest
def submit_takedown_request(db, data: TakedownClaimIn, ctx: RequestContext) -> None
def requeue_stalled(db, now: datetime) -> RequeueReport
def submit_public_contact(db, data: ContactIn, ctx: RequestContext) -> None
def process_deletion_request(db, request_id: UUID) -> DeletionOutcome
def purge_retention(db, now: datetime) -> RetentionReport
```

`take_down_dataset` (1 tx): `datasets.take_down_dataset` (status, licence revocation, upload aborts) → `review.release_active_review_for_dataset(..., reason="taken_down")` → `annotation.cancel_tasks_for_dataset` → linked `takedown_requests` → `actioned` → `messaging.notify(owner, "dataset_taken_down", email=True)` → audit. Lock order: dataset → review → annotation tasks.

`update_setting` validates against `SETTINGS_REGISTRY: dict[str, SettingSpec(value_type, validator)]`, e.g. `min_withdrawal_micros`: int, multiple of 10,000, ≥ 10,000, ≤ `max_withdrawal_micros`; `earning_hold_days`: 0–90; `payout_dual_approval_threshold_micros`: multiple of 10,000, ≥ 0; `max_file_bytes`: 1,000,000 … 4,000,000,000 (AM-01); `maintenance_mode`: bool (AM-06); `review_max_active_claims`: 1–50; `annotation_qa_sample_rate`: number 0–1; `legal_docs_approved`: bool, only super_admin, audited (AM-09); `extra_allowed_extensions`: ≤ 20 items `^[a-z0-9]{1,10}$`, never one of the deny-listed executable/script/HTML/SVG/macro extensions; `dataset_categories`: removal refused while datasets use the category. Unknown keys → 404. After commit `runtime.invalidate(key)`; audit with before/after.

`ContactIn`: `name` 2–200, `email`, `topic: general|support|copyright|privacy|illegal_content|consent_withdrawn`, `message` 20–10,000, optional `dataset_reference` (UUID), honeypot field `website` must be empty. Effects: `email_outbox` to `SUPPORT_INBOX_EMAIL`; for the four rights topics a `takedown_requests` row (`source='public_form'`, `received`) and in-app notification to `user.manage` holders.

`process_deletion_request` (two transactions): tx 1 — request `FOR UPDATE`; due (`scheduled_for ≤ now()`), status `requested`; blockers = `finance.user_financial_blockers` + datasets `in_review`/`submitted` + active annotation assignment; blockers → store in `blockers`, notify user, stay `requested` (re-checked daily); none → `processing`, `identity.deactivate_user` (sessions revoked). tx 2 — `identity.anonymize_user`, delete draft/withdrawn datasets of the user (objects queued for deletion after commit), request → `completed`. A crash between the two leaves `processing`, which the next run resumes (idempotent: anonymisation re-applies the same values).

### 12.3 Tasks

| Task | Queue | Trigger | Design |
|---|---|---|---|
| `datahub.retention.purge` | default | beat daily 02:30 UTC | executes the `DATABASE_SCHEMA.md` §7.3 matrix rule by rule, skipping anything under `legal_hold` (datasets/users, AM-09); each rule processes batches of ≤ 5,000 rows per transaction, deleting objects **before** rows (`storage.delete_many`; failed keys keep their rows for the next run); audit-log purge uses `SET LOCAL datahub.audit_purge='on'`; writes a summary to `audit_logs` (`admin.retention.purge`). Idempotent by construction (predicates select only expired data). Soft time limit 3,000 s; resumes next day. |
| `datahub.admin.requeue_stalled` | default | beat every 5 min (AM-10) | `requeue_stalled(db, now)`: re-enqueues `messaging.send_email` for `email_outbox` rows `pending` > 2 min, `processing.process_file` for `dataset_files` `uploaded` > 5 min with no in-flight `background_job_records`, `exports.build_export` for `export_jobs` `queued` > 5 min. Read + enqueue only (every target task is status-guarded); counts logged and exported as metrics. |
| `datahub.admin.process_deletion_requests` | default | beat daily 03:00 UTC | for due requests call `process_deletion_request` (each isolated; failures logged and retried next day) |

### 12.4 Admin read-only joins

`admin/repository.py` is the only place allowed to join tables of several modules (baseline §4 exception): dataset search (`datasets` ⋈ `users` ⋈ `dataset_metadata`), analytics aggregates (`users`, `datasets`, `dataset_reviews`, `ledger_journals`, `payout_requests`, `annotation_tasks`), audit log listing (`audit_logs` ⋈ `users` for actor email). Queries are read-only, use `statement_timeout = 10s`, and are covered by an import-linter "independence" exception list.

---

## 13. Background jobs (consolidated)

All tasks subclass `DataHubTask` (§3.13): `acks_late`, idempotent, recorded in `background_job_records`. Enqueued after commit only.

| Task (Celery name) | Module | Queue | Trigger | Idempotency | Retries / limits |
|---|---|---|---|---|---|
| `datahub.processing.process_file(file_id)` | processing | processing | upload complete; member creation; rescan; sweeper | guarded `uploaded → processing`; terminal states never re-entered except via rescan | ×3 backoff 30/120/480 s (transient only); soft 1,800 s / hard 2,100 s |
| `datahub.processing.expand_archive(file_id)` | processing | processing | container `ready` | members `ON CONFLICT (parent_file_id, member_path) DO NOTHING` | ×3; soft 3,600 s |
| `datahub.processing.detect_duplicates(file_id)` | processing | processing | file `ready` | upsert on `(file_id, matched_file_id, kind)` | ×3; soft 300 s |
| `datahub.processing.scan_aux_object(kind, id)` | processing | processing | attachment/proof/KYC upload | scan-status guard (`pending` only) | ×3; soft 300 s |
| `datahub.processing.sweep_stalled` | processing | processing | beat 10 min | status guards | none (next run) |
| `datahub.uploads.expire_sessions` | datasets | default | beat 15 min | status guard; S3 `NoSuchUpload` ignored | none (next run) |
| `datahub.finance.release_pending` | finance | default | beat hourly | journal key `earning_release:{earning_record_id}` (AM-02) + `released_at IS NULL` | ×3 |
| `datahub.admin.requeue_stalled` | admin | default | beat 5 min (AM-10) | target tasks are status-guarded; duplicate enqueue harmless | none (next run) |
| `datahub.finance.reconcile` | finance | default | beat nightly 01:30 | read-only + alert | ×1; soft 1,800 s |
| `datahub.messaging.send_email(outbox_id)` | messaging | email | outbox insert | outbox status guard | internal backoff up to 8 attempts |
| `datahub.messaging.dispatch_outbox` | messaging | email | beat 1 min | status guard | none |
| `datahub.exports.build_export(job_id)` | exports | exports | admin request | status guard; deterministic part keys overwrite | ×2 backoff 60/300 s; soft 4 h / hard 4.5 h |
| `datahub.exports.expire` | exports | default | beat daily 02:00 | status guard | none |
| `datahub.retention.purge` | admin | default | beat daily 02:30 | expiry predicates | none (next run) |
| `datahub.admin.process_deletion_requests` | admin | default | beat daily 03:00 | request status guard | none (next run) |

Beat runs as a single `datahub_beat` container (one scheduler). Beat tasks additionally take a Redis lock `beat:{task}` (`SET NX EX`) so an accidental second scheduler cannot run overlapping instances.

---

## 14. State-transition tables

Every transition below is executed by the named service function as a guarded update (D-LLD-05) and writes `audit_logs` (`action` in the last column's first item or `<module>.<entity>.<event>`). "Notify" = `messaging.notify` (in-app; email per preference/defaults).

### 14.1 `users.status`

| From | Event (service) | Guard | To | Side effects |
|---|---|---|---|---|
| — | `register` | registration open; email unused; password policy; ToS + privacy accepted | `pending_email` | profile, `contributor` role, agreement rows, verification token + email; audit `identity.user.register` |
| `pending_email` | `verify_email` | token valid, unconsumed, unexpired, purpose `email_verify`, email matches | `active` | `email_verified_at`; consume token; notify `email_verified`; security event `email_verified` |
| `active` | `suspend_user` | `user.manage`; actor ≠ target; target not super_admin unless actor is super_admin | `suspended` | revoke all sessions (`account_suspended`); email; security event `account_suspended` |
| `suspended` | `reactivate_user` | `user.manage` | `active` | email; security event `account_reactivated` |
| `active`, `suspended` | `deactivate_user` (deletion processing) | deletion request due, no blockers | `deactivated` | revoke sessions (`account_deactivated`); `deactivated_at` |
| `deactivated` | `anonymize_user` | request `processing` | `anonymized` | DATABASE_SCHEMA §7.2; request `completed` |

Login is permitted for `pending_email` (restricted endpoints) and `active` only.

### 14.2 `contributor_verifications.status` (latest row = current; mirrored to `users.verification_status`)

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| — (user `unverified`/`rejected`/`needs_info`) | `submit_verification` | email verified; onboarding complete; no `pending` row; user not already `approved`; age ≥ 18; payout method owned | `pending` | `users.verification_status='pending'`; ID document scan enqueued; notify `user.verify` holders (in-app) |
| `pending` | `decide_verification(approved)` | `user.verify`; actor ≠ user; ID document (if any) `clean` | `approved` | mirror; notify `verification_approved` (email) |
| `pending` | `decide_verification(rejected)` | as above + reason | `rejected` | mirror; notify `verification_rejected` (email) |
| `pending` | `decide_verification(needs_info)` | as above + reason | `needs_info` | mirror; notify `verification_needs_info` (email) |
| `rejected`, `needs_info` | `submit_verification` (resubmit) | as first row | new row `pending` | as first row |

### 14.3 `upload_sessions.status`

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| — | `init_upload` | §5.4 guards | `initiated` | file row `pending_upload`; S3 multipart created; dataset totals incremented |
| `initiated` | `presign_parts` (first call) | uploader; not expired | `uploading` | presigned PUT URLs (15 min) |
| `initiated`, `uploading` | `complete_upload` | parts cover 1…`part_count`; S3 complete OK; size matches | `completed` | file `uploaded`; enqueue `process_file` |
| `initiated`, `uploading` | `complete_upload` with size mismatch | — | `aborted` (`size_mismatch`) | object deleted; file `failed/size_mismatch`; totals adjusted |
| `initiated`, `uploading` | `abort_upload` / `remove_file` / dataset withdrawn | uploader or owner | `aborted` | S3 abort; `pending_upload` file row deleted; totals decremented |
| `initiated`, `uploading` | `expire_upload_sessions` | `expires_at < now()` | `expired` | S3 abort; file row deleted; totals decremented |

### 14.4 `dataset_files.processing_status` / `scan_status`

| From | Event | Guard | To (`processing_status` / `scan_status`) | Side effects |
|---|---|---|---|---|
| — | `init_upload` | — | `pending_upload` / `pending` | — |
| — | `create_archive_member` | parent container `ready` | `uploaded` / `pending` | enqueue `process_file` |
| — | `create_archive_member` (unsafe path, nested archive, encrypted member, member over limits) | — | `failed` / `pending` | `failure_code` set; never processed or payable |
| `pending_upload` | `complete_upload` | size matches | `uploaded` / `pending` | enqueue `process_file` |
| `uploaded` | `claim_file_for_processing` | status `uploaded` (guarded update) | `processing` / `pending` | `processing_attempts += 1` |
| `processing` | transient error before final attempt | attempts < 4 | `uploaded` / `pending` | Celery retry |
| `processing` | `record_processing_result` (clean, valid) | sniff ok; scan `clean` | `ready` / `clean` | previews, text, hashes; enqueue `detect_duplicates`; dataset-finished notification |
| `processing` | `record_processing_result` (ZIP container) | sniff ok; limits ok | `ready` / `skipped_container` | member list preview; enqueue `expand_archive` |
| `processing` | `record_processing_result` (invalid) | type mismatch, disallowed, corrupt, encrypted, nested archive member, unsafe path, archive limits, size mismatch, scan size limit | `failed` / unchanged or `error` | `failure_code`, `failure_detail` |
| `processing` | scan `infected` | — | `quarantined` / `infected` | object moved to quarantine prefix; security event; notify admins |
| `processing` | retries exhausted | — | `failed` / `error` (`scan_error` or `processing_error`) | — |
| `ready`, `failed`, `quarantined` | `request_rescan` (admin) | `dataset.read.any`; object exists (restored from quarantine copy if quarantined) | `uploaded` / `pending` | enqueue `process_file`; audit `datasets.file.rescan` |

### 14.5 `datasets.status`

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| — | `create_dataset` | `dataset.create`; email verified; onboarding complete | `draft` | licence row; metadata rows |
| `draft`, `changes_requested` | `submit_dataset` | owner; all files terminal; ≥ 1 `ready` non-container file; no open upload sessions; licence + rights declaration | `submitted` | `dataset_versions` row; `current_version_no += 1`; notify owner `dataset_received`; notify reviewers |
| `submitted` | `review.claim_review` → `mark_in_review` | reviewer ≠ owner | `in_review` | review row `in_progress` |
| `in_review` | `review.release_review` → `mark_review_released` | review `in_progress` | `submitted` | review `released` |
| `in_review` | `review.finalize_review` (`approve`) | §7.5 | `approved` | earnings credited; licence effective; notify |
| `in_review` | `finalize_review` (`partial`) | §7.5 | `partially_approved` | earnings for accepted files; notify |
| `in_review` | `finalize_review` (`reject`) | §7.5 | `rejected` | notify; objects purged after 90 days |
| `in_review` | `finalize_review` (`request_changes`) | feedback present | `changes_requested` | notify; owner may edit, add/remove files and resubmit |
| `draft`, `submitted`, `changes_requested` | `withdraw_dataset` | owner | `withdrawn` | abort open uploads; never-submitted drafts purged after 30 days |
| any | `admin.take_down_dataset` | `user.manage` + `dataset.read.any`; reason | `taken_down` | licence revoked; active review released; annotation tasks cancelled; notify owner |

Terminal for earnings: `approved`, `partially_approved`, `rejected` (and `withdrawn`, `taken_down`).

### 14.6 `dataset_reviews.status`

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| — | `claim_review` | dataset `submitted`; reviewer ≠ owner; `dataset.review` | `in_progress` | dataset `in_review` |
| `in_progress` | `finalize_review` | assignee; decision rules §7.5 | `finalized` (`decision` set) | dataset terminal state; earning journal (approve/partial); notifications |
| `in_progress` | `release_review` | assignee or admin (`user.manage`); reason | `released` | dataset back to `submitted` |
| `in_progress` | `admin.take_down_dataset` | — | `released` (`release_reason='taken_down'`) | — |

### 14.7 `annotation_tasks.status`

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| — | `generate_tasks` | project `draft|active`; file accepted + annotatable | `unassigned` | — |
| `unassigned` | `assign_task` | `annotation.manage`; annotator eligible (§9.4) | `assigned` | assignment `active`; notify `annotation_assigned` |
| `assigned` | `start_task` / first `save_draft` | active assignee | `in_progress` | assignment `started_at` |
| `assigned`, `in_progress` | `unassign_task` | `annotation.manage` | `unassigned` | assignment `ended/unassigned`; notify `annotation_unassigned`; draft kept |
| `assigned`, `in_progress` | `assign_task` (reassign) | `annotation.manage`; new annotator eligible | `assigned` | old assignment `ended/reassigned`; new `active`; notify both |
| `in_progress` | `submit_task` | assignee; version matches; completeness | `submitted` | `annotation_versions(submitted)`; `review_round += 1` |
| `submitted` | `claim_annotation_review` | `annotation.review`; reviewer ≠ author | `in_review` | review `in_progress`; `current_reviewer_id` |
| `in_review` | `review_annotation(approve)` | claimed reviewer | `approved` | review `completed`; reward journal + `annotation_rewards`; assignment `ended/approved`; notify |
| `in_review` | `review_annotation(request_changes)` | claimed reviewer; comments | `changes_requested` | review `completed`; feedback rows; notify `annotation_returned` |
| `changes_requested` | `start_task` / `save_draft` | active assignee | `in_progress` | — |
| any except `approved` | `close_project` / `cancel_tasks_for_dataset` | `annotation.manage` or takedown | `cancelled` | assignment `ended/cancelled`; review `cancelled` if in progress |

### 14.8 `payout_requests.status`

| From | Event | Guard | To | Side effects (journal) |
|---|---|---|---|---|
| — | `request_payout` | §8.5 | `requested` | `payout_reserve`; notify user + approvers |
| `requested` | `approve_payout` (count < required) | approver ≠ recipient; distinct approver; MFA | `requested` (`approvals_count += 1`) | approval row; notify other approvers "second approval needed" |
| `requested` | `approve_payout` (count reaches required) | as above | `approved` | approval row; notify `withdrawal_approved` |
| `requested` | `reject_payout` | `payout.approve`; ≠ recipient; reason | `rejected` | `payout_release`; notify |
| `requested` | `cancel_payout_by_owner` | owner | `cancelled` | `payout_release` |
| `approved` | `cancel_payout_by_admin` | `payout.approve`; ≠ recipient; reason | `cancelled` | `payout_release`; notify |
| `approved` | `mark_payout_paid` | `payout.record_payment`; ≠ recipient; unique reference; valid `paid_at` | `paid` | `payout_records`; `payout_settle`; notify `payment_recorded` (email) |
| `approved` | `mark_payout_failed` | `payout.record_payment`; reason | `failed` | `payout_release`; notify `payment_failed` |
| `paid` | `reverse_payout` | `finance.adjust` (super_admin); ≠ recipient; reason | `reversed` | `payout_reversal`; notify `payment_reversed` |

### 14.9 `export_jobs.status`

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| — | `create_export` | `dataset.export`; valid filters | `queued` | enqueue `build_export`; audit with filters |
| `queued` (or `running` on retry) | `build_export` start | guarded update | `running` | `started_at`, `attempts += 1` |
| `running` | build success | all parts uploaded | `completed` | `expires_at`; notify `export_ready`; audit dataset ids |
| `running` | retries exhausted / non-transient error | — | `failed` | `error_code`; notify `export_failed` |
| `completed` | `exports.expire` | `expires_at < now()` | `expired` | objects deleted |

### 14.10 `conversations.status`

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| — | `create_conversation` by requester | link ownership | `open` | first message; notify `message.support` holders (in-app) |
| — | `create_conversation` by staff | `message.support` | `awaiting_user` | notify requester `support_message` |
| `open` | `post_message` by staff | `message.support` | `awaiting_user` | notify requester |
| `awaiting_user` | `post_message` by requester | participant | `open` | notify assigned admin (or support holders) |
| `open`, `awaiting_user` | `update_conversation(status='closed')` | requester or `message.support` | `closed` | `closed_at`, `closed_by`; system message |
| `closed` | `post_message` by requester | participant | `open` | reopen; `closed_at = NULL` |
| `closed` | `post_message` by staff | `message.support` | `awaiting_user` | reopen |

### 14.11 Supplementary state machines (LLD-defined, consistent with baseline)

| Entity | Transitions |
|---|---|
| `annotation_projects.status` | `draft` → `active` (`generate_tasks` or PATCH `status=active`, requires ≥ 1 dataset) → `closed` (`close_project`); `draft` → `closed` |
| `annotation_assignments.status` | `active` → `ended` (`end_reason` ∈ unassigned, reassigned, approved, cancelled) |
| `annotation_reviews.status` | `in_progress` → `completed` (decision) \| `cancelled` (task cancelled) |
| `email_outbox.status` | `pending` → `sending` → `sent` \| `pending` (retry) \| `failed`; `pending` → `cancelled` (user anonymised) |
| `deletion_requests.status` | `requested` → `processing` → `completed`; `requested` → `cancelled` (user) \| `rejected` (admin, legal hold) |
| `takedown_requests.status` | `received` → `under_review` → `actioned` \| `rejected`; `received`/`under_review` → `withdrawn` |
| `message_attachments.scan_status` | `pending` → `clean` \| `infected` (object deleted) \| `error` (after retries; never visible) |

---

## 15. Cross-module read exceptions

Besides `admin/repository.py` (§12.4), these read-only lookups of another module's tables are permitted; each lives in the reading module's `repository.py` as a function prefixed `read_` and is listed in the import-linter/ownership test allow-list:

| Reader | Function | Tables / columns read | Reason |
|---|---|---|---|
| `core.auth` | (none) — uses the authenticator registered by `main.create_app()` (`core.auth.register_authenticator(identity.service.authenticate_session)`) | — | dependency injection at the composition root keeps `core` free of module imports |
| `messaging` | `read_recipient(db, user_id)` | `users.email, status, display_name`; `user_profiles.preferred_locale, notification_preferences` | notification routing (messaging sits below identity) |
| `messaging` | `read_permission_holders(db, permission)` | `user_roles`, `roles.permissions`, `users.status` | fan-out to staff |
| `messaging` | `read_link_owner(db, kind, id)` | `datasets.owner_id`; `payout_requests.user_id`; `annotation_tasks.current_assignee_id` | conversation link authorisation |
| `datasets` | `read_reviewer_access(db, dataset_id, user_id)` | `dataset_reviews.reviewer_id, status` | file/dataset read access for reviewers |

---

## 16. Transaction and lock summary

| Business operation | Single transaction contains | Lock sequence (D-LLD-04) | Idempotency |
|---|---|---|---|
| Register | user, profile, role, agreements, token, outbox, audit | — (unique email) | unique email |
| Upload init | file row, session, dataset totals, S3 multipart id | dataset → advisory `upload_quota:user` | resume fingerprint |
| Upload complete | session, file, dataset totals, job record | session row | session status |
| Submit dataset | dataset, version snapshot, notifications, audit | dataset | status guard |
| Claim review | review, dataset status | dataset | partial unique index |
| Finalize review | review, file stats, earning records, journal + lines, wallet cache, dataset status, licence, notifications, outbox, audit | dataset → review → wallet → content advisory locks | review status + journal key `dataset_review:{id}:earning` |
| Request payout | payout, reserve journal, wallet cache, notifications, audit | wallet | `(user_id, client_idempotency_key)` + one-open index |
| Approve / reject / cancel / mark paid / failed / reverse | payout, approval or record, journal, wallet cache, notifications, audit | payout → wallet | status guard + journal keys `payout:{id}:*` + unique approver / reference |
| Adjustment | adjustment, journal, wallet cache, notification, audit | wallet | `(created_by, client_idempotency_key)` + `adjustment:{id}` |
| Annotation draft save | annotation, version row | task (`FOR SHARE`) + optimistic `version` | `If-Match` |
| Annotation approve | review, task, assignment, earning record, journal, wallet cache, reward, notifications, audit | task → review → wallet | review status + `annotation_review:{id}:reward` + unique reward per review/task |
| Takedown | dataset, licence, review release, task cancellations, request, notification, audit | dataset → review → tasks | status guards |
| Post message | message, attachments link, conversation status, participants, notifications | conversation | `client_message_id` |

Financial transactions run with `SET LOCAL lock_timeout = '5s'`; a timeout returns 409 `busy_retry`, and retrying with the same idempotency key is always safe.

---

## 17. Traceability

| Master prompt item | Where in this document |
|---|---|
| Part 5 item 9 — modules, classes, service interfaces, request handlers, business logic, validation, transaction boundaries, state transitions, background jobs | §1–§16 |
| Part 7 — idempotent financial operations, concurrency-safe approvals, no double credit | §8.2–§8.5, §7.5, §9.4, §16 |
| Part 9 — upload system (resumable, quotas, hashing, scanning, duplicates, previews, ZIP safety, abandoned sessions) | §5.4, §6, §3.10–§3.12, §14.3–§14.4 |
| Part 10 — review workflow, partial approval, idempotent approval | §7 |
| Part 11 — earnings & manual payouts, ledger | §8 |
| Part 12 — annotation projects, editor concurrency, review, payment | §9 |
| Part 13 — messaging & notifications | §10 |
| Part 14 — exports | §11 |
