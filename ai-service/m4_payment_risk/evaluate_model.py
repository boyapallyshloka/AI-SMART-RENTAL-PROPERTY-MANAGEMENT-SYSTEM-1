"""
M4 Payment Risk - Model Evaluation

Evaluates the final saved M4 model pipeline on the
chronological validation and test datasets.

Metrics:
- Accuracy
- Precision
- Recall
- F1-score
- ROC-AUC
- PR-AUC

Also generates:
- Classification report
- Confusion matrix
- Evaluation summary CSV
- Confusion matrix PNG
"""

from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import pandas as pd

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    average_precision_score,
)


BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR.parent
    / "data"
    / "ml"
    / "M4_Payment_Risk_Engineered.csv"
)

ARTIFACT_DIR = BASE_DIR / "artifacts"
REPORT_DIR = BASE_DIR / "reports"
PLOT_DIR = BASE_DIR / "plots"

MODEL_PATH = ARTIFACT_DIR / "model_pipeline.joblib"
FEATURE_LIST_PATH = ARTIFACT_DIR / "feature_list.joblib"


def calculate_metrics(model, X, y):
    """Calculate classification metrics."""

    predictions = model.predict(X)

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(X)[:, 1]
    else:
        probabilities = None

    metrics = {
        "accuracy": accuracy_score(y, predictions),
        "precision": precision_score(
            y,
            predictions,
            zero_division=0,
        ),
        "recall": recall_score(
            y,
            predictions,
            zero_division=0,
        ),
        "f1": f1_score(
            y,
            predictions,
            zero_division=0,
        ),
    }

    if probabilities is not None:
        metrics["roc_auc"] = roc_auc_score(
            y,
            probabilities,
        )

        metrics["pr_auc"] = average_precision_score(
            y,
            probabilities,
        )
    else:
        metrics["roc_auc"] = None
        metrics["pr_auc"] = None

    return metrics, predictions, probabilities


def evaluate_split(model, feature_list, df, split_name):
    """Evaluate one dataset split."""

    split_df = df[df["data_split"] == split_name].copy()

    if split_df.empty:
        raise ValueError(
            f"No rows found for split: {split_name}"
        )

    X = split_df[feature_list]
    y = split_df["risk_label"].astype(int)

    metrics, predictions, probabilities = calculate_metrics(
        model,
        X,
        y,
    )

    cm = confusion_matrix(
        y,
        predictions,
        labels=[0, 1],
    )

    print()
    print("=" * 70)
    print(f"{split_name.upper()} EVALUATION")
    print("=" * 70)

    print(f"Rows       : {len(split_df)}")
    print(f"Actual 0   : {(y == 0).sum()}")
    print(f"Actual 1   : {(y == 1).sum()}")

    print()
    print("METRICS")
    print("-" * 70)

    for name, value in metrics.items():
        if value is None:
            print(f"{name.upper():12}: N/A")
        else:
            print(f"{name.upper():12}: {value:.6f}")

    print()
    print("CONFUSION MATRIX")
    print("-" * 70)
    print("Rows = Actual")
    print("Columns = Predicted")
    print()
    print("                 Predicted")
    print("                 0       1")
    print(f"Actual 0      {cm[0, 0]:5d}   {cm[0, 1]:5d}")
    print(f"Actual 1      {cm[1, 0]:5d}   {cm[1, 1]:5d}")

    print()
    print("CLASSIFICATION REPORT")
    print("-" * 70)

    print(
        classification_report(
            y,
            predictions,
            target_names=[
                "LOW_RISK (0)",
                "HIGH_RISK (1)",
            ],
            zero_division=0,
        )
    )

    return {
        "split": split_name,
        "rows": len(split_df),
        **metrics,
        "true_negative": int(cm[0, 0]),
        "false_positive": int(cm[0, 1]),
        "false_negative": int(cm[1, 0]),
        "true_positive": int(cm[1, 1]),
    }


def save_confusion_matrix(
    model,
    feature_list,
    df,
    split_name,
):
    """Save confusion matrix plot."""

    split_df = df[df["data_split"] == split_name].copy()

    X = split_df[feature_list]
    y = split_df["risk_label"].astype(int)

    predictions = model.predict(X)

    cm = confusion_matrix(
        y,
        predictions,
        labels=[0, 1],
    )

    fig, ax = plt.subplots(figsize=(7, 6))

    image = ax.imshow(cm)

    ax.set_title(
        f"M4 Payment Risk - {split_name.title()} Confusion Matrix"
    )

    ax.set_xlabel("Predicted Label")
    ax.set_ylabel("Actual Label")

    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])

    ax.set_xticklabels(
        ["LOW_RISK (0)", "HIGH_RISK (1)"]
    )

    ax.set_yticklabels(
        ["LOW_RISK (0)", "HIGH_RISK (1)"]
    )

    for i in range(2):
        for j in range(2):
            ax.text(
                j,
                i,
                str(cm[i, j]),
                ha="center",
                va="center",
            )

    fig.colorbar(image, ax=ax)

    plt.tight_layout()

    output_path = (
        PLOT_DIR
        / f"confusion_matrix_{split_name}.png"
    )

    plt.savefig(
        output_path,
        dpi=150,
        bbox_inches="tight",
    )

    plt.close()

    print(
        f"Saved confusion matrix: {output_path}"
    )


def main():
    print("=" * 70)
    print("M4 PAYMENT RISK - FINAL MODEL EVALUATION")
    print("=" * 70)

    # Create directories if needed
    REPORT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    PLOT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Check required files
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_PATH}"
        )

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model artifact not found: {MODEL_PATH}"
        )

    if not FEATURE_LIST_PATH.exists():
        raise FileNotFoundError(
            f"Feature list not found: {FEATURE_LIST_PATH}"
        )

    # Load data and artifacts
    df = pd.read_csv(DATA_PATH)

    model = joblib.load(MODEL_PATH)

    feature_list = joblib.load(
        FEATURE_LIST_PATH
    )

    print()
    print(f"Dataset rows    : {len(df)}")
    print(f"Model features  : {len(feature_list)}")
    print(f"Model artifact  : {MODEL_PATH}")

    print()
    print("Feature list:")
    for index, feature in enumerate(
        feature_list,
        start=1,
    ):
        print(f"  {index:2}. {feature}")

    # Evaluate validation
    validation_result = evaluate_split(
        model,
        feature_list,
        df,
        "validation",
    )

    # Evaluate test
    test_result = evaluate_split(
        model,
        feature_list,
        df,
        "test",
    )

    # Save evaluation summary
    results = pd.DataFrame(
        [
            validation_result,
            test_result,
        ]
    )

    results_path = (
        REPORT_DIR
        / "final_model_evaluation.csv"
    )

    results.to_csv(
        results_path,
        index=False,
    )

    print()
    print(
        f"Saved evaluation summary: {results_path}"
    )

    # Save confusion matrices
    save_confusion_matrix(
        model,
        feature_list,
        df,
        "validation",
    )

    save_confusion_matrix(
        model,
        feature_list,
        df,
        "test",
    )

    print()
    print("=" * 70)
    print("EVALUATION COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()