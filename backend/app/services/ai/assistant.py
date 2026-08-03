from datetime import date, timedelta
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.core.config import settings
from app.models.models import Semester, Subject, CalendarEvent, LectureOccurrence
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
    SummaryResultDTO,
    NextEventResultDTO
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
                required_to_attend=s["required_to_attend"],
                units_per_class=s.get("units_per_class", 1)
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
        import math
        subjects_str = []
        for s in dto.subjects:
            proj_safe_classes = s.projected_safe_bunks // s.units_per_class
            curr_safe_classes = s.current_safe_bunks // s.units_per_class
            req_classes = math.ceil(s.required_to_attend / s.units_per_class)
            
            sub_info = f"{s.name}: {s.current_percent}% -> {s.projected_percent}% (Safe classes left to miss: {proj_safe_classes} (was {curr_safe_classes}))"
            if s.recovery_required:
                sub_info += f" [Warning: You are below target! Must attend next {req_classes} scheduled classes consecutively to recover]"
            subjects_str.append(sub_info)
            
        subjects_formatted = ", ".join(subjects_str)
        return (
            f"Simulation results for taking leaves: Overall projected attendance is {dto.overall_projected_percent}% (currently {dto.overall_current_percent}%). "
            f"Subjects projections: {subjects_formatted}. Warnings: {dto.warnings}. Missed classes details: {dto.missed_lectures}."
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
                required_to_attend=s["required_to_attend"],
                units_per_class=s.get("units_per_class", 1)
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
        subjects_str = []
        for s in dto.subjects:
            safe_classes = s.safe_bunks // s.units_per_class
            subjects_str.append(f"{s.name} ({s.code or 'No code'}): {safe_classes} classes left to safely miss (Attendance: {s.attendance_percent}%, Min required: {s.min_attendance_percent}%)")
        return "Subjects safe absence allowance: " + ", ".join(subjects_str)

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
                required_to_attend=s["required_to_attend"],
                units_per_class=s.get("units_per_class", 1)
            )
            for s in raw_summary["subjects"]
        ]
        return SummaryResultDTO(
            overall_percent=raw_summary["overall"]["attendance_percent"],
            overall_safe_bunks=raw_summary["overall"]["safe_bunks_budget"],
            subjects=subjects_dto
        )

    def format_context(self, dto: SummaryResultDTO) -> str:
        import math
        subjects_str = []
        for s in dto.subjects:
            safe_classes = s.safe_bunks // s.units_per_class
            req_classes = math.ceil(s.required_to_attend / s.units_per_class)
            sub_info = f"{s.name}: {s.attendance_percent}% (Safe classes left: {safe_classes})"
            if s.attendance_percent < s.min_attendance_percent:
                sub_info += f" [Warning: You are below target! Must attend next {req_classes} classes consecutively to recover]"
            subjects_str.append(sub_info)
        return f"Overall Attendance: {dto.overall_percent}%. Course standings: " + ", ".join(subjects_str)

@register_intent("get_subject_health")
class GetSubjectHealthHandler(BaseIntentHandler):
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
                required_to_attend=s["required_to_attend"],
                units_per_class=s.get("units_per_class", 1)
            )
            for s in raw_summary["subjects"]
        ]
        
        # Sort subjects by risk: subjects below target first (highest required_to_attend descending),
        # then subjects with safe_bunks == 0, then by current attendance percentage ascending.
        def get_risk_score(s: SubjectSummaryDTO):
            if s.attendance_percent < s.min_attendance_percent:
                return (0, -s.required_to_attend)
            if s.safe_bunks == 0:
                return (1, s.attendance_percent)
            return (2, s.attendance_percent)
            
        subjects_dto.sort(key=get_risk_score)
        
        return SummaryResultDTO(
            overall_percent=raw_summary["overall"]["attendance_percent"],
            overall_safe_bunks=raw_summary["overall"]["safe_bunks_budget"],
            subjects=subjects_dto
        )

    def format_context(self, dto: SummaryResultDTO) -> str:
        import math
        subjects_str = []
        for s in dto.subjects:
            safe_classes = s.safe_bunks // s.units_per_class
            req_classes = math.ceil(s.required_to_attend / s.units_per_class)
            subjects_str.append(
                f"{s.name} ({s.code or 'No code'}): Attendance is {s.attendance_percent}% (Target: {s.min_attendance_percent}%, Safe classes left to miss: {safe_classes}, Required consecutive classes to attend: {req_classes})" 
            )
        return f"Course standings sorted by risk: {', '.join(subjects_str)}."

@register_intent("next_event")
class NextEventHandler(BaseIntentHandler):
    def execute(self, db: Session, semester_id: int, params: Dict[str, Any]) -> NextEventResultDTO:
        today_val = date.today()
        event = db.query(CalendarEvent).filter(
            CalendarEvent.semester_id == semester_id,
            CalendarEvent.date >= today_val
        ).order_by(CalendarEvent.date).first()
        
        if not event:
            raise ValueError("No upcoming events or holidays found in the calendar.")
            
        days_until = (event.date - today_val).days
        return NextEventResultDTO(
            title=event.title or event.description or "Holiday/Override",
            date=str(event.date),
            event_type=event.event_type,
            description=event.description or event.title,
            days_until=days_until
        )

    def format_context(self, dto: NextEventResultDTO) -> str:
        return f"Next calendar event/holiday: '{dto.title}' ({dto.event_type}) on {dto.date}. This is in {dto.days_until} day(s)."

@register_intent("simulate_attendance")
class SimulateAttendanceHandler(BaseIntentHandler):
    def execute(self, db: Session, semester_id: int, params: Dict[str, Any]) -> SimulationResultDTO:
        dates = params.get("dates", [])
        savepoint = db.begin_nested()
        
        try:
            current_summary = calculate_semester_summary(db, semester_id)
            
            # Find target occurrences on selected dates
            target_occurrences = db.query(LectureOccurrence).filter(
                LectureOccurrence.semester_id == semester_id,
                LectureOccurrence.date.in_(dates)
            ).all()
            
            attended_lectures = []
            for occ in target_occurrences:
                if occ.attendance_status not in ("cancelled",):
                    attended_lectures.append({
                        "subject_name": occ.subject.name,
                        "date": occ.date,
                        "start_time": occ.start_time,
                        "end_time": occ.end_time
                    })
                    occ.attendance_status = "present"
            
            # Treat unmarked as present
            unmarked = db.query(LectureOccurrence).filter(
                LectureOccurrence.semester_id == semester_id,
                LectureOccurrence.attendance_status == "unmarked"
            ).all()
            for occ in unmarked:
                occ.attendance_status = "present"
                
            db.flush()
            projected_summary = calculate_semester_summary(db, semester_id)
        finally:
            savepoint.rollback()
            
        curr_subjs = {s["subject_id"]: s for s in current_summary["subjects"]}
        proj_subjs = {s["subject_id"]: s for s in projected_summary["subjects"]}
        
        subjects_dto = []
        for sid, curr_s in curr_subjs.items():
            proj_s = proj_subjs[sid]
            is_safe = proj_s["attendance_percent"] >= curr_s["min_attendance_percent"]
            subjects_dto.append(
                SubjectProjectionDTO(
                    subject_id=sid,
                    name=curr_s["name"],
                    code=curr_s["code"],
                    current_percent=curr_s["attendance_percent"],
                    projected_percent=proj_s["attendance_percent"],
                    current_safe_bunks=curr_s["safe_bunks"],
                    projected_safe_bunks=proj_s["safe_bunks"],
                    is_safe=is_safe,
                    recovery_required=not is_safe,
                    required_to_attend=proj_s["required_to_attend"],
                    units_per_class=curr_s.get("units_per_class", 1)
                )
            )
            
        return SimulationResultDTO(
            overall_current_percent=current_summary["overall"]["attendance_percent"],
            overall_projected_percent=projected_summary["overall"]["attendance_percent"],
            overall_current_safe_bunks=current_summary["overall"]["safe_bunks_budget"],
            overall_projected_safe_bunks=projected_summary["overall"]["safe_bunks_budget"],
            subjects=subjects_dto,
            missed_lectures=attended_lectures,
            warnings=[]
        )

    def format_context(self, dto: SimulationResultDTO) -> str:
        import math
        subjects_str = []
        for s in dto.subjects:
            proj_safe_classes = s.projected_safe_bunks // s.units_per_class
            curr_safe_classes = s.current_safe_bunks // s.units_per_class
            subjects_str.append(
                f"{s.name}: Attendance improves/stabilizes to {s.projected_percent}% (currently {s.current_percent}%, projected safe classes to safely miss: {proj_safe_classes} (was {curr_safe_classes}))"
            )
        return f"Simulation results for attending all classes: Overall projected attendance is {dto.overall_projected_percent}% (currently {dto.overall_current_percent}%). Subjects projections: " + ", ".join(subjects_str)

def fallback_intent_parser(message: str, current_date: date) -> IntentExtraction:
    msg = message.lower()
    
    # next_event
    if any(k in msg for k in ["holiday", "break", "calendar", "event", "override", "vacation"]):
        return IntentExtraction(intent="next_event")
        
    # simulate_attendance
    if any(k in msg for k in ["attend", "perfect", "present"]):
        relative_terms = []
        if "tomorrow" in msg:
            relative_terms.append("tomorrow")
        if "monday" in msg:
            relative_terms.append("monday")
        if "friday" in msg:
            relative_terms.append("friday")
        if "next week" in msg or "next_week" in msg:
            relative_terms.append("next week")
        return IntentExtraction(intent="simulate_attendance", relative_date_terms=relative_terms)
        
    # get_subject_health
    if any(k in msg for k in ["risk", "health", "standings", "warning"]):
        return IntentExtraction(intent="get_subject_health")
        
    # suggest_leaves
    if any(k in msg for k in ["safest", "suggest", "recommend"]):
        return IntentExtraction(intent="suggest_leaves")
        
    # attendance_summary
    if any(k in msg for k in ["summary", "status", "overall", "attendance"]):
        return IntentExtraction(intent="attendance_summary")
        
    # simulate_leaves
    if any(k in msg for k in ["miss", "skip", "leave", "bunk", "tomorrow", "monday", "friday"]):
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
        
    return IntentExtraction(intent="unknown")

def fallback_response_generator(intent: str, context_info: str) -> str:
    if intent == "unknown":
        return "I can help you simulate future absences, check remaining safe leaves, suggest safest leave windows, or display your overall attendance summary. Please ask something related to your academic schedule."
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
                    "Classify user intent into: 'simulate_leaves', 'attendance_summary', 'get_subject_health', 'next_event', 'simulate_attendance', 'suggest_leaves', or 'unknown'. "
                    "Extract subject_name if mentioned. "
                    "Extract relative_date_terms (e.g. 'tomorrow', 'next Friday', 'Monday', 'next week') and concrete_dates (YYYY-MM-DD). "
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
                f"User asked: '{message}'. Context from planner engine: {context_info}. Explain this data."
            ],
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are AttendWise AI.\n\n"
                    "You are NOT responsible for attendance calculations.\n"
                    "Never estimate, calculate, or assume.\n"
                    "Never generate percentages yourself, invent planner outputs, or guess any projections.\n"
                    "Every number shown must come directly from backend APIs. No guessing. No invented projections. No fake percentages.\n"
                    "If the backend does not provide a value, you MUST explicitly state: 'I don't have enough verified attendance data.'\n"
                    "You function strictly as a presentation layer over verified backend calculations."
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

    # 2. Subject Name matching
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
        if term.strip().lower() in ("next week", "next_week", "week"):
            for i in range(1, 8):
                resolved_dates.append(current_date + timedelta(days=i))
        else:
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
        resolved_dates.append(current_date + timedelta(days=1))

    # 4. Dispatch to Intent registry
    handler = INTENT_REGISTRY.get(extraction.intent)
    if not handler:
        reply = fallback_response_generator("unknown", "")
        return ChatResponse(reply=reply, intent="unknown", clarification_needed=False)

    # Prepare dispatcher execution params
    params = {}
    if extraction.intent in ("simulate_leaves", "simulate_attendance"):
        params["dates"] = resolved_dates
    elif extraction.intent == "safe_bunks_check":
        matched_subj = subject_match["subject"]
        if matched_subj:
            params["subject_id"] = matched_subj.id

    try:
        dto_result = handler.execute(db, semester_id, params)
        formatted_context = handler.format_context(dto_result)
        reply = generate_user_reply(message, extraction.intent, formatted_context)
        return ChatResponse(reply=reply, intent=extraction.intent, clarification_needed=False)
    except ValueError as ve:
        # Graceful handling for missing event or missing data
        return ChatResponse(
            reply=f"The requested simulation must be calculated first: {str(ve)}",
            intent=extraction.intent,
            clarification_needed=False
        )
    except Exception as e:
        print(f"Assistant dispatcher execution failed: {str(e)}")
        return ChatResponse(
            reply="The requested simulation must be calculated first. I encountered an issue processing your schedule data.",
            intent=extraction.intent,
            clarification_needed=False
        )
