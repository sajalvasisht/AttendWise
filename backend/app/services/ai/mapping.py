import re
from typing import Dict, Any, List
from app.services.ai.review_models import (
    ExtractedTimetableReview,
    ExtractedSubjectReview,
    ExtractedTimetableSlotReview,
    ExtractedCalendarReview,
    ExtractedCalendarEventReview
)

def map_raw_timetable(raw_data: Dict[str, Any]) -> ExtractedTimetableReview:
    """
    Map raw JSON timetable extraction from the provider into the validated Review model.
    """
    raw_subjects = raw_data.get("subjects", [])
    seen_subjects = set()
    subjects = []
    for s in raw_subjects:
        name = (s.get("name") or "").strip()
        code = (s.get("code") or "").strip() if s.get("code") else None
        if not name:
            continue
        key = (name.lower(), (code or "").lower())
        if key not in seen_subjects:
            seen_subjects.add(key)
            subjects.append(
                ExtractedSubjectReview(
                    name=name,
                    code=code,
                    min_attendance_percent=float(s.get("min_attendance_percent", 75.0))
                )
            )

    raw_slots = raw_data.get("timetable_slots", [])
    slots = [
        ExtractedTimetableSlotReview(
            subject_name=sl.get("subject_name", ""),
            subject_code=sl.get("subject_code"),
            day_of_week=int(sl.get("day_of_week", 0)),
            start_time=sl.get("start_time", "09:00"),
            end_time=sl.get("end_time", "10:00")
        )
        for sl in raw_slots
    ]

    return ExtractedTimetableReview(
        semester_name=raw_data.get("semester_name", "New Semester"),
        start_date=raw_data.get("start_date", "2026-09-01"),
        end_date=raw_data.get("end_date", "2026-12-31"),
        working_days=raw_data.get("working_days", [0, 1, 2, 3, 4]),
        subjects=subjects,
        timetable_slots=slots
    )


def map_raw_calendar(raw_data: Dict[str, Any]) -> ExtractedCalendarReview:
    """
    Map raw JSON calendar extraction from the provider into the validated Review model,
    applying deterministic defaults based on title/description keywords.
    """
    raw_events = raw_data.get("events", [])
    events = []

    for ev in raw_events:
        title = ev.get("title", "")
        desc = ev.get("description", "")
        name_lower = f"{title} {desc}".lower()

        # Deterministic default classification
        category = "Other"
        schedule_effect = "KEEP_LECTURES"

        if re.search(r"\b(working|override)\b", name_lower):
            category = "Working Day Override"
            schedule_effect = "OVERRIDE_TIMETABLE"
        elif re.search(r"\b(holiday|vacation|break)\b", name_lower):
            category = "Holiday"
            schedule_effect = "REPLACE_LECTURES"
        elif re.search(r"\b(closure|closed)\b", name_lower):
            category = "College Closure"
            schedule_effect = "REPLACE_LECTURES"
        elif re.search(r"\b(fa|final assessment|ce|continuous evaluation|quiz|quiz day|formative)\b", name_lower):
            category = "Assessment"
            schedule_effect = "KEEP_LECTURES"
        elif re.search(r"\b(st|sessional test|sessional|exam|midterm|mid semester|mid sem|sessional exam)\b", name_lower):
            category = "Assessment"
            schedule_effect = "REPLACE_LECTURES"

        events.append(
            ExtractedCalendarEventReview(
                title=title,
                category=category,
                schedule_effect=schedule_effect,
                date=ev.get("date", "2026-09-01"),
                end_date=ev.get("end_date"),
                subject_name=ev.get("subject_name"),
                subject_code=ev.get("subject_code"),
                start_time=ev.get("start_time"),
                end_time=ev.get("end_time"),
                description=desc,
                timetable_day_override=ev.get("timetable_day_override")
            )
        )

    return ExtractedCalendarReview(events=events)
