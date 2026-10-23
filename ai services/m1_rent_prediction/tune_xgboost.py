
"""Experiment with XGBoost hyperparameters for SmartEstate M1.

Uses only the leakage-safe training dataset.
Does not save or replace any model.
"""

import numpy as np
from sklearn.model_selection import RandomizedSearchCV, train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

from m1_rent_prediction.preprocessing import load_data, split_features_target
from m1_rent_prediction.train_model import build_model
from m1_rent_prediction.m1_onehot_pipeline import (
    CATEGORICAL_COLUMNS,
    NUMERIC_COLUMNS,
)


def main():
    print("\nLoading M1 training dataset...")

    df = load_data()
    X, y = split_features_target(df)
    X = X[CATEGORICAL_COLUMNS + NUMERIC_COLUMNS]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
    )

    print(f"Training rows: {len(X_train):,}")
    print(f"Internal test rows: {len(X_test):,}")

    estimator = XGBRegressor(
        objective="reg:squarederror",
        random_state=42,
        n_jobs=4,
        tree_method="hist",
    )

    pipeline = build_model(estimator)

    parameters = {
        "model__regressor__n_estimators": [300, 500, 700, 900],
        "model__regressor__learning_rate": [0.02, 0.03, 0.05, 0.07],
        "model__regressor__max_depth": [3, 4, 5, 6],
        "model__regressor__min_child_weight": [1, 3, 5, 7],
        "model__regressor__subsample": [0.75, 0.85, 1.0],
        "model__regressor__colsample_bytree": [0.75, 0.85, 1.0],
        "model__regressor__reg_lambda": [1.0, 3.0, 5.0, 10.0],
        "model__regressor__reg_alpha": [0.0, 0.1, 0.5, 1.0],
    }

    search = RandomizedSearchCV(
        estimator=pipeline,
        param_distributions=parameters,
        n_iter=12,
        scoring="neg_mean_absolute_error",
        cv=3,
        random_state=42,
        n_jobs=1,
        verbose=2,
        error_score="raise",
    )

    print("\nStarting hyperparameter tuning...")
    search.fit(X_train, y_train)

    print("\n========== BEST PARAMETERS ==========")
    for name, value in search.best_params_.items():
        print(f"{name}: {value}")

    print(f"\nBest cross-validation MAE: ₹{-search.best_score_:,.2f}")

    predictions = search.best_estimator_.predict(X_test)

    print("\n========== INTERNAL HOLDOUT RESULTS ==========")
    print(f"MAE:  ₹{mean_absolute_error(y_test, predictions):,.2f}")
    print(
        f"RMSE: ₹{np.sqrt(mean_squared_error(y_test, predictions)):,.2f}"
    )
    print(f"R²:   {r2_score(y_test, predictions):.4f}")

    print("\nExperiment completed.")
    print("No model was saved or replaced.")
    print("These results are not final 2026 validation results.")


if __name__ == "__main__":
    main()
