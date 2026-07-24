from pydantic import BaseModel, Field
from datetime import date, time
from typing import List, Optional
from app.schemas.subject import SubjectResponse

class LectureOccurrenceResponse(BaseModel):
    id: int
    semester_id: int
    subject_id: int
    date: date
    start_time: time
    end_time: time
    attendance_status: str
    subject: SubjectResponse

    class Config:
        from_attributes = True

class AttendanceUpdate(BaseModel):
    status: str = Field(..., description="'present', 'absent', 'cancelled', 'unmarked'")

class UpcomingDaySchedule(BaseModel):
    date: date
    day_label: str
    event_type: Optional[str] = None
    description: Optional[str] = None
    occurrences: List[LectureOccurrenceResponse]

    class Config:
        from_attributes = True

class SubjectInitialization(BaseModel):
    subject_id: int
    initial_conducted: int = Field(..., ge=0)
    initial_attended: int = Field(..., ge=0)

class AttendanceInitializationRequest(BaseModel):
    initializations: List[SubjectInitialization]
