import os
import sys
import json
import joblib

import numpy as np
import pandas as pd

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

PARENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))

if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)


try:
    from m3_rental_demand.pipeline import RentalDemandPipeline
    from m3_rental_demand.preprocessing import (
        load_and_prepare,
        time_based_split,
        FEATURES,
        TARGET,
    )
except ImportError:
    from pipeline import RentalDemandPipeline
    from preprocessing import (
        load_and_prepare,
        time_based_split,
        FEATURES,
        TARGET,
    )


from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    f1_score,
    accuracy_score,
    recall_score,
    precision_score,
    roc_auc_score,
    confusion_matrix,
    r2_score,
)


ARTIFACTS_DIR = os.path.join(CURRENT_DIR, "artifacts")


def train_and_evaluate():
    print("SCRIPT STARTED")
    print("=" * 60)

    # ---------------------------------------------------------
    # 1. Load dataset and perform time-based split
    # ---------------------------------------------------------

    print("\nLoading dataset...")

    df = load_and_prepare()

    train, validation, test = time_based_split(df)

    print(f"Training rows: {len(train)}")
    print(f"Testing rows : {len(test)}")

    X_test = test[FEATURES]
    y_test = test[TARGET]

    y_test_bin = (y_test > 0).astype(int)

    # ---------------------------------------------------------
    # 2. Train the unified production pipeline
    # ---------------------------------------------------------

    print("\nFitting unified RentalDemandPipeline...")
    print("-" * 60)

    production_pipeline = RentalDemandPipeline(
        n_estimators=200,
        random_state=42,
        threshold=0.5,
    )
    production_pipeline.fit(train, val_df=validation)

    print("Production pipeline fitted successfully.")

    # ---------------------------------------------------------
    # 3. Generate production predictions
    # ---------------------------------------------------------

    print("\nGenerating predictions...")

    predictions = production_pipeline.predict(test)

    predictions = np.asarray(predictions, dtype=float)
    predictions = np.clip(predictions, 0, None)

    print(
        f"Prediction range: "
        f"min={predictions.min():.4f}, "
        f"max={predictions.max():.4f}, "
        f"mean={predictions.mean():.4f}"
    )

    # ---------------------------------------------------------
    # 4. Classification-style metrics
    # ---------------------------------------------------------

    predicted_positive = (predictions > 0).astype(int)

    acc = accuracy_score(
        y_test_bin,
        predicted_positive,
    )

    f1 = f1_score(
        y_test_bin,
        predicted_positive,
        zero_division=0,
    )

    recall = recall_score(
        y_test_bin,
        predicted_positive,
        zero_division=0,
    )

    precision = precision_score(
        y_test_bin,
        predicted_positive,
        zero_division=0,
    )

    # ---------------------------------------------------------
    # 5. Regression metrics
    # ---------------------------------------------------------

    mae = mean_absolute_error(
        y_test,
        predictions,
    )

    rmse = mean_squared_error(
        y_test,
        predictions,
    ) ** 0.5

    r2 = r2_score(
        y_test,
        predictions,
    )

    # ---------------------------------------------------------
    # 6. ROC-AUC and confusion matrix
    # ---------------------------------------------------------

    roc_auc = None

    if hasattr(production_pipeline, "classifier_"):
        try:
            X_transformed = production_pipeline.preprocessor_.transform(
                X_test
            )

            probabilities = production_pipeline.classifier_.predict_proba(
                X_transformed
            )[:, 1]

            roc_auc = roc_auc_score(
                y_test_bin,
                probabilities,
            )

        except Exception as exc:
            print(
                f"Warning: ROC-AUC could not be calculated: {exc}"
            )

    tn, fp, fn, tp = confusion_matrix(
        y_test_bin,
        predicted_positive,
        labels=[0, 1],
    ).ravel()

    # ---------------------------------------------------------
    # 7. Print metrics
    # ---------------------------------------------------------

    print("\n" + "=" * 60)
    print("PRODUCTION PIPELINE METRICS")
    print("=" * 60)

    print(f"MAE                 : {mae:.4f}")
    print(f"RMSE                : {rmse:.4f}")
    print(f"R-squared           : {r2:.4f}")
    print(f"Binarized Accuracy  : {acc:.4f}")
    print(f"Binarized F1        : {f1:.4f}")
    print(f"Recall              : {recall:.4f}")
    print(f"Precision           : {precision:.4f}")

    if roc_auc is not None:
        print(f"ROC-AUC             : {roc_auc:.4f}")

    print(
        f"Confusion Matrix    : "
        f"TN={tn}, FP={fp}, FN={fn}, TP={tp}"
    )

    # ---------------------------------------------------------
    # 8. Read production threshold
    # ---------------------------------------------------------

    production_threshold = getattr(
        production_pipeline,
        "threshold_",
        0.5,
    )

    print(
        f"\nProduction threshold: "
        f"{float(production_threshold):.2f}"
    )

    # ---------------------------------------------------------
    # 9. Create artifacts directory
    # ---------------------------------------------------------

    os.makedirs(
        ARTIFACTS_DIR,
        exist_ok=True,
    )

    # ---------------------------------------------------------
    # 10. Save unified production pipeline
    # ---------------------------------------------------------

    pipeline_path = os.path.join(
        ARTIFACTS_DIR,
        "model_pipeline.joblib",
    )

    joblib.dump(
        production_pipeline,
        pipeline_path,
    )

    print(
        f"\nSaved unified production pipeline to:"
        f"\n{pipeline_path}"
    )

    # ---------------------------------------------------------
    # 11. Save official metrics
    # ---------------------------------------------------------

    metrics = {
        "model_version": "1.0",
        "model_type": (
            "GradientBoostingClassifier(weighted) + "
            "GradientBoostingRegressor"
        ),
        "architecture": "two_stage_hurdle",
        "pipeline_artifact": "model_pipeline.joblib",
        "threshold": float(production_threshold),

        "mae": float(mae),
        "rmse": float(rmse),
        "r2_score": float(r2),

        "binarized_accuracy": float(acc),
        "binarized_f1": float(f1),
        "recall": float(recall),
        "precision": float(precision),

        "roc_auc": (
            float(roc_auc)
            if roc_auc is not None
            else None
        ),

        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        },

        "train_range": "2024-01 to 2025-06",
        "test_range": "2025-07 to 2025-11",

        "features": list(FEATURES),
    }

    metrics_path = os.path.join(
        ARTIFACTS_DIR,
        "metrics_final.json",
    )

    with open(
        metrics_path,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            metrics,
            f,
            indent=2,
        )

    print(
        f"Saved metrics to:"
        f"\n{metrics_path}"
    )

    # ---------------------------------------------------------
    # 12. Final summary
    # ---------------------------------------------------------

    print("\n" + "=" * 60)
    print("TRAINING COMPLETED SUCCESSFULLY")
    print("=" * 60)

    print(f"Production model : {pipeline_path}")
    print(f"Metrics file     : {metrics_path}")
    print(f"Features         : {len(FEATURES)}")

    return production_pipeline, metrics


if __name__ == "__main__":
    train_and_evaluate()