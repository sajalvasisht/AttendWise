import pytest
from datetime import date, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.models.models import User, Semester, Subject, TimetableSlot, CalendarEvent, LectureOccurrence
from app.services.attendance_engine import calculate_subject_statistics, calculate_semester_summary
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

def test_attendance_calculations(db_session):
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

    # 3. Create Lecture Occurrences
    # Let's say: 10 total lectures
    # Statuses: 6 present, 2 absent, 1 cancelled, 1 unmarked
    # Conducted = 6 + 2 = 8
    # Attendance percentage = (6 / 8) * 100 = 75.0%
    # Safe bunks: present + unmarked - M * (conducted + unmarked)
    #             = 6 + 1 - 0.75 * (8 + 1) = 7 - 0.75 * 9 = 7 - 6.75 = 0.25 -> floor(0.25) = 0 safe bunks.
    occurrences = [
        # 6 present
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 1), start_time=time(9,0), end_time=time(10,0), attendance_status="present"),
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 2), start_time=time(9,0), end_time=time(10,0), attendance_status="present"),
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 3), start_time=time(9,0), end_time=time(10,0), attendance_status="present"),
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 4), start_time=time(9,0), end_time=time(10,0), attendance_status="present"),
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 5), start_time=time(9,0), end_time=time(10,0), attendance_status="present"),
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 6), start_time=time(9,0), end_time=time(10,0), attendance_status="present"),
        # 2 absent
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 7), start_time=time(9,0), end_time=time(10,0), attendance_status="absent"),
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 8), start_time=time(9,0), end_time=time(10,0), attendance_status="absent"),
        # 1 cancelled
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 9), start_time=time(9,0), end_time=time(10,0), attendance_status="cancelled"),
        # 1 unmarked
        LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 9, 10), start_time=time(9,0), end_time=time(10,0), attendance_status="unmarked"),
    ]
    db_session.add_all(occurrences)
    db_session.commit()

    # 4. Calculate stats
    stats = calculate_subject_statistics(db_session, semester.id, subject)
    
    assert stats["total_lectures"] == 10
    assert stats["attended"] == 6
    assert stats["absent"] == 2
    assert stats["cancelled"] == 1
    assert stats["unmarked"] == 1
    assert stats["conducted"] == 8
    assert stats["attendance_percent"] == 75.0
    assert stats["safe_bunks"] == 0
    assert stats["required_to_attend"] == 0

    # Let's change one absent to present -> 7 present, 1 absent.
    # Conducted = 8. Percentage = (7/8) * 100 = 87.5%.
    # Safe bunks: 7 + 1 - 0.75 * 9 = 8 - 6.75 = 1.25 -> floor(1.25) = 1.
    db_session.query(LectureOccurrence).filter(LectureOccurrence.date == date(2026, 9, 7)).update({"attendance_status": "present"})
    db_session.commit()

    stats2 = calculate_subject_statistics(db_session, semester.id, subject)
    assert stats2["attendance_percent"] == 87.5
    assert stats2["safe_bunks"] == 1
    
    # Verify overall calculations
    summary = calculate_semester_summary(db_session, semester.id)
    assert summary["overall"]["attendance_percent"] == 87.5
    assert summary["overall"]["safe_bunks_budget"] == 1
