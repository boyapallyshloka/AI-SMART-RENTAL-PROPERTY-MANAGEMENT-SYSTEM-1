"""
M4 Payment Risk - Direct Model Verification

Verifies that the saved model pipeline produces the same
prediction/probability used by the API.
"""

from pathlib import Path

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR.parent
    / "data"
    / "ml"
    / "M4_Payment_Risk_Engineered.csv"
)

MODEL_PATH = BASE_DIR / "artifacts" / "model_pipeline.joblib"
FEATURE_LIST_PATH = BASE_DIR / "artifacts" / "feature_list.joblib"


def main():
    print("=" * 70)
    print("M4 API / MODEL PREDICTION VERIFICATION")
    print("=" * 70)

    # Check files
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

    if not FEATURE_LIST_PATH.exists():
        raise FileNotFoundError(
            f"Feature list not found: {FEATURE_LIST_PATH}"
        )

    # Load
    df = pd.read_csv(DATA_PATH)

    model = joblib.load(MODEL_PATH)
    feature_list = joblib.load(FEATURE_LIST_PATH)

    # Use the same row tested through Swagger
    row = df[
        (df["tenant_id"] == "T00383")
        & (df["snapshot_month"] == "2024-01-01")
    ]

    if row.empty:
        raise ValueError(
            "Test row T00383 / 2024-01-01 was not found."
        )

    row = row.iloc[0]

    # Build model input
    X = pd.DataFrame(
        [[row[feature] for feature in feature_list]],
        columns=feature_list,
    )

    # Direct prediction
    prediction = int(model.predict(X)[0])

    if hasattr(model, "predict_proba"):
        probability = float(model.predict_proba(X)[0][1])
    else:
        probability = None

    actual_label = int(row["risk_label"])

    print()
    print("Test tenant       :", row["tenant_id"])
    print("Snapshot month    :", row["snapshot_month"])
    print("Actual risk label :", actual_label)
    print()
    print("DIRECT MODEL RESULT")
    print("-------------------")
    print("Prediction        :", prediction)

    if probability is not None:
        print("Probability       :", probability)

    print()
    print("EXPECTED API RESULT")
    print("-------------------")
    print("Prediction        : 0")
    print("Probability       : 0.49122336533185573")

    print()
    print("VERIFICATION")
    print("-------------")

    prediction_match = prediction == 0

    if probability is not None:
        probability_match = abs(
            probability - 0.49122336533185573
        ) < 1e-6
    else:
        probability_match = False

    print("Prediction match  :", prediction_match)
    print("Probability match :", probability_match)

    if prediction_match and probability_match:
        print()
        print("PASS: API and saved model are consistent.")
    else:
        print()
        print("CHECK REQUIRED: API and direct model differ.")


if __name__ == "__main__":
    main()