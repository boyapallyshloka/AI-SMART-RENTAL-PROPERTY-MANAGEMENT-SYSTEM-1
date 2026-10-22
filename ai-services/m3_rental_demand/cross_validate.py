import os
import sys
import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import f1_score, mean_absolute_error, recall_score, precision_score

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from preprocessing import load_and_prepare, FEATURES, TARGET
from pipeline import RentalDemandPipeline


def run_cross_validation(n_splits=5):
    df = load_and_prepare()
    df = df.sort_values("year_month").reset_index(drop=True)

    tscv = TimeSeriesSplit(n_splits=n_splits)
    fold_results = []

    for fold_num, (train_idx, test_idx) in enumerate(tscv.split(df), start=1):
        train_fold = df.iloc[train_idx].copy()
        test_fold = df.iloc[test_idx].copy()

        y_test = test_fold[TARGET]
        y_test_bin = (y_test > 0).astype(int)

        # Skip folds where the test set has no real demand (placeholder data)
        if y_test_bin.sum() == 0:
            print(f"Fold {fold_num}: SKIPPED - test fold has 0% nonzero demand (likely placeholder data)")
            continue

        pipeline = RentalDemandPipeline(n_estimators=200, random_state=42, threshold=0.5)
        pipeline.fit(train_fold, val_df=test_fold)

        final_preds = pipeline.predict(test_fold)
        X_test_encoded = pipeline.preprocessor_.transform(test_fold[pipeline.features_])
        probs = pipeline.classifier_.predict_proba(X_test_encoded)[:, 1]
        class_preds = (probs >= pipeline.threshold_).astype(int)

        mae = mean_absolute_error(y_test, final_preds)
        f1 = f1_score(y_test_bin, class_preds, zero_division=0)
        recall = recall_score(y_test_bin, class_preds, zero_division=0)
        precision = precision_score(y_test_bin, class_preds, zero_division=0)

        fold_results.append({"fold": fold_num, "mae": mae, "f1": f1, "recall": recall, "precision": precision})
        print(f"Fold {fold_num}: MAE={mae:.4f}, F1={f1:.4f}, Recall={recall:.4f}, Precision={precision:.4f}")

    if fold_results:
        avg_mae = np.mean([r["mae"] for r in fold_results])
        avg_f1 = np.mean([r["f1"] for r in fold_results])
        avg_recall = np.mean([r["recall"] for r in fold_results])
        avg_precision = np.mean([r["precision"] for r in fold_results])

        print(f"\n--- Average across {len(fold_results)} valid folds ---")
        print(f"Average MAE: {avg_mae:.4f}")
        print(f"Average F1: {avg_f1:.4f}")
        print(f"Average Recall: {avg_recall:.4f}")
        print(f"Average Precision: {avg_precision:.4f}")
    else:
        print("No valid folds found - all test folds had 0% nonzero demand.")


if __name__ == "__main__":
    run_cross_validation(n_splits=5)