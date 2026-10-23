
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict, field_validator

from m3_rental_demand.inference import predict_rental_demand


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

    month: int = Field(
        ge=1,
        le=12,
    )

    year: int = Field(
    alias="year",
    ge=2000,
    le=2100,
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
    )

    demand_lag_1_month: float = Field(
        alias="demandLag1Month",
        ge=0,
    )

    demand_lag_2_month: float = Field(
        alias="demandLag2Month",
        ge=0,
    )

    demand_growth_1_month: float = Field(
        alias="demandGrowth1Month",
    )

    occupancy_rate: float = Field(
        alias="occupancyRate",
        ge=0,
        le=100,
    )

    vacancy_rate: float = Field(
        alias="vacancyRate",
        ge=0,
        le=100,
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
    return {
        "success": True,
        "module": "m3_rental_demand",
        "modelLoaded": True,
    }


@router.post("/predict")
def predict_demand(request: DemandRequest):
    try:
        return predict_rental_demand(
            request.model_dump(by_alias=False)
        )

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