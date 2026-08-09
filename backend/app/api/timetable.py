from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
from datetime import date

from app.database.session import get_db
from app.models.models import TimetableSlot, Semester, User
from app.schemas.timetable import TimetableSlotCreate, TimetableSlotResponse
from app.api.deps import get_current_user
from app.services.occurrence_generator import generate_occurrences
from app.api.subjects import verify_semester_owner, verify_active_semester
from app.services.analytics_service import analytics

router = APIRouter(prefix="/semesters/{semester_id}/timetable", tags=["timetable"])

@router.get("", response_model=List[TimetableSlotResponse])
def read_timetable_slots(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)
    return db.query(TimetableSlot).filter(TimetableSlot.semester_id == semester_id).all()

@router.post("", response_model=List[TimetableSlotResponse])
def save_timetable_slots(
    semester_id: int,
    slots_in: List[TimetableSlotCreate],
    mode: str = "replace",  # "replace" or "merge"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_active_semester(semester_id, current_user.id, db)

    if mode == "replace":
        db.query(TimetableSlot).filter(TimetableSlot.semester_id == semester_id).delete()
        existing_slots = set()
    else:
        existing_list = db.query(TimetableSlot).filter(TimetableSlot.semester_id == semester_id).all()
        existing_slots = {(s.subject_id, s.day_of_week, s.start_time, s.end_time) for s in existing_list}

    new_slots = []
    for slot in slots_in:
        key = (slot.subject_id, slot.day_of_week, slot.start_time, slot.end_time)
        if key not in existing_slots:
            new_slots.append(
                TimetableSlot(
                    semester_id=semester_id,
                    subject_id=slot.subject_id,
                    day_of_week=slot.day_of_week,
                    start_time=slot.start_time,
                    end_time=slot.end_time
                )
            )
            if mode == "merge":
                existing_slots.add(key)

    if new_slots:
        db.add_all(new_slots)
        
    db.commit()

    # Regenerate occurrences based on updated timetable starting from semester start
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if semester:
        generate_occurrences(db, semester_id, start_from_date=semester.start_date)

    # Log timetable import event
    analytics.log_event(db, current_user, "IMPORT_TIMETABLE", page="timetable",
                        meta={"slot_count": len(new_slots), "mode": mode})

    # Fetch and return the newly saved slots
    return db.query(TimetableSlot).filter(TimetableSlot.semester_id == semester_id).all()
