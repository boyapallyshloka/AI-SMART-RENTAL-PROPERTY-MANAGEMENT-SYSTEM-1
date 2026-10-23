import argparse
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

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
    CATEGORICAL_FEATURES,
    DATASET_PATH,
    FEATURES,
    MODEL_VERSION,
    NUMERIC_FEATURES,
    TARGET_COLUMN,
    TARGET_DEFINITION,
)
from m3_rental_demand.preprocessing import load_and_prepare, time_based_split


def build_regressor():
    numeric_pipeline = Pipeline(
        [("imputer", SimpleImputer(strategy="median"))]
    )
    categorical_pipeline = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    preprocessor = ColumnTransformer(
        [
            ("numeric", numeric_pipeline, NUMERIC_FEATURES),
            ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
        ]
    )
    return Pipeline(
        [
            ("preprocessor", preprocessor),
            (
                "model",
                GradientBoostingRegressor(
                    n_estimators=100,
                    learning_rate=0.05,
                    max_depth=2,
                    loss="huber",
                    random_state=42,
                ),
            ),
        ]
    )


def _valid_count_predictions(predictions):
    values = np.asarray(predictions, dtype=float)
    if not np.isfinite(values).all():
        raise ValueError("The model returned non-finite demand predictions.")
    return np.maximum(0, values)


def regression_metrics(actual, predicted):
    predicted = _valid_count_predictions(predicted)
    actual = np.asarray(actual, dtype=float)
    return {
        "mae": round(float(mean_absolute_error(actual, predicted)), 4),
        "rmse": round(
            float(np.sqrt(mean_squared_error(actual, predicted))),
            4,
        ),
        "r2": round(float(r2_score(actual, predicted)), 4),
        "actual_mean": round(float(actual.mean()), 4),
        "predicted_mean": round(float(predicted.mean()), 4),
    }


def _sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def train_candidate():
    df = load_and_prepare()
    train_df, test_df = time_based_split(df)

    X_train = train_df[FEATURES]
    X_test = test_df[FEATURES]
    y_train = train_df[TARGET_COLUMN].to_numpy(dtype=float)
    y_test = test_df[TARGET_COLUMN].to_numpy(dtype=float)

    model = build_regressor()
    model.fit(X_train, y_train)

    train_predictions = model.predict(X_train)
    test_predictions = model.predict(X_test)
    train_metrics = regression_metrics(y_train, train_predictions)
    test_metrics = regression_metrics(y_test, test_predictions)

    train_mean = float(y_train.mean())
    baseline_train_predictions = np.full(len(y_train), train_mean)
    baseline_test_predictions = np.full(len(y_test), train_mean)
    baseline_metrics = {
        "train": regression_metrics(y_train, baseline_train_predictions),
        "test": regression_metrics(y_test, baseline_test_predictions),
    }
    property_type_metrics = {}
    for property_type in sorted(test_df["property_type"].unique()):
        train_type = train_df.loc[
            train_df["property_type"] == property_type, TARGET_COLUMN
        ].to_numpy(dtype=float)
        test_mask = test_df["property_type"].eq(property_type).to_numpy()
        type_actual = y_test[test_mask]
        type_predictions = test_predictions[test_mask]
        property_type_metrics[property_type] = {
            "train_rows": int(len(train_type)),
            "test_rows": int(test_mask.sum()),
            "test_target_min": int(type_actual.min()),
            "test_target_max": int(type_actual.max()),
            "model_test_metrics": regression_metrics(
                type_actual,
                type_predictions,
            ),
            "train_mean_baseline_test_metrics": regression_metrics(
                type_actual,
                np.full(len(type_actual), train_mean),
            ),
        }

    target_month_train = train_df["year_month"] + pd.offsets.MonthBegin(1)
    target_month_test = test_df["year_month"] + pd.offsets.MonthBegin(1)
    trained_at_utc = datetime.now(timezone.utc).isoformat()
    dataset_sha256 = _sha256(DATASET_PATH)
    config_script_sha256 = _sha256(
        Path(__file__).with_name("config.py")
    )
    training_script_sha256 = _sha256(__file__)
    preprocessing_script_sha256 = _sha256(
        Path(__file__).with_name("preprocessing.py")
    )
    report = {
        "trained_at_utc": trained_at_utc,
        "dataset_sha256": dataset_sha256,
        "config_script_sha256": config_script_sha256,
        "training_script_sha256": training_script_sha256,
        "preprocessing_script_sha256": preprocessing_script_sha256,
        "model_version": MODEL_VERSION,
        "dataset_path": str(DATASET_PATH),
        "dataset_type": "synthetic/development",
        "target": TARGET_COLUMN,
        "target_definition": TARGET_DEFINITION,
        "features": FEATURES,
        "source_rows": len(df),
        "labeled_rows": len(train_df) + len(test_df),
        "unlabeled_rows_excluded": int(df[TARGET_COLUMN].isna().sum()),
        "target_range": {
            "labeled_min": int(min(y_train.min(), y_test.min())),
            "labeled_max": int(max(y_train.max(), y_test.max())),
            "train_min": int(y_train.min()),
            "train_max": int(y_train.max()),
            "test_min": int(y_test.min()),
            "test_max": int(y_test.max()),
        },
        "split": {
            "strategy": "chronological by target month",
            "train_rows": len(train_df),
            "test_rows": len(test_df),
            "train_feature_period": [
                str(train_df["year_month"].min().date()),
                str(train_df["year_month"].max().date()),
            ],
            "train_target_period": [
                str(target_month_train.min().date()),
                str(target_month_train.max().date()),
            ],
            "test_feature_period": [
                str(test_df["year_month"].min().date()),
                str(test_df["year_month"].max().date()),
            ],
            "test_target_period": [
                str(target_month_test.min().date()),
                str(target_month_test.max().date()),
            ],
        },
        "model_metrics": {
            "train": train_metrics,
            "test": test_metrics,
        },
        "train_mean_baseline_metrics": baseline_metrics,
        "property_type_metrics": property_type_metrics,
        "overfit_diagnostics": {
            "test_minus_train_mae": round(
                test_metrics["mae"] - train_metrics["mae"],
                4,
            ),
            "test_minus_train_rmse": round(
                test_metrics["rmse"] - train_metrics["rmse"],
                4,
            ),
            "test_minus_train_r2": round(
                test_metrics["r2"] - train_metrics["r2"],
                4,
            ),
        },
        "actual_vs_predicted": [
            {
                "city": row.city,
                "area_locality": row.area_locality,
                "property_type": row.property_type,
                "target_month": str(
                    (row.year_month + pd.offsets.MonthBegin(1)).date()
                ),
                "actual": int(getattr(row, TARGET_COLUMN)),
                "predicted": round(
                    float(_valid_count_predictions([prediction])[0]),
                    4,
                ),
            }
            for row, prediction in zip(
                test_df.itertuples(index=False),
                test_predictions,
            )
        ],
        "limitations": [
            "All records and labels are synthetic/development data.",
            "Metrics do not establish real-world forecasting accuracy.",
        ],
    }

    low_threshold, high_threshold = np.quantile(
        y_train,
        [1 / 3, 2 / 3],
    )
    artifact = {
        "regressor": model,
        "features": FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "target": TARGET_COLUMN,
        "target_definition": TARGET_DEFINITION,
        "demand_level_thresholds": {
            "low_max": float(low_threshold),
            "medium_max": float(high_threshold),
        },
        "rate_units": {
            "occupancy_rate": "fraction from 0 to 1",
            "vacancy_rate": "fraction from 0 to 1",
        },
        "model_version": MODEL_VERSION,
        "approach": "regression-only",
        "training_metadata": {
            "trained_at_utc": trained_at_utc,
            "dataset_path": str(DATASET_PATH.resolve()),
            "dataset_sha256": dataset_sha256,
            "config_script_sha256": config_script_sha256,
            "training_script_sha256": training_script_sha256,
            "preprocessing_script_sha256": preprocessing_script_sha256,
            "source_rows": len(df),
            "labeled_rows": len(train_df) + len(test_df),
            "train_rows": len(train_df),
            "test_rows": len(test_df),
            "split_strategy": "chronological by target month",
            "train_target_period": report["split"]["train_target_period"],
            "test_target_period": report["split"]["test_target_period"],
            "test_metrics": test_metrics,
            "train_mean_baseline_test_metrics": baseline_metrics["test"],
            "property_type_metrics": property_type_metrics,
        },
    }
    return artifact, report


def main():
    parser = argparse.ArgumentParser(
        description="Train and evaluate an M3 candidate without replacing the active model."
    )
    parser.add_argument(
        "--candidate-output",
        required=True,
        type=Path,
        help="Temporary candidate artifact location; never the active artifact.",
    )
    parser.add_argument(
        "--evaluation-output",
        required=True,
        type=Path,
        help="New evaluation JSON path; existing reports are not overwritten.",
    )
    args = parser.parse_args()

    artifact, report = train_candidate()
    args.candidate_output.parent.mkdir(parents=True, exist_ok=True)
    args.evaluation_output.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(artifact, args.candidate_output)
    args.evaluation_output.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )
    print(json.dumps({key: value for key, value in report.items() if key != "actual_vs_predicted"}, indent=2))
    print("Candidate model artifact:", args.candidate_output)
    print("Evaluation report:", args.evaluation_output)

if __name__ == "__main__":
    main()
