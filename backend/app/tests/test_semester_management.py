import pytest
from datetime import date, time
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database.session import Base
from app.models.models import User, Semester, Subject, LectureOccurrence
from app.main import app
from app.database.session import get_db

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

def test_multiple_semester_and_active_switching_flow(client, db_session):
    # 1. Register & verify test user
    reg_data = {
        "email": "sem_test@attendwise.com",
        "password": "securepassword",
        "full_name": "Semester Tester"
    }
    client.post("/api/v1/auth/register", json=reg_data)
    user = db_session.query(User).filter(User.email == "sem_test@attendwise.com").first()
    user.is_verified = True
    db_session.commit()

    # Authenticate
    login_res = client.post("/api/v1/auth/login", data={
        "username": "sem_test@attendwise.com",
        "password": "securepassword"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create first semester (should default to active = True)
    sem1_data = {
        "name": "Fall 2025",
        "start_date": "2025-09-01",
        "end_date": "2025-12-15",
        "working_days": "0,1,2,3,4"
    }
    res1 = client.post("/api/v1/semesters", json=sem1_data, headers=headers)
    assert res1.status_code == 201
    sem1_id = res1.json()["id"]
    assert res1.json()["is_active"] is True

    # 3. Create second semester (should deactivate the first one)
    sem2_data = {
        "name": "Spring 2026",
        "start_date": "2026-01-05",
        "end_date": "2026-05-01",
        "working_days": "0,1,2,3,4"
    }
    res2 = client.post("/api/v1/semesters", json=sem2_data, headers=headers)
    assert res2.status_code == 201
    sem2_id = res2.json()["id"]
    assert res2.json()["is_active"] is True

    # Check database: first semester is deactivated, second is active
    db_session.expire_all()
    sem1 = db_session.query(Semester).filter(Semester.id == sem1_id).first()
    sem2 = db_session.query(Semester).filter(Semester.id == sem2_id).first()
    assert sem1.is_active is False
    assert sem2.is_active is True

    # Get active semester endpoint
    active_res = client.get("/api/v1/semesters/active", headers=headers)
    assert active_res.status_code == 200
    assert active_res.json()["id"] == sem2_id

    # 4. Try modifying first semester (now inactive/read-only) -> should fail
    sub_data = {
        "name": "Math",
        "code": "MATH101",
        "min_attendance_percent": 75
    }
    fail_res = client.post(f"/api/v1/semesters/{sem1_id}/subjects", json=sub_data, headers=headers)
    assert fail_res.status_code == 400
    assert "read-only" in fail_res.json()["detail"].lower()

    # 5. Modify active semester -> should succeed
    success_res = client.post(f"/api/v1/semesters/{sem2_id}/subjects", json=sub_data, headers=headers)
    assert success_res.status_code == 201
    sub_id = success_res.json()["id"]

    # 6. Switch active semester back to semester 1
    activate_res = client.post(f"/api/v1/semesters/{sem1_id}/activate", headers=headers)
    assert activate_res.status_code == 200
    assert activate_res.json()["is_active"] is True

    db_session.refresh(sem1)
    db_session.refresh(sem2)
    assert sem1.is_active is True
    assert sem2.is_active is False

def test_delete_user_cascade_and_password_change(client, db_session):
    # 1. Register & verify test user
    reg_data = {
        "email": "del_test@attendwise.com",
        "password": "oldpassword",
        "full_name": "Delete Tester"
    }
    client.post("/api/v1/auth/register", json=reg_data)
    user = db_session.query(User).filter(User.email == "del_test@attendwise.com").first()
    user.is_verified = True
    db_session.commit()

    # Authenticate
    login_res = client.post("/api/v1/auth/login", data={
        "username": "del_test@attendwise.com",
        "password": "oldpassword"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Change password
    change_res = client.post("/api/v1/auth/change-password", json={
        "old_password": "oldpassword",
        "new_password": "newpassword123"
    }, headers=headers)
    assert change_res.status_code == 200

    # Login with old password should fail
    login_fail = client.post("/api/v1/auth/login", data={
        "username": "del_test@attendwise.com",
        "password": "oldpassword"
    })
    assert login_fail.status_code == 401

    # Login with new password should succeed
    login_ok = client.post("/api/v1/auth/login", data={
        "username": "del_test@attendwise.com",
        "password": "newpassword123"
    })
    assert login_ok.status_code == 200

    # 3. Delete account
    del_res = client.delete("/api/v1/auth/me", headers=headers)
    assert del_res.status_code == 204

    # Verify user no longer exists
    user_deleted = db_session.query(User).filter(User.email == "del_test@attendwise.com").first()
    assert user_deleted is None
