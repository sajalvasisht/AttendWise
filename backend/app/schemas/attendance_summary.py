from pydantic import BaseModel
from typing import Optional, List

class SubjectAttendanceStats(BaseModel):
    subject_id: int
    name: str
    code: Optional[str] = None
    faculty: Optional[str] = None
    total_lectures: int
    attended: int
    absent: int
    cancelled: int
    unmarked: int
    conducted: int
    raw_attended: int = 0
    raw_absent: int = 0
    raw_conducted: int = 0
    attendance_percent: float
    min_attendance_percent: float
    safe_bunks: int
    required_to_attend: int
    is_initialized: bool = True
    units_per_class: int = 1
    units_earned_per_class: int = 1
    units_lost_per_class: int = 1

class OverallAttendanceStats(BaseModel):
    total_lectures: int
    attended: int
    absent: int
    cancelled: int
    unmarked: int
    conducted: int
    attendance_percent: float
    safe_bunks_budget: int
    is_initialized: bool = True

class SemesterAttendanceSummary(BaseModel):
    overall: OverallAttendanceStats
    subjects: List[SubjectAttendanceStats]
