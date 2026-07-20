from pydantic import BaseModel, Field
from datetime import date, time
from typing import Optional
from app.schemas.subject import SubjectResponse

class CalendarEventBase(BaseModel):
    date: date
    event_type: Optional[str] = Field(default="holiday", description="'holiday', 'working_day_override', 'college_closure', 'exam_break', 'working_saturday', 'exam', 'exam_day'")
    description: Optional[str] = None
    timetable_day_override: Optional[int] = None
    subject_id: Optional[int] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    title: Optional[str] = None
    category: Optional[str] = None
    schedule_effect: Optional[str] = None
    end_date: Optional[date] = None

class CalendarEventCreate(CalendarEventBase):
    pass

class CalendarEventResponse(CalendarEventBase):
    id: int
    semester_id: int
    subject: Optional[SubjectResponse] = None

    class Config:
        from_attributes = True
        json_encoders = {
            time: lambda t: t.strftime("%H:%M:%S")
        }
