import pytest
from datetime import date, time, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.models.models import User, Semester, Subject, LectureOccurrence, CalendarEvent, TimetableSlot
from app.services.attendance_engine import calculate_semester_summary
from app.services.planner_engine import simulate_leaves
from app.core.security import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(name="db_session")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_upcoming_schedule_endpoint(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    semester = Semester(
        user_id=user.id,
        name="Upcoming Term",
        start_date=date.today() - timedelta(days=5),
        end_date=date.today() + timedelta(days=10),
        working_days="0,1,2,3,4"
    )
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Networks", code="CS202")
    db_session.add(subject)
    db_session.commit()

    tomorrow_date = date.today() + timedelta(days=1)
    occ = LectureOccurrence(
        semester_id=semester.id,
        subject_id=subject.id,
        date=tomorrow_date,
        start_time=time(9,0),
        end_time=time(10,0),
        attendance_status="unmarked"
    )
    db_session.add(occ)
    db_session.commit()

    working_days_str = semester.working_days if semester.working_days else "0,1,2,3,4"
    working_days_set = {int(d) for d in working_days_str.split(",") if d.strip()}
    
    today_val = date.today()
    upcoming_days = []
    
    for i in range(1, 4):
        target_date = today_val + timedelta(days=i)
        
        if i == 1:
            day_label = "Tomorrow"
        else:
            day_label = target_date.strftime("%A")
            
        event = db_session.query(CalendarEvent).filter(
            CalendarEvent.semester_id == semester.id,
            CalendarEvent.date == target_date
        ).first()
        
        event_type = None
        description = None
        
        if event:
            event_type = event.event_type
            description = event.description
        else:
            weekday_idx = target_date.weekday()
            if weekday_idx not in working_days_set:
                event_type = "weekend"
                description = "Weekend"
                
        occurrences = db_session.query(LectureOccurrence).filter(
            LectureOccurrence.semester_id == semester.id,
            LectureOccurrence.date == target_date
        ).order_by(LectureOccurrence.start_time).all()
        
        upcoming_days.append({
            "date": target_date,
            "day_label": day_label,
            "event_type": event_type,
            "description": description,
            "occurrences": occurrences
        })

    assert len(upcoming_days) == 3
    assert upcoming_days[0]["day_label"] == "Tomorrow"
    assert len(upcoming_days[0]["occurrences"]) == 1
    assert upcoming_days[0]["occurrences"][0].subject_id == subject.id

def test_planner_timeline_mapping(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    semester = Semester(
        user_id=user.id,
        name="Timeline Term",
        start_date=date.today() - timedelta(days=5),
        end_date=date.today() + timedelta(days=10),
        working_days="0,1,2,3,4"
    )
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Database", code="CS303")
    db_session.add(subject)
    db_session.commit()

    future_date_1 = date.today() + timedelta(days=2)
    future_date_2 = date.today() + timedelta(days=4)

    occ1 = LectureOccurrence(
        semester_id=semester.id,
        subject_id=subject.id,
        date=future_date_1,
        start_time=time(10,0),
        end_time=time(11,0),
        attendance_status="unmarked"
    )
    occ2 = LectureOccurrence(
        semester_id=semester.id,
        subject_id=subject.id,
        date=future_date_2,
        start_time=time(11,0),
        end_time=time(12,0),
        attendance_status="unmarked"
    )
    db_session.add_all([occ1, occ2])
    db_session.commit()

    sim_dates = [future_date_1, future_date_2]
    res = simulate_leaves(db_session, semester.id, sim_dates)

    assert len(res["missed_lectures"]) == 2
    dates_missed = [l["date"] for l in res["missed_lectures"]]
    assert future_date_1 in dates_missed
    assert future_date_2 in dates_missed
    assert res["missed_lectures"][0]["subject_name"] == "Database"
