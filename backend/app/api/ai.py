from fastapi import APIRouter, Depends, File, UploadFile, status, HTTPException
from sqlalchemy.orm import Session
from typing import Any

from app.database.session import get_db
from app.models.models import User
from app.api.deps import get_current_user
from app.services.ai.provider import get_ai_provider
from app.services.ai.mapping import map_raw_timetable, map_raw_calendar
from app.services.ai.review_models import ExtractedTimetableReview, ExtractedCalendarReview
from app.services.ai.validators import validate_timetable_review, validate_calendar_review
from app.services.ai.schemas import ValidationResultResponse, ChatMessage, ChatResponse
from app.services.ai.assistant import process_assistant_message
from app.models.models import Semester
from datetime import date

router = APIRouter(prefix="/ai", tags=["ai"])

@router.post("/timetable/extract", response_model=ExtractedTimetableReview)
async def extract_timetable(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Upload a timetable document (PDF, Image, etc.) and extract structured timetable information.
    """
    file_bytes = await file.read()
    provider = get_ai_provider()
    
    try:
        raw_data = provider.extract_timetable(file_bytes, file.content_type or "")
        review_data = map_raw_timetable(raw_data)
        return review_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Timetable extraction failed: {str(e)}"
        )

@router.post("/calendar/extract", response_model=ExtractedCalendarReview)
async def extract_calendar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Upload an academic calendar document (PDF, Image, etc.) and extract calendar exceptions.
    """
    file_bytes = await file.read()
    provider = get_ai_provider()
    
    try:
        raw_data = provider.extract_calendar(file_bytes, file.content_type or "")
        review_data = map_raw_calendar(raw_data)
        return review_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Calendar extraction failed: {str(e)}"
        )

@router.post("/timetable/validate", response_model=ValidationResultResponse)
def validate_timetable(
    review_in: ExtractedTimetableReview,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Dry-run validate a reviewed/edited timetable payload using existing database constraints and schemas.
    """
    errors = validate_timetable_review(review_in)
    return ValidationResultResponse(
        success=len(errors) == 0,
        errors=errors
    )

@router.post("/calendar/validate", response_model=ValidationResultResponse)
def validate_calendar(
    review_in: ExtractedCalendarReview,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Dry-run validate a reviewed/edited calendar payload.
    """
    errors = validate_calendar_review(review_in)
    return ValidationResultResponse(
        success=len(errors) == 0,
        errors=errors
    )

@router.post("/assistant/chat", response_model=ChatResponse)
def assistant_chat(
    chat_in: ChatMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Chat with the AI Leave Assistant. Resolves intent/parameters,
    invokes deterministic planner/attendance services, and formats an actionable reply.
    """
    semester = db.query(Semester).filter(
        Semester.user_id == current_user.id,
        Semester.is_active == True
    ).first()
    if not semester:
        semester = db.query(Semester).filter(
            Semester.user_id == current_user.id
        ).order_by(Semester.created_at.desc()).first()

    if not semester:
        return ChatResponse(
            reply="You haven't configured a semester yet. Please complete the Setup Wizard first so I can assist you with your attendance schedule.",
            intent="unknown",
            clarification_needed=False
        )

    # Resolve relative to server's current date
    current_date = date.today()
    return process_assistant_message(db, semester.id, chat_in.message, current_date)
