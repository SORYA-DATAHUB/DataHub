"""B-01: identity schema, seeds and DB-level constraints."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from alembic import command
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from datahub.core.db import Base, Database
from datahub.identity import models
from datahub.identity.catalog import PERMISSIONS, ROLE_CODES, ROLE_PERMISSIONS
from tests.conftest import _alembic_config

NOW = datetime.now(UTC)


def _user(conn, **kw):  # type: ignore[no-untyped-def]
    values = {
        "id": uuid.uuid4(),
        "email": f"{uuid.uuid4().hex[:8]}@example.com",
        "password_hash": "$argon2id$x",
        "display_name": "Test User",
        "status": "pending_email",
        "email_verified_at": None,
    }
    values.update(kw)
    conn.execute(
        text(
            "INSERT INTO users (id, email, password_hash, display_name, status, email_verified_at) "
            "VALUES (:id, :email, :password_hash, :display_name, :status, :email_verified_at)"
        ),
        values,
    )
    return values["id"]


def test_five_system_roles_seeded_with_catalogue_permissions(db: Database) -> None:
    with db.engine.connect() as conn:
        rows = conn.execute(text("SELECT code, permissions, is_system FROM roles")).all()
    assert {r.code for r in rows} == set(ROLE_CODES)
    for row in rows:
        assert row.is_system
        assert tuple(row.permissions) == ROLE_PERMISSIONS[row.code]
        assert set(row.permissions) <= PERMISSIONS


def test_admins_cannot_request_payouts_and_only_super_admin_manages_roles(db: Database) -> None:
    assert "payout.request" not in ROLE_PERMISSIONS["admin"]
    assert "payout.request" not in ROLE_PERMISSIONS["super_admin"]
    assert "role.manage" not in ROLE_PERMISSIONS["admin"]
    assert "role.manage" in ROLE_PERMISSIONS["super_admin"]


def test_migration_seeds_no_identity_or_secret(db: Database) -> None:
    with db.engine.connect() as conn:
        for table in ("users", "user_sessions", "email_verifications", "mfa_recovery_codes", "security_events"):
            assert conn.execute(text(f"SELECT count(*) FROM {table}")).scalar_one() == 0


def test_models_match_database_columns(db: Database) -> None:
    with db.engine.connect() as conn:
        for table in Base.metadata.sorted_tables:
            cols = {
                r.column_name
                for r in conn.execute(
                    text("SELECT column_name FROM information_schema.columns WHERE table_name = :t"),
                    {"t": table.name},
                )
            }
            assert {c.name for c in table.columns} == cols, table.name
    assert models.User.__tablename__ == "users"


def test_constraint_and_index_names_fit_postgres_limit(db: Database) -> None:
    with db.engine.connect() as conn:
        names = [r[0] for r in conn.execute(text("SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace"))]
        names += [r[0] for r in conn.execute(text("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'"))]
    assert names
    assert all(len(n) <= 63 for n in names)


@pytest.mark.parametrize(
    ("overrides", "constraint"),
    [
        ({"email": "UPPER@example.com"}, "ck_users_email_lower"),
        ({"email": "ab"}, "ck_users_email_length"),
        ({"status": "bogus"}, "ck_users_status_enum"),
        ({"status": "active", "email_verified_at": None}, "ck_users_active_requires_verified_email"),
        ({"display_name": " x "}, "ck_users_display_name_length"),
        ({"password_hash": None}, "ck_users_password_hash_present"),
    ],
)
def test_user_check_constraints(db: Database, overrides: dict[str, object], constraint: str) -> None:
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as err:
        _user(conn, **overrides)
    assert constraint in str(err.value)


def test_email_unique(db: Database) -> None:
    with db.engine.begin() as conn:
        _user(conn, email="same@example.com")
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as err:
        _user(conn, email="same@example.com")
    assert "uq_users_email" in str(err.value)
    with db.engine.connect() as conn:  # citext: lookups are case-insensitive
        found = conn.execute(text("SELECT count(*) FROM users WHERE email = 'SAME@EXAMPLE.COM'")).scalar_one()
    assert found == 1


def test_mfa_enabled_requires_secret_and_failed_count_nonnegative(db: Database) -> None:
    with db.engine.begin() as conn:
        uid = _user(conn)
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as err:
        conn.execute(text("UPDATE users SET mfa_enabled = true WHERE id = :i"), {"i": uid})
    assert "ck_users_mfa_secret_when_enabled" in str(err.value)
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as err2:
        conn.execute(text("UPDATE users SET failed_login_count = -1 WHERE id = :i"), {"i": uid})
    assert "ck_users_failed_login_count_nonneg" in str(err2.value)


def test_suspended_requires_reason(db: Database) -> None:
    with db.engine.begin() as conn:
        uid = _user(conn)
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as err:
        conn.execute(text("UPDATE users SET status = 'suspended' WHERE id = :i"), {"i": uid})
    assert "ck_users_suspension_reason_when_suspended" in str(err.value)


def _session_sql() -> str:
    return (
        "INSERT INTO user_sessions (id, user_id, token_hash, created_at, idle_expires_at, expires_at, "
        "revoked_at, revoked_reason) VALUES (gen_random_uuid(), :u, :h, :c, :i, :e, :ra, :rr)"
    )


def test_session_constraints(db: Database) -> None:
    with db.engine.begin() as conn:
        uid = _user(conn)
    base = {"u": uid, "h": b"\x01" * 32, "c": NOW, "i": NOW + timedelta(days=1), "e": NOW + timedelta(days=2)}
    base |= {"ra": None, "rr": None}
    with db.engine.begin() as conn:
        conn.execute(text(_session_sql()), base)
    cases = [
        ({"h": b"short"}, "ck_user_sessions_token_hash_len"),
        ({"h": b"\x02" * 32, "e": NOW - timedelta(days=1)}, "ck_user_sessions_expiry_after_create"),
        ({"h": b"\x03" * 32, "ra": NOW}, "ck_user_sessions_revocation_consistent"),
        ({"h": b"\x04" * 32, "ra": NOW, "rr": "nonsense"}, "ck_user_sessions_revoked_reason_enum"),
        ({"h": b"\x01" * 32}, "uq_user_sessions_token_hash"),
    ]
    for override, name in cases:
        with db.engine.connect() as conn, pytest.raises(IntegrityError) as err:
            conn.execute(text(_session_sql()), base | override)
        assert name in str(err.value)


def test_email_verification_constraints(db: Database) -> None:
    with db.engine.begin() as conn:
        uid = _user(conn)
    sql = (
        "INSERT INTO email_verifications (id, user_id, purpose, email, token_hash, expires_at) "
        "VALUES (gen_random_uuid(), :u, :p, :e, :h, :x)"
    )
    ok = {"u": uid, "p": "email_verify", "e": "a@example.com", "h": b"\x09" * 32, "x": NOW + timedelta(hours=1)}
    with db.engine.begin() as conn:
        conn.execute(text(sql), ok)
    for override, name in [
        ({"h": b"\x09" * 32}, "uq_email_verifications_token_hash"),
        ({"h": b"\x0a" * 8}, "ck_email_verifications_token_hash_len"),
        ({"h": b"\x0b" * 32, "p": "other"}, "ck_email_verifications_purpose_enum"),
        ({"h": b"\x0c" * 32, "e": "A@example.com"}, "ck_email_verifications_email_lower"),
    ]:
        with db.engine.connect() as conn, pytest.raises(IntegrityError) as err:
            conn.execute(text(sql), ok | override)
        assert name in str(err.value)


def test_user_roles_primary_key_and_cascade(db: Database) -> None:
    with db.engine.begin() as conn:
        uid = _user(conn)
        role_id = conn.execute(text("SELECT id FROM roles WHERE code = 'contributor'")).scalar_one()
        conn.execute(text("INSERT INTO user_roles (user_id, role_id) VALUES (:u, :r)"), {"u": uid, "r": role_id})
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as err:
        conn.execute(text("INSERT INTO user_roles (user_id, role_id) VALUES (:u, :r)"), {"u": uid, "r": role_id})
    assert "pk_user_roles" in str(err.value)
    with db.engine.connect() as conn, pytest.raises(IntegrityError):
        conn.execute(text("DELETE FROM roles WHERE id = :r"), {"r": role_id})
    with db.engine.begin() as conn:
        conn.execute(text("DELETE FROM users WHERE id = :u"), {"u": uid})
        assert conn.execute(text("SELECT count(*) FROM user_roles WHERE user_id = :u"), {"u": uid}).scalar_one() == 0


def test_recovery_code_unique_per_user(db: Database) -> None:
    with db.engine.begin() as conn:
        uid = _user(conn)
        conn.execute(
            text("INSERT INTO mfa_recovery_codes (id, user_id, code_hash) VALUES (gen_random_uuid(), :u, :h)"),
            {"u": uid, "h": b"\x05" * 32},
        )
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as err:
        conn.execute(
            text("INSERT INTO mfa_recovery_codes (id, user_id, code_hash) VALUES (gen_random_uuid(), :u, :h)"),
            {"u": uid, "h": b"\x05" * 32},
        )
    assert "uq_mfa_recovery_codes_user_id_code_hash" in str(err.value)


def test_contributor_verification_rules(db: Database) -> None:
    with db.engine.begin() as conn:
        uid = _user(conn)
        conn.execute(
            text("INSERT INTO contributor_verifications (id, user_id) VALUES (gen_random_uuid(), :u)"), {"u": uid}
        )
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as one_pending:
        conn.execute(
            text("INSERT INTO contributor_verifications (id, user_id) VALUES (gen_random_uuid(), :u)"), {"u": uid}
        )
    assert "uq_contributor_verifications_one_pending" in str(one_pending.value)
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as self_decide:
        conn.execute(
            text(
                "INSERT INTO contributor_verifications (id, user_id, status, decided_at, decided_by) "
                "VALUES (gen_random_uuid(), :u, 'approved', now(), :u)"
            ),
            {"u": uid},
        )
    assert "ck_contributor_verifications_not_self" in str(self_decide.value)
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as reason:
        conn.execute(
            text(
                "INSERT INTO contributor_verifications (id, user_id, status, decided_at) "
                "VALUES (gen_random_uuid(), :u, 'rejected', now())"
            ),
            {"u": uid},
        )
    assert "ck_contributor_verifications_reason_required" in str(reason.value)


def test_agreement_acceptance_unique_per_version(db: Database) -> None:
    with db.engine.begin() as conn:
        uid = _user(conn)
    sql = (
        "INSERT INTO agreement_acceptances (id, user_id, agreement_type, agreement_version, content_sha256) "
        "VALUES (gen_random_uuid(), :u, 'terms_of_service', 'v1', :h)"
    )
    with db.engine.begin() as conn:
        conn.execute(text(sql), {"u": uid, "h": b"\x00" * 32})
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as err:
        conn.execute(text(sql), {"u": uid, "h": b"\x00" * 32})
    assert "uq_agreement_acceptances_account_level" in str(err.value)


def test_security_event_enums(db: Database) -> None:
    sql = "INSERT INTO security_events (id, event_type, severity) VALUES (gen_random_uuid(), :t, :s)"
    with db.engine.begin() as conn:
        conn.execute(text(sql), {"t": "login_failed", "s": "info"})
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as err:
        conn.execute(text(sql), {"t": "made_up", "s": "info"})
    assert "ck_security_events_event_type_enum" in str(err.value)
    with db.engine.connect() as conn, pytest.raises(IntegrityError) as err2:
        conn.execute(text(sql), {"t": "login_failed", "s": "loud"})
    assert "ck_security_events_severity_enum" in str(err2.value)


def test_downgrade_then_upgrade_roundtrip(db: Database) -> None:
    cfg = _alembic_config()
    command.downgrade(cfg, "0001_foundation")
    with db.engine.connect() as conn:
        assert conn.execute(text("SELECT to_regclass('public.users')")).scalar_one() is None
    command.upgrade(cfg, "head")
    with db.engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM roles")).scalar_one() == len(ROLE_CODES)
