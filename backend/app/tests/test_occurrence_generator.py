import pytest
from datetime import date, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.models.models import User, Semester, Subject, TimetableSlot, CalendarEvent, LectureOccurrence
from app.services.occurrence_generator import generate_occurrences
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

def test_mon_fri_college(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    # Mon-Fri: working_days = "0,1,2,3,4"
    semester = Semester(
        user_id=user.id,
        name="Mon-Fri Term",
        start_date=date(2026, 9, 1), # Tuesday
        end_date=date(2026, 9, 10),  # Thursday of next week
        working_days="0,1,2,3,4"
    )
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Physics", code="PHYS101")
    db_session.add(subject)
    db_session.commit()

    # Slot on Wednesday (day 2) and Saturday (day 5)
    wed_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=2, start_time=time(9,0), end_time=time(10,0))
    sat_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=5, start_time=time(9,0), end_time=time(10,0))
    db_session.add_all([wed_slot, sat_slot])
    db_session.commit()

    generate_occurrences(db_session, semester.id)

    occurrences = db_session.query(LectureOccurrence).filter(LectureOccurrence.semester_id == semester.id).all()
    # Wednesday occurs twice (Sept 2, Sept 9)
    # Saturday occurs once (Sept 5) but is NOT in working_days, so it shouldn't generate!
    # Total generated should be exactly 2
    assert len(occurrences) == 2
    dates = {occ.date for occ in occurrences}
    assert date(2026, 9, 2) in dates
    assert date(2026, 9, 9) in dates
    assert date(2026, 9, 5) not in dates

def test_mon_sat_college(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    # Mon-Sat: working_days = "0,1,2,3,4,5"
    semester = Semester(
        user_id=user.id,
        name="Mon-Sat Term",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 10),
        working_days="0,1,2,3,4,5"
    )
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Physics", code="PHYS101")
    db_session.add(subject)
    db_session.commit()

    # Slot on Wednesday (day 2) and Saturday (day 5)
    wed_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=2, start_time=time(9,0), end_time=time(10,0))
    sat_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=5, start_time=time(9,0), end_time=time(10,0))
    db_session.add_all([wed_slot, sat_slot])
    db_session.commit()

    generate_occurrences(db_session, semester.id)

    occurrences = db_session.query(LectureOccurrence).filter(LectureOccurrence.semester_id == semester.id).all()
    # Saturday is working, so both Wednesday and Saturday should be generated!
    # Sept 2 (Wed), Sept 5 (Sat), Sept 9 (Wed). Total = 3
    assert len(occurrences) == 3
    dates = {occ.date for occ in occurrences}
    assert date(2026, 9, 2) in dates
    assert date(2026, 9, 5) in dates
    assert date(2026, 9, 9) in dates

def test_working_day_override(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    # Mon-Fri: working_days = "0,1,2,3,4"
    semester = Semester(
        user_id=user.id,
        name="Override Term",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 10),
        working_days="0,1,2,3,4"
    )
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Physics", code="PHYS101")
    db_session.add(subject)
    db_session.commit()

    # Slot on Monday (day 0)
    mon_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=0, start_time=time(9,0), end_time=time(10,0))
    # Slot on Saturday (day 5)
    sat_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=5, start_time=time(11,0), end_time=time(12,0))
    db_session.add_all([mon_slot, sat_slot])
    db_session.commit()

    # Add Working Day Override for Sept 5 (Saturday) to run Monday (day 0) timetable
    override = CalendarEvent(
        semester_id=semester.id,
        date=date(2026, 9, 5),
        event_type="working_day_override",
        timetable_day_override=0 # Run Monday schedule
    )
    db_session.add(override)
    db_session.commit()

    generate_occurrences(db_session, semester.id)

    occurrences = db_session.query(LectureOccurrence).filter(LectureOccurrence.semester_id == semester.id).order_by(LectureOccurrence.date).all()
    # Expected:
    # Sept 5 (Saturday): Run Monday's slots! So Physics 9:00 - 10:00 should run!
    # Sept 7 (Monday): Run Monday's slots! Physics 9:00 - 10:00 runs.
    # Total = 2 occurrences
    assert len(occurrences) == 2
    
    assert occurrences[0].date == date(2026, 9, 5)
    assert occurrences[0].start_time == time(9,0) # Monday's start time!
    
    assert occurrences[1].date == date(2026, 9, 7)
    assert occurrences[1].start_time == time(9,0)

def test_holiday_override(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    # Mon-Fri: working_days = "0,1,2,3,4"
    semester = Semester(
        user_id=user.id,
        name="Holiday Term",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 10),
        working_days="0,1,2,3,4"
    )
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Physics", code="PHYS101")
    db_session.add(subject)
    db_session.commit()

    # Slot on Wednesday (day 2)
    wed_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=2, start_time=time(9,0), end_time=time(10,0))
    db_session.add(wed_slot)
    db_session.commit()

    # Add holiday exception on Sept 2 (Wednesday)
    holiday = CalendarEvent(
        semester_id=semester.id,
        date=date(2026, 9, 2),
        event_type="holiday",
        description="Public Holiday"
    )
    db_session.add(holiday)
    db_session.commit()

    generate_occurrences(db_session, semester.id)

    occurrences = db_session.query(LectureOccurrence).filter(LectureOccurrence.semester_id == semester.id).all()
    # Wednesday normally runs on Sept 2 and Sept 9.
    # Sept 2 is a holiday, so only Sept 9 should remain.
    assert len(occurrences) == 1
    assert occurrences[0].date == date(2026, 9, 9)

def test_backward_compatibility(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    # Mon-Fri
    semester = Semester(
        user_id=user.id,
        name="Legacy Term",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 10),
        working_days="0,1,2,3,4"
    )
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Physics", code="PHYS101")
    db_session.add(subject)
    db_session.commit()

    # Wednesday slot and Saturday slot
    wed_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=2, start_time=time(9,0), end_time=time(10,0))
    sat_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=5, start_time=time(11,0), end_time=time(12,0))
    db_session.add_all([wed_slot, sat_slot])
    db_session.commit()

    # Legacy types: "working_saturday" and "exam"
    legacy_sat = CalendarEvent(semester_id=semester.id, date=date(2026, 9, 5), event_type="working_saturday")
    legacy_exam = CalendarEvent(semester_id=semester.id, date=date(2026, 9, 9), event_type="exam")
    db_session.add_all([legacy_sat, legacy_exam])
    db_session.commit()

    generate_occurrences(db_session, semester.id)

    occurrences = db_session.query(LectureOccurrence).filter(LectureOccurrence.semester_id == semester.id).order_by(LectureOccurrence.date).all()
    # Expected:
    # Sept 2 (Wed): Physics 9:00 - 10:00 (runs)
    # Sept 5 (Sat): working_saturday legacy type behaves like override! So Physics 11:00 - 12:00 runs.
    # Sept 9 (Wed): exam legacy type behaves like holiday! So Wednesday class does NOT run.
    # Total = 2 occurrences
    assert len(occurrences) == 2
    assert occurrences[0].date == date(2026, 9, 2)
    assert occurrences[1].date == date(2026, 9, 5)

def test_exam_day_skips_lectures(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    semester = Semester(
        user_id=user.id,
        name="Exam Day Term",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 10),
        working_days="0,1,2,3,4"
    )
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Physics", code="PHYS101")
    db_session.add(subject)
    db_session.commit()

    wed_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=2, start_time=time(9,0), end_time=time(10,0))
    db_session.add(wed_slot)
    db_session.commit()

    # Exception date for exam_day on Wed Sept 2
    exam_day = CalendarEvent(
        semester_id=semester.id,
        date=date(2026, 9, 2),
        event_type="exam_day",
        description="OS Mid-Sem",
        subject_id=subject.id,
        start_time=time(10,0),
        end_time=time(12,0)
    )
    db_session.add(exam_day)
    db_session.commit()

    generate_occurrences(db_session, semester.id)

    occurrences = db_session.query(LectureOccurrence).filter(LectureOccurrence.semester_id == semester.id).all()
    # Wednesday normally runs on Sept 2 and Sept 9.
    # Sept 2 is an exam_day, so Wednesday class is skipped. Only Sept 9 remains.
    assert len(occurrences) == 1
    assert occurrences[0].date == date(2026, 9, 9)
