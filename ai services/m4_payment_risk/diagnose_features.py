"""
M4 Payment Risk - Feature Diagnostic

Purpose:
    Diagnose whether the current historical and engineered
    features contain useful predictive signal for risk_label.

Important:
    future_bad_payment_ratio is deliberately excluded because
    it is derived from future payment behaviour and would cause
    target leakage.

Outputs:
    - Feature statistics
    - Correlation with risk_label
    - Mean comparison by risk class
    - Standardized mean difference
    - Unique-value counts
    - Constant / near-constant feature detection
    - Validation/test feature diagnostics
    - CSV reports
"""

from pathlib import Path

import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR.parent
    / "data"
    / "ml"
    / "M4_Payment_Risk_Engineered.csv"
)

REPORT_DIR = BASE_DIR / "reports"

TARGET = "risk_label"

# Deliberately excluded from model diagnostics
EXCLUDED_FEATURES = {
    "tenant_id",
    "snapshot_month",
    "data_split",
    "future_bad_payment_ratio",
    TARGET,
}


def safe_correlation(series, target):
    """Calculate Pearson correlation safely."""

    if series.nunique(dropna=True) <= 1:
        return np.nan

    if target.nunique(dropna=True) <= 1:
        return np.nan

    return series.corr(target)


def standardized_mean_difference(
    group_zero,
    group_one,
):
    """
    Calculate standardized mean difference.

    Formula:
        (mean_1 - mean_0) / pooled_std
    """

    mean_zero = group_zero.mean()
    mean_one = group_one.mean()

    std_zero = group_zero.std()
    std_one = group_one.std()

    pooled_std = np.sqrt(
        (
            std_zero**2
            + std_one**2
        )
        / 2
    )

    if pooled_std == 0 or np.isnan(pooled_std):
        return np.nan

    return (
        mean_one - mean_zero
    ) / pooled_std


def diagnose_feature(feature, df):
    """Calculate diagnostic statistics for one feature."""

    values = df[feature]

    risk_zero = df.loc[
        df[TARGET] == 0,
        feature,
    ]

    risk_one = df.loc[
        df[TARGET] == 1,
        feature,
    ]

    result = {
        "feature": feature,
        "dtype": str(values.dtype),
        "unique_values": values.nunique(dropna=True),
        "missing_values": int(values.isna().sum()),
        "mean": values.mean(),
        "std": values.std(),
        "min": values.min(),
        "max": values.max(),
        "risk_0_mean": risk_zero.mean(),
        "risk_1_mean": risk_one.mean(),
        "risk_0_std": risk_zero.std(),
        "risk_1_std": risk_one.std(),
        "correlation_with_risk": safe_correlation(
            values,
            df[TARGET],
        ),
        "standardized_mean_difference": (
            standardized_mean_difference(
                risk_zero,
                risk_one,
            )
        ),
    }

    return result


def print_feature_signal_summary(results):
    """Print strongest and weakest features."""

    result_df = pd.DataFrame(results)

    result_df["abs_correlation"] = (
        result_df["correlation_with_risk"]
        .abs()
    )

    result_df["abs_smd"] = (
        result_df["standardized_mean_difference"]
        .abs()
    )

    print()
    print("=" * 70)
    print("FEATURE SIGNAL SUMMARY")
    print("=" * 70)

    print()
    print("Strongest features by absolute correlation")
    print("-" * 70)

    strongest_corr = result_df.sort_values(
        "abs_correlation",
        ascending=False,
    ).head(10)

    for _, row in strongest_corr.iterrows():
        print(
            f"{row['feature']:45} "
            f"corr={row['correlation_with_risk']:.6f}"
        )

    print()
    print("Strongest features by standardized mean difference")
    print("-" * 70)

    strongest_smd = result_df.sort_values(
        "abs_smd",
        ascending=False,
    ).head(10)

    for _, row in strongest_smd.iterrows():
        print(
            f"{row['feature']:45} "
            f"SMD={row['standardized_mean_difference']:.6f}"
        )

    print()
    print("Near-constant features")
    print("-" * 70)

    near_constant = result_df[
        result_df["unique_values"] <= 2
    ]

    if near_constant.empty:
        print("None detected.")
    else:
        for _, row in near_constant.iterrows():
            print(
                f"{row['feature']:45} "
                f"unique={int(row['unique_values'])}"
            )


def diagnose_split(df, split_name):
    """Diagnose feature distributions within one split."""

    split_df = df[
        df["data_split"] == split_name
    ].copy()

    if split_df.empty:
        print(
            f"\nWARNING: No rows found for {split_name}"
        )
        return

    features = [
        column
        for column in split_df.columns
        if column not in EXCLUDED_FEATURES
    ]

    print()
    print("=" * 70)
    print(f"{split_name.upper()} FEATURE DIAGNOSTIC")
    print("=" * 70)

    print()
    print(f"Rows       : {len(split_df)}")
    print(
        f"Risk 0     : "
        f"{(split_df[TARGET] == 0).sum()}"
    )
    print(
        f"Risk 1     : "
        f"{(split_df[TARGET] == 1).sum()}"
    )

    results = []

    for feature in features:
        results.append(
            diagnose_feature(
                feature,
                split_df,
            )
        )

    result_df = pd.DataFrame(results)

    result_df["abs_correlation"] = (
        result_df["correlation_with_risk"]
        .abs()
    )

    print()
    print("Top 10 correlations within split")
    print("-" * 70)

    top = result_df.sort_values(
        "abs_correlation",
        ascending=False,
    ).head(10)

    for _, row in top.iterrows():
        print(
            f"{row['feature']:45} "
            f"{row['correlation_with_risk']:.6f}"
        )


def main():
    print("=" * 70)
    print("M4 PAYMENT RISK - FEATURE DIAGNOSTIC")
    print("=" * 70)

    REPORT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_PATH}"
        )

    df = pd.read_csv(DATA_PATH)

    print()
    print(f"Dataset: {DATA_PATH}")
    print(f"Rows   : {len(df)}")
    print(f"Columns: {len(df.columns)}")

    # ------------------------------------------------------------------
    # Basic validation
    # ------------------------------------------------------------------

    print()
    print("=" * 70)
    print("BASIC DATA CHECK")
    print("=" * 70)

    print()
    print(
        "Missing values:",
        int(df.isna().sum().sum()),
    )

    print(
        "Duplicate rows:",
        int(df.duplicated().sum()),
    )

    print()
    print("Target distribution:")

    target_counts = (
        df[TARGET]
        .value_counts()
        .sort_index()
    )

    for label, count in target_counts.items():
        percentage = (
            count / len(df) * 100
        )

        print(
            f"  {label}: "
            f"{count} "
            f"({percentage:.2f}%)"
        )

    # ------------------------------------------------------------------
    # Feature selection
    # ------------------------------------------------------------------

    features = [
        column
        for column in df.columns
        if column not in EXCLUDED_FEATURES
    ]

    print()
    print("=" * 70)
    print("MODEL FEATURE CHECK")
    print("=" * 70)

    print()
    print(
        f"Candidate diagnostic features: "
        f"{len(features)}"
    )

    for index, feature in enumerate(
        features,
        start=1,
    ):
        print(
            f"{index:2}. {feature}"
        )

    # ------------------------------------------------------------------
    # Full dataset diagnostics
    # ------------------------------------------------------------------

    results = []

    for feature in features:
        results.append(
            diagnose_feature(
                feature,
                df,
            )
        )

    result_df = pd.DataFrame(results)

    result_df["abs_correlation"] = (
        result_df["correlation_with_risk"]
        .abs()
    )

    result_df["abs_smd"] = (
        result_df["standardized_mean_difference"]
        .abs()
    )

    # ------------------------------------------------------------------
    # Save full diagnostics
    # ------------------------------------------------------------------

    output_path = (
        REPORT_DIR
        / "feature_diagnostic.csv"
    )

    result_df.to_csv(
        output_path,
        index=False,
    )

    print()
    print(
        f"Saved feature diagnostic: "
        f"{output_path}"
    )

    # ------------------------------------------------------------------
    # Signal summary
    # ------------------------------------------------------------------

    print_feature_signal_summary(
        results
    )

    # ------------------------------------------------------------------
    # Feature means by risk
    # ------------------------------------------------------------------

    means = (
        df.groupby(TARGET)[features]
        .mean()
        .T
        .reset_index()
    )

    means.columns = [
        "feature",
        "risk_0_mean",
        "risk_1_mean",
    ]

    means["difference"] = (
        means["risk_1_mean"]
        - means["risk_0_mean"]
    )

    means_path = (
        REPORT_DIR
        / "feature_means_by_risk_current.csv"
    )

    means.to_csv(
        means_path,
        index=False,
    )

    print(
        f"Saved risk-group means: "
        f"{means_path}"
    )

    # ------------------------------------------------------------------
    # Split diagnostics
    # ------------------------------------------------------------------

    diagnose_split(
        df,
        "train",
    )

    diagnose_split(
        df,
        "validation",
    )

    diagnose_split(
        df,
        "test",
    )

    # ------------------------------------------------------------------
    # Temporal risk rate
    # ------------------------------------------------------------------

    if "snapshot_month" in df.columns:

        monthly = (
            df.groupby("snapshot_month")[TARGET]
            .agg(
                [
                    "count",
                    "mean",
                ]
            )
            .reset_index()
        )

        monthly["risk_percentage"] = (
            monthly["mean"] * 100
        )

        monthly_path = (
            REPORT_DIR
            / "monthly_risk_diagnostic.csv"
        )

        monthly.to_csv(
            monthly_path,
            index=False,
        )

        print()
        print(
            f"Saved monthly risk diagnostic: "
            f"{monthly_path}"
        )

    # ------------------------------------------------------------------
    # Final interpretation
    # ------------------------------------------------------------------

    print()
    print("=" * 70)
    print("INTERPRETATION GUIDE")
    print("=" * 70)

    print()
    print(
        "Correlation near 0:"
    )
    print(
        "  Feature has little linear relationship "
        "with risk_label."
    )

    print()
    print(
        "Standardized mean difference near 0:"
    )
    print(
        "  Feature distributions are similar between "
        "risk classes."
    )

    print()
    print(
        "Very low unique values:"
    )
    print(
        "  Feature may have insufficient variation."
    )

    print()
    print(
        "IMPORTANT:"
    )
    print(
        "  Do not add future_bad_payment_ratio "
        "to the model."
    )

    print()
    print("=" * 70)
    print("FEATURE DIAGNOSTIC COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()