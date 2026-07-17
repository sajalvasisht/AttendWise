from pydantic import BaseModel, Field
from typing import Optional

class SubjectBase(BaseModel):
    name: str
    code: Optional[str] = None
    faculty: Optional[str] = None
    min_attendance_percent: float = Field(default=75.0, ge=0.0, le=100.0)

class SubjectCreate(SubjectBase):
    pass

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    faculty: Optional[str] = None
    min_attendance_percent: Optional[float] = Field(default=None, ge=0.0, le=100.0)

class SubjectResponse(SubjectBase):
    id: int
    semester_id: int

    class Config:
        from_attributes = True
