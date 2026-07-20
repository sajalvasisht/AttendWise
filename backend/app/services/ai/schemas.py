from pydantic import BaseModel, Field
from typing import List, Optional

class ValidationResultResponse(BaseModel):
    success: bool
    errors: List[str]

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
    intent: str
    clarification_needed: bool = False

# Intent parsing Pydantic schema for Gemini
class IntentExtraction(BaseModel):
    intent: str = Field(description=(
        "Identified intent: "
        "'simulate_leaves' (simulate specific dates/days), "
        "'safe_bunks_check' (check bunk budget/how many missed), "
        "'suggest_leaves' (get safe leave suggestions), "
        "'attendance_summary' (current status/risky subjects summary), "
        "'unknown' (query is outside attendance tracking/academic scheduling domain)"
    ))
    subject_name: Optional[str] = Field(None, description="Name or code of the subject if the query is subject-specific (e.g. Operating Systems, CS301)")
    relative_date_terms: List[str] = Field(default=[], description="Relative date descriptors found in user query (e.g. 'tomorrow', 'next Friday', 'Monday', 'next week')")
    concrete_dates: List[str] = Field(default=[], description="Explicit concrete dates found in YYYY-MM-DD format if mentioned")
    is_ambiguous: bool = Field(default=False, description="True if dates/subjects are ambiguous and need clarification")
    clarification_question: Optional[str] = Field(None, description="Short clarification question if is_ambiguous is True")

# Intermediate structured result DTOs
class SubjectProjectionDTO(BaseModel):
    subject_id: int
    name: str
    code: Optional[str]
    current_percent: float
    projected_percent: float
    current_safe_bunks: int
    projected_safe_bunks: int
    is_safe: bool
    recovery_required: bool
    required_to_attend: int

class SimulationResultDTO(BaseModel):
    overall_current_percent: float
    overall_projected_percent: float
    overall_current_safe_bunks: int
    overall_projected_safe_bunks: int
    subjects: List[SubjectProjectionDTO]
    missed_lectures: List[dict]
    warnings: List[str]

class SuggestionItemDTO(BaseModel):
    label: str
    start_date: str
    end_date: str
    dates: List[str]
    missed_classes_count: int
    projected_percent: float
    is_safe: bool

class SuggestionResultDTO(BaseModel):
    suggestions: List[SuggestionItemDTO]

class SubjectSummaryDTO(BaseModel):
    subject_id: int
    name: str
    code: Optional[str]
    attendance_percent: float
    min_attendance_percent: float
    safe_bunks: int
    required_to_attend: int

class SummaryResultDTO(BaseModel):
    overall_percent: float
    overall_safe_bunks: int
    subjects: List[SubjectSummaryDTO]
