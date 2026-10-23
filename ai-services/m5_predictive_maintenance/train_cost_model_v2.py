"""
M5 Predictive Maintenance - Cost Model V2

Target:
    next_month_maintenance_cost

Approach:
    Two-part / hurdle-style cost prediction

    Stage 1:
        Predict whether maintenance will occur next month.

    Stage 2:
        For positive-cost records only, predict log1p(cost).

    Final:
        Expected cost = maintenance probability
                        * predicted positive maintenance cost

Standards:
    - Chronological train/validation/test split
    - Leakage protection
    - Consistent feature engineering
    - Compare multiple algorithms
    - Validation-based model selection
    - Save preprocessing + model artifacts
"""

from pathlib import Path
import warnings

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer

from sklearn.ensemble import (
    RandomForestRegressor,
    ExtraTreesRegressor,
    GradientBoostingRegressor,
    HistGradientBoostingRegressor,
)

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)

from config import DATA_PATH, ARTIFACTS_DIR

warnings.filterwarnings("ignore")


# ============================================================
# CONFIGURATION
# ============================================================

COST_TARGET = "next_month_maintenance_cost"
COUNT_TARGET = "next_month_maintenance_count"
RISK_TARGET = "maintenance_risk_label"

DATE_COLUMN = "snapshot_month"
ID_COLUMN = "property_id"

LEAKAGE_COLUMNS = [
    COST_TARGET,
    COUNT_TARGET,
    RISK_TARGET,
]

TRAIN_END = pd.Timestamp("2025-06-01")

VALIDATION_START = pd.Timestamp("2025-07-01")
VALIDATION_END = pd.Timestamp("2025-09-01")

TEST_START = pd.Timestamp("2025-10-01")

RANDOM_STATE = 42

ARTIFACTS_DIR = Path(ARTIFACTS_DIR)
ARTIFACTS_DIR.mkdir(
    parents=True,
    exist_ok=True
)

OUTPUT_ARTIFACT = (
    ARTIFACTS_DIR
    / "best_maintenance_cost_model_v2.joblib"
)

OUTPUT_RESULTS = (
    ARTIFACTS_DIR
    / "m5_cost_model_v2_comparison.csv"
)


# ============================================================
# EXACT RISK MODEL FEATURES
# ============================================================
#
# These are the exact 24 features found inside:
#
# best_maintenance_risk_model.joblib
#
# Do NOT change their names or order.
# ============================================================

RISK_FEATURE_COLUMNS = [
    "property_age_years",
    "size_sqft",
    "bedrooms_bhk",
    "amenity_count",
    "historical_maintenance_count",
    "maintenance_count_last_90d",
    "historical_maintenance_cost",
    "historical_avg_cost",
    "days_since_last_maintenance",
    "dominant_issue_category",
    "inspection_count",
    "needs_attention_count",
    "equipment_count",
    "avg_equipment_age_years",
    "critical_equipment_count",
    "snapshot_year",
    "snapshot_month_number",
    "month_sin",
    "month_cos",
    "maintenance_cost_per_event",
    "inspection_attention_ratio",
    "critical_equipment_ratio",
    "recent_maintenance_ratio",
]


# ============================================================
# FEATURE ENGINEERING
# ============================================================

def engineer_features(df):
    """
    Reproduce the exact M5 feature engineering used by the
    existing risk model.
    """

    df = df.copy()

    # --------------------------------------------------------
    # DATE FEATURES
    # --------------------------------------------------------

    df["snapshot_year"] = (
        df[DATE_COLUMN].dt.year
    )

    df["snapshot_month_number"] = (
        df[DATE_COLUMN].dt.month
    )

    df["month_sin"] = np.sin(
        2
        * np.pi
        * df["snapshot_month_number"]
        / 12
    )

    df["month_cos"] = np.cos(
        2
        * np.pi
        * df["snapshot_month_number"]
        / 12
    )

    # --------------------------------------------------------
    # MAINTENANCE COST PER EVENT
    # --------------------------------------------------------

    df["maintenance_cost_per_event"] = np.where(
        df["historical_maintenance_count"] > 0,

        df["historical_maintenance_cost"]
        / df["historical_maintenance_count"],

        0,
    )

    # --------------------------------------------------------
    # INSPECTION ATTENTION RATIO
    # --------------------------------------------------------

    df["inspection_attention_ratio"] = np.where(
        df["inspection_count"] > 0,

        df["needs_attention_count"]
        / df["inspection_count"],

        0,
    )

    # --------------------------------------------------------
    # CRITICAL EQUIPMENT RATIO
    # --------------------------------------------------------

    df["critical_equipment_ratio"] = np.where(
        df["equipment_count"] > 0,

        df["critical_equipment_count"]
        / df["equipment_count"],

        0,
    )

    # --------------------------------------------------------
    # RECENT MAINTENANCE RATIO
    # --------------------------------------------------------

    df["recent_maintenance_ratio"] = np.where(
        df["historical_maintenance_count"] > 0,

        df["maintenance_count_last_90d"]
        / df["historical_maintenance_count"],

        0,
    )

    return df


# ============================================================
# LOAD DATA
# ============================================================

def load_data():

    print("=" * 80)
    print("M5 PREDICTIVE MAINTENANCE - COST MODEL V2")
    print("=" * 80)

    print("\nLoading dataset...")

    df = pd.read_csv(DATA_PATH)

    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN],
        format="%Y-%m"
    )

    print(
        f"Dataset shape: {df.shape}"
    )

    return df


# ============================================================
# PREPARE COST MODEL FEATURES
# ============================================================

def prepare_features(df):

    df = engineer_features(df)

    drop_columns = [
        DATE_COLUMN,
        ID_COLUMN,
        *LEAKAGE_COLUMNS,
    ]

    feature_columns = [
        column
        for column in df.columns
        if column not in drop_columns
    ]

    X = df[
        feature_columns
    ].copy()

    return X, feature_columns


# ============================================================
# PREPROCESSOR
# ============================================================

def create_preprocessor(X):

    numeric_features = (
        X.select_dtypes(
            include=[
                "int64",
                "float64",
                "int32",
                "float32",
            ]
        )
        .columns
        .tolist()
    )

    categorical_features = (
        X.select_dtypes(
            include=[
                "object",
                "category",
            ]
        )
        .columns
        .tolist()
    )

    numeric_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="median"
                )
            ),
            (
                "scaler",
                StandardScaler()
            ),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="most_frequent"
                )
            ),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False
                )
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                numeric_pipeline,
                numeric_features
            ),
            (
                "categorical",
                categorical_pipeline,
                categorical_features
            ),
        ],
        remainder="drop"
    )

    return preprocessor


# ============================================================
# CHRONOLOGICAL SPLIT
# ============================================================

def split_data(df):

    train = df[
        df[DATE_COLUMN] <= TRAIN_END
    ].copy()

    validation = df[
        (df[DATE_COLUMN] >= VALIDATION_START)
        & (df[DATE_COLUMN] <= VALIDATION_END)
    ].copy()

    test = df[
        df[DATE_COLUMN] >= TEST_START
    ].copy()

    print("\n" + "=" * 80)
    print("CHRONOLOGICAL SPLIT")
    print("=" * 80)

    print(
        f"Train      : {len(train)}"
    )

    print(
        f"Validation : {len(validation)}"
    )

    print(
        f"Test       : {len(test)}"
    )

    return (
        train,
        validation,
        test
    )


# ============================================================
# METRICS
# ============================================================

def calculate_metrics(
    y_true,
    y_pred
):

    return {
        "MAE": mean_absolute_error(
            y_true,
            y_pred
        ),

        "RMSE": np.sqrt(
            mean_squared_error(
                y_true,
                y_pred
            )
        ),

        "R2": r2_score(
            y_true,
            y_pred
        ),
    }


# ============================================================
# MAIN
# ============================================================

def main():

    # ========================================================
    # LOAD DATA
    # ========================================================

    df = load_data()

    # ========================================================
    # SPLIT DATA
    # ========================================================

    (
        train_df,
        validation_df,
        test_df
    ) = split_data(df)

    # ========================================================
    # PREPARE COST FEATURES
    # ========================================================

    (
        X_all,
        feature_columns
    ) = prepare_features(df)

    X_train = X_all.loc[
        train_df.index
    ]

    X_validation = X_all.loc[
        validation_df.index
    ]

    X_test = X_all.loc[
        test_df.index
    ]

    y_train = train_df[
        COST_TARGET
    ]

    y_validation = validation_df[
        COST_TARGET
    ]

    y_test = test_df[
        COST_TARGET
    ]

    # ========================================================
    # STAGE 1 - MAINTENANCE OCCURRENCE
    # ========================================================

    print("\n" + "=" * 80)
    print("STAGE 1 - MAINTENANCE OCCURRENCE")
    print("=" * 80)

    y_train_event = (
        train_df[COUNT_TARGET] > 0
    ).astype(int)

    y_validation_event = (
        validation_df[COUNT_TARGET] > 0
    ).astype(int)

    y_test_event = (
        test_df[COUNT_TARGET] > 0
    ).astype(int)

    print(
        f"Train event rate      : "
        f"{y_train_event.mean():.2%}"
    )

    print(
        f"Validation event rate : "
        f"{y_validation_event.mean():.2%}"
    )

    print(
        f"Test event rate       : "
        f"{y_test_event.mean():.2%}"
    )

    # ========================================================
    # LOAD EXISTING RISK MODEL
    # ========================================================

    risk_artifact_path = (
        ARTIFACTS_DIR
        / "best_maintenance_risk_model.joblib"
    )

    if not risk_artifact_path.exists():

        raise FileNotFoundError(
            "\nRisk model artifact not found:\n"
            f"{risk_artifact_path}\n\n"
            "Run the risk model training first."
        )

    print(
        "\nLoading existing risk model..."
    )

    risk_model = joblib.load(
        risk_artifact_path
    )

    # ========================================================
    # RECREATE EXACT RISK MODEL INPUT
    # ========================================================

    print(
        "\nPreparing exact risk model input..."
    )

    risk_engineered_df = (
        engineer_features(df)
    )

    # --------------------------------------------------------
    # VERIFY REQUIRED FEATURES
    # --------------------------------------------------------

    missing_risk_features = [
        column
        for column in RISK_FEATURE_COLUMNS
        if column not in risk_engineered_df.columns
    ]

    if missing_risk_features:

        raise ValueError(
            "\nRisk model features are missing:\n"
            + "\n".join(
                f"  - {column}"
                for column in missing_risk_features
            )
        )

    # --------------------------------------------------------
    # CREATE EXACT INPUT
    # --------------------------------------------------------

    X_risk = risk_engineered_df[
        RISK_FEATURE_COLUMNS
    ].copy()

    print(
        f"Risk model features supplied: "
        f"{len(X_risk.columns)}"
    )

    print(
        "Risk model input verification: PASSED"
    )

    # ========================================================
    # VERIFY AGAINST SAVED PIPELINE
    # ========================================================

    try:

        expected_risk_features = (
            risk_model
            .named_steps[
                "preprocessor"
            ]
            .feature_names_in_
            .tolist()
        )

        if (
            expected_risk_features
            != RISK_FEATURE_COLUMNS
        ):

            raise ValueError(
                "\nRisk feature mismatch!\n\n"
                f"Expected by artifact:\n"
                f"{expected_risk_features}\n\n"
                f"Provided:\n"
                f"{RISK_FEATURE_COLUMNS}"
            )

        print(
            "Saved risk pipeline feature "
            "verification: PASSED"
        )

    except AttributeError:

        print(
            "Warning: Could not inspect "
            "saved pipeline feature_names_in_."
        )

    # ========================================================
    # RISK PROBABILITIES
    # ========================================================

    print(
        "\nGenerating maintenance probabilities..."
    )

    train_probability = (
        risk_model
        .predict_proba(
            X_risk.loc[
                train_df.index
            ]
        )[:, 1]
    )

    validation_probability = (
        risk_model
        .predict_proba(
            X_risk.loc[
                validation_df.index
            ]
        )[:, 1]
    )

    test_probability = (
        risk_model
        .predict_proba(
            X_risk.loc[
                test_df.index
            ]
        )[:, 1]
    )

    print(
        "Maintenance probabilities generated."
    )

    # ========================================================
    # STAGE 2 - POSITIVE COST MODEL
    # ========================================================

    print("\n" + "=" * 80)
    print("STAGE 2 - POSITIVE MAINTENANCE COST")
    print("=" * 80)

    positive_mask = (
        train_df[COST_TARGET] > 0
    )

    X_positive = X_train.loc[
        positive_mask
    ]

    y_positive = y_train.loc[
        positive_mask
    ]

    # --------------------------------------------------------
    # LOG TRANSFORM
    # --------------------------------------------------------

    y_positive_log = np.log1p(
        y_positive
    )

    print(
        f"Positive training records: "
        f"{len(y_positive)}"
    )

    print(
        f"Positive training percentage: "
        f"{len(y_positive) / len(train_df):.2%}"
    )

    # ========================================================
    # CANDIDATE MODELS
    # ========================================================

    models = {

        "RandomForest": RandomForestRegressor(
            n_estimators=300,
            max_depth=12,
            min_samples_leaf=3,
            random_state=RANDOM_STATE,
            n_jobs=-1
        ),

        "ExtraTrees": ExtraTreesRegressor(
            n_estimators=300,
            max_depth=12,
            min_samples_leaf=3,
            random_state=RANDOM_STATE,
            n_jobs=-1
        ),

        "GradientBoosting": GradientBoostingRegressor(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=3,
            loss="huber",
            random_state=RANDOM_STATE
        ),

        "HistGradientBoosting": HistGradientBoostingRegressor(
            max_iter=200,
            learning_rate=0.05,
            max_leaf_nodes=15,
            l2_regularization=1.0,
            random_state=RANDOM_STATE
        ),
    }

    # ========================================================
    # TRAIN AND COMPARE
    # ========================================================

    results = []

    trained_models = {}

    for model_name, model in models.items():

        print("\n" + "-" * 80)
        print(
            f"Training: {model_name}"
        )
        print("-" * 80)

        preprocessor = (
            create_preprocessor(
                X_positive
            )
        )

        pipeline = Pipeline(
            steps=[
                (
                    "preprocessor",
                    preprocessor
                ),
                (
                    "model",
                    model
                ),
            ]
        )

        pipeline.fit(
            X_positive,
            y_positive_log
        )

        # ----------------------------------------------------
        # VALIDATION POSITIVE COST
        # ----------------------------------------------------

        validation_positive_log = (
            pipeline.predict(
                X_validation
            )
        )

        validation_positive_cost = (
            np.maximum(
                np.expm1(
                    validation_positive_log
                ),
                0
            )
        )

        # ----------------------------------------------------
        # EXPECTED COST
        # ----------------------------------------------------

        validation_expected_cost = (
            validation_probability
            * validation_positive_cost
        )

        # ----------------------------------------------------
        # OVERALL METRICS
        # ----------------------------------------------------

        metrics = calculate_metrics(
            y_validation,
            validation_expected_cost
        )

        # ----------------------------------------------------
        # POSITIVE-ONLY METRICS
        # ----------------------------------------------------

        validation_positive_mask = (
            y_validation > 0
        )

        if validation_positive_mask.sum() > 0:

            positive_metrics = (
                calculate_metrics(
                    y_validation[
                        validation_positive_mask
                    ],

                    validation_positive_cost[
                        validation_positive_mask
                    ],
                )
            )

        else:

            positive_metrics = {
                "MAE": np.nan,
                "RMSE": np.nan,
                "R2": np.nan,
            }

        # ----------------------------------------------------
        # STORE RESULTS
        # ----------------------------------------------------

        result = {

            "model": model_name,

            "overall_MAE":
                metrics["MAE"],

            "overall_RMSE":
                metrics["RMSE"],

            "overall_R2":
                metrics["R2"],

            "positive_MAE":
                positive_metrics["MAE"],

            "positive_RMSE":
                positive_metrics["RMSE"],

            "positive_R2":
                positive_metrics["R2"],
        }

        results.append(
            result
        )

        trained_models[
            model_name
        ] = pipeline

        # ----------------------------------------------------
        # DISPLAY
        # ----------------------------------------------------

        print(
            f"Overall MAE  : "
            f"{metrics['MAE']:.4f}"
        )

        print(
            f"Overall RMSE : "
            f"{metrics['RMSE']:.4f}"
        )

        print(
            f"Overall R²   : "
            f"{metrics['R2']:.4f}"
        )

        print(
            f"Positive MAE : "
            f"{positive_metrics['MAE']:.4f}"
        )

        print(
            f"Positive RMSE: "
            f"{positive_metrics['RMSE']:.4f}"
        )

        print(
            f"Positive R²  : "
            f"{positive_metrics['R2']:.4f}"
        )

    # ========================================================
    # COMPARISON TABLE
    # ========================================================

    results_df = pd.DataFrame(
        results
    )

    results_df = (
        results_df
        .sort_values(
            by="overall_MAE",
            ascending=True
        )
        .reset_index(
            drop=True
        )
    )

    print("\n" + "=" * 80)
    print(
        "COST MODEL VALIDATION COMPARISON"
    )
    print("=" * 80)

    print(
        results_df.to_string(
            index=False,
            float_format=lambda x:
                f"{x:.4f}"
        )
    )

    # ========================================================
    # SAVE COMPARISON
    # ========================================================

    results_df.to_csv(
        OUTPUT_RESULTS,
        index=False
    )

    print(
        f"\nComparison saved to:"
        f"\n{OUTPUT_RESULTS}"
    )

    # ========================================================
    # SELECT BEST MODEL
    # ========================================================

    best_model_name = (
        results_df.iloc[0]["model"]
    )

    best_model = trained_models[
        best_model_name
    ]

    print("\n" + "=" * 80)
    print("SELECTED MODEL")
    print("=" * 80)

    print(
        f"Best model: "
        f"{best_model_name}"
    )

    print(
        "Selection metric: "
        "Overall Validation MAE"
    )

    print(
        f"Validation MAE: "
        f"{results_df.iloc[0]['overall_MAE']:.4f}"
    )

    # ========================================================
    # FINAL TEST EVALUATION
    # ========================================================

    print("\n" + "=" * 80)
    print("FINAL TEST EVALUATION")
    print("=" * 80)

    # --------------------------------------------------------
    # POSITIVE COST PREDICTION
    # --------------------------------------------------------

    test_positive_log = (
        best_model.predict(
            X_test
        )
    )

    test_positive_cost = (
        np.maximum(
            np.expm1(
                test_positive_log
            ),
            0
        )
    )

    # --------------------------------------------------------
    # EXPECTED COST
    # --------------------------------------------------------

    test_expected_cost = (
        test_probability
        * test_positive_cost
    )

    # --------------------------------------------------------
    # OVERALL METRICS
    # --------------------------------------------------------

    test_metrics = calculate_metrics(
        y_test,
        test_expected_cost
    )

    # --------------------------------------------------------
    # POSITIVE-ONLY METRICS
    # --------------------------------------------------------

    test_positive_mask = (
        y_test > 0
    )

    test_positive_metrics = (
        calculate_metrics(
            y_test[
                test_positive_mask
            ],

            test_positive_cost[
                test_positive_mask
            ],
        )
    )

    print(
        f"Test MAE       : "
        f"{test_metrics['MAE']:.4f}"
    )

    print(
        f"Test RMSE      : "
        f"{test_metrics['RMSE']:.4f}"
    )

    print(
        f"Test R²        : "
        f"{test_metrics['R2']:.4f}"
    )

    print(
        f"Positive MAE   : "
        f"{test_positive_metrics['MAE']:.4f}"
    )

    print(
        f"Positive RMSE  : "
        f"{test_positive_metrics['RMSE']:.4f}"
    )

    print(
        f"Positive R²    : "
        f"{test_positive_metrics['R2']:.4f}"
    )

    # ========================================================
    # DISTRIBUTION CHECK
    # ========================================================

    print(
        f"\nActual mean cost    : "
        f"₹{y_test.mean():.2f}"
    )

    print(
        f"Predicted mean cost : "
        f"₹{test_expected_cost.mean():.2f}"
    )

    print(
        f"Actual zero-cost    : "
        f"{(y_test == 0).mean():.2%}"
    )

    print(
        f"Predicted near-zero : "
        f"{(test_expected_cost < 1).mean():.2%}"
    )

    # ========================================================
    # SAVE ARTIFACT
    # ========================================================

    artifact = {

        # Positive-cost pipeline
        "model": best_model,

        # Existing risk pipeline
        "risk_model": risk_model,

        # Metadata
        "model_name": best_model_name,

        "target": COST_TARGET,

        "approach": (
            "two_part_log_cost"
        ),

        "feature_columns":
            feature_columns,

        "risk_feature_columns":
            RISK_FEATURE_COLUMNS,

        "leakage_columns":
            LEAKAGE_COLUMNS,

        "train_end":
            str(
                TRAIN_END.date()
            ),

        "validation_period":
            (
                f"{VALIDATION_START.date()} "
                f"to "
                f"{VALIDATION_END.date()}"
            ),

        "test_start":
            str(
                TEST_START.date()
            ),

        "random_state":
            RANDOM_STATE,

        # Validation
        "validation_metrics":
            results_df.iloc[0].to_dict(),

        # Test
        "test_metrics": {

            "MAE":
                test_metrics["MAE"],

            "RMSE":
                test_metrics["RMSE"],

            "R2":
                test_metrics["R2"],

            "positive_MAE":
                test_positive_metrics["MAE"],

            "positive_RMSE":
                test_positive_metrics["RMSE"],

            "positive_R2":
                test_positive_metrics["R2"],
        },

        "training_date":
            str(
                pd.Timestamp.now().date()
            ),
    }

    joblib.dump(
        artifact,
        OUTPUT_ARTIFACT
    )

    # ========================================================
    # FINAL SUMMARY
    # ========================================================

    print("\n" + "=" * 80)
    print("COST MODEL V2 COMPLETE")
    print("=" * 80)

    print(
        f"Selected model : "
        f"{best_model_name}"
    )

    print(
        f"Artifact saved : "
        f"{OUTPUT_ARTIFACT}"
    )

    print(
        f"Comparison saved: "
        f"{OUTPUT_RESULTS}"
    )

    print("\nNext step:")

    print(
        "Review the validation comparison "
        "and final test metrics before "
        "API integration."
    )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()