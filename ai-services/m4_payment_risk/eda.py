from pathlib import Path
import pandas as pd


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = BASE_DIR.parent / "data" / "ml" / "M4_Payment_Risk.csv"

REPORT_DIR = BASE_DIR / "reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)


TARGET = "risk_label"

FEATURES = [
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


# ---------------------------------------------------------
# Load data
# ---------------------------------------------------------

df = pd.read_csv(DATA_PATH)

df["snapshot_month"] = pd.to_datetime(
    df["snapshot_month"],
    format="%Y-%m"
)


# ---------------------------------------------------------
# Basic information
# ---------------------------------------------------------

print("\n===== DATASET SHAPE =====")
print(df.shape)

print("\n===== COLUMNS =====")
print(df.columns.tolist())

print("\n===== DATA TYPES =====")
print(df.dtypes)

print("\n===== MISSING VALUES =====")
print(df.isnull().sum())

print("\n===== DUPLICATE ROWS =====")
print(df.duplicated().sum())


# ---------------------------------------------------------
# Target distribution
# ---------------------------------------------------------

print("\n===== TARGET DISTRIBUTION =====")

target_counts = df[TARGET].value_counts().sort_index()
target_percent = df[TARGET].value_counts(
    normalize=True
).sort_index() * 100

target_summary = pd.DataFrame({
    "count": target_counts,
    "percentage": target_percent.round(2)
})

print(target_summary)

target_summary.to_csv(
    REPORT_DIR / "target_distribution.csv"
)


# ---------------------------------------------------------
# Split distribution
# ---------------------------------------------------------

print("\n===== DATA SPLIT =====")

split_summary = (
    df.groupby("data_split")[TARGET]
    .agg(["count", "mean"])
)

split_summary["risk_percentage"] = (
    split_summary["mean"] * 100
).round(2)

split_summary = split_summary.drop(columns=["mean"])

print(split_summary)

split_summary.to_csv(
    REPORT_DIR / "split_distribution.csv"
)


# ---------------------------------------------------------
# Monthly risk rate
# ---------------------------------------------------------

print("\n===== MONTHLY RISK RATE =====")

monthly_risk = (
    df.groupby("snapshot_month")[TARGET]
    .agg(["count", "mean"])
)

monthly_risk["risk_percentage"] = (
    monthly_risk["mean"] * 100
).round(2)

monthly_risk = monthly_risk.drop(columns=["mean"])

print(monthly_risk)

monthly_risk.to_csv(
    REPORT_DIR / "monthly_risk_rate.csv"
)


# ---------------------------------------------------------
# Feature summary
# ---------------------------------------------------------

print("\n===== FEATURE SUMMARY =====")

feature_summary = df[FEATURES].describe().T

print(feature_summary)

feature_summary.to_csv(
    REPORT_DIR / "feature_summary.csv"
)


# ---------------------------------------------------------
# Feature statistics by risk
# ---------------------------------------------------------

print("\n===== FEATURES BY RISK LABEL =====")

feature_by_risk = (
    df.groupby(TARGET)[FEATURES]
    .mean()
    .T
)

print(feature_by_risk)

feature_by_risk.to_csv(
    REPORT_DIR / "feature_means_by_risk.csv"
)


# ---------------------------------------------------------
# Correlation with target
# ---------------------------------------------------------

print("\n===== FEATURE / TARGET CORRELATION =====")

correlations = (
    df[FEATURES + [TARGET]]
    .corr()[TARGET]
    .drop(TARGET)
    .sort_values(
        key=lambda x: x.abs(),
        ascending=False
    )
)

print(correlations)

correlations.to_csv(
    REPORT_DIR / "feature_target_correlations.csv"
)


# ---------------------------------------------------------
# Data validity checks
# ---------------------------------------------------------

print("\n===== RANGE CHECKS =====")

checks = {
    "monthly_income_non_negative":
        (df["monthly_income"] >= 0).all(),

    "historical_invoice_count_non_negative":
        (df["historical_invoice_count"] >= 0).all(),

    "late_payment_count_non_negative":
        (df["late_payment_count"] >= 0).all(),

    "missed_payment_count_non_negative":
        (df["missed_payment_count"] >= 0).all(),

    "avg_days_late_non_negative":
        (df["avg_days_late"] >= 0).all(),

    "max_days_late_non_negative":
        (df["max_days_late"] >= 0).all(),

    "historical_outstanding_non_negative":
        (df["historical_outstanding"] >= 0).all(),

    "rent_to_income_ratio_non_negative":
        (df["rent_to_income_ratio"] >= 0).all(),

    "payment_completion_ratio_between_0_and_1":
        df["payment_completion_ratio"].between(0, 1).all(),

    "risk_label_binary":
        df[TARGET].isin([0, 1]).all(),
}

for name, result in checks.items():
    print(f"{name}: {'PASS' if result else 'FAIL'}")


# ---------------------------------------------------------
# Tenant/month uniqueness
# ---------------------------------------------------------

print("\n===== TENANT / MONTH DUPLICATES =====")

tenant_month_duplicates = df.duplicated(
    subset=["tenant_id", "snapshot_month"]
).sum()

print(
    f"Duplicate tenant/month records: "
    f"{tenant_month_duplicates}"
)


# ---------------------------------------------------------
# Final EDA summary
# ---------------------------------------------------------

summary = {
    "rows": len(df),
    "columns": len(df.columns),
    "unique_tenants": df["tenant_id"].nunique(),
    "min_snapshot": df["snapshot_month"].min(),
    "max_snapshot": df["snapshot_month"].max(),
    "duplicate_rows": int(df.duplicated().sum()),
    "duplicate_tenant_month": int(tenant_month_duplicates),
    "missing_cells": int(df.isnull().sum().sum()),
}

summary_df = pd.DataFrame(
    [summary]
)

summary_df.to_csv(
    REPORT_DIR / "eda_summary.csv",
    index=False
)

print("\n===== EDA COMPLETE =====")
print(summary_df)