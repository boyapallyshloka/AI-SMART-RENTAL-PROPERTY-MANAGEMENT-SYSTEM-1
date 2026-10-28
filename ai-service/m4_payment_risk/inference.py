"""
M4 Payment Risk - Inference Layer

Loads the trained M4 pipeline and performs payment-risk predictions.
"""

from pathlib import Path
from typing import Any, Dict

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = BASE_DIR / "artifacts"

MODEL_PATH = ARTIFACT_DIR / "model_pipeline.joblib"
FEATURE_LIST_PATH = ARTIFACT_DIR / "feature_list.joblib"
METADATA_PATH = ARTIFACT_DIR / "model_metadata.json"


class M4Inference:
    """Inference service for the M4 Payment Risk model."""

    def __init__(self) -> None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"M4 model artifact not found: {MODEL_PATH}"
            )

        if not FEATURE_LIST_PATH.exists():
            raise FileNotFoundError(
                f"M4 feature list not found: {FEATURE_LIST_PATH}"
            )

        self.model = joblib.load(MODEL_PATH)
        self.feature_list = joblib.load(FEATURE_LIST_PATH)

    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a payment-risk prediction."""

        missing_features = [
            feature
            for feature in self.feature_list
            if feature not in input_data
        ]

        if missing_features:
            raise ValueError(
                f"Missing required features: {missing_features}"
            )

        feature_values = {
            feature: input_data[feature]
            for feature in self.feature_list
        }

        dataframe = pd.DataFrame([feature_values])

        prediction = int(self.model.predict(dataframe)[0])

        if hasattr(self.model, "predict_proba"):
            probability = float(
                self.model.predict_proba(dataframe)[0][1]
            )
        else:
            probability = None

        if prediction == 1:
            risk_status = "HIGH_RISK"
        else:
            risk_status = "LOW_RISK"

        return {
            "risk_label": prediction,
            "risk_probability": probability,
            "risk_status": risk_status,
            "model": "Logistic Regression",
            "model_version": "M4-v1.0",
        }


_inference_instance = None


def get_inference() -> M4Inference:
    """Return a reusable M4 inference instance."""

    global _inference_instance

    if _inference_instance is None:
        _inference_instance = M4Inference()

    return _inference_instance


def predict_payment_risk(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Public prediction function."""

    return get_inference().predict(input_data)