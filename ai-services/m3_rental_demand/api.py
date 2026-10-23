
from typing import Literal

import joblib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict, field_validator

from m3_rental_demand.config import (
    FEATURES,
    MODEL_PATH,
    TARGET_DEFINITION,
    TARGET_COLUMN,
)
from m3_rental_demand.inference import (
    ModelUnavailableError,
    has_canonical_dataset_provenance,
    predict_rental_demand,
)


router = APIRouter(prefix="/m3", tags=["M3 Rental Demand"])


class DemandRequest(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
    )

    city: str = Field(
        min_length=1,
        max_length=100,
    )

    area_locality: str = Field(
        alias="areaLocality",
        min_length=1,
        max_length=150,
    )

    property_type: Literal[
        "APARTMENT",
        "INDEPENDENT_HOUSE",
        "VILLA",
    ] = Field(alias="propertyType")

    month: int = Field(
        ge=1,
        le=12,
    )

    year: int = Field(
        alias="year",
        ge=1,
        le=9999,
    )

    property_count: int = Field(
        alias="propertyCount",
        ge=0,
    )

    application_count: int = Field(
        alias="applicationCount",
        ge=0,
    )

    agreement_start_count: int = Field(
        alias="agreementStartCount",
        ge=0,
    )

    average_monthly_rent: float = Field(
        alias="averageMonthlyRent",
        ge=0,
        allow_inf_nan=False,
    )

    demand_lag_1_month: int = Field(
        alias="demandLag1Month",
        ge=0,
    )

    demand_lag_2_month: int = Field(
        alias="demandLag2Month",
        ge=0,
    )

    demand_growth_1_month: float = Field(
        alias="demandGrowth1Month",
        allow_inf_nan=False,
    )

    occupancy_rate: float = Field(
        alias="occupancyRate",
        ge=0,
        le=1,
        allow_inf_nan=False,
    )

    vacancy_rate: float = Field(
        alias="vacancyRate",
        ge=0,
        le=1,
        allow_inf_nan=False,
    )

    available_unit_count: int = Field(
        alias="availableUnitCount",
        ge=0,
    )

    @field_validator("city", "area_locality")
    @classmethod
    def validate_nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field cannot be blank.")
        return value.strip()


@router.get("/health")
def health_check():
    model_loaded = False
    if TARGET_DEFINITION and MODEL_PATH.exists():
        artifact = joblib.load(MODEL_PATH)
        model_loaded = (
            artifact.get("approach") == "regression-only"
            and artifact.get("features") == FEATURES
            and artifact.get("target") == TARGET_COLUMN
            and artifact.get("target_definition") == TARGET_DEFINITION
            and has_canonical_dataset_provenance(artifact)
        )

    return {
        "success": True,
        "module": "m3_rental_demand",
        "modelLoaded": model_loaded,
    }


@router.post("/predict-rental-demand")
def predict_demand(request: DemandRequest):
    try:
        return predict_rental_demand(
            request.model_dump(by_alias=False)
        )

    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="Rental-demand model is unavailable.",
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Rental-demand prediction failed.",
        ) from exc