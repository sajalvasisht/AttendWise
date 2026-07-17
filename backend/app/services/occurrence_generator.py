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
    # Note: We delete all occurrences >= start_from_date because we are regenerating them.
    # If the user changed the calendar or timetable, we want to align future occurrences.
    # Past occurrences (before start_from_date) are locked.
    db.query(LectureOccurrence).filter(
        LectureOccurrence.semester_id == semester_id,
        LectureOccurrence.date >= start_from_date
    ).delete()

    # Load slots and calendar events
    slots = db.query(TimetableSlot).filter(TimetableSlot.semester_id == semester_id).all()
    calendar_events = db.query(CalendarEvent).filter(
        CalendarEvent.semester_id == semester_id,
        CalendarEvent.date >= start_from_date
    ).all()

    # Map calendar events by date for fast lookup
    holidays = set()
    working_saturdays = set()

    for event in calendar_events:
        if event.event_type in ("holiday", "exam"):
            holidays.add(event.date)
        elif event.event_type == "working_saturday":
            working_saturdays.add(event.date)

    # Generate occurrences day-by-day
    current_date = start_from_date
    end_date = semester.end_date
    delta = timedelta(days=1)

    new_occurrences = []

    while current_date <= end_date:
        # Check if the date is a holiday or exam day
        if current_date in holidays:
            current_date += delta
            continue

        weekday = current_date.weekday()  # 0 = Monday, 6 = Sunday

        if weekday < 5:  # Monday to Friday
            # Generate lectures for matching slots
            day_slots = [s for s in slots if s.day_of_week == weekday]
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
        elif weekday == 5:  # Saturday
            # Only generate if it is explicitly a working Saturday
            if current_date in working_saturdays:
                day_slots = [s for s in slots if s.day_of_week == 5]
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
