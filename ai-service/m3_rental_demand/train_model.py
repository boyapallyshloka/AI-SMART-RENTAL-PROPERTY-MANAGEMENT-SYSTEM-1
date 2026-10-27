import json
from datetime import datetime, timezone
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from .config import (
    ARTIFACT_DIR,
    CATEGORICAL_FEATURES,
    DATE_SPLIT_TEST_START,
    DATE_SPLIT_TRAIN_END,
    FEATURE_COLUMNS,
    METADATA_PATH,
    MODEL_PATH,
    MODEL_VERSION,
    NUMERICAL_FEATURES,
    TARGET_COLUMN,
)
from .preprocessing import (
    chronological_split,
    load_dataset,
    prepare_training_data,
)


MODEL_PARAMETERS = {
    "n_estimators": 100,
    "learning_rate": 0.05,
    "max_depth": 2,
    "loss": "huber",
    "random_state": 42,
}


def build_model() -> Pipeline:
    """Build the original M3 Gradient Boosting regression pipeline."""

    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
        ]
    )
    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                ),
            ),
        ]
    )
    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, NUMERICAL_FEATURES),
            ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
        ]
    )
    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "model",
                GradientBoostingRegressor(**MODEL_PARAMETERS),
            ),
        ]
    )


def evaluate_predictions(
    actual: pd.Series | np.ndarray,
    predicted: np.ndarray,
) -> dict[str, float]:
    """Calculate regression metrics for non-negative demand predictions."""

    clipped_predictions = np.maximum(predicted, 0.0)
    return {
        "mae": float(mean_absolute_error(actual, clipped_predictions)),
        "rmse": float(
            np.sqrt(mean_squared_error(actual, clipped_predictions))
        ),
        "r2": float(r2_score(actual, clipped_predictions)),
    }


def train_and_evaluate() -> dict[str, Any]:
    """Fit on historical rows, evaluate on 2026, and save one model artifact."""

    source = load_dataset()
    prepared, omitted_history_rows = prepare_training_data(source)
    train, test = chronological_split(prepared)

    model = build_model()
    model.fit(train[FEATURE_COLUMNS], train[TARGET_COLUMN])

    predictions = model.predict(test[FEATURE_COLUMNS])
    model_metrics = evaluate_predictions(test[TARGET_COLUMN], predictions)
    baseline_predictions = test["application_count"].to_numpy(dtype=float)
    baseline_metrics = evaluate_predictions(
        test[TARGET_COLUMN],
        baseline_predictions,
    )

    per_property_type = {}
    for property_type, group in test.groupby("property_type", sort=True):
        mask = test["property_type"].eq(property_type).to_numpy()
        per_property_type[property_type] = {
            "rows": int(len(group)),
            "model": evaluate_predictions(
                group[TARGET_COLUMN],
                predictions[mask],
            ),
            "baseline_current_application_count": evaluate_predictions(
                group[TARGET_COLUMN],
                group["application_count"].to_numpy(dtype=float),
            ),
        }

    level_thresholds = {
        "low_max": float(train[TARGET_COLUMN].quantile(1 / 3)),
        "medium_max": float(train[TARGET_COLUMN].quantile(2 / 3)),
    }

    metadata = {
        "model_version": MODEL_VERSION,
        "target": TARGET_COLUMN,
        "features": FEATURE_COLUMNS,
        "categorical_features": CATEGORICAL_FEATURES,
        "numerical_features": NUMERICAL_FEATURES,
        "algorithm": "sklearn.ensemble.GradientBoostingRegressor",
        "hyperparameters": MODEL_PARAMETERS,
        "dataset": str(source.attrs.get("source_path", "")) or None,
        "dataset_rows": int(len(source)),
        "usable_rows": int(len(prepared)),
        "rows_excluded_for_unavailable_history": omitted_history_rows,
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "train_period": {
            "start": train["_observation_month"].min().strftime("%Y-%m"),
            "end": train["_observation_month"].max().strftime("%Y-%m"),
        },
        "test_period": {
            "start": test["_observation_month"].min().strftime("%Y-%m"),
            "end": test["_observation_month"].max().strftime("%Y-%m"),
        },
        "required_test_start": DATE_SPLIT_TEST_START,
        "required_train_end": DATE_SPLIT_TRAIN_END,
        "metrics": {
            "model": model_metrics,
            "baseline_current_application_count": baseline_metrics,
            "by_property_type": per_property_type,
        },
        "demand_level_thresholds": level_thresholds,
        "target_provenance": (
            "The supplied next_month_demand is used as the sole development "
            "target. Its generation provenance is unverified."
        ),
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
    }

    artifact = {
        "pipeline": model,
        "target": TARGET_COLUMN,
        "features": FEATURE_COLUMNS,
        "model_version": MODEL_VERSION,
        "demand_level_thresholds": level_thresholds,
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)
    METADATA_PATH.write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(metadata, indent=2))
    print(f"Model artifact: {MODEL_PATH}")
    print(f"Metadata: {METADATA_PATH}")
    return metadata


if __name__ == "__main__":
    train_and_evaluate()
