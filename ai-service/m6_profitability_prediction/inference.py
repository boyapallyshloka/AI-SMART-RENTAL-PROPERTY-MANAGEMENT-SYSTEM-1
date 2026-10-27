
"""
M6 Property Profitability Prediction - Inference

Loads the saved regression and classification pipelines and performs
property profitability prediction using the same preprocessing pipeline
used during training.

Also provides an optional financial breakdown using financial inputs
supplied by the caller. Financial calculations do not replace model
predictions and do not invent missing financial values.
"""

from pathlib import Path
from typing import Any, Dict, Optional

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

    The saved pipelines contain their fitted preprocessing steps,
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
        raise ValueError(
            "feature_list.joblib must contain a list of feature names."
        )

    if not _feature_list:
        raise ValueError("The loaded feature list is empty.")


# ---------------------------------------------------------------------------
# Feature validation
# ---------------------------------------------------------------------------

def validate_input_features(input_data: Dict[str, Any]) -> None:
    """
    Validate that all required M6 model features are present.

    Extra fields are allowed. Only the features selected during
    training are passed to the model.
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
            "Missing required features: " + ", ".join(missing_features)
        )


# ---------------------------------------------------------------------------
# Input preparation
# ---------------------------------------------------------------------------

def prepare_input(input_data: Dict[str, Any]) -> pd.DataFrame:
    """
    Convert input into the exact feature structure expected by
    the trained model pipelines.
    """
    validate_input_features(input_data)

    # Preserve the exact feature order used during training.
    row = {
        feature: input_data[feature]
        for feature in _feature_list
    }

    return pd.DataFrame([row], columns=_feature_list)


# ---------------------------------------------------------------------------
# Optional financial calculations
# ---------------------------------------------------------------------------

def _optional_float(
    input_data: Dict[str, Any],
    field: str,
) -> Optional[float]:
    """
    Convert an optional financial input to float.

    Missing or empty values remain None. Invalid numeric values
    raise ValueError rather than being silently treated as zero.
    """
    value = input_data.get(field)

    if value is None or value == "":
        return None

    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"Financial field '{field}' must be numeric."
        ) from exc

    if not np.isfinite(number):
        raise ValueError(
            f"Financial field '{field}' must be finite."
        )

    return number


def calculate_financial_breakdown(
    input_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Calculate an optional financial breakdown from supplied inputs.

    Supported inputs:
        monthly_rent
        collected_rent
        estimated_vacancy_loss
        revenue_after_estimated_vacancy_loss
        occupancy_rate
        expense_amount
        maintenance_cost
        other_operating_expenses
        capitalization_rate

    Income rules:
        1. Prefer revenue_after_estimated_vacancy_loss when supplied.
        2. Otherwise use monthly_rent minus vacancy loss.
        3. If vacancy loss is absent, occupancy_rate may be used
           to estimate vacancy loss from monthly_rent.

    Expense rules:
        1. Prefer expense_amount as total operating expenses.
        2. Otherwise, calculate a total only when both maintenance_cost
           and other_operating_expenses are supplied.

    Annualized NOI assumes the supplied monthly figures represent
    one month. Property value is estimated only when a positive
    capitalization rate is supplied.
    """

    monthly_rent = _optional_float(input_data, "monthly_rent")
    collected_rent = _optional_float(input_data, "collected_rent")

    vacancy_loss = _optional_float(
        input_data, "estimated_vacancy_loss"
    )
    adjusted_revenue = _optional_float(
        input_data, "revenue_after_estimated_vacancy_loss"
    )
    occupancy_rate = _optional_float(input_data, "occupancy_rate")

    total_expenses_input = _optional_float(input_data, "expense_amount")
    maintenance_cost = _optional_float(input_data, "maintenance_cost")
    other_expenses = _optional_float(
        input_data, "other_operating_expenses"
    )
    capitalization_rate = _optional_float(
        input_data, "capitalization_rate"
    )

    # Normalize occupancy if provided as a percentage such as 85
    # instead of a ratio such as 0.85.
    normalized_occupancy = occupancy_rate

    if normalized_occupancy is not None:
        if normalized_occupancy > 1:
            normalized_occupancy /= 100.0

        if not 0 <= normalized_occupancy <= 1:
            raise ValueError(
                "occupancy_rate must be between 0 and 1, "
                "or between 0 and 100 when supplied as a percentage."
            )

    # Calculate vacancy loss only when it has not been supplied.
    if (
        vacancy_loss is None
        and monthly_rent is not None
        and normalized_occupancy is not None
    ):
        vacancy_loss = monthly_rent * (1.0 - normalized_occupancy)

    # Avoid subtracting vacancy loss twice.
    if adjusted_revenue is not None:
        effective_income = adjusted_revenue
        income_source = "revenue_after_estimated_vacancy_loss"

    elif monthly_rent is not None and vacancy_loss is not None:
        effective_income = monthly_rent - vacancy_loss
        income_source = "monthly_rent_minus_vacancy_loss"

    else:
        effective_income = None
        income_source = None

    # Prefer the existing total-expense field when available.
    if total_expenses_input is not None:
        total_operating_expenses = total_expenses_input
        expense_source = "expense_amount"

    elif maintenance_cost is not None and other_expenses is not None:
        total_operating_expenses = maintenance_cost + other_expenses
        expense_source = "maintenance_plus_other_operating_expenses"

    else:
        total_operating_expenses = None
        expense_source = None

    # Net operating income is calculable only when both values exist.
    if (
        effective_income is not None
        and total_operating_expenses is not None
    ):
        net_operating_income = (
            effective_income - total_operating_expenses
        )
    else:
        net_operating_income = None

    # Annualization assumes the income and expenses are monthly.
    annualized_noi = (
        net_operating_income * 12
        if net_operating_income is not None
        else None
    )

    # A capitalization rate can be supplied as 0.06 or 6.
    normalized_cap_rate = capitalization_rate

    if normalized_cap_rate is not None:
        if normalized_cap_rate > 1:
            normalized_cap_rate /= 100.0

        if not 0 < normalized_cap_rate <= 1:
            raise ValueError(
                "capitalization_rate must be greater than 0 and at most "
                "1, or supplied as a percentage greater than 0 and at most 100."
            )

    if (
        annualized_noi is not None
        and normalized_cap_rate is not None
    ):
        indicative_property_value = (
            annualized_noi / normalized_cap_rate
        )
    else:
        indicative_property_value = None

    return {
        "monthly_rent": monthly_rent,
        "collected_rent": collected_rent,
        "estimated_vacancy_loss": vacancy_loss,
        "effective_monthly_income": effective_income,
        "income_calculation_source": income_source,
        "total_monthly_operating_expenses": total_operating_expenses,
        "expense_calculation_source": expense_source,
        "maintenance_cost": maintenance_cost,
        "other_operating_expenses": other_expenses,
        "net_monthly_operating_income": net_operating_income,
        "annualized_net_operating_income": annualized_noi,
        "capitalization_rate": normalized_cap_rate,
        "indicative_property_value": indicative_property_value,
        "financial_breakdown_complete": (
            effective_income is not None
            and total_operating_expenses is not None
        ),
        "expense_breakdown_complete": (
            maintenance_cost is not None
            and other_expenses is not None
        ),
    }


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def predict(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform both M6 profitability predictions.

    Model outputs:
        predicted_next_month_profit
        profitability_label
        profitability_probability

    Additional output:
        financial_analysis

    Financial analysis uses supplied financial inputs and is separate
    from the trained model predictions.
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
                    "Classification model returned an unexpected "
                    "probability shape."
                )

            classes = _classification_model.classes_
            class_one_indices = np.where(classes == 1)[0]

            if len(class_one_indices) > 0:
                profitability_probability = float(
                    probabilities[0, class_one_indices[0]]
                )

        # ---------------------------------------------------------------
        # Optional financial analysis
        # ---------------------------------------------------------------

        financial_analysis = calculate_financial_breakdown(input_data)

        return {
            "predicted_next_month_profit": predicted_profit,
            "profitability_label": profitability_label,
            "profitability_probability": profitability_probability,
            "financial_analysis": financial_analysis,
        }

    except Exception as exc:
        raise RuntimeError(
            f"M6 prediction failed: {str(exc)}"
        ) from exc


# ---------------------------------------------------------------------------
# Model status
# ---------------------------------------------------------------------------

def is_model_loaded() -> bool:
    """Return whether both models and the feature list are loaded."""
    return (
        _regression_model is not None
        and _classification_model is not None
        and _feature_list is not None
    )


def get_feature_list() -> list:
    """Return the exact features expected by the M6 models."""
    if _feature_list is None:
        load_models()

    return list(_feature_list)
