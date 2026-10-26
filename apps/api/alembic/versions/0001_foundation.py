"""Foundation extensions and migration marker.

Revision ID: 0001_foundation
Revises: None
"""
from alembic import op

revision = "0001_foundation"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "citext"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pg_trgm"')


def downgrade() -> None:
    # Extensions may be shared by other database objects; intentionally retained.
    pass
