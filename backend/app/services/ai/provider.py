from typing import Any, Dict
from app.services.ai.parser_interface import AbstractAIProvider

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

def get_ai_provider() -> AbstractAIProvider:
    """
    Injection helper returning the active AI provider.
    Currently hardcoded to return MockAIProvider for Milestone 8A.
    """
    return MockAIProvider()
