from pathlib import Path

import numpy as np
import pandas as pd


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

INPUT_FILE = BASE_DIR / "data" / "ml" / "M4_Payment_Risk.csv"
OUTPUT_FILE = BASE_DIR / "data" / "ml" / "M4_Payment_Risk_Engineered.csv"


# ============================================================
# CONFIGURATION
# ============================================================

TARGET = "risk_label"

# Historical features already present in M4
BASE_FEATURES = [
    "monthly_income",
    "historical_invoice_count",
    "late_payment_count",
    "missed_payment_count",
    "avg_days_late",
    "max_days_late",
    "historical_outstanding",
    "rent_to_income_ratio",
    "payment_completion_ratio",
]


# ============================================================
# LOAD DATA
# ============================================================

def load_data():
    df = pd.read_csv(INPUT_FILE)

    df["snapshot_month"] = pd.to_datetime(
        df["snapshot_month"],
        errors="coerce"
    )

    return df


# ============================================================
# FEATURE ENGINEERING
# ============================================================

def create_engineered_features(df):
    """
    Create additional historical payment-behavior features.

    IMPORTANT:
    These features must use information available up to the
    current snapshot only. No future payment information is used.
    """

    df = df.sort_values(
        ["tenant_id", "snapshot_month"]
    ).copy()

    # --------------------------------------------------------
    # Recent behavior approximations
    #
    # The existing M4 dataset contains cumulative historical
    # payment features. We therefore derive recent behavior
    # using differences between snapshots.
    # --------------------------------------------------------

    grouped = df.groupby("tenant_id", group_keys=False)

    # Historical cumulative counts
    df["late_payment_count_delta"] = (
        grouped["late_payment_count"].diff()
    )

    df["missed_payment_count_delta"] = (
        grouped["missed_payment_count"].diff()
    )

    # First snapshot for a tenant has no previous snapshot.
    # Treat the available cumulative value as the initial
    # historical activity rather than introducing NaN.
    df["late_payment_count_delta"] = (
        df["late_payment_count_delta"]
        .fillna(df["late_payment_count"])
        .clip(lower=0)
    )

    df["missed_payment_count_delta"] = (
        df["missed_payment_count_delta"]
        .fillna(df["missed_payment_count"])
        .clip(lower=0)
    )

    # --------------------------------------------------------
    # 3-month rolling behavior
    # --------------------------------------------------------

    df["recent_late_payment_count_3m"] = (
        grouped["late_payment_count_delta"]
        .rolling(window=3, min_periods=1)
        .sum()
        .reset_index(level=0, drop=True)
    )

    df["recent_missed_payment_count_3m"] = (
        grouped["missed_payment_count_delta"]
        .rolling(window=3, min_periods=1)
        .sum()
        .reset_index(level=0, drop=True)
    )

    df["recent_avg_days_late_3m"] = (
        grouped["avg_days_late"]
        .rolling(window=3, min_periods=1)
        .mean()
        .reset_index(level=0, drop=True)
    )

    df["recent_payment_completion_ratio_3m"] = (
        grouped["payment_completion_ratio"]
        .rolling(window=3, min_periods=1)
        .mean()
        .reset_index(level=0, drop=True)
    )

    # --------------------------------------------------------
    # 6-month rolling behavior
    # --------------------------------------------------------

    df["recent_late_payment_count_6m"] = (
        grouped["late_payment_count_delta"]
        .rolling(window=6, min_periods=1)
        .sum()
        .reset_index(level=0, drop=True)
    )

    df["recent_missed_payment_count_6m"] = (
        grouped["missed_payment_count_delta"]
        .rolling(window=6, min_periods=1)
        .sum()
        .reset_index(level=0, drop=True)
    )

    df["recent_avg_days_late_6m"] = (
        grouped["avg_days_late"]
        .rolling(window=6, min_periods=1)
        .mean()
        .reset_index(level=0, drop=True)
    )

    df["recent_payment_completion_ratio_6m"] = (
        grouped["payment_completion_ratio"]
        .rolling(window=6, min_periods=1)
        .mean()
        .reset_index(level=0, drop=True)
    )

    # --------------------------------------------------------
    # Trend features
    #
    # Positive value:
    # worsening payment behavior
    #
    # Negative value:
    # improving payment behavior
    # --------------------------------------------------------

    df["late_payment_trend"] = (
        grouped["late_payment_count"]
        .diff()
        .fillna(0)
    )

    df["missed_payment_trend"] = (
        grouped["missed_payment_count"]
        .diff()
        .fillna(0)
    )

    df["payment_completion_trend"] = (
        grouped["payment_completion_ratio"]
        .diff()
        .fillna(0)
    )

    # --------------------------------------------------------
    # Clean numerical values
    # --------------------------------------------------------

    engineered_features = [
        "recent_late_payment_count_3m",
        "recent_missed_payment_count_3m",
        "recent_avg_days_late_3m",
        "recent_payment_completion_ratio_3m",
        "recent_late_payment_count_6m",
        "recent_missed_payment_count_6m",
        "recent_avg_days_late_6m",
        "recent_payment_completion_ratio_6m",
        "late_payment_trend",
        "missed_payment_trend",
        "payment_completion_trend",
    ]

    for column in engineered_features:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce"
        )

    return df


# ============================================================
# VALIDATION
# ============================================================

def validate_output(df):
    print("\n========== FEATURE ENGINEERING VALIDATION ==========")

    print(f"Rows: {len(df):,}")
    print(f"Columns: {len(df.columns):,}")
    print(f"Unique tenants: {df['tenant_id'].nunique():,}")

    # Duplicate checks
    duplicate_rows = df.duplicated().sum()

    duplicate_tenant_month = df.duplicated(
        subset=["tenant_id", "snapshot_month"]
    ).sum()

    print(f"Duplicate rows: {duplicate_rows}")
    print(f"Duplicate tenant/month rows: {duplicate_tenant_month}")

    # Missing values
    missing_total = df.isna().sum().sum()

    print(f"Missing values: {missing_total}")

    # Target
    print("\nTarget distribution:")

    target_counts = df[TARGET].value_counts().sort_index()

    for label, count in target_counts.items():
        percentage = count / len(df) * 100
        print(
            f"  {label}: {count:,} ({percentage:.2f}%)"
        )

    # Check forbidden future feature
    if "future_bad_payment_ratio" in df.columns:
        print(
            "\nWARNING: future_bad_payment_ratio exists in dataset "
            "but MUST NOT be used as a model feature."
        )

    print("\nEngineered features:")

    engineered_features = [
        "recent_late_payment_count_3m",
        "recent_missed_payment_count_3m",
        "recent_avg_days_late_3m",
        "recent_payment_completion_ratio_3m",
        "recent_late_payment_count_6m",
        "recent_missed_payment_count_6m",
        "recent_avg_days_late_6m",
        "recent_payment_completion_ratio_6m",
        "late_payment_trend",
        "missed_payment_trend",
        "payment_completion_trend",
    ]

    for feature in engineered_features:
        print(f"  ✓ {feature}")

    print("\n====================================================")


# ============================================================
# MAIN
# ============================================================

def main():
    print("Loading M4 dataset...")
    print(f"Input: {INPUT_FILE}")

    df = load_data()

    print(f"Original shape: {df.shape}")

    print("\nCreating historical payment-behavior features...")

    df = create_engineered_features(df)

    # Restore chronological ordering
    df = df.sort_values(
        ["snapshot_month", "tenant_id"]
    ).reset_index(drop=True)

    validate_output(df)

    # Save
    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    df.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print("\nFeature engineering completed successfully.")
    print(f"Output: {OUTPUT_FILE}")
    print(f"Final shape: {df.shape}")


if __name__ == "__main__":
    main()