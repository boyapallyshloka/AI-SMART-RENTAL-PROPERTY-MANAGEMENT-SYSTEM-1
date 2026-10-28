from collections.abc import Mapping
from datetime import date
from typing import Any

import joblib
import numpy as np
import pandas as pd

from .config import FEATURE_COLUMNS, MODEL_PATH, MODEL_VERSION, TARGET_COLUMN
from .preprocessing import validate_inference_record


class M3Inference:
    """Load and serve the serialized M3 demand model."""

    def __init__(self, model_path=MODEL_PATH) -> None:
        if not model_path.exists():
            raise FileNotFoundError(
                f"M3 model artifact not found: {model_path}. "
                "Train the model before requesting predictions."
            )

        artifact = joblib.load(model_path)
        if artifact.get("target") != TARGET_COLUMN:
            raise ValueError(
                f"M3 artifact target must be {TARGET_COLUMN!r}."
            )
        if artifact.get("features") != FEATURE_COLUMNS:
            raise ValueError("M3 artifact feature schema does not match.")

        self.model = artifact["pipeline"]
        self.model_version = artifact.get("model_version", MODEL_VERSION)
        self.demand_level_thresholds = artifact["demand_level_thresholds"]

    def predict(self, record: Mapping[str, Any]) -> dict[str, Any]:
        validated = validate_inference_record(record)
        features = pd.DataFrame(
            [{field: validated[field] for field in FEATURE_COLUMNS}],
            columns=FEATURE_COLUMNS,
        )

        raw_prediction = float(self.model.predict(features)[0])
        if not np.isfinite(raw_prediction):
            raise ValueError("The model returned a non-finite prediction.")

        predicted_count = max(0, int(round(raw_prediction)))
        low_max = self.demand_level_thresholds["low_max"]
        medium_max = self.demand_level_thresholds["medium_max"]
        if predicted_count <= low_max:
            demand_level = "LOW"
        elif predicted_count <= medium_max:
            demand_level = "MEDIUM"
        else:
            demand_level = "HIGH"

        forecast_month = date(
            validated["year"],
            validated["month"],
            1,
        )
        if forecast_month.month == 12:
            forecast_period = f"{forecast_month.year + 1:04d}-01"
        else:
            forecast_period = (
                f"{forecast_month.year:04d}-{forecast_month.month + 1:02d}"
            )

        return {
            "success": True,
            "city": validated["city"],
            "areaLocality": validated["area_locality"],
            "propertyType": validated["property_type"],
            "forecastPeriod": forecast_period,
            "predictedDemandCount": predicted_count,
            "demandUnit": "demand units",
            "demandLevel": demand_level,
            "modelVersion": self.model_version,
            "target": TARGET_COLUMN,
        }


_inference_instance: M3Inference | None = None


def get_inference() -> M3Inference:
    """Return the shared, lazily loaded M3 inference service."""

    global _inference_instance
    if _inference_instance is None:
        _inference_instance = M3Inference()
    return _inference_instance


def predict_rental_demand(record: Mapping[str, Any]) -> dict[str, Any]:
    return get_inference().predict(record)
