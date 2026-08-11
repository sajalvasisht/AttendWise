import pytest
import math
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


def test_units_per_class_calculations(db_session):
    """Test 1-unit and 2-unit subject attendance calculations and recovery math."""
    user = User(email="units@attendwise.com", password_hash=get_password_hash("pass"), full_name="Unit Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Unit Semester", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1), is_active=True)
    db_session.add(semester)
    db_session.commit()

    # 1. 1-unit subject (Physics: units_per_class = 1, min = 75%)
    sub_1unit = Subject(
        semester_id=semester.id,
        name="Physics",
        code="PHY101",
        units_per_class=1,
        units_earned_per_class=1,
        units_lost_per_class=1,
        min_attendance_percent=75.0,
        track_attendance=True
    )
    db_session.add(sub_1unit)
    db_session.commit()

    # Add 3 present, 1 absent occurrences for 1-unit subject
    for i in range(4):
        occ = LectureOccurrence(
            semester_id=semester.id,
            subject_id=sub_1unit.id,
            date=date(2026, 1, 1 + i),
            start_time=time(9, 0),
            end_time=time(10, 0),
            attendance_status="present" if i < 3 else "absent"
        )
        db_session.add(occ)
    db_session.commit()

    stats_1u = calculate_subject_statistics(db_session, semester.id, sub_1unit)
    assert stats_1u["conducted"] == 4  # 4 units delivered
    assert stats_1u["attended"] == 3   # 3 units attended
    assert stats_1u["absent"] == 1     # 1 unit missed
    assert stats_1u["attendance_percent"] == 75.0

    # 2. 2-unit subject (ADI: units_per_class = 2, min = 75%)
    # Standard ADI example: 24 present classes (48 units) and 10 absent classes (20 units) -> 68 units delivered
    sub_2unit = Subject(
        semester_id=semester.id,
        name="ADI",
        code="CS302",
        units_per_class=2,
        units_earned_per_class=2,
        units_lost_per_class=2,
        min_attendance_percent=75.0,
        track_attendance=True
    )
    db_session.add(sub_2unit)
    db_session.commit()

    from datetime import timedelta
    # Add 24 present occurrences and 10 absent occurrences (each 2 units)
    start_d = date(2026, 1, 1)
    for i in range(34):
        occ = LectureOccurrence(
            semester_id=semester.id,
            subject_id=sub_2unit.id,
            date=start_d + timedelta(days=i),
            start_time=time(10, 0),
            end_time=time(12, 0),
            attendance_status="present" if i < 24 else "absent"
        )
        db_session.add(occ)
    db_session.commit()


    stats_2u = calculate_subject_statistics(db_session, semester.id, sub_2unit)
    # Delivered units = 24 * 2 + 10 * 2 = 68
    # Attended units = 24 * 2 = 48
    # Absent units = 10 * 2 = 20
    assert stats_2u["conducted"] == 68
    assert stats_2u["attended"] == 48
    assert stats_2u["absent"] == 20
    assert stats_2u["attendance_percent"] == pytest.approx(70.59, abs=0.01)

    # Verify recovery calculation for 2-unit subject:
    # (48 + 2x) / (68 + 2x) >= 0.75 -> x >= 6 classes.
    # required_to_attend in units = 6 * 2 = 12 units.
    # Classes required = ceil(12 / 2) = 6 classes.
    assert stats_2u["required_to_attend"] == 12
    required_classes = math.ceil(stats_2u["required_to_attend"] / (stats_2u["units_per_class"] or 1))
    assert required_classes == 6

    # Test marking 1 ADI lecture PRESENT (+2 units)
    new_present_occ = LectureOccurrence(
        semester_id=semester.id,
        subject_id=sub_2unit.id,
        date=date(2026, 2, 10),
        start_time=time(10, 0),
        end_time=time(12, 0),
        attendance_status="present"
    )
    db_session.add(new_present_occ)
    db_session.commit()

    stats_2u_after_present = calculate_subject_statistics(db_session, semester.id, sub_2unit)
    assert stats_2u_after_present["conducted"] == 70  # 68 + 2
    assert stats_2u_after_present["attended"] == 50   # 48 + 2
    assert stats_2u_after_present["absent"] == 20     # unchanged

    # Test marking 1 ADI lecture ABSENT (+2 units missed)
    new_absent_occ = LectureOccurrence(
        semester_id=semester.id,
        subject_id=sub_2unit.id,
        date=date(2026, 2, 11),
        start_time=time(10, 0),
        end_time=time(12, 0),
        attendance_status="absent"
    )
    db_session.add(new_absent_occ)
    db_session.commit()

    stats_2u_after_absent = calculate_subject_statistics(db_session, semester.id, sub_2unit)
    assert stats_2u_after_absent["conducted"] == 72  # 70 + 2
    assert stats_2u_after_absent["attended"] == 50   # unchanged
    assert stats_2u_after_absent["absent"] == 22     # 20 + 2

