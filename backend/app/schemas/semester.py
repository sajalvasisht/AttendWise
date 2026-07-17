from pydantic import BaseModel
from datetime import date
from typing import Optional

class SemesterBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    working_days: str = "0,1,2,3,4"

class SemesterCreate(SemesterBase):
    pass

class SemesterUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    working_days: Optional[str] = None

class SemesterResponse(SemesterBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
