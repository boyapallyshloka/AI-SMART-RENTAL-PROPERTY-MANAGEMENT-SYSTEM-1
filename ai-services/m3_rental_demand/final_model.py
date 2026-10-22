import pandas as pd
import json
import os
import joblib
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, f1_score, accuracy_score,
    roc_auc_score, confusion_matrix, r2_score
)

from preprocessing import load_and_prepare, time_based_split, FEATURES, TARGET

ARTIFACTS_DIR = "m3_rental_demand/artifacts"

def train_and_evaluate():
    print("SCRIPT STARTED")

    df = load_and_prepare()
    train, test = time_based_split(df)

    X_train, y_train = train[FEATURES], train[TARGET]
    X_test, y_test = test[FEATURES], test[TARGET]

    model = GradientBoostingRegressor(random_state=42)
    model.fit(X_train, y_train)

    preds = model.predict(X_test).clip(min=0)

    mae = mean_absolute_error(y_test, preds)
    rmse = mean_squared_error(y_test, preds) ** 0.5

    y_test_bin = (y_test > 0).astype(int)
    preds_bin = (preds > 0.5).astype(int)
    acc = accuracy_score(y_test_bin, preds_bin)
    f1 = f1_score(y_test_bin, preds_bin)

    # --- Additional metrics ---
    roc_auc = roc_auc_score(y_test_bin, preds)
    tn, fp, fn, tp = confusion_matrix(y_test_bin, preds_bin).ravel()
    r2 = r2_score(y_test, preds)

    actual_nonzero_mask = y_test > 0
    if actual_nonzero_mask.sum() > 0:
        regressor_only_mae = mean_absolute_error(y_test[actual_nonzero_mask], preds[actual_nonzero_mask])
        regressor_only_rmse = mean_squared_error(y_test[actual_nonzero_mask], preds[actual_nonzero_mask]) ** 0.5
    else:
        regressor_only_mae = regressor_only_rmse = None

    print(f"MAE: {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"Binarized Accuracy: {acc:.4f}")
    print(f"Binarized F1: {f1:.4f}")

    print(f"\n--- Additional Metrics ---")
    print(f"ROC-AUC: {roc_auc:.4f}")
    print(f"Confusion Matrix: TN={tn}, FP={fp}, FN={fn}, TP={tp}")
    print(f"R-squared: {r2:.4f}")
    if regressor_only_mae is not None:
        print(f"Regressor-only MAE (on actual nonzero rows): {regressor_only_mae:.4f}")
        print(f"Regressor-only RMSE (on actual nonzero rows): {regressor_only_rmse:.4f}")

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    joblib.dump(model, f"{ARTIFACTS_DIR}/model_m3_v1_gb.pkl")

    metrics = {
        "model_version": "m3_v1_gb",
        "model_type": "GradientBoostingRegressor",
        "mae": mae,
        "rmse": rmse,
        "binarized_accuracy": acc,
        "binarized_f1": f1,
        "roc_auc": roc_auc,
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "r2_score": r2,
        "regressor_only_mae": regressor_only_mae,
        "regressor_only_rmse": regressor_only_rmse,
         "train_range": "2024-01 to 2025-06",
        "test_range": "2025-07 to 2025-11",
        "features": FEATURES
    }
    with open(f"{ARTIFACTS_DIR}/metrics_gb.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"Model and metrics saved to {ARTIFACTS_DIR}")

if __name__ == "__main__":
    train_and_evaluate()