from fastapi import APIRouter

from scout.schemas import ScoutChatRequest, ScoutChatResponse
from scout.service import process_message


router = APIRouter(
    prefix="/scout",
    tags=["Scout"]
)


@router.post("/chat", response_model=ScoutChatResponse)
def chat(request: ScoutChatRequest):

    response, intent, data = process_message(
        request.message,
        request.tenant_id
    )

    return ScoutChatResponse(
        response=response,
        operation=intent.operation,
        source=intent.source,
        confidence=intent.confidence,
        parameters=intent.parameters,
        data=data
    )