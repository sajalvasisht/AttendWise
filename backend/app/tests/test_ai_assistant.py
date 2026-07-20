import pytest
from datetime import date, time, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock, patch

from app.database.session import Base
from app.models.models import User, Semester, Subject, TimetableSlot
from app.services.ai.schemas import ChatMessage, ChatResponse
from app.services.ai.assistant import (
    resolve_date_term,
    lookup_subject,
    process_assistant_message,
    INTENT_REGISTRY,
    BaseIntentHandler
)
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

def test_date_resolution_helpers():
    ref_date = date(2026, 7, 20)  # Monday
    
    assert resolve_date_term("today", ref_date) == date(2026, 7, 20)
    assert resolve_date_term("tomorrow", ref_date) == date(2026, 7, 21)
    assert resolve_date_term("yesterday", ref_date) == date(2026, 7, 19)
    
    # "friday" -> should be upcoming Friday, which is 2026-07-24 (Friday)
    assert resolve_date_term("friday", ref_date) == date(2026, 7, 24)
    # "next monday" -> should be Monday next week, which is 2026-07-27
    assert resolve_date_term("next monday", ref_date) == date(2026, 7, 27)

def test_fuzzy_subject_lookup(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Test Sem", start_date=date(2026, 9, 1), end_date=date(2026, 12, 1), working_days="0,1,2,3,4")
    db_session.add(semester)
    db_session.commit()

    s1 = Subject(semester_id=semester.id, name="Database Management Systems", code="DBMS")
    s2 = Subject(semester_id=semester.id, name="Design and Analysis of Algorithms", code="DAA")
    s3 = Subject(semester_id=semester.id, name="Database Systems Advanced", code="DSA")
    db_session.add_all([s1, s2, s3])
    db_session.commit()

    # Exact matching code case-insensitive
    res1 = lookup_subject(db_session, semester.id, "dbms")
    assert res1["subject"] == s1
    assert not res1["is_ambiguous"]

    # Substring matching name
    res2 = lookup_subject(db_session, semester.id, "Algorithms")
    assert res2["subject"] == s2
    assert not res2["is_ambiguous"]

    # Ambiguity: "Database" matches both s1 and s3
    res3 = lookup_subject(db_session, semester.id, "Database")
    assert res3["subject"] is None
    assert res3["is_ambiguous"]
    assert "Did you mean" in res3["clarification_question"]
    assert "Database Management Systems" in res3["clarification_question"]

def test_extensible_intent_dispatcher():
    # Verify dispatcher registry contains default intents
    assert "simulate_leaves" in INTENT_REGISTRY
    assert "suggest_leaves" in INTENT_REGISTRY
    assert "safe_bunks_check" in INTENT_REGISTRY
    assert "attendance_summary" in INTENT_REGISTRY

def test_assistant_unknown_fails_gracefully(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Test Sem", start_date=date(2026, 9, 1), end_date=date(2026, 12, 1), working_days="0,1,2,3,4")
    db_session.add(semester)
    db_session.commit()

    # Ask an out-of-domain question
    response = process_assistant_message(
        db=db_session,
        semester_id=semester.id,
        message="What is the capital of France?",
        current_date=date(2026, 7, 20)
    )
    assert response.intent == "unknown"
    assert "attendance tracking" in response.reply or "simulate future absences" in response.reply
    assert not response.clarification_needed

def test_assistant_ambiguous_friday_query(db_session):
    user = User(email="test@attendwise.com", password_hash=get_password_hash("test"), full_name="Tester")
    db_session.add(user)
    db_session.commit()

    semester = Semester(user_id=user.id, name="Test Sem", start_date=date(2026, 9, 1), end_date=date(2026, 12, 1), working_days="0,1,2,3,4")
    db_session.add(semester)
    db_session.commit()

    # Query matching ambiguity fallback trigger
    response = process_assistant_message(
        db=db_session,
        semester_id=semester.id,
        message="Can I miss Friday?",
        current_date=date(2026, 7, 20)
    )
    assert response.clarification_needed
    assert "Do you mean this Friday or next Friday?" in response.reply
