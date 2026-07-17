from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List, Any

from app.database.session import get_db
from app.models.models import Subject, Semester, User
from app.schemas.subject import SubjectCreate, SubjectResponse, SubjectUpdate
from app.api.deps import get_current_user

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

@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    semester_id: int,
    subject_in: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)
    db_subject = Subject(
        semester_id=semester_id,
        name=subject_in.name,
        code=subject_in.code,
        faculty=subject_in.faculty,
        min_attendance_percent=subject_in.min_attendance_percent
    )
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject

@router.get("", response_model=List[SubjectResponse])
def read_subjects(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)
    return db.query(Subject).filter(Subject.semester_id == semester_id).all()

@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    semester_id: int,
    subject_id: int,
    subject_in: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    verify_semester_owner(semester_id, current_user.id, db)
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
    verify_semester_owner(semester_id, current_user.id, db)
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
