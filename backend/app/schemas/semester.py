from pydantic import BaseModel
from datetime import date
from typing import Optional

class SemesterBase(BaseModel):
    name: str
    start_date: date
    end_date: date

class SemesterCreate(SemesterBase):
    pass

class SemesterUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class SemesterResponse(SemesterBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
