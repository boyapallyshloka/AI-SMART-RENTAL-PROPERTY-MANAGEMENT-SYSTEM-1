import os
import sys
import logging
from fastapi import FastAPI, APIRouter, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

app = FastAPI(
    title="M3 Rental Demand Prediction API",
    version="1.0"
)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)
PARENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

logger = logging.getLogger("m3_rental_demand.api")

try:
    from m3_rental_demand.main import predict_demand
except ImportError:
    try:
        from .main import predict_demand
    except ImportError:
        from main import predict_demand

router = APIRouter(
    prefix="/m3",
    tags=["Rental Demand prediction"]
)
app.include_router(router)



class DemandRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    city: str = Field(..., description="City name (e.g. Bangalore, Mumbai)")
    area_locality: str = Field(..., description="Area or locality name")
    month: int = Field(..., ge=1, le=12, description="Target calendar month (1-12)")
    property_count: int = Field(..., ge=0, description="Total properties in locality")
    application_count: int = Field(..., ge=0, description="Applications count")
    agreement_start_count: int = Field(..., ge=0, description="Agreement starts count")
    average_monthly_rent: float = Field(..., ge=0.0, description="Average monthly rent in INR")
    demand_lag_1_month: int = Field(..., ge=0, description="Demand in previous month")
    demand_lag_2_month: int = Field(..., ge=0, description="Demand 2 months ago")
    demand_growth_1_month: float = Field(..., description="1-month demand growth rate")
    occupancy_rate: float = Field(..., description="Current occupancy rate")
    vacancy_rate: float = Field(..., description="Current vacancy rate")
    available_unit_count: int = Field(..., ge=0, description="Available rental units count")


class DemandSuccessResponse(BaseModel):
    success: bool = True
    predictedDemandCount: int
    demandLevel : str
    city: str
    month : int    
    areaLocality: str
    modelVersion: str = "1.0"

class DemandErrorResponse(BaseModel):
    success: bool = False
    errorCode: str
    message: str


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Standard error format for invalid input per Avenue360 ML Standard v1.1.
    Never exposes internal Python stack traces or file paths.
    Note: APIRouter does not support router-level exception handlers.
    This handler can be registered on the central FastAPI app in main.py:
        app.add_exception_handler(RequestValidationError, validation_exception_handler)
    """
    missing_or_invalid = []
    for err in exc.errors():
        field_loc = [str(x) for x in err.get("loc", []) if x != "body"]
        field_name = ".".join(field_loc) if field_loc else "body"
        msg = err.get("msg", "invalid value")
        missing_or_invalid.append(f"{field_name}: {msg}")

    error_description = "; ".join(missing_or_invalid) if missing_or_invalid else "Invalid input payload"

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "success": False,
            "errorCode": "INVALID_INPUT",
            "message": error_description
        }
    )


async def file_not_found_exception_handler(request: Request, exc: FileNotFoundError):
    """
    Handles missing model pipeline artifact error.
    Can be registered on the central FastAPI app in main.py:
        app.add_exception_handler(FileNotFoundError, file_not_found_exception_handler)
    """
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "errorCode": "MODEL_NOT_FOUND",
            "message": "Model artifact not found. Please ensure the pipeline has been trained."
        }
    )


async def general_exception_handler(request: Request, exc: Exception):
    """
    Catches all unhandled exceptions and returns standardized error response.
    Can be registered on the central FastAPI app in main.py:
        app.add_exception_handler(Exception, general_exception_handler)
    """
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "errorCode": "INTERNAL_ERROR",
            "message": "An internal server error occurred while processing the request."
        }
    )


@router.get("/health")
def health():
    return {
        "status": "healthy",
        "module": "M3_RENTAL_DEMAND",
        "service": "m3-rental-demand"
    }


@router.get("/")
def root():
    return {
        "service": "M3 Rental Demand Prediction API",
        "status": "online",
        "version": "1.0",
        "endpoint": "/m3/predict-demand"
    }




@router.post("/predict-demand", response_model=DemandSuccessResponse)
def predict_demand_endpoint(request: DemandRequest):
    """
    Predicts next month rental demand count given raw locality and property features.
    Endpoint adheres strictly to Avenue360 ML Standard v1.1.
    """
    try:
        features = request.model_dump(by_alias=False)
        prediction = float(predict_demand(features))

        predicted_demand_count = max(0, int(prediction + 0.5))
        if predicted_demand_count <= 2:
            demand_level ="LOW"
        elif predicted_demand_count <=5:
            demand_level="MEDIUM"
        elif predicted_demand_count <=10:
            demand_level="HIGH"
        else:
            demand_level="VERY_HIGH"

        return {
        "success": True,
        "predictedDemandCount": predicted_demand_count,
        "demandLevel":demand_level,
        "city": request.city,
        "areaLocality": request.area_locality,
        "month":request.month,
        "modelVersion": "v1.0"
    }
    except FileNotFoundError:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "errorCode": "MODEL_NOT_FOUND",
                "message": "Model artifact not found. Please ensure the pipeline has been trained."
            }
        )
    except ValueError as ve:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "errorCode": "INVALID_INPUT",
                "message": str(ve)
            }
        )
    except Exception as exc:
        logger.error(f"Prediction error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "errorCode": "PREDICTION_ERROR",
                "message": "Failed to compute demand prediction for the given input."
            }
        )

