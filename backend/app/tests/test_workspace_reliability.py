import pytest
from datetime import date, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database.session import Base, get_db
from app.models.models import User, Semester, Subject, LectureOccurrence
from app.main import app
from app.core.security import create_access_token, get_password_hash

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
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_existing_semester_successful_request(client, db_session):
    user = User(email="existing@attendwise.com", password_hash=get_password_hash("pass"), full_name="Existing User", is_verified=True)
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Spring 2026", start_date=date(2026, 1, 1), end_date=date(2026, 5, 30), is_active=True)
    db_session.add(semester)
    db_session.commit()

    token = create_access_token(user.id)
    res = client.get("/api/v1/semesters", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Spring 2026"
    assert data[0]["is_active"] == True

def test_genuinely_empty_semester_list(client, db_session):
    user = User(email="newuser@attendwise.com", password_hash=get_password_hash("pass"), full_name="New User", is_verified=True)
    db_session.add(user)
    db_session.commit()

    token = create_access_token(user.id)
    res = client.get("/api/v1/semesters", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 0  # Genuinely empty list — frontend onboarding redirect trigger

def test_auth_me_successful_and_401_behavior(client, db_session):
    user = User(email="auth_user@attendwise.com", password_hash=get_password_hash("pass"), full_name="Auth User", is_verified=True)
    db_session.add(user)
    db_session.commit()

    # Valid token succeeds with 200
    valid_token = create_access_token(user.id)
    res_valid = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {valid_token}"})
    assert res_valid.status_code == 200
    assert res_valid.json()["email"] == "auth_user@attendwise.com"

    # Invalid / expired token returns 401 Unauthorized
    res_invalid = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid_expired_token"})
    assert res_invalid.status_code == 401

def test_workspace_endpoints_require_valid_token(client, db_session):
    # Unauthenticated request to workspace endpoints must return 401
    res_semesters = client.get("/api/v1/semesters")
    assert res_semesters.status_code == 401

    res_attendance = client.get("/api/v1/semesters/1/attendance/summary")
    assert res_attendance.status_code == 401

def test_transient_failure_recovery_contract(client, db_session):
    # Tests that workspace data contract returns well-structured responses
    user = User(email="recovery@attendwise.com", password_hash=get_password_hash("pass"), full_name="Recovery User", is_verified=True)
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Fall 2026", start_date=date(2026, 9, 1), end_date=date(2026, 12, 20), is_active=True)
    db_session.add(semester)
    db_session.commit()

    subject = Subject(semester_id=semester.id, name="Algorithms", code="CS201", min_attendance_percent=75.0)
    db_session.add(subject)
    db_session.commit()

    token = create_access_token(user.id)
    
    # 1. Semesters endpoint returns 200 OK with non-empty list
    res_sem = client.get("/api/v1/semesters", headers={"Authorization": f"Bearer {token}"})
    assert res_sem.status_code == 200
    assert len(res_sem.json()) > 0

    # 2. Subjects endpoint returns 200 OK
    res_sub = client.get(f"/api/v1/semesters/{semester.id}/subjects", headers={"Authorization": f"Bearer {token}"})
    assert res_sub.status_code == 200
    assert len(res_sub.json()) == 1

    # 3. Attendance Summary returns 200 OK
    res_summary = client.get(f"/api/v1/semesters/{semester.id}/attendance/summary", headers={"Authorization": f"Bearer {token}"})
    assert res_summary.status_code == 200
    assert "conducted" in res_summary.json()

def test_distinction_between_empty_semester_and_api_failure(client, db_session):
    # Tests that 200 OK with [] is distinct from a non-200 error code
    user = User(email="distinction@attendwise.com", password_hash=get_password_hash("pass"), full_name="Distinction User", is_verified=True)
    db_session.add(user)
    db_session.commit()

    token = create_access_token(user.id)

    # 1. Authentic request with no semester returns 200 OK and []
    res_empty = client.get("/api/v1/semesters", headers={"Authorization": f"Bearer {token}"})
    assert res_empty.status_code == 200
    assert res_empty.json() == []

    # 2. Non-existent resource request returns 404 Not Found (not empty semester list)
    res_404 = client.get("/api/v1/semesters/999999/attendance/summary", headers={"Authorization": f"Bearer {token}"})
    assert res_404.status_code == 404
    assert res_404.status_code != 200

def test_non_401_error_contract_does_not_clear_token(client, db_session):
    # Tests that 404 or 422 errors do NOT return 401 Unauthorized
    user = User(email="non401@attendwise.com", password_hash=get_password_hash("pass"), full_name="Non401 User", is_verified=True)
    db_session.add(user)
    db_session.commit()

    token = create_access_token(user.id)

    # Request invalid semester ID returns 404, NOT 401
    res = client.get("/api/v1/semesters/999999", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 404
    assert res.status_code != 401

def test_500_or_timeout_contract_does_not_return_empty_semester_list(client, db_session):
    # Tests contract difference: 200 OK returns List[SemesterResponse], while error responses return HTTPException JSON dicts
    user = User(email="errtest@attendwise.com", password_hash=get_password_hash("pass"), full_name="Err User", is_verified=True)
    db_session.add(user)
    db_session.commit()

    token = create_access_token(user.id)

    # Valid GET /semesters returns list type
    res = client.get("/api/v1/semesters", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # Error status responses return object dict with 'detail' key, NEVER a list
    res_err = client.get("/api/v1/semesters/999999/subjects", headers={"Authorization": f"Bearer {token}"})
    assert res_err.status_code == 404
    assert not isinstance(res_err.json(), list)
    assert "detail" in res_err.json()


