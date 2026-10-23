import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import (
    OneHotEncoder,
    StandardScaler
)

from config import (
    DATA_PATH,
    TARGET_COLUMN,
    DATE_COLUMN,
    ID_COLUMNS,
    LEAKAGE_COLUMNS,
    TRAIN_END,
    VALIDATION_START,
    VALIDATION_END,
    TEST_START,
)


def load_data():

    df = pd.read_csv(DATA_PATH)

    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN],
        format="%Y-%m"
    )

    return df


def engineer_features(df):

    df = df.copy()

    # -----------------------------------------------------
    # DATE FEATURES
    # -----------------------------------------------------

    df["snapshot_year"] = (
        df[DATE_COLUMN].dt.year
    )

    df["snapshot_month_number"] = (
        df[DATE_COLUMN].dt.month
    )

    # Cyclical month encoding
    df["month_sin"] = np.sin(
        2 * np.pi *
        df["snapshot_month_number"] / 12
    )

    df["month_cos"] = np.cos(
        2 * np.pi *
        df["snapshot_month_number"] / 12
    )

    # -----------------------------------------------------
    # MAINTENANCE FEATURE ENGINEERING
    # -----------------------------------------------------

    df["maintenance_cost_per_event"] = np.where(
        df["historical_maintenance_count"] > 0,
        df["historical_maintenance_cost"]
        / df["historical_maintenance_count"],
        0
    )

    df["inspection_attention_ratio"] = np.where(
        df["inspection_count"] > 0,
        df["needs_attention_count"]
        / df["inspection_count"],
        0
    )

    df["critical_equipment_ratio"] = np.where(
        df["equipment_count"] > 0,
        df["critical_equipment_count"]
        / df["equipment_count"],
        0
    )

    df["recent_maintenance_ratio"] = np.where(
        df["historical_maintenance_count"] > 0,
        df["maintenance_count_last_90d"]
        / df["historical_maintenance_count"],
        0
    )

    return df


def chronological_split(df):

    train_df = df[
        df[DATE_COLUMN] <= pd.Timestamp(TRAIN_END)
    ].copy()

    validation_df = df[
        (
            df[DATE_COLUMN]
            >= pd.Timestamp(VALIDATION_START)
        )
        &
        (
            df[DATE_COLUMN]
            <= pd.Timestamp(VALIDATION_END)
        )
    ].copy()

    test_df = df[
        df[DATE_COLUMN] >= pd.Timestamp(TEST_START)
    ].copy()

    print("\nChronological split:")
    print(
        f"Train      : {len(train_df):,} records"
    )
    print(
        f"Validation : {len(validation_df):,} records"
    )
    print(
        f"Test       : {len(test_df):,} records"
    )

    print("\nPositive-class percentage:")

    print(
        "Train:",
        f"{train_df[TARGET_COLUMN].mean() * 100:.2f}%"
    )

    print(
        "Validation:",
        f"{validation_df[TARGET_COLUMN].mean() * 100:.2f}%"
    )

    print(
        "Test:",
        f"{test_df[TARGET_COLUMN].mean() * 100:.2f}%"
    )

    return train_df, validation_df, test_df


def prepare_xy(df):

    y = df[TARGET_COLUMN].copy()

    columns_to_drop = (
        [TARGET_COLUMN, DATE_COLUMN]
        + ID_COLUMNS
        + LEAKAGE_COLUMNS
    )

    X = df.drop(
        columns=columns_to_drop,
        errors="ignore"
    )

    return X, y


def build_preprocessor(X):

    categorical_columns = (
        X.select_dtypes(
            include=["object", "category"]
        )
        .columns
        .tolist()
    )

    numerical_columns = (
        X.select_dtypes(
            include=["number"]
        )
        .columns
        .tolist()
    )

    print("\nCategorical features:")
    print(categorical_columns)

    print("\nNumerical features:")
    print(numerical_columns)

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                StandardScaler(),
                numerical_columns
            ),
            (
                "categorical",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False
                ),
                categorical_columns
            ),
        ]
    )

    return preprocessor


if __name__ == "__main__":

    df = load_data()

    df = engineer_features(df)

    train_df, validation_df, test_df = (
        chronological_split(df)
    )

    X_train, y_train = prepare_xy(train_df)

    X_validation, y_validation = prepare_xy(
        validation_df
    )

    X_test, y_test = prepare_xy(test_df)

    print("\nX_train shape:", X_train.shape)
    print("X_validation shape:", X_validation.shape)
    print("X_test shape:", X_test.shape)