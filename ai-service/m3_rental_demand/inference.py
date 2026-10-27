
import joblib
import numpy as np
import pandas as pd

from m3_rental_demand.config import MODEL_PATH, MODEL_VERSION


def _normalize_input(data):
    aliases = {
        "areaLocality": "area_locality",
        "propertyCount": "property_count",
        "applicationCount": "application_count",
        "agreementStartCount": "agreement_start_count",
        "averageMonthlyRent": "average_monthly_rent",
        "demandLag1Month": "demand_lag_1_month",
        "demandLag2Month": "demand_lag_2_month",
        "demandGrowth1Month": "demand_growth_1_month",
        "occupancyRate": "occupancy_rate",
        "vacancyRate": "vacancy_rate",
        "availableUnitCount": "available_unit_count",
    }

    normalized = dict(data)
    for source, destination in aliases.items():
        if source in normalized and destination not in normalized:
            normalized[destination] = normalized[source]

    return normalized


def _demand_level(count):
    if count <= 2:
        return "LOW"
    if count <= 5:
        return "MEDIUM"
    return "HIGH"


def predict_rental_demand(request_data):
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model artifact not found: {MODEL_PATH}. Train the model first."
        )

    artifact = joblib.load(MODEL_PATH)
    approach = artifact.get("approach")

    if approach != "regression-only":
        raise ValueError(
            f"Unsupported model approach: {approach!r}. "
            "Expected a regression-only artifact. Retrain the model."
        )

    data = _normalize_input(request_data)
    features = artifact["features"]

    missing = [name for name in features if name not in data]
    if missing:
        raise ValueError(f"Missing prediction features: {missing}")

    row = pd.DataFrame(
        [{name: data[name] for name in features}],
        columns=features,
    )

    regressor = artifact["regressor"]
    raw_prediction = float(regressor.predict(row)[0])

    if not np.isfinite(raw_prediction):
        raise ValueError("The model returned a non-finite prediction.")

    predicted_count = max(0, int(round(raw_prediction)))

    month = int(data["month"])
    year = int(data["year"])

    if not 1 <= month <= 12:
        raise ValueError("month must be between 1 and 12.")

    if year < 1:
        raise ValueError("year must be a positive integer.")

    forecast_month = month + 1
    forecast_year = year

    if forecast_month > 12:
        forecast_month = 1
        forecast_year += 1

    return {
        "success": True,
        "city": data["city"],
        "areaLocality": data["area_locality"],
        "month": forecast_month,
        "year": forecast_year,
        "predictedDemandCount": predicted_count,
        "demandLevel": _demand_level(predicted_count),
        "modelVersion": artifact.get("model_version", MODEL_VERSION),
    }
