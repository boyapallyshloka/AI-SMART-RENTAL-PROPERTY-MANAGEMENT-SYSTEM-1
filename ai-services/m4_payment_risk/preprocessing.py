from pathlib import Path

import joblib
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

INPUT_FILE = (
    BASE_DIR
    / "data"
    / "ml"
    / "M4_Payment_Risk_Engineered.csv"
)

ARTIFACT_DIR = BASE_DIR / "m4_payment_risk" / "artifacts"

PREPROCESSOR_FILE = ARTIFACT_DIR / "preprocessor.joblib"

FEATURES_FILE = ARTIFACT_DIR / "feature_list.joblib"


# ============================================================
# TARGET
# ============================================================

TARGET = "risk_label"


# ============================================================
# MODEL FEATURES
# ============================================================
#
# These features are all available at the snapshot date.
#
# Explicitly excluded:
#   - tenant_id              -> identifier
#   - snapshot_month         -> used for chronological ordering/split
#   - data_split             -> dataset split metadata
#   - future_bad_payment_ratio -> future outcome leakage
#
# ============================================================

FEATURES = [
    # --------------------------------------------------------
    # Existing historical features
    # --------------------------------------------------------
    "monthly_income",
    "historical_invoice_count",
    "late_payment_count",
    "missed_payment_count",
    "avg_days_late",
    "max_days_late",
    "historical_outstanding",
    "rent_to_income_ratio",
    "payment_completion_ratio",

    # --------------------------------------------------------
    # Recent 3-month behavior
    # --------------------------------------------------------
    "recent_late_payment_count_3m",
    "recent_missed_payment_count_3m",
    "recent_avg_days_late_3m",
    "recent_payment_completion_ratio_3m",

    # --------------------------------------------------------
    # Recent 6-month behavior
    # --------------------------------------------------------
    "recent_late_payment_count_6m",
    "recent_missed_payment_count_6m",
    "recent_avg_days_late_6m",
    "recent_payment_completion_ratio_6m",

    # --------------------------------------------------------
    # Behavioral trend features
    # --------------------------------------------------------
    "late_payment_trend",
    "missed_payment_trend",
    "payment_completion_trend",
]


# ============================================================
# LOAD DATA
# ============================================================

def load_data():
    print("Loading engineered M4 dataset...")
    print(f"Input: {INPUT_FILE}")

    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"M4 engineered dataset not found: {INPUT_FILE}"
        )

    df = pd.read_csv(INPUT_FILE)

    df["snapshot_month"] = pd.to_datetime(
        df["snapshot_month"],
        errors="coerce"
    )

    return df


# ============================================================
# VALIDATE DATA
# ============================================================

def validate_dataset(df):
    print("\n========== DATA VALIDATION ==========")

    required_columns = (
        FEATURES
        + [
            TARGET,
            "tenant_id",
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
            "Missing required columns:\n"
            + "\n".join(
                f"  - {column}"
                for column in missing_columns
            )
        )

    # --------------------------------------------------------
    # Missing values
    # --------------------------------------------------------

    missing_total = df[required_columns].isna().sum().sum()

    print(f"Rows: {len(df):,}")
    print(f"Columns: {len(df.columns):,}")
    print(f"Missing values: {missing_total}")

    # --------------------------------------------------------
    # Duplicate checks
    # --------------------------------------------------------

    duplicate_rows = df.duplicated().sum()

    duplicate_tenant_month = df.duplicated(
        subset=["tenant_id", "snapshot_month"]
    ).sum()

    print(f"Duplicate rows: {duplicate_rows}")
    print(
        "Duplicate tenant/month rows: "
        f"{duplicate_tenant_month}"
    )

    if duplicate_rows > 0:
        raise ValueError(
            f"Dataset contains {duplicate_rows} duplicate rows."
        )

    if duplicate_tenant_month > 0:
        raise ValueError(
            "Dataset contains duplicate tenant/month records."
        )

    # --------------------------------------------------------
    # Target validation
    # --------------------------------------------------------

    invalid_target = (
        ~df[TARGET].isin([0, 1])
    ).sum()

    if invalid_target > 0:
        raise ValueError(
            f"Invalid target values found: {invalid_target}"
        )

    print("\nTarget distribution:")

    target_counts = (
        df[TARGET]
        .value_counts()
        .sort_index()
    )

    for label, count in target_counts.items():
        percentage = count / len(df) * 100

        print(
            f"  {label}: "
            f"{count:,} "
            f"({percentage:.2f}%)"
        )

    # --------------------------------------------------------
    # Split validation
    # --------------------------------------------------------

    valid_splits = {
        "train",
        "validation",
        "test",
    }

    actual_splits = set(
        df["data_split"].dropna().unique()
    )

    invalid_splits = actual_splits - valid_splits

    if invalid_splits:
        raise ValueError(
            f"Invalid data_split values: {invalid_splits}"
        )

    print("\nDataset splits:")

    for split in ["train", "validation", "test"]:
        split_df = df[df["data_split"] == split]

        print(
            f"  {split}: "
            f"{len(split_df):,} rows"
        )

        if len(split_df) > 0:
            risk_rate = split_df[TARGET].mean()

            print(
                f"    risk rate: "
                f"{risk_rate:.4f}"
            )

    # --------------------------------------------------------
    # Leakage protection
    # --------------------------------------------------------

    forbidden_features = [
        "tenant_id",
        "snapshot_month",
        "data_split",
        "future_bad_payment_ratio",
    ]

    leakage_features = [
        feature
        for feature in FEATURES
        if feature in forbidden_features
    ]

    if leakage_features:
        raise ValueError(
            "Forbidden/leakage features found in FEATURES: "
            f"{leakage_features}"
        )

    # --------------------------------------------------------
    # Verify future leakage column is not selected
    # --------------------------------------------------------

    if "future_bad_payment_ratio" in df.columns:
        print(
            "\n✓ future_bad_payment_ratio exists in dataset "
            "but is excluded from model features."
        )

    print(
        "\n✓ Dataset validation completed successfully."
    )


# ============================================================
# CHRONOLOGICAL SPLIT
# ============================================================

def create_splits(df):
    """
    Use the data_split column already established in the
    M4 dataset.

    This preserves the chronological train/validation/test
    design rather than randomly splitting time-dependent data.
    """

    train_df = df[
        df["data_split"] == "train"
    ].copy()

    validation_df = df[
        df["data_split"] == "validation"
    ].copy()

    test_df = df[
        df["data_split"] == "test"
    ].copy()

    # --------------------------------------------------------
    # Validate chronological ordering
    # --------------------------------------------------------

    train_max = train_df["snapshot_month"].max()
    validation_min = validation_df["snapshot_month"].min()
    validation_max = validation_df["snapshot_month"].max()
    test_min = test_df["snapshot_month"].min()

    print("\n========== CHRONOLOGICAL SPLIT ==========")

    print(
        f"Train:      "
        f"{train_df['snapshot_month'].min().date()} "
        f"-> "
        f"{train_max.date()}"
    )

    print(
        f"Validation: "
        f"{validation_min.date()} "
        f"-> "
        f"{validation_max.date()}"
    )

    print(
        f"Test:       "
        f"{test_min.date()} "
        f"-> "
        f"{test_df['snapshot_month'].max().date()}"
    )

    if train_max >= validation_min:
        raise ValueError(
            "Training and validation periods overlap."
        )

    if validation_max >= test_min:
        raise ValueError(
            "Validation and test periods overlap."
        )

    print(
        "\n✓ Chronological ordering validated."
    )

    return train_df, validation_df, test_df


# ============================================================
# BUILD PREPROCESSOR
# ============================================================

def build_preprocessor():
    """
    Module-specific preprocessing.

    Median imputation protects against missing numeric values.
    RobustScaler reduces the influence of extreme values such
    as unusually high historical outstanding balances.
    """

    return Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="median"
                ),
            ),
            (
                "scaler",
                RobustScaler(),
            ),
        ]
    )


# ============================================================
# PREPROCESS
# ============================================================

def preprocess_data(
    train_df,
    validation_df,
    test_df,
):
    print("\n========== PREPROCESSING ==========")

    X_train = train_df[FEATURES]
    y_train = train_df[TARGET]

    X_validation = validation_df[FEATURES]
    y_validation = validation_df[TARGET]

    X_test = test_df[FEATURES]
    y_test = test_df[TARGET]

    # --------------------------------------------------------
    # Fit ONLY on training data
    # --------------------------------------------------------

    preprocessor = build_preprocessor()

    X_train_processed = preprocessor.fit_transform(
        X_train
    )

    X_validation_processed = preprocessor.transform(
        X_validation
    )

    X_test_processed = preprocessor.transform(
        X_test
    )

    print(
        f"Training shape:   "
        f"{X_train_processed.shape}"
    )

    print(
        f"Validation shape: "
        f"{X_validation_processed.shape}"
    )

    print(
        f"Test shape:       "
        f"{X_test_processed.shape}"
    )

    # --------------------------------------------------------
    # Target shapes
    # --------------------------------------------------------

    print(
        f"\nTraining target:   "
        f"{y_train.shape}"
    )

    print(
        f"Validation target: "
        f"{y_validation.shape}"
    )

    print(
        f"Test target:       "
        f"{y_test.shape}"
    )

    return (
        X_train_processed,
        X_validation_processed,
        X_test_processed,
        y_train,
        y_validation,
        y_test,
        preprocessor,
    )


# ============================================================
# SAVE ARTIFACTS
# ============================================================

def save_artifacts(
    preprocessor,
):
    ARTIFACT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    joblib.dump(
        preprocessor,
        PREPROCESSOR_FILE
    )

    joblib.dump(
        FEATURES,
        FEATURES_FILE
    )

    print("\n========== ARTIFACTS ==========")

    print(
        f"✓ Preprocessor saved:\n"
        f"  {PREPROCESSOR_FILE}"
    )

    print(
        f"✓ Feature list saved:\n"
        f"  {FEATURES_FILE}"
    )


# ============================================================
# MAIN
# ============================================================

def main():
    df = load_data()

    print(
        f"Original dataset shape: "
        f"{df.shape}"
    )

    validate_dataset(df)

    (
        train_df,
        validation_df,
        test_df,
    ) = create_splits(df)

    (
        X_train_processed,
        X_validation_processed,
        X_test_processed,
        y_train,
        y_validation,
        y_test,
        preprocessor,
    ) = preprocess_data(
        train_df,
        validation_df,
        test_df,
    )

    save_artifacts(
        preprocessor
    )

    print("\n========== FEATURE LIST ==========")

    for index, feature in enumerate(
        FEATURES,
        start=1
    ):
        print(
            f"{index:2d}. {feature}"
        )

    print(
        f"\nTotal model features: "
        f"{len(FEATURES)}"
    )

    print(
        "\n✓ M4 preprocessing completed successfully."
    )


if __name__ == "__main__":
    main()