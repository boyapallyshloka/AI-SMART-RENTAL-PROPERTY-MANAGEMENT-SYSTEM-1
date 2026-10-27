
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from scout.schemas import (
    ScoutChatRequest,
    ScoutChatResponse,
    ScoutPropertyRequest,
)
from scout.backend_client import (
    BackendIntegrationError,
    get_authenticated_tenant_profile,
)
from scout.intent import ScoutOperation, detect_intent
from scout.service import process_message


router = APIRouter(prefix="/scout", tags=["Scout"])

# Show Bearer authentication in Swagger while allowing each endpoint
# to decide whether authentication is required.
bearer_scheme = HTTPBearer(auto_error=False)


def get_authorization(
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    """Preserve the Authorization header format expected by the backend."""
    if credentials is not None:
        return f"Bearer {credentials.credentials}"
    return None


@router.post("/chat", response_model=ScoutChatResponse)
def chat(
    request: ScoutChatRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    """General Scout chat. Tenant identity comes from the Bearer token."""
    authorization = get_authorization(credentials)

    response, intent, data = process_message(
        request.message,
        authorization=authorization,
    )

    return ScoutChatResponse(
        response=response,
        operation=intent.operation,
        source=intent.source,
        confidence=intent.confidence,
        parameters=intent.parameters,
        data=data,
    )


@router.post("/properties", response_model=ScoutChatResponse)
def property_chat(
    request: ScoutPropertyRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    """M2 property search/recommendations use the authenticated tenant."""

    # Reject requests without a Bearer token.
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Bearer authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    authorization = get_authorization(credentials)

    # Resolve the tenant profile using the authenticated JWT.
    try:
        profile = get_authenticated_tenant_profile(authorization)
    except BackendIntegrationError as exc:
        raise HTTPException(
            status_code=exc.status_code or 502,
            detail=str(exc),
        ) from exc

    authenticated_tenant_id = str(profile["tenantId"])

    # Allow only property search and recommendation operations.
    intent = detect_intent(request.message)

    if intent.operation not in {
        ScoutOperation.PROPERTY_SEARCH,
        ScoutOperation.PROPERTY_RECOMMENDATION,
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "This endpoint supports M2 property search "
                "and recommendations only."
            ),
        )

    # Pass the authenticated tenant ID to the existing M2 integration.
    response, intent, data = process_message(
        request.message,
        tenant_id=authenticated_tenant_id,
        authorization=authorization,
    )

    return ScoutChatResponse(
        response=response,
        operation=intent.operation,
        source=intent.source,
        confidence=intent.confidence,
        parameters=intent.parameters,
        data=data,
    )
