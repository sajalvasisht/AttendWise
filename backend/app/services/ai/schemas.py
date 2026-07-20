from pydantic import BaseModel
from typing import List

class ValidationResultResponse(BaseModel):
    success: bool
    errors: List[str]
