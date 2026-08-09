"""add is_imported to lecture_occurrences

Revision ID: b7e9f3a2c841
Revises: ac78f7b8c03e
Create Date: 2026-08-09 23:19:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b7e9f3a2c841'
down_revision: Union[str, Sequence[str], None] = 'ac78f7b8c03e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_imported flag to lecture_occurrences.

    Tracks whether an occurrence's attendance status was set via the historical
    import process (True) or by a manual user edit (False). Cleared automatically
    when the student manually changes a record's status in the Daily Tracker.
    """
    op.add_column(
        'lecture_occurrences',
        sa.Column(
            'is_imported',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false')
        )
    )


def downgrade() -> None:
    """Remove is_imported flag from lecture_occurrences."""
    op.drop_column('lecture_occurrences', 'is_imported')
