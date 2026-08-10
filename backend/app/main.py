from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AttendWise Backend API - Intelligent Attendance Planning Platform",
    version="1.0.0",
    debug=settings.DEBUG
)

# Set up CORS middleware restricted to configured FRONTEND_URL origins
origins = [o.strip() for o in settings.FRONTEND_URL.split(",") if o.strip()] if settings.FRONTEND_URL else ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "message": f"Welcome to the {settings.PROJECT_NAME} API!",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "source": "AttendWise FastAPI",
        "test": "deployment-check"
    }
