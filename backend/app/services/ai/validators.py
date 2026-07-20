from datetime import datetime, time, date
from typing import List, Dict, Any, Tuple
from pydantic import ValidationError

from app.schemas.semester import SemesterCreate
from app.schemas.subject import SubjectCreate
from app.schemas.timetable import TimetableSlotCreate
from app.schemas.calendar import CalendarEventCreate
from app.services.ai.review_models import ExtractedTimetableReview, ExtractedCalendarReview

def validate_timetable_review(review: ExtractedTimetableReview) -> List[str]:
    """
    Validate the edited timetable review payload using existing schemas.
    Returns a list of validation error/warning strings.
    """
    errors = []

    # 1. Validate Semester
    try:
        working_days_str = ",".join(map(str, review.working_days))
        SemesterCreate(
            name=review.semester_name,
            start_date=review.start_date,
            end_date=review.end_date,
            working_days=working_days_str
        )
    except ValidationError as e:
        for error in e.errors():
            errors.append(f"Semester: {error['loc'][0]} - {error['msg']}")

    # Date range check
    try:
        start = date.fromisoformat(review.start_date)
        end = date.fromisoformat(review.end_date)
        if start > end:
            errors.append("Semester: Start date must be before or equal to end date.")
    except ValueError:
        errors.append("Semester: Invalid date format. Must be YYYY-MM-DD.")

    # 2. Validate Subjects (Duplicate check)
    seen_names = set()
    seen_codes = set()
    for idx, subj in enumerate(review.subjects):
        try:
            SubjectCreate(
                name=subj.name,
                code=subj.code,
                min_attendance_percent=subj.min_attendance_percent
            )
        except ValidationError as e:
            for error in e.errors():
                errors.append(f"Subject '{subj.name}': {error['loc'][0]} - {error['msg']}")

        name_lower = subj.name.strip().lower()
        if name_lower in seen_names:
            errors.append(f"Subject: Duplicate subject name detected: '{subj.name}'.")
        seen_names.add(name_lower)

        if subj.code:
            code_lower = subj.code.strip().lower()
            if code_lower in seen_codes:
                errors.append(f"Subject: Duplicate subject code detected: '{subj.code}'.")
            seen_codes.add(code_lower)

    # 3. Validate Timetable Slots (Overlap and valid time checks)
    subject_map = {s.name.strip().lower(): s for s in review.subjects}
    subject_code_map = {s.code.strip().lower(): s for s in review.subjects if s.code}

    slot_by_day: Dict[int, List[Tuple[time, time, str]]] = {}

    for idx, slot in enumerate(review.timetable_slots):
        # Resolve subject
        subj_name_lower = slot.subject_name.strip().lower()
        subj_code_lower = slot.subject_code.strip().lower() if slot.subject_code else ""
        
        subject_resolved = subject_map.get(subj_name_lower) or subject_code_map.get(subj_code_lower)
        if not subject_resolved:
            errors.append(f"Timetable Slot {idx+1}: Subject '{slot.subject_name}' is not in the subjects list.")

        # Parse times
        try:
            t_start = time.fromisoformat(slot.start_time)
            t_end = time.fromisoformat(slot.end_time)
            if t_start >= t_end:
                errors.append(f"Timetable Slot {idx+1}: Start time ({slot.start_time}) must be before end time ({slot.end_time}).")
        except ValueError:
            errors.append(f"Timetable Slot {idx+1}: Invalid time format. Must be HH:MM.")
            continue

        # Day of week check
        if slot.day_of_week not in review.working_days:
            errors.append(f"Timetable Slot {idx+1}: Day of week ({slot.day_of_week}) is not in the working days list.")

        # Overlap check
        day = slot.day_of_week
        if day not in slot_by_day:
            slot_by_day[day] = []

        for existing_start, existing_end, existing_sub in slot_by_day[day]:
            # Overlap if: start1 < end2 AND start2 < end1
            if t_start < existing_end and existing_start < t_end:
                errors.append(
                    f"Timetable Slot {idx+1}: Overlaps with another class '{existing_sub}' on day {day}."
                )

        slot_by_day[day].append((t_start, t_end, slot.subject_name))

    return errors

def validate_calendar_review(review: ExtractedCalendarReview, semester_start: Optional[date] = None, semester_end: Optional[date] = None) -> List[str]:
    """
    Validate the edited calendar review payload using existing schemas.
    """
    errors = []

    for idx, ev in enumerate(review.events):
        # Validate Pydantic schema
        try:
            # Map category to event_type for validation schema fallback
            legacy_event_type = "holiday"
            cat_lower = ev.category.lower()
            if "holiday" in cat_lower:
                legacy_event_type = "holiday"
            elif "closure" in cat_lower:
                legacy_event_type = "college_closure"
            elif "override" in cat_lower:
                legacy_event_type = "working_day_override"
            elif "assessment" in cat_lower:
                legacy_event_type = "exam_day"

            t_start = time.fromisoformat(ev.start_time) if ev.start_time else None
            t_end = time.fromisoformat(ev.end_time) if ev.end_time else None

            CalendarEventCreate(
                date=date.fromisoformat(ev.date),
                event_type=legacy_event_type,
                description=ev.description or ev.title,
                timetable_day_override=ev.timetable_day_override,
                start_time=t_start,
                end_time=t_end
            )
        except ValidationError as e:
            for error in e.errors():
                errors.append(f"Event '{ev.title}': {error['loc'][0]} - {error['msg']}")
        except ValueError:
            pass

        # Check date range validity
        try:
            start_dt = date.fromisoformat(ev.date)
            end_dt = date.fromisoformat(ev.end_date) if ev.end_date else start_dt
            if start_dt > end_dt:
                errors.append(f"Event '{ev.title}': Start date must be before or equal to end date.")

            # Validate date is within semester
            if semester_start and start_dt < semester_start:
                errors.append(f"Event '{ev.title}': Date ({ev.date}) is before semester start ({semester_start}).")
            if semester_end and end_dt > semester_end:
                errors.append(f"Event '{ev.title}': Date ({end_dt}) is after semester end ({semester_end}).")
        except ValueError:
            errors.append(f"Event '{ev.title}': Invalid date format.")

        # Check time range
        if ev.start_time and ev.end_time:
            try:
                t_start = time.fromisoformat(ev.start_time)
                t_end = time.fromisoformat(ev.end_time)
                if t_start >= t_end:
                    errors.append(f"Event '{ev.title}': Start time must be before end time.")
            except ValueError:
                errors.append(f"Event '{ev.title}': Invalid time format.")

    return errors
