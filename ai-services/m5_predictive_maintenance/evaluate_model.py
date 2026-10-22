import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)

from config import (
    DATA_PATH,
    ARTIFACTS_DIR,
    DATE_COLUMN,
    TARGET_COLUMN,
    ID_COLUMNS,
    LEAKAGE_COLUMNS,
    TEST_START,
)

from preprocessing import load_data, engineer_features


# ============================================================
# LOAD DATA
# ============================================================

df = load_data()
df = engineer_features(df)

test_df = df[df[DATE_COLUMN] >= pd.Timestamp(TEST_START)].copy()

print("=" * 80)
print("M5 PREDICTIVE MAINTENANCE - COMPLETE MODEL EVALUATION")
print("=" * 80)

print(f"\nTest records: {len(test_df)}")
print(f"Test period: {test_df[DATE_COLUMN].min():%Y-%m} to "
      f"{test_df[DATE_COLUMN].max():%Y-%m}")


# ============================================================
# COMMON FEATURE PREPARATION
# ============================================================

def prepare_features(df, target):
    columns_to_drop = [
        target,
        DATE_COLUMN,
        *ID_COLUMNS,
        *LEAKAGE_COLUMNS,
    ]

    X = df.drop(columns=columns_to_drop, errors="ignore")

    return X


# ============================================================
# 1. RISK MODEL
# ============================================================

print("\n" + "=" * 80)
print("1. MAINTENANCE RISK - CLASSIFICATION")
print("=" * 80)

risk_target = "maintenance_risk_label"

X_risk = prepare_features(test_df, risk_target)
y_risk = test_df[risk_target]

risk_model_path = ARTIFACTS_DIR / "best_maintenance_risk_model.joblib"
risk_model = joblib.load(risk_model_path)

risk_pred = risk_model.predict(X_risk)

if hasattr(risk_model, "predict_proba"):
    risk_prob = risk_model.predict_proba(X_risk)[:, 1]
else:
    risk_prob = risk_pred

risk_accuracy = accuracy_score(y_risk, risk_pred)
risk_precision = precision_score(y_risk, risk_pred, zero_division=0)
risk_recall = recall_score(y_risk, risk_pred, zero_division=0)
risk_f1 = f1_score(y_risk, risk_pred, zero_division=0)
risk_roc_auc = roc_auc_score(y_risk, risk_prob)
risk_pr_auc = average_precision_score(y_risk, risk_prob)

print(f"Accuracy : {risk_accuracy:.4f}")
print(f"Precision: {risk_precision:.4f}")
print(f"Recall   : {risk_recall:.4f}")
print(f"F1       : {risk_f1:.4f}")
print(f"ROC-AUC  : {risk_roc_auc:.4f}")
print(f"PR-AUC   : {risk_pr_auc:.4f}")


# ============================================================
# 2. COUNT MODEL
# ============================================================

print("\n" + "=" * 80)
print("2. NEXT-MONTH MAINTENANCE COUNT - REGRESSION")
print("=" * 80)

count_target = "next_month_maintenance_count"

X_count = prepare_features(test_df, count_target)
y_count = test_df[count_target]

count_model_path = ARTIFACTS_DIR / "best_maintenance_count_model.joblib"
count_model = joblib.load(count_model_path)

count_pred = count_model.predict(X_count)

count_mae = mean_absolute_error(y_count, count_pred)
count_rmse = np.sqrt(mean_squared_error(y_count, count_pred))
count_r2 = r2_score(y_count, count_pred)

print(f"MAE : {count_mae:.4f}")
print(f"RMSE: {count_rmse:.4f}")
print(f"R²  : {count_r2:.4f}")


# ============================================================
# 3. COST MODEL
# ============================================================

print("\n" + "=" * 80)
print("3. NEXT-MONTH MAINTENANCE COST - REGRESSION")
print("=" * 80)

cost_target = "next_month_maintenance_cost"

X_cost = prepare_features(test_df, cost_target)
y_cost = test_df[cost_target]

cost_model_path = ARTIFACTS_DIR / "best_maintenance_cost_model.joblib"
cost_model = joblib.load(cost_model_path)

# Current two-stage artifact is a dictionary.
if isinstance(cost_model, dict):

    print("Detected two-stage cost model artifact.")

    risk_model_for_cost = cost_model["risk_model"]
    positive_cost_model = cost_model["positive_cost_model"]

    risk_probability = risk_model_for_cost.predict_proba(X_cost)[:, 1]

    positive_cost_prediction = positive_cost_model.predict(X_cost)
    positive_cost_prediction = np.maximum(positive_cost_prediction, 0)

    cost_pred = risk_probability * positive_cost_prediction

else:

    cost_pred = cost_model.predict(X_cost)
    cost_pred = np.maximum(cost_pred, 0)


cost_mae = mean_absolute_error(y_cost, cost_pred)
cost_rmse = np.sqrt(mean_squared_error(y_cost, cost_pred))
cost_r2 = r2_score(y_cost, cost_pred)

print(f"MAE : {cost_mae:.4f}")
print(f"RMSE: {cost_rmse:.4f}")
print(f"R²  : {cost_r2:.4f}")


# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n" + "=" * 80)
print("FINAL TEST METRICS SUMMARY")
print("=" * 80)

summary = pd.DataFrame([
    {
        "Target": "Maintenance Risk",
        "Model": "Gradient Boosting",
        "Accuracy": risk_accuracy,
        "Precision": risk_precision,
        "Recall": risk_recall,
        "F1": risk_f1,
        "ROC-AUC": risk_roc_auc,
        "PR-AUC": risk_pr_auc,
        "MAE": np.nan,
        "RMSE": np.nan,
        "R2": np.nan,
    },
    {
        "Target": "Maintenance Count",
        "Model": "Extra Trees",
        "Accuracy": np.nan,
        "Precision": np.nan,
        "Recall": np.nan,
        "F1": np.nan,
        "ROC-AUC": np.nan,
        "PR-AUC": np.nan,
        "MAE": count_mae,
        "RMSE": count_rmse,
        "R2": count_r2,
    },
    {
        "Target": "Maintenance Cost",
        "Model": "Current Cost Model",
        "Accuracy": np.nan,
        "Precision": np.nan,
        "Recall": np.nan,
        "F1": np.nan,
        "ROC-AUC": np.nan,
        "PR-AUC": np.nan,
        "MAE": cost_mae,
        "RMSE": cost_rmse,
        "R2": cost_r2,
    },
])

print("\n")
print(summary.to_string(index=False, float_format=lambda x: f"{x:.4f}"))

output_path = ARTIFACTS_DIR / "m5_final_test_metrics.csv"
summary.to_csv(output_path, index=False)

print(f"\nMetrics saved to:")
print(output_path)

print("\n" + "=" * 80)
print("EVALUATION COMPLETE")
print("=" * 80)