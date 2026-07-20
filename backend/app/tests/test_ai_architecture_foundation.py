import pytest
from datetime import date, time, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.models.models import User, Semester, Subject, TimetableSlot, CalendarEvent, LectureOccurrence
from app.services.occurrence_generator import generate_occurrences
from app.services.ai.provider import get_ai_provider
from app.services.ai.mapping import map_raw_calendar, map_raw_timetable
from app.services.ai.review_models import (
    ExtractedTimetableReview,
    ExtractedSubjectReview,
    ExtractedTimetableSlotReview,
    ExtractedCalendarReview,
    ExtractedCalendarEventReview
)
from app.services.ai.validators import validate_timetable_review, validate_calendar_review
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

def test_refined_calendar_event_replace_lectures(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    semester = Semester(
        user_id=user.id,
        name="Refined Calendar Term",
        start_date=date(2026, 9, 1), # Tuesday
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

    # Create a refined REPLACE_LECTURES event on Wed Sept 2
    replace_event = CalendarEvent(
        semester_id=semester.id,
        date=date(2026, 9, 2),
        event_type="holiday",
        title="Physics Quiz Postponed",
        category="Assessment",
        schedule_effect="REPLACE_LECTURES"
    )
    db_session.add(replace_event)
    db_session.commit()

    generate_occurrences(db_session, semester.id)

    occurrences = db_session.query(LectureOccurrence).filter(LectureOccurrence.semester_id == semester.id).all()
    # Wednesday normally runs on Sept 2 and Sept 9.
    # Sept 2 has REPLACE_LECTURES, so Wednesday class is skipped. Only Sept 9 runs.
    assert len(occurrences) == 1
    assert occurrences[0].date == date(2026, 9, 9)

def test_refined_calendar_event_keep_lectures(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    semester = Semester(
        user_id=user.id,
        name="Refined Calendar Term",
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

    # Create a refined KEEP_LECTURES event on Wed Sept 2
    keep_event = CalendarEvent(
        semester_id=semester.id,
        date=date(2026, 9, 2),
        event_type="holiday",
        title="Formative Quiz",
        category="Assessment",
        schedule_effect="KEEP_LECTURES"
    )
    db_session.add(keep_event)
    db_session.commit()

    generate_occurrences(db_session, semester.id)

    occurrences = db_session.query(LectureOccurrence).filter(LectureOccurrence.semester_id == semester.id).all()
    # Sept 2 has KEEP_LECTURES, so both Sept 2 and Sept 9 run!
    assert len(occurrences) == 2

def test_refined_calendar_event_date_range(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()
    
    semester = Semester(
        user_id=user.id,
        name="Refined Calendar Term",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 10),
        working_days="0,1,2,3,4"
    )
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Physics", code="PHYS101")
    db_session.add(subject)
    db_session.commit()

    # Physics on Wednesday (Sept 2 and Sept 9)
    wed_slot = TimetableSlot(semester_id=semester.id, subject_id=subject.id, day_of_week=2, start_time=time(9,0), end_time=time(10,0))
    db_session.add(wed_slot)
    db_session.commit()

    # Create a multi-day holiday spanning Sept 1 to Sept 3
    range_event = CalendarEvent(
        semester_id=semester.id,
        date=date(2026, 9, 1),
        end_date=date(2026, 9, 3),
        event_type="holiday",
        title="Midterm break",
        category="Holiday",
        schedule_effect="REPLACE_LECTURES"
    )
    db_session.add(range_event)
    db_session.commit()

    generate_occurrences(db_session, semester.id)

    occurrences = db_session.query(LectureOccurrence).filter(LectureOccurrence.semester_id == semester.id).all()
    # Wed Sept 2 is inside the range [Sept 1, Sept 3], so it should be skipped. Only Sept 9 remains.
    assert len(occurrences) == 1
    assert occurrences[0].date == date(2026, 9, 9)

def test_mock_ai_provider_mapping():
    provider = get_ai_provider()
    raw_timetable = provider.extract_timetable(b"", "")
    timetable_review = map_raw_timetable(raw_timetable)

    assert timetable_review.semester_name == "Semester 5 (Mock)"
    assert len(timetable_review.subjects) == 3
    assert timetable_review.timetable_slots[0].subject_code == "CS301"

    raw_calendar = provider.extract_calendar(b"", "")
    calendar_review = map_raw_calendar(raw_calendar)

    assert len(calendar_review.events) == 3
    # Check default mapping rules
    # "Independence Day Holiday" -> should map to Holiday and REPLACE_LECTURES
    assert calendar_review.events[0].category == "Holiday"
    assert calendar_review.events[0].schedule_effect == "REPLACE_LECTURES"
    # "OS Mid Semester" (contains "mid semester") -> should map to Assessment and REPLACE_LECTURES
    assert calendar_review.events[1].category == "Assessment"
    assert calendar_review.events[1].schedule_effect == "REPLACE_LECTURES"
    # "Quiz 1" (contains "quiz") -> should map to Assessment and KEEP_LECTURES
    assert calendar_review.events[2].category == "Assessment"
    assert calendar_review.events[2].schedule_effect == "KEEP_LECTURES"

def test_ai_timetable_validation():
    # Success case
    good_review = ExtractedTimetableReview(
        semester_name="Valid Term",
        start_date="2026-09-01",
        end_date="2026-12-15",
        working_days=[0, 1, 2, 3, 4],
        subjects=[
            ExtractedSubjectReview(name="Math", code="M1", min_attendance_percent=75.0),
            ExtractedSubjectReview(name="Physics", code="P1", min_attendance_percent=80.0)
        ],
        timetable_slots=[
            ExtractedTimetableSlotReview(subject_name="Math", subject_code="M1", day_of_week=0, start_time="09:00", end_time="10:00")
        ]
    )
    errors = validate_timetable_review(good_review)
    assert len(errors) == 0

    # Failure case: Overlap, Duplicate subjects, Invalid subject
    bad_review = ExtractedTimetableReview(
        semester_name="Invalid Term",
        start_date="2026-12-15", # Date order violation
        end_date="2026-09-01",
        working_days=[0, 1, 2, 3, 4],
        subjects=[
            ExtractedSubjectReview(name="Math", code="M1", min_attendance_percent=75.0),
            ExtractedSubjectReview(name="Math", code="M2", min_attendance_percent=80.0) # Duplicate name
        ],
        timetable_slots=[
            ExtractedTimetableSlotReview(subject_name="Math", subject_code="M1", day_of_week=0, start_time="10:00", end_time="09:00"), # Invalid time order
            ExtractedTimetableSlotReview(subject_name="Chemistry", subject_code="C1", day_of_week=0, start_time="11:00", end_time="12:00") # Missing subject
        ]
    )
    errors2 = validate_timetable_review(bad_review)
    assert len(errors2) > 0
    assert any("Start date must be before or equal to end date" in err for err in errors2)
    assert any("Duplicate subject name" in err for err in errors2)
    assert any("Start time (10:00) must be before end time (09:00)" in err for err in errors2)
    assert any("Subject 'Chemistry' is not in the subjects list" in err for err in errors2)
