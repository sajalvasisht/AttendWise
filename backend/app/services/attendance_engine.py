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
    
    conducted = present + absent
    
    if conducted == 0:
        percent = 100.0
    else:
        percent = round((present / conducted) * 100.0, 2)

    min_percent = subject.min_attendance_percent
    M = min_percent / 100.0

    # Calculate safe bunks (additional lectures that can be missed)
    # Formula: safe_bunks = floor(present + unmarked - M * (conducted + unmarked))
    safe_bunks = math.floor(present + unmarked - M * (conducted + unmarked))
    if safe_bunks < 0:
        safe_bunks = 0

    # Calculate required consecutive classes to attend to reach threshold if currently below it
    required_to_attend = 0
    if percent < min_percent:
        denominator_diff = 1.0 - M
        if denominator_diff > 0:
            numerator = M * conducted - present
            required_to_attend = math.ceil(numerator / denominator_diff)
            # Ensure it is at least 0
            required_to_attend = max(0, required_to_attend)

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
        "conducted": conducted,
        "attendance_percent": percent,
        "min_attendance_percent": min_percent,
        "safe_bunks": safe_bunks,
        "required_to_attend": required_to_attend
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

    if conducted == 0:
        overall_percent = 100.0
    else:
        overall_percent = round((attended / conducted) * 100.0, 2)

    # Overall attendance budget is the sum of safe bunks for each subject
    overall_safe_bunks = sum(stats["safe_bunks"] for stats in subject_stats)

    return {
        "overall": {
            "total_lectures": total_lectures,
            "attended": attended,
            "absent": absent,
            "cancelled": cancelled,
            "unmarked": unmarked,
            "conducted": conducted,
            "attendance_percent": overall_percent,
            "safe_bunks_budget": overall_safe_bunks
        },
        "subjects": subject_stats
    }
