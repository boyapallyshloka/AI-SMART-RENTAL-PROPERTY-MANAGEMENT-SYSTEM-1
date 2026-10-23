"""
M6 Property Profitability Prediction
Preprocessing

Purpose:
    Prepare reproducible preprocessing pipelines for M6.

Targets:
    Regression      -> next_month_profit
    Classification  -> profitability_label

Preprocessing rules:
    - Use the feature list defined in feature_selection.py.
    - Exclude identifiers, dates, split metadata, and targets.
    - Encode categorical features using OneHotEncoder.
    - Scale numerical features using StandardScaler.
    - Fit preprocessing ONLY on training data.
    - Apply the fitted preprocessing to validation and test data.
    - Preserve the chronological train/validation/test split.
    - Save preprocessing artifacts for reproducible training/inference.
"""

from pathlib import Path
import json

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler


# ============================================================
# Paths
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR.parent
    / "data"
    / "ml"
    / "M6_Profitability_v2.csv"
)

ARTIFACT_DIR = BASE_DIR / "artifacts"
REPORT_DIR = BASE_DIR / "reports"

ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# Targets
# ============================================================

REGRESSION_TARGET = "next_month_profit"
CLASSIFICATION_TARGET = "profitability_label"


# ============================================================
# Feature list
# ============================================================

SELECTED_FEATURES = [
    # Property characteristics
    "city",
    "size_sqft",
    "bedrooms_bhk",
    "property_age_years",
    "monthly_rent",

    # Current-month financial / occupancy
    "collected_rent",
    "expense_amount",
    "current_month_profit",
    "occupancy_rate",
    "estimated_vacancy_loss",
    "revenue_after_estimated_vacancy_loss",

    # 3-month rolling averages
    "collected_rent_3m_avg",
    "expense_amount_3m_avg",
    "current_month_profit_3m_avg",
    "occupancy_rate_3m_avg",
    "estimated_vacancy_loss_3m_avg",

    # 6-month rolling averages
    "collected_rent_6m_avg",
    "expense_amount_6m_avg",
    "current_month_profit_6m_avg",
    "occupancy_rate_6m_avg",
    "estimated_vacancy_loss_6m_avg",

    # Trend features
    "collected_rent_trend",
    "expense_amount_trend",
    "current_month_profit_trend",
    "occupancy_rate_trend",
    "estimated_vacancy_loss_trend",
]


# ============================================================
# Feature types
# ============================================================

CATEGORICAL_FEATURES = [
    "city",
]

NUMERICAL_FEATURES = [
    feature
    for feature in SELECTED_FEATURES
    if feature not in CATEGORICAL_FEATURES
]


# ============================================================
# Expected chronological split
# ============================================================

EXPECTED_SPLITS = {
    "train": {
        "rows": 180000,
        "start": "2024-01-01",
        "end": "2025-06-01",
    },
    "validation": {
        "rows": 30000,
        "start": "2025-07-01",
        "end": "2025-09-01",
    },
    "test": {
        "rows": 80000,
        "start": "2025-10-01",
        "end": "2026-05-01",
    },
}


# ============================================================
# Validation
# ============================================================

def validate_dataset(df: pd.DataFrame) -> None:
    """Validate dataset structure before preprocessing."""

    print("\n" + "=" * 70)
    print("M6 PREPROCESSING DATA VALIDATION")
    print("=" * 70)

    required_columns = (
        SELECTED_FEATURES
        + [
            REGRESSION_TARGET,
            CLASSIFICATION_TARGET,
            "snapshot_month",
            "data_split",
        ]
    )

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Required columns missing from dataset:\n"
            + "\n".join(f"  - {column}" for column in missing_columns)
        )

    print("[PASS] All required columns are present.")

    # --------------------------------------------------------
    # Missing values
    # --------------------------------------------------------

    missing_count = int(
        df[
            SELECTED_FEATURES
            + [
                REGRESSION_TARGET,
                CLASSIFICATION_TARGET,
            ]
        ].isnull().sum().sum()
    )

    if missing_count > 0:
        raise ValueError(
            f"Missing values detected: {missing_count}"
        )

    print("[PASS] No missing values.")

    # --------------------------------------------------------
    # Duplicate property-month records
    # --------------------------------------------------------

    duplicate_property_month = int(
        df.duplicated(
            subset=["property_id", "snapshot_month"]
        ).sum()
    )

    if duplicate_property_month > 0:
        raise ValueError(
            "Duplicate property-month records detected: "
            f"{duplicate_property_month}"
        )

    print("[PASS] No duplicate property-month records.")

    # --------------------------------------------------------
    # Split validation
    # --------------------------------------------------------

    split_counts = df["data_split"].value_counts().to_dict()

    print("\nData split counts:")

    for split in ["train", "validation", "test"]:
        actual = split_counts.get(split, 0)
        expected = EXPECTED_SPLITS[split]["rows"]

        print(
            f"  {split:10s}: "
            f"{actual:,} rows "
            f"(expected {expected:,})"
        )

        if actual != expected:
            raise ValueError(
                f"{split} split has {actual} rows; "
                f"expected {expected}."
            )

    print("[PASS] Chronological split sizes are correct.")

    # --------------------------------------------------------
    # Date validation
    # --------------------------------------------------------

    df["snapshot_month"] = pd.to_datetime(
        df["snapshot_month"]
    )

    print("\nChronological date ranges:")

    for split, expected in EXPECTED_SPLITS.items():

        split_df = df[df["data_split"] == split]

        actual_start = split_df["snapshot_month"].min()
        actual_end = split_df["snapshot_month"].max()

        expected_start = pd.Timestamp(expected["start"])
        expected_end = pd.Timestamp(expected["end"])

        print(
            f"  {split:10s}: "
            f"{actual_start.date()} -> {actual_end.date()}"
        )

        if (
            actual_start != expected_start
            or actual_end != expected_end
        ):
            raise ValueError(
                f"{split} date range does not match expected "
                f"chronological range."
            )

    print("[PASS] Chronological date ranges are correct.")


# ============================================================
# Create preprocessing pipeline
# ============================================================

def create_preprocessor() -> ColumnTransformer:
    """
    Create the common preprocessing pipeline.

    Numerical:
        StandardScaler

    Categorical:
        OneHotEncoder(handle_unknown='ignore')
    """

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numerical",
                StandardScaler(),
                NUMERICAL_FEATURES,
            ),
            (
                "categorical",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                ),
                CATEGORICAL_FEATURES,
            ),
        ],
        remainder="drop",
    )

    return preprocessor


# ============================================================
# Process data
# ============================================================

def process_data(df: pd.DataFrame):

    print("\n" + "=" * 70)
    print("M6 PREPROCESSING")
    print("=" * 70)

    # --------------------------------------------------------
    # Ensure chronological ordering
    # --------------------------------------------------------

    df = df.sort_values(
        ["snapshot_month", "property_id"]
    ).reset_index(drop=True)

    # --------------------------------------------------------
    # Split data
    # --------------------------------------------------------

    train_df = df[df["data_split"] == "train"].copy()
    validation_df = df[
        df["data_split"] == "validation"
    ].copy()
    test_df = df[df["data_split"] == "test"].copy()

    X_train = train_df[SELECTED_FEATURES]
    X_validation = validation_df[SELECTED_FEATURES]
    X_test = test_df[SELECTED_FEATURES]

    # --------------------------------------------------------
    # Targets
    # --------------------------------------------------------

    y_train_regression = train_df[
        REGRESSION_TARGET
    ]

    y_validation_regression = validation_df[
        REGRESSION_TARGET
    ]

    y_test_regression = test_df[
        REGRESSION_TARGET
    ]

    y_train_classification = train_df[
        CLASSIFICATION_TARGET
    ]

    y_validation_classification = validation_df[
        CLASSIFICATION_TARGET
    ]

    y_test_classification = test_df[
        CLASSIFICATION_TARGET
    ]

    print("\nRaw split shapes:")

    print(f"  X_train      : {X_train.shape}")
    print(f"  X_validation : {X_validation.shape}")
    print(f"  X_test       : {X_test.shape}")

    # --------------------------------------------------------
    # Create preprocessor
    # --------------------------------------------------------

    preprocessor = create_preprocessor()

    # --------------------------------------------------------
    # IMPORTANT:
    # Fit ONLY on training data.
    # --------------------------------------------------------

    print("\nFitting preprocessing pipeline on TRAINING data only...")

    X_train_processed = preprocessor.fit_transform(
        X_train
    )

    # --------------------------------------------------------
    # Transform validation and test using fitted pipeline
    # --------------------------------------------------------

    X_validation_processed = preprocessor.transform(
        X_validation
    )

    X_test_processed = preprocessor.transform(
        X_test
    )

    print("[PASS] Preprocessor fitted only on training data.")

    # --------------------------------------------------------
    # Shapes
    # --------------------------------------------------------

    print("\nProcessed shapes:")

    print(
        f"  Training      : "
        f"{X_train_processed.shape}"
    )

    print(
        f"  Validation    : "
        f"{X_validation_processed.shape}"
    )

    print(
        f"  Test          : "
        f"{X_test_processed.shape}"
    )

    # --------------------------------------------------------
    # Check consistent feature dimensions
    # --------------------------------------------------------

    if (
        X_train_processed.shape[1]
        != X_validation_processed.shape[1]
        or
        X_train_processed.shape[1]
        != X_test_processed.shape[1]
    ):
        raise ValueError(
            "Processed feature dimensions are inconsistent."
        )

    print(
        "[PASS] Training, validation, and test "
        "feature dimensions are consistent."
    )

    # --------------------------------------------------------
    # Check for NaN / infinity
    # --------------------------------------------------------

    import numpy as np

    for name, matrix in [
        ("training", X_train_processed),
        ("validation", X_validation_processed),
        ("test", X_test_processed),
    ]:

        if np.isnan(matrix).any():
            raise ValueError(
                f"NaN values detected in {name} processed data."
            )

        if np.isinf(matrix).any():
            raise ValueError(
                f"Infinite values detected in {name} processed data."
            )

    print("[PASS] No NaN or infinite values in processed data.")

    return (
        preprocessor,
        X_train_processed,
        X_validation_processed,
        X_test_processed,
        y_train_regression,
        y_validation_regression,
        y_test_regression,
        y_train_classification,
        y_validation_classification,
        y_test_classification,
    )


# ============================================================
# Save artifacts
# ============================================================

def save_artifacts(
    preprocessor,
    X_train_processed,
    X_validation_processed,
    X_test_processed,
    y_train_regression,
    y_validation_regression,
    y_test_regression,
    y_train_classification,
    y_validation_classification,
    y_test_classification,
):
    """Save preprocessing and processed datasets."""

    print("\n" + "=" * 70)
    print("SAVING M6 PREPROCESSING ARTIFACTS")
    print("=" * 70)

    # --------------------------------------------------------
    # Main preprocessor
    # --------------------------------------------------------

    preprocessor_path = (
        ARTIFACT_DIR / "preprocessor.joblib"
    )

    joblib.dump(
        preprocessor,
        preprocessor_path
    )

    print(
        f"[SAVED] {preprocessor_path}"
    )

    # --------------------------------------------------------
    # Feature list
    # --------------------------------------------------------

    feature_list_path = (
        ARTIFACT_DIR / "feature_list.joblib"
    )

    joblib.dump(
        SELECTED_FEATURES,
        feature_list_path
    )

    print(
        f"[SAVED] {feature_list_path}"
    )

    # --------------------------------------------------------
    # Processed data
    #
    # These are training artifacts for model development.
    # The final API will use preprocessor.joblib instead of
    # manually recreating preprocessing.
    # --------------------------------------------------------

    processed_data = {
        "X_train": X_train_processed,
        "X_validation": X_validation_processed,
        "X_test": X_test_processed,
        "y_train_regression": y_train_regression.to_numpy(),
        "y_validation_regression": y_validation_regression.to_numpy(),
        "y_test_regression": y_test_regression.to_numpy(),
        "y_train_classification": y_train_classification.to_numpy(),
        "y_validation_classification": y_validation_classification.to_numpy(),
        "y_test_classification": y_test_classification.to_numpy(),
    }

    processed_data_path = (
        ARTIFACT_DIR / "processed_data.joblib"
    )

    joblib.dump(
        processed_data,
        processed_data_path
    )

    print(
        f"[SAVED] {processed_data_path}"
    )

    # --------------------------------------------------------
    # Preprocessing metadata
    # --------------------------------------------------------

    metadata = {
        "module": "M6 Property Profitability Prediction",
        "preprocessing_version": "1.0",
        "dataset": "M6_Profitability_v2.csv",
        "regression_target": REGRESSION_TARGET,
        "classification_target": CLASSIFICATION_TARGET,
        "total_features_before_encoding": len(
            SELECTED_FEATURES
        ),
        "numerical_features": NUMERICAL_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "numerical_transform": "StandardScaler",
        "categorical_transform": "OneHotEncoder",
        "handle_unknown_categories": "ignore",
        "fit_data": "train only",
        "split_strategy": "chronological",
        "train_rows": 180000,
        "validation_rows": 30000,
        "test_rows": 80000,
        "processed_feature_count": int(
            X_train_processed.shape[1]
        ),
    }

    metadata_path = (
        ARTIFACT_DIR / "preprocessing_metadata.json"
    )

    with open(
        metadata_path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            metadata,
            file,
            indent=4
        )

    print(
        f"[SAVED] {metadata_path}"
    )


# ============================================================
# Main
# ============================================================

def main():

    print("=" * 70)
    print("M6 PROPERTY PROFITABILITY PREDICTION")
    print("PREPROCESSING")
    print("=" * 70)

    print("\nLoading dataset:")
    print(DATA_PATH)

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"M6 dataset not found:\n{DATA_PATH}"
        )

    df = pd.read_csv(DATA_PATH)

    print(
        f"\nDataset shape: {df.shape}"
    )

    validate_dataset(df)

    (
        preprocessor,
        X_train_processed,
        X_validation_processed,
        X_test_processed,
        y_train_regression,
        y_validation_regression,
        y_test_regression,
        y_train_classification,
        y_validation_classification,
        y_test_classification,
    ) = process_data(df)

    save_artifacts(
        preprocessor,
        X_train_processed,
        X_validation_processed,
        X_test_processed,
        y_train_regression,
        y_validation_regression,
        y_test_regression,
        y_train_classification,
        y_validation_classification,
        y_test_classification,
    )

    print("\n" + "=" * 70)
    print("M6 PREPROCESSING: PASS")
    print("=" * 70)

    print("\nArtifacts created in:")
    print(ARTIFACT_DIR)

    print("\nPreprocessing completed successfully.")


if __name__ == "__main__":
    main()