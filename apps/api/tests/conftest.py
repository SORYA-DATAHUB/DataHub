"""Shared fixtures. Integration tests use a throwaway Postgres database whose name must end in _test."""

import os
from collections.abc import Generator
from pathlib import Path

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from psycopg import sql
from sqlalchemy import text

from datahub.core.config import Settings
from datahub.core.db import Database

ADMIN_URL = os.environ.get(
    "DATAHUB_TEST_ADMIN_URL", "postgresql://datahub:datahub_dev_password@localhost:5440/postgres"
)
TEST_DB_NAME = os.environ.get("DATAHUB_TEST_DB_NAME", "datahub_test")
TEST_DB_URL = os.environ.get(
    "DATAHUB_TEST_DATABASE_URL",
    f"postgresql+psycopg://datahub:datahub_dev_password@localhost:5440/{TEST_DB_NAME}",
)
API_ROOT = Path(__file__).resolve().parents[1]


def _ensure_database() -> str | None:
    """Create the throwaway DB if missing. Returns a skip reason when Postgres is unavailable."""
    if not TEST_DB_NAME.endswith("_test"):
        return f"refusing to use database {TEST_DB_NAME!r}: name must end in _test"
    try:
        with psycopg.connect(ADMIN_URL, autocommit=True, connect_timeout=3) as conn:
            exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB_NAME,)).fetchone()
            if not exists:
                conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(TEST_DB_NAME)))
    except psycopg.Error as exc:
        return f"Postgres not available for integration tests: {exc.__class__.__name__}"
    return None


def _alembic_config() -> Config:
    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "alembic"))
    cfg.attributes["database_url"] = TEST_DB_URL
    return cfg


@pytest.fixture(scope="session")
def migrated_db() -> Generator[Database]:
    reason = _ensure_database()
    if reason:
        pytest.skip(reason)
    database = Database(TEST_DB_URL)
    cfg = _alembic_config()
    # Start from a clean slate so migrations (including seeds) are exercised every run.
    with database.engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    command.upgrade(cfg, "head")
    yield database
    database.dispose()


@pytest.fixture
def db(migrated_db: Database) -> Generator[Database]:
    """Database with identity data wiped (seeded roles survive)."""
    with migrated_db.engine.begin() as conn:
        conn.execute(text("TRUNCATE users, security_events, agreement_acceptances CASCADE"))
    yield migrated_db


def make_settings(**overrides: object) -> Settings:
    base: dict[str, object] = {
        "env": "test",
        "database_url": TEST_DB_URL,
        "rate_limit_backend": "memory",
        "argon2_time_cost": 1,
        "argon2_memory_kib": 64,
        "argon2_parallelism": 1,
        "auth_min_response_ms": 0,
        "log_level": "WARNING",
    }
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


@pytest.fixture
def settings() -> Settings:
    return make_settings()
