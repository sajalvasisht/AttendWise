"""Analytics service for AttendWise Beta.

Design principles:
- Non-critical infrastructure: analytics must NEVER fail a user's request.
- Isolated transactions: uses isolated database sessions so analytics operations
  never commit, rollback, or corrupt the calling request's database transaction.
- Non-blocking: failures are logged server-side via logger.exception and swallowed.
- Privacy-first: no sensitive data is ever collected (passwords, tokens,
  attendance content, AI prompts, IP addresses, or browser fingerprints).
- Extensible: new event types can be added to VALID_EVENTS without schema changes.

Supported event types (beta):
    LOGIN, IMPORT_TIMETABLE, IMPORT_CALENDAR, MARK_ATTENDANCE,
    AI_QUERY, SUBJECT_CREATED, SETUP_COMPLETED, FEEDBACK_SUBMITTED

Usage examples:
    from app.services.analytics_service import analytics

    # Keyword or positional style:
    analytics.log_event(user=current_user, event="LOGIN", page="login")
    analytics.log_event(db, current_user, "MARK_ATTENDANCE", page="tracker",
                        meta={"status": "present"})
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Union, TYPE_CHECKING

from sqlalchemy.orm import Session
from app.database.session import SessionLocal

if TYPE_CHECKING:
    from app.models.models import User

logger = logging.getLogger(__name__)

# Exhaustive list of beta event types.
# Add new entries here as features are released — no schema change required.
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
    """Reusable, resilient analytics event logger.

    All operations use an isolated session and are wrapped in try/except blocks.
    Analytics will NEVER:
    - Return an error response to a user.
    - Rollback or prematurely commit the caller's database transaction.
    - Block or fail authentication, attendance, imports, or AI services.
    """

    def log_event(
        self,
        db_or_user: Optional[Union[Session, "User"]] = None,
        user: Optional["User"] = None,
        event: Optional[str] = None,
        page: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Record a single analytics event safely using an isolated session.

        Supports flexible invocation styles:
          analytics.log_event(user=current_user, event="LOGIN", page="login")
          analytics.log_event(db, current_user, "MARK_ATTENDANCE", page="tracker")
          analytics.log_event(current_user, "LOGIN", page="login")
        """
        try:
            # 1. Resolve arguments flexibly
            resolved_user: Optional["User"] = None
            resolved_event: Optional[str] = None

            # Handle kwargs if passed as event_type / metadata
            if "event_type" in kwargs and not event:
                event = kwargs["event_type"]
            if "metadata" in kwargs and not meta:
                meta = kwargs["metadata"]

            # Check if first arg is Session or User
            if isinstance(db_or_user, Session):
                resolved_user = user
                resolved_event = event
            elif db_or_user is not None:
                # db_or_user is the User instance
                resolved_user = db_or_user
                resolved_event = user if isinstance(user, str) else event
            else:
                resolved_user = user
                resolved_event = event

            if not resolved_user or not getattr(resolved_user, "id", None):
                logger.warning("analytics.log_event: missing valid user — skipping event %r", resolved_event)
                return

            if not resolved_event:
                logger.warning("analytics.log_event: missing event_type for user %s", resolved_user.id)
                return

            normalised_event = resolved_event.upper()
            if normalised_event not in VALID_EVENTS:
                logger.warning(
                    "analytics.log_event: unknown event_type %r for user %s — skipping",
                    resolved_event,
                    resolved_user.id,
                )
                return

            # 2. Insert event using an ISOLATED database session
            from app.models.models import UserEvent

            isolated_db: Session = SessionLocal()
            try:
                event_record = UserEvent(
                    user_id=resolved_user.id,
                    event_type=normalised_event,
                    page=page,
                    metadata_=meta,
                )
                isolated_db.add(event_record)
                isolated_db.commit()
            except Exception:
                isolated_db.rollback()
                logger.exception(
                    "analytics.log_event: failed to record event %r for user %s",
                    normalised_event,
                    resolved_user.id,
                )
            finally:
                isolated_db.close()

        except Exception:
            # Absolute safety net: analytics must never raise under any circumstance
            logger.exception("analytics.log_event: unexpected error in analytics logger")

    def log_login(
        self,
        db_or_user: Optional[Union[Session, "User"]] = None,
        user: Optional["User"] = None,
    ) -> None:
        """Update last_login_at on User and log LOGIN event using an isolated session."""
        try:
            resolved_user: Optional["User"] = None
            if isinstance(db_or_user, Session):
                resolved_user = user
            elif db_or_user is not None:
                resolved_user = db_or_user
            else:
                resolved_user = user

            if not resolved_user or not getattr(resolved_user, "id", None):
                return

            # Update last_login_at in an isolated session
            isolated_db: Session = SessionLocal()
            try:
                from app.models.models import User
                db_user = isolated_db.query(User).filter(User.id == resolved_user.id).first()
                if db_user:
                    db_user.last_login_at = datetime.now(timezone.utc)
                    isolated_db.commit()
            except Exception:
                isolated_db.rollback()
                logger.exception("analytics.log_login: failed to update last_login_at for user %s", resolved_user.id)
            finally:
                isolated_db.close()

            # Record the LOGIN event
            self.log_event(user=resolved_user, event="LOGIN", page="login")

        except Exception:
            logger.exception("analytics.log_login: unexpected error in log_login")


# Module-level singleton — import and use directly:
#   from app.services.analytics_service import analytics
analytics = AnalyticsService()
