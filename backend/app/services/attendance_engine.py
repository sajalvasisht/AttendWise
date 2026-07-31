from sqlalchemy.orm import Session
from datetime import date
import math
from typing import Dict, Any, List
from app.models.models import Subject, LectureOccurrence, Semester

def calculate_subject_statistics(db: Session, semester_id: int, subject: Subject) -> Dict[str, Any]:
    occurrences = db.query(LectureOccurrence).filter(
        LectureOccurrence.semester_id == semester_id,
        LectureOccurrence.subject_id == subject.id
    ).all()

    total = len(occurrences)
    present = sum(1 for occ in occurrences if occ.attendance_status == "present")
    absent = sum(1 for occ in occurrences if occ.attendance_status == "absent")
    cancelled = sum(1 for occ in occurrences if occ.attendance_status == "cancelled")
    unmarked = sum(1 for occ in occurrences if occ.attendance_status == "unmarked")
    
    init_conducted = subject.initial_conducted if subject.initial_conducted is not None else 0
    init_attended = subject.initial_attended if subject.initial_attended is not None else 0
    is_initialized = (subject.initial_conducted is not None) or (present + absent > 0)
    
    # Weighted Units Calculation
    earned_weight = subject.units_earned_per_class
    lost_weight = subject.units_lost_per_class
    
    attended_units = (present * earned_weight) + (init_attended * earned_weight)
    absent_units = (absent * lost_weight) + ((init_conducted - init_attended) * lost_weight)
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
        "attended": present + init_attended, # Return raw counts for UI displays
        "absent": absent + (init_conducted - init_attended),
        "cancelled": cancelled,
        "unmarked": unmarked,
        "conducted": present + absent + init_conducted,
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
    subjects = db.query(Subject).filter(Subject.semester_id == semester_id).all()
    
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

    is_initialized = len(subjects) > 0 and all(stats["is_initialized"] for stats in subject_stats)

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
