from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import Optional
from app.models.models import Semester, TimetableSlot, CalendarEvent, LectureOccurrence

def generate_occurrences(db: Session, semester_id: int, start_from_date: Optional[date] = None) -> None:
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        return

    # Default to semester start date if no start date is provided (e.g. initial setup)
    if not start_from_date:
        start_from_date = semester.start_date
    else:
        # Don't go before the semester start date
        start_from_date = max(start_from_date, semester.start_date)

    # Make sure we don't try to generate beyond the end of the semester
    if start_from_date > semester.end_date:
        return

    # Delete existing future/unmarked occurrences on or after start_from_date
    db.query(LectureOccurrence).filter(
        LectureOccurrence.semester_id == semester_id,
        LectureOccurrence.date >= start_from_date
    ).delete()

    # Load slots and calendar events
    slots = db.query(TimetableSlot).filter(TimetableSlot.semester_id == semester_id).all()
    calendar_events = db.query(CalendarEvent).filter(
        CalendarEvent.semester_id == semester_id
    ).all()

    # Parse working days
    working_days_str = semester.working_days if semester.working_days else "0,1,2,3,4"
    working_days_set = {int(d) for d in working_days_str.split(",") if d.strip()}

    delta = timedelta(days=1)

    # Map calendar events by date. If it's a range, map every date in the range.
    exceptions_by_date = {}
    for event in calendar_events:
        if event.end_date:
            curr = event.date
            while curr <= event.end_date:
                exceptions_by_date[curr] = event
                curr += delta
        else:
            exceptions_by_date[event.date] = event

    # Generate occurrences day-by-day
    current_date = start_from_date
    end_date = semester.end_date

    new_occurrences = []

    while current_date <= end_date:
        event = exceptions_by_date.get(current_date)
        is_working = False
        timetable_weekday = current_date.weekday()

        if event:
            if event.schedule_effect:
                if event.schedule_effect == "OVERRIDE_TIMETABLE":
                    is_working = True
                    if event.timetable_day_override is not None:
                        timetable_weekday = event.timetable_day_override
                elif event.schedule_effect == "REPLACE_LECTURES":
                    is_working = False
                elif event.schedule_effect == "KEEP_LECTURES":
                    is_working = True
            else:
                # Fallback to event_type for legacy events/backward compatibility
                if event.event_type in ("working_day_override", "working_saturday"):
                    is_working = True
                    if event.timetable_day_override is not None:
                        timetable_weekday = event.timetable_day_override
                elif event.event_type in ("holiday", "college_closure", "exam_break", "exam", "exam_day"):
                    is_working = False
        else:
            if current_date.weekday() in working_days_set:
                is_working = True

        if is_working:
            day_slots = [s for s in slots if s.day_of_week == timetable_weekday]
            for slot in day_slots:
                new_occurrences.append(
                    LectureOccurrence(
                        semester_id=semester_id,
                        subject_id=slot.subject_id,
                        date=current_date,
                        start_time=slot.start_time,
                        end_time=slot.end_time,
                        attendance_status="unmarked"
                    )
                )

        current_date += delta

    if new_occurrences:
        db.add_all(new_occurrences)
        
    db.commit()
