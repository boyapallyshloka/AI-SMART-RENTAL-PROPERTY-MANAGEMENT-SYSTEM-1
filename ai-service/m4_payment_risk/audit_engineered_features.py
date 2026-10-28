"""
M4 Payment Risk - Engineered Feature Audit

Checks all engineered features against the final model feature list.
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

FEATURE_LIST_PATH = (
    BASE_DIR
    / "artifacts"
    / "feature_list.joblib"
)


def main():

    print("=" * 70)
    print("M4 ENGINEERED FEATURE AUDIT")
    print("=" * 70)

    df = pd.read_csv(DATA_PATH)

    model_features = joblib.load(
        FEATURE_LIST_PATH
    )

    excluded_columns = {
        "tenant_id",
        "snapshot_month",
        "risk_label",
        "data_split",
        "future_bad_payment_ratio",
    }

    all_candidate_features = [
        column
        for column in df.columns
        if column not in excluded_columns
    ]

    model_features = list(model_features)

    not_in_model = [
        feature
        for feature in all_candidate_features
        if feature not in model_features
    ]

    in_model = [
        feature
        for feature in all_candidate_features
        if feature in model_features
    ]

    print()
    print(f"Total candidate features : {len(all_candidate_features)}")
    print(f"Final model features     : {len(model_features)}")

    print()
    print("FEATURES USED BY MODEL")
    print("-" * 70)

    for index, feature in enumerate(
        model_features,
        start=1,
    ):
        print(f"{index:2}. {feature}")

    print()
    print("ENGINEERED FEATURES NOT USED BY MODEL")
    print("-" * 70)

    if not_in_model:
        for feature in not_in_model:
            print(f"- {feature}")
    else:
        print("None")

    print()
    print("CHECKING EXCLUDED ENGINEERED FEATURES")
    print("-" * 70)

    target = df["risk_label"]

    for feature in not_in_model:

        correlation = df[feature].corr(target)

        risk_0_mean = df.loc[
            df["risk_label"] == 0,
            feature,
        ].mean()

        risk_1_mean = df.loc[
            df["risk_label"] == 1,
            feature,
        ].mean()

        print()
        print(f"Feature: {feature}")
        print(f"  Correlation with risk : {correlation:.6f}")
        print(f"  Risk 0 mean           : {risk_0_mean:.6f}")
        print(f"  Risk 1 mean           : {risk_1_mean:.6f}")
        print(
            f"  Unique values         : "
            f"{df[feature].nunique()}"
        )

    print()
    print("=" * 70)
    print("ENGINEERED FEATURE AUDIT COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()