import json
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from app.core.config import settings
from app.services.ai.exceptions import ExtractionError
from app.services.ai.parser_interface import AbstractAIProvider

class GeminiSubject(BaseModel):
    name: str = Field(description="Full name of the subject/course (e.g. Operating Systems)")
    code: Optional[str] = Field(description="Short code of the subject/course if available (e.g. CS301)")
    min_attendance_percent: float = Field(default=75.0, description="Minimum attendance required in percentage (0.0 to 100.0)")

class GeminiTimetableSlot(BaseModel):
    subject_name: str = Field(description="Name of the subject corresponding to this slot")
    subject_code: Optional[str] = Field(description="Subject code corresponding to this slot")
    day_of_week: int = Field(description="Day of week: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday")
    start_time: str = Field(description="Start time of the lecture in 24-hour HH:MM format (e.g. 09:00)")
    end_time: str = Field(description="End time of the lecture in 24-hour HH:MM format (e.g. 10:00)")

class GeminiTimetableExtraction(BaseModel):
    semester_name: str = Field(description="Name of the semester (e.g. Fall 2026, Semester 5)")
    start_date: str = Field(description="Estimated/explicit semester start date in YYYY-MM-DD format")
    end_date: str = Field(description="Estimated/explicit semester end date in YYYY-MM-DD format")
    working_days: List[int] = Field(description="List of working days indices: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday")
    subjects: List[GeminiSubject]
    timetable_slots: List[GeminiTimetableSlot]

class GeminiCalendarEvent(BaseModel):
    title: str = Field(description="Title of the calendar event (e.g. Independence Day, Mid Sem Exams)")
    date: str = Field(description="Start date of the event in YYYY-MM-DD format")
    end_date: Optional[str] = Field(None, description="Optional end date of the event in YYYY-MM-DD format if it spans a range")
    description: Optional[str] = Field(None, description="Optional description of the event")
    subject_code: Optional[str] = Field(None, description="Optional subject/course code if this event is specific to a subject (e.g. CS301)")
    subject_name: Optional[str] = Field(None, description="Optional subject/course name if this event is specific to a subject")
    start_time: Optional[str] = Field(None, description="Optional start time in 24-hour HH:MM format if this is a time-bound assessment")
    end_time: Optional[str] = Field(None, description="Optional end time in 24-hour HH:MM format if this is a time-bound assessment")
    timetable_day_override: Optional[int] = Field(None, description="If this is a working day override (e.g. working Saturday running Monday slots), specify the weekday index to run: 0=Monday, 6=Sunday")

class GeminiCalendarExtraction(BaseModel):
    events: List[GeminiCalendarEvent]

class MockAIProvider(AbstractAIProvider):
    """
    Mock AI Provider implementation for testing the AI pipelines.
    Returns static raw mock structures.
    """
    def extract_timetable(self, file_bytes: bytes, file_type: str) -> Dict[str, Any]:
        return {
            "semester_name": "Semester 5 (Mock)",
            "start_date": "2026-09-01",
            "end_date": "2026-12-15",
            "working_days": [0, 1, 2, 3, 4],
            "subjects": [
                {"name": "Operating Systems", "code": "CS301", "min_attendance_percent": 75.0},
                {"name": "Database Systems", "code": "CS302", "min_attendance_percent": 75.0},
                {"name": "Computer Networks", "code": "CS303", "min_attendance_percent": 75.0}
            ],
            "timetable_slots": [
                {"subject_name": "Operating Systems", "subject_code": "CS301", "day_of_week": 0, "start_time": "09:00", "end_time": "10:00"},
                {"subject_name": "Database Systems", "subject_code": "CS302", "day_of_week": 1, "start_time": "10:00", "end_time": "11:00"},
                {"subject_name": "Computer Networks", "subject_code": "CS303", "day_of_week": 2, "start_time": "11:00", "end_time": "12:00"}
            ]
        }

    def extract_calendar(self, file_bytes: bytes, file_type: str) -> Dict[str, Any]:
        return {
            "events": [
                {
                    "title": "Independence Day Holiday",
                    "date": "2026-08-15",
                    "description": "National Holiday"
                },
                {
                    "title": "OS Mid Semester",
                    "date": "2026-09-20",
                    "subject_code": "CS301",
                    "start_time": "10:00",
                    "end_time": "12:00",
                    "description": "Midterm Exam"
                },
                {
                    "title": "Quiz 1",
                    "date": "2026-10-05",
                    "subject_code": "CS302",
                    "description": "Formative Assessment Quiz"
                }
            ]
        }

class GeminiAIProvider(AbstractAIProvider):
    """
    Concrete Google Gemini AI Provider.
    Calls Gemini API with structured JSON schema response format.
    """
    def __init__(self, api_key: str = settings.GEMINI_API_KEY):
        if not api_key:
            raise ExtractionError("Gemini API key is not configured. Please set GEMINI_API_KEY in your environment.")
        self.client = genai.Client(api_key=api_key)

    def extract_timetable(self, file_bytes: bytes, file_type: str) -> Dict[str, Any]:
        try:
            # Prepare content part from uploaded file bytes
            part = types.Part.from_bytes(
                data=file_bytes,
                mime_type=file_type or "application/pdf"
            )
            
            response = self.client.models.generate_content(
                model='gemini-flash-latest',
                contents=[
                    part,
                    "Extract the semester details, working week, subjects, and weekly timetable slots from this document."
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeminiTimetableExtraction,
                    system_instruction=(
                        "You are an expert academic scheduler assistant. "
                        "Analyze the uploaded timetable document (which could be a PDF or an image) "
                        "and extract: semester name, estimated start and end date (must be YYYY-MM-DD), "
                        "working days list (integers 0-6 where 0=Monday, 4=Friday, 5=Saturday, 6=Sunday), "
                        "subjects (with codes if available), and all timetable slots. "
                        "Times must be formatted in 24-hour HH:MM format."
                    )
                ),
            )
            return json.loads(response.text)
        except Exception as e:
            raise ExtractionError(f"Gemini timetable extraction failed: {str(e)}")

    def extract_calendar(self, file_bytes: bytes, file_type: str) -> Dict[str, Any]:
        try:
            part = types.Part.from_bytes(
                data=file_bytes,
                mime_type=file_type or "application/pdf"
            )
            
            response = self.client.models.generate_content(
                model='gemini-flash-latest',
                contents=[
                    part,
                    "Extract all academic calendar events that affect attendance planning from this document."
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeminiCalendarExtraction,
                    system_instruction=(
                        "You are an expert academic scheduler assistant. "
                        "Analyze the uploaded academic calendar document (PDF or image) "
                        "and extract all events that affect the academic schedule: "
                        "holidays, college closures, mid-semester or sessional tests, end-semester exams, "
                        "exam breaks, working Saturdays, or timetable day overrides. "
                        "Ignore general announcements, guest lectures, sports, workshops, or club events "
                        "unless they explicitly cancel regular lectures. "
                        "Provide dates in YYYY-MM-DD format. Provide times in HH:MM format if available."
                    )
                ),
            )
            return json.loads(response.text)
        except Exception as e:
            raise ExtractionError(f"Gemini calendar extraction failed: {str(e)}")

def get_ai_provider() -> AbstractAIProvider:
    """
    Injection helper returning the active AI provider.
    Returns GeminiAIProvider if GEMINI_API_KEY is configured, else falls back to MockAIProvider.
    """
    if settings.GEMINI_API_KEY:
        try:
            return GeminiAIProvider(settings.GEMINI_API_KEY)
        except Exception:
            return MockAIProvider()
    return MockAIProvider()
