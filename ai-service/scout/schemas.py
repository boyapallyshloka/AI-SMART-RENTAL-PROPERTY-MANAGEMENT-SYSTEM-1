
from pydantic import BaseModel, Field

from scout.intent import ScoutOperation, ScoutSource


class ScoutChatRequest(BaseModel):
    message: str



class ScoutPropertyRequest(BaseModel):
    message: str



class ScoutChatResponse(BaseModel):
    response: str
    operation: ScoutOperation
    source: ScoutSource
    confidence: float
    parameters: dict = Field(default_factory=dict)
    data: dict | None = None
