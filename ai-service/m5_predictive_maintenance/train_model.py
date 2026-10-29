import time
import joblib
import pandas as pd
import numpy as np

from sklearn.pipeline import Pipeline

from sklearn.linear_model import LogisticRegression

from sklearn.tree import DecisionTreeClassifier

from sklearn.ensemble import (
    RandomForestClassifier,
    ExtraTreesClassifier,
    GradientBoostingClassifier,
)

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
)

from sklearn.utils.class_weight import (
    compute_sample_weight
)

from xgboost import XGBClassifier

from config import (
    ARTIFACTS_DIR,
    REPORTS_DIR,
    RANDOM_STATE,
)

from preprocessing import (
    load_data,
    engineer_features,
    chronological_split,
    prepare_xy,
    build_preprocessor,
)


def calculate_metrics(
    y_true,
    y_pred,
    y_probability
):

    return {
        "accuracy": accuracy_score(
            y_true,
            y_pred
        ),

        "precision": precision_score(
            y_true,
            y_pred,
            zero_division=0
        ),

        "recall": recall_score(
            y_true,
            y_pred,
            zero_division=0
        ),

        "f1_score": f1_score(
            y_true,
            y_pred,
            zero_division=0
        ),

        "roc_auc": roc_auc_score(
            y_true,
            y_probability
        ),

        "pr_auc": average_precision_score(
            y_true,
            y_probability
        ),
    }


def main():

    print("=" * 80)
    print("M5 PREDICTIVE MAINTENANCE - MODEL TRAINING")
    print("=" * 80)

    # -----------------------------------------------------
    # LOAD + FEATURE ENGINEERING
    # -----------------------------------------------------

    df = load_data()

    df = engineer_features(df)

    train_df, validation_df, test_df = (
        chronological_split(df)
    )

    # -----------------------------------------------------
    # PREPARE FEATURES
    # -----------------------------------------------------

    X_train, y_train = prepare_xy(train_df)

    X_validation, y_validation = prepare_xy(
        validation_df
    )

    X_test, y_test = prepare_xy(test_df)

    # -----------------------------------------------------
    # CLASS IMBALANCE
    # -----------------------------------------------------

    negative_count = (y_train == 0).sum()
    positive_count = (y_train == 1).sum()

    scale_pos_weight = (
        negative_count / positive_count
    )

    print(
        "\nXGBoost scale_pos_weight:",
        round(scale_pos_weight, 2)
    )

    balanced_sample_weights = (
        compute_sample_weight(
            class_weight="balanced",
            y=y_train
        )
    )

    # -----------------------------------------------------
    # MODELS
    # -----------------------------------------------------

    models = {

        "logistic_regression":
            LogisticRegression(
                max_iter=2000,
                class_weight="balanced",
                random_state=RANDOM_STATE
            ),

        "decision_tree":
            DecisionTreeClassifier(
                max_depth=12,
                min_samples_leaf=10,
                class_weight="balanced",
                random_state=RANDOM_STATE
            ),

        "random_forest":
            RandomForestClassifier(
                n_estimators=300,
                max_depth=18,
                min_samples_leaf=3,
                class_weight="balanced",
                n_jobs=-1,
                random_state=RANDOM_STATE
            ),

        "extra_trees":
            ExtraTreesClassifier(
                n_estimators=300,
                max_depth=18,
                min_samples_leaf=3,
                class_weight="balanced",
                n_jobs=-1,
                random_state=RANDOM_STATE
            ),

        "gradient_boosting":
            GradientBoostingClassifier(
                n_estimators=200,
                learning_rate=0.05,
                max_depth=3,
                random_state=RANDOM_STATE
            ),

        "xgboost":
            XGBClassifier(
                n_estimators=400,
                learning_rate=0.05,
                max_depth=6,
                subsample=0.8,
                colsample_bytree=0.8,
                scale_pos_weight=scale_pos_weight,
                eval_metric="logloss",
                n_jobs=-1,
                random_state=RANDOM_STATE
            )
    }

    results = []

    best_model = None
    best_model_name = None
    best_pr_auc = -1

    # -----------------------------------------------------
    # TRAIN EACH MODEL
    # -----------------------------------------------------

    for model_name, model in models.items():

        print("\n" + "=" * 70)
        print(f"TRAINING: {model_name}")
        print("=" * 70)

        preprocessor = build_preprocessor(
            X_train
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
                )
            ]
        )

        start_time = time.time()

        # Gradient Boosting does not expose
        # class_weight directly.
        if model_name == "gradient_boosting":

            pipeline.fit(
                X_train,
                y_train,
                model__sample_weight=(
                    balanced_sample_weights
                )
            )

        else:

            pipeline.fit(
                X_train,
                y_train
            )

        training_time = (
            time.time() - start_time
        )

        # -------------------------------------------------
        # VALIDATION PREDICTIONS
        # -------------------------------------------------

        y_pred = pipeline.predict(
            X_validation
        )

        y_probability = (
            pipeline.predict_proba(
                X_validation
            )[:, 1]
        )

        metrics = calculate_metrics(
            y_validation,
            y_pred,
            y_probability
        )

        metrics["model"] = model_name
        metrics["training_seconds"] = (
            training_time
        )

        results.append(metrics)

        print("\nValidation metrics:")

        for metric, value in metrics.items():

            if metric not in [
                "model",
                "training_seconds"
            ]:
                print(
                    f"{metric:12s}: "
                    f"{value:.4f}"
                )

        print(
            "Training time:",
            f"{training_time:.2f} seconds"
        )

        # -------------------------------------------------
        # SAVE INDIVIDUAL MODEL
        # -------------------------------------------------

        joblib.dump(
            pipeline,
            ARTIFACTS_DIR
            / f"{model_name}.joblib"
        )

        # -------------------------------------------------
        # SELECT BEST BY PR-AUC
        # -------------------------------------------------

        if metrics["pr_auc"] > best_pr_auc:

            best_pr_auc = metrics["pr_auc"]
            best_model = pipeline
            best_model_name = model_name

    # -----------------------------------------------------
    # MODEL COMPARISON
    # -----------------------------------------------------

    results_df = pd.DataFrame(results)

    results_df = results_df[
        [
            "model",
            "accuracy",
            "precision",
            "recall",
            "f1_score",
            "roc_auc",
            "pr_auc",
            "training_seconds"
        ]
    ]

    results_df = results_df.sort_values(
        by="pr_auc",
        ascending=False
    )

    print("\n")
    print("=" * 80)
    print("MODEL COMPARISON")
    print("=" * 80)

    print(
        results_df.to_string(
            index=False
        )
    )

    results_df.to_csv(
        REPORTS_DIR
        / "model_comparison_validation.csv",
        index=False
    )

    # -----------------------------------------------------
    # SAVE BEST MODEL
    # -----------------------------------------------------

    print("\nBest validation model:")
    print(best_model_name)

    print(
        "Best PR-AUC:",
        round(best_pr_auc, 4)
    )

    joblib.dump(
        best_model,
        ARTIFACTS_DIR
        / "best_maintenance_risk_model.joblib"
    )

    print(
        "\nBest model saved successfully."
    )


if __name__ == "__main__":
    main()