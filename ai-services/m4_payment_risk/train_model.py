from pathlib import Path
import json
from datetime import datetime

import joblib
import numpy as np
import pandas as pd

from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import RobustScaler

from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
)
from sklearn.svm import SVC

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
)

from xgboost import XGBClassifier


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

DATA_FILE = (
    BASE_DIR
    / "data"
    / "ml"
    / "M4_Payment_Risk_Engineered.csv"
)

ARTIFACT_DIR = (
    BASE_DIR
    / "m4_payment_risk"
    / "artifacts"
)

REPORT_DIR = (
    BASE_DIR
    / "m4_payment_risk"
    / "reports"
)

MODEL_FILE = (
    ARTIFACT_DIR
    / "model_pipeline.joblib"
)

RESULTS_FILE = (
    REPORT_DIR
    / "model_comparison.csv"
)

METADATA_FILE = (
    ARTIFACT_DIR
    / "model_metadata.json"
)


# ============================================================
# CONFIGURATION
# ============================================================

TARGET = "risk_label"

FEATURES = [
    # Existing historical features
    "monthly_income",
    "historical_invoice_count",
    "late_payment_count",
    "missed_payment_count",
    "avg_days_late",
    "max_days_late",
    "historical_outstanding",
    "rent_to_income_ratio",
    "payment_completion_ratio",

    # Recent 3-month behavior
    "recent_late_payment_count_3m",
    "recent_missed_payment_count_3m",
    "recent_avg_days_late_3m",
    "recent_payment_completion_ratio_3m",

    # Recent 6-month behavior
    "recent_late_payment_count_6m",
    "recent_missed_payment_count_6m",
    "recent_avg_days_late_6m",
    "recent_payment_completion_ratio_6m",

    # Trend features
    "late_payment_trend",
    "missed_payment_trend",
    "payment_completion_trend",
]


# ============================================================
# LOAD DATA
# ============================================================

def load_data():
    print("Loading engineered M4 dataset...")
    print(f"Input: {DATA_FILE}")

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}"
        )

    df = pd.read_csv(DATA_FILE)

    df["snapshot_month"] = pd.to_datetime(
        df["snapshot_month"],
        errors="coerce"
    )

    return df


# ============================================================
# VALIDATE DATA
# ============================================================

def validate_data(df):
    print("\n========== DATA VALIDATION ==========")

    required_columns = (
        FEATURES
        + [
            TARGET,
            "tenant_id",
            "snapshot_month",
            "data_split",
        ]
    )

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Missing required columns:\n"
            + "\n".join(
                f"  - {column}"
                for column in missing_columns
            )
        )

    # --------------------------------------------------------
    # Leakage protection
    # --------------------------------------------------------

    forbidden_features = {
        "tenant_id",
        "snapshot_month",
        "data_split",
        "future_bad_payment_ratio",
    }

    invalid_features = [
        feature
        for feature in FEATURES
        if feature in forbidden_features
    ]

    if invalid_features:
        raise ValueError(
            "Forbidden/leakage features detected: "
            f"{invalid_features}"
        )

    # --------------------------------------------------------
    # Target
    # --------------------------------------------------------

    if not df[TARGET].isin([0, 1]).all():
        raise ValueError(
            "Target contains values other than 0 and 1."
        )

    # --------------------------------------------------------
    # Duplicates
    # --------------------------------------------------------

    duplicate_rows = df.duplicated().sum()

    duplicate_tenant_month = df.duplicated(
        subset=[
            "tenant_id",
            "snapshot_month",
        ]
    ).sum()

    if duplicate_rows > 0:
        raise ValueError(
            f"Dataset contains {duplicate_rows} duplicate rows."
        )

    if duplicate_tenant_month > 0:
        raise ValueError(
            "Dataset contains duplicate tenant/month records."
        )

    # --------------------------------------------------------
    # Print summary
    # --------------------------------------------------------

    print(f"Rows: {len(df):,}")
    print(f"Features: {len(FEATURES)}")
    print(f"Duplicate rows: {duplicate_rows}")
    print(
        "Duplicate tenant/month rows: "
        f"{duplicate_tenant_month}"
    )

    print("\n✓ Data validation passed.")


# ============================================================
# CHRONOLOGICAL SPLIT
# ============================================================

def create_splits(df):
    """
    Use the predefined chronological split supplied in the
    M4 dataset.

    No random train/test split is performed.
    """

    train_df = df[
        df["data_split"] == "train"
    ].copy()

    validation_df = df[
        df["data_split"] == "validation"
    ].copy()

    test_df = df[
        df["data_split"] == "test"
    ].copy()

    if train_df.empty:
        raise ValueError("Training split is empty.")

    if validation_df.empty:
        raise ValueError(
            "Validation split is empty."
        )

    if test_df.empty:
        raise ValueError("Test split is empty.")

    # --------------------------------------------------------
    # Verify chronological order
    # --------------------------------------------------------

    train_end = train_df["snapshot_month"].max()
    validation_start = validation_df[
        "snapshot_month"
    ].min()

    validation_end = validation_df[
        "snapshot_month"
    ].max()

    test_start = test_df[
        "snapshot_month"
    ].min()

    if train_end >= validation_start:
        raise ValueError(
            "Training and validation periods overlap."
        )

    if validation_end >= test_start:
        raise ValueError(
            "Validation and test periods overlap."
        )

    print("\n========== CHRONOLOGICAL SPLIT ==========")

    print(
        f"Train:      "
        f"{train_df['snapshot_month'].min().date()} "
        f"-> "
        f"{train_end.date()} "
        f"({len(train_df):,} rows)"
    )

    print(
        f"Validation: "
        f"{validation_start.date()} "
        f"-> "
        f"{validation_end.date()} "
        f"({len(validation_df):,} rows)"
    )

    print(
        f"Test:       "
        f"{test_start.date()} "
        f"-> "
        f"{test_df['snapshot_month'].max().date()} "
        f"({len(test_df):,} rows)"
    )

    return (
        train_df,
        validation_df,
        test_df,
    )


# ============================================================
# PREPROCESSOR
# ============================================================

def create_preprocessor():
    """
    The preprocessing is fitted inside each model pipeline.

    This guarantees that every model receives exactly the same
    preprocessing treatment and that the final saved artifact
    contains both preprocessing and model.
    """

    return Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="median"
                ),
            ),
            (
                "scaler",
                RobustScaler(),
            ),
        ]
    )


# ============================================================
# MODEL DEFINITIONS
# ============================================================

def create_models():
    """
    Six different classification algorithms.

    All models use the same preprocessing pipeline.
    """

    models = {

        # ----------------------------------------------------
        # 1. Logistic Regression
        # ----------------------------------------------------

        "Logistic Regression": LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            random_state=42,
        ),

        # ----------------------------------------------------
        # 2. Decision Tree
        # ----------------------------------------------------

        "Decision Tree": DecisionTreeClassifier(
            max_depth=6,
            min_samples_leaf=20,
            class_weight="balanced",
            random_state=42,
        ),

        # ----------------------------------------------------
        # 3. Random Forest
        # ----------------------------------------------------

        "Random Forest": RandomForestClassifier(
            n_estimators=300,
            max_depth=10,
            min_samples_leaf=5,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        ),

        # ----------------------------------------------------
        # 4. Gradient Boosting
        # ----------------------------------------------------

        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=3,
            min_samples_leaf=10,
            random_state=42,
        ),

        # ----------------------------------------------------
        # 5. XGBoost
        # ----------------------------------------------------

        "XGBoost": XGBClassifier(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        ),

        # ----------------------------------------------------
        # 6. Support Vector Machine
        # ----------------------------------------------------

        "SVM": SVC(
            C=1.0,
            kernel="rbf",
            probability=True,
            class_weight="balanced",
            random_state=42,
        ),
    }

    return models


# ============================================================
# METRICS
# ============================================================

def calculate_metrics(
    y_true,
    y_pred,
    y_probability,
):
    """
    Calculate classification metrics.

    F1 is used as the primary model-selection metric.
    ROC-AUC and PR-AUC provide additional discrimination
    information.
    """

    return {
        "accuracy": accuracy_score(
            y_true,
            y_pred
        ),

        "precision": precision_score(
            y_true,
            y_pred,
            zero_division=0
        ),

        "recall": recall_score(
            y_true,
            y_pred,
            zero_division=0
        ),

        "f1": f1_score(
            y_true,
            y_pred,
            zero_division=0
        ),

        "roc_auc": roc_auc_score(
            y_true,
            y_probability
        ),

        "pr_auc": average_precision_score(
            y_true,
            y_probability
        ),
    }


# ============================================================
# TRAIN + VALIDATE
# ============================================================

def train_and_validate(
    models,
    train_df,
    validation_df,
):
    X_train = train_df[FEATURES]
    y_train = train_df[TARGET]

    X_validation = validation_df[FEATURES]
    y_validation = validation_df[TARGET]

    results = []
    trained_pipelines = {}

    print("\n========== MODEL TRAINING ==========")

    for model_name, model in models.items():

        print(
            f"\nTraining: {model_name}"
        )

        # ----------------------------------------------------
        # Complete preprocessing + model pipeline
        # ----------------------------------------------------

        pipeline = Pipeline(
            steps=[
                (
                    "preprocessor",
                    create_preprocessor()
                ),
                (
                    "model",
                    model
                ),
            ]
        )

        # ----------------------------------------------------
        # Train
        # ----------------------------------------------------

        pipeline.fit(
            X_train,
            y_train
        )

        # ----------------------------------------------------
        # Validation prediction
        # ----------------------------------------------------

        y_pred = pipeline.predict(
            X_validation
        )

        y_probability = pipeline.predict_proba(
            X_validation
        )[:, 1]

        metrics = calculate_metrics(
            y_validation,
            y_pred,
            y_probability,
        )

        result = {
            "model": model_name,
            **metrics,
        }

        results.append(result)

        trained_pipelines[
            model_name
        ] = pipeline

        print(
            f"  Accuracy : {metrics['accuracy']:.4f}"
        )

        print(
            f"  Precision: {metrics['precision']:.4f}"
        )

        print(
            f"  Recall   : {metrics['recall']:.4f}"
        )

        print(
            f"  F1       : {metrics['f1']:.4f}"
        )

        print(
            f"  ROC-AUC  : {metrics['roc_auc']:.4f}"
        )

        print(
            f"  PR-AUC   : {metrics['pr_auc']:.4f}"
        )

    results_df = pd.DataFrame(results)

    # --------------------------------------------------------
    # Sort by primary metric: F1
    # --------------------------------------------------------

    results_df = results_df.sort_values(
        by=[
            "f1",
            "pr_auc",
            "roc_auc",
        ],
        ascending=False
    ).reset_index(drop=True)

    return (
        results_df,
        trained_pipelines,
    )


# ============================================================
# PRINT MODEL COMPARISON
# ============================================================

def print_model_comparison(
    results_df
):
    print(
        "\n========== VALIDATION MODEL COMPARISON =========="
    )

    display_columns = [
        "model",
        "accuracy",
        "precision",
        "recall",
        "f1",
        "roc_auc",
        "pr_auc",
    ]

    print(
        results_df[
            display_columns
        ].to_string(
            index=False,
            float_format=lambda x: f"{x:.4f}"
        )
    )

    print(
        "\nPrimary selection metric: F1-score"
    )

    print(
        "Tie-breakers: PR-AUC, then ROC-AUC"
    )


# ============================================================
# SELECT BEST MODEL
# ============================================================

def select_best_model(
    results_df,
    trained_pipelines,
):
    best_model_name = results_df.iloc[0][
        "model"
    ]

    best_pipeline = trained_pipelines[
        best_model_name
    ]

    best_f1 = results_df.iloc[0]["f1"]

    print(
        "\n========== MODEL SELECTION =========="
    )

    print(
        f"Selected model: {best_model_name}"
    )

    print(
        f"Validation F1: {best_f1:.4f}"
    )

    print(
        "\n✓ Model selected using validation data."
    )

    return (
        best_model_name,
        best_pipeline,
    )


# ============================================================
# TEST EVALUATION
# ============================================================

def evaluate_on_test(
    pipeline,
    model_name,
    test_df,
):
    """
    Evaluate the selected model on the untouched
    chronological test set.
    """

    X_test = test_df[FEATURES]
    y_test = test_df[TARGET]

    y_pred = pipeline.predict(
        X_test
    )

    y_probability = pipeline.predict_proba(
        X_test
    )[:, 1]

    metrics = calculate_metrics(
        y_test,
        y_pred,
        y_probability,
    )

    print(
        "\n========== FINAL TEST EVALUATION =========="
    )

    print(
        f"Selected model: {model_name}"
    )

    print(
        f"Accuracy : {metrics['accuracy']:.4f}"
    )

    print(
        f"Precision: {metrics['precision']:.4f}"
    )

    print(
        f"Recall   : {metrics['recall']:.4f}"
    )

    print(
        f"F1       : {metrics['f1']:.4f}"
    )

    print(
        f"ROC-AUC  : {metrics['roc_auc']:.4f}"
    )

    print(
        f"PR-AUC   : {metrics['pr_auc']:.4f}"
    )

    return metrics


# ============================================================
# SAVE ARTIFACTS
# ============================================================

def save_artifacts(
    pipeline,
    model_name,
    validation_results,
    test_metrics,
):
    ARTIFACT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    REPORT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Complete model pipeline
    # --------------------------------------------------------

    joblib.dump(
        pipeline,
        MODEL_FILE
    )

    # --------------------------------------------------------
    # Model comparison report
    # --------------------------------------------------------

    validation_results.to_csv(
        RESULTS_FILE,
        index=False
    )

    # --------------------------------------------------------
    # Metadata
    # --------------------------------------------------------

    metadata = {
        "module": "M4 Payment Risk Analysis",
        "model": model_name,
        "model_artifact": "model_pipeline.joblib",
        "model_version": "M4-v1.0",

        "training_date": datetime.now().isoformat(
            timespec="seconds"
        ),

        "dataset": (
            "M4_Payment_Risk_Engineered.csv"
        ),

        "target": TARGET,

        "features": FEATURES,

        "feature_count": len(FEATURES),

        "excluded_columns": [
            "tenant_id",
            "snapshot_month",
            "data_split",
            "future_bad_payment_ratio",
        ],

        "split_strategy": "chronological",

        "selection_metric": "f1",

        "validation_metrics": {
            key: float(value)
            for key, value in
            validation_results.iloc[0]
            .drop("model")
            .items()
        },

        "test_metrics": {
            key: float(value)
            for key, value in
            test_metrics.items()
        },

        "preprocessing": [
            "median imputation",
            "RobustScaler",
        ],

        "algorithms_compared": [
            "Logistic Regression",
            "Decision Tree",
            "Random Forest",
            "Gradient Boosting",
            "XGBoost",
            "SVM",
        ],
    }

    with open(
        METADATA_FILE,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            metadata,
            file,
            indent=4
        )

    print(
        "\n========== SAVED ARTIFACTS =========="
    )

    print(
        f"✓ Complete model pipeline:\n"
        f"  {MODEL_FILE}"
    )

    print(
        f"✓ Model comparison report:\n"
        f"  {RESULTS_FILE}"
    )

    print(
        f"✓ Model metadata:\n"
        f"  {METADATA_FILE}"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    # --------------------------------------------------------
    # Load
    # --------------------------------------------------------

    df = load_data()

    print(
        f"Dataset shape: {df.shape}"
    )

    # --------------------------------------------------------
    # Validate
    # --------------------------------------------------------

    validate_data(df)

    # --------------------------------------------------------
    # Chronological split
    # --------------------------------------------------------

    (
        train_df,
        validation_df,
        test_df,
    ) = create_splits(df)

    # --------------------------------------------------------
    # Models
    # --------------------------------------------------------

    models = create_models()

    print(
        f"\nModels to compare: "
        f"{len(models)}"
    )

    for index, model_name in enumerate(
        models.keys(),
        start=1
    ):
        print(
            f"  {index}. {model_name}"
        )

    # --------------------------------------------------------
    # Train + validation
    # --------------------------------------------------------

    (
        results_df,
        trained_pipelines,
    ) = train_and_validate(
        models,
        train_df,
        validation_df,
    )

    # --------------------------------------------------------
    # Comparison
    # --------------------------------------------------------

    print_model_comparison(
        results_df
    )

    # --------------------------------------------------------
    # Select best model
    # --------------------------------------------------------

    (
        best_model_name,
        best_pipeline,
    ) = select_best_model(
        results_df,
        trained_pipelines,
    )

    # --------------------------------------------------------
    # Final test
    # --------------------------------------------------------

    test_metrics = evaluate_on_test(
        best_pipeline,
        best_model_name,
        test_df,
    )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    save_artifacts(
        best_pipeline,
        best_model_name,
        results_df,
        test_metrics,
    )

    # --------------------------------------------------------
    # Final summary
    # --------------------------------------------------------

    print(
        "\n===================================================="
    )

    print(
        "M4 MODEL TRAINING COMPLETED SUCCESSFULLY"
    )

    print(
        f"Best model: {best_model_name}"
    )

    print(
        f"Validation F1: "
        f"{results_df.iloc[0]['f1']:.4f}"
    )

    print(
        f"Test F1: "
        f"{test_metrics['f1']:.4f}"
    )

    print(
        "===================================================="
    )


if __name__ == "__main__":
    main()