class AIException(Exception):
    """Base exception for AI module errors"""
    pass

class ExtractionError(AIException):
    """Raised when the raw extraction process fails"""
    pass

class MappingError(AIException):
    """Raised when mapping raw extraction to review models fails"""
    pass
