from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List, Any

from sqlalchemy import func
from app.database.session import get_db
from app.models.models import Subject, Semester, User, TimetableSlot
from app.schemas.subject import SubjectCreate, SubjectResponse, SubjectUpdate, SubjectAttendanceSyncRequest
from app.api.deps import get_current_user

from app.services.analytics_service import analytics

router = APIRouter(prefix="/semesters/{semester_id}/subjects", tags=["subjects"])

def verify_semester_owner(semester_id: int, user_id: int, db: Session) -> Semester:
    semester = db.query(Semester).filter(
        Semester.id == semester_id,
        Semester.user_id == user_id
    ).first()
    if not semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semester not found or access denied."
        )
    return semester

def verify_active_semester(semester_id: int, user_id: int, db: Session) -> Semester:
    semester = verify_semester_owner(semester_id, user_id, db)
    if not semester.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify a completed or inactive semester. Previous semesters are read-only."
        )
    return semester

@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    semester_id: int,
    subject_in: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_active_semester(semester_id, current_user.id, db)
    track_attr = subject_in.track_attendance
    if track_attr is None:
        code_upper = (subject_in.code or "").upper()
        name_upper = subject_in.name.upper()
        if "STS" in code_upper or "STS" in name_upper:
            track_attr = False
        else:
            track_attr = True

    earned_units = subject_in.units_earned_per_class
    lost_units = subject_in.units_lost_per_class
    if subject_in.units_per_class != 1:
        if earned_units == 1:
            earned_units = subject_in.units_per_class
        if lost_units == 1:
            lost_units = subject_in.units_per_class

    name_clean = subject_in.name.strip()
    code_clean = subject_in.code.strip() if subject_in.code else None

    # Check if a subject with the same name and code already exists in this semester
    existing_query = db.query(Subject).filter(
        Subject.semester_id == semester_id,
        func.lower(Subject.name) == func.lower(name_clean)
    )
    if code_clean:
        existing_query = existing_query.filter(
            (Subject.code == None) | (func.lower(Subject.code) == func.lower(code_clean))
        )
    existing_subject = existing_query.first()

    if existing_subject:
        # Update existing subject attributes if provided, avoiding duplicate database rows
        if subject_in.faculty:
            existing_subject.faculty = subject_in.faculty
        if subject_in.min_attendance_percent is not None:
            existing_subject.min_attendance_percent = subject_in.min_attendance_percent
        if subject_in.units_per_class is not None:
            existing_subject.units_per_class = subject_in.units_per_class
            existing_subject.units_earned_per_class = earned_units
            existing_subject.units_lost_per_class = lost_units
        if track_attr is not None:
            existing_subject.track_attendance = track_attr
        if subject_in.active_from is not None:
            existing_subject.active_from = subject_in.active_from
        if subject_in.active_until is not None:
            existing_subject.active_until = subject_in.active_until
        if code_clean and not existing_subject.code:
            existing_subject.code = code_clean

        db.commit()
        db.refresh(existing_subject)
        return existing_subject

    db_subject = Subject(
        semester_id=semester_id,
        name=name_clean,
        code=code_clean,
        faculty=subject_in.faculty,
        min_attendance_percent=subject_in.min_attendance_percent,
        units_per_class=subject_in.units_per_class,
        units_earned_per_class=earned_units,
        units_lost_per_class=lost_units,
        track_attendance=track_attr
    )
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    analytics.log_event(
        db=db,
        user=current_user,
        event="SUBJECT_CREATED",
        page="subjects",
        metadata={"subject_name": subject_in.name, "track": track_attr}
    )
    return db_subject


@router.get("", response_model=List[SubjectResponse])
def read_subjects(
    semester_id: int,
    in_timetable_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)
    query = db.query(Subject).filter(Subject.semester_id == semester_id)

    if in_timetable_only:
        query = query.join(
            TimetableSlot, TimetableSlot.subject_id == Subject.id
        ).filter(
            TimetableSlot.semester_id == semester_id
        ).distinct()

    raw_subjects = query.all()

    # Deduplicate subjects in case legacy duplicate rows exist for this semester
    seen_keys = set()
    unique_subjects = []
    for s in raw_subjects:
        key = (s.name.strip().lower(), (s.code or "").strip().lower())
        if key not in seen_keys:
            seen_keys.add(key)
            unique_subjects.append(s)

    return unique_subjects


@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    semester_id: int,
    subject_id: int,
    subject_in: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_active_semester(semester_id, current_user.id, db)
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.semester_id == semester_id
    ).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found"
        )

    for field, value in subject_in.dict(exclude_unset=True).items():
        setattr(subject, field, value)
    
    # Sync earned/lost units if units_per_class was updated
    if "units_per_class" in subject_in.dict(exclude_unset=True):
        subject.units_earned_per_class = subject.units_per_class
        subject.units_lost_per_class = subject.units_per_class
    
    db.commit()
    db.refresh(subject)
    return subject

@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_subject(
    semester_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Response:
    verify_active_semester(semester_id, current_user.id, db)
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.semester_id == semester_id
    ).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found"
        )
    db.delete(subject)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.put("/{subject_id}/sync-attendance", response_model=SubjectResponse)
def sync_subject_attendance(
    semester_id: int,
    subject_id: int,
    sync_in: SubjectAttendanceSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_active_semester(semester_id, current_user.id, db)
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.semester_id == semester_id
    ).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found"
        )
    
    from app.services.attendance_engine import sync_subject_past_occurrences
    sync_subject_past_occurrences(
        db, 
        semester_id, 
        subject.id, 
        sync_in.attended, 
        sync_in.missed
    )
    
    db.refresh(subject)
    return subject

