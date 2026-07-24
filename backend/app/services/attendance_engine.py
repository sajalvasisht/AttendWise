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
    
    conducted = present + absent + init_conducted
    attended = present + init_attended
    
    if conducted == 0:
        percent = 100.0
    else:
        percent = round((attended / conducted) * 100.0, 2)

    min_percent = subject.min_attendance_percent
    M = min_percent / 100.0

    # Calculate safe bunks (additional lectures that can be missed *currently*)
    # Formula: safe_bunks = floor(attended - M * conducted)
    if conducted == 0:
        safe_bunks = 0
    else:
        safe_bunks = math.floor(attended - M * conducted)
        if safe_bunks < 0:
            safe_bunks = 0

    # Calculate required consecutive classes to attend to reach threshold if currently below it
    required_to_attend = 0
    if percent < min_percent and conducted > 0:
        denominator_diff = 1.0 - M
        if denominator_diff > 0:
            numerator = M * conducted - attended
            required_to_attend = math.ceil(numerator / denominator_diff)
            required_to_attend = max(0, required_to_attend)

    return {
        "subject_id": subject.id,
        "name": subject.name,
        "code": subject.code,
        "faculty": subject.faculty,
        "total_lectures": total,
        "attended": attended,
        "absent": absent + (init_conducted - init_attended),
        "cancelled": cancelled,
        "unmarked": unmarked,
        "conducted": conducted,
        "attendance_percent": percent if is_initialized else 0.0,
        "min_attendance_percent": min_percent,
        "safe_bunks": safe_bunks if is_initialized else 0,
        "required_to_attend": required_to_attend if is_initialized else 0,
        "is_initialized": is_initialized
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
    
    for subject in subjects:
        stats = calculate_subject_statistics(db, semester_id, subject)
        subject_stats.append(stats)
        
        total_lectures += stats["total_lectures"]
        attended += stats["attended"]
        absent += stats["absent"]
        cancelled += stats["cancelled"]
        unmarked += stats["unmarked"]
        conducted += stats["conducted"]

    is_initialized = len(subjects) > 0 and all(stats["is_initialized"] for stats in subject_stats)

    if conducted == 0:
        overall_percent = 100.0
    else:
        overall_percent = round((attended / conducted) * 100.0, 2)

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
