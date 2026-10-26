"""Identity tables (DATABASE_SCHEMA.md section 4.1). Alembic revision 0002 is the DDL source of truth."""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, CITEXT, INET, JSONB, BYTEA
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from datahub.core.db import Base
from datahub.core.ids import uuid7

TS = DateTime(timezone=True)


def _id() -> Mapped[uuid.UUID]:
    return mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid7)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _id()
    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(32), default="pending_email", server_default="pending_email")
    verification_status: Mapped[str] = mapped_column(String(32), default="unverified", server_default="unverified")
    email_verified_at: Mapped[datetime | None] = mapped_column(TS)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(TS)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    mfa_secret_encrypted: Mapped[bytes | None] = mapped_column(BYTEA)
    mfa_enabled_at: Mapped[datetime | None] = mapped_column(TS)
    mfa_setup_expires_at: Mapped[datetime | None] = mapped_column(TS)
    mfa_last_used_step: Mapped[int | None] = mapped_column(BigInteger)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    failed_login_window_started_at: Mapped[datetime | None] = mapped_column(TS)
    locked_until: Mapped[datetime | None] = mapped_column(TS)
    legal_hold: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    legal_hold_reason: Mapped[str | None] = mapped_column(Text)
    last_login_at: Mapped[datetime | None] = mapped_column(TS)
    password_changed_at: Mapped[datetime | None] = mapped_column(TS)
    suspended_at: Mapped[datetime | None] = mapped_column(TS)
    suspended_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    suspension_reason: Mapped[str | None] = mapped_column(Text)
    deactivated_at: Mapped[datetime | None] = mapped_column(TS)
    anonymized_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), onupdate=func.now())

    roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user", foreign_keys="UserRole.user_id", lazy="selectin"
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    legal_name: Mapped[str | None] = mapped_column(String(200))
    country_code: Mapped[str | None] = mapped_column(String(2))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    phone: Mapped[str | None] = mapped_column(String(32))
    organization: Mapped[str | None] = mapped_column(String(200))
    preferred_locale: Mapped[str] = mapped_column(String(10), default="en", server_default="en")
    timezone: Mapped[str | None] = mapped_column(String(64))
    privacy_trained: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    notification_preferences: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), onupdate=func.now())


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = _id()
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(64))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    permissions: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list, server_default=text("'{}'"))
    is_system: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), onupdate=func.now())


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True)
    granted_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    granted_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="roles", foreign_keys=[user_id])
    role: Mapped[Role] = relationship(lazy="selectin")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = _id()
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[bytes] = mapped_column(BYTEA, unique=True)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    idle_expires_at: Mapped[datetime] = mapped_column(TS)
    expires_at: Mapped[datetime] = mapped_column(TS)
    mfa_verified_at: Mapped[datetime | None] = mapped_column(TS)
    mfa_pending: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    mfa_failed_count: Mapped[int] = mapped_column(SmallInteger, default=0, server_default=text("0"))
    rotated_from: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    revoked_at: Mapped[datetime | None] = mapped_column(TS)
    revoked_reason: Mapped[str | None] = mapped_column(String(32))
    ip_address: Mapped[str | None] = mapped_column(INET)
    last_ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(512))


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id: Mapped[uuid.UUID] = _id()
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    purpose: Mapped[str] = mapped_column(String(32))
    email: Mapped[str] = mapped_column(CITEXT)
    token_hash: Mapped[bytes] = mapped_column(BYTEA, unique=True)
    expires_at: Mapped[datetime] = mapped_column(TS)
    consumed_at: Mapped[datetime | None] = mapped_column(TS)
    invalidated_at: Mapped[datetime | None] = mapped_column(TS)
    requested_ip: Mapped[str | None] = mapped_column(INET)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())


class PayoutMethod(Base):
    __tablename__ = "payout_methods"

    id: Mapped[uuid.UUID] = _id()
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    method_type: Mapped[str] = mapped_column(String(32))
    label: Mapped[str] = mapped_column(String(100))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB)
    display_hint: Mapped[str] = mapped_column(String(64))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    deleted_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), onupdate=func.now())


class ContributorVerification(Base):
    __tablename__ = "contributor_verifications"

    id: Mapped[uuid.UUID] = _id()
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="pending", server_default="pending")
    legal_name: Mapped[str | None] = mapped_column(String(200))
    country_code: Mapped[str | None] = mapped_column(String(2))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    phone: Mapped[str | None] = mapped_column(String(32))
    payout_method_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("payout_methods.id")
    )
    id_document_object_key: Mapped[str | None] = mapped_column(String(512))
    id_document_file_name: Mapped[str | None] = mapped_column(String(255))
    id_document_mime: Mapped[str | None] = mapped_column(String(255))
    id_document_sha256: Mapped[bytes | None] = mapped_column(BYTEA)
    id_document_scan_status: Mapped[str | None] = mapped_column(String(32))
    submitted_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(TS)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    decision_reason: Mapped[str | None] = mapped_column(Text)
    admin_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), onupdate=func.now())


class AgreementAcceptance(Base):
    __tablename__ = "agreement_acceptances"

    id: Mapped[uuid.UUID] = _id()
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    agreement_type: Mapped[str] = mapped_column(String(32))
    agreement_version: Mapped[str] = mapped_column(String(32))
    content_sha256: Mapped[bytes] = mapped_column(BYTEA)
    # FK to datasets(id) is added by the Phase C migration that creates that table.
    dataset_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    accepted_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(512))


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[uuid.UUID] = _id()
    user_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(32), default="info", server_default="info")
    email_attempted: Mapped[str | None] = mapped_column(CITEXT)
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(512))
    request_id: Mapped[str | None] = mapped_column(String(64))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())


class MfaRecoveryCode(Base):
    __tablename__ = "mfa_recovery_codes"

    id: Mapped[uuid.UUID] = _id()
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    code_hash: Mapped[bytes] = mapped_column(BYTEA)
    used_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
