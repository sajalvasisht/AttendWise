"""add user_event table and last_login_at to users

Revision ID: c2d4f6a8b0e1
Revises: b7e9f3a2c841
Create Date: 2026-08-10 00:03:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c2d4f6a8b0e1'
down_revision: Union[str, Sequence[str], None] = 'b7e9f3a2c841'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add analytics infrastructure:
    1. last_login_at column on users (for DAU/WAU/MAU calculations)
    2. user_events table for lightweight product analytics
    """
    # 1. Add last_login_at to users
    op.add_column(
        'users',
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True)
    )

    # 2. Create user_events table
    op.create_table(
        'user_events',
        sa.Column('id', sa.Integer(), primary_key=True, index=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('page', sa.String(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Indexes for efficient analytics queries
    op.create_index('ix_user_events_user_id', 'user_events', ['user_id'])
    op.create_index('ix_user_events_event_type', 'user_events', ['event_type'])
    op.create_index('ix_user_events_created_at', 'user_events', ['created_at'])
    op.create_index('ix_user_events_user_created', 'user_events', ['user_id', 'created_at'])
    op.create_index('ix_user_events_type_created', 'user_events', ['event_type', 'created_at'])


def downgrade() -> None:
    """Reverse analytics infrastructure additions."""
    op.drop_index('ix_user_events_type_created', table_name='user_events')
    op.drop_index('ix_user_events_user_created', table_name='user_events')
    op.drop_index('ix_user_events_created_at', table_name='user_events')
    op.drop_index('ix_user_events_event_type', table_name='user_events')
    op.drop_index('ix_user_events_user_id', table_name='user_events')
    op.drop_table('user_events')
    op.drop_column('users', 'last_login_at')
