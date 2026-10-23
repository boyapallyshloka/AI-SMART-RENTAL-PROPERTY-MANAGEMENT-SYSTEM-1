from fastapi import APIRouter, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .database import check_database_connection
from .service import (
    MODEL_VERSION,
    generate_recommendations,
)


router = APIRouter(
    prefix="/m2",
    tags=["Property Recommendation"]
)


# ============================================================
# Request Models
# ============================================================

class RecommendationRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

    tenant_id: str = Field(..., min_length=1)
    top_n: int = Field(..., gt=0)

    current_latitude: float | None = None
    current_longitude: float | None = None
    current_address: str | None = None

    @property
    def tenantId(self) -> str:
        return self.tenant_id

    @property
    def topN(self) -> int:
        return self.top_n

    @property
    def currentLatitude(self) -> float | None:
        return self.current_latitude

    @property
    def currentLongitude(self) -> float | None:
        return self.current_longitude

    @property
    def currentAddress(self) -> str | None:
        return self.current_address


# ============================================================
# Response Models
# ============================================================

class AvailableUnit(BaseModel):
    unitId: str
    monthlyRent: float
    bedrooms: int


class AmenityMatchDetails(BaseModel):
    matchPercentage: float
    matched: list[str]
    missing: list[str]


class DistanceMatchDetails(BaseModel):
    distanceConsidered: bool
    distanceMatch: float | None
    approxDistanceKm: float | None


class MatchDetails(BaseModel):
    cityMatch: int
    budgetMatch: int
    bedroomMatch: int
    propertyTypeMatch: int
    furnishingMatch: int
    parkingMatch: int

    amenities: AmenityMatchDetails
    distance: DistanceMatchDetails


class RecommendationItem(BaseModel):
    propertyId: str
    recommendationScore: float
    propertyCity: str

    matchDetails: MatchDetails

    availableUnits: list[AvailableUnit]


class RecommendationResponse(BaseModel):
    success: bool
    tenantId: str
    recommendations: list[RecommendationItem]
    count: int
    modelVersion: str


# ============================================================
# Error Response
# ============================================================

def error_response(
    status_code: int,
    error_code: str,
    message: str
):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "errorCode": error_code,
            "message": message
        }
    )


# ============================================================
# Validation Error Handler
# ============================================================

async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
):
    first_error = exc.errors()[0]

    location = " -> ".join(
        str(item)
        for item in first_error["loc"]
    )

    message = first_error["msg"]

    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "errorCode": "INVALID_INPUT",
            "message": f"{location}: {message}"
        }
    )


# ============================================================
# Root / Health Endpoints
# ============================================================

@router.get("/health")
def health():
    return {
        "status": "healthy",
        "module": "M2_PROPERTY_RECOMMENDATION",
        "service": "m2-property-recommendation"
    }


@router.get("/db-health")
def db_health():
    try:
        return {
            "status": "healthy",
            "database": check_database_connection(),
        }

    except Exception:
        return {
            "status": "unhealthy",
            "database": None,
        }


@router.get("/")
def root():
    return {
        "message": "Avenue360 M2 Property Recommendation API is running",
        "model_version": MODEL_VERSION
    }


# ============================================================
# Recommendation Endpoint
# ============================================================

@router.post(
    "/recommend-properties",
    response_model=RecommendationResponse
)
def recommend_properties_endpoint(
    request: RecommendationRequest
):
    try:

        # ----------------------------------------------------
        # Validate tenant ID
        # ----------------------------------------------------

        tenant_id = request.tenantId.strip()

        if not tenant_id:
            return error_response(
                400,
                "INVALID_INPUT",
                "tenantId must not be empty"
            )

        # ----------------------------------------------------
        # Call reusable M2 recommendation service
        # ----------------------------------------------------

        return generate_recommendations(
            tenant_id=tenant_id,
            top_n=request.topN,
            current_latitude=request.currentLatitude,
            current_longitude=request.currentLongitude,
            current_address=request.currentAddress,
        )

    # ========================================================
    # No tenant preferences
    # ========================================================

    except ValueError as exc:

        message = str(exc)

        if message.startswith(
            "No tenant preferences found for tenant_id:"
        ):
            return error_response(
                404,
                "PREFERENCES_NOT_FOUND",
                message
            )

        return error_response(
            400,
            "INVALID_INPUT",
            message
        )

    # ========================================================
    # Missing data/model files
    # ========================================================

    except FileNotFoundError:

        return error_response(
            500,
            "MODEL_NOT_FOUND",
            "Required M2 data files were not found"
        )

    # ========================================================
    # Unexpected error
    # ========================================================

    except Exception:

        return error_response(
            500,
            "PREDICTION_ERROR",
            "Unable to generate property recommendations"
        )