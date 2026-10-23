"""
M6 Property Profitability Prediction - Inference

Loads the saved regression and classification pipelines and performs
property profitability prediction using the same preprocessing pipeline
used during training.
"""

from pathlib import Path
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

MODULE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = MODULE_DIR / "artifacts"

REGRESSION_MODEL_PATH = ARTIFACTS_DIR / "regression_model_pipeline.joblib"
CLASSIFICATION_MODEL_PATH = ARTIFACTS_DIR / "classification_model_pipeline.joblib"
FEATURE_LIST_PATH = ARTIFACTS_DIR / "feature_list.joblib"


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

_regression_model = None
_classification_model = None
_feature_list = None


def load_models() -> None:
    """
    Load the saved M6 regression and classification pipelines.

    The saved pipelines contain the fitted preprocessing and model,
    so inference does not manually recreate preprocessing.
    """
    global _regression_model
    global _classification_model
    global _feature_list

    if not REGRESSION_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Regression model artifact not found: {REGRESSION_MODEL_PATH}"
        )

    if not CLASSIFICATION_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Classification model artifact not found: {CLASSIFICATION_MODEL_PATH}"
        )

    if not FEATURE_LIST_PATH.exists():
        raise FileNotFoundError(
            f"Feature list artifact not found: {FEATURE_LIST_PATH}"
        )

    _regression_model = joblib.load(REGRESSION_MODEL_PATH)
    _classification_model = joblib.load(CLASSIFICATION_MODEL_PATH)
    _feature_list = joblib.load(FEATURE_LIST_PATH)

    if not isinstance(_feature_list, list):
        raise ValueError("feature_list.joblib must contain a list of feature names.")


# ---------------------------------------------------------------------------
# Feature validation
# ---------------------------------------------------------------------------

def validate_input_features(input_data: Dict[str, Any]) -> None:
    """
    Validate that all required M6 model features are present.

    Extra fields are allowed at this layer, but only the selected
    training features will be passed to the model.
    """

    if _feature_list is None:
        raise RuntimeError("Feature list is not loaded.")

    missing_features = [
        feature
        for feature in _feature_list
        if feature not in input_data
    ]

    if missing_features:
        raise ValueError(
            "Missing required features: "
            + ", ".join(missing_features)
        )


# ---------------------------------------------------------------------------
# Input preparation
# ---------------------------------------------------------------------------

def prepare_input(input_data: Dict[str, Any]) -> pd.DataFrame:
    """
    Convert raw input into the exact feature structure expected by
    the trained model pipelines.
    """

    validate_input_features(input_data)

    # Use ONLY the features selected during training and preserve
    # their exact training order.
    row = {
        feature: input_data[feature]
        for feature in _feature_list
    }

    return pd.DataFrame([row], columns=_feature_list)


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def predict(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform both M6 profitability predictions.

    Returns:
        - predicted_next_month_profit
        - profitability_label
        - profitability_probability

    The regression model predicts next month's expected profit.
    The classification model predicts whether next month's profit
    will be positive.
    """

    if (
        _regression_model is None
        or _classification_model is None
        or _feature_list is None
    ):
        load_models()

    input_df = prepare_input(input_data)

    try:
        # ---------------------------------------------------------------
        # Regression prediction
        # ---------------------------------------------------------------

        regression_prediction = _regression_model.predict(input_df)

        if len(regression_prediction) != 1:
            raise ValueError(
                "Regression model returned an unexpected prediction shape."
            )

        predicted_profit = float(regression_prediction[0])

        # ---------------------------------------------------------------
        # Classification prediction
        # ---------------------------------------------------------------

        classification_prediction = _classification_model.predict(input_df)

        if len(classification_prediction) != 1:
            raise ValueError(
                "Classification model returned an unexpected prediction shape."
            )

        profitability_label = int(classification_prediction[0])

        # ---------------------------------------------------------------
        # Classification probability
        # ---------------------------------------------------------------

        profitability_probability = None

        if hasattr(_classification_model, "predict_proba"):
            probabilities = _classification_model.predict_proba(input_df)

            if probabilities.shape[0] != 1:
                raise ValueError(
                    "Classification model returned an unexpected probability shape."
                )

            classes = _classification_model.classes_

            # Find probability corresponding to class 1.
            class_one_indices = np.where(classes == 1)[0]

            if len(class_one_indices) > 0:
                profitability_probability = float(
                    probabilities[0, class_one_indices[0]]
                )

        return {
            "predicted_next_month_profit": predicted_profit,
            "profitability_label": profitability_label,
            "profitability_probability": profitability_probability,
        }

    except Exception as exc:
        raise RuntimeError(
            f"M6 prediction failed: {str(exc)}"
        ) from exc


# ---------------------------------------------------------------------------
# Model status
# ---------------------------------------------------------------------------

def is_model_loaded() -> bool:
    """
    Return whether both M6 models and the feature list are loaded.
    """

    return (
        _regression_model is not None
        and _classification_model is not None
        and _feature_list is not None
    )


def get_feature_list() -> list:
    """
    Return the exact features expected by the M6 models.
    """

    if _feature_list is None:
        load_models()

    return list(_feature_list)