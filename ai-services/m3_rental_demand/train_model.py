
import json

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from m3_rental_demand.config import (
    MODULE_DIR,
    ARTIFACTS_DIR,
    REPORTS_DIR,
    DATE_COLUMN,
    TARGET_COLUMN,
    MODEL_PATH,
    MODEL_VERSION,
)

DATA_PATH = MODULE_DIR / "processed" / "training_data.csv"
REPORT_PATH = REPORTS_DIR / "model_evaluation.json"

CATEGORICAL_FEATURES = ["city", "area_locality"]

NUMERIC_FEATURES = [
    "month",
    "property_count",
    "application_count",
    "agreement_start_count",
    "average_monthly_rent",
    "demand_lag_1_month",
    "demand_lag_2_month",
    "demand_growth_1_month",
    "occupancy_rate",
    "vacancy_rate",
    "available_unit_count",
]

FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES


def build_regressor():
    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
    ])

    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore")),
    ])

    preprocessor = ColumnTransformer([
        ("numeric", numeric_pipeline, NUMERIC_FEATURES),
        ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
    ])

    return Pipeline([
        ("preprocessor", preprocessor),
        ("model", GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.05,
            max_depth=2,
            loss="huber",
            random_state=42,
        )),
    ])


def regression_metrics(y_true, predictions):
    predictions = np.maximum(0, np.asarray(predictions, dtype=float))

    return {
        "mae": round(float(mean_absolute_error(y_true, predictions)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, predictions))), 4),
        "r2": round(float(r2_score(y_true, predictions)), 4),
        "actual_mean": round(float(np.mean(y_true)), 4),
        "predicted_mean": round(float(np.mean(predictions)), 4),
    }


def main():
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Prepared dataset not found: {DATA_PATH}. "
            "Run feature_engineering.py first."
        )

    df = pd.read_csv(DATA_PATH)

    required = FEATURES + [DATE_COLUMN, TARGET_COLUMN]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df[DATE_COLUMN] = pd.to_datetime(df[DATE_COLUMN], errors="coerce")
    df[TARGET_COLUMN] = pd.to_numeric(df[TARGET_COLUMN], errors="coerce")
    df = df.dropna(subset=[DATE_COLUMN, TARGET_COLUMN]).copy()

    if df.empty:
        raise ValueError("No valid rows remain after data validation.")

    targets = df[TARGET_COLUMN].to_numpy(dtype=float)

    if not np.isfinite(targets).all() or (targets < 0).any():
        raise ValueError("Target must contain finite, non-negative counts.")

    if not np.allclose(targets, np.round(targets)):
        raise ValueError("Target must contain integer demand counts.")

    df[TARGET_COLUMN] = df[TARGET_COLUMN].astype(int)
    df = df.sort_values(DATE_COLUMN).reset_index(drop=True)

    # Keep all localities from a given month in the same partition.
    months = sorted(df[DATE_COLUMN].unique())
    if len(months) < 3:
        raise ValueError("At least 3 distinct months are required.")

    train_end_index = max(1, int(len(months) * 0.60))
    validation_end_index = max(
        train_end_index + 1,
        int(len(months) * 0.80),
    )
    validation_end_index = min(validation_end_index, len(months) - 1)

    train_end = pd.Timestamp(months[train_end_index])
    validation_end = pd.Timestamp(months[validation_end_index])

    train_df = df[df[DATE_COLUMN] < train_end].copy()
    validation_df = df[
        (df[DATE_COLUMN] >= train_end)
        & (df[DATE_COLUMN] < validation_end)
    ].copy()
    test_df = df[df[DATE_COLUMN] >= validation_end].copy()

    if train_df.empty or validation_df.empty or test_df.empty:
        raise ValueError("A chronological data partition is empty.")

    X_train = train_df[FEATURES]
    X_val = validation_df[FEATURES]
    X_test = test_df[FEATURES]

    y_train = train_df[TARGET_COLUMN].to_numpy(dtype=float)
    y_val = validation_df[TARGET_COLUMN].to_numpy(dtype=float)
    y_test = test_df[TARGET_COLUMN].to_numpy(dtype=float)

    print("Dataset:", DATA_PATH)
    print("Dataset rows:", len(df))
    print("Distinct months:", len(months))
    print("Target minimum:", int(df[TARGET_COLUMN].min()))
    print("Target maximum:", int(df[TARGET_COLUMN].max()))
    print("Target zero count:", int((df[TARGET_COLUMN] == 0).sum()))
    print("Training rows:", len(train_df))
    print("Validation rows:", len(validation_df))
    print("Testing rows:", len(test_df))

    model = build_regressor()
    print("\nTraining regression model...")
    model.fit(X_train, y_train)

    val_predictions = np.maximum(0, model.predict(X_val))
    test_predictions = np.maximum(0, model.predict(X_test))

    report = {
        "model_version": MODEL_VERSION,
        "approach": "regression-only",
        "model": "GradientBoostingRegressor",
        "target": TARGET_COLUMN,
        "dataset_path": str(DATA_PATH),
        "dataset_type": "synthetic",
        "target_provenance": "ESTIMATED",
        "features": FEATURES,
        "split": {
            "strategy": "chronological by month",
            "training_rows": len(train_df),
            "validation_rows": len(validation_df),
            "testing_rows": len(test_df),
            "training_period": [
                str(train_df[DATE_COLUMN].min().date()),
                str(train_df[DATE_COLUMN].max().date()),
            ],
            "validation_period": [
                str(validation_df[DATE_COLUMN].min().date()),
                str(validation_df[DATE_COLUMN].max().date()),
            ],
            "testing_period": [
                str(test_df[DATE_COLUMN].min().date()),
                str(test_df[DATE_COLUMN].max().date()),
            ],
        },
        "validation_metrics": regression_metrics(y_val, val_predictions),
        "test_metrics": regression_metrics(y_test, test_predictions),
        "baseline": {
            "test_mean_predictor": regression_metrics(
                y_test, np.full(len(y_test), y_train.mean())
            ),
        },
        "warning": (
            "Training targets are synthetic estimates. "
            "These metrics do not establish real-world rental-demand accuracy."
        ),
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=2)

    # Preserve the artifact location used by the service.
    artifact = {
        "regressor": model,
        "features": FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "target": TARGET_COLUMN,
        "model_version": MODEL_VERSION,
        "approach": "regression-only",
    }

    joblib.dump(artifact, MODEL_PATH)

    print("\nTraining completed.")
    print("Validation metrics:", report["validation_metrics"])
    print("Test metrics:", report["test_metrics"])
    print("Evaluation report:", REPORT_PATH)
    print("Model artifact:", MODEL_PATH)
    print("\nNote: metrics are based on synthetic data.")


if __name__ == "__main__":
    main()
