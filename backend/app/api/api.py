from fastapi import APIRouter
from app.api import auth, semesters, subjects, timetable, calendar, attendance, planner

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(semesters.router)
api_router.include_router(subjects.router)
api_router.include_router(timetable.router)
api_router.include_router(calendar.router)
api_router.include_router(attendance.router)
api_router.include_router(planner.router)
