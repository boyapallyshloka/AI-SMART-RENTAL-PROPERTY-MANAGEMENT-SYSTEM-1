import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from config import (
    DATA_PATH,
    ARTIFACTS_DIR,
    DATE_COLUMN,
    ID_COLUMNS,
    TRAIN_END,
    VALIDATION_START,
    VALIDATION_END,
    TEST_START,
    RANDOM_STATE,
)

TARGET_COLUMN = "next_month_maintenance_cost"

LEAKAGE_COLUMNS = [
    "next_month_maintenance_cost",
    "next_month_maintenance_count",
    "maintenance_risk_label",
]


def load_data():
    df = pd.read_csv(DATA_PATH)
    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN],
        format="%Y-%m"
    )
    return df


def engineer_features(df):
    df = df.copy()

    df["snapshot_year"] = df[DATE_COLUMN].dt.year
    df["snapshot_month_number"] = df[DATE_COLUMN].dt.month

    df["month_sin"] = np.sin(
        2 * np.pi * df["snapshot_month_number"] / 12
    )

    df["month_cos"] = np.cos(
        2 * np.pi * df["snapshot_month_number"] / 12
    )

    df["maintenance_cost_per_event"] = np.where(
        df["historical_maintenance_count"] > 0,
        df["historical_maintenance_cost"]
        / df["historical_maintenance_count"],
        0,
    )

    df["inspection_attention_ratio"] = np.where(
        df["inspection_count"] > 0,
        df["needs_attention_count"]
        / df["inspection_count"],
        0,
    )

    df["critical_equipment_ratio"] = np.where(
        df["equipment_count"] > 0,
        df["critical_equipment_count"]
        / df["equipment_count"],
        0,
    )

    df["recent_maintenance_ratio"] = np.where(
        df["historical_maintenance_count"] > 0,
        df["maintenance_count_last_90d"]
        / df["historical_maintenance_count"],
        0,
    )

    return df


def chronological_split(df):

    train_df = df[
        df[DATE_COLUMN] <= pd.Timestamp(TRAIN_END)
    ].copy()

    validation_df = df[
        (df[DATE_COLUMN] >= pd.Timestamp(VALIDATION_START))
        & (df[DATE_COLUMN] <= pd.Timestamp(VALIDATION_END))
    ].copy()

    test_df = df[
        df[DATE_COLUMN] >= pd.Timestamp(TEST_START)
    ].copy()

    print("\nChronological split:")
    print(f"Train      : {len(train_df):,} records")
    print(f"Validation : {len(validation_df):,} records")
    print(f"Test       : {len(test_df):,} records")

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

    categorical_columns = X.select_dtypes(
        include=["object", "category"]
    ).columns.tolist()

    numerical_columns = X.select_dtypes(
        include=[np.number]
    ).columns.tolist()

    numerical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="median")
            ),
            (
                "scaler",
                StandardScaler()
            ),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="most_frequent")
            ),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                )
            ),
        ]
    )

    return ColumnTransformer(
        transformers=[
            (
                "numeric",
                numerical_pipeline,
                numerical_columns,
            ),
            (
                "categorical",
                categorical_pipeline,
                categorical_columns,
            ),
        ]
    )


def main():

    print("=" * 80)
    print("M5 PREDICTIVE MAINTENANCE - TWO-STAGE COST MODEL")
    print("=" * 80)

    # ---------------------------------------------------------
    # 1. Load and prepare data
    # ---------------------------------------------------------

    df = engineer_features(
        load_data()
    )

    # ---------------------------------------------------------
    # 2. Chronological split
    # ---------------------------------------------------------

    train_df, validation_df, test_df = chronological_split(df)

    # ---------------------------------------------------------
    # 3. Prepare features
    # ---------------------------------------------------------

    X_train, y_train = prepare_xy(train_df)
    X_validation, y_validation = prepare_xy(validation_df)
    X_test, y_test = prepare_xy(test_df)

    print("\nFeature shapes:")
    print(f"X_train      : {X_train.shape}")
    print(f"X_validation : {X_validation.shape}")
    print(f"X_test       : {X_test.shape}")

    # ---------------------------------------------------------
    # 4. Stage 1
    # Train positive-cost probability model
    #
    # We reuse the already validated risk classifier.
    # ---------------------------------------------------------

    risk_model_path = (
        ARTIFACTS_DIR
        / "best_maintenance_risk_model.joblib"
    )

    risk_model = joblib.load(
        risk_model_path
    )

    train_probability = risk_model.predict_proba(
        X_train
    )[:, 1]

    validation_probability = risk_model.predict_proba(
        X_validation
    )[:, 1]

    test_probability = risk_model.predict_proba(
        X_test
    )[:, 1]

    # ---------------------------------------------------------
    # 5. Stage 2
    # Train cost model ONLY on positive-cost records
    # ---------------------------------------------------------

    positive_mask = y_train > 0

    X_train_positive = X_train[
        positive_mask
    ]

    y_train_positive = y_train[
        positive_mask
    ]

    print("\nPositive-cost training records:")
    print(
        f"{len(y_train_positive):,} "
        f"of {len(y_train):,}"
    )

    print(
        f"Positive percentage: "
        f"{positive_mask.mean() * 100:.2f}%"
    )

    preprocessor = build_preprocessor(
        X_train_positive
    )

    positive_cost_model = ExtraTreesRegressor(
        n_estimators=400,
        max_depth=18,
        min_samples_leaf=3,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )

    pipeline = Pipeline(
        steps=[
            (
                "preprocessor",
                preprocessor,
            ),
            (
                "model",
                positive_cost_model,
            ),
        ]
    )

    print("\nTraining positive-cost model...")

    pipeline.fit(
        X_train_positive,
        y_train_positive
    )

    # ---------------------------------------------------------
    # 6. Stage 2 predictions
    # ---------------------------------------------------------

    positive_pred_validation = np.maximum(
        pipeline.predict(X_validation),
        0,
    )

    positive_pred_test = np.maximum(
        pipeline.predict(X_test),
        0,
    )

    # ---------------------------------------------------------
    # 7. Combine probability × positive cost
    # ---------------------------------------------------------

    expected_cost_validation = (
        validation_probability
        * positive_pred_validation
    )

    expected_cost_test = (
        test_probability
        * positive_pred_test
    )

    # ---------------------------------------------------------
    # 8. Validation metrics
    # ---------------------------------------------------------

    validation_mae = mean_absolute_error(
        y_validation,
        expected_cost_validation
    )

    validation_rmse = np.sqrt(
        mean_squared_error(
            y_validation,
            expected_cost_validation
        )
    )

    validation_r2 = r2_score(
        y_validation,
        expected_cost_validation
    )

    # ---------------------------------------------------------
    # 9. Test metrics
    # ---------------------------------------------------------

    test_mae = mean_absolute_error(
        y_test,
        expected_cost_test
    )

    test_rmse = np.sqrt(
        mean_squared_error(
            y_test,
            expected_cost_test
        )
    )

    test_r2 = r2_score(
        y_test,
        expected_cost_test
    )

    # ---------------------------------------------------------
    # 10. Print results
    # ---------------------------------------------------------

    print("\n" + "=" * 80)
    print("VALIDATION RESULTS")
    print("=" * 80)

    print(
        f"MAE  : {validation_mae:.2f}"
    )

    print(
        f"RMSE : {validation_rmse:.2f}"
    )

    print(
        f"R²   : {validation_r2:.4f}"
    )

    print("\n" + "=" * 80)
    print("FINAL TEST RESULTS")
    print("=" * 80)

    print(
        f"Test records: {len(y_test):,}"
    )

    print(
        f"Actual mean cost: "
        f"{y_test.mean():.2f}"
    )

    print(
        f"Predicted mean cost: "
        f"{expected_cost_test.mean():.2f}"
    )

    print(
        f"MAE  : {test_mae:.2f}"
    )

    print(
        f"RMSE : {test_rmse:.2f}"
    )

    print(
        f"R²   : {test_r2:.4f}"
    )

    print(
        f"\nActual zero-cost percentage: "
        f"{(y_test == 0).mean() * 100:.2f}%"
    )

    print(
        f"Predicted near-zero percentage: "
        f"{(expected_cost_test < 1).mean() * 100:.2f}%"
    )

    # ---------------------------------------------------------
    # 11. Save two-stage model
    # ---------------------------------------------------------

    artifact = {
        "risk_model": risk_model,
        "positive_cost_model": pipeline,
        "model_type": "two_stage_hurdle_cost_model",
    }

    model_path = (
        ARTIFACTS_DIR
        / "best_maintenance_cost_model.joblib"
    )

    joblib.dump(
        artifact,
        model_path
    )

    print(
        f"\nModel saved to:\n{model_path}"
    )

    print(
        "\nTwo-stage cost model completed successfully."
    )


if __name__ == "__main__":
    main()