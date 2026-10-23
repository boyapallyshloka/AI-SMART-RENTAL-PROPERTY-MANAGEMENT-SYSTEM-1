
import os

import joblib
import numpy as np
import pandas as pd
import hashlib

from m3_rental_demand.config import (
    DATASET_PATH,
    FEATURES,
    MODEL_PATH,
    MODEL_VERSION,
    PROPERTY_TYPES,
    TARGET_DEFINITION,
    TARGET_COLUMN,
)


class ModelUnavailableError(Exception):
    pass



def has_canonical_dataset_provenance(artifact):
    metadata = artifact.get("training_metadata")
    if not isinstance(metadata, dict):
        return False

    dataset_hash = metadata.get("dataset_sha256")
    if not isinstance(dataset_hash, str):
        return False

    if (
        len(dataset_hash) != 64
        or any(
            character not in "0123456789abcdefABCDEF"
            for character in dataset_hash
        )
    ):
        return False

    try:
        if not DATASET_PATH.is_file():
            return False

        actual_hash = hashlib.sha256(
            DATASET_PATH.read_bytes()
        ).hexdigest()

        return actual_hash.lower() == dataset_hash.lower()
    except OSError:
        return False


def _normalize_input(data):
    aliases = {
        "areaLocality": "area_locality",
        "propertyType": "property_type",
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


def _demand_level(count, thresholds):
    if count <= thresholds["low_max"]:
        return "LOW"
    if count <= thresholds["medium_max"]:
        return "MEDIUM"
    return "HIGH"


def predict_rental_demand(request_data):
    if not MODEL_PATH.exists():
        raise ModelUnavailableError(
            "The rental-demand model artifact is unavailable."
        )

    try:
        artifact = joblib.load(MODEL_PATH)
    except Exception as exc:
        raise ModelUnavailableError(
            "The rental-demand model artifact could not be loaded."
        ) from exc

    approach = artifact.get("approach")

    if artifact.get("features") != FEATURES:
        raise ValueError(
            "The saved model feature contract does not match the current "
            "M3 inputs. Retrain and validate a model for the configured "
            "dataset before serving predictions."
        )
    if not has_canonical_dataset_provenance(artifact):
        raise ValueError(
            "The saved model lacks verifiable provenance for the canonical "
            "M3 dataset."
        )
    if (
        artifact.get("target") != TARGET_COLUMN
        or artifact.get("target_definition") != TARGET_DEFINITION
    ):
        raise ValueError(
            "The saved model target contract does not match the current "
            "M3 target definition."
        )

    if approach != "regression-only":
        raise ValueError(
            f"Unsupported model approach: {approach!r}. "
            "Expected a regression-only artifact. Retrain the model."
        )

    if (
        not TARGET_DEFINITION
        or artifact.get("target_definition") != TARGET_DEFINITION
    ):
        raise ValueError(
            "The saved model target definition does not match the verified "
            "M3 configuration; predictions are disabled."
        )

    expected_rate_units = {
        "occupancy_rate": "fraction from 0 to 1",
        "vacancy_rate": "fraction from 0 to 1",
    }
    if artifact.get("rate_units") != expected_rate_units:
        raise ValueError(
            "The saved model rate units do not match the M3 input contract."
        )

    data = _normalize_input(request_data)
    features = FEATURES

    missing = [name for name in features if name not in data]
    if missing:
        raise ValueError(f"Missing prediction features: {missing}")

    if data["property_type"] not in PROPERTY_TYPES:
        raise ValueError(
            f"Unsupported property_type: {data['property_type']!r}. "
            f"Expected one of {PROPERTY_TYPES}."
        )

    for name in ("occupancy_rate", "vacancy_rate"):
        value = float(data[name])
        if not np.isfinite(value) or not 0 <= value <= 1:
            raise ValueError(f"{name} must be a fraction between 0 and 1.")

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

    thresholds = artifact.get("demand_level_thresholds")
    if (
        not isinstance(thresholds, dict)
        or "low_max" not in thresholds
        or "medium_max" not in thresholds
    ):
        raise ValueError(
            "The saved model is missing its training-derived demand-level "
            "thresholds."
        )

    forecast_month = month + 1
    forecast_year = year

    if forecast_month > 12:
        forecast_month = 1
        forecast_year += 1

    return {
        "success": True,
        "city": data["city"],
        "areaLocality": data["area_locality"],
        "propertyType": data["property_type"],
        "month": forecast_month,
        "year": forecast_year,
        "predictedDemandCount": predicted_count,
        "demandLevel": _demand_level(predicted_count, thresholds),
        "modelVersion": artifact.get("model_version", MODEL_VERSION),
    }
