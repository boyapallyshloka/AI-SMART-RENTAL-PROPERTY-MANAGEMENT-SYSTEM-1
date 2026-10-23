"""
M4 Payment Risk - Automated Tests

Tests:
1. Required model artifacts exist.
2. Feature list exists and contains the expected 20 features.
3. Inference layer loads successfully.
4. Valid prediction returns the expected response structure.
5. Prediction values have valid types/ranges.
6. Missing features are rejected.
7. Dataset contains the required M4 columns.
8. Dataset contains no missing values.
9. Dataset contains no duplicate rows.
10. Risk labels are valid binary values.
"""

from pathlib import Path
import sys

import joblib
import pandas as pd
import pytest


# ---------------------------------------------------------------------
# Path configuration
# ---------------------------------------------------------------------

TESTS_DIR = Path(__file__).resolve().parent
MODULE_DIR = TESTS_DIR.parent
AI_SERVICE_DIR = MODULE_DIR.parent

DATA_PATH = (
    AI_SERVICE_DIR
    / "data"
    / "ml"
    / "M4_Payment_Risk_Engineered.csv"
)

ARTIFACT_DIR = MODULE_DIR / "artifacts"

MODEL_PATH = (
    ARTIFACT_DIR
    / "model_pipeline.joblib"
)

FEATURE_LIST_PATH = (
    ARTIFACT_DIR
    / "feature_list.joblib"
)


# Make m4_payment_risk importable when pytest is run
# from the ai-service root directory.
if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(
        0,
        str(AI_SERVICE_DIR),
    )


from m4_payment_risk.inference import (  # noqa: E402
    get_inference,
)


# ---------------------------------------------------------------------
# Expected model features
# ---------------------------------------------------------------------

EXPECTED_FEATURES = [
    "monthly_income",
    "historical_invoice_count",
    "late_payment_count",
    "missed_payment_count",
    "avg_days_late",
    "max_days_late",
    "historical_outstanding",
    "rent_to_income_ratio",
    "payment_completion_ratio",
    "recent_late_payment_count_3m",
    "recent_missed_payment_count_3m",
    "recent_avg_days_late_3m",
    "recent_payment_completion_ratio_3m",
    "recent_late_payment_count_6m",
    "recent_missed_payment_count_6m",
    "recent_avg_days_late_6m",
    "recent_payment_completion_ratio_6m",
    "late_payment_trend",
    "missed_payment_trend",
    "payment_completion_trend",
]


# ---------------------------------------------------------------------
# Valid sample based on the current engineered M4 dataset
# ---------------------------------------------------------------------

VALID_INPUT = {
    "monthly_income": 75031,
    "historical_invoice_count": 3.0,
    "late_payment_count": 3.0,
    "missed_payment_count": 0,
    "avg_days_late": 6.333333333333333,
    "max_days_late": 10,
    "historical_outstanding": 0.0,
    "rent_to_income_ratio": 1.1995042049286295,
    "payment_completion_ratio": 1.0,

    "recent_late_payment_count_3m": 3.0,
    "recent_missed_payment_count_3m": 0.0,
    "recent_avg_days_late_3m": 6.333333333333333,
    "recent_payment_completion_ratio_3m": 1.0,

    "recent_late_payment_count_6m": 3.0,
    "recent_missed_payment_count_6m": 0.0,
    "recent_avg_days_late_6m": 6.333333333333333,
    "recent_payment_completion_ratio_6m": 1.0,

    "late_payment_trend": 0.0,
    "missed_payment_trend": 0.0,
    "payment_completion_trend": 0.0,
}


# =====================================================================
# ARTIFACT TESTS
# =====================================================================

def test_model_artifact_exists():
    """Verify that the trained M4 model artifact exists."""

    assert MODEL_PATH.exists(), (
        f"Model artifact not found: {MODEL_PATH}"
    )


def test_feature_list_artifact_exists():
    """Verify that the feature-list artifact exists."""

    assert FEATURE_LIST_PATH.exists(), (
        f"Feature list not found: {FEATURE_LIST_PATH}"
    )


def test_feature_list_is_correct():
    """Verify the saved feature list contains exactly 20 features."""

    feature_list = joblib.load(
        FEATURE_LIST_PATH
    )

    assert isinstance(
        feature_list,
        list,
    )

    assert feature_list == EXPECTED_FEATURES


def test_model_pipeline_can_load():
    """Verify that the saved pipeline can be loaded."""

    model = joblib.load(
        MODEL_PATH
    )

    assert model is not None

    assert hasattr(
        model,
        "predict",
    )


# =====================================================================
# INFERENCE TESTS
# =====================================================================

def test_inference_loads():
    """Verify that the M4 inference service loads."""

    inference = get_inference()

    assert inference is not None

    assert inference.model is not None

    assert inference.feature_list == EXPECTED_FEATURES


def test_valid_prediction():
    """Verify that a valid M4 input produces a prediction."""

    inference = get_inference()

    result = inference.predict(
        VALID_INPUT
    )

    assert isinstance(
        result,
        dict,
    )

    assert "risk_label" in result
    assert "risk_probability" in result
    assert "risk_status" in result
    assert "model" in result
    assert "model_version" in result


def test_prediction_label_is_valid():
    """Risk label must be binary."""

    inference = get_inference()

    result = inference.predict(
        VALID_INPUT
    )

    assert result["risk_label"] in [
        0,
        1,
    ]


def test_prediction_probability_is_valid():
    """Risk probability must be between 0 and 1."""

    inference = get_inference()

    result = inference.predict(
        VALID_INPUT
    )

    probability = result[
        "risk_probability"
    ]

    assert probability is not None

    assert 0.0 <= probability <= 1.0


def test_risk_status_matches_label():
    """Risk status must match the predicted label."""

    inference = get_inference()

    result = inference.predict(
        VALID_INPUT
    )

    if result["risk_label"] == 1:
        assert (
            result["risk_status"]
            == "HIGH_RISK"
        )
    else:
        assert (
            result["risk_status"]
            == "LOW_RISK"
        )


def test_model_metadata():
    """Verify model name and version are returned."""

    inference = get_inference()

    result = inference.predict(
        VALID_INPUT
    )

    assert (
        result["model"]
        == "Logistic Regression"
    )

    assert (
        result["model_version"]
        == "M4-v1.0"
    )


def test_missing_feature_is_rejected():
    """Verify that missing required features raise an error."""

    inference = get_inference()

    invalid_input = VALID_INPUT.copy()

    del invalid_input[
        "monthly_income"
    ]

    with pytest.raises(
        ValueError,
        match="Missing required features",
    ):
        inference.predict(
            invalid_input
        )


# =====================================================================
# DATASET TESTS
# =====================================================================

def test_engineered_dataset_exists():
    """Verify that the engineered M4 dataset exists."""

    assert DATA_PATH.exists(), (
        f"Dataset not found: {DATA_PATH}"
    )


def test_engineered_dataset_columns():
    """Verify required dataset columns exist."""

    df = pd.read_csv(
        DATA_PATH
    )

    required_columns = {
        "tenant_id",
        "snapshot_month",
        "monthly_income",
        "historical_invoice_count",
        "late_payment_count",
        "missed_payment_count",
        "avg_days_late",
        "max_days_late",
        "historical_outstanding",
        "rent_to_income_ratio",
        "payment_completion_ratio",
        "risk_label",
        "data_split",
        "recent_late_payment_count_3m",
        "recent_missed_payment_count_3m",
        "recent_avg_days_late_3m",
        "recent_payment_completion_ratio_3m",
        "recent_late_payment_count_6m",
        "recent_missed_payment_count_6m",
        "recent_avg_days_late_6m",
        "recent_payment_completion_ratio_6m",
        "late_payment_trend",
        "missed_payment_trend",
        "payment_completion_trend",
    }

    missing_columns = (
        required_columns
        - set(df.columns)
    )

    assert not missing_columns, (
        f"Missing dataset columns: "
        f"{missing_columns}"
    )


def test_engineered_dataset_has_no_missing_values():
    """Verify the engineered dataset has no missing values."""

    df = pd.read_csv(
        DATA_PATH
    )

    missing_count = int(
        df.isna()
        .sum()
        .sum()
    )

    assert missing_count == 0


def test_engineered_dataset_has_no_duplicate_rows():
    """Verify there are no duplicate rows."""

    df = pd.read_csv(
        DATA_PATH
    )

    duplicate_count = int(
        df.duplicated()
        .sum()
    )

    assert duplicate_count == 0


def test_risk_labels_are_binary():
    """Verify risk_label contains only 0 and 1."""

    df = pd.read_csv(
        DATA_PATH
    )

    labels = set(
        df["risk_label"]
        .dropna()
        .unique()
    )

    assert labels.issubset(
        {0, 1}
    )


def test_data_splits_are_valid():
    """Verify train/validation/test split labels."""

    df = pd.read_csv(
        DATA_PATH
    )

    splits = set(
        df["data_split"]
        .dropna()
        .unique()
    )

    assert splits == {
        "train",
        "validation",
        "test",
    }


def test_no_future_leakage_feature_in_model():
    """
    Verify future_bad_payment_ratio is not part
    of the final model feature list.
    """

    feature_list = joblib.load(
        FEATURE_LIST_PATH
    )

    assert (
        "future_bad_payment_ratio"
        not in feature_list
    )


def test_identity_columns_not_in_model():
    """Verify tenant ID is not used as a model feature."""

    feature_list = joblib.load(
        FEATURE_LIST_PATH
    )

    assert (
        "tenant_id"
        not in feature_list
    )

    assert (
        "snapshot_month"
        not in feature_list
    )

    assert (
        "data_split"
        not in feature_list
    )


# =====================================================================
# FINAL CONSISTENCY TEST
# =====================================================================

def test_feature_list_matches_dataset():
    """
    Verify every model feature exists in the engineered dataset.
    """

    df = pd.read_csv(
        DATA_PATH
    )

    feature_list = joblib.load(
        FEATURE_LIST_PATH
    )

    missing_features = [
        feature
        for feature in feature_list
        if feature not in df.columns
    ]

    assert not missing_features, (
        f"Model features missing from dataset: "
        f"{missing_features}"
    )