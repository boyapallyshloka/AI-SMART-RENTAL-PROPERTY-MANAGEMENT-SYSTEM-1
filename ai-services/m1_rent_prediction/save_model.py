from pathlib import Path

import joblib
import numpy as np
from xgboost import XGBRegressor
from sklearn.compose import TransformedTargetRegressor
from sklearn.pipeline import Pipeline

from preprocessing import (
    load_data,
    split_features_target,
    M1Preprocessor
)


BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"

MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True
)

MODEL_PATH = MODEL_DIR / "m1_model_pipeline.joblib"


def build_model():

    preprocessor = M1Preprocessor()

    xgb_model = XGBRegressor(
        objective="reg:squarederror",
        random_state=42,
        n_jobs=-1,
        n_estimators=400,
        learning_rate=0.1,
        max_depth=8,
        subsample=1.0,
        colsample_bytree=0.8
    )

    model_pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", TransformedTargetRegressor(
                regressor=xgb_model,
                func=np.log1p,
                inverse_func=np.expm1
            ))
        ]
    )

    return model_pipeline


def train_and_save():

    print("\nLoading M1 dataset...")

    df = load_data()

    X, y = split_features_target(df)

    print("Training rows:", len(X))
    print("Features:", X.shape[1])

    model_pipeline = build_model()

    print("\nTraining final M1 model...")
    print("Model: XGBoost")
    print("Target transformation: log1p")

    model_pipeline.fit(
        X,
        y
    )

    joblib.dump(
        model_pipeline,
        MODEL_PATH
    )

    print("\nM1 model saved successfully.")
    print("Model path:", MODEL_PATH)


if __name__ == "__main__":
    train_and_save()