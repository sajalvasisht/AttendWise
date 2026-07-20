from datetime import date, timedelta
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.core.config import settings
from app.models.models import Semester, Subject
from app.services.planner_engine import simulate_leaves, suggest_leaves
from app.services.attendance_engine import calculate_semester_summary
from app.services.ai.exceptions import ExtractionError
from app.services.ai.schemas import (
    ChatResponse,
    IntentExtraction,
    SimulationResultDTO,
    SubjectProjectionDTO,
    SuggestionItemDTO,
    SuggestionResultDTO,
    SubjectSummaryDTO,
    SummaryResultDTO
)

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# Extensible Intent Handler Registry
INTENT_REGISTRY: Dict[str, Any] = {}

def register_intent(name: str):
    def decorator(cls):
        INTENT_REGISTRY[name] = cls()
        return cls
    return decorator

def resolve_date_term(term: str, current_date: date) -> Optional[date]:
    term = term.strip().lower()
    if term == "today":
        return current_date
    if term == "tomorrow":
        return current_date + timedelta(days=1)
    if term == "yesterday":
        return current_date - timedelta(days=1)
    
    for idx, day in enumerate(WEEKDAYS):
        if day in term:
            days_ahead = idx - current_date.weekday()
            if "next" in term:
                if days_ahead <= 0:
                    days_ahead += 7
                else:
                    days_ahead += 7
            else:
                if days_ahead <= 0:
                    days_ahead += 7
            return current_date + timedelta(days=days_ahead)
    return None

def lookup_subject(db: Session, semester_id: int, term: Optional[str]) -> Dict[str, Any]:
    if not term:
        return {"subject": None, "is_ambiguous": False, "clarification_question": None}
        
    term_clean = term.strip().lower()
    subjects = db.query(Subject).filter(Subject.semester_id == semester_id).all()
    
    matches = []
    for s in subjects:
        s_name = s.name.strip().lower()
        s_code = (s.code or "").strip().lower()
        
        if term_clean == s_name or term_clean == s_code:
            matches.append(s)
        elif term_clean in s_name or term_clean in s_code:
            if s not in matches:
                matches.append(s)
                
    if len(matches) == 1:
        return {"subject": matches[0], "is_ambiguous": False, "clarification_question": None}
    elif len(matches) > 1:
        options = ", ".join(f"'{s.name}'" for s in matches)
        return {
            "subject": None,
            "is_ambiguous": True,
            "clarification_question": f"Did you mean {options}?"
        }
    
    return {"subject": None, "is_ambiguous": False, "clarification_question": None}

# Abstract Base Intent Handler
class BaseIntentHandler:
    def execute(self, db: Session, semester_id: int, params: Dict[str, Any]) -> BaseModel:
        raise NotImplementedError()
    def format_context(self, result_dto: BaseModel) -> str:
        raise NotImplementedError()

@register_intent("simulate_leaves")
class SimulateLeavesHandler(BaseIntentHandler):
    def execute(self, db: Session, semester_id: int, params: Dict[str, Any]) -> SimulationResultDTO:
        dates = params.get("dates", [])
        raw_res = simulate_leaves(db, semester_id, dates)
        
        subjects_dto = [
            SubjectProjectionDTO(
                subject_id=s["subject_id"],
                name=s["name"],
                code=s["code"],
                current_percent=s["current_percent"],
                projected_percent=s["projected_percent"],
                current_safe_bunks=s["current_safe_bunks"],
                projected_safe_bunks=s["projected_safe_bunks"],
                is_safe=s["is_safe"],
                recovery_required=s["recovery_required"],
                required_to_attend=s["required_to_attend"]
            )
            for s in raw_res["subjects"]
        ]
        
        return SimulationResultDTO(
            overall_current_percent=raw_res["overall"]["current_percent"],
            overall_projected_percent=raw_res["overall"]["projected_percent"],
            overall_current_safe_bunks=raw_res["overall"]["current_safe_bunks"],
            overall_projected_safe_bunks=raw_res["overall"]["projected_safe_bunks"],
            subjects=subjects_dto,
            missed_lectures=raw_res["missed_lectures"],
            warnings=raw_res["warnings"]
        )

    def format_context(self, dto: SimulationResultDTO) -> str:
        return (
            f"Simulation results: Overall drops from {dto.overall_current_percent}% to {dto.overall_projected_percent}%. "
            f"Overall safe bunks drop from {dto.overall_current_safe_bunks} to {dto.overall_projected_safe_bunks}. "
            f"Warnings: {dto.warnings}. Missed classes: {dto.missed_lectures}."
        )

@register_intent("suggest_leaves")
class SuggestLeavesHandler(BaseIntentHandler):
    def execute(self, db: Session, semester_id: int, params: Dict[str, Any]) -> SuggestionResultDTO:
        raw_suggestions = suggest_leaves(db, semester_id)
        suggestions_dto = [
            SuggestionItemDTO(
                label=s["label"],
                start_date=str(s["start_date"]),
                end_date=str(s["end_date"]),
                dates=[str(d) for d in s["dates"]],
                missed_classes_count=s["missed_classes_count"],
                projected_percent=s["projected_percent"],
                is_safe=s["is_safe"]
            )
            for s in raw_suggestions
        ]
        return SuggestionResultDTO(suggestions=suggestions_dto)

    def format_context(self, dto: SuggestionResultDTO) -> str:
        suggs = [
            f"'{s.label}' on {s.start_date} to {s.end_date} (Safe: {s.is_safe}, Projected overall attendance: {s.projected_percent}%)"
            for s in dto.suggestions
        ]
        return f"Safest leave suggestions: {'; '.join(suggs)}."

@register_intent("safe_bunks_check")
class SafeBunksCheckHandler(BaseIntentHandler):
    def execute(self, db: Session, semester_id: int, params: Dict[str, Any]) -> SummaryResultDTO:
        raw_summary = calculate_semester_summary(db, semester_id)
        
        subjects_dto = [
            SubjectSummaryDTO(
                subject_id=s["subject_id"],
                name=s["name"],
                code=s["code"],
                attendance_percent=s["attendance_percent"],
                min_attendance_percent=s["min_attendance_percent"],
                safe_bunks=s["safe_bunks"],
                required_to_attend=s["required_to_attend"]
            )
            for s in raw_summary["subjects"]
        ]
        
        # Optionally filter by matched subject
        subject_id = params.get("subject_id")
        if subject_id:
            subjects_dto = [s for s in subjects_dto if s.subject_id == subject_id]

        return SummaryResultDTO(
            overall_percent=raw_summary["overall"]["attendance_percent"],
            overall_safe_bunks=raw_summary["overall"]["safe_bunks_budget"],
            subjects=subjects_dto
        )

    def format_context(self, dto: SummaryResultDTO) -> str:
        subjects_str = ", ".join(f"{s.name} ({s.code or 'No code'}): {s.safe_bunks} safe bunks left (Attendance: {s.attendance_percent}%, Min required: {s.min_attendance_percent}%)" for s in dto.subjects)
        return f"Overall safe bunks budget: {dto.overall_safe_bunks}. Subjects: {subjects_str}."

@register_intent("attendance_summary")
class AttendanceSummaryHandler(BaseIntentHandler):
    def execute(self, db: Session, semester_id: int, params: Dict[str, Any]) -> SummaryResultDTO:
        raw_summary = calculate_semester_summary(db, semester_id)
        subjects_dto = [
            SubjectSummaryDTO(
                subject_id=s["subject_id"],
                name=s["name"],
                code=s["code"],
                attendance_percent=s["attendance_percent"],
                min_attendance_percent=s["min_attendance_percent"],
                safe_bunks=s["safe_bunks"],
                required_to_attend=s["required_to_attend"]
            )
            for s in raw_summary["subjects"]
        ]
        return SummaryResultDTO(
            overall_percent=raw_summary["overall"]["attendance_percent"],
            overall_safe_bunks=raw_summary["overall"]["safe_bunks_budget"],
            subjects=subjects_dto
        )

    def format_context(self, dto: SummaryResultDTO) -> str:
        subjects_str = ", ".join(f"{s.name}: {s.attendance_percent}% (Safe bunks: {s.safe_bunks}, Required to attend: {s.required_to_attend})" for s in dto.subjects)
        return f"Overall Attendance: {dto.overall_percent}%, Overall Safe Bunks: {dto.overall_safe_bunks}. Subjects: {subjects_str}."

def fallback_intent_parser(message: str, current_date: date) -> IntentExtraction:
    msg = message.lower()
    
    # Check for unknown / out of domain queries
    if not any(k in msg for k in ["skip", "miss", "leave", "attendance", "bunk", "safest", "suggest", "summary", "status", "tomorrow", "monday", "friday", "class"]):
        return IntentExtraction(intent="unknown")
        
    # Check for specific ambiguity first
    if "miss friday" in msg and not ("this" in msg or "next" in msg):
        return IntentExtraction(
            intent="simulate_leaves",
            relative_date_terms=["friday"],
            is_ambiguous=True,
            clarification_question="Do you mean this Friday or next Friday?"
        )
        
    if "safest" in msg or "suggest" in msg or "recommend" in msg:
        return IntentExtraction(intent="suggest_leaves")
        
    if "how many" in msg or "safe bunk" in msg or "can i miss" in msg:
        subject_name = None
        for word in message.split():
            if word.isupper() and len(word) >= 2:
                subject_name = word
        return IntentExtraction(intent="safe_bunks_check", subject_name=subject_name)
        
    if "summary" in msg or "status" in msg or "overall" in msg:
        return IntentExtraction(intent="attendance_summary")
        
    relative_terms = []
    if "tomorrow" in msg:
        relative_terms.append("tomorrow")
    if "monday" in msg:
        relative_terms.append("monday")
    if "friday" in msg:
        relative_terms.append("friday")
        
    is_ambiguous = False
    clarification_question = None
    if "miss friday" in msg and not ("this" in msg or "next" in msg):
        is_ambiguous = True
        clarification_question = "Do you mean this Friday or next Friday?"
        
    return IntentExtraction(
        intent="simulate_leaves",
        relative_date_terms=relative_terms,
        is_ambiguous=is_ambiguous,
        clarification_question=clarification_question
    )

def fallback_response_generator(intent: str, context_info: str) -> str:
    if intent == "unknown":
        return "I can help you simulate future absences, check remaining safe leaves/bunks, suggest safest leave windows, or display your overall attendance summary. Please ask something related to your academic schedule."
    return f"Here is what I calculated from the planning engine: {context_info}"

def extract_intent_via_gemini(message: str, current_date: date) -> IntentExtraction:
    if not settings.GEMINI_API_KEY:
        return fallback_intent_parser(message, current_date)
        
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    weekday = current_date.strftime("%A")
    try:
        response = client.models.generate_content(
            model='gemini-flash-latest',
            contents=[
                f"Analyze this query: '{message}'"
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=IntentExtraction,
                system_instruction=(
                    f"You are an academic planner intent classifier. Today is {current_date} ({weekday}). "
                    "Classify user intent into: 'simulate_leaves', 'safe_bunks_check', 'suggest_leaves', 'attendance_summary', or 'unknown'. "
                    "Extract subject_name if mentioned. "
                    "Extract relative_date_terms (e.g. 'tomorrow', 'Friday', 'next Monday') and concrete_dates (YYYY-MM-DD). "
                    "Do NOT resolve relative dates yourself. Leave them in relative_date_terms."
                )
            )
        )
        return IntentExtraction.model_validate_json(response.text)
    except Exception as e:
        print(f"Gemini intent classification error: {str(e)}")
        return fallback_intent_parser(message, current_date)

def generate_user_reply(message: str, intent: str, context_info: str) -> str:
    if not settings.GEMINI_API_KEY:
        return fallback_response_generator(intent, context_info)
        
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    try:
        response = client.models.generate_content(
            model='gemini-flash-latest',
            contents=[
                f"User asked: '{message}'. Context from planner engine: {context_info}. Write a short, clear response."
            ],
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are the AttendWise AI Leave Assistant. "
                    "Formulate a friendly, concise, and highly actionable response to the user's question. "
                    "Explain the results using the structured planner engine calculations provided in the context. "
                    "Do NOT perform any attendance calculations or percentage math on your own. "
                    "Rely 100% on the figures provided in the context. Keep your response under 3 sentences."
                )
            )
        )
        return response.text.strip()
    except Exception as e:
        print(f"Gemini response generation error: {str(e)}")
        return fallback_response_generator(intent, context_info)

def process_assistant_message(db: Session, semester_id: int, message: str, current_date: date) -> ChatResponse:
    # 1. Parse intent and arguments
    extraction = extract_intent_via_gemini(message, current_date)
    
    # Graceful handling of unknown intent
    if extraction.intent == "unknown":
        reply = fallback_response_generator("unknown", "")
        return ChatResponse(reply=reply, intent="unknown", clarification_needed=False)
        
    # Handle ambiguous flag from Gemini
    if extraction.is_ambiguous:
        return ChatResponse(
            reply=extraction.clarification_question or "Could you clarify that request?",
            intent=extraction.intent,
            clarification_needed=True
        )

    # 2. Subject Name matching ( trimmed, case-insensitive, codes & names, with ambiguous options check )
    subject_match = lookup_subject(db, semester_id, extraction.subject_name)
    if subject_match["is_ambiguous"]:
        return ChatResponse(
            reply=subject_match["clarification_question"],
            intent=extraction.intent,
            clarification_needed=True
        )
    
    # 3. Resolve relative dates to date objects deterministically on backend
    resolved_dates = []
    for term in extraction.relative_date_terms:
        d = resolve_date_term(term, current_date)
        if d:
            resolved_dates.append(d)
            
    for dt_str in extraction.concrete_dates:
        try:
            resolved_dates.append(date.fromisoformat(dt_str))
        except ValueError:
            pass

    # For simulate_leaves, check that dates exist
    if extraction.intent == "simulate_leaves" and not resolved_dates:
        # Default to tomorrow if not specified
        resolved_dates.append(current_date + timedelta(days=1))

    # 4. Dispatch to Intent registry
    handler = INTENT_REGISTRY.get(extraction.intent)
    if not handler:
        reply = fallback_response_generator("unknown", "")
        return ChatResponse(reply=reply, intent="unknown", clarification_needed=False)

    # Prepare dispatcher execution params
    params = {}
    if extraction.intent == "simulate_leaves":
        params["dates"] = resolved_dates
    elif extraction.intent == "safe_bunks_check":
        matched_subj = subject_match["subject"]
        if matched_subj:
            params["subject_id"] = matched_subj.id

    try:
        # Execute business logic
        dto_result = handler.execute(db, semester_id, params)
        # Format calculation contexts
        formatted_context = handler.format_context(dto_result)
        # Generate user friendly reply
        reply = generate_user_reply(message, extraction.intent, formatted_context)
        return ChatResponse(reply=reply, intent=extraction.intent, clarification_needed=False)
    except Exception as e:
        print(f"Assistant dispatcher execution failed: {str(e)}")
        return ChatResponse(
            reply="I encountered an issue processing your schedule data. Please review your manual planner inputs.",
            intent=extraction.intent,
            clarification_needed=False
        )
