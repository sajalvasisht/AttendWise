from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
from datetime import date, timedelta

from app.database.session import get_db
from app.models.models import User, Semester, Subject, CalendarEvent, PlannedLeave
from app.api.deps import get_current_user
from app.services.attendance_engine import calculate_semester_summary

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("", response_model=List[dict])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    notifications = []
    
    # 1. Fetch active semester
    semester = db.query(Semester).filter(
        Semester.user_id == current_user.id,
        Semester.is_active == True
    ).first()
    
    if not semester:
        # Fallback to check if any semester exists
        any_sem = db.query(Semester).filter(Semester.user_id == current_user.id).first()
        if not any_sem:
            notifications.append({
                "id": "setup-incomplete",
                "type": "warning",
                "title": "Setup Incomplete",
                "description": "Please click here to complete the Setup Wizard and initialize your semester."
            })
            return notifications
        semester = any_sem
    
    # 2. Check if subjects are configured
    subjects = db.query(Subject).filter(Subject.semester_id == semester.id).all()
    if not subjects:
        notifications.append({
            "id": "subjects-empty",
            "type": "warning",
            "title": "No Subjects Configured",
            "description": "You haven't added any subjects for this semester yet. Setup your subjects in Settings."
        })
        return notifications

    # 3. Check low attendance threshold
    summary = calculate_semester_summary(db, semester.id)
    for sub_stat in summary["subjects"]:
        pct = sub_stat["attendance_percent"]
        min_pct = sub_stat["min_attendance_percent"]
        # Only alert if classes have actually been conducted/initialized
        if sub_stat["is_initialized"] and pct < min_pct:
            notifications.append({
                "id": f"low-attendance-{sub_stat['subject_id']}",
                "type": "warning",
                "title": f"Low Attendance: {sub_stat['subject_name']}",
                "description": f"Current attendance is {pct:.1f}%, which is below your target of {min_pct}%."
            })

    # 4. Check calendar events for tomorrow
    tomorrow = date.today() + timedelta(days=1)
    events_tomorrow = db.query(CalendarEvent).filter(
        CalendarEvent.semester_id == semester.id,
        CalendarEvent.date == tomorrow
    ).all()
    
    for event in events_tomorrow:
        if event.event_type.lower() == "exam":
            notifications.append({
                "id": f"exam-tomorrow-{event.id}",
                "type": "error",
                "title": "Exam Tomorrow",
                "description": f"You have a scheduled exam: '{event.description or 'Exam'}' tomorrow."
            })
        elif event.event_type.lower() == "holiday":
            notifications.append({
                "id": f"holiday-tomorrow-{event.id}",
                "type": "success",
                "title": "Holiday Tomorrow 🎉",
                "description": f"Tomorrow is a holiday: '{event.description or 'Holiday'}'."
            })
        elif event.event_type.lower() == "leave":
            notifications.append({
                "id": f"leave-tomorrow-{event.id}",
                "type": "info",
                "title": "Leave Scheduled Tomorrow",
                "description": f"You have marked a personal leave: '{event.description or 'Leave'}' tomorrow."
            })

    # 5. Check planned leaves
    leaves_tomorrow = db.query(PlannedLeave).filter(
        PlannedLeave.semester_id == semester.id,
        PlannedLeave.date == tomorrow
    ).all()
    
    for leave in leaves_tomorrow:
        notifications.append({
            "id": f"planned-leave-tomorrow-{leave.id}",
            "type": "info",
            "title": "Planned Leave Tomorrow",
            "description": f"Reminder: You planned a leave tomorrow for '{leave.reason or 'Personal reason'}'."
        })

    return notifications
