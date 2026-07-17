from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, List

from app.database.session import get_db
from app.models.models import User
from app.schemas.planner import SimulationRequest, SimulationResponse, LeaveSuggestion
from app.api.deps import get_current_user
from app.api.subjects import verify_semester_owner
from app.services.planner_engine import simulate_leaves, suggest_leaves

router = APIRouter(prefix="/planner", tags=["planner"])

@router.post("/simulate", response_model=SimulationResponse)
def simulate_planned_leave(
    request_in: SimulationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Verify user owns the semester
    verify_semester_owner(request_in.semester_id, current_user.id, db)
    
    # Run the simulation engine
    return simulate_leaves(db, request_in.semester_id, request_in.dates)

@router.get("/suggest", response_model=List[LeaveSuggestion])
def get_leave_suggestions(
    semester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Verify user owns the semester
    verify_semester_owner(semester_id, current_user.id, db)
    
    # Run suggestions generator
    return suggest_leaves(db, semester_id)
