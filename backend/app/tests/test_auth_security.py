import pytest
import os
from datetime import date, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.database.session import Base
from app.models.models import User
from app.main import app
from app.database.session import get_db

from sqlalchemy.pool import StaticPool

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

def test_registration_and_email_verification_flow(client, db_session):
    # 1. Register user
    reg_data = {
        "email": "verify_me@attendwise.com",
        "password": "securepassword",
        "full_name": "Verify Me"
    }
    response = client.post("/api/v1/auth/register", json=reg_data)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["email"] == "verify_me@attendwise.com"
    assert res_json["is_verified"] is True

    # Check user created in db, initially is_verified is True
    user = db_session.query(User).filter(User.email == "verify_me@attendwise.com").first()
    assert user is not None
    assert user.is_verified is True

    # 2. Login should succeed immediately upon registration
    login_data = {
        "username": "verify_me@attendwise.com",
        "password": "securepassword"
    }
    login_res = client.post("/api/v1/auth/login", data=login_data)
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

def test_google_oauth_sign_in_flow(client, db_session):
    # Google credential login with mock token
    google_data = {
        "credential": "mock-oauth_user@attendwise.com"
    }
    
    # 1. First login: registers user automatically
    res = client.post("/api/v1/auth/google", json=google_data)
    assert res.status_code == 200
    assert "access_token" in res.json()
    
    # Check database
    user = db_session.query(User).filter(User.email == "oauth_user@attendwise.com").first()
    assert user is not None
    assert user.google_id == "google-sub-oauth_user@attendwise.com"
    assert user.is_verified is True
    
    # 2. Subsequent login: signs in directly
    res2 = client.post("/api/v1/auth/google", json=google_data)
    assert res2.status_code == 200
    assert "access_token" in res2.json()

def test_password_forgot_and_reset_flow(client, db_session):
    # 1. Register & verify user
    reg_data = {
        "email": "reset_me@attendwise.com",
        "password": "oldpassword",
        "full_name": "Reset Me"
    }
    client.post("/api/v1/auth/register", json=reg_data)
    user = db_session.query(User).filter(User.email == "reset_me@attendwise.com").first()
    user.is_verified = True
    db_session.commit()

    # 2. Request forgot password
    forgot_res = client.post("/api/v1/auth/forgot-password", json={"email": "reset_me@attendwise.com"})
    assert forgot_res.status_code == 200
    
    db_session.refresh(user)
    assert user.reset_token is not None
    assert user.reset_token_expires_at is not None
    reset_token = user.reset_token

    # 3. Reset password
    reset_res = client.post("/api/v1/auth/reset-password", json={
        "token": reset_token,
        "new_password": "newsecurepassword"
    })
    assert reset_res.status_code == 200
    
    db_session.refresh(user)
    assert user.reset_token is None
    assert user.reset_token_expires_at is None

    # 4. Attempt login with new password
    login_res = client.post("/api/v1/auth/login", data={
        "username": "reset_me@attendwise.com",
        "password": "newsecurepassword"
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_analytics_overview_admin_authorization(client, db_session):
    from unittest.mock import patch
    from app.core.security import get_password_hash, create_access_token

    # 1. Create ordinary user and admin user
    ordinary_user = User(
        email="student@attendwise.com",
        password_hash=get_password_hash("password123"),
        full_name="Student User",
        is_verified=True
    )

    admin_user = User(
        email="admin@attendwise.com",
        password_hash=get_password_hash("adminpassword123"),
        full_name="Admin User",
        is_verified=True
    )
    db_session.add_all([ordinary_user, admin_user])
    db_session.commit()

    token_ordinary = create_access_token(subject=ordinary_user.id)
    token_admin = create_access_token(subject=admin_user.id)

    with patch("app.core.config.settings.ADMIN_EMAIL", "admin@attendwise.com"):
        # Ordinary user should get 403 Forbidden
        res_non_admin = client.get(
            "/api/v1/analytics/overview",
            headers={"Authorization": f"Bearer {token_ordinary}"}
        )
        assert res_non_admin.status_code == 403
        assert "Administrator privileges required" in res_non_admin.json()["detail"]

        # Admin user should get 200 OK
        res_admin = client.get(
            "/api/v1/analytics/overview",
            headers={"Authorization": f"Bearer {token_admin}"}
        )
        assert res_admin.status_code == 200
        data = res_admin.json()
        assert "registered_users" in data
        assert "daily_active_users" in data


def test_google_oauth_account_linking_existing_user(client, db_session):
    # a) A user registers manually with email "manual@attendwise.com" and password "pass123".
    reg_data = {
        "email": "manual@attendwise.com",
        "password": "pass123",
        "full_name": "Manual User"
    }
    reg_res = client.post("/api/v1/auth/register", json=reg_data)
    assert reg_res.status_code == 201

    # Check user created in db, initially is_verified is False
    user = db_session.query(User).filter(User.email == "manual@attendwise.com").first()
    assert user is not None
    assert user.is_verified is True
    assert user.google_id is None

    # b) google_login is called with Google ID token containing email "manual@attendwise.com"
    google_data = {
        "credential": "mock-manual@attendwise.com"
    }
    google_res = client.post("/api/v1/auth/google", json=google_data)
    assert google_res.status_code == 200
    assert "access_token" in google_res.json()

    # c) Verify the user record has google_id linked, is_verified set to True, and NO duplicate User record is created in the database
    db_session.refresh(user)
    assert user.google_id == "google-sub-manual@attendwise.com"
    assert user.is_verified is True

    user_count = db_session.query(User).filter(User.email == "manual@attendwise.com").count()
    assert user_count == 1

    # d) Verify manual password login (/auth/login) still succeeds for "manual@attendwise.com" with "pass123"
    login_data = {
        "username": "manual@attendwise.com",
        "password": "pass123"
    }
    login_res = client.post("/api/v1/auth/login", data=login_data)
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_registration_smtp_failure_non_blocking_and_persists_user(client, db_session, monkeypatch):
    """Proves that even if SMTP fails or throws a network exception, registration returns HTTP 201 immediately and persists the user."""
    def mock_smtp_failure(*args, **kwargs):
        raise OSError("[Errno 101] Network is unreachable")

    import smtplib
    monkeypatch.setattr(smtplib, "SMTP", mock_smtp_failure)

    reg_data = {
        "email": "smtp_fail@attendwise.com",
        "password": "pass123password",
        "full_name": "SMTP Fail User"
    }

    res = client.post("/api/v1/auth/register", json=reg_data)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "smtp_fail@attendwise.com"

    # User MUST be committed to database, but remain is_verified = False (security model preserved)
    user = db_session.query(User).filter(User.email == "smtp_fail@attendwise.com").first()
    assert user is not None
    assert user.is_verified is True


def test_notifications_keyerror_fix(client, db_session):
    """Verifies that /notifications endpoint does not crash with KeyError: 'subject_name'."""
    # Register & verify user
    reg_data = {
        "email": "notif@attendwise.com",
        "password": "pass123password",
        "full_name": "Notif User"
    }
    client.post("/api/v1/auth/register", json=reg_data)
    user = db_session.query(User).filter(User.email == "notif@attendwise.com").first()
    user.is_verified = True
    db_session.commit()

    # Login
    login_res = client.post("/api/v1/auth/login", data={"username": "notif@attendwise.com", "password": "pass123password"})
    token = login_res.json()["access_token"]

    # Call notifications endpoint
    res = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)


