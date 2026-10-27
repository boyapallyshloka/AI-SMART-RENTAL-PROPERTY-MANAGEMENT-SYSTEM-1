
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from config import (
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

CATEGORICAL_FEATURES = [
    "city",
    "area_locality",
]

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
RANDOM_STATE = 42


def build_preprocessor():
    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
    ])

    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore")),
    ])

    return ColumnTransformer([
        ("numeric", numeric_pipeline, NUMERIC_FEATURES),
        ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
    ])


def build_classifier():
    return Pipeline([
        ("preprocessor", build_preprocessor()),
        (
            "model",
            GradientBoostingClassifier(
                n_estimators=100,
                learning_rate=0.05,
                max_depth=2,
                random_state=RANDOM_STATE,
            ),
        ),
    ])


def build_regressor():
    return Pipeline([
        ("preprocessor", build_preprocessor()),
        (
            "model",
            GradientBoostingRegressor(
                n_estimators=100,
                learning_rate=0.05,
                max_depth=2,
                loss="huber",
                random_state=RANDOM_STATE,
            ),
        ),
    ])


def regression_metrics(y_true, predictions):
    predictions = np.maximum(0, np.asarray(predictions))

    return {
        "mae": round(
            float(mean_absolute_error(y_true, predictions)),
            4,
        ),
        "rmse": round(
            float(np.sqrt(mean_squared_error(y_true, predictions))),
            4,
        ),
        "r2": round(
            float(r2_score(y_true, predictions)),
            4,
        ),
        "actual_mean": round(
            float(np.mean(y_true)),
            4,
        ),
        "predicted_mean": round(
            float(np.mean(predictions)),
            4,
        ),
        "actual_positive_rate": round(
            float(np.mean(np.asarray(y_true) > 0)),
            4,
        ),
        "predicted_positive_rate": round(
            float(np.mean(predictions > 0)),
            4,
        ),
    }


def select_threshold_by_validation_rmse(
    y_validation,
    probabilities,
    predicted_magnitude,
):
    """Choose the threshold with the lowest validation RMSE."""
    results = []

    for candidate in np.round(np.arange(0.10, 0.91, 0.05), 2):
        positive_prediction = probabilities >= candidate

        predictions = np.where(
            positive_prediction,
            predicted_magnitude,
            0,
        )

        rmse = float(
            np.sqrt(
                mean_squared_error(y_validation, predictions)
            )
        )

        results.append({
            "threshold": float(candidate),
            "rmse": rmse,
        })

    best_result = min(
        results,
        key=lambda item: item["rmse"],
    )

    return best_result["threshold"], results


def main():
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Load and validate the prepared dataset.
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Prepared dataset not found: {DATA_PATH}\n"
            "Run feature_engineering.py first."
        )

   

   
    df = pd.read_csv(DATA_PATH)

    # Validate target provenance.
    if "target_provenance" not in df.columns:
        raise ValueError(
            "target_provenance is missing. "
            "Run feature_engineering.py first."
        )

    df["target_provenance"] = (
        df["target_provenance"]
        .astype(str)
        .str.strip()
        .str.upper()
    )

    print("\nTarget provenance counts:")
    print(
        df["target_provenance"].value_counts(dropna=False)
    )

    # Use OBSERVED-labeled targets for this evaluation.
    observed_df = df[
        df["target_provenance"] == "OBSERVED"
    ].copy()

    if observed_df.empty:
        raise ValueError(
            "No OBSERVED-labeled target rows are available."
        )

    df = observed_df.copy()

    print(
        "\nUsing OBSERVED-labeled rows only:",
        len(df),
    )


    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN],
        errors="raise",
    )

    df[TARGET_COLUMN] = pd.to_numeric(
        df[TARGET_COLUMN],
        errors="raise",
    )

    required_columns = FEATURES + [DATE_COLUMN, TARGET_COLUMN]

    missing = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    if df[required_columns].isnull().any().any():
        raise ValueError(
            "Missing values found in required columns. "
            "Inspect the prepared dataset before training."
        )

    if not np.isfinite(
        df[TARGET_COLUMN].to_numpy(dtype=float)
    ).all():
        raise ValueError("Target contains non-finite values.")

    if (df[TARGET_COLUMN] < 0).any():
        raise ValueError("Demand target cannot be negative.")

    if not np.allclose(
        df[TARGET_COLUMN].to_numpy(dtype=float),
        np.round(df[TARGET_COLUMN].to_numpy(dtype=float)),
    ):
        raise ValueError("Demand target must contain integer counts.")

    df[TARGET_COLUMN] = df[TARGET_COLUMN].astype(int)
    df = df.sort_values(DATE_COLUMN).reset_index(drop=True)

    # 2. Create chronological train, validation and test partitions.
    months = sorted(df[DATE_COLUMN].unique())

    if len(months) < 10:
        raise ValueError(
            "At least 10 distinct months are required for this split."
        )

    train_end_index = int(len(months) * 0.60)
    validation_end_index = int(len(months) * 0.80)

    train_end = pd.Timestamp(months[train_end_index])
    validation_end = pd.Timestamp(months[validation_end_index])

    train_df = df[df[DATE_COLUMN] < train_end].copy()

    validation_df = df[
        (df[DATE_COLUMN] >= train_end)
        & (df[DATE_COLUMN] < validation_end)
    ].copy()

    test_df = df[df[DATE_COLUMN] >= validation_end].copy()

    if (
        train_df.empty
        or validation_df.empty
        or test_df.empty
    ):
        raise ValueError("A chronological data partition is empty.")

    X_train = train_df[FEATURES]
    X_validation = validation_df[FEATURES]
    X_test = test_df[FEATURES]

    y_train = train_df[TARGET_COLUMN]
    y_validation = validation_df[TARGET_COLUMN]
    y_test = test_df[TARGET_COLUMN]

    y_train_positive = (y_train > 0).astype(int)
    y_validation_positive = (y_validation > 0).astype(int)
    y_test_positive = (y_test > 0).astype(int)

    if y_train_positive.nunique() < 2:
        raise ValueError(
            "Training data contains only one class for the classifier."
        )

    if y_validation_positive.nunique() < 2:
        print(
            "Warning: validation data contains only one class. "
            "Threshold selection will still use validation RMSE."
        )

    # 3. Stage one: train the zero-versus-positive classifier.
    print("\nTraining GradientBoostingClassifier...")

    classifier = build_classifier()
    classifier.fit(X_train, y_train_positive)

    validation_probabilities = classifier.predict_proba(
        X_validation
    )[:, 1]

   
    # 4. Train the regressor on all demand rows,
    # including rows where the actual demand is zero.
    print("Training direct-demand GradientBoostingRegressor...")

    regressor = build_regressor()

    regressor.fit(
        X_train,
        y_train,
    )


    # 5. Predict demand magnitude on validation data.
    validation_magnitude = np.maximum(
        0,
        regressor.predict(X_validation),
    )

    # 6. Select the threshold using validation RMSE.
    # The test set is NOT used for threshold selection.
    threshold, threshold_results = select_threshold_by_validation_rmse(
        y_validation.to_numpy(),
        validation_probabilities,
        validation_magnitude,
    )

    validation_positive_prediction = (
        validation_probabilities >= threshold
    )

    validation_combined_prediction = np.where(
        validation_positive_prediction,
        validation_magnitude,
        0,
    )

    validation_f1 = f1_score(
        y_validation_positive,
        validation_positive_prediction,
        zero_division=0,
    )

    best_validation_rmse = min(
        result["rmse"]
        for result in threshold_results
    )

    print("\n--- THRESHOLD SELECTION ---")
    print("Selection metric: validation RMSE")
    print("Selected threshold:", threshold)
    print(
        "Best validation RMSE:",
        round(best_validation_rmse, 4),
    )
    print(
        "Validation F1 at selected threshold:",
        round(float(validation_f1), 4),
    )

    print("\nThreshold comparison:")

    for result in threshold_results:
        print(
            f"Threshold={result['threshold']:.2f}, "
            f"RMSE={result['rmse']:.4f}"
        )

    # 7. Evaluate on the untouched chronological test period.
    test_probabilities = classifier.predict_proba(X_test)[:, 1]

    test_positive_prediction = test_probabilities >= threshold

    test_magnitude = np.maximum(
        0,
        regressor.predict(X_test),
    )

    test_predictions = np.where(
        test_positive_prediction,
        test_magnitude,
        0,
    )

    rounded_test_predictions = np.rint(
        test_predictions
    ).astype(int)

    # Baselines for comparison.
    zero_baseline = np.zeros(len(y_test), dtype=float)

    training_mean = float(y_train.mean())
    mean_baseline = np.full(len(y_test), training_mean)

    # 8. Classification metrics.
    if y_test_positive.nunique() == 2:
        test_roc_auc = float(
            roc_auc_score(
                y_test_positive,
                test_probabilities,
            )
        )

        test_average_precision = float(
            average_precision_score(
                y_test_positive,
                test_probabilities,
            )
        )
    else:
        test_roc_auc = None
        test_average_precision = None

    classification_metrics = {
        "threshold": float(threshold),
        "validation_f1_at_selected_threshold": round(
            float(validation_f1),
            4,
        ),
        "test_accuracy": round(
            float(
                accuracy_score(
                    y_test_positive,
                    test_positive_prediction,
                )
            ),
            4,
        ),
        "test_precision": round(
            float(
                precision_score(
                    y_test_positive,
                    test_positive_prediction,
                    zero_division=0,
                )
            ),
            4,
        ),
        "test_recall": round(
            float(
                recall_score(
                    y_test_positive,
                    test_positive_prediction,
                    zero_division=0,
                )
            ),
            4,
        ),
        "test_f1": round(
            float(
                f1_score(
                    y_test_positive,
                    test_positive_prediction,
                    zero_division=0,
                )
            ),
            4,
        ),
        "test_roc_auc": (
            round(test_roc_auc, 4)
            if test_roc_auc is not None
            else None
        ),
        "test_average_precision": (
            round(test_average_precision, 4)
            if test_average_precision is not None
            else None
        ),
    }

    # 9. Create evaluation report.
    report = {
        "model_version": MODEL_VERSION,
        "approach": "two-stage hurdle model",
        "classifier": "GradientBoostingClassifier",
        "regressor": "GradientBoostingRegressor",
        "target": TARGET_COLUMN,
        "features": FEATURES,
        "split_type": "chronological train-validation-test",
        "train_start": str(
            train_df[DATE_COLUMN].min().date()
        ),
        "train_end": str(
            train_df[DATE_COLUMN].max().date()
        ),
        "validation_start": str(
            validation_df[DATE_COLUMN].min().date()
        ),
        "validation_end": str(
            validation_df[DATE_COLUMN].max().date()
        ),
        "test_start": str(
            test_df[DATE_COLUMN].min().date()
        ),
        "test_end": str(
            test_df[DATE_COLUMN].max().date()
        ),
        "train_rows": int(len(train_df)),
        "validation_rows": int(len(validation_df)),
        "test_rows": int(len(test_df)),
        "train_positive_target_rows": int((y_train > 0).sum()),
        "validation_positive_target_rows": int(
            (y_validation > 0).sum()
        ),
        "test_positive_target_rows": int((y_test > 0).sum()),
        "threshold_selection": {
            "metric": "validation RMSE",
            "selected_threshold": float(threshold),
            "best_validation_rmse": round(
                float(best_validation_rmse),
                4,
            ),
            "validation_threshold_results": threshold_results,
        },
        "classification_metrics": classification_metrics,
        "two_stage_test_metrics": regression_metrics(
            y_test.to_numpy(),
            test_predictions,
        ),
        "rounded_two_stage_test_metrics": regression_metrics(
            y_test.to_numpy(),
            rounded_test_predictions,
        ),
        "always_zero_baseline_metrics": regression_metrics(
            y_test.to_numpy(),
            zero_baseline,
        ),
        "training_mean_baseline_metrics": regression_metrics(
            y_test.to_numpy(),
            mean_baseline,
        ),
        "target_provenance_counts": {
            key: int(value)
            for key, value in df["target_provenance"]
            .value_counts(dropna=False)
            .items()
        },
        "limitations": [
            (
                "Target provenance labels are inherited from the "
                "supplied dataset and have not been independently verified."
            ),
            (
                "Metrics calculated on estimated labels are experimental "
                "and do not establish real-world accuracy."
            ),
            (
                "The threshold is selected using validation data, "
                "not test data."
            ),
            (
                "The final evaluation applies to this chronological "
                "test period."
            ),
        ],
    }

    # 10. Save both models, threshold and feature schema together.
    artifact = {
        "classifier": classifier,
        "regressor": regressor,
        "threshold": float(threshold),
        "features": FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "target": TARGET_COLUMN,
        "model_version": MODEL_VERSION,
        "approach": "two-stage hurdle model",
    }

    joblib.dump(artifact, MODEL_PATH)

    REPORT_PATH.write_text(
        json.dumps(report, indent=4),
        encoding="utf-8",
    )

    # 11. Print the key results.
    print("\n--- CHRONOLOGICAL DATA SPLIT ---")
    print("Training rows:", len(train_df))
    print("Validation rows:", len(validation_df))
    print("Testing rows:", len(test_df))

    print("\n--- CLASSIFICATION METRICS ---")
    print(json.dumps(classification_metrics, indent=4))

    print("\n--- TWO-STAGE TEST METRICS ---")
    print(
        json.dumps(
            report["two_stage_test_metrics"],
            indent=4,
        )
    )

    print("\n--- ALWAYS-ZERO BASELINE ---")
    print(
        json.dumps(
            report["always_zero_baseline_metrics"],
            indent=4,
        )
    )

    print("\n--- TRAINING-MEAN BASELINE ---")
    print(
        json.dumps(
            report["training_mean_baseline_metrics"],
            indent=4,
        )
    )

    print("\nModel artifact saved to:", MODEL_PATH)
    print("Evaluation report saved to:", REPORT_PATH)


if __name__ == "__main__":
    main()
