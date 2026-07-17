import pytest
from datetime import date, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.models.models import User, Semester, Subject, LectureOccurrence
from app.services.planner_engine import simulate_leaves
from app.core.security import get_password_hash

# Use in-memory SQLite for unit tests
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

def test_planner_leave_simulation(db_session):
    # 1. Create a dummy user and semester
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    semester = Semester(user_id=user.id, name="Test Term", start_date=date(2026, 9, 1), end_date=date(2026, 9, 10))
    db_session.add(semester)
    db_session.commit()

    # 2. Create a Subject (75% min attendance requirement)
    subject = Subject(semester_id=semester.id, name="Calculus", code="MATH101", min_attendance_percent=75.0)
    db_session.add(subject)
    db_session.commit()

    # 3. Create occurrences
    # 2 present (conducted so far)
    # 2 unmarked (future classes)
    # Total = 4 lectures
    occurrences = [
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 1), start_time=time(9,0), end_time=time(10,0), attendance_status="present"),
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 2), start_time=time(9,0), end_time=time(10,0), attendance_status="present"),
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 3), start_time=time(9,0), end_time=time(10,0), attendance_status="unmarked"),
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 4), start_time=time(9,0), end_time=time(10,0), attendance_status="unmarked"),
    ]
    db_session.add_all(occurrences)
    db_session.commit()

    # 4. Simulate missing 2026-09-03 and 2026-09-04
    simulation_dates = [date(2026, 9, 3), date(2026, 9, 4)]
    res = simulate_leaves(db_session, semester.id, simulation_dates)

    # Check overall projections
    # Current conducted = 2, attended = 2 -> 100%. Safe bunks: floor(2 + 2 - 0.75 * 4) = floor(4 - 3) = 1.
    # Projected conducted = 4 (since future unmarked are simulated as absent, they count as conducted), present = 2 -> 50%
    # Projected safe bunks: floor(2 + 0 - 0.75 * 4) = floor(2 - 3) = -1 -> 0
    assert res["overall"]["current_percent"] == 100.0
    assert res["overall"]["projected_percent"] == 50.0
    assert res["overall"]["current_safe_bunks"] == 1
    assert res["overall"]["projected_safe_bunks"] == 0

    # Check subject projections
    proj = res["subjects"][0]
    assert proj["subject_id"] == subject.id
    assert proj["current_percent"] == 100.0
    assert proj["projected_percent"] == 50.0
    assert proj["is_safe"] is False
    assert proj["recovery_required"] is True

    # Check warning message generated
    assert len(res["warnings"]) == 1
    assert "Calculus" in res["warnings"][0]
    
    # Check missed lectures details
    assert len(res["missed_lectures"]) == 2
    assert res["missed_lectures"][0]["subject_name"] == "Calculus"
    assert res["missed_lectures"][0]["date"] == date(2026, 9, 3)

    # 5. VERY IMPORTANT: Verify that the database remains unmodified!
    db_occurrences = db_session.query(LectureOccurrence).order_by(LectureOccurrence.date).all()
    # Confirm the 3rd and 4th occurrences are still "unmarked" in the DB
    assert db_occurrences[2].attendance_status == "unmarked"
    assert db_occurrences[3].attendance_status == "unmarked"

def test_suggest_leaves_success(db_session):
    # 1. Create user and semester
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    semester = Semester(
        user_id=user.id,
        name="Test Term",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 30),
        working_days="0,1,2,3,4"
    )
    db_session.add(semester)
    db_session.commit()

    # 2. Create subject
    subject = Subject(semester_id=semester.id, name="Calculus", code="MATH101", min_attendance_percent=75.0)
    db_session.add(subject)
    db_session.commit()

    # 3. Create occurrences
    occurrences = [
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 4), start_time=time(9,0), end_time=time(10,0), attendance_status="present"),
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 7), start_time=time(9,0), end_time=time(10,0), attendance_status="present"),
    ]
    db_session.add_all(occurrences)
    db_session.commit()

    # 4. Add a holiday on Wednesday Sept 9
    from app.models.models import CalendarEvent
    holiday = CalendarEvent(
        semester_id=semester.id,
        date=date(2026, 9, 9),
        event_type="holiday",
        description="Wednesday Holiday"
    )
    db_session.add(holiday)
    db_session.commit()

    # 5. Run suggest_leaves
    from app.services.planner_engine import suggest_leaves
    suggestions = suggest_leaves(db_session, semester.id)

    assert len(suggestions) > 0
    assert "label" in suggestions[0]
    assert "start_date" in suggestions[0]
    assert "end_date" in suggestions[0]
    assert "missed_classes_count" in suggestions[0]
    assert "projected_percent" in suggestions[0]
    assert "is_safe" in suggestions[0]
