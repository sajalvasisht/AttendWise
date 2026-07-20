from pydantic import BaseModel
from typing import List, Optional

class ExtractedSubjectReview(BaseModel):
    name: str
    code: Optional[str] = None
    min_attendance_percent: float = 75.0

class ExtractedTimetableSlotReview(BaseModel):
    subject_name: str
    subject_code: Optional[str] = None
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str   # "HH:MM"
    end_time: str     # "HH:MM"

class ExtractedTimetableReview(BaseModel):
    semester_name: str
    start_date: str   # "YYYY-MM-DD"
    end_date: str     # "YYYY-MM-DD"
    working_days: List[int]
    subjects: List[ExtractedSubjectReview]
    timetable_slots: List[ExtractedTimetableSlotReview]

class ExtractedCalendarEventReview(BaseModel):
    title: str
    category: str           # Holiday, Assessment, College Closure, Working Day Override, Other
    schedule_effect: str     # KEEP_LECTURES, REPLACE_LECTURES, OVERRIDE_TIMETABLE
    date: str                # "YYYY-MM-DD"
    end_date: Optional[str] = None  # "YYYY-MM-DD"
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    start_time: Optional[str] = None  # "HH:MM"
    end_time: Optional[str] = None    # "HH:MM"
    description: Optional[str] = None
    timetable_day_override: Optional[int] = None

class ExtractedCalendarReview(BaseModel):
    events: List[ExtractedCalendarEventReview]
