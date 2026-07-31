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
    mode: str = "replace",  # "replace" or "merge"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_active_semester(semester_id, current_user.id, db)

    if mode == "replace":
        db.query(CalendarEvent).filter(CalendarEvent.semester_id == semester_id).delete()
        existing_events = set()
    else:
        existing_list = db.query(CalendarEvent).filter(CalendarEvent.semester_id == semester_id).all()
        existing_events = {(e.date, e.event_type, e.description) for e in existing_list}

    new_events = []
    for event in events_in:
        key = (event.date, event.event_type, event.description)
        if key not in existing_events:
            new_events.append(
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
            )
            if mode == "merge":
                existing_events.add(key)

    if new_events:
        db.add_all(new_events)
        
    db.commit()

    # Regenerate occurrences based on updated calendar exceptions starting from semester start
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if semester:
        generate_occurrences(db, semester_id, start_from_date=semester.start_date)

    # Fetch and return the newly saved events
    return db.query(CalendarEvent).filter(CalendarEvent.semester_id == semester_id).all()
