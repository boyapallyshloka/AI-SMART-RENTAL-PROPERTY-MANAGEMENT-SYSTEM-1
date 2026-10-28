from fastapi import APIRouter, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .inference import predict_maintenance


# ============================================================
# APIRouter
# ============================================================

router = APIRouter(
    prefix="/m5",
    tags=["Predictive Maintenance"]
)


# ============================================================
# STANDARD VALIDATION ERROR HANDLER
# ============================================================

async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
):
    errors = []

    for error in exc.errors():
        location = ".".join(
            str(item) for item in error["loc"]
        )

        errors.append(
            f"{location}: {error['msg']}"
        )

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "errorCode": "INVALID_INPUT",
            "message": "; ".join(errors)
        }
    )


# ============================================================
# REQUEST SCHEMA
# ============================================================

class MaintenancePredictionRequest(BaseModel):

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    property_age_years: float = Field(ge=0)
    size_sqft: float = Field(gt=0)
    bedrooms_bhk: float = Field(ge=0)
    amenity_count: float = Field(ge=0)

    historical_maintenance_count: float = Field(ge=0)
    maintenance_count_last_90d: float = Field(ge=0)

    historical_maintenance_cost: float = Field(ge=0)
    historical_avg_cost: float = Field(ge=0)

    days_since_last_maintenance: float = Field(ge=0)

    dominant_issue_category: str

    inspection_count: float = Field(ge=0)
    needs_attention_count: float = Field(ge=0)

    equipment_count: float = Field(ge=0)
    avg_equipment_age_years: float = Field(ge=0)
    critical_equipment_count: float = Field(ge=0)

    snapshot_month: str


# ============================================================
# RESPONSE SCHEMAS & ERROR HELPER
# ============================================================

class MaintenanceRisk(BaseModel):
    prediction: int
    probability: float
    risk_level: str


class ModelInfo(BaseModel):
    risk_model: str
    count_model: str
    cost_model: str


class MaintenancePredictionResponse(BaseModel):
    success: bool = True
    maintenance_risk: MaintenanceRisk
    next_month_maintenance_count: float
    next_month_maintenance_cost: float
    model_info: ModelInfo
    modelVersion: str = "v1.0"


class ErrorResponse(BaseModel):
    success: bool = False
    errorCode: str
    message: str


def error_response(status_code: int, error_code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "errorCode": error_code,
            "message": message
        }
    )


# ============================================================
# HEALTH & ROOT CHECKS
# ============================================================

@router.get("/health")
def health():

    return {
        "status": "healthy",
        "service": "m5-predictive-maintenance"
    }


@router.get("/")
def root():

    return {
        "message": "Avenue360 M5 Predictive Maintenance API is running",
        "model_version": "v1.0"
    }


# ============================================================
# PREDICT MAINTENANCE
# ============================================================

@router.post(
    "/predict-maintenance",
    response_model=MaintenancePredictionResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    }
)
def predict(request: MaintenancePredictionRequest):

    try:

        result = predict_maintenance(
            request.model_dump()
        )

        return MaintenancePredictionResponse(
            success=True,
            modelVersion="v1.0",
            **result
        )

    except ValueError as e:

        return error_response(
            400,
            "INVALID_INPUT",
            str(e)
        )

    except (FileNotFoundError, RuntimeError) as e:

        if "not found" in str(e).lower() or isinstance(e, FileNotFoundError):
            return error_response(
                500,
                "MODEL_NOT_FOUND",
                "Model artifact not found. Please ensure the pipeline has been trained."
            )

        return error_response(
            500,
            "PREDICTION_ERROR",
            "Unable to generate maintenance prediction."
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()

        return error_response(
            500,
            "PREDICTION_ERROR",
             "Unable to generate maintenance prediction."
        )