
from fastapi import FastAPI

from api import router

app = FastAPI(
    title="M3 Rental Demand Prediction API",
    description=(
        "Predicts next-month rental demand using the trained "
        "two-stage machine-learning model."
    ),
    version="1.0.0",
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "success": True,
        "message": "M3 Rental Demand API is running.",
        "docs": "/docs",
    }
