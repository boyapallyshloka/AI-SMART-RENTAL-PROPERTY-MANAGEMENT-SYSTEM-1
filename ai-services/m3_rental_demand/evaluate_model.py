
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    r2_score,
    roc_auc_score,
)

from config import (
    MODULE_DIR,
    REPORTS_DIR,
    DATE_COLUMN,
    TARGET_COLUMN,
    MODEL_PATH,
)

DATA_PATH = MODULE_DIR / "processed" / "training_data.csv"
REPORT_PATH = REPORTS_DIR / "detailed_evaluation.json"

CATEGORICAL_FEATURES = ["city", "area_locality"]

NUMERIC_FEATURES = [
    "property_count",
    "average_monthly_rent",
    "demand_lag_1_month",
    "demand_lag_2_month",
    "demand_growth_1_month",
    "occupancy_rate",
    "vacancy_rate",
    "available_unit_count",
]

FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES


def regression_metrics(actual, predicted):
    predicted = np.maximum(0, predicted)

    return {
        "mae": round(float(mean_absolute_error(actual, predicted)), 4),
        "rmse": round(
            float(np.sqrt(mean_squared_error(actual, predicted))), 4
        ),
        "r2": round(float(r2_score(actual, predicted)), 4),
        "predicted_positive_rate": round(
            float(np.mean(predicted > 0)), 4
        ),
        "actual_positive_rate": round(float(np.mean(actual > 0)), 4),
    }


def main():
    df = pd.read_csv(DATA_PATH)
    df[DATE_COLUMN] = pd.to_datetime(df[DATE_COLUMN], errors="raise")
    df[TARGET_COLUMN] = pd.to_numeric(df[TARGET_COLUMN], errors="raise")
    df = df.sort_values(DATE_COLUMN).reset_index(drop=True)

    months = sorted(df[DATE_COLUMN].unique())
    train_end_idx = int(len(months) * 0.60)
    validation_end_idx = int(len(months) * 0.80)

    train_end = pd.Timestamp(months[train_end_idx])
    validation_end = pd.Timestamp(months[validation_end_idx])

    train_df = df[df[DATE_COLUMN] < train_end]
    test_df = df[df[DATE_COLUMN] >= validation_end].copy()

    if test_df.empty or train_df.empty:
        raise ValueError("Training or test period is empty.")

    artifact = joblib.load(MODEL_PATH)
    classifier = artifact["classifier"]
    regressor = artifact["regressor"]
    threshold = float(artifact["threshold"])

    X_test = test_df[FEATURES]
    actual = test_df[TARGET_COLUMN].to_numpy(dtype=float)
    actual_positive = (actual > 0).astype(int)

    probabilities = classifier.predict_proba(X_test)[:, 1]
    predicted_positive = (probabilities >= threshold).astype(int)

    predicted_magnitude = np.maximum(0, regressor.predict(X_test))
    two_stage_predictions = np.where(
        predicted_positive == 1,
        predicted_magnitude,
        0,
    )

    # Baseline 1: always predict zero demand.
    zero_predictions = np.zeros(len(test_df))

    # Baseline 2: always predict the mean target in training.
    mean_value = float(train_df[TARGET_COLUMN].mean())
    mean_predictions = np.full(len(test_df), mean_value)

    # Metrics for the positive-demand classifier.
    if len(np.unique(actual_positive)) == 2:
        roc_auc = float(roc_auc_score(actual_positive, probabilities))
    else:
        roc_auc = None

    tn, fp, fn, tp = confusion_matrix(
        actual_positive,
        predicted_positive,
        labels=[0, 1],
    ).ravel()

    report = {
        "test_start": str(test_df[DATE_COLUMN].min().date()),
        "test_end": str(test_df[DATE_COLUMN].max().date()),
        "test_rows": int(len(test_df)),
        "threshold": threshold,
        "classifier": {
            "accuracy": round(
                float(accuracy_score(actual_positive, predicted_positive)), 4
            ),
            "precision": round(
                float(precision_score(
                    actual_positive, predicted_positive, zero_division=0
                )), 4
            ),
            "recall": round(
                float(recall_score(
                    actual_positive, predicted_positive, zero_division=0
                )), 4
            ),
            "f1": round(
                float(f1_score(
                    actual_positive, predicted_positive, zero_division=0
                )), 4
            ),
            "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
            "confusion_matrix": {
                "true_negative": int(tn),
                "false_positive": int(fp),
                "false_negative": int(fn),
                "true_positive": int(tp),
            },
        },
        "two_stage_model": regression_metrics(
            actual, two_stage_predictions
        ),
        "always_zero_baseline": regression_metrics(
            actual, zero_predictions
        ),
        "training_mean_baseline": regression_metrics(
            actual, mean_predictions
        ),
        "limitations": [
            "Evaluation uses the same chronological test period as training.",
            "The dataset is synthetic; metrics do not prove real-world accuracy.",
        ],
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        json.dumps(report, indent=4),
        encoding="utf-8",
    )

    print("\n--- CLASSIFIER ---")
    print(json.dumps(report["classifier"], indent=4))

    print("\n--- TWO-STAGE MODEL ---")
    print(json.dumps(report["two_stage_model"], indent=4))

    print("\n--- ALWAYS-ZERO BASELINE ---")
    print(json.dumps(report["always_zero_baseline"], indent=4))

    print("\n--- TRAINING-MEAN BASELINE ---")
    print(json.dumps(report["training_mean_baseline"], indent=4))

    print("\nDetailed report saved to:", REPORT_PATH)


if __name__ == "__main__":
    main()
