from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
from datetime import date

from app.database.session import get_db
from app.models.models import CalendarEvent, Semester, User
from app.schemas.calendar import CalendarEventCreate, CalendarEventResponse
from app.api.deps import get_current_user
from app.services.occurrence_generator import generate_occurrences
from app.api.subjects import verify_semester_owner, verify_active_semester

router = APIRouter(prefix="/semesters/{semester_id}/calendar", tags=["calendar"])

@router.get("", response_model=List[CalendarEventResponse])
def read_calendar_events(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)
    return db.query(CalendarEvent).filter(CalendarEvent.semester_id == semester_id).all()

@router.post("", response_model=List[CalendarEventResponse])
def save_calendar_events(
    semester_id: int,
    events_in: List[CalendarEventCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_active_semester(semester_id, current_user.id, db)

    # Delete existing calendar events to refresh
    db.query(CalendarEvent).filter(CalendarEvent.semester_id == semester_id).delete()

    new_events = [
        CalendarEvent(
            semester_id=semester_id,
            date=event.date,
            event_type=event.event_type,
            description=event.description,
            timetable_day_override=event.timetable_day_override,
            subject_id=event.subject_id,
            start_time=event.start_time,
            end_time=event.end_time
        )
        for event in events_in
    ]

    if new_events:
        db.add_all(new_events)
        
    db.commit()

    # Regenerate future occurrences based on updated calendar events
    generate_occurrences(db, semester_id, start_from_date=date.today())

    # Fetch and return the newly saved events
    return db.query(CalendarEvent).filter(CalendarEvent.semester_id == semester_id).all()
