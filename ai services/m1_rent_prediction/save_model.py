
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import train_test_split

from m1_rent_prediction.m1_onehot_pipeline import (
    build_onehot_model,
    FEATURE_COLUMNS,
)


BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR
    / "data"
    / "ml"
    / "M1_Hyderabad_TRAIN_LEAKAGE_SAFE.csv"
)

MODEL_DIR = BASE_DIR / "models" / "experiments"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = (
    MODEL_DIR
    / "m1_model_pipeline_onehot_experiment.joblib"
)

TARGET_COLUMN = "monthly_rent"

PARAMS = {
    "n_estimators": 600,
    "learning_rate": 0.05,
    "max_depth": 5,
    "min_child_weight": 3,
    "subsample": 0.85,
    "colsample_bytree": 0.85,
    "reg_lambda": 5.0,
    "reg_alpha": 0.0,
}


def train_and_save():
    print("\nLoading M1 training dataset...")

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Training dataset not found: {DATA_PATH}"
        )

    df = pd.read_csv(DATA_PATH)

    print("Training dataset rows:", len(df))

    if TARGET_COLUMN not in df.columns:
        raise ValueError(
            f"Target column '{TARGET_COLUMN}' is missing."
        )

    missing_features = [
        column
        for column in FEATURE_COLUMNS
        if column not in df.columns
    ]

    if missing_features:
        raise ValueError(
            f"Missing required features: {missing_features}"
        )

    # Keep only the expected 23 features and the target.
    X = df[FEATURE_COLUMNS].copy()
    y = pd.to_numeric(df[TARGET_COLUMN], errors="coerce")

    # Reject missing or invalid target values.
    valid_rows = y.notna() & (y >= 0)
    X = X.loc[valid_rows].copy()
    y = y.loc[valid_rows].copy()

    if len(X) < 10:
        raise ValueError(
            "Not enough valid rows to train the model."
        )

    # Split before fitting to keep the test rows out of training.
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
    )

    print("Rows used:", len(X))
    print("Training rows:", len(X_train))
    print("Held-out test rows:", len(X_test))

    print("\nTraining one-hot XGBoost model...")

    model = build_onehot_model(PARAMS)
    model.fit(X_train, y_train)

    print("\nEvaluating held-out test split...")

    predictions = model.predict(X_test)

    mae = mean_absolute_error(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    r2 = r2_score(y_test, predictions)

    print("\n===== M1 TRAINING-SPLIT RESULTS =====")
    print(f"MAE  : ₹{mae:,.2f}")
    print(f"RMSE : ₹{rmse:,.2f}")
    print(f"R²   : {r2:.4f}")

    # Save separately; do not overwrite existing models.
    joblib.dump(model, MODEL_PATH)

    print("\nModel saved successfully:")
    print(MODEL_PATH)


if __name__ == "__main__":
    train_and_save()
