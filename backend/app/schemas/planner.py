from pydantic import BaseModel
from datetime import date, time
from typing import List, Optional

class SimulationRequest(BaseModel):
    semester_id: int
    dates: List[date]

class SubjectProjection(BaseModel):
    subject_id: int
    name: str
    code: Optional[str] = None
    current_percent: float
    projected_percent: float
    current_safe_bunks: int
    projected_safe_bunks: int
    is_safe: bool
    recovery_required: bool
    required_to_attend: int

class OverallProjection(BaseModel):
    current_percent: float
    projected_percent: float
    current_safe_bunks: int
    projected_safe_bunks: int

class MissedLectureInfo(BaseModel):
    subject_name: str
    date: date
    start_time: time
    end_time: time

class SimulationResponse(BaseModel):
    overall: OverallProjection
    subjects: List[SubjectProjection]
    missed_lectures: List[MissedLectureInfo]
    warnings: List[str]

class LeaveSuggestion(BaseModel):
    label: str
    start_date: date
    end_date: date
    dates: List[date]
    missed_classes_count: int
    projected_percent: float
    is_safe: bool

