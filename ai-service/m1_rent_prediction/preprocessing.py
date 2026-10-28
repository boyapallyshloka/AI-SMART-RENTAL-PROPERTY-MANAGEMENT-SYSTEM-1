
"""Shared data loading for the SmartEstate M1 rent prediction workflow."""

from pathlib import Path

import pandas as pd

try:
    from .m1_onehot_pipeline import FEATURE_COLUMNS
except ImportError:
    from m1_onehot_pipeline import FEATURE_COLUMNS


BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR
    / "data"
    / "ml"
    / "M1_Hyderabad_TRAIN_LEAKAGE_SAFE.csv"
)

TARGET_COLUMN = "monthly_rent"


def load_data(data_path=DATA_PATH):
    """Load and validate the leakage-safe M1 training dataset."""

    data_path = Path(data_path)

    if not data_path.exists():
        raise FileNotFoundError(
            f"M1 dataset not found: {data_path}"
        )

    df = pd.read_csv(data_path)

    required_columns = FEATURE_COLUMNS + [TARGET_COLUMN]
    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Dataset is missing required columns: {missing_columns}"
        )

    # Keep the exact model features and target.
    # Metadata such as data_source is deliberately excluded.
    df = df[required_columns].copy()

    # Validate the target before training.
    df[TARGET_COLUMN] = pd.to_numeric(
        df[TARGET_COLUMN],
        errors="coerce"
    )

    invalid_target = (
        df[TARGET_COLUMN].isna()
        | (df[TARGET_COLUMN] < 0)
    )

    if invalid_target.any():
        raise ValueError(
            f"Dataset contains {int(invalid_target.sum())} "
            "rows with missing or invalid monthly_rent."
        )

    return df


def split_features_target(df):
    """Separate the 23 model features from monthly_rent."""

    required_columns = FEATURE_COLUMNS + [TARGET_COLUMN]
    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Cannot split dataset; missing columns: {missing_columns}"
        )

    X = df[FEATURE_COLUMNS].copy()
    y = df[TARGET_COLUMN].copy()

    return X, y
