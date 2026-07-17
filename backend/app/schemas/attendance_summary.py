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
    attendance_percent: float
    min_attendance_percent: float
    safe_bunks: int
    required_to_attend: int

class OverallAttendanceStats(BaseModel):
    total_lectures: int
    attended: int
    absent: int
    cancelled: int
    unmarked: int
    conducted: int
    attendance_percent: float
    safe_bunks_budget: int

class SemesterAttendanceSummary(BaseModel):
    overall: OverallAttendanceStats
    subjects: List[SubjectAttendanceStats]
