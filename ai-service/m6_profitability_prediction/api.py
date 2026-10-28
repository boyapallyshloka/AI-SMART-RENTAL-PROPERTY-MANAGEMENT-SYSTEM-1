
"""
M6 Property Profitability Prediction API

FastAPI router for property profitability prediction.

The central ai-service/main.py owns the FastAPI application.
This module exposes only an APIRouter.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .inference import predict


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/m6",
    tags=["Property profitability prediction"],
)


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class ProfitabilityPredictionRequest(BaseModel):
    """
    Request schema for M6 property profitability prediction.

    The 26 required fields correspond to the features selected
    during M6 model training.

    Additional financial fields are optional and are used only
    for the supplementary financial analysis.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )

    # Property attributes
    city: str = Field(..., min_length=1)
    size_sqft: float = Field(..., ge=0)
    bedrooms_bhk: float = Field(..., ge=0)
    property_age_years: float = Field(..., ge=0)

    # Current financial features
    monthly_rent: float = Field(..., ge=0)
    collected_rent: float = Field(..., ge=0)
    expense_amount: float = Field(..., ge=0)
    current_month_profit: float

    occupancy_rate: float = Field(..., ge=0, le=1)
    estimated_vacancy_loss: float = Field(..., ge=0)
    revenue_after_estimated_vacancy_loss: float

    # Three-month averages
    collected_rent_3m_avg: float = Field(..., ge=0)
    expense_amount_3m_avg: float = Field(..., ge=0)
    current_month_profit_3m_avg: float

    occupancy_rate_3m_avg: float = Field(..., ge=0, le=1)
    estimated_vacancy_loss_3m_avg: float = Field(..., ge=0)

    # Six-month averages
    collected_rent_6m_avg: float = Field(..., ge=0)
    expense_amount_6m_avg: float = Field(..., ge=0)
    current_month_profit_6m_avg: float

    occupancy_rate_6m_avg: float = Field(..., ge=0, le=1)
    estimated_vacancy_loss_6m_avg: float = Field(..., ge=0)

    # Trend features
    collected_rent_trend: float = Field(..., ge=-1, le=1)
    expense_amount_trend: float = Field(..., ge=-1, le=1)
    current_month_profit_trend: float = Field(..., ge=-1, le=1)
    occupancy_rate_trend: float = Field(..., ge=-1, le=1)
    estimated_vacancy_loss_trend: float = Field(..., ge=-1, le=1)

    # Optional financial-analysis inputs
    # These are NOT additional trained model features.
    maintenance_cost: Optional[float] = Field(default=None, ge=0)
    other_operating_expenses: Optional[float] = Field(default=None, ge=0)

    # Accept either a ratio (0.06) or a percentage (6.0).
    capitalization_rate: Optional[float] = Field(
        default=None,
        gt=0,
        le=100,
    )


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class ProfitabilityPredictionResponse(BaseModel):
    """
    Successful M6 prediction and optional financial-analysis response.
    """

    success: bool = True
    predicted_next_month_profit: float
    profitability_label: int
    profitability_probability: Optional[float] = None
    modelVersion: str = "1.0"

    # Supplementary calculations from supplied financial inputs.
    financial_analysis: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Error response schema
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    """Avenue360 standard error response."""

    success: bool = False
    errorCode: str
    message: str


def error_response(
    status_code: int,
    error_code: str,
    message: str,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "errorCode": error_code,
            "message": message,
        },
    )


# ---------------------------------------------------------------------------
# Health & Root endpoints
# ---------------------------------------------------------------------------

@router.get("/health")
def health():
    return {
        "status": "healthy",
        "module": "M6_PROFITABILITY_PREDICTION",
        "service": "m6-profitability-prediction",
    }


@router.get("/")
def root():
    return {
        "message": "Avenue360 M6 Property Profitability Prediction API is running",
        "model_version": "1.0",
    }


# ---------------------------------------------------------------------------
# Prediction endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/predict-profitability",
    response_model=ProfitabilityPredictionResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
@router.post(
    "/predict",
    response_model=ProfitabilityPredictionResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    include_in_schema=False,
)
def predict_profitability(
    request: ProfitabilityPredictionRequest,
) -> Any:
    """
    Predict next-month profitability and return optional financial analysis.

    Model outputs:
        - predicted_next_month_profit
        - profitability_label
        - profitability_probability

    Supplementary output:
        - financial_analysis
    """

    try:
        # Pydantic serializes request fields using Python field names
        # by default, which matches the inference feature names.
        input_data: Dict[str, Any] = request.model_dump()

        # Run the trained M6 regression and classification models,
        # followed by the optional financial calculations.
        result = predict(input_data)

        return ProfitabilityPredictionResponse(
            success=True,
            predicted_next_month_profit=result[
                "predicted_next_month_profit"
            ],
            profitability_label=result["profitability_label"],
            profitability_probability=result[
                "profitability_probability"
            ],
            modelVersion="1.0",
            financial_analysis=result.get("financial_analysis"),
        )

    except FileNotFoundError:
        return error_response(
            500,
            "MODEL_NOT_FOUND",
            "M6 model artifacts could not be found. "
            "Please ensure the pipeline has been trained.",
        )

    except ValueError as exc:
        return error_response(
            400,
            "INVALID_INPUT",
            str(exc),
        )

    except RuntimeError:
        return error_response(
            500,
            "PREDICTION_ERROR",
            "M6 prediction could not be completed.",
        )

    except Exception:
        import logging

        logging.getLogger(__name__).exception(
            "M6 prediction failed"
        )

        return error_response(
            500,
            "INTERNAL_ERROR",
            "An internal error occurred while processing the prediction.",
        )
