from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class CalendarEventBase(BaseModel):
    date: date
    event_type: str = Field(..., description="'holiday', 'working_saturday', 'exam'")
    description: Optional[str] = None

class CalendarEventCreate(CalendarEventBase):
    pass

class CalendarEventResponse(CalendarEventBase):
    id: int
    semester_id: int

    class Config:
        from_attributes = True
