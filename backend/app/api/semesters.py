from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List, Any
from datetime import date

from app.database.session import get_db
from app.models.models import Semester, User
from app.schemas.semester import SemesterCreate, SemesterResponse, SemesterUpdate
from app.api.deps import get_current_user
from app.services.occurrence_generator import generate_occurrences

router = APIRouter(prefix="/semesters", tags=["semesters"])

@router.post("", response_model=SemesterResponse, status_code=status.HTTP_201_CREATED)
def create_semester(
    semester_in: SemesterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Deactivate all other semesters for the user
    db.query(Semester).filter(Semester.user_id == current_user.id).update({"is_active": False})

    db_semester = Semester(
        user_id=current_user.id,
        name=semester_in.name,
        start_date=semester_in.start_date,
        end_date=semester_in.end_date,
        working_days=semester_in.working_days,
        is_active=True
    )
    db.add(db_semester)
    db.commit()
    db.refresh(db_semester)
    return db_semester

@router.get("", response_model=List[SemesterResponse])
def read_semesters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    return db.query(Semester).filter(Semester.user_id == current_user.id).all()
@router.get("/active", response_model=SemesterResponse)
def read_active_semester(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    semester = db.query(Semester).filter(
        Semester.user_id == current_user.id,
        Semester.is_active == True
    ).first()
    if not semester:
        semester = db.query(Semester).filter(
            Semester.user_id == current_user.id
        ).order_by(Semester.created_at.desc()).first()

    if not semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active semester found"
        )
    return semester
@router.get("/{semester_id}", response_model=SemesterResponse)
def read_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    semester = db.query(Semester).filter(
        Semester.id == semester_id,
        Semester.user_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semester not found"
        )
    return semester

@router.put("/{semester_id}", response_model=SemesterResponse)
def update_semester(
    semester_id: int,
    semester_in: SemesterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    semester = db.query(Semester).filter(
        Semester.id == semester_id,
        Semester.user_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semester not found"
        )

    for field, value in semester_in.dict(exclude_unset=True).items():
        setattr(semester, field, value)
    
    db.commit()
    db.refresh(semester)
    
    # Regenerate future occurrences in case dates changed
    generate_occurrences(db, semester_id, start_from_date=date.today())
    
    return semester

@router.delete("/{semester_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Response:
    semester = db.query(Semester).filter(
        Semester.id == semester_id,
        Semester.user_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semester not found"
        )
    db.delete(semester)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/{semester_id}/activate", response_model=SemesterResponse)
def activate_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Verify semester exists
    semester = db.query(Semester).filter(
        Semester.id == semester_id,
        Semester.user_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Semester not found"
        )

    # Deactivate all other semesters
    db.query(Semester).filter(Semester.user_id == current_user.id).update({"is_active": False})

    # Activate selected
    semester.is_active = True
    db.commit()
    db.refresh(semester)
    return semester
