from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import Dict, Any, List
from app.models.models import Semester, Subject, LectureOccurrence, CalendarEvent
from app.services.attendance_engine import calculate_semester_summary

def simulate_leaves(db: Session, semester_id: int, dates: List[date]) -> Dict[str, Any]:
    # Start a nested transaction (savepoint) to protect the DB from permanent changes
    savepoint = db.begin_nested()
    
    try:
        # 1. Calculate current attendance statistics
        current_summary = calculate_semester_summary(db, semester_id)
        
        # 2. Find occurrences on the simulated leave dates
        target_occurrences = db.query(LectureOccurrence).filter(
            LectureOccurrence.semester_id == semester_id,
            LectureOccurrence.date.in_(dates)
        ).order_by(LectureOccurrence.date, LectureOccurrence.start_time).all()
        
        missed_lectures = []
        
        # 3. Simulate absences for occurrences on these dates
        for occ in target_occurrences:
            # Only count as missed if it was present or unmarked (i.e. classes that are scheduled to run)
            # If already marked absent, it's not a new miss. If cancelled, it's not conducted.
            if occ.attendance_status not in ("cancelled", "absent"):
                missed_lectures.append({
                    "subject_name": occ.subject.name,
                    "date": occ.date,
                    "start_time": occ.start_time,
                    "end_time": occ.end_time
                })
                
                # Update status in session memory
                occ.attendance_status = "absent"

        # If we updated occurrences, flush them to the session so subsequent queries see them
        db.flush()

        # 4. Calculate projected statistics over the dirty session state
        projected_summary = calculate_semester_summary(db, semester_id)
        
    finally:
        # 5. ALWAYS rollback to ensure no changes are saved to the database
        savepoint.rollback()

    # 6. Map and compare overall stats
    curr_overall = current_summary["overall"]
    proj_overall = projected_summary["overall"]
    
    overall_projection = {
        "current_percent": curr_overall["attendance_percent"],
        "projected_percent": proj_overall["attendance_percent"],
        "current_safe_bunks": curr_overall["safe_bunks_budget"],
        "projected_safe_bunks": proj_overall["safe_bunks_budget"]
    }

    # 7. Map and compare subject stats
    subjects_projections = []
    warnings = []
    
    curr_subjects = {s["subject_id"]: s for s in current_summary["subjects"]}
    proj_subjects = {s["subject_id"]: s for s in projected_summary["subjects"]}
    
    for subj_id, curr_subj in curr_subjects.items():
        proj_subj = proj_subjects[subj_id]
        
        is_safe = proj_subj["attendance_percent"] >= curr_subj["min_attendance_percent"]
        recovery_required = not is_safe
        
        subjects_projections.append({
            "subject_id": subj_id,
            "name": curr_subj["name"],
            "code": curr_subj["code"],
            "current_percent": curr_subj["attendance_percent"],
            "projected_percent": proj_subj["attendance_percent"],
            "current_safe_bunks": curr_subj["safe_bunks"],
            "projected_safe_bunks": proj_subj["safe_bunks"],
            "is_safe": is_safe,
            "recovery_required": recovery_required,
            "required_to_attend": proj_subj["required_to_attend"]
        })
        
        # Add warning if it falls below the minimum requirement after the simulation
        if curr_subj["attendance_percent"] >= curr_subj["min_attendance_percent"] and not is_safe:
            warnings.append(
                f"Subject '{curr_subj['name']}' would drop below its minimum attendance of {curr_subj['min_attendance_percent']}%."
            )

    return {
        "overall": overall_projection,
        "subjects": subjects_projections,
        "missed_lectures": missed_lectures,
        "warnings": warnings
    }

def suggest_leaves(db: Session, semester_id: int) -> List[Dict[str, Any]]:
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if not semester:
        return []

    today_val = date.today()
    start_search = max(today_val, semester.start_date)
    end_search = semester.end_date

    if start_search >= end_search:
        return []

    candidate_windows = []

    def get_next_weekday(d: date, weekday: int) -> date:
        days_ahead = weekday - d.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        return d + timedelta(days=days_ahead)

    # 1. Next Friday off
    next_friday = get_next_weekday(start_search, 4)
    if start_search <= next_friday <= end_search:
        candidate_windows.append({
            "label": "Long Weekend (Friday Off)",
            "dates": [next_friday]
        })

    # 2. Next Monday off
    next_monday = get_next_weekday(start_search, 0)
    if start_search <= next_monday <= end_search:
        candidate_windows.append({
            "label": "Long Weekend (Monday Off)",
            "dates": [next_monday]
        })

    # 3. Next Friday + Monday off
    if start_search <= next_friday <= end_search and start_search <= next_monday <= end_search:
        if abs((next_monday - next_friday).days) <= 3:
            candidate_windows.append({
                "label": "Mega Weekend Bridge (Friday & Monday Off)",
                "dates": [next_friday, next_monday]
            })

    # 4. Holiday Bridges
    holidays = db.query(CalendarEvent).filter(
        CalendarEvent.semester_id == semester_id,
        CalendarEvent.date >= start_search,
        CalendarEvent.date <= end_search,
        CalendarEvent.event_type == "holiday"
    ).all()

    for h in holidays:
        if h.date.weekday() == 3:
            fri = h.date + timedelta(days=1)
            if start_search <= fri <= end_search:
                candidate_windows.append({
                    "label": f"Holiday Extension ({h.description or 'Holiday'} - Friday Off)",
                    "dates": [fri]
                })
        elif h.date.weekday() == 1:
            mon = h.date - timedelta(days=1)
            if start_search <= mon <= end_search:
                candidate_windows.append({
                    "label": f"Holiday Extension ({h.description or 'Holiday'} - Monday Off)",
                    "dates": [mon]
                })
        elif h.date.weekday() == 2:
            thu = h.date + timedelta(days=1)
            fri = h.date + timedelta(days=2)
            dates_list = []
            if start_search <= thu <= end_search:
                dates_list.append(thu)
            if start_search <= fri <= end_search:
                dates_list.append(fri)
            if dates_list:
                candidate_windows.append({
                    "label": f"Holiday Mid-Week Bridge ({h.description or 'Holiday'} - Thu & Fri Off)",
                    "dates": dates_list
                })

    unique_windows = []
    seen = set()
    for w in candidate_windows:
        dates_tuple = tuple(sorted(w["dates"]))
        if dates_tuple not in seen:
            seen.add(dates_tuple)
            unique_windows.append(w)

    suggestions = []
    for w in unique_windows:
        sim_res = simulate_leaves(db, semester_id, w["dates"])
        is_safe = all(not s["recovery_required"] for s in sim_res["subjects"])
        
        suggestions.append({
            "label": w["label"],
            "start_date": min(w["dates"]),
            "end_date": max(w["dates"]),
            "dates": w["dates"],
            "missed_classes_count": len(sim_res["missed_lectures"]),
            "projected_percent": sim_res["overall"]["projected_percent"],
            "is_safe": is_safe
        })

    suggestions.sort(key=lambda s: (not s["is_safe"], len(s["dates"])))
    return suggestions[:5]
