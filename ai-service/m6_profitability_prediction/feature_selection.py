"""
M6 Property Profitability Prediction
Feature Selection

Purpose:
    Define and validate the final model feature set for M6.

Targets:
    Regression    -> next_month_profit
    Classification -> profitability_label

Selection principles:
    - Exclude identifiers and non-predictive metadata.
    - Exclude direct target columns.
    - Exclude future-looking columns.
    - Keep leakage-safe current, rolling-average, and trend features.
    - Remove redundant rolling-sum features identified during EDA.
    - Keep the feature selection reproducible for both training and prediction.
"""

from pathlib import Path

import pandas as pd


# ============================================================
# Paths
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR.parent / "data" / "ml" / "M6_Profitability_v2.csv"


# ============================================================
# Target columns
# ============================================================

REGRESSION_TARGET = "next_month_profit"
CLASSIFICATION_TARGET = "profitability_label"


# ============================================================
# Columns excluded from model features
# ============================================================

EXCLUDED_COLUMNS = {
    # Identifier
    "property_id",

    # Time / metadata
    "snapshot_month",
    "data_split",

    # Targets
    REGRESSION_TARGET,
    CLASSIFICATION_TARGET,
}


# ============================================================
# Final selected feature set
# ============================================================

SELECTED_FEATURES = [
    # --------------------------------------------------------
    # Property characteristics
    # --------------------------------------------------------
    "city",
    "size_sqft",
    "bedrooms_bhk",
    "property_age_years",
    "monthly_rent",

    # --------------------------------------------------------
    # Current-month financial / occupancy features
    # --------------------------------------------------------
    "collected_rent",
    "expense_amount",
    "current_month_profit",
    "occupancy_rate",
    "estimated_vacancy_loss",
    "revenue_after_estimated_vacancy_loss",

    # --------------------------------------------------------
    # Rolling averages - 3 months
    # --------------------------------------------------------
    "collected_rent_3m_avg",
    "expense_amount_3m_avg",
    "current_month_profit_3m_avg",
    "occupancy_rate_3m_avg",
    "estimated_vacancy_loss_3m_avg",

    # --------------------------------------------------------
    # Rolling averages - 6 months
    # --------------------------------------------------------
    "collected_rent_6m_avg",
    "expense_amount_6m_avg",
    "current_month_profit_6m_avg",
    "occupancy_rate_6m_avg",
    "estimated_vacancy_loss_6m_avg",

    # --------------------------------------------------------
    # Trend features
    # --------------------------------------------------------
    "collected_rent_trend",
    "expense_amount_trend",
    "current_month_profit_trend",
    "occupancy_rate_trend",
    "estimated_vacancy_loss_trend",
]


# ============================================================
# Explicitly excluded redundant features
# ============================================================

REDUNDANT_ROLLING_SUM_FEATURES = [
    "collected_rent_3m_sum",
    "collected_rent_6m_sum",
    "expense_amount_3m_sum",
    "expense_amount_6m_sum",
    "current_month_profit_3m_sum",
    "current_month_profit_6m_sum",
    "occupancy_rate_3m_sum",
    "occupancy_rate_6m_sum",
    "estimated_vacancy_loss_3m_sum",
    "estimated_vacancy_loss_6m_sum",
]


# ============================================================
# Validation
# ============================================================

def validate_feature_selection(df: pd.DataFrame) -> None:
    """Validate the final feature set against the source dataset."""

    print("\n" + "=" * 70)
    print("M6 FEATURE SELECTION VALIDATION")
    print("=" * 70)

    # --------------------------------------------------------
    # 1. Check selected features exist
    # --------------------------------------------------------
    missing_features = [
        feature
        for feature in SELECTED_FEATURES
        if feature not in df.columns
    ]

    if missing_features:
        raise ValueError(
            "Selected features missing from dataset:\n"
            + "\n".join(f"  - {feature}" for feature in missing_features)
        )

    print("\n[PASS] All selected features exist in dataset.")

    # --------------------------------------------------------
    # 2. Check targets are excluded
    # --------------------------------------------------------
    target_in_features = [
        target
        for target in [
            REGRESSION_TARGET,
            CLASSIFICATION_TARGET,
        ]
        if target in SELECTED_FEATURES
    ]

    if target_in_features:
        raise ValueError(
            f"Target leakage detected. Target columns in feature list: "
            f"{target_in_features}"
        )

    print("[PASS] Regression and classification targets excluded.")

    # --------------------------------------------------------
    # 3. Check identifier/time columns are excluded
    # --------------------------------------------------------
    forbidden_features = [
        column
        for column in EXCLUDED_COLUMNS
        if column in SELECTED_FEATURES
    ]

    if forbidden_features:
        raise ValueError(
            "Excluded columns found in selected features:\n"
            + "\n".join(f"  - {column}" for column in forbidden_features)
        )

    print("[PASS] Identifier, time, metadata, and target columns excluded.")

    # --------------------------------------------------------
    # 4. Check redundant rolling sums are excluded
    # --------------------------------------------------------
    redundant_in_features = [
        feature
        for feature in REDUNDANT_ROLLING_SUM_FEATURES
        if feature in SELECTED_FEATURES
    ]

    if redundant_in_features:
        raise ValueError(
            "Redundant rolling-sum features found in selected feature set:\n"
            + "\n".join(f"  - {feature}" for feature in redundant_in_features)
        )

    print("[PASS] Redundant rolling-sum features excluded.")

    # --------------------------------------------------------
    # 5. Check duplicate feature names
    # --------------------------------------------------------
    duplicates = pd.Series(SELECTED_FEATURES)[
        pd.Series(SELECTED_FEATURES).duplicated()
    ].tolist()

    if duplicates:
        raise ValueError(
            f"Duplicate features found: {duplicates}"
        )

    print("[PASS] No duplicate feature names.")

    # --------------------------------------------------------
    # 6. Check future-looking names
    # --------------------------------------------------------
    future_keywords = [
        "next_month",
        "future",
        "next_month_profit",
        "future_profit",
    ]

    future_features = [
        feature
        for feature in SELECTED_FEATURES
        if any(keyword in feature.lower() for keyword in future_keywords)
    ]

    if future_features:
        raise ValueError(
            "Potential future-looking features detected:\n"
            + "\n".join(f"  - {feature}" for feature in future_features)
        )

    print("[PASS] No future-looking feature names detected.")

    # --------------------------------------------------------
    # 7. Check data types
    # --------------------------------------------------------
    categorical_features = [
        feature
        for feature in SELECTED_FEATURES
        if df[feature].dtype == "object"
    ]

    numerical_features = [
        feature
        for feature in SELECTED_FEATURES
        if feature not in categorical_features
    ]

    print("\nFeature type summary:")
    print(f"  Total features      : {len(SELECTED_FEATURES)}")
    print(f"  Numerical features  : {len(numerical_features)}")
    print(f"  Categorical features: {len(categorical_features)}")

    if categorical_features:
        print("\nCategorical features:")
        for feature in categorical_features:
            print(f"  - {feature}")

    # --------------------------------------------------------
    # 8. Check missing values
    # --------------------------------------------------------
    missing_counts = df[SELECTED_FEATURES].isnull().sum()
    total_missing = int(missing_counts.sum())

    if total_missing > 0:
        print("\n[WARNING] Missing values found:")
        print(missing_counts[missing_counts > 0])
    else:
        print("[PASS] No missing values in selected features.")

    # --------------------------------------------------------
    # 9. Display selected feature list
    # --------------------------------------------------------
    print("\nSelected model features:")

    for index, feature in enumerate(SELECTED_FEATURES, start=1):
        print(f"  {index:2d}. {feature}")

    # --------------------------------------------------------
    # 10. Display excluded columns
    # --------------------------------------------------------
    print("\nExcluded model columns:")

    for column in sorted(EXCLUDED_COLUMNS):
        print(f"  - {column}")

    print("\nExcluded redundant rolling-sum features:")

    for feature in REDUNDANT_ROLLING_SUM_FEATURES:
        print(f"  - {feature}")

    print("\n" + "=" * 70)
    print("FEATURE SELECTION VALIDATION: PASS")
    print("=" * 70)


# ============================================================
# Main
# ============================================================

def main():
    print("=" * 70)
    print("M6 PROPERTY PROFITABILITY PREDICTION")
    print("FEATURE SELECTION")
    print("=" * 70)

    print(f"\nLoading dataset:")
    print(f"  {DATA_PATH}")

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"M6 dataset not found:\n{DATA_PATH}"
        )

    df = pd.read_csv(DATA_PATH)

    print(f"\nDataset shape: {df.shape}")

    validate_feature_selection(df)

    # --------------------------------------------------------
    # Final feature matrix
    # --------------------------------------------------------
    X = df[SELECTED_FEATURES].copy()

    y_regression = df[REGRESSION_TARGET].copy()
    y_classification = df[CLASSIFICATION_TARGET].copy()

    print("\nFinal modeling shapes:")
    print(f"  X features          : {X.shape}")
    print(f"  Regression target   : {y_regression.shape}")
    print(f"  Classification target: {y_classification.shape}")

    print("\nTarget summary:")
    print(
        f"  Regression target: {REGRESSION_TARGET}"
    )
    print(
        f"    Mean   : {y_regression.mean():,.2f}"
    )
    print(
        f"    Median : {y_regression.median():,.2f}"
    )
    print(
        f"    Min    : {y_regression.min():,.2f}"
    )
    print(
        f"    Max    : {y_regression.max():,.2f}"
    )

    print(
        f"\n  Classification target: {CLASSIFICATION_TARGET}"
    )
    print(
        y_classification.value_counts().sort_index().to_string()
    )

    print("\nFeature selection completed successfully.")


if __name__ == "__main__":
    main()