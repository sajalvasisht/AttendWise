import pytest
from datetime import date, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database.session import Base, get_db
from app.models.models import User, Semester, Subject, TimetableSlot, LectureOccurrence
from app.main import app
from app.core.security import get_password_hash, create_access_token
from app.services.ai.mapping import map_raw_timetable

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
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

@pytest.fixture(name="client")
def fixture_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_subject_creation_idempotency_and_cross_semester(client, db_session):
    # 1. Create user and two semesters
    user = User(
        email="test_subj@attendwise.com",
        password_hash=get_password_hash("password123"),
        full_name="Subject Tester",
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    sem1 = Semester(user_id=user.id, name="Semester 1", start_date=date(2026, 1, 1), end_date=date(2026, 5, 30), is_active=True)
    db_session.add(sem1)
    db_session.commit()
    db_session.refresh(sem1)

    # 2. Create subject "AOC-II" in sem1
    sub_data = {
        "name": "AOC-II",
        "code": "CS301",
        "min_attendance_percent": 75,
        "units_per_class": 1
    }
    res1 = client.post(f"/api/v1/semesters/{sem1.id}/subjects", json=sub_data, headers=headers)
    assert res1.status_code == 201
    subj_id_1 = res1.json()["id"]

    # 3. Create the exact same subject "AOC-II" again in sem1 -> should update/return existing, not duplicate
    res2 = client.post(f"/api/v1/semesters/{sem1.id}/subjects", json=sub_data, headers=headers)
    assert res2.status_code in (200, 201)
    subj_id_2 = res2.json()["id"]
    assert subj_id_1 == subj_id_2

    # Check database only has 1 record for this semester
    subjs_in_db = db_session.query(Subject).filter(Subject.semester_id == sem1.id).all()
    assert len(subjs_in_db) == 1

    # 4. Activate semester 2 and create "AOC-II" there -> allowed across different semesters
    sem2 = Semester(user_id=user.id, name="Semester 2", start_date=date(2026, 8, 1), end_date=date(2026, 12, 15), is_active=True)
    sem1.is_active = False
    db_session.add(sem2)
    db_session.commit()
    db_session.refresh(sem2)

    res3 = client.post(f"/api/v1/semesters/{sem2.id}/subjects", json=sub_data, headers=headers)
    assert res3.status_code == 201
    subj_id_3 = res3.json()["id"]
    assert subj_id_3 != subj_id_1

    # Verify each semester has exactly 1 subject record
    assert len(db_session.query(Subject).filter(Subject.semester_id == sem1.id).all()) == 1
    assert len(db_session.query(Subject).filter(Subject.semester_id == sem2.id).all()) == 1


def test_read_subjects_timetable_filtering_and_historical_preservation(client, db_session):
    # 1. Create user and active semester
    user = User(
        email="test_filter@attendwise.com",
        password_hash=get_password_hash("password123"),
        full_name="Filter Tester",
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    sem = Semester(user_id=user.id, name="Fall 2026", start_date=date(2026, 8, 1), end_date=date(2026, 12, 15), is_active=True)
    db_session.add(sem)
    db_session.commit()
    db_session.refresh(sem)

    # 2. Create Subject A (Current) and Subject B (Removed from Timetable)
    subj_a = Subject(semester_id=sem.id, name="Algorithms", code="CS201", track_attendance=True)
    subj_b = Subject(semester_id=sem.id, name="Old Subject", code="OLD101", track_attendance=True)
    db_session.add_all([subj_a, subj_b])
    db_session.commit()
    db_session.refresh(subj_a)
    db_session.refresh(subj_b)

    # 3. Add TimetableSlot for Subject A only
    slot = TimetableSlot(
        semester_id=sem.id,
        subject_id=subj_a.id,
        day_of_week=0,
        start_time=time(9, 0),
        end_time=time(10, 0)
    )
    # Add historical marked occurrence for Subject B (to ensure it is not lost)
    past_occ = LectureOccurrence(
        semester_id=sem.id,
        subject_id=subj_b.id,
        date=date(2026, 8, 5),
        start_time=time(9, 0),
        end_time=time(10, 0),
        attendance_status="present"
    )
    db_session.add_all([slot, past_occ])
    db_session.commit()

    # 4. GET /subjects (default): returns both subjects
    all_res = client.get(f"/api/v1/semesters/{sem.id}/subjects", headers=headers)
    assert all_res.status_code == 200
    all_subjects = all_res.json()
    assert len(all_subjects) == 2

    # 5. GET /subjects?in_timetable_only=true: returns only Subject A
    tt_res = client.get(f"/api/v1/semesters/{sem.id}/subjects?in_timetable_only=true", headers=headers)
    assert tt_res.status_code == 200
    tt_subjects = tt_res.json()
    assert len(tt_subjects) == 1
    assert tt_subjects[0]["id"] == subj_a.id
    assert tt_subjects[0]["name"] == "Algorithms"

    # 6. Verify Subject B historical attendance is still intact in the database
    occ_in_db = db_session.query(LectureOccurrence).filter(LectureOccurrence.subject_id == subj_b.id).first()
    assert occ_in_db is not None
    assert occ_in_db.attendance_status == "present"


def test_ai_mapping_deduplicates_subjects():
    raw_payload = {
        "semester_name": "Spring 2026",
        "start_date": "2026-01-01",
        "end_date": "2026-05-30",
        "working_days": [0, 1, 2, 3, 4],
        "subjects": [
            {"name": "AOC-II", "code": "CS301", "min_attendance_percent": 75.0},
            {"name": "AOC-II", "code": "CS301", "min_attendance_percent": 75.0},
            {"name": "SD", "code": "CS302", "min_attendance_percent": 80.0},
            {"name": "SD", "code": "CS302", "min_attendance_percent": 80.0},
        ],
        "timetable_slots": [
            {"subject_name": "AOC-II", "subject_code": "CS301", "day_of_week": 0, "start_time": "09:00", "end_time": "10:00"},
            {"subject_name": "SD", "subject_code": "CS302", "day_of_week": 1, "start_time": "10:00", "end_time": "11:00"}
        ]
    }
    review = map_raw_timetable(raw_payload)
    assert len(review.subjects) == 2
    subject_names = [s.name for s in review.subjects]
    assert "AOC-II" in subject_names
    assert "SD" in subject_names
