import sys
from fastapi import APIRouter, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from . import preprocessing
sys.modules.setdefault("preprocessing", preprocessing)
from .predict import predict_rent
router = APIRouter(
    prefix="/m1",
    tags=["Rent Prediction"]
)

MODEL_VERSION = "v1.0"


class PropertyInput(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    city: str
    area_locality: str
    area_type: str

    size_sqft: float = Field(gt=0)
    bedrooms_bhk: int = Field(gt=0)
    bathrooms: int = Field(gt=0)

    floor: int = Field(ge=0)
    total_floors: int = Field(gt=0)

    furnishing_status: str
    parking_available: bool

    property_age_years: int = Field(ge=0)

    amenity_count: int = Field(ge=0)
    amenity_parking: bool
    amenity_lift: bool
    amenity_gym: bool
    amenity_security: bool
    amenity_power_backup: bool
    amenity_air_conditioning: bool
    amenity_wifi: bool
    amenity_garden: bool

    latitude: float
    longitude: float

    property_type: str


class RentPredictionResponse(BaseModel):
    success: bool
    predictedRent: float
    modelVersion: str


class ErrorResponse(BaseModel):
    success: bool
    errorCode: str
    message: str

def error_response(status_code: int, error_code: str, message: str):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "errorCode": error_code,
            "message": message
        }
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
):
    first_error = exc.errors()[0]

    location = " -> ".join(str(item) for item in first_error["loc"])
    message = first_error["msg"]

    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "errorCode": "INVALID_INPUT",
            "message": f"{location}: {message}"
        }
    )


@router.get("/health")
def health():
    return {
        "status": "healthy",
        "module": "M1_RENT_PREDICTION",
        "service": "m1-rent-prediction"
    }


@router.get("/")
def root():
    return {
        "message": "Avenue360 M1 Rent Prediction API is running",
        "model_version": MODEL_VERSION
    }


@router.post(
    "/predict-rent",
    response_model=RentPredictionResponse
)
def predict_rent_endpoint(property_data: PropertyInput):

    data = property_data.model_dump()

    if data["floor"] > data["total_floors"]:
        return error_response(
            400,
            "INVALID_INPUT",
            "floor cannot be greater than total_floors"
        )

    try:
        predicted_rent = predict_rent(data)

        return {
            "success": True,
            "predictedRent": predicted_rent,
            "modelVersion": MODEL_VERSION
        }

    except ValueError as exc:
        return error_response(
            400,
            "INVALID_INPUT",
            str(exc)
        )

    except Exception:
        return error_response(
            500,
            "PREDICTION_ERROR",
            "Unable to generate rent prediction"
        )