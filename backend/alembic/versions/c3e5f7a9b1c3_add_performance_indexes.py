"""add performance indexes

Revision ID: c3e5f7a9b1c3
Revises: c2d4f6a8b0e1
Create Date: 2026-08-13 22:42:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3e5f7a9b1c3'
down_revision: Union[str, Sequence[str], None] = 'c2d4f6a8b0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # High-performance indexes for attendance, timetable, calendar and semester filtering
    op.create_index('ix_semesters_user_id', 'semesters', ['user_id'], unique=False)
    op.create_index('ix_subjects_sem_id', 'subjects', ['semester_id'], unique=False)
    op.create_index('ix_timetable_slots_sem_id', 'timetable_slots', ['semester_id'], unique=False)
    op.create_index('ix_calendar_events_sem_date', 'calendar_events', ['semester_id', 'date'], unique=False)
    op.create_index('ix_lecture_occurrences_sem_date', 'lecture_occurrences', ['semester_id', 'date'], unique=False)
    op.create_index('ix_lecture_occurrences_sem_subject', 'lecture_occurrences', ['semester_id', 'subject_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_lecture_occurrences_sem_subject', table_name='lecture_occurrences')
    op.drop_index('ix_lecture_occurrences_sem_date', table_name='lecture_occurrences')
    op.drop_index('ix_calendar_events_sem_date', table_name='calendar_events')
    op.drop_index('ix_timetable_slots_sem_id', table_name='timetable_slots')
    op.drop_index('ix_subjects_sem_id', table_name='subjects')
    op.drop_index('ix_semesters_user_id', table_name='semesters')
