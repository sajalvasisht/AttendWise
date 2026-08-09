"""Beta admin analytics endpoints.

Provides a single GET /analytics/overview endpoint that returns aggregate
product metrics for the AttendWise Beta dashboard.

All calculations are performed at query time — no pre-aggregated tables
are required for the beta scale.

Metrics returned:
    registered_users      — total user count
    daily_active_users    — unique users who logged in today
    weekly_active_users   — unique users who logged in in the last 7 days
    monthly_active_users  — unique users who logged in in the last 30 days
    total_logins          — all-time LOGIN event count
    attendance_marks      — all-time MARK_ATTENDANCE event count
    timetable_imports     — all-time IMPORT_TIMETABLE event count
    calendar_imports      — all-time IMPORT_CALENDAR event count
    ai_queries            — all-time AI_QUERY event count
    subject_creations     — all-time SUBJECT_CREATED event count
    setups_completed      — all-time SETUP_COMPLETED event count
    feedbacks_submitted   — all-time FEEDBACK_SUBMITTED event count
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from datetime import datetime, timedelta, timezone
from typing import Any

from app.database.session import get_db
from app.models.models import User, UserEvent
from app.api.deps import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _count_unique_logins_since(db: Session, since: datetime) -> int:
    """Count distinct users with a LOGIN event on or after `since`."""
    return (
        db.query(func.count(distinct(UserEvent.user_id)))
        .filter(
            UserEvent.event_type == "LOGIN",
            UserEvent.created_at >= since,
        )
        .scalar()
        or 0
    )


def _count_events(db: Session, event_type: str) -> int:
    """Count all-time events of a given type."""
    return (
        db.query(func.count(UserEvent.id))
        .filter(UserEvent.event_type == event_type)
        .scalar()
        or 0
    )


@router.get("/overview")
def get_analytics_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return aggregate product metrics for the AttendWise Beta admin.

    Active User windows:
    - Daily  = LOGIN events since midnight today (UTC)
    - Weekly = LOGIN events in the last 7 calendar days
    - Monthly = LOGIN events in the last 30 calendar days
    """
    now = datetime.now(timezone.utc)
    today_midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    registered_users = db.query(func.count(User.id)).scalar() or 0

    return {
        # User counts
        "registered_users": registered_users,
        "daily_active_users": _count_unique_logins_since(db, today_midnight),
        "weekly_active_users": _count_unique_logins_since(db, seven_days_ago),
        "monthly_active_users": _count_unique_logins_since(db, thirty_days_ago),

        # All-time event totals
        "total_logins": _count_events(db, "LOGIN"),
        "attendance_marks": _count_events(db, "MARK_ATTENDANCE"),
        "timetable_imports": _count_events(db, "IMPORT_TIMETABLE"),
        "calendar_imports": _count_events(db, "IMPORT_CALENDAR"),
        "ai_queries": _count_events(db, "AI_QUERY"),
        "subject_creations": _count_events(db, "SUBJECT_CREATED"),
        "setups_completed": _count_events(db, "SETUP_COMPLETED"),
        "feedbacks_submitted": _count_events(db, "FEEDBACK_SUBMITTED"),
    }
