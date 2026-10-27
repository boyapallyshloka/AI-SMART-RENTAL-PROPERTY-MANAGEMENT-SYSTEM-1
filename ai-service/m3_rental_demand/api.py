from typing import Any, Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from .config import MODEL_VERSION
from .inference import predict_rental_demand


router = APIRouter(
    prefix="/m3",
    tags=["M3 Rental Demand"],
)


class DemandRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )

    city: str = Field(min_length=1, max_length=100)
    area_locality: str = Field(min_length=1, max_length=150)
    property_type: Literal[
        "APARTMENT",
        "VILLA",
        "INDEPENDENT_HOUSE",
    ]
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)

    property_count: int = Field(ge=0)
    application_count: int = Field(ge=0)
    agreement_start_count: int = Field(ge=0)
    average_monthly_rent: float = Field(ge=0)
    demand_lag_1_month: int = Field(ge=0)
    demand_lag_2_month: int = Field(ge=0)
    demand_growth_1_month: float
    occupancy_rate: float = Field(ge=0, le=1)
    vacancy_rate: float = Field(ge=0, le=1)
    available_unit_count: int = Field(ge=0)

    @field_validator(
        "year",
        "month",
        "property_count",
        "application_count",
        "agreement_start_count",
        "average_monthly_rent",
        "demand_lag_1_month",
        "demand_lag_2_month",
        "demand_growth_1_month",
        "occupancy_rate",
        "vacancy_rate",
        "available_unit_count",
        mode="before",
    )
    @classmethod
    def reject_boolean_numbers(cls, value: Any) -> Any:
        if isinstance(value, bool):
            raise ValueError("Boolean values are not valid numeric inputs.")
        return value


class DemandResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel)

    success: bool
    city: str
    area_locality: str
    property_type: str
    forecast_period: str
    predicted_demand_count: int
    demand_unit: str
    demand_level: str
    model_version: str
    target: str


class ErrorResponse(BaseModel):
    success: bool = False
    errorCode: str
    message: str


@router.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "module": "M3_RENTAL_DEMAND",
        "service": "m3-rental-demand",
    }


@router.get("/")
def root() -> dict[str, str]:
    return {
        "message": "Avenue360 M3 Rental Demand API is running",
        "model_version": MODEL_VERSION,
    }


@router.post(
    "/predict-rental-demand",
    response_model=DemandResponse,
    responses={
        400: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def predict_demand(request: DemandRequest) -> Any:
    try:
        return predict_rental_demand(request.model_dump(by_alias=False))
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "errorCode": "INVALID_INPUT",
                "message": str(exc),
            },
        )
    except FileNotFoundError:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "errorCode": "MODEL_NOT_FOUND",
                "message": "M3 model artifact is unavailable. Train the model first.",
            },
        )
