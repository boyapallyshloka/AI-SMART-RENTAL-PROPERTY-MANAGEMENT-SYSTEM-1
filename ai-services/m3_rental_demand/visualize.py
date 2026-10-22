import pandas as pd
import matplotlib.pyplot as plt
import json
import os
import joblib

from preprocessing import load_and_prepare, time_based_split, FEATURES, TARGET

PLOTS_DIR = "m3_rental_demand/artifacts/plots"
ARTIFACTS_DIR = "m3_rental_demand/artifacts"

os.makedirs(PLOTS_DIR, exist_ok=True)

def plot_target_distribution(df):
    counts = df[TARGET].value_counts().sort_index()
    plt.figure(figsize=(8, 5))
    counts.plot(kind="bar")
    plt.title("Distribution of next_month_demand")
    plt.xlabel("Demand value")
    plt.ylabel("Number of rows")
    plt.tight_layout()
    plt.savefig(f"{PLOTS_DIR}/target_distribution.png")
    plt.close()
    print("Saved target_distribution.png")

def plot_seasonality(df):
    avg_by_month = df.groupby("month")[TARGET].mean()
    plt.figure(figsize=(8, 5))
    avg_by_month.plot(kind="line", marker="o")
    plt.title("Average next_month_demand by Month")
    plt.xlabel("Month")
    plt.ylabel("Average demand")
    plt.tight_layout()
    plt.savefig(f"{PLOTS_DIR}/seasonality.png")
    plt.close()
    print("Saved seasonality.png")

def plot_model_comparison():
    metrics_files = [f for f in os.listdir(ARTIFACTS_DIR) if f.startswith("metrics") and f.endswith(".json")]
    if not metrics_files:
        print("No metrics_*.json files found, skipping model comparison chart")
        return

    names, maes, rmses, f1s = [], [], [], []
    for fname in metrics_files:
        with open(f"{ARTIFACTS_DIR}/{fname}") as f:
            m = json.load(f)
        names.append(m.get("model_type", fname))
        maes.append(m.get("mae", 0))
        rmses.append(m.get("rmse", 0))
        f1s.append(m.get("binarized_f1", 0))

    x = range(len(names))
    width = 0.25
    plt.figure(figsize=(10, 6))
    plt.bar([i - width for i in x], maes, width, label="MAE")
    plt.bar(x, rmses, width, label="RMSE")
    plt.bar([i + width for i in x], f1s, width, label="Binarized F1")
    plt.xticks(x, names, rotation=20)
    plt.title("Model Comparison")
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"{PLOTS_DIR}/model_comparison.png")
    plt.close()
    print("Saved model_comparison.png")

def plot_actual_vs_predicted():
    pkl_files = [f for f in os.listdir(ARTIFACTS_DIR) if f.endswith(".pkl")]
    if not pkl_files:
        print("No trained model .pkl files found, skipping actual vs predicted chart")
        return

    model = joblib.load(f"{ARTIFACTS_DIR}/{pkl_files[0]}")
    df = load_and_prepare()
    _, test = time_based_split(df)
    X_test, y_test = test[FEATURES], test[TARGET]
    preds = model.predict(X_test).clip(min=0)

    plt.figure(figsize=(7, 7))
    plt.scatter(y_test, preds, alpha=0.3)
    max_val = max(y_test.max(), preds.max())
    plt.plot([0, max_val], [0, max_val], "r--", label="Perfect prediction")
    plt.xlabel("Actual demand")
    plt.ylabel("Predicted demand")
    plt.title(f"Actual vs Predicted ({pkl_files[0]})")
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"{PLOTS_DIR}/actual_vs_predicted.png")
    plt.close()
    print(f"Saved actual_vs_predicted.png (using {pkl_files[0]})")

if __name__ == "__main__":
    df = load_and_prepare()
    plot_target_distribution(df)
    plot_seasonality(df)
    plot_model_comparison()
    plot_actual_vs_predicted()
    print(f"\nAll plots saved to {PLOTS_DIR}")

    