
from fastapi import FastAPI

try:
    # Import when running from the ai-services directory
    from m3_rental_demand.api import router
except ModuleNotFoundError as exc:
    # Fallback when running from inside the m3_rental_demand directory
    if exc.name != "m3_rental_demand":
        raise
    from api import router


app = FastAPI(
    title="M3 Rental Demand Prediction API",
    description=(
        "Predicts locality/property-type rental demand from development "
        "data. The target definition must be verified before deployment."
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
