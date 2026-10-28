
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
import numpy as np


BASE_DIR = Path(__file__).resolve().parent

VALIDATION_PATH = (
    BASE_DIR
    / "data"
    / "ml"
    / "M1_Hyderabad_CURRENT_2026_VALIDATION_LEAKAGE_SAFE.csv"
)

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "m1_model_pipeline_onehot_candidate.joblib"
)

TARGET_COLUMN = "monthly_rent"


def main():
    if not VALIDATION_PATH.exists():
        raise FileNotFoundError(
            f"Validation dataset not found: {VALIDATION_PATH}"
        )

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}"
        )

    print("\nLoading 2026 validation dataset...")
    df = pd.read_csv(VALIDATION_PATH)

    if TARGET_COLUMN not in df.columns:
        raise ValueError(
            f"Validation dataset is missing {TARGET_COLUMN!r}."
        )

    y = df[TARGET_COLUMN]
    X = df.drop(
        columns=[TARGET_COLUMN, "data_source"],
        errors="ignore",
    )

    print("Validation rows:", len(df))
    print("Loading current candidate model...")

    model = joblib.load(MODEL_PATH)
    predictions = model.predict(X)

    mae = mean_absolute_error(y, predictions)
    rmse = np.sqrt(mean_squared_error(y, predictions))
    r2 = r2_score(y, predictions)
    p95 = np.percentile(abs(y.to_numpy() - predictions), 95)

    print("\n========== M1 VALIDATION RESULTS ==========")
    print(f"MAE:  ₹{mae:,.2f}")
    print(f"RMSE: ₹{rmse:,.2f}")
    print(f"R²:   {r2:.4f}")
    print(f"P95:  ₹{p95:,.2f}")
    print("\nValidation completed.")


if __name__ == "__main__":
    main()
