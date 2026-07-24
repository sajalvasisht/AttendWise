import pytest
from datetime import date, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.models.models import User, Semester, Subject, LectureOccurrence
from app.services.attendance_engine import calculate_subject_statistics, calculate_semester_summary
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

def test_attendance_uninitialized_state(db_session):
    user = User(email="tester@gmail.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Spring 2026", start_date=date(2026, 1, 1), end_date=date(2026, 5, 1))
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Maths", code="MATH101")
    db_session.add(subject)
    db_session.commit()

    # Calculate stats before any classes conducted or initialized
    stats = calculate_subject_statistics(db_session, semester.id, subject)
    assert not stats["is_initialized"]
    assert stats["attendance_percent"] == 0.0
    assert stats["safe_bunks"] == 0

    summary = calculate_semester_summary(db_session, semester.id)
    assert not summary["overall"]["is_initialized"]
    assert summary["overall"]["attendance_percent"] == 0.0

def test_attendance_initialized_state(db_session):
    user = User(email="tester@gmail.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Spring 2026", start_date=date(2026, 1, 1), end_date=date(2026, 5, 1))
    db_session.add(semester)
    db_session.commit()

    # Subject initialized with conducted=10, attended=8 (80%)
    subject = Subject(semester_id=semester.id, name="Maths", code="MATH101", initial_conducted=10, initial_attended=8, min_attendance_percent=75.0)
    db_session.add(subject)
    db_session.commit()

    stats = calculate_subject_statistics(db_session, semester.id, subject)
    assert stats["is_initialized"]
    assert stats["attendance_percent"] == 80.0
    assert stats["conducted"] == 10
    assert stats["attended"] == 8
    # safe_bunks = floor(8 - 0.75 * 10) = floor(8 - 7.5) = floor(0.5) = 0
    assert stats["safe_bunks"] == 0

    # Let's add 2 present occurrences
    occ1 = LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 2, 1), start_time=time(9,0), end_time=time(10,0), attendance_status="present")
    occ2 = LectureOccurrence(semester_id=semester.id, subject_id=subject.id, date=date(2026, 2, 2), start_time=time(9,0), end_time=time(10,0), attendance_status="present")
    db_session.add_all([occ1, occ2])
    db_session.commit()

    stats2 = calculate_subject_statistics(db_session, semester.id, subject)
    assert stats2["conducted"] == 12
    assert stats2["attended"] == 10
    # safe_bunks = floor(10 - 0.75 * 12) = floor(10 - 9) = 1
    assert stats2["safe_bunks"] == 1
    assert stats2["attendance_percent"] == 83.33
