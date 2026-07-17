from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
from datetime import date

from app.database.session import get_db
from app.models.models import TimetableSlot, Semester, User
from app.schemas.timetable import TimetableSlotCreate, TimetableSlotResponse
from app.api.deps import get_current_user
from app.services.occurrence_generator import generate_occurrences
from app.api.subjects import verify_semester_owner

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)

    # Delete existing slots for the semester to refresh
    db.query(TimetableSlot).filter(TimetableSlot.semester_id == semester_id).delete()

    new_slots = [
        TimetableSlot(
            semester_id=semester_id,
            subject_id=slot.subject_id,
            day_of_week=slot.day_of_week,
            start_time=slot.start_time,
            end_time=slot.end_time
        )
        for slot in slots_in
    ]

    if new_slots:
        db.add_all(new_slots)
        
    db.commit()

    # Regenerate future occurrences based on updated timetable
    generate_occurrences(db, semester_id, start_from_date=date.today())

    # Fetch and return the newly saved slots
    return db.query(TimetableSlot).filter(TimetableSlot.semester_id == semester_id).all()
