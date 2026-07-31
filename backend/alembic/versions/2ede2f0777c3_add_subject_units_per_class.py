"""add_subject_units_per_class

Revision ID: 2ede2f0777c3
Revises: ccbc49bb3515
Create Date: 2026-07-29 15:23:52.463902

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2ede2f0777c3'
down_revision: Union[str, Sequence[str], None] = 'ccbc49bb3515'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'subjects',
        sa.Column('units_per_class', sa.Integer(), nullable=False, server_default='1')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('subjects', 'units_per_class')
