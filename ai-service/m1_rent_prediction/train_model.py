
"""Compare regression models using the current SmartEstate M1 pipeline."""

import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from xgboost import XGBRegressor

from m1_rent_prediction.preprocessing import load_data, split_features_target
from m1_rent_prediction.m1_onehot_pipeline import (
    CATEGORICAL_COLUMNS,
    NUMERIC_COLUMNS,
    M1CategoryNormalizer,
)


def build_model(estimator):
    """Build a pipeline using one-hot encoding and log-transformed rent."""

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore"),
                CATEGORICAL_COLUMNS,
            ),
            ("numeric", "passthrough", NUMERIC_COLUMNS),
        ],
        remainder="drop",
    )

    return Pipeline(
        steps=[
            ("category_normalizer", M1CategoryNormalizer()),
            ("preprocessor", preprocessor),
            (
                "model",
                TransformedTargetRegressor(
                    regressor=estimator,
                    func=np.log1p,
                    inverse_func=np.expm1,
                ),
            ),
        ]
    )


def evaluate_model(model, name, X_test, y_test):
    predictions = model.predict(X_test)

    return {
        "Model": name,
        "MAE (₹)": mean_absolute_error(y_test, predictions),
        "RMSE (₹)": np.sqrt(mean_squared_error(y_test, predictions)),
        "R2": r2_score(y_test, predictions),
    }


def main():
    print("\nLoading leakage-safe M1 training dataset...")

    df = load_data()
    X, y = split_features_target(df)

    # Keep the exact feature order used by the M1 pipeline.
    X = X[CATEGORICAL_COLUMNS + NUMERIC_COLUMNS]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
    )

    print(f"Total rows: {len(df):,}")
    print(f"Training rows: {len(X_train):,}")
    print(f"Internal test rows: {len(X_test):,}")
    print(f"Feature count: {X.shape[1]}")
    print("\nThis is an internal comparison,")
    print("not the final 2026 validation.")

    models = {
        "Linear Regression": LinearRegression(),

        "Random Forest": RandomForestRegressor(
            n_estimators=300,
            random_state=42,
            n_jobs=-1,
        ),

        "XGBoost": XGBRegressor(
            objective="reg:squarederror",
            n_estimators=600,
            learning_rate=0.05,
            max_depth=5,
            min_child_weight=3,
            subsample=0.85,
            colsample_bytree=0.85,
            reg_lambda=5.0,
            reg_alpha=0.0,
            random_state=42,
            n_jobs=4,
            tree_method="hist",
        ),

        "Extra Trees": ExtraTreesRegressor(
            n_estimators=300,
            random_state=42,
            n_jobs=-1,
        ),
    }

    results = []

    for name, estimator in models.items():
        print(f"\nTraining: {name}")

        pipeline = build_model(estimator)
        pipeline.fit(X_train, y_train)

        results.append(
            evaluate_model(pipeline, name, X_test, y_test)
        )

    results_df = pd.DataFrame(results).sort_values(by="MAE (₹)")

    print("\n========== M1 MODEL COMPARISON ==========")
    print(
        results_df.to_string(
            index=False,
            formatters={
                "MAE (₹)": lambda value: f"{value:,.2f}",
                "RMSE (₹)": lambda value: f"{value:,.2f}",
                "R2": lambda value: f"{value:.4f}",
            },
        )
    )

    print("\nNo model was saved or replaced.")


if __name__ == "__main__":
    main()
