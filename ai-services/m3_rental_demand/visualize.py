import matplotlib.pyplot as plt
import json
import joblib

from m3_rental_demand.config import (
    DATASET_PATH,
    FEATURES,
    MODEL_PATH,
    MODULE_DIR,
    REPORTS_DIR,
    TARGET_COLUMN,
    TARGET_DEFINITION,
)
from m3_rental_demand.preprocessing import load_and_prepare, time_based_split

TARGET = TARGET_COLUMN
PLOTS_DIR = MODULE_DIR / "artifacts" / "plots"

PLOTS_DIR.mkdir(parents=True, exist_ok=True)

def plot_target_distribution(df):
    counts = df[TARGET].value_counts().sort_index()
    plt.figure(figsize=(8, 5))
    counts.plot(kind="bar")
    plt.title(f"Distribution of {TARGET}")
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
    plt.title(f"Average {TARGET} by Month")
    plt.xlabel("Month")
    plt.ylabel("Average demand")
    plt.tight_layout()
    plt.savefig(f"{PLOTS_DIR}/seasonality.png")
    plt.close()
    print("Saved seasonality.png")

def plot_model_comparison():
    report_path = REPORTS_DIR / "model_evaluation.json"
    if not report_path.exists():
        print("No canonical evaluation report found; skipping model comparison chart")
        return

    with report_path.open(encoding="utf-8") as report_file:
        report = json.load(report_file)
    if (
        report.get("dataset_path") != str(DATASET_PATH)
        or report.get("target_definition") != TARGET_DEFINITION
        or not TARGET_DEFINITION
    ):
        print("Evaluation report is stale or target is unverified; skipping model comparison chart")
        return

    model_metrics = report["test_metrics"]
    baseline_metrics = report["baselines"]["train_mean"]["test"]
    names = ["M3 model", "Train-mean baseline"]
    metrics = ["mae", "rmse", "r2"]
    values = [
        [model_metrics[metric] for metric in metrics],
        [baseline_metrics[metric] for metric in metrics],
    ]

    x = range(len(metrics))
    width = 0.35
    plt.figure(figsize=(8, 5))
    plt.bar([i - width / 2 for i in x], values[0], width, label=names[0])
    plt.bar([i + width / 2 for i in x], values[1], width, label=names[1])
    plt.xticks(x, ["MAE", "RMSE", "R²"])
    plt.title("M3 Test Metrics vs Train-Mean Baseline")
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"{PLOTS_DIR}/model_comparison.png")
    plt.close()
    print("Saved model_comparison.png")

def plot_actual_vs_predicted():
    if not TARGET_DEFINITION:
        print("Target definition is unverified; skipping actual vs predicted chart")
        return

    if not MODEL_PATH.exists():
        print("No canonical M3 model artifact found, skipping actual vs predicted chart")
        return

    artifact = joblib.load(MODEL_PATH)
    if artifact.get("features") != FEATURES:
        raise ValueError(
            "Saved model features do not match the configured M3 feature "
            "contract; refusing to plot predictions from a stale artifact."
        )
    if artifact.get("target_definition") != TARGET_DEFINITION:
        print("Model target definition is stale; skipping actual vs predicted chart")
        return

    df = load_and_prepare()
    _, test = time_based_split(df)
    X_test, y_test = test[FEATURES], test[TARGET]
    preds = artifact["regressor"].predict(X_test).clip(min=0)

    plt.figure(figsize=(7, 7))
    plt.scatter(y_test, preds, alpha=0.3)
    max_val = max(y_test.max(), preds.max())
    plt.plot([0, max_val], [0, max_val], "r--", label="Perfect prediction")
    plt.xlabel("Actual demand")
    plt.ylabel("Predicted demand")
    plt.title("Actual vs Predicted (canonical M3 model)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(f"{PLOTS_DIR}/actual_vs_predicted.png")
    plt.close()
    print("Saved actual_vs_predicted.png")

if __name__ == "__main__":
    df = load_and_prepare()
    plot_target_distribution(df)
    plot_seasonality(df)
    plot_model_comparison()
    plot_actual_vs_predicted()
    print(f"\nAll plots saved to {PLOTS_DIR}")

    