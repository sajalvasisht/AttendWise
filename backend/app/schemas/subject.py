from pydantic import BaseModel, Field
from typing import Optional
from datetime import date

class SubjectBase(BaseModel):
    name: str
    code: Optional[str] = None
    faculty: Optional[str] = None
    min_attendance_percent: float = Field(default=75.0, ge=0.0, le=100.0)
    units_per_class: int = Field(default=1, ge=1)
    units_earned_per_class: int = Field(default=1, ge=1)
    units_lost_per_class: int = Field(default=1, ge=1)
    track_attendance: bool = Field(default=True)
    active_from: Optional[date] = None
    active_until: Optional[date] = None

class SubjectCreate(SubjectBase):
    track_attendance: Optional[bool] = None

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    faculty: Optional[str] = None
    min_attendance_percent: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    units_per_class: Optional[int] = Field(default=None, ge=1)
    units_earned_per_class: Optional[int] = Field(default=None, ge=1)
    units_lost_per_class: Optional[int] = Field(default=None, ge=1)
    track_attendance: Optional[bool] = None
    active_from: Optional[date] = None
    active_until: Optional[date] = None

class SubjectResponse(SubjectBase):
    id: int
    semester_id: int

    class Config:
        from_attributes = True

class SubjectAttendanceSyncRequest(BaseModel):
    attended: int = Field(..., ge=0)
    missed: int = Field(..., ge=0)
    delivered: int = Field(..., ge=0)
