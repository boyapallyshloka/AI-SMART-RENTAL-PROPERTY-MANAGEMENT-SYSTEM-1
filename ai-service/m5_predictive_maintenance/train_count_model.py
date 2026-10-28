import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    RandomForestRegressor,
    ExtraTreesRegressor,
    GradientBoostingRegressor,
    RandomForestRegressor,
    HistGradientBoostingRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from config import (
    DATA_PATH,
    ARTIFACTS_DIR,
    DATE_COLUMN,
    ID_COLUMNS,
    TRAIN_END,
    VALIDATION_START,
    VALIDATION_END,
    TEST_START,
    RANDOM_STATE,
)


TARGET_COLUMN = "next_month_maintenance_count"

# Future-derived columns that must NEVER become predictors.
LEAKAGE_COLUMNS = [
    "next_month_maintenance_count",
    "next_month_maintenance_cost",
    "maintenance_risk_label",
]


def load_data():
    df = pd.read_csv(DATA_PATH)
    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN],
        format="%Y-%m"
    )
    return df


def engineer_features(df):
    df = df.copy()

    df["snapshot_year"] = df[DATE_COLUMN].dt.year
    df["snapshot_month_number"] = df[DATE_COLUMN].dt.month

    df["month_sin"] = np.sin(
        2 * np.pi * df["snapshot_month_number"] / 12
    )
    df["month_cos"] = np.cos(
        2 * np.pi * df["snapshot_month_number"] / 12
    )

    df["maintenance_cost_per_event"] = np.where(
        df["historical_maintenance_count"] > 0,
        df["historical_maintenance_cost"]
        / df["historical_maintenance_count"],
        0,
    )

    df["inspection_attention_ratio"] = np.where(
        df["inspection_count"] > 0,
        df["needs_attention_count"]
        / df["inspection_count"],
        0,
    )

    df["critical_equipment_ratio"] = np.where(
        df["equipment_count"] > 0,
        df["critical_equipment_count"]
        / df["equipment_count"],
        0,
    )

    df["recent_maintenance_ratio"] = np.where(
        df["historical_maintenance_count"] > 0,
        df["maintenance_count_last_90d"]
        / df["historical_maintenance_count"],
        0,
    )

    return df


def chronological_split(df):
    train_df = df[
        df[DATE_COLUMN] <= pd.Timestamp(TRAIN_END)
    ].copy()

    validation_df = df[
        (df[DATE_COLUMN] >= pd.Timestamp(VALIDATION_START))
        & (df[DATE_COLUMN] <= pd.Timestamp(VALIDATION_END))
    ].copy()

    test_df = df[
        df[DATE_COLUMN] >= pd.Timestamp(TEST_START)
    ].copy()

    print("\nChronological split:")
    print(f"Train      : {len(train_df):,} records")
    print(f"Validation : {len(validation_df):,} records")
    print(f"Test       : {len(test_df):,} records")

    return train_df, validation_df, test_df


def prepare_xy(df):
    y = df[TARGET_COLUMN].copy()

    columns_to_drop = (
        [TARGET_COLUMN, DATE_COLUMN]
        + ID_COLUMNS
        + LEAKAGE_COLUMNS
    )

    X = df.drop(
        columns=columns_to_drop,
        errors="ignore"
    )

    return X, y


def build_preprocessor(X):
    categorical_columns = X.select_dtypes(
        include=["object", "category"]
    ).columns.tolist()

    numerical_columns = X.select_dtypes(
        include=[np.number]
    ).columns.tolist()

    numerical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="median")
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
                SimpleImputer(strategy="most_frequent")
            ),
            (
                "onehot",
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
                "numeric",
                numerical_pipeline,
                numerical_columns,
            ),
            (
                "categorical",
                categorical_pipeline,
                categorical_columns,
            ),
        ]
    )

    return preprocessor


def evaluate_model(model, X, y):
    predictions = model.predict(X)

    predictions = np.maximum(
        predictions,
        0
    )

    mae = mean_absolute_error(
        y,
        predictions
    )

    rmse = np.sqrt(
        mean_squared_error(
            y,
            predictions
        )
    )

    r2 = r2_score(
        y,
        predictions
    )

    return {
        "MAE": mae,
        "RMSE": rmse,
        "R2": r2,
    }


def main():

    print("=" * 80)
    print("M5 PREDICTIVE MAINTENANCE - COUNT MODEL")
    print("=" * 80)

    # ---------------------------------------------------------
    # 1. Load data
    # ---------------------------------------------------------

    df = load_data()

    print(f"\nDataset loaded: {len(df):,} records")
    print(f"Target: {TARGET_COLUMN}")

    # ---------------------------------------------------------
    # 2. Feature engineering
    # ---------------------------------------------------------

    df = engineer_features(df)

    # ---------------------------------------------------------
    # 3. Chronological split
    # ---------------------------------------------------------

    train_df, validation_df, test_df = chronological_split(df)

    # ---------------------------------------------------------
    # 4. Prepare X / y
    # ---------------------------------------------------------

    X_train, y_train = prepare_xy(train_df)
    X_validation, y_validation = prepare_xy(validation_df)
    X_test, y_test = prepare_xy(test_df)

    print("\nFeature shapes:")
    print(f"X_train      : {X_train.shape}")
    print(f"X_validation : {X_validation.shape}")
    print(f"X_test       : {X_test.shape}")

    print("\nTarget statistics:")
    print(f"Train mean : {y_train.mean():.4f}")
    print(f"Valid mean : {y_validation.mean():.4f}")
    print(f"Test mean  : {y_test.mean():.4f}")

    print("\nTarget distribution:")
    print(
        y_train.value_counts()
        .sort_index()
        .to_string()
    )

    # ---------------------------------------------------------
    # 5. Preprocessor
    # ---------------------------------------------------------

    preprocessor = build_preprocessor(X_train)

    # ---------------------------------------------------------
    # 6. Candidate regression models
    # ---------------------------------------------------------

    models = {
        "random_forest": RandomForestRegressor(
            n_estimators=300,
            max_depth=18,
            min_samples_leaf=3,
            n_jobs=-1,
            random_state=RANDOM_STATE,
        ),

        "extra_trees": ExtraTreesRegressor(
            n_estimators=300,
            max_depth=18,
            min_samples_leaf=3,
            n_jobs=-1,
            random_state=RANDOM_STATE,
        ),

        "gradient_boosting": GradientBoostingRegressor(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=3,
            random_state=RANDOM_STATE,
        ),

        "hist_gradient_boosting": HistGradientBoostingRegressor(
            max_iter=300,
            learning_rate=0.05,
            max_leaf_nodes=31,
            random_state=RANDOM_STATE,
        ),
    }

    results = []
    trained_models = {}

    # ---------------------------------------------------------
    # 7. Train and validate
    # ---------------------------------------------------------

    for name, model in models.items():

        print("\n" + "-" * 80)
        print(f"Training: {name}")

        pipeline = Pipeline(
            steps=[
                (
                    "preprocessor",
                    preprocessor,
                ),
                (
                    "model",
                    model,
                ),
            ]
        )

        pipeline.fit(
            X_train,
            y_train
        )

        metrics = evaluate_model(
            pipeline,
            X_validation,
            y_validation,
        )

        print(
            f"MAE  : {metrics['MAE']:.4f}"
        )
        print(
            f"RMSE : {metrics['RMSE']:.4f}"
        )
        print(
            f"R²   : {metrics['R2']:.4f}"
        )

        results.append(
            {
                "model": name,
                **metrics,
            }
        )

        trained_models[name] = pipeline

    # ---------------------------------------------------------
    # 8. Compare validation models
    # ---------------------------------------------------------

    comparison = pd.DataFrame(results)

    comparison = comparison.sort_values(
        by="MAE",
        ascending=True
    )

    print("\n" + "=" * 80)
    print("VALIDATION MODEL COMPARISON")
    print("=" * 80)

    print(
        comparison.to_string(
            index=False
        )
    )

    # ---------------------------------------------------------
    # 9. Select best model
    # ---------------------------------------------------------

    best_name = comparison.iloc[0]["model"]

    best_model = trained_models[
        best_name
    ]

    print("\n" + "=" * 80)
    print("BEST COUNT MODEL")
    print("=" * 80)

    print(f"Model: {best_name}")

    # ---------------------------------------------------------
    # 10. Save comparison
    # ---------------------------------------------------------

    comparison_path = (
        ARTIFACTS_DIR.parent
        / "reports"
        / "count_model_comparison_validation.csv"
    )

    comparison_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    comparison.to_csv(
        comparison_path,
        index=False
    )

    # ---------------------------------------------------------
    # 11. Save best model
    # ---------------------------------------------------------

    model_path = (
        ARTIFACTS_DIR
        / "best_maintenance_count_model.joblib"
    )

    joblib.dump(
        best_model,
        model_path
    )

    print(
        f"\nBest model saved to:"
        f"\n{model_path}"
    )

    print(
        f"\nValidation comparison saved to:"
        f"\n{comparison_path}"
    )

    print("\nCount model training completed successfully.")


if __name__ == "__main__":
    main()