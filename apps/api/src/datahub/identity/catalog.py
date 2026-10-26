"""Canonical role/permission catalogue (ENGINEERING_BASELINE.md section 6).

The same mapping is seeded by migration 0002; a test asserts they agree. Changing the mapping requires a new
migration and a DECISION_LOG.md entry.
"""

from typing import Final

CONTRIBUTOR: Final = "contributor"
ANNOTATOR: Final = "annotator"
REVIEWER: Final = "reviewer"
ADMIN: Final = "admin"
SUPER_ADMIN: Final = "super_admin"

ROLE_CODES: Final = (CONTRIBUTOR, ANNOTATOR, REVIEWER, ADMIN, SUPER_ADMIN)
ADMIN_ROLES: Final = frozenset({ADMIN, SUPER_ADMIN})
STAFF_ROLES: Final = frozenset({REVIEWER, ADMIN, SUPER_ADMIN})
#: Roles an `admin` may grant/remove; the others need role.manage (super_admin).
ADMIN_GRANTABLE_ROLES: Final = frozenset({CONTRIBUTOR, ANNOTATOR, REVIEWER})

_STAFF_BASE: Final = (
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
)

ROLE_PERMISSIONS: Final[dict[str, tuple[str, ...]]] = {
    CONTRIBUTOR: ("profile.self", "dataset.create", "dataset.read.own", "payout.request", "message.self"),
    ANNOTATOR: ("profile.self", "payout.request", "message.self", "annotation.work"),
    REVIEWER: ("profile.self", "message.self", "dataset.review", "annotation.review"),
    ADMIN: _STAFF_BASE,
    SUPER_ADMIN: (*_STAFF_BASE, "finance.adjust", "pricing.manage", "role.manage", "settings.manage", "audit.read"),
}

PERMISSIONS: Final = frozenset(code for codes in ROLE_PERMISSIONS.values() for code in codes)
