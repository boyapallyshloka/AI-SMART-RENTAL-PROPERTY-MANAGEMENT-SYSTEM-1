from pydantic import BaseModel, Field

from scout.intent import ScoutOperation, ScoutSource


class ScoutChatRequest(BaseModel):
    message: str
    tenant_id: str | None = Field(default=None, min_length=1)


class ScoutChatResponse(BaseModel):
    response: str
    operation: ScoutOperation
    source: ScoutSource
    confidence: float
    parameters: dict = Field(default_factory=dict)
    data: dict | None = None