
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)


MODEL_PATH = (
    BASE_DIR
    / "models"
    / "experiments"
    / "m1_model_pipeline_onehot_tuned_experiment.joblib"
)

VALIDATION_PATH = (
    BASE_DIR
    / "data"
    / "ml"
    / "M1_Hyderabad_CURRENT_2026_VALIDATION_LEAKAGE_SAFE.csv"
)

TARGET_COLUMN = "monthly_rent"


if __name__ == "__main__":

    print("\nLoading experimental one-hot M1 model...")

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found: {MODEL_PATH}"
        )

    model = joblib.load(MODEL_PATH)
    print("Model loaded successfully.")

    print("\nLoading untouched validation dataset...")

    if not VALIDATION_PATH.exists():
        raise FileNotFoundError(
            f"Validation dataset not found: {VALIDATION_PATH}"
        )

    df = pd.read_csv(VALIDATION_PATH)
    print("Validation rows:", len(df))

    if TARGET_COLUMN not in df.columns:
        raise ValueError(
            f"Target column '{TARGET_COLUMN}' not found."
        )

    # Keep the same 23 input features used by the model.
    X = df.drop(
        columns=[TARGET_COLUMN, "data_source"],
        errors="ignore",
    )
    y = pd.to_numeric(df[TARGET_COLUMN], errors="coerce")

    if y.isna().any() or (y < 0).any():
        raise ValueError(
            "Validation target contains missing or negative rents."
        )

    print("Input feature columns:", len(X.columns))
    print("\nGenerating predictions...")

    predictions = model.predict(X)

    mae = mean_absolute_error(y, predictions)
    rmse = np.sqrt(mean_squared_error(y, predictions))
    r2 = r2_score(y, predictions)

    absolute_errors = np.abs(y.to_numpy() - predictions)
    p95 = np.percentile(absolute_errors, 95)

    print("\n===== RETRAINED ONE-HOT MODEL VALIDATION =====")
    print(f"Validation rows : {len(df)}")
    print(f"MAE             : ₹{mae:,.2f}")
    print(f"RMSE            : ₹{rmse:,.2f}")
    print(f"R²              : {r2:.4f}")
    print(f"P95 error       : ₹{p95:,.2f}")

    # Segment results by actual monthly rent.
    low_rent_mask = y < 100000
    high_rent_mask = y >= 100000

    if low_rent_mask.any():
        low_mae = mean_absolute_error(
            y[low_rent_mask],
            predictions[low_rent_mask.to_numpy()],
        )
        print(f"\nMAE below ₹1 lakh : ₹{low_mae:,.2f}")

    if high_rent_mask.any():
        high_mae = mean_absolute_error(
            y[high_rent_mask],
            predictions[high_rent_mask.to_numpy()],
        )
        high_rmse = np.sqrt(
            mean_squared_error(
                y[high_rent_mask],
                predictions[high_rent_mask.to_numpy()],
            )
        )
        print(f"MAE at ₹1 lakh+   : ₹{high_mae:,.2f}")
        print(f"RMSE at ₹1 lakh+  : ₹{high_rmse:,.2f}")

    print("\nValidation completed successfully.")
