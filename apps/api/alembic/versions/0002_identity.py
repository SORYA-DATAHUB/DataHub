"""Identity schema, role/permission seed (B-01).

Revision ID: 0002_identity
Revises: 0001_foundation

DDL follows docs/02-system-architecture/DATABASE_SCHEMA.md section 4.1 with these documented additions
required by AUTH_AUTHORIZATION.md: users.mfa_last_used_step / mfa_setup_expires_at /
failed_login_window_started_at, user_sessions.idle_expires_at / mfa_pending / mfa_failed_count / rotated_from,
and the revoked_reason values 'rotated' and 'mfa_failed'.

No user, password or secret is seeded here. The first administrator is created with
`python -m datahub.cli create-admin`.
"""

import uuid

from alembic import op

revision = "0002_identity"
down_revision = "0001_foundation"
branch_labels = None
depends_on = None

_ROLE_NS = uuid.UUID("6f0b1a56-3d2c-4c52-9a3e-5a7d1f0c9b11")

_STAFF_BASE = [
    "profile.self",
    "message.self",
    "dataset.create",
    "dataset.read.own",
    "dataset.review",
    "annotation.review",
    "dataset.read.any",
    "user.read",
    "user.manage",
    "user.verify",
    "annotation.manage",
    "payout.approve",
    "payout.record_payment",
    "finance.read",
    "dataset.export",
    "message.support",
    "analytics.read",
]
ROLES: dict[str, tuple[str, str, list[str]]] = {
    "contributor": (
        "Contributor",
        "Uploads datasets and requests payouts.",
        ["profile.self", "dataset.create", "dataset.read.own", "payout.request", "message.self"],
    ),
    "annotator": (
        "Annotator",
        "Works on assigned annotation tasks.",
        ["profile.self", "payout.request", "message.self", "annotation.work"],
    ),
    "reviewer": (
        "Reviewer",
        "Reviews submitted datasets and annotations.",
        ["profile.self", "message.self", "dataset.review", "annotation.review"],
    ),
    "admin": ("Administrator", "Operates users, reviews, payouts and exports.", _STAFF_BASE),
    "super_admin": (
        "Super administrator",
        "Full administration including roles, pricing, settings and audit.",
        [*_STAFF_BASE, "finance.adjust", "pricing.manage", "role.manage", "settings.manage", "audit.read"],
    ),
}

DDL = [
    """
    CREATE TABLE users (
        id uuid NOT NULL,
        email citext NOT NULL,
        password_hash varchar(255),
        display_name varchar(100) NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'pending_email',
        verification_status varchar(32) NOT NULL DEFAULT 'unverified',
        email_verified_at timestamptz,
        onboarding_completed_at timestamptz,
        mfa_enabled boolean NOT NULL DEFAULT false,
        mfa_secret_encrypted bytea,
        mfa_enabled_at timestamptz,
        mfa_setup_expires_at timestamptz,
        mfa_last_used_step bigint,
        failed_login_count integer NOT NULL DEFAULT 0,
        failed_login_window_started_at timestamptz,
        locked_until timestamptz,
        legal_hold boolean NOT NULL DEFAULT false,
        legal_hold_reason text,
        last_login_at timestamptz,
        password_changed_at timestamptz,
        suspended_at timestamptz,
        suspended_by uuid,
        suspension_reason text,
        deactivated_at timestamptz,
        anonymized_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_users PRIMARY KEY (id),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT fk_users_suspended_by_users FOREIGN KEY (suspended_by) REFERENCES users (id),
        CONSTRAINT ck_users_email_lower CHECK (email::text = lower(email::text)),
        CONSTRAINT ck_users_email_length CHECK (char_length(email::text) BETWEEN 3 AND 254),
        CONSTRAINT ck_users_password_hash_present CHECK (status = 'anonymized' OR password_hash IS NOT NULL),
        CONSTRAINT ck_users_display_name_length CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 100),
        CONSTRAINT ck_users_status_enum CHECK (
            status IN ('pending_email', 'active', 'suspended', 'deactivated', 'anonymized')),
        CONSTRAINT ck_users_verification_status_enum CHECK (
            verification_status IN ('unverified', 'pending', 'approved', 'rejected', 'needs_info')),
        CONSTRAINT ck_users_active_requires_verified_email CHECK (
            status <> 'active' OR email_verified_at IS NOT NULL),
        CONSTRAINT ck_users_mfa_secret_when_enabled CHECK (NOT mfa_enabled OR mfa_secret_encrypted IS NOT NULL),
        CONSTRAINT ck_users_failed_login_count_nonneg CHECK (failed_login_count >= 0),
        CONSTRAINT ck_users_legal_hold_reason CHECK (NOT legal_hold OR legal_hold_reason IS NOT NULL),
        CONSTRAINT ck_users_suspension_reason_when_suspended CHECK (
            status <> 'suspended' OR suspension_reason IS NOT NULL),
        CONSTRAINT ck_users_anonymized_at CHECK ((status = 'anonymized') = (anonymized_at IS NOT NULL))
    )
    """,
    "CREATE INDEX ix_users_status ON users (status)",
    """CREATE INDEX ix_users_verification_status ON users (verification_status)
       WHERE verification_status IN ('pending', 'needs_info')""",
    "CREATE INDEX ix_users_created_at ON users (created_at)",
    "CREATE INDEX ix_users_display_name_trgm ON users USING gin (display_name gin_trgm_ops)",
    "CREATE INDEX ix_users_email_trgm ON users USING gin ((email::text) gin_trgm_ops)",
    "CREATE INDEX ix_users_suspended_by ON users (suspended_by)",
    """
    CREATE TABLE user_profiles (
        user_id uuid NOT NULL,
        legal_name varchar(200),
        country_code char(2),
        date_of_birth date,
        phone varchar(32),
        organization varchar(200),
        preferred_locale varchar(10) NOT NULL DEFAULT 'en',
        timezone varchar(64),
        privacy_trained boolean NOT NULL DEFAULT false,
        notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_user_profiles PRIMARY KEY (user_id),
        CONSTRAINT fk_user_profiles_user_id_users FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT ck_user_profiles_country_code_format CHECK (country_code ~ '^[A-Z]{2}$'),
        CONSTRAINT ck_user_profiles_phone_format CHECK (phone ~ '^\\+[1-9][0-9]{6,14}$'),
        CONSTRAINT ck_user_profiles_preferred_locale_enum CHECK (preferred_locale IN ('en', 'km'))
    )
    """,
    """
    CREATE TABLE roles (
        id uuid NOT NULL,
        code varchar(32) NOT NULL,
        name varchar(64) NOT NULL,
        description text NOT NULL DEFAULT '',
        permissions text[] NOT NULL DEFAULT '{}',
        is_system boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_roles PRIMARY KEY (id),
        CONSTRAINT uq_roles_code UNIQUE (code),
        CONSTRAINT ck_roles_code_format CHECK (code ~ '^[a-z][a-z_]{1,31}$'),
        CONSTRAINT ck_roles_permissions_format CHECK (array_position(permissions, NULL) IS NULL)
    )
    """,
    """
    CREATE TABLE user_roles (
        user_id uuid NOT NULL,
        role_id uuid NOT NULL,
        granted_by uuid,
        granted_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id),
        CONSTRAINT fk_user_roles_user_id_users FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_user_roles_role_id_roles FOREIGN KEY (role_id) REFERENCES roles (id),
        CONSTRAINT fk_user_roles_granted_by_users FOREIGN KEY (granted_by) REFERENCES users (id)
    )
    """,
    "CREATE INDEX ix_user_roles_role_id ON user_roles (role_id)",
    "CREATE INDEX ix_user_roles_granted_by ON user_roles (granted_by)",
    """
    CREATE TABLE user_sessions (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        token_hash bytea NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        idle_expires_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        mfa_verified_at timestamptz,
        mfa_pending boolean NOT NULL DEFAULT false,
        mfa_failed_count smallint NOT NULL DEFAULT 0,
        rotated_from uuid,
        revoked_at timestamptz,
        revoked_reason varchar(32),
        ip_address inet,
        last_ip_address inet,
        user_agent varchar(512),
        CONSTRAINT pk_user_sessions PRIMARY KEY (id),
        CONSTRAINT uq_user_sessions_token_hash UNIQUE (token_hash),
        CONSTRAINT fk_user_sessions_user_id_users FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT ck_user_sessions_token_hash_len CHECK (octet_length(token_hash) = 32),
        CONSTRAINT ck_user_sessions_expiry_after_create CHECK (expires_at > created_at),
        CONSTRAINT ck_user_sessions_revoked_reason_enum CHECK (revoked_reason IN (
            'logout', 'user_revoked', 'revoke_others', 'admin_revoked', 'password_changed', 'password_reset',
            'account_suspended', 'account_deactivated', 'mfa_changed', 'expired', 'rotated', 'mfa_failed')),
        CONSTRAINT ck_user_sessions_revocation_consistent CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
    )
    """,
    "CREATE INDEX ix_user_sessions_user_id_active ON user_sessions (user_id) WHERE revoked_at IS NULL",
    "CREATE INDEX ix_user_sessions_user_id ON user_sessions (user_id)",
    "CREATE INDEX ix_user_sessions_expires_at ON user_sessions (expires_at)",
    """
    CREATE TABLE email_verifications (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        purpose varchar(32) NOT NULL,
        email citext NOT NULL,
        token_hash bytea NOT NULL,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        invalidated_at timestamptz,
        requested_ip inet,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_email_verifications PRIMARY KEY (id),
        CONSTRAINT uq_email_verifications_token_hash UNIQUE (token_hash),
        CONSTRAINT fk_email_verifications_user_id_users FOREIGN KEY (user_id)
            REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT ck_email_verifications_purpose_enum CHECK (purpose IN ('email_verify', 'password_reset')),
        CONSTRAINT ck_email_verifications_email_lower CHECK (email::text = lower(email::text)),
        CONSTRAINT ck_email_verifications_token_hash_len CHECK (octet_length(token_hash) = 32)
    )
    """,
    """CREATE INDEX ix_email_verifications_user_id_purpose_open ON email_verifications (user_id, purpose)
       WHERE consumed_at IS NULL AND invalidated_at IS NULL""",
    "CREATE INDEX ix_email_verifications_expires_at ON email_verifications (expires_at)",
    """
    CREATE TABLE payout_methods (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        method_type varchar(32) NOT NULL,
        label varchar(100) NOT NULL,
        details jsonb NOT NULL,
        display_hint varchar(64) NOT NULL,
        is_default boolean NOT NULL DEFAULT false,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_payout_methods PRIMARY KEY (id),
        CONSTRAINT fk_payout_methods_user_id_users FOREIGN KEY (user_id) REFERENCES users (id),
        CONSTRAINT ck_payout_methods_method_type_enum CHECK (
            method_type IN ('bank_transfer', 'aba_pay', 'wise', 'paypal', 'other'))
    )
    """,
    "CREATE UNIQUE INDEX uq_payout_methods_one_default ON payout_methods (user_id) "
    "WHERE is_default AND deleted_at IS NULL",
    "CREATE INDEX ix_payout_methods_user_id_active ON payout_methods (user_id) WHERE deleted_at IS NULL",
    """
    CREATE TABLE contributor_verifications (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'pending',
        legal_name varchar(200),
        country_code char(2),
        date_of_birth date,
        phone varchar(32),
        payout_method_id uuid,
        id_document_object_key varchar(512),
        id_document_file_name varchar(255),
        id_document_mime varchar(255),
        id_document_sha256 bytea,
        id_document_scan_status varchar(32),
        submitted_at timestamptz NOT NULL DEFAULT now(),
        decided_at timestamptz,
        decided_by uuid,
        decision_reason text,
        admin_notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_contributor_verifications PRIMARY KEY (id),
        CONSTRAINT fk_contributor_verifications_user_id_users FOREIGN KEY (user_id) REFERENCES users (id),
        CONSTRAINT fk_contributor_verifications_payout_method_id_payout_methods
            FOREIGN KEY (payout_method_id) REFERENCES payout_methods (id),
        CONSTRAINT fk_contributor_verifications_decided_by_users FOREIGN KEY (decided_by) REFERENCES users (id),
        CONSTRAINT ck_contributor_verifications_status_enum CHECK (
            status IN ('pending', 'approved', 'rejected', 'needs_info')),
        CONSTRAINT ck_contributor_verifications_country_code_format CHECK (country_code ~ '^[A-Z]{2}$'),
        CONSTRAINT ck_contributor_verifications_phone_format CHECK (phone ~ '^\\+[1-9][0-9]{6,14}$'),
        CONSTRAINT ck_contributor_verifications_id_document_sha256_len CHECK (
            id_document_sha256 IS NULL OR octet_length(id_document_sha256) = 32),
        CONSTRAINT ck_contributor_verifications_id_document_scan_status CHECK (
            id_document_scan_status IN ('pending', 'clean', 'infected', 'error')),
        CONSTRAINT ck_contributor_verifications_not_self CHECK (decided_by IS NULL OR decided_by <> user_id),
        CONSTRAINT ck_contributor_verifications_reason_required CHECK (
            status NOT IN ('rejected', 'needs_info') OR decision_reason IS NOT NULL),
        CONSTRAINT ck_contributor_verifications_decided_consistent CHECK (
            (status = 'pending') = (decided_at IS NULL))
    )
    """,
    "CREATE UNIQUE INDEX uq_contributor_verifications_one_pending ON contributor_verifications (user_id) "
    "WHERE status = 'pending'",
    "CREATE INDEX ix_contributor_verifications_user_id_submitted_at "
    "ON contributor_verifications (user_id, submitted_at DESC)",
    "CREATE INDEX ix_contributor_verifications_status_submitted_at "
    "ON contributor_verifications (status, submitted_at)",
    "CREATE INDEX ix_contributor_verifications_payout_method_id ON contributor_verifications (payout_method_id)",
    "CREATE INDEX ix_contributor_verifications_decided_by ON contributor_verifications (decided_by)",
    """
    CREATE TABLE agreement_acceptances (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        agreement_type varchar(32) NOT NULL,
        agreement_version varchar(32) NOT NULL,
        content_sha256 bytea NOT NULL,
        dataset_id uuid,
        accepted_at timestamptz NOT NULL DEFAULT now(),
        ip_address inet,
        user_agent varchar(512),
        CONSTRAINT pk_agreement_acceptances PRIMARY KEY (id),
        CONSTRAINT fk_agreement_acceptances_user_id_users FOREIGN KEY (user_id) REFERENCES users (id),
        CONSTRAINT ck_agreement_acceptances_agreement_type_enum CHECK (agreement_type IN (
            'terms_of_service', 'privacy_policy', 'contributor_agreement', 'rights_declaration',
            'annotator_agreement')),
        CONSTRAINT ck_agreement_acceptances_content_sha256_len CHECK (octet_length(content_sha256) = 32)
    )
    """,
    "CREATE UNIQUE INDEX uq_agreement_acceptances_account_level "
    "ON agreement_acceptances (user_id, agreement_type, agreement_version) WHERE dataset_id IS NULL",
    "CREATE UNIQUE INDEX uq_agreement_acceptances_dataset_level "
    "ON agreement_acceptances (dataset_id, agreement_type, agreement_version) WHERE dataset_id IS NOT NULL",
    "CREATE INDEX ix_agreement_acceptances_user_id ON agreement_acceptances (user_id)",
    """
    CREATE TABLE security_events (
        id uuid NOT NULL,
        user_id uuid,
        event_type varchar(64) NOT NULL,
        severity varchar(32) NOT NULL DEFAULT 'info',
        email_attempted citext,
        ip_address inet,
        user_agent varchar(512),
        request_id varchar(64),
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_security_events PRIMARY KEY (id),
        CONSTRAINT fk_security_events_user_id_users FOREIGN KEY (user_id) REFERENCES users (id),
        CONSTRAINT ck_security_events_event_type_enum CHECK (event_type IN (
            'login_succeeded', 'login_failed', 'login_blocked_status', 'account_locked', 'logout',
            'mfa_challenge_succeeded', 'mfa_challenge_failed', 'mfa_enabled', 'mfa_disabled',
            'mfa_recovery_code_used', 'password_changed', 'password_reset_requested',
            'password_reset_completed', 'email_verified', 'session_revoked', 'sessions_revoked_by_admin',
            'csrf_rejected', 'permission_denied', 'rate_limited', 'file_quarantined', 'role_changed',
            'account_suspended', 'account_reactivated')),
        CONSTRAINT ck_security_events_severity_enum CHECK (severity IN ('info', 'warning', 'critical'))
    )
    """,
    "CREATE INDEX ix_security_events_user_id_created_at ON security_events (user_id, created_at DESC)",
    "CREATE INDEX ix_security_events_event_type_created_at ON security_events (event_type, created_at DESC)",
    "CREATE INDEX ix_security_events_ip_address_created_at ON security_events (ip_address, created_at DESC)",
    "CREATE INDEX ix_security_events_created_at_brin ON security_events USING brin (created_at)",
    """
    CREATE TABLE mfa_recovery_codes (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        code_hash bytea NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_mfa_recovery_codes PRIMARY KEY (id),
        CONSTRAINT fk_mfa_recovery_codes_user_id_users FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT uq_mfa_recovery_codes_user_id_code_hash UNIQUE (user_id, code_hash),
        CONSTRAINT ck_mfa_recovery_codes_code_hash_len CHECK (octet_length(code_hash) = 32)
    )
    """,
]

TABLES_REVERSE = [
    "mfa_recovery_codes",
    "security_events",
    "agreement_acceptances",
    "contributor_verifications",
    "payout_methods",
    "email_verifications",
    "user_sessions",
    "user_roles",
    "roles",
    "user_profiles",
    "users",
]


def _array_literal(values: list[str]) -> str:
    return "ARRAY[" + ", ".join("'" + v.replace("'", "''") + "'" for v in values) + "]::text[]"


def upgrade() -> None:
    for statement in DDL:
        op.execute(statement)
    for code, (name, description, permissions) in ROLES.items():
        role_id = uuid.uuid5(_ROLE_NS, code)
        op.execute(
            "INSERT INTO roles (id, code, name, description, permissions, is_system) VALUES ("
            f"'{role_id}', '{code}', '{name}', '{description}', {_array_literal(permissions)}, true)"
        )


def downgrade() -> None:
    for table in TABLES_REVERSE:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
