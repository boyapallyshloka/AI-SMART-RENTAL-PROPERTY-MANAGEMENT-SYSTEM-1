import numpy as np

from sklearn.compose import TransformedTargetRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.pipeline import Pipeline
from xgboost import XGBRegressor

from preprocessing import (
    load_data,
    split_features_target,
    M1Preprocessor
)


if __name__ == "__main__":

    print("\nLoading M1 dataset...")

    df = load_data()

    X, y = split_features_target(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42
    )

    print("Training rows:", len(X_train))
    print("Testing rows :", len(X_test))

    xgb_model = XGBRegressor(
        objective="reg:squarederror",
        random_state=42,
        n_jobs=-1
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", M1Preprocessor()),
            (
                "model",
                TransformedTargetRegressor(
                    regressor=xgb_model,
                    func=np.log1p,
                    inverse_func=np.expm1
                )
            )
        ]
    )

    param_grid = {
        "model__regressor__n_estimators": [200, 400],
        "model__regressor__learning_rate": [0.03, 0.05, 0.1],
        "model__regressor__max_depth": [4, 6, 8],
        "model__regressor__subsample": [0.8, 1.0],
        "model__regressor__colsample_bytree": [0.8, 1.0]
    }

    print("\nStarting XGBoost GridSearchCV...")
    print("This may take some time.")

    grid_search = GridSearchCV(
        estimator=pipeline,
        param_grid=param_grid,
        scoring="neg_mean_absolute_error",
        cv=5,
        n_jobs=-1,
        verbose=1
    )

    grid_search.fit(
        X_train,
        y_train
    )

    print("\n===== BEST XGBOOST PARAMETERS =====")

    print(
        grid_search.best_params_
    )

    print("\nBest CV MAE:")
    print(
        -grid_search.best_score_
    )

    best_model = grid_search.best_estimator_

    predictions = best_model.predict(
        X_test
    )

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

    print("\n===== TUNED XGBOOST TEST RESULTS =====")

    print("MAE :", mae)
    print("RMSE:", rmse)
    print("R2  :", r2)

    print("\n===== SAMPLE PREDICTIONS =====")

    for actual, predicted in zip(
        y_test.head(10),
        predictions[:10]
    ):
        print(
            f"Actual: ₹{actual:,.2f} | "
            f"Predicted: ₹{predicted:,.2f}"
        )