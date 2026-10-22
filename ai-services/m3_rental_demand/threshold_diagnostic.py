
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    f1_score,
    mean_absolute_error,
    mean_squared_error,
)

from config import (
    MODULE_DIR,
    REPORTS_DIR,
    DATE_COLUMN,
    TARGET_COLUMN,
    MODEL_PATH,
)

DATA_PATH = MODULE_DIR / "processed" / "training_data.csv"


def main():
    df = pd.read_csv(DATA_PATH)
    df[DATE_COLUMN] = pd.to_datetime(df[DATE_COLUMN], errors="raise")
    df = df.sort_values(DATE_COLUMN).reset_index(drop=True)

    months = sorted(df[DATE_COLUMN].unique())
    validation_end_idx = int(len(months) * 0.80)
    validation_start = pd.Timestamp(months[int(len(months) * 0.60)])
    validation_end = pd.Timestamp(months[validation_end_idx])

    validation = df[
        (df[DATE_COLUMN] >= validation_start)
        & (df[DATE_COLUMN] < validation_end)
    ].copy()

    artifact = joblib.load(MODEL_PATH)
    classifier = artifact["classifier"]
    regressor = artifact["regressor"]
    features = artifact["features"]

    X_val = validation[features]
    actual = validation[TARGET_COLUMN].to_numpy(dtype=float)
    actual_positive = (actual > 0).astype(int)

    probabilities = classifier.predict_proba(X_val)[:, 1]
    magnitude = np.maximum(0, regressor.predict(X_val))

    results = []

    for threshold in np.arange(0.10, 0.91, 0.05):
        positive = probabilities >= threshold
        prediction = np.where(positive, magnitude, 0)

        results.append({
            "threshold": round(float(threshold), 2),
            "mae": round(float(mean_absolute_error(actual, prediction)), 4),
            "rmse": round(float(np.sqrt(
                mean_squared_error(actual, prediction)
            )), 4),
            "f1": round(float(f1_score(
                actual_positive, positive, zero_division=0
            )), 4),
            "predicted_positive_rate": round(float(positive.mean()), 4),
        })

    results_df = pd.DataFrame(results)
    print("\n--- VALIDATION THRESHOLD COMPARISON ---")
    print(results_df.to_string(index=False))

    best_mae = results_df.loc[results_df["mae"].idxmin()]
    best_rmse = results_df.loc[results_df["rmse"].idxmin()]
    best_f1 = results_df.loc[results_df["f1"].idxmax()]

    summary = {
        "best_validation_mae": best_mae.to_dict(),
        "best_validation_rmse": best_rmse.to_dict(),
        "best_validation_f1": best_f1.to_dict(),
        "note": (
            "Use validation results to select a threshold. "
            "Do not choose the threshold using test-set results."
        ),
    }

    report_path = REPORTS_DIR / "threshold_diagnostic.json"
    report_path.write_text(json.dumps(summary, indent=4), encoding="utf-8")
    print("\n--- BEST VALIDATION THRESHOLDS ---")
    print(json.dumps(summary, indent=4))
    print("\nReport saved to:", report_path)


if __name__ == "__main__":
    main()
