from abc import ABC, abstractmethod
from typing import Any, Dict

class AbstractAIProvider(ABC):
    """
    Abstract Interface for AI Provider implementations.
    Provider is strictly responsible for converting file bytes into raw structured text/JSON extraction.
    """
    @abstractmethod
    def extract_timetable(self, file_bytes: bytes, file_type: str) -> Dict[str, Any]:
        """Extract raw timetable information from the document bytes"""
        pass

    @abstractmethod
    def extract_calendar(self, file_bytes: bytes, file_type: str) -> Dict[str, Any]:
        """Extract raw calendar exception information from the document bytes"""
        pass
