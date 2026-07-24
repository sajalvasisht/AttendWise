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
    assert res_json["is_verified"] is False

    # Check database token was generated
    user = db_session.query(User).filter(User.email == "verify_me@attendwise.com").first()
    assert user is not None
    assert user.is_verified is False
    assert user.verification_token is not None
    token = user.verification_token

    # 2. Login should fail because email is unverified
    login_data = {
        "username": "verify_me@attendwise.com",
        "password": "securepassword"
    }
    login_res = client.post("/api/v1/auth/login", data=login_data)
    assert login_res.status_code == 401
    assert "verify" in login_res.json()["detail"].lower()

    # 3. Verify Email
    verify_res = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert verify_res.status_code == 200
    assert "verified" in verify_res.json()["message"].lower()

    # Database check
    db_session.refresh(user)
    assert user.is_verified is True
    assert user.verification_token is None

    # 4. Login should now succeed
    login_res2 = client.post("/api/v1/auth/login", data=login_data)
    assert login_res2.status_code == 200
    assert "access_token" in login_res2.json()

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
