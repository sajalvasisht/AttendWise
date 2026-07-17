from pydantic import BaseModel, Field
from datetime import date, time
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
