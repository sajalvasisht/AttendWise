from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    semesters = relationship("Semester", back_populates="user", cascade="all, delete-orphan")


class Semester(Base):
    __tablename__ = "semesters"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    working_days = Column(String, default="0,1,2,3,4", nullable=False)  # comma separated day indexes (0=Mon, 6=Sun)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="semesters")
    subjects = relationship("Subject", back_populates="semester", cascade="all, delete-orphan")
    timetable_slots = relationship("TimetableSlot", back_populates="semester", cascade="all, delete-orphan")
    calendar_events = relationship("CalendarEvent", back_populates="semester", cascade="all, delete-orphan")
    lecture_occurrences = relationship("LectureOccurrence", back_populates="semester", cascade="all, delete-orphan")
    planned_leaves = relationship("PlannedLeave", back_populates="semester", cascade="all, delete-orphan")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=True)
    faculty = Column(String, nullable=True)
    min_attendance_percent = Column(Float, default=75.0, nullable=False)

    semester = relationship("Semester", back_populates="subjects")
    timetable_slots = relationship("TimetableSlot", back_populates="subject", cascade="all, delete-orphan")
    lecture_occurrences = relationship("LectureOccurrence", back_populates="subject", cascade="all, delete-orphan")


class TimetableSlot(Base):
    __tablename__ = "timetable_slots"

    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    semester = relationship("Semester", back_populates="timetable_slots")
    subject = relationship("Subject", back_populates="timetable_slots")


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


class LectureOccurrence(Base):
    __tablename__ = "lecture_occurrences"

    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    attendance_status = Column(String, default="unmarked", nullable=False)  # "present", "absent", "cancelled", "unmarked"

    semester = relationship("Semester", back_populates="lecture_occurrences")
    subject = relationship("Subject", back_populates="lecture_occurrences")


class PlannedLeave(Base):
    __tablename__ = "planned_leaves"

    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    reason = Column(String, nullable=True)

    semester = relationship("Semester", back_populates="planned_leaves")
