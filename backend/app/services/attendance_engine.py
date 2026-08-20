from sqlalchemy.orm import Session
from datetime import date
import math
from typing import Dict, Any, List
from app.models.models import Subject, LectureOccurrence, Semester

def calculate_subject_statistics(
    db: Session, 
    semester_id: int, 
    subject: Subject,
    occurrences: Optional[List[LectureOccurrence]] = None,
    as_of_date: Optional[date] = None
) -> Dict[str, Any]:
    """Compute per-subject attendance statistics purely from LectureOccurrence records.
    
    The calendar is the single source of truth. No independent totals are read from
    the Subject model (initial_conducted / initial_attended are always 0 post-sync and
    are intentionally ignored here).
    """
    if occurrences is None:
        occurrences = db.query(LectureOccurrence).filter(
            LectureOccurrence.semester_id == semester_id,
            LectureOccurrence.subject_id == subject.id
        ).all()

    cutoff_date = as_of_date if as_of_date else date.today()
    if occurrences and all(occ.date > cutoff_date for occ in occurrences):
        marked_dates = [occ.date for occ in occurrences if occ.attendance_status != "unmarked"]
        cutoff_date = max(marked_dates) if marked_dates else max(occ.date for occ in occurrences)

    # Occurrences that count towards attendance statistics:
    # 1. Scheduled classes whose date has occurred (date <= cutoff_date)
    # 2. Classes explicitly marked (present, absent, cancelled, etc.), including simulation marks
    valid_occurrences = [occ for occ in occurrences if occ.date <= cutoff_date or occ.attendance_status != "unmarked"]

    total = len(occurrences)
    present = sum(1 for occ in valid_occurrences if occ.attendance_status == "present")
    absent = sum(1 for occ in valid_occurrences if occ.attendance_status == "absent")
    cancelled = sum(1 for occ in valid_occurrences if occ.attendance_status == "cancelled")
    unmarked = sum(1 for occ in valid_occurrences if occ.attendance_status == "unmarked")

    # A subject is considered initialized if valid occurrences exist or marked classes exist
    is_initialized = len(valid_occurrences) > 0 or (present + absent) > 0

    # Weighted Units Calculation
    earned_weight = subject.units_earned_per_class
    lost_weight = subject.units_lost_per_class

    attended_units = present * earned_weight
    absent_units = absent * lost_weight

    # Conducted/delivered: total units of non-cancelled valid occurrences
    conducted_occurrences = [occ for occ in valid_occurrences if occ.attendance_status not in ("cancelled", "holiday")]
    conducted_units = len(conducted_occurrences) * earned_weight

    if conducted_units == 0:
        percent = 100.0
    else:
        percent = round((attended_units / conducted_units) * 100.0, 2)

    min_percent = subject.min_attendance_percent
    M = min_percent / 100.0

    # Calculate safe_bunks_sessions (complete classes that can be missed) and safe_bunks (unit buffer)
    # When missing x complete classes, conducted grows by x * lost_weight:
    # attended / (conducted + x * lost_weight) >= M
    #  => x <= (attended - M * conducted) / (M * lost_weight)
    safe_bunks_sessions = 0
    safe_bunks = 0
    if conducted_units > 0 and M > 0 and lost_weight > 0:
        surplus = attended_units - M * conducted_units
        if surplus > 0:
            safe_bunks_sessions = math.floor(surplus / (M * lost_weight))
            safe_bunks = safe_bunks_sessions * lost_weight

    # Calculate required consecutive classes to attend to reach threshold (expressed in units)
    required_to_attend = 0
    required_sessions = 0
    if percent < min_percent and conducted_units > 0:
        denominator = earned_weight * (1.0 - M)
        if denominator > 0:
            numerator = M * conducted_units - attended_units
            required_classes = math.ceil(numerator / denominator)
            required_to_attend = max(0, required_classes * earned_weight)
            required_sessions = max(0, required_classes)

    return {
        "subject_id": subject.id,
        "name": subject.name,
        "code": subject.code,
        "faculty": subject.faculty,
        "total_lectures": total,
        "attended": attended_units,
        "absent": absent_units,
        "cancelled": cancelled,
        "unmarked": unmarked,
        "conducted": conducted_units,
        "raw_attended": present,
        "raw_absent": absent,
        "raw_conducted": len(conducted_occurrences),
        "attendance_percent": percent if is_initialized else 0.0,
        "min_attendance_percent": min_percent,
        "safe_bunks": safe_bunks if is_initialized else 0,
        "safe_bunks_sessions": safe_bunks_sessions if is_initialized else 0,
        "required_to_attend": required_to_attend if is_initialized else 0,
        "required_sessions": required_sessions if is_initialized else 0,
        "is_initialized": is_initialized,
        "units_per_class": subject.units_per_class,
        "units_earned_per_class": subject.units_earned_per_class,
        "units_lost_per_class": subject.units_lost_per_class
    }


def calculate_semester_summary(db: Session, semester_id: int) -> Dict[str, Any]:
    raw_subjects = db.query(Subject).filter(Subject.semester_id == semester_id, Subject.track_attendance == True).all()
    
    seen_keys = set()
    subjects = []
    for s in raw_subjects:
        key = (s.name.strip().lower(), (s.code or "").strip().lower())
        if key not in seen_keys:
            seen_keys.add(key)
            subjects.append(s)

    # Batch query ALL occurrences for this semester in 1 single DB query (eliminating N+1)
    all_occurrences = db.query(LectureOccurrence).filter(
        LectureOccurrence.semester_id == semester_id
    ).all()
    
    occs_by_subject: Dict[int, List[LectureOccurrence]] = {}
    for occ in all_occurrences:
        if occ.subject_id not in occs_by_subject:
            occs_by_subject[occ.subject_id] = []
        occs_by_subject[occ.subject_id].append(occ)

    subject_stats = []
    total_lectures = 0
    cancelled = 0
    unmarked = 0
    
    for subject in subjects:
        subj_occs = occs_by_subject.get(subject.id, [])
        stats = calculate_subject_statistics(db, semester_id, subject, occurrences=subj_occs)
        subject_stats.append(stats)
        
        total_lectures += stats["total_lectures"]
        cancelled += stats["cancelled"]
        unmarked += stats["unmarked"]
        
    total_attended_units = sum(stats["attended"] for stats in subject_stats)
    total_absent_units = sum(stats["absent"] for stats in subject_stats)
    total_conducted_units = sum(stats["conducted"] for stats in subject_stats)

    # A semester is considered initialized if at least one subject has recorded attendance.
    # Using "any" rather than "all" avoids blocking metrics when some subjects (e.g. labs
    # that start later in the semester) haven't had any classes yet.
    is_initialized = len(subjects) > 0 and any(stats["is_initialized"] for stats in subject_stats)

    if total_conducted_units == 0:
        overall_percent = 100.0
    else:
        overall_percent = round((total_attended_units / total_conducted_units) * 100.0, 2)

    overall_safe_bunks = sum(stats["safe_bunks"] for stats in subject_stats) if is_initialized else 0

    return {
        "overall": {
            "total_lectures": total_lectures,
            "attended": total_attended_units,
            "absent": total_absent_units,
            "cancelled": cancelled,
            "unmarked": unmarked,
            "conducted": total_conducted_units,
            "attendance_percent": overall_percent if is_initialized else 0.0,
            "safe_bunks_budget": overall_safe_bunks,
            "is_initialized": is_initialized
        },
        "subjects": subject_stats
    }

def _build_status_pattern(attended: int, missed: int) -> list:
    """Distribute absences naturally across attended+missed time slots.

    Design goals:
    - No clustering: absences are evenly spaced throughout the history
    - Recency bias: the most recent slots are preferentially kept as present,
      reflecting that students usually remember recent attendance more accurately

    Algorithm:
    1. Reserve the last `recent_protected` slots as present (recency window).
    2. Spread `missed` absences evenly across [0, distribution_end) using
       fixed-step placement, offset by half a step to avoid index-0 clustering.
    3. If distribution window is too small for all absences, expand to full range.

    Returns a list of "present"/"absent" strings of length (attended + missed).
    Remaining past records beyond this length should be left as "unmarked".
    """
    to_conduct = attended + missed
    if to_conduct == 0:
        return []
    if missed == 0:
        return ["present"] * to_conduct
    if attended == 0:
        return ["absent"] * to_conduct

    statuses = ["present"] * to_conduct

    # Recency protection: keep the last N slots as present.
    # Scales with number of attended slots but caps at 25% of total.
    recent_protected = max(1, min(attended // 4, to_conduct // 5))
    distribution_end = to_conduct - recent_protected

    # If absences can't fit in the protected window, expand to full range
    if distribution_end < missed:
        distribution_end = to_conduct

    # Evenly space absence indices across [0, distribution_end).
    # The 0.5-step offset prevents the very first slot from always being absent.
    step = distribution_end / missed
    used: set = set()
    for i in range(missed):
        pos = int(i * step + step * 0.5)
        pos = min(pos, distribution_end - 1)
        # Resolve collision by moving forward (wraps within to_conduct bounds)
        attempts = 0
        while pos in used and attempts < to_conduct:
            pos += 1
            attempts += 1
        if pos < to_conduct:
            used.add(pos)

    for idx in used:
        if idx < to_conduct:
            statuses[idx] = "absent"

    return statuses


def sync_subject_past_occurrences(db: Session, semester_id: int, subject_id: int, attended: int, missed: int) -> None:
    """Reconcile past LectureOccurrence records to match the requested attended/missed totals."""
    from datetime import date, time, timedelta

    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not semester or not subject:
        return

    units_per_class = subject.units_earned_per_class if (subject.units_earned_per_class and subject.units_earned_per_class > 0) else 1
    
    # Calculate occurrence counts from unit values
    total_existing = db.query(LectureOccurrence).filter(
        LectureOccurrence.subject_id == subject.id,
        LectureOccurrence.date <= date.today()
    ).count()

    if (attended + missed) > total_existing and units_per_class > 1:
        attended_classes = math.ceil(attended / units_per_class)
        missed_classes = math.ceil(missed / units_per_class)
    else:
        attended_classes = attended
        missed_classes = missed

    to_conduct = attended_classes + missed_classes

    # Load all occurrences up to today for this subject, ordered oldest → newest
    past_occs = db.query(LectureOccurrence).filter(
        LectureOccurrence.subject_id == subject.id,
        LectureOccurrence.date <= date.today()
    ).order_by(LectureOccurrence.date.asc()).all()

    # Pad with dummy entries if the target delivered count exceeds available records
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
                attendance_status="unmarked",
                is_imported=False
            )
            db.add(new_occ)
        db.flush()
        # Re-query to include the newly added padding records
        past_occs = db.query(LectureOccurrence).filter(
            LectureOccurrence.subject_id == subject.id,
            LectureOccurrence.date <= date.today()
        ).order_by(LectureOccurrence.date.asc()).all()

    # Build the natural distribution pattern for the first `to_conduct` slots
    pattern = _build_status_pattern(attended_classes, missed_classes)

    # Apply statuses in-place with is_imported tagging
    for idx, occ in enumerate(past_occs):
        if idx < len(pattern):
            new_status = pattern[idx]
            occ.attendance_status = new_status
            occ.is_imported = new_status in ("present", "absent")
        else:
            occ.attendance_status = "unmarked"
            occ.is_imported = False

    # Zero out transient staging columns
    subject.initial_conducted = 0
    subject.initial_attended = 0
    db.flush()
