"""
M4 Payment Risk API

FastAPI service for tenant payment-risk prediction.
"""

from typing import Any, Dict

from fastapi import APIRouter, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .inference import predict_payment_risk


# ============================================================
# FASTAPI ROUTER
# ============================================================

router = APIRouter(
    prefix="/m4",
    tags=["Tenant payment risk analysis"],
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

class PaymentRiskRequest(BaseModel):
    """Request schema for M4 payment-risk prediction."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    monthly_income: float = Field(..., ge=0)
    historical_invoice_count: float = Field(..., ge=0)
    late_payment_count: float = Field(..., ge=0)
    missed_payment_count: int = Field(..., ge=0)
    avg_days_late: float = Field(..., ge=0)
    max_days_late: int = Field(..., ge=0)
    historical_outstanding: float = Field(..., ge=0)
    rent_to_income_ratio: float = Field(..., ge=0)
    payment_completion_ratio: float = Field(..., ge=0, le=1)

    recent_late_payment_count_3m: float = Field(..., ge=0)
    recent_missed_payment_count_3m: float = Field(..., ge=0)
    recent_avg_days_late_3m: float = Field(..., ge=0)
    recent_payment_completion_ratio_3m: float = Field(
        ...,
        ge=0,
        le=1
    )

    recent_late_payment_count_6m: float = Field(..., ge=0)
    recent_missed_payment_count_6m: float = Field(..., ge=0)
    recent_avg_days_late_6m: float = Field(..., ge=0)
    recent_payment_completion_ratio_6m: float = Field(
        ...,
        ge=0,
        le=1
    )

    late_payment_trend: float
    missed_payment_trend: float
    payment_completion_trend: float


# ============================================================
# RESPONSE SCHEMAS & ERROR HELPER
# ============================================================

class PaymentRiskResponse(BaseModel):
    """Response schema for M4 prediction."""

    success: bool = True
    module: str = "M4_PAYMENT_RISK"
    risk_label: int
    risk_probability: float | None = None
    risk_status: str
    model: str
    model_version: str = "M4-v1.0"


class ErrorResponse(BaseModel):
    """Standard error response."""

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
def health() -> Dict[str, Any]:

    return {
        "status": "healthy",
        "module": "M4_PAYMENT_RISK",
        "service": "m4-payment-risk",
    }


@router.get("/")
def root() -> Dict[str, Any]:

    return {
        "message": "Avenue360 M4 Payment Risk API is running",
        "model_version": "M4-v1.0"
    }


# ============================================================
# PREDICT PAYMENT RISK
# ============================================================

@router.post(
    "/predict-payment-risk",
    response_model=PaymentRiskResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    }
)
def predict_payment_risk_endpoint(
    request: PaymentRiskRequest,
) -> Any:

    try:

        result = predict_payment_risk(
            request.model_dump()
        )

        return PaymentRiskResponse(
            success=True,
            module="M4_PAYMENT_RISK",
            **result,
        )

    except ValueError as e:

        return error_response(
            400,
            "INVALID_INPUT",
            str(e)
        )

    except FileNotFoundError:

        return error_response(
            500,
            "MODEL_NOT_FOUND",
            "Model artifact not found. Please ensure the pipeline has been trained."
        )

    except Exception:

        return error_response(
            500,
            "PREDICTION_ERROR",
            "Unable to generate payment risk prediction."
        )