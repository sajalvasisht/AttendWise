"""Analytics service for AttendWise Beta.

Design principles:
- Non-critical infrastructure: analytics failures must NEVER interrupt business operations.
- Single canonical signature:
    analytics.log_event(
        db=db,
        user=current_user,
        event="LOGIN",
        page="login",
        metadata=None
    )
- Fault-tolerant: independently catches any exception around database writes and logs server-side.
- Privacy-first: no sensitive data (passwords, tokens, attendance content, AI prompts, IP addresses).
- Strict whitelist:
    LOGIN, IMPORT_TIMETABLE, IMPORT_CALENDAR, MARK_ATTENDANCE,
    AI_QUERY, SUBJECT_CREATED, SETUP_COMPLETED, FEEDBACK_SUBMITTED
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, TYPE_CHECKING
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from app.models.models import User

logger = logging.getLogger(__name__)

VALID_EVENTS = frozenset({
    "LOGIN",
    "IMPORT_TIMETABLE",
    "IMPORT_CALENDAR",
    "MARK_ATTENDANCE",
    "AI_QUERY",
    "SUBJECT_CREATED",
    "SETUP_COMPLETED",
    "FEEDBACK_SUBMITTED",
})


class AnalyticsService:
    """Lightweight analytics event logger with failure isolation."""

    def log_event(
        self,
        db: Session,
        user: "User",
        event: str,
        page: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record a single analytics event.

        Canonical signature:
            analytics.log_event(
                db=db,
                user=current_user,
                event="LOGIN",
                page="login",
                metadata=None
            )
        """
        try:
            if not user or not getattr(user, "id", None):
                logger.warning("analytics.log_event: missing valid user — skipping event %r", event)
                return

            if not event:
                logger.warning("analytics.log_event: missing event name for user %s", getattr(user, "id", None))
                return

            normalised_event = event.upper()
            if normalised_event not in VALID_EVENTS:
                logger.warning(
                    "analytics.log_event: unknown event %r for user %s — skipping",
                    event,
                    user.id,
                )
                return

            from app.models.models import UserEvent

            event_record = UserEvent(
                user_id=user.id,
                event_type=normalised_event,
                page=page,
                metadata_=metadata,
            )

            # Independently catch exceptions around the actual database write
            try:
                with db.begin_nested():
                    db.add(event_record)
                    db.flush()
                db.commit()
            except Exception:
                logger.exception(
                    "analytics.log_event: database write failed for event %r for user %s",
                    normalised_event,
                    user.id,
                )

        except Exception:
            logger.exception(
                "analytics.log_event: unexpected error logging event %r for user %s",
                event,
                getattr(user, "id", "unknown"),
            )


analytics = AnalyticsService()
