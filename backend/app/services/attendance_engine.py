from sqlalchemy.orm import Session
from datetime import date
import math
from typing import Dict, Any, List
from app.models.models import Subject, LectureOccurrence, Semester

def calculate_subject_statistics(db: Session, semester_id: int, subject: Subject) -> Dict[str, Any]:
    """Compute per-subject attendance statistics purely from LectureOccurrence records.
    
    The calendar is the single source of truth. No independent totals are read from
    the Subject model (initial_conducted / initial_attended are always 0 post-sync and
    are intentionally ignored here).
    """
    occurrences = db.query(LectureOccurrence).filter(
        LectureOccurrence.semester_id == semester_id,
        LectureOccurrence.subject_id == subject.id
    ).all()

    total = len(occurrences)
    present = sum(1 for occ in occurrences if occ.attendance_status == "present")
    absent = sum(1 for occ in occurrences if occ.attendance_status == "absent")
    cancelled = sum(1 for occ in occurrences if occ.attendance_status == "cancelled")
    unmarked = sum(1 for occ in occurrences if occ.attendance_status == "unmarked")

    # A subject is considered initialized once at least one class has been marked
    # (present or absent). This is purely calendar-driven — no column flags needed.
    is_initialized = (present + absent) > 0

    # Weighted Units Calculation — derived entirely from LectureOccurrence statuses
    earned_weight = subject.units_earned_per_class
    lost_weight = subject.units_lost_per_class

    attended_units = present * earned_weight
    absent_units = absent * lost_weight
    conducted_units = attended_units + absent_units

    if conducted_units == 0:
        percent = 100.0
    else:
        percent = round((attended_units / conducted_units) * 100.0, 2)

    min_percent = subject.min_attendance_percent
    M = min_percent / 100.0

    # Calculate safe bunks (in attendance units)
    if conducted_units == 0:
        safe_bunks = 0
    else:
        safe_bunks_units = attended_units - M * conducted_units
        safe_bunks = math.floor(safe_bunks_units)
        if safe_bunks < 0:
            safe_bunks = 0

    # Calculate required consecutive classes to attend to reach threshold (expressed in units)
    required_to_attend = 0
    if percent < min_percent and conducted_units > 0:
        denominator = earned_weight * (1.0 - M)
        if denominator > 0:
            numerator = M * conducted_units - attended_units
            required_classes = math.ceil(numerator / denominator)
            required_to_attend = max(0, required_classes * earned_weight)

    return {
        "subject_id": subject.id,
        "name": subject.name,
        "code": subject.code,
        "faculty": subject.faculty,
        "total_lectures": total,
        "attended": present,
        "absent": absent,
        "cancelled": cancelled,
        "unmarked": unmarked,
        "conducted": present + absent,
        "attendance_percent": percent if is_initialized else 0.0,
        "min_attendance_percent": min_percent,
        "safe_bunks": safe_bunks if is_initialized else 0,
        "required_to_attend": required_to_attend if is_initialized else 0,
        "is_initialized": is_initialized,
        "units_per_class": subject.units_per_class,
        "units_earned_per_class": subject.units_earned_per_class,
        "units_lost_per_class": subject.units_lost_per_class
    }

def calculate_semester_summary(db: Session, semester_id: int) -> Dict[str, Any]:
    subjects = db.query(Subject).filter(Subject.semester_id == semester_id, Subject.track_attendance == True).all()
    
    subject_stats = []
    total_lectures = 0
    attended = 0
    absent = 0
    cancelled = 0
    unmarked = 0
    conducted = 0
    
    conducted_units = 0
    attended_units = 0
    
    for subject in subjects:
        stats = calculate_subject_statistics(db, semester_id, subject)
        subject_stats.append(stats)
        
        total_lectures += stats["total_lectures"]
        attended += stats["attended"]
        absent += stats["absent"]
        cancelled += stats["cancelled"]
        unmarked += stats["unmarked"]
        conducted += stats["conducted"]
        
        conducted_units += stats["attended"] * subject.units_earned_per_class + stats["absent"] * subject.units_lost_per_class
        attended_units += stats["attended"] * subject.units_earned_per_class

    # A semester is considered initialized if at least one subject has recorded attendance.
    # Using "any" rather than "all" avoids blocking metrics when some subjects (e.g. labs
    # that start later in the semester) haven't had any classes yet.
    is_initialized = len(subjects) > 0 and any(stats["is_initialized"] for stats in subject_stats)


    if conducted_units == 0:
        overall_percent = 100.0
    else:
        overall_percent = round((attended_units / conducted_units) * 100.0, 2)

    overall_safe_bunks = sum(stats["safe_bunks"] for stats in subject_stats) if is_initialized else 0

    return {
        "overall": {
            "total_lectures": total_lectures,
            "attended": attended,
            "absent": absent,
            "cancelled": cancelled,
            "unmarked": unmarked,
            "conducted": conducted,
            "attendance_percent": overall_percent if is_initialized else 0.0,
            "safe_bunks_budget": overall_safe_bunks,
            "is_initialized": is_initialized
        },
        "subjects": subject_stats
    }

def sync_subject_past_occurrences(db: Session, semester_id: int, subject_id: int, attended: int, missed: int) -> None:
    """Reconcile past LectureOccurrence records to match the requested attended/missed totals.

    Non-destructive approach: existing records are updated in-place rather than deleted
    and recreated. Dummy records are only added when the target delivered count exceeds
    the number of timetable-generated records available. This preserves any manually
    set per-day attendance markings where possible.

    Algorithm:
      1. Ensure enough past records exist (add dummies if needed).
      2. Assign statuses to past records in date order:
         - First `attended` records → "present"
         - Next `missed` records  → "absent"
         - Remaining             → "unmarked"
      3. Zero out the now-obsolete initial_conducted/initial_attended staging fields.
    """
    from datetime import date, time, timedelta

    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not semester or not subject:
        return

    to_conduct = attended + missed

    # Load all past occurrences for this subject, ordered chronologically
    past_occs = db.query(LectureOccurrence).filter(
        LectureOccurrence.subject_id == subject.id,
        LectureOccurrence.date < date.today()
    ).order_by(LectureOccurrence.date.asc()).all()

    # If the target delivered count exceeds available records, pad with dummy entries
    diff = to_conduct - len(past_occs)
    if diff > 0:
        ref_date = subject.active_from or semester.start_date
        if ref_date >= date.today():
            ref_date = date.today() - timedelta(days=1)
        for _ in range(diff):
            new_occ = LectureOccurrence(
                semester_id=semester_id,
                subject_id=subject.id,
                date=ref_date,
                start_time=time(9, 0),
                end_time=time(10, 0),
                attendance_status="unmarked"
            )
            db.add(new_occ)
        db.commit()
        # Re-query to include the newly added padding records
        past_occs = db.query(LectureOccurrence).filter(
            LectureOccurrence.subject_id == subject.id,
            LectureOccurrence.date < date.today()
        ).order_by(LectureOccurrence.date.asc()).all()

    # Assign statuses in-place: first `attended` → present, next `missed` → absent, rest → unmarked
    for idx, occ in enumerate(past_occs):
        if idx < attended:
            occ.attendance_status = "present"
        elif idx < to_conduct:
            occ.attendance_status = "absent"
        else:
            occ.attendance_status = "unmarked"

    # Zero out the transient staging columns — the calendar is now the only source of truth
    subject.initial_conducted = 0
    subject.initial_attended = 0
    db.commit()

