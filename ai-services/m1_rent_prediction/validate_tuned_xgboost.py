import numpy as np

from sklearn.compose import TransformedTargetRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)
from sklearn.model_selection import KFold
from sklearn.pipeline import Pipeline
from xgboost import XGBRegressor

from preprocessing import (
    load_data,
    split_features_target,
    M1Preprocessor
)


def build_model():

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

    pipeline = Pipeline(
        steps=[
            (
                "preprocessor",
                M1Preprocessor()
            ),
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

    return pipeline


if __name__ == "__main__":

    print("\nLoading M1 dataset...")

    df = load_data()

    X, y = split_features_target(df)

    kfold = KFold(
        n_splits=5,
        shuffle=True,
        random_state=42
    )

    mae_scores = []
    rmse_scores = []
    r2_scores = []

    print("\n===== 5-FOLD TUNED XGBOOST VALIDATION =====")

    for fold, (train_index, validation_index) in enumerate(
        kfold.split(X),
        start=1
    ):

        print(f"\nTraining Fold {fold}...")

        X_train = X.iloc[train_index]
        X_validation = X.iloc[validation_index]

        y_train = y.iloc[train_index]
        y_validation = y.iloc[validation_index]

        model = build_model()

        model.fit(
            X_train,
            y_train
        )

        predictions = model.predict(
            X_validation
        )

        mae = mean_absolute_error(
            y_validation,
            predictions
        )

        rmse = np.sqrt(
            mean_squared_error(
                y_validation,
                predictions
            )
        )

        r2 = r2_score(
            y_validation,
            predictions
        )

        mae_scores.append(mae)
        rmse_scores.append(rmse)
        r2_scores.append(r2)

        print(
            f"Fold {fold} → "
            f"MAE: ₹{mae:,.2f} | "
            f"RMSE: ₹{rmse:,.2f} | "
            f"R²: {r2:.4f}"
        )

    print("\n===== FINAL 5-FOLD RESULTS =====")

    print(
        f"Mean MAE : ₹{np.mean(mae_scores):,.2f}"
    )

    print(
        f"Std MAE  : ₹{np.std(mae_scores):,.2f}"
    )

    print(
        f"Mean RMSE: ₹{np.mean(rmse_scores):,.2f}"
    )

    print(
        f"Std RMSE : ₹{np.std(rmse_scores):,.2f}"
    )

    print(
        f"Mean R²  : {np.mean(r2_scores):.4f}"
    )

    print(
        f"Std R²   : {np.std(r2_scores):.4f}"
    )