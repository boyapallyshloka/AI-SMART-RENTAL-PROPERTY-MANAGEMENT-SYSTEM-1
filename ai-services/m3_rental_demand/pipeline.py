
import os
import sys

import numpy as np
import pandas as pd

from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import f1_score


CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

PARENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)


# Register module under both package and bare names for joblib serialization.
if __name__ in sys.modules:
    current_mod = sys.modules[__name__]

    if "pipeline" not in sys.modules:
        sys.modules["pipeline"] = current_mod

    if "m3_rental_demand.pipeline" not in sys.modules:
        sys.modules["m3_rental_demand.pipeline"] = current_mod


NUMERIC_FEATURES = [
    "property_count",
    "application_count",
    "agreement_start_count",
    "average_monthly_rent",
    "demand_lag_1_month",
    "demand_lag_2_month",
    "demand_growth_1_month",
    "occupancy_rate",
    "vacancy_rate",
    "available_unit_count",
    "month",
]

CATEGORICAL_FEATURES = [
    "city",
    "area_locality",
]

MODEL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

TARGET = "next_month_demand"


class RentalDemandPipeline(BaseEstimator, RegressorMixin):
    """
    M3 Rental Demand Prediction pipeline.

    Uses:
    1. OneHotEncoder for city and area_locality.
    2. GradientBoostingClassifier to classify zero/non-zero demand.
    3. GradientBoostingRegressor to estimate positive demand magnitude.

    Diagnostic logging is enabled in predict() to investigate zero predictions.
    """

    def __init__(
        self,
        n_estimators: int = 200,
        random_state: int = 42,
        threshold: float = 0.5,
    ):
        self.n_estimators = n_estimators
        self.random_state = random_state
        self.threshold = threshold
        self.model_version = "1.0"

        self.preprocessor_ = None
        self.threshold_ = threshold
        self.classifier_ = None
        self.regressor_ = None
        self.features_ = MODEL_FEATURES

    def _prepare_inputs(self, df: pd.DataFrame) -> pd.DataFrame:
        """Derive calendar month from year_month when month is missing."""
        data = df.copy()

        if "month" not in data.columns and "year_month" in data.columns:
            data["month"] = (
                data["year_month"]
                .astype(str)
                .str.split("-")
                .str[1]
                .astype(int)
            )

        return data

    def fit(
        self,
        df: pd.DataFrame,
        target_col: str = TARGET,
        val_df: pd.DataFrame = None,
    ):
        """Fit preprocessing, classifier, and regression models."""

        train_data = self._prepare_inputs(df)
        X_train = train_data[self.features_]
        y_train = train_data[target_col]
        y_train_bin = (y_train > 0).astype(int)

        # One-hot encode categorical features; pass numeric features through.
        self.preprocessor_ = ColumnTransformer(
            transformers=[
                ("num", "passthrough", NUMERIC_FEATURES),
                (
                    "cat",
                    OneHotEncoder(
                        handle_unknown="ignore",
                        sparse_output=True,
                    ),
                    CATEGORICAL_FEATURES,
                ),
            ]
        )

        X_train_encoded = self.preprocessor_.fit_transform(X_train)

        # Stage 1: classify zero versus positive demand.
        sample_weights = compute_sample_weight(
            class_weight="balanced",
            y=y_train_bin,
        )

        self.classifier_ = GradientBoostingClassifier(
            n_estimators=self.n_estimators,
            random_state=self.random_state,
        )

        self.classifier_.fit(
            X_train_encoded,
            y_train_bin,
            sample_weight=sample_weights,
        )

        # Tune the classification threshold using validation data, if supplied.
        if val_df is not None:
            val_data = self._prepare_inputs(val_df)
            X_val = val_data[self.features_]
            y_val_bin = (val_data[target_col] > 0).astype(int)

            X_val_encoded = self.preprocessor_.transform(X_val)
            probs = self.classifier_.predict_proba(X_val_encoded)[:, 1]

            best_threshold = self.threshold
            best_f1 = 0.0

            for threshold in np.arange(0.05, 0.96, 0.05):
                preds = (probs >= threshold).astype(int)
                score = f1_score(
                    y_val_bin,
                    preds,
                    zero_division=0,
                )

                if score > best_f1:
                    best_f1 = score
                    best_threshold = threshold

            self.threshold_ = float(best_threshold)
        else:
            self.threshold_ = float(self.threshold)

        # Stage 2: train the regressor on positive-demand rows.
        nonzero_mask = (y_train > 0).values

        self.regressor_ = GradientBoostingRegressor(
            n_estimators=self.n_estimators,
            random_state=self.random_state,
        )

        if nonzero_mask.sum() > 0:
            self.regressor_.fit(
                X_train_encoded[nonzero_mask],
                y_train[nonzero_mask],
            )
        else:
            self.regressor_.fit(X_train_encoded, y_train)

        return self

    def predict(self, raw_input) -> np.ndarray:
        """Predict demand and print diagnostic information."""

        if isinstance(raw_input, dict):
            raw_df = pd.DataFrame([raw_input])
        elif isinstance(raw_input, list):
            raw_df = pd.DataFrame(raw_input)
        elif isinstance(raw_input, pd.DataFrame):
            raw_df = raw_input.copy()
        else:
            raise ValueError(
                f"Unsupported input type for predict: {type(raw_input)}"
            )

        data = self._prepare_inputs(raw_df)

        missing_features = [
            feature
            for feature in self.features_
            if feature not in data.columns
        ]

        if missing_features:
            raise ValueError(
                "Missing required features after preprocessing: "
                f"{missing_features}"
            )

        X = data[self.features_]
        X_encoded = self.preprocessor_.transform(X)

        # Stage 1: classifier probability and decision.
        probs = self.classifier_.predict_proba(X_encoded)[:, 1]
        class_preds = (probs >= self.threshold_).astype(int)

        # Stage 2: regression estimate.
        reg_preds = np.maximum(
            0.0,
            self.regressor_.predict(X_encoded),
        )

        

        # Preserve the original hurdle-model formula.
        final_preds = np.maximum(
            0.0,
            class_preds * reg_preds,
        )

       
        return final_preds
