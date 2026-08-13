from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey, DateTime, Float, Boolean, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String, nullable=True)
    reset_token = Column(String, nullable=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    profile_picture = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    semesters = relationship("Semester", back_populates="user", cascade="all, delete-orphan")
    events = relationship("UserEvent", back_populates="user", cascade="all, delete-orphan")


class Semester(Base):
    __tablename__ = "semesters"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    working_days = Column(String, default="0,1,2,3,4", nullable=False)  # comma separated day indexes (0=Mon, 6=Sun)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="semesters")
    subjects = relationship("Subject", back_populates="semester", cascade="all, delete-orphan")
    timetable_slots = relationship("TimetableSlot", back_populates="semester", cascade="all, delete-orphan")
    calendar_events = relationship("CalendarEvent", back_populates="semester", cascade="all, delete-orphan")
    lecture_occurrences = relationship("LectureOccurrence", back_populates="semester", cascade="all, delete-orphan")
    planned_leaves = relationship("PlannedLeave", back_populates="semester", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_semesters_user_id", "user_id"),
    )


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=True)
    faculty = Column(String, nullable=True)
    min_attendance_percent = Column(Float, default=75.0, nullable=False)
    units_per_class = Column(Integer, default=1, nullable=False)
    units_earned_per_class = Column(Integer, default=1, nullable=False)
    units_lost_per_class = Column(Integer, default=1, nullable=False)
    initial_conducted = Column(Integer, default=None, nullable=True)
    initial_attended = Column(Integer, default=None, nullable=True)
    track_attendance = Column(Boolean, default=True, nullable=False)
    active_from = Column(Date, nullable=True)
    active_until = Column(Date, nullable=True)

    semester = relationship("Semester", back_populates="subjects")
    timetable_slots = relationship("TimetableSlot", back_populates="subject", cascade="all, delete-orphan")
    lecture_occurrences = relationship("LectureOccurrence", back_populates="subject", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_subjects_sem_id", "semester_id"),
    )


class TimetableSlot(Base):
    __tablename__ = "timetable_slots"

    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    room = Column(String, nullable=True)

    semester = relationship("Semester", back_populates="timetable_slots")
    subject = relationship("Subject", back_populates="timetable_slots")

    __table_args__ = (
        Index("ix_timetable_slots_sem_id", "semester_id"),
    )


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    event_type = Column(String, nullable=False)  # "holiday", "working_day_override", "college_closure", "exam_break", "working_saturday", "exam", "exam_day"
    description = Column(String, nullable=True)
    timetable_day_override = Column(Integer, nullable=True)  # weekday timetable to run (0=Mon, 6=Sun)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    title = Column(String, nullable=True)
    category = Column(String, nullable=True)  # "Holiday", "Assessment", "College Closure", "Working Day Override", "Other"
    schedule_effect = Column(String, nullable=True)  # "KEEP_LECTURES", "REPLACE_LECTURES", "OVERRIDE_TIMETABLE"
    end_date = Column(Date, nullable=True)

    semester = relationship("Semester", back_populates="calendar_events")
    subject = relationship("Subject")

    __table_args__ = (
        Index("ix_calendar_events_sem_date", "semester_id", "date"),
    )


class LectureOccurrence(Base):
    __tablename__ = "lecture_occurrences"

    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    attendance_status = Column(String, default="unmarked", nullable=False)  # "present", "absent", "cancelled", "unmarked"
    room = Column(String, nullable=True)
    is_imported = Column(Boolean, default=False, server_default="false", nullable=False)
    # is_imported=True: status was set by the historical attendance import engine
    # is_imported=False: status was set (or reset) by the student manually


    semester = relationship("Semester", back_populates="lecture_occurrences")
    subject = relationship("Subject", back_populates="lecture_occurrences")

    __table_args__ = (
        Index("ix_lecture_occurrences_sem_date", "semester_id", "date"),
        Index("ix_lecture_occurrences_sem_subject", "semester_id", "subject_id"),
    )


class PlannedLeave(Base):
    __tablename__ = "planned_leaves"

    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    reason = Column(String, nullable=True)

    semester = relationship("Semester", back_populates="planned_leaves")


class UserEvent(Base):
    """Lightweight product analytics event store.

    Tracks anonymous usage events (e.g. LOGIN, MARK_ATTENDANCE) without
    collecting any sensitive content (passwords, attendance data, AI prompts).
    All analytics logging is fire-and-forget to avoid blocking requests.

    Supported event_type values (exhaustive list for beta):
      LOGIN, IMPORT_TIMETABLE, IMPORT_CALENDAR, MARK_ATTENDANCE,
      AI_QUERY, SUBJECT_CREATED, SETUP_COMPLETED, FEEDBACK_SUBMITTED
    """
    __tablename__ = "user_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    page = Column(String, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)  # non-sensitive context only
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    user = relationship("User", back_populates="events")


    __table_args__ = (
        # Composite index for the most common analytics query patterns:
        # - events by user in time range
        # - count of event_type per day/week/month
        Index("ix_user_events_user_created", "user_id", "created_at"),
        Index("ix_user_events_type_created", "event_type", "created_at"),
    )
