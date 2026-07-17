from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any, Optional
from datetime import date

from app.database.session import get_db
from app.models.models import LectureOccurrence, User
from app.schemas.attendance import LectureOccurrenceResponse, AttendanceUpdate
from app.api.deps import get_current_user
from app.api.subjects import verify_semester_owner
from app.schemas.attendance_summary import OverallAttendanceStats, SubjectAttendanceStats
from app.services.attendance_engine import calculate_semester_summary

router = APIRouter(prefix="/semesters/{semester_id}/attendance", tags=["attendance"])

@router.get("", response_model=List[LectureOccurrenceResponse])
def read_lecture_occurrences(
    semester_id: int,
    date_query: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # We will verify ownership of the semester
    verify_semester_owner(semester_id, current_user.id, db)
    
    target_date = date_query if date_query else date.today()
    
    # Query occurrences for the specific date
    return db.query(LectureOccurrence).filter(
        LectureOccurrence.semester_id == semester_id,
        LectureOccurrence.date == target_date
    ).order_by(LectureOccurrence.start_time).all()

@router.get("/today", response_model=List[LectureOccurrenceResponse])
def read_today_occurrences(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)
    
    today_date = date.today()
    return db.query(LectureOccurrence).filter(
        LectureOccurrence.semester_id == semester_id,
        LectureOccurrence.date == today_date
    ).order_by(LectureOccurrence.start_time).all()

@router.put("/{occurrence_id}", response_model=LectureOccurrenceResponse)
def update_occurrence_status(
    semester_id: int,
    occurrence_id: int,
    attendance_in: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)
    
    occurrence = db.query(LectureOccurrence).filter(
        LectureOccurrence.id == occurrence_id,
        LectureOccurrence.semester_id == semester_id
    ).first()
    
    if not occurrence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lecture occurrence not found"
        )
        
    valid_statuses = {"unmarked", "present", "absent", "cancelled"}
    status_lower = attendance_in.status.lower()
    if status_lower not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of {valid_statuses}"
        )
        
    occurrence.attendance_status = status_lower
    db.commit()
    db.refresh(occurrence)
    return occurrence

@router.get("/summary", response_model=OverallAttendanceStats)
def read_attendance_summary(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)
    summary = calculate_semester_summary(db, semester_id)
    return summary["overall"]

@router.get("/subjects", response_model=List[SubjectAttendanceStats])
def read_subjects_attendance(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)
    summary = calculate_semester_summary(db, semester_id)
    return summary["subjects"]
