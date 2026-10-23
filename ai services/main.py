import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from m1_rent_prediction.api import router as m1_router
from M2_Property_Recommendation.api import router as m2_router
from m3_rental_demand.api import router as m3_router
from m4_payment_risk.api import router as m4_router
from m5_predictive_maintenance.api import router as m5_router
from m6_profitability_prediction.api import router as m6_router
from scout.api import router as scout_router


logger = logging.getLogger("avenue360.ai_service")


app = FastAPI(
    title="Avenue360 AI Service",
    description="Central AI/ML service integrating M1-M6 and Scout chatbot",
    version="1.0.0",
)


# ============================================================
# GLOBAL EXCEPTION HANDLERS
# ============================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Standardized validation error response per Avenue360 ML Standard."""

    errors = []

    for error in exc.errors():
        loc_parts = [
            str(item)
            for item in error.get("loc", [])
            if item != "body"
        ]

        location = " -> ".join(loc_parts) if loc_parts else "body"

        errors.append(
            f"{location}: {error.get('msg', 'invalid value')}"
        )

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "errorCode": "INVALID_INPUT",
            "message": (
                "; ".join(errors)
                if errors
                else "Invalid request payload."
            ),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    """Unwrap dictionary details to prevent nested detail responses."""

    if isinstance(exc.detail, dict) and "errorCode" in exc.detail:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail,
        )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "errorCode": "HTTP_ERROR",
            "message": str(exc.detail),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Catches unhandled errors without leaking stack traces or internal paths."""

    logger.error(
        f"Unhandled server error: {exc}",
        exc_info=True,
    )

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "errorCode": "INTERNAL_ERROR",
            "message": (
                "An internal server error occurred "
                "while processing the request."
            ),
        },
    )


# ============================================================
# MODULE ROUTERS
# ============================================================

app.include_router(m1_router)
app.include_router(m2_router)
app.include_router(m3_router)
app.include_router(m4_router)
app.include_router(m5_router)
app.include_router(m6_router)


# ============================================================
# SCOUT ROUTER
# ============================================================

app.include_router(scout_router)

# ============================================================
# ROOT & HEALTH ENDPOINTS
# ============================================================

@app.get("/")
def home():
    return {
        "message": "Avenue360 AI Service is running",
        "status": "online",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "avenue360-ai-service",
    }