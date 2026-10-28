"""
M6 Property Profitability Prediction
Model Training and Evaluation

Targets:
1. Regression  -> next_month_profit
2. Classification -> profitability_label

Avenue360 ML Standard:
- Chronological train/validation/test split
- No lag features
- Preprocessing fitted only on training data during model selection
- Validation used for model selection
- Final selected model retrained on train + validation
- Test set evaluated only once after final training
- Complete preprocessing + model pipeline saved
"""

from pathlib import Path
import json
import warnings

import joblib
import numpy as np
import pandas as pd

from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    ExtraTreesClassifier,
    ExtraTreesRegressor,
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import (
    LinearRegression,
    LogisticRegression,
    Ridge,
)
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
    average_precision_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

warnings.filterwarnings("ignore")


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = BASE_DIR.parent / "data" / "ml" / "M6_Profitability_v2.csv"

ARTIFACT_DIR = BASE_DIR / "artifacts"
REPORT_DIR = BASE_DIR / "reports"

ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# TARGETS
# ============================================================

REGRESSION_TARGET = "next_month_profit"
CLASSIFICATION_TARGET = "profitability_label"


# ============================================================
# SELECTED FEATURES
# ============================================================

FEATURES = [
    "city",
    "size_sqft",
    "bedrooms_bhk",
    "property_age_years",
    "monthly_rent",
    "collected_rent",
    "expense_amount",
    "current_month_profit",
    "occupancy_rate",
    "estimated_vacancy_loss",
    "revenue_after_estimated_vacancy_loss",
    "collected_rent_3m_avg",
    "expense_amount_3m_avg",
    "current_month_profit_3m_avg",
    "occupancy_rate_3m_avg",
    "estimated_vacancy_loss_3m_avg",
    "collected_rent_6m_avg",
    "expense_amount_6m_avg",
    "current_month_profit_6m_avg",
    "occupancy_rate_6m_avg",
    "estimated_vacancy_loss_6m_avg",
    "collected_rent_trend",
    "expense_amount_trend",
    "current_month_profit_trend",
    "occupancy_rate_trend",
    "estimated_vacancy_loss_trend",
]


CATEGORICAL_FEATURES = [
    "city",
]


NUMERICAL_FEATURES = [
    feature for feature in FEATURES
    if feature not in CATEGORICAL_FEATURES
]


EXCLUDED_COLUMNS = [
    "property_id",
    "snapshot_month",
    "next_month_profit",
    "profitability_label",
    "data_split",
]


# ============================================================
# MODEL DEFINITIONS
# ============================================================

REGRESSION_MODELS = {
    "Linear Regression": LinearRegression(),

    "Ridge Regression": Ridge(
        alpha=1.0
    ),

    "Decision Tree Regressor": DecisionTreeRegressor(
        random_state=42,
        max_depth=12,
        min_samples_leaf=20,
    ),

    "Random Forest Regressor": RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
        max_depth=15,
        min_samples_leaf=5,
    ),

    "Gradient Boosting Regressor": GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=3,
        random_state=42,
    ),

    "Extra Trees Regressor": ExtraTreesRegressor(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
        max_depth=15,
        min_samples_leaf=5,
    ),
}


CLASSIFICATION_MODELS = {
    "Logistic Regression": LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        random_state=42,
    ),

    "Decision Tree Classifier": DecisionTreeClassifier(
        random_state=42,
        class_weight="balanced",
        max_depth=10,
        min_samples_leaf=20,
    ),

    "Random Forest Classifier": RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
        max_depth=15,
        min_samples_leaf=5,
    ),

    "Gradient Boosting Classifier": GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=3,
        random_state=42,
    ),

    "Extra Trees Classifier": ExtraTreesClassifier(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
        max_depth=15,
        min_samples_leaf=5,
    ),
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def create_preprocessor():
    """
    Create a fresh preprocessing object.

    Numerical:
        Median imputation + StandardScaler

    Categorical:
        Most-frequent imputation + OneHotEncoder
    """

    numerical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="median"),
            ),
            (
                "scaler",
                StandardScaler(),
            ),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="most_frequent"),
            ),
            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                ),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numerical",
                numerical_pipeline,
                NUMERICAL_FEATURES,
            ),
            (
                "categorical",
                categorical_pipeline,
                CATEGORICAL_FEATURES,
            ),
        ],
        remainder="drop",
    )

    return preprocessor


def calculate_rmse(y_true, y_pred):
    """Calculate RMSE."""

    return float(
        np.sqrt(
            mean_squared_error(
                y_true,
                y_pred,
            )
        )
    )


def build_pipeline(model):
    """
    Build complete preprocessing + model pipeline.

    IMPORTANT:
    This pipeline receives RAW DataFrames.
    """

    return Pipeline(
        steps=[
            (
                "preprocessor",
                create_preprocessor(),
            ),
            (
                "model",
                clone(model),
            ),
        ]
    )


def validate_dataset(df):
    """Validate M6 dataset before training."""

    print("\n" + "=" * 70)
    print("DATASET VALIDATION")
    print("=" * 70)

    required_columns = set(
        FEATURES
        + [
            "property_id",
            "snapshot_month",
            REGRESSION_TARGET,
            CLASSIFICATION_TARGET,
            "data_split",
        ]
    )

    missing_columns = required_columns - set(df.columns)

    if missing_columns:
        raise ValueError(
            f"Missing required columns: {sorted(missing_columns)}"
        )

    print(f"Dataset shape: {df.shape}")

    # Missing values
    missing_count = int(df.isna().sum().sum())

    if missing_count != 0:
        raise ValueError(
            f"Dataset contains {missing_count} missing values."
        )

    print("Missing values: 0")

    # Duplicate property-month
    duplicate_property_month = int(
        df.duplicated(
            subset=["property_id", "snapshot_month"]
        ).sum()
    )

    if duplicate_property_month != 0:
        raise ValueError(
            "Duplicate property-month records detected."
        )

    print("Duplicate property-month records: 0")

    # Duplicate complete rows
    duplicate_rows = int(
        df.duplicated().sum()
    )

    if duplicate_rows != 0:
        raise ValueError(
            "Duplicate complete rows detected."
        )

    print("Duplicate complete rows: 0")

    # Split validation
    expected_splits = {
        "train": 180000,
        "validation": 30000,
        "test": 80000,
    }

    print("\nSplit counts:")

    for split_name, expected_count in expected_splits.items():

        actual_count = int(
            (df["data_split"] == split_name).sum()
        )

        print(
            f"  {split_name}: "
            f"{actual_count:,} rows"
        )

        if actual_count != expected_count:
            raise ValueError(
                f"Unexpected {split_name} row count: "
                f"{actual_count}. "
                f"Expected {expected_count}."
            )

    # Dates
    df["snapshot_month"] = pd.to_datetime(
        df["snapshot_month"]
    )

    print("\nDate ranges:")

    for split_name in [
        "train",
        "validation",
        "test",
    ]:

        split_df = df[
            df["data_split"] == split_name
        ]

        print(
            f"  {split_name}: "
            f"{split_df['snapshot_month'].min().date()} "
            f"-> "
            f"{split_df['snapshot_month'].max().date()}"
        )

    # Target consistency
    expected_labels = (
        df[REGRESSION_TARGET] > 0
    ).astype(int)

    mismatches = int(
        (
            expected_labels
            != df[CLASSIFICATION_TARGET]
        ).sum()
    )

    if mismatches != 0:
        raise ValueError(
            f"Found {mismatches} target-label mismatches."
        )

    print("\nTarget-label consistency: PASS")

    # Feature validation
    for feature in FEATURES:

        if feature in EXCLUDED_COLUMNS:
            raise ValueError(
                f"Excluded column incorrectly included: {feature}"
            )

    print("Selected feature validation: PASS")

    print("\nDATASET VALIDATION: PASS")


# ============================================================
# REGRESSION MODEL SELECTION
# ============================================================

def train_regression_models(
    X_train,
    y_train,
    X_validation,
    y_validation,
):
    """
    Train and evaluate regression models.

    Selection metric:
        MAE

    Tie breakers:
        RMSE
        R2

    Validation is used for model selection.
    """

    print("\n" + "=" * 70)
    print("REGRESSION MODEL TRAINING")
    print("=" * 70)

    results = []
    trained_models = {}

    for model_name, model in REGRESSION_MODELS.items():

        print(
            f"\nTraining: {model_name}"
        )

        pipeline = build_pipeline(model)

        pipeline.fit(
            X_train,
            y_train,
        )

        predictions = pipeline.predict(
            X_validation
        )

        mae = mean_absolute_error(
            y_validation,
            predictions,
        )

        rmse = calculate_rmse(
            y_validation,
            predictions,
        )

        r2 = r2_score(
            y_validation,
            predictions,
        )

        print(
            f"  MAE : {mae:.4f}"
        )

        print(
            f"  RMSE: {rmse:.4f}"
        )

        print(
            f"  R²  : {r2:.4f}"
        )

        results.append(
            {
                "model": model_name,
                "MAE": float(mae),
                "RMSE": float(rmse),
                "R2": float(r2),
            }
        )

        trained_models[model_name] = pipeline

    results_df = pd.DataFrame(results)

    results_df = results_df.sort_values(
        by=[
            "MAE",
            "RMSE",
            "R2",
        ],
        ascending=[
            True,
            True,
            False,
        ],
    ).reset_index(drop=True)

    results_df.insert(
        0,
        "rank",
        range(
            1,
            len(results_df) + 1,
        ),
    )

    print("\n" + "-" * 70)
    print("REGRESSION MODEL COMPARISON")
    print("-" * 70)

    print(
        results_df.to_string(
            index=False
        )
    )

    selected_model_name = (
        results_df.iloc[0]["model"]
    )

    selected_pipeline = trained_models[
        selected_model_name
    ]

    print(
        f"\nSelected regression model: "
        f"{selected_model_name}"
    )

    print(
        f"Selection metric: MAE = "
        f"{results_df.iloc[0]['MAE']:.4f}"
    )

    return (
        results_df,
        selected_model_name,
        selected_pipeline,
    )


# ============================================================
# CLASSIFICATION MODEL SELECTION
# ============================================================

def train_classification_models(
    X_train,
    y_train,
    X_validation,
    y_validation,
):
    """
    Train and evaluate classification models.

    Selection metric:
        F1

    Tie breakers:
        PR-AUC
        ROC-AUC
    """

    print("\n" + "=" * 70)
    print("CLASSIFICATION MODEL TRAINING")
    print("=" * 70)

    results = []
    trained_models = {}

    for model_name, model in CLASSIFICATION_MODELS.items():

        print(
            f"\nTraining: {model_name}"
        )

        pipeline = build_pipeline(model)

        pipeline.fit(
            X_train,
            y_train,
        )

        predictions = pipeline.predict(
            X_validation
        )

        probabilities = pipeline.predict_proba(
            X_validation
        )[:, 1]

        accuracy = accuracy_score(
            y_validation,
            predictions,
        )

        precision = precision_score(
            y_validation,
            predictions,
            zero_division=0,
        )

        recall = recall_score(
            y_validation,
            predictions,
            zero_division=0,
        )

        f1 = f1_score(
            y_validation,
            predictions,
            zero_division=0,
        )

        roc_auc = roc_auc_score(
            y_validation,
            probabilities,
        )

        pr_auc = average_precision_score(
            y_validation,
            probabilities,
        )

        print(
            f"  Accuracy : {accuracy:.4f}"
        )

        print(
            f"  Precision: {precision:.4f}"
        )

        print(
            f"  Recall   : {recall:.4f}"
        )

        print(
            f"  F1       : {f1:.4f}"
        )

        print(
            f"  ROC-AUC  : {roc_auc:.4f}"
        )

        print(
            f"  PR-AUC   : {pr_auc:.4f}"
        )

        results.append(
            {
                "model": model_name,
                "Accuracy": float(accuracy),
                "Precision": float(precision),
                "Recall": float(recall),
                "F1": float(f1),
                "ROC-AUC": float(roc_auc),
                "PR-AUC": float(pr_auc),
            }
        )

        trained_models[model_name] = pipeline

    results_df = pd.DataFrame(results)

    results_df = results_df.sort_values(
        by=[
            "F1",
            "PR-AUC",
            "ROC-AUC",
        ],
        ascending=[
            False,
            False,
            False,
        ],
    ).reset_index(drop=True)

    results_df.insert(
        0,
        "rank",
        range(
            1,
            len(results_df) + 1,
        ),
    )

    print("\n" + "-" * 70)
    print("CLASSIFICATION MODEL COMPARISON")
    print("-" * 70)

    print(
        results_df.to_string(
            index=False
        )
    )

    selected_model_name = (
        results_df.iloc[0]["model"]
    )

    selected_pipeline = trained_models[
        selected_model_name
    ]

    print(
        f"\nSelected classification model: "
        f"{selected_model_name}"
    )

    print(
        f"Selection metric: F1 = "
        f"{results_df.iloc[0]['F1']:.4f}"
    )

    return (
        results_df,
        selected_model_name,
        selected_pipeline,
    )


# ============================================================
# FINAL REGRESSION TRAINING
# ============================================================

def train_final_regression_model(
    selected_model_name,
    X_train,
    y_train,
    X_validation,
    y_validation,
    X_test,
    y_test,
):
    """
    Retrain selected regression model on
    train + validation and evaluate once on test.
    """

    print("\n" + "=" * 70)
    print("FINAL REGRESSION MODEL")
    print("=" * 70)

    X_train_final = pd.concat(
        [
            X_train,
            X_validation,
        ],
        axis=0,
    )

    y_train_final = pd.concat(
        [
            y_train,
            y_validation,
        ],
        axis=0,
    )

    print(
        f"Final training rows: "
        f"{len(X_train_final):,}"
    )

    model = REGRESSION_MODELS[
        selected_model_name
    ]

    final_pipeline = build_pipeline(
        model
    )

    final_pipeline.fit(
        X_train_final,
        y_train_final,
    )

    test_predictions = (
        final_pipeline.predict(
            X_test
        )
    )

    mae = mean_absolute_error(
        y_test,
        test_predictions,
    )

    rmse = calculate_rmse(
        y_test,
        test_predictions,
    )

    r2 = r2_score(
        y_test,
        test_predictions,
    )

    print("\nFINAL TEST RESULTS")
    print("-" * 70)

    print(
        f"Model: {selected_model_name}"
    )

    print(
        f"MAE : {mae:.4f}"
    )

    print(
        f"RMSE: {rmse:.4f}"
    )

    print(
        f"R²  : {r2:.4f}"
    )

    return (
        final_pipeline,
        {
            "model": selected_model_name,
            "MAE": float(mae),
            "RMSE": float(rmse),
            "R2": float(r2),
        },
    )


# ============================================================
# FINAL CLASSIFICATION TRAINING
# ============================================================

def train_final_classification_model(
    selected_model_name,
    X_train,
    y_train,
    X_validation,
    y_validation,
    X_test,
    y_test,
):
    """
    Retrain selected classification model on
    train + validation and evaluate once on test.
    """

    print("\n" + "=" * 70)
    print("FINAL CLASSIFICATION MODEL")
    print("=" * 70)

    X_train_final = pd.concat(
        [
            X_train,
            X_validation,
        ],
        axis=0,
    )

    y_train_final = pd.concat(
        [
            y_train,
            y_validation,
        ],
        axis=0,
    )

    print(
        f"Final training rows: "
        f"{len(X_train_final):,}"
    )

    model = CLASSIFICATION_MODELS[
        selected_model_name
    ]

    final_pipeline = build_pipeline(
        model
    )

    final_pipeline.fit(
        X_train_final,
        y_train_final,
    )

    test_predictions = (
        final_pipeline.predict(
            X_test
        )
    )

    test_probabilities = (
        final_pipeline.predict_proba(
            X_test
        )[:, 1]
    )

    accuracy = accuracy_score(
        y_test,
        test_predictions,
    )

    precision = precision_score(
        y_test,
        test_predictions,
        zero_division=0,
    )

    recall = recall_score(
        y_test,
        test_predictions,
        zero_division=0,
    )

    f1 = f1_score(
        y_test,
        test_predictions,
        zero_division=0,
    )

    roc_auc = roc_auc_score(
        y_test,
        test_probabilities,
    )

    pr_auc = average_precision_score(
        y_test,
        test_probabilities,
    )

    print("\nFINAL TEST RESULTS")
    print("-" * 70)

    print(
        f"Model    : {selected_model_name}"
    )

    print(
        f"Accuracy : {accuracy:.4f}"
    )

    print(
        f"Precision: {precision:.4f}"
    )

    print(
        f"Recall   : {recall:.4f}"
    )

    print(
        f"F1       : {f1:.4f}"
    )

    print(
        f"ROC-AUC  : {roc_auc:.4f}"
    )

    print(
        f"PR-AUC   : {pr_auc:.4f}"
    )

    return (
        final_pipeline,
        {
            "model": selected_model_name,
            "Accuracy": float(accuracy),
            "Precision": float(precision),
            "Recall": float(recall),
            "F1": float(f1),
            "ROC-AUC": float(roc_auc),
            "PR-AUC": float(pr_auc),
        },
    )


# ============================================================
# METADATA
# ============================================================

def save_metadata(
    regression_model_name,
    regression_metrics,
    classification_model_name,
    classification_metrics,
):
    """Save model metadata."""

    metadata = {
        "module": "M6 Property Profitability Prediction",
        "module_id": "M6",
        "version": "1.0",

        "dataset": {
            "file": "M6_Profitability_v2.csv",
            "version": "v2",
            "rows": 290000,
            "properties": 10000,
            "date_range": (
                "2024-01-01 to 2026-05-01"
            ),
        },

        "targets": {
            "regression": REGRESSION_TARGET,
            "classification": CLASSIFICATION_TARGET,
        },

        "features": FEATURES,

        "excluded_columns": EXCLUDED_COLUMNS,

        "categorical_features": CATEGORICAL_FEATURES,

        "numerical_features": NUMERICAL_FEATURES,

        "preprocessing": {
            "numerical": [
                "SimpleImputer(strategy=median)",
                "StandardScaler",
            ],
            "categorical": [
                "SimpleImputer(strategy=most_frequent)",
                "OneHotEncoder(handle_unknown=ignore)",
            ],
            "fit_strategy": (
                "Training data only during model selection; "
                "train + validation for final model."
            ),
        },

        "split": {
            "train_rows": 180000,
            "validation_rows": 30000,
            "test_rows": 80000,
            "strategy": "chronological",
            "train_period": (
                "2024-01-01 to 2025-06-01"
            ),
            "validation_period": (
                "2025-07-01 to 2025-09-01"
            ),
            "test_period": (
                "2025-10-01 to 2026-05-01"
            ),
        },

        "regression": {
            "candidate_models": list(
                REGRESSION_MODELS.keys()
            ),
            "selection_metric": "MAE",
            "selected_model": regression_model_name,
            "test_metrics": regression_metrics,
        },

        "classification": {
            "candidate_models": list(
                CLASSIFICATION_MODELS.keys()
            ),
            "selection_metric": "F1",
            "tie_breakers": [
                "PR-AUC",
                "ROC-AUC",
            ],
            "selected_model": classification_model_name,
            "test_metrics": classification_metrics,
        },

        "training": {
            "lag_features_used": False,
            "test_used_for_model_selection": False,
            "complete_pipeline_saved": True,
        },
    }

    metadata_path = (
        ARTIFACT_DIR
        / "model_metadata.json"
    )

    with open(
        metadata_path,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            metadata,
            file,
            indent=4,
        )

    print(
        f"\nMetadata saved: "
        f"{metadata_path}"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print("\n")
    print("=" * 70)
    print("M6 PROPERTY PROFITABILITY PREDICTION")
    print("MODEL TRAINING")
    print("=" * 70)

    # --------------------------------------------------------
    # Load raw dataset
    # --------------------------------------------------------

    print("\nLoading RAW dataset...")

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found:\n{DATA_PATH}"
        )

    df = pd.read_csv(
        DATA_PATH
    )

    print(
        f"Loaded dataset: "
        f"{df.shape}"
    )

    # --------------------------------------------------------
    # Validate
    # --------------------------------------------------------

    validate_dataset(
        df
    )

    # --------------------------------------------------------
    # Create chronological splits
    # --------------------------------------------------------

    train_df = (
        df[
            df["data_split"] == "train"
        ]
        .sort_values(
            "snapshot_month"
        )
        .copy()
    )

    validation_df = (
        df[
            df["data_split"] == "validation"
        ]
        .sort_values(
            "snapshot_month"
        )
        .copy()
    )

    test_df = (
        df[
            df["data_split"] == "test"
        ]
        .sort_values(
            "snapshot_month"
        )
        .copy()
    )

    # --------------------------------------------------------
    # Feature / target separation
    # --------------------------------------------------------

    X_train = train_df[
        FEATURES
    ].copy()

    X_validation = validation_df[
        FEATURES
    ].copy()

    X_test = test_df[
        FEATURES
    ].copy()

    y_train_reg = train_df[
        REGRESSION_TARGET
    ].copy()

    y_validation_reg = validation_df[
        REGRESSION_TARGET
    ].copy()

    y_test_reg = test_df[
        REGRESSION_TARGET
    ].copy()

    y_train_cls = train_df[
        CLASSIFICATION_TARGET
    ].copy()

    y_validation_cls = validation_df[
        CLASSIFICATION_TARGET
    ].copy()

    y_test_cls = test_df[
        CLASSIFICATION_TARGET
    ].copy()

    print("\nRAW FEATURE SHAPES")
    print(
        f"Train      : {X_train.shape}"
    )
    print(
        f"Validation : {X_validation.shape}"
    )
    print(
        f"Test       : {X_test.shape}"
    )

    print(
        f"\nNumber of selected features: "
        f"{len(FEATURES)}"
    )

    print(
        f"Numerical features: "
        f"{len(NUMERICAL_FEATURES)}"
    )

    print(
        f"Categorical features: "
        f"{len(CATEGORICAL_FEATURES)}"
    )

    # --------------------------------------------------------
    # Regression model selection
    # --------------------------------------------------------

    (
        regression_comparison,
        selected_regression_name,
        _,
    ) = train_regression_models(
        X_train,
        y_train_reg,
        X_validation,
        y_validation_reg,
    )

    regression_report_path = (
        REPORT_DIR
        / "regression_model_comparison.csv"
    )

    regression_comparison.to_csv(
        regression_report_path,
        index=False,
    )

    print(
        f"\nRegression comparison saved: "
        f"{regression_report_path}"
    )

    # --------------------------------------------------------
    # Classification model selection
    # --------------------------------------------------------

    (
        classification_comparison,
        selected_classification_name,
        _,
    ) = train_classification_models(
        X_train,
        y_train_cls,
        X_validation,
        y_validation_cls,
    )

    classification_report_path = (
        REPORT_DIR
        / "classification_model_comparison.csv"
    )

    classification_comparison.to_csv(
        classification_report_path,
        index=False,
    )

    print(
        f"\nClassification comparison saved: "
        f"{classification_report_path}"
    )

    # --------------------------------------------------------
    # Final regression model
    # --------------------------------------------------------

    (
        final_regression_pipeline,
        regression_test_metrics,
    ) = train_final_regression_model(
        selected_regression_name,
        X_train,
        y_train_reg,
        X_validation,
        y_validation_reg,
        X_test,
        y_test_reg,
    )

    # --------------------------------------------------------
    # Final classification model
    # --------------------------------------------------------

    (
        final_classification_pipeline,
        classification_test_metrics,
    ) = train_final_classification_model(
        selected_classification_name,
        X_train,
        y_train_cls,
        X_validation,
        y_validation_cls,
        X_test,
        y_test_cls,
    )

    # --------------------------------------------------------
    # Save complete pipelines
    # --------------------------------------------------------

    regression_pipeline_path = (
        ARTIFACT_DIR
        / "regression_model_pipeline.joblib"
    )

    classification_pipeline_path = (
        ARTIFACT_DIR
        / "classification_model_pipeline.joblib"
    )

    joblib.dump(
        final_regression_pipeline,
        regression_pipeline_path,
    )

    joblib.dump(
        final_classification_pipeline,
        classification_pipeline_path,
    )

    print(
        f"\nRegression pipeline saved: "
        f"{regression_pipeline_path}"
    )

    print(
        f"Classification pipeline saved: "
        f"{classification_pipeline_path}"
    )

    # --------------------------------------------------------
    # Save feature list
    # --------------------------------------------------------

    feature_list_path = (
        ARTIFACT_DIR
        / "feature_list.joblib"
    )

    joblib.dump(
        FEATURES,
        feature_list_path,
    )

    print(
        f"Feature list saved: "
        f"{feature_list_path}"
    )

    # --------------------------------------------------------
    # Save metadata
    # --------------------------------------------------------

    save_metadata(
        selected_regression_name,
        regression_test_metrics,
        selected_classification_name,
        classification_test_metrics,
    )

    # --------------------------------------------------------
    # Final summary
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("M6 MODEL TRAINING COMPLETE")
    print("=" * 70)

    print(
        f"\nRegression model: "
        f"{selected_regression_name}"
    )

    print(
        f"Regression MAE: "
        f"{regression_test_metrics['MAE']:.4f}"
    )

    print(
        f"Regression RMSE: "
        f"{regression_test_metrics['RMSE']:.4f}"
    )

    print(
        f"Regression R²: "
        f"{regression_test_metrics['R2']:.4f}"
    )

    print(
        f"\nClassification model: "
        f"{selected_classification_name}"
    )

    print(
        f"Classification F1: "
        f"{classification_test_metrics['F1']:.4f}"
    )

    print(
        f"Classification PR-AUC: "
        f"{classification_test_metrics['PR-AUC']:.4f}"
    )

    print(
        f"Classification ROC-AUC: "
        f"{classification_test_metrics['ROC-AUC']:.4f}"
    )

    print("\nArtifacts:")
    print(
        f"  {regression_pipeline_path}"
    )
    print(
        f"  {classification_pipeline_path}"
    )
    print(
        f"  {feature_list_path}"
    )

    print("\nM6 MODEL TRAINING: PASS")


if __name__ == "__main__":
    main()