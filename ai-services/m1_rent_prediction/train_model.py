import numpy as np
import pandas as pd

from sklearn.compose import TransformedTargetRegressor
from sklearn.ensemble import (
    ExtraTreesRegressor,
    GradientBoostingRegressor,
    RandomForestRegressor
)
from sklearn.linear_model import LinearRegression
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from xgboost import XGBRegressor

from preprocessing import (
    load_data,
    split_features_target,
    M1Preprocessor
)


def build_model(model):
    return Pipeline(
        steps=[
            ("preprocessor", M1Preprocessor()),
            (
                "model",
                TransformedTargetRegressor(
                    regressor=model,
                    func=np.log1p,
                    inverse_func=np.expm1
                )
            )
        ]
    )


def evaluate_model(model, model_name, X_test, y_test):

    predictions = model.predict(X_test)

    mae = mean_absolute_error(
        y_test,
        predictions
    )

    rmse = np.sqrt(
        mean_squared_error(
            y_test,
            predictions
        )
    )

    r2 = r2_score(
        y_test,
        predictions
    )

    return {
        "Model": model_name,
        "MAE": mae,
        "RMSE": rmse,
        "R2": r2
    }


def main():

    print("\nLoading M1 dataset...")

    df = load_data()

    X, y = split_features_target(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42
    )

    models = {

        "Linear Regression + Log Target":
            LinearRegression(),

        "Random Forest + Log Target":
            RandomForestRegressor(
                n_estimators=300,
                random_state=42,
                n_jobs=-1
            ),

        "Gradient Boosting + Log Target":
            GradientBoostingRegressor(
                n_estimators=200,
                random_state=42
            ),

        "XGBoost + Log Target":
            XGBRegressor(
                objective="reg:squarederror",
                n_estimators=400,
                learning_rate=0.1,
                max_depth=8,
                subsample=1.0,
                colsample_bytree=0.8,
                random_state=42,
                n_jobs=-1
            ),

        "Extra Trees + Log Target":
            ExtraTreesRegressor(
                n_estimators=300,
                random_state=42,
                n_jobs=-1
            )
    }

    results = []

    for model_name, model in models.items():

        print(
            f"\nTraining: {model_name}"
        )

        pipeline = build_model(model)

        pipeline.fit(
            X_train,
            y_train
        )

        result = evaluate_model(
            pipeline,
            model_name,
            X_test,
            y_test
        )

        results.append(result)

    results_df = pd.DataFrame(
        results
    ).sort_values(
        by="MAE"
    )

    print(
        "\n========== M1 MODEL COMPARISON =========="
    )

    print(
        results_df.to_string(
            index=False
        )
    )


if __name__ == "__main__":
    main()