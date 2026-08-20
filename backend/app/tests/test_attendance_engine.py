import pytest
import math
from datetime import date, time, timedelta

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
    assert stats["unmarked"] == 0  # Future unmarked class is excluded from conducted stats
    assert stats["conducted"] == 8
    assert stats["attendance_percent"] == 75.0
    assert stats["safe_bunks"] == 0
    assert stats["required_to_attend"] == 0

    # Let's change one absent to present -> 7 present, 1 absent.
    # Conducted = 8. Percentage = (7/8) * 100 = 87.5%.
    db_session.query(LectureOccurrence).filter(LectureOccurrence.date == date(2026, 9, 7)).update({"attendance_status": "present"})
    db_session.commit()

    stats2 = calculate_subject_statistics(db_session, semester.id, subject)
    assert stats2["attendance_percent"] == 87.5
    assert stats2["conducted"] == 8
    
    # Verify overall calculations
    summary = calculate_semester_summary(db_session, semester.id)
    assert summary["overall"]["attendance_percent"] == 87.5


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


def test_delivered_conducted_calculated_independently_of_marking_click(db_session):
    """Proves that a past scheduled class contributes to conducted/delivered automatically,
    and clicking Present or Absent updates attended/missed without changing conducted/delivered."""
    user = User(email="indep@attendwise.com", password_hash=get_password_hash("pass"), full_name="Indep Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Indep Term", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), is_active=True)
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Data Structures", code="CS201", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(subject)
    db_session.commit()

    # 1 past occurrence (date in the past) that is unmarked
    past_date = date.today() - timedelta(days=1)
    occ = LectureOccurrence(
        semester_id=semester.id,
        subject_id=subject.id,
        date=past_date,
        start_time=time(9, 0),
        end_time=time(11, 0),
        attendance_status="unmarked"
    )
    db_session.add(occ)
    db_session.commit()

    # 1. Before marking: past occurrence date has elapsed -> conducted = 2 units, attended = 0, absent = 0
    stats_before = calculate_subject_statistics(db_session, semester.id, subject)
    assert stats_before["conducted"] == 2
    assert stats_before["attended"] == 0
    assert stats_before["absent"] == 0

    # 2. Mark PRESENT: conducted remains 2 units, attended becomes 2 units
    occ.attendance_status = "present"
    db_session.commit()

    stats_present = calculate_subject_statistics(db_session, semester.id, subject)
    assert stats_present["conducted"] == 2  # Conducted did NOT increase!
    assert stats_present["attended"] == 2   # Attended increased!
    assert stats_present["absent"] == 0

    # 3. Mark ABSENT: conducted remains 2 units, attended becomes 0, absent becomes 2
    occ.attendance_status = "absent"
    db_session.commit()

    stats_absent = calculate_subject_statistics(db_session, semester.id, subject)
    assert stats_absent["conducted"] == 2  # Conducted did NOT increase!
    assert stats_absent["attended"] == 0
    assert stats_absent["absent"] == 2     # Absent increased!


def test_future_occurrences_excluded_from_stats(db_session):
    """Proves that future class occurrences do not contribute to conducted, attended, absent or percentage."""
    user = User(email="future@attendwise.com", password_hash=get_password_hash("pass"), full_name="Future Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Future Term", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), is_active=True)
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Networks", code="CS301", units_per_class=2, min_attendance_percent=75.0)
    db_session.add(subject)
    db_session.commit()

    # Past occurrence (yesterday)
    past_occ = LectureOccurrence(
        semester_id=semester.id,
        subject_id=subject.id,
        date=date.today() - timedelta(days=1),
        start_time=time(9, 0),
        end_time=time(11, 0),
        attendance_status="present"
    )
    # Future occurrence (next week)
    future_occ = LectureOccurrence(
        semester_id=semester.id,
        subject_id=subject.id,
        date=date.today() + timedelta(days=7),
        start_time=time(9, 0),
        end_time=time(11, 0),
        attendance_status="present"
    )
    db_session.add_all([past_occ, future_occ])
    db_session.commit()

    stats = calculate_subject_statistics(db_session, semester.id, subject)
    # Total lectures includes both occurrences in list
    assert stats["total_lectures"] == 2
    # BUT conducted and attended MUST only count past_occ (2 units), NOT future_occ
    assert stats["conducted"] == 2
    assert stats["attended"] == 2
    assert stats["absent"] == 0
    assert stats["attendance_percent"] == 100.0


def test_targeted_recovery_cases(db_session):
    """Verifies AOC-II, ADI, and PA recovery class requirements."""
    user = User(email="rec@attendwise.com", password_hash=get_password_hash("pass"), full_name="Rec Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Rec Term", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), is_active=True)
    db_session.add(semester)
    db_session.commit()

    # AOC-II: 28 attended out of 40 delivered at 75% target (2 units/class)
    # (28 + 2x)/(40 + 2x) >= 0.75 => x = 4 class sessions (8 units)
    aoc_subj = Subject(semester_id=semester.id, name="AOC-II", code="CS401", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(aoc_subj)
    db_session.commit()
    aoc_occs = [
        LectureOccurrence(semester_id=semester.id, subject_id=aoc_subj.id, date=date.today() - timedelta(days=i+1), start_time=time(9,0), end_time=time(11,0), attendance_status="present" if i < 14 else "absent")
        for i in range(20) # 20 occurrences * 2 = 40 units (14 present = 28 units, 6 absent = 12 units -> wait, 14 present * 2 = 28, 6 absent * 2 = 12 -> 28/40 = 70%)
    ]
    db_session.add_all(aoc_occs)
    db_session.commit()
    aoc_stats = calculate_subject_statistics(db_session, semester.id, aoc_subj)
    assert aoc_stats["conducted"] == 40
    assert aoc_stats["attended"] == 28
    assert aoc_stats["required_sessions"] == 4
    assert aoc_stats["required_to_attend"] == 8

    # ADI: 104 attended out of 146 delivered at 75% target (2 units/class)
    # (104 + 2x)/(146 + 2x) >= 0.75 => 0.5x >= 5.5 => x = 11 classes (22 units)
    adi_subj = Subject(semester_id=semester.id, name="ADI", code="CS402", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(adi_subj)
    db_session.commit()
    adi_occs = [
        LectureOccurrence(semester_id=semester.id, subject_id=adi_subj.id, date=date.today() - timedelta(days=i+1), start_time=time(9,0), end_time=time(11,0), attendance_status="present" if i < 52 else "absent")
        for i in range(73) # 73 occurrences * 2 = 146 units (52 present = 104 units)
    ]
    db_session.add_all(adi_occs)
    db_session.commit()
    adi_stats = calculate_subject_statistics(db_session, semester.id, adi_subj)
    assert adi_stats["conducted"] == 146
    assert adi_stats["attended"] == 104
    assert adi_stats["required_sessions"] == 11
    assert adi_stats["required_to_attend"] == 22

    # PA: 36 attended out of 52 delivered at 75% target (2 units/class)
    # (36 + 2x)/(52 + 2x) >= 0.75 => 0.5x >= 3 => x = 6 classes (12 units)
    pa_subj = Subject(semester_id=semester.id, name="PA", code="CS403", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(pa_subj)
    db_session.commit()
    pa_occs = [
        LectureOccurrence(semester_id=semester.id, subject_id=pa_subj.id, date=date.today() - timedelta(days=i+1), start_time=time(9,0), end_time=time(11,0), attendance_status="present" if i < 18 else "absent")
        for i in range(26) # 26 occurrences * 2 = 52 units (18 present = 36 units)
    ]
    db_session.add_all(pa_occs)
    db_session.commit()
    pa_stats = calculate_subject_statistics(db_session, semester.id, pa_subj)
    assert pa_stats["conducted"] == 52
    assert pa_stats["attended"] == 36
    assert pa_stats["required_sessions"] == 6
    assert pa_stats["required_to_attend"] == 12


def test_targeted_safe_leave_cases(db_session):
    """Verifies SD, AIML, and NALR-I safe leave session calculations."""
    user = User(email="safe@attendwise.com", password_hash=get_password_hash("pass"), full_name="Safe Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Safe Term", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), is_active=True)
    db_session.add(semester)
    db_session.commit()

    # SD: 30 attended out of 32 delivered at 75% target (2 units/class)
    # 30 / (32 + 2x) >= 0.75 => 1.5x <= 6 => x = 4 complete classes (8 units)
    sd_subj = Subject(semester_id=semester.id, name="SD", code="CS501", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(sd_subj)
    db_session.commit()
    sd_occs = [
        LectureOccurrence(semester_id=semester.id, subject_id=sd_subj.id, date=date.today() - timedelta(days=i+1), start_time=time(9,0), end_time=time(11,0), attendance_status="present" if i < 15 else "absent")
        for i in range(16) # 16 * 2 = 32 units (15 present = 30 units)
    ]
    db_session.add_all(sd_occs)
    db_session.commit()
    sd_stats = calculate_subject_statistics(db_session, semester.id, sd_subj)
    assert sd_stats["conducted"] == 32
    assert sd_stats["attended"] == 30
    assert sd_stats["safe_bunks_sessions"] == 4
    assert sd_stats["safe_bunks"] == 8

    # AIML: 50 attended out of 62 delivered at 75% target (2 units/class)
    # 50 / (62 + 2x) >= 0.75 => 1.5x <= 3.5 => x = 2 complete classes (4 units)
    aiml_subj = Subject(semester_id=semester.id, name="AIML", code="CS502", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(aiml_subj)
    db_session.commit()
    aiml_occs = [
        LectureOccurrence(semester_id=semester.id, subject_id=aiml_subj.id, date=date.today() - timedelta(days=i+1), start_time=time(9,0), end_time=time(11,0), attendance_status="present" if i < 25 else "absent")
        for i in range(31) # 31 * 2 = 62 units (25 present = 50 units)
    ]
    db_session.add_all(aiml_occs)
    db_session.commit()
    aiml_stats = calculate_subject_statistics(db_session, semester.id, aiml_subj)
    assert aiml_stats["conducted"] == 62
    assert aiml_stats["attended"] == 50
    assert aiml_stats["safe_bunks_sessions"] == 2
    assert aiml_stats["safe_bunks"] == 4

    # NALR-I: 30 attended out of 34 delivered at 75% target (2 units/class)
    # 30 / (34 + 2x) >= 0.75 => 1.5x <= 4.5 => x = 3 complete classes (6 units)
    nalr_subj = Subject(semester_id=semester.id, name="NALR-I", code="CS503", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(nalr_subj)
    db_session.commit()
    nalr_occs = [
        LectureOccurrence(semester_id=semester.id, subject_id=nalr_subj.id, date=date.today() - timedelta(days=i+1), start_time=time(9,0), end_time=time(11,0), attendance_status="present" if i < 15 else "absent")
        for i in range(17) # 17 * 2 = 34 units (15 present = 30 units)
    ]
    db_session.add_all(nalr_occs)
    db_session.commit()
    nalr_stats = calculate_subject_statistics(db_session, semester.id, nalr_subj)
    assert nalr_stats["conducted"] == 34
    assert nalr_stats["attended"] == 30
    assert nalr_stats["safe_bunks_sessions"] == 3
    assert nalr_stats["safe_bunks"] == 6


def test_comprehensive_edge_cases_and_multi_unit_accuracy(db_session):
    """Audits edge cases: exactly 75%, below target, above target, zero attendance, zero conducted, and 2-unit raw counts."""
    user = User(email="edge@attendwise.com", password_hash=get_password_hash("pass"), full_name="Edge Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Edge Term", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), is_active=True)
    db_session.add(semester)
    db_session.commit()

    # 1. Exactly 75% (2-unit subject: 15 present out of 20 conducted = 30/40 units = 75.0%)
    exact_subj = Subject(semester_id=semester.id, name="Exact 75", code="EX75", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(exact_subj)
    db_session.commit()
    for i in range(20):
        db_session.add(LectureOccurrence(
            semester_id=semester.id, subject_id=exact_subj.id,
            date=date.today() - timedelta(days=i+1), start_time=time(9,0), end_time=time(11,0),
            attendance_status="present" if i < 15 else "absent"
        ))
    db_session.commit()
    exact_stats = calculate_subject_statistics(db_session, semester.id, exact_subj)
    assert exact_stats["raw_conducted"] == 20
    assert exact_stats["raw_attended"] == 15
    assert exact_stats["raw_absent"] == 5
    assert exact_stats["conducted"] == 40
    assert exact_stats["attended"] == 30
    assert exact_stats["attendance_percent"] == 75.0
    assert exact_stats["safe_bunks_sessions"] == 0
    assert exact_stats["required_sessions"] == 0

    # 2. Below Target (2-unit subject: 14 present out of 20 conducted = 28/40 units = 70.0%)
    below_subj = Subject(semester_id=semester.id, name="Below Target", code="BELOW", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(below_subj)
    db_session.commit()
    for i in range(20):
        db_session.add(LectureOccurrence(
            semester_id=semester.id, subject_id=below_subj.id,
            date=date.today() - timedelta(days=i+1), start_time=time(9,0), end_time=time(11,0),
            attendance_status="present" if i < 14 else "absent"
        ))
    db_session.commit()
    below_stats = calculate_subject_statistics(db_session, semester.id, below_subj)
    assert below_stats["raw_conducted"] == 20
    assert below_stats["raw_attended"] == 14
    assert below_stats["raw_absent"] == 6
    assert below_stats["conducted"] == 40
    assert below_stats["attended"] == 28
    assert below_stats["attendance_percent"] == 70.0
    assert below_stats["required_sessions"] == 4
    assert below_stats["required_to_attend"] == 8
    assert below_stats["safe_bunks_sessions"] == 0

    # 3. Above Target (2-unit subject: 16 present out of 20 conducted = 32/40 units = 80.0%)
    above_subj = Subject(semester_id=semester.id, name="Above Target", code="ABOVE", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(above_subj)
    db_session.commit()
    for i in range(20):
        db_session.add(LectureOccurrence(
            semester_id=semester.id, subject_id=above_subj.id,
            date=date.today() - timedelta(days=i+1), start_time=time(9,0), end_time=time(11,0),
            attendance_status="present" if i < 16 else "absent"
        ))
    db_session.commit()
    above_stats = calculate_subject_statistics(db_session, semester.id, above_subj)
    assert above_stats["raw_conducted"] == 20
    assert above_stats["raw_attended"] == 16
    assert above_stats["raw_absent"] == 4
    assert above_stats["conducted"] == 40
    assert above_stats["attended"] == 32
    assert above_stats["attendance_percent"] == 80.0
    assert above_stats["safe_bunks_sessions"] == 1
    assert above_stats["safe_bunks"] == 2
    assert above_stats["required_sessions"] == 0

    # 4. Zero Attendance (2-unit subject: 0 present out of 10 conducted = 0/20 units = 0.0%)
    zero_subj = Subject(semester_id=semester.id, name="Zero Attended", code="ZERO", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(zero_subj)
    db_session.commit()
    for i in range(10):
        db_session.add(LectureOccurrence(
            semester_id=semester.id, subject_id=zero_subj.id,
            date=date.today() - timedelta(days=i+1), start_time=time(9,0), end_time=time(11,0),
            attendance_status="absent"
        ))
    db_session.commit()
    zero_stats = calculate_subject_statistics(db_session, semester.id, zero_subj)
    assert zero_stats["raw_conducted"] == 10
    assert zero_stats["raw_attended"] == 0
    assert zero_stats["raw_absent"] == 10
    assert zero_stats["conducted"] == 20
    assert zero_stats["attended"] == 0
    assert zero_stats["attendance_percent"] == 0.0
    assert zero_stats["required_sessions"] == 30
    assert zero_stats["required_to_attend"] == 60
    assert zero_stats["safe_bunks_sessions"] == 0

    # 5. Zero Conducted (Uninitialized subject)
    uninit_subj = Subject(semester_id=semester.id, name="Uninitialized", code="UNINIT", units_per_class=2, units_earned_per_class=2, units_lost_per_class=2, min_attendance_percent=75.0)
    db_session.add(uninit_subj)
    db_session.commit()
    uninit_stats = calculate_subject_statistics(db_session, semester.id, uninit_subj)
    assert uninit_stats["raw_conducted"] == 0
    assert uninit_stats["conducted"] == 0
    assert uninit_stats["attended"] == 0
    assert uninit_stats["attendance_percent"] == 0.0
    assert uninit_stats["is_initialized"] == False
    assert uninit_stats["safe_bunks_sessions"] == 0
    assert uninit_stats["required_sessions"] == 0


