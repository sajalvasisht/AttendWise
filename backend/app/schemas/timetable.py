from pydantic import BaseModel, Field
from datetime import time

class TimetableSlotBase(BaseModel):
    subject_id: int
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: time
    end_time: time

class TimetableSlotCreate(TimetableSlotBase):
    pass

class TimetableSlotResponse(TimetableSlotBase):
    id: int
    semester_id: int

    class Config:
        from_attributes = True
