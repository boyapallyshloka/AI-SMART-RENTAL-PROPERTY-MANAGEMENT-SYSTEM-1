"""
M6 Property Profitability Prediction
Exploratory Data Analysis (EDA)

Avenue360 ML Standard v1.1

Purpose:
- Analyze the M6 profitability dataset before preprocessing/model training.
- Understand regression and classification targets.
- Inspect feature distributions, outliers, correlations, and temporal behavior.
- Identify potential feature redundancy or suspicious relationships.
- Generate reproducible EDA reports and plots.

This script does NOT:
- Train models
- Modify the source dataset
- Perform preprocessing
- Perform feature scaling
"""

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


# ============================================================================
# PATH CONFIGURATION
# ============================================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR.parent / "data" / "ml" / "M6_Profitability_v2.csv"

REPORT_DIR = BASE_DIR / "reports"
PLOT_DIR = BASE_DIR / "plots"

REPORT_DIR.mkdir(parents=True, exist_ok=True)
PLOT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# CONFIGURATION
# ============================================================================

TARGET_REGRESSION = "next_month_profit"
TARGET_CLASSIFICATION = "profitability_label"

ID_COLUMNS = [
    "property_id",
    "snapshot_month",
    "data_split",
]

TARGET_COLUMNS = [
    TARGET_REGRESSION,
    TARGET_CLASSIFICATION,
]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def print_section(title: str) -> None:
    print()
    print("=" * 79)
    print(title)
    print("=" * 79)


def save_plot(filename: str) -> None:
    path = PLOT_DIR / filename
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[SAVED] Plot: {path}")


def safe_skew(series: pd.Series) -> float:
    """Return skewness safely."""
    if series.nunique(dropna=True) <= 1:
        return 0.0

    return float(series.skew())


# ============================================================================
# LOAD DATA
# ============================================================================

print_section("M6 PROPERTY PROFITABILITY - EXPLORATORY DATA ANALYSIS")

print(f"Dataset: {DATA_PATH}")

if not DATA_PATH.exists():
    raise FileNotFoundError(
        f"M6 dataset not found:\n{DATA_PATH}"
    )

df = pd.read_csv(DATA_PATH)

df["snapshot_month"] = pd.to_datetime(
    df["snapshot_month"],
    errors="coerce"
)

print(f"Rows loaded: {len(df):,}")
print(f"Columns loaded: {len(df.columns)}")


# ============================================================================
# 1. BASIC DATASET OVERVIEW
# ============================================================================

print_section("1. DATASET OVERVIEW")

print(f"Rows: {df.shape[0]:,}")
print(f"Columns: {df.shape[1]:,}")
print(f"Unique properties: {df['property_id'].nunique():,}")
print(
    f"Snapshot period: "
    f"{df['snapshot_month'].min().date()} "
    f"to "
    f"{df['snapshot_month'].max().date()}"
)
print(
    f"Snapshot months: "
    f"{df['snapshot_month'].nunique()}"
)

print()
print("Column names:")

for i, column in enumerate(df.columns, start=1):
    print(f"{i:2}. {column}")


# ============================================================================
# 2. DATA QUALITY CHECK
# ============================================================================

print_section("2. DATA QUALITY CHECK")

missing_total = int(df.isna().sum().sum())
duplicate_rows = int(df.duplicated().sum())
duplicate_property_month = int(
    df.duplicated(
        subset=["property_id", "snapshot_month"]
    ).sum()
)

print(f"Missing values: {missing_total:,}")
print(f"Duplicate complete rows: {duplicate_rows:,}")
print(
    f"Duplicate property-month rows: "
    f"{duplicate_property_month:,}"
)

if missing_total == 0:
    print("[PASS] No missing values detected")
else:
    print("[WARNING] Missing values detected")

if duplicate_rows == 0:
    print("[PASS] No duplicate rows detected")
else:
    print("[WARNING] Duplicate rows detected")

if duplicate_property_month == 0:
    print("[PASS] No duplicate property-month combinations")
else:
    print("[WARNING] Duplicate property-month combinations detected")


# ============================================================================
# 3. TARGET ANALYSIS - REGRESSION
# ============================================================================

print_section("3. REGRESSION TARGET ANALYSIS")

profit = df[TARGET_REGRESSION]

print(f"Target: {TARGET_REGRESSION}")
print(f"Count: {profit.count():,}")
print(f"Unique values: {profit.nunique():,}")
print(f"Mean: {profit.mean():,.2f}")
print(f"Median: {profit.median():,.2f}")
print(f"Std: {profit.std():,.2f}")
print(f"Minimum: {profit.min():,.2f}")
print(f"Maximum: {profit.max():,.2f}")
print(f"Skewness: {safe_skew(profit):.4f}")

print()
print("Percentiles:")

percentiles = profit.quantile(
    [0.01, 0.05, 0.25, 0.50, 0.75, 0.95, 0.99]
)

for percentile, value in percentiles.items():
    print(f"{percentile:>6.0%}: {value:,.2f}")

negative_profit = int((profit < 0).sum())
zero_profit = int((profit == 0).sum())
positive_profit = int((profit > 0).sum())

print()
print(f"Negative next-month profit: {negative_profit:,}")
print(f"Zero next-month profit:     {zero_profit:,}")
print(f"Positive next-month profit: {positive_profit:,}")

# Regression target distribution
plt.figure(figsize=(10, 6))
plt.hist(profit, bins=100)
plt.title("M6 Next-Month Profit Distribution")
plt.xlabel("Next-Month Profit")
plt.ylabel("Frequency")
save_plot("01_next_month_profit_distribution.png")


# ============================================================================
# 4. TARGET ANALYSIS - CLASSIFICATION
# ============================================================================

print_section("4. CLASSIFICATION TARGET ANALYSIS")

label_counts = df[TARGET_CLASSIFICATION].value_counts().sort_index()
label_percentages = (
    df[TARGET_CLASSIFICATION]
    .value_counts(normalize=True)
    .sort_index()
    * 100
)

print(f"Target: {TARGET_CLASSIFICATION}")
print()

for label in label_counts.index:
    print(
        f"Class {label}: "
        f"{label_counts[label]:,} rows "
        f"({label_percentages[label]:.2f}%)"
    )

positive_rate = float(
    df[TARGET_CLASSIFICATION].mean()
)

print()
print(f"Positive class rate: {positive_rate:.4%}")

if positive_rate < 0.20:
    print(
        "[INFO] Classification target is imbalanced. "
        "Accuracy should not be used as the only evaluation metric."
    )

# Classification target plot
plt.figure(figsize=(8, 5))
label_counts.plot(kind="bar")
plt.title("M6 Profitability Label Distribution")
plt.xlabel("Profitability Label")
plt.ylabel("Number of Rows")
plt.xticks(rotation=0)
save_plot("02_profitability_label_distribution.png")


# ============================================================================
# 5. TARGET CONSISTENCY CHECK
# ============================================================================

print_section("5. TARGET CONSISTENCY CHECK")

expected_label = (
    df[TARGET_REGRESSION] > 0
).astype(int)

label_mismatches = int(
    (expected_label != df[TARGET_CLASSIFICATION]).sum()
)

print(
    "Expected profitability_label = "
    "(next_month_profit > 0)"
)

print(f"Label mismatches: {label_mismatches:,}")

if label_mismatches == 0:
    print("[PASS] Classification target is consistent with regression target")
else:
    print("[WARNING] Classification target mismatch detected")


# ============================================================================
# 6. NUMERICAL FEATURE SUMMARY
# ============================================================================

print_section("6. NUMERICAL FEATURE SUMMARY")

numeric_columns = df.select_dtypes(
    include=np.number
).columns.tolist()

feature_numeric_columns = [
    column
    for column in numeric_columns
    if column not in TARGET_COLUMNS
    and column not in ["property_id"]
]

summary = df[feature_numeric_columns].describe().T

summary["missing"] = df[
    feature_numeric_columns
].isna().sum()

summary["skewness"] = [
    safe_skew(df[column])
    for column in feature_numeric_columns
]

summary_path = REPORT_DIR / "numerical_feature_summary.csv"

summary.to_csv(summary_path)

print(
    f"Numerical model-candidate features: "
    f"{len(feature_numeric_columns)}"
)

print()
print(summary[
    [
        "count",
        "mean",
        "std",
        "min",
        "25%",
        "50%",
        "75%",
        "max",
        "skewness",
    ]
].round(4).to_string())

print()
print(f"[SAVED] Numerical summary: {summary_path}")


# ============================================================================
# 7. OUTLIER ANALYSIS
# ============================================================================

print_section("7. OUTLIER ANALYSIS")

outlier_rows = []

for column in feature_numeric_columns:

    series = df[column].dropna()

    if series.empty or series.nunique() <= 1:
        continue

    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1

    if iqr == 0:
        lower_bound = q1
        upper_bound = q3
    else:
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

    outlier_count = int(
        ((series < lower_bound) | (series > upper_bound)).sum()
    )

    outlier_percentage = (
        outlier_count / len(series) * 100
    )

    outlier_rows.append(
        {
            "feature": column,
            "q1": q1,
            "q3": q3,
            "iqr": iqr,
            "lower_bound": lower_bound,
            "upper_bound": upper_bound,
            "outlier_count": outlier_count,
            "outlier_percentage": outlier_percentage,
        }
    )

outlier_df = pd.DataFrame(outlier_rows)

outlier_df = outlier_df.sort_values(
    "outlier_percentage",
    ascending=False
)

outlier_path = REPORT_DIR / "outlier_analysis.csv"

outlier_df.to_csv(
    outlier_path,
    index=False
)

print(
    outlier_df[
        [
            "feature",
            "outlier_count",
            "outlier_percentage",
        ]
    ].head(20).to_string(index=False)
)

print()
print(f"[SAVED] Outlier analysis: {outlier_path}")


# ============================================================================
# 8. CORRELATION WITH REGRESSION TARGET
# ============================================================================

print_section("8. FEATURE CORRELATION WITH REGRESSION TARGET")

correlation_data = df[
    feature_numeric_columns + [TARGET_REGRESSION]
].corr(numeric_only=True)

target_correlations = (
    correlation_data[TARGET_REGRESSION]
    .drop(TARGET_REGRESSION)
    .sort_values(
        key=lambda x: x.abs(),
        ascending=False
    )
)

correlation_output = pd.DataFrame(
    {
        "feature": target_correlations.index,
        "correlation": target_correlations.values,
        "absolute_correlation": target_correlations.abs().values,
    }
)

correlation_path = (
    REPORT_DIR / "feature_correlation_with_profit.csv"
)

correlation_output.to_csv(
    correlation_path,
    index=False
)

print(
    correlation_output.head(20).to_string(index=False)
)

print()
print(
    f"[SAVED] Target correlation report: "
    f"{correlation_path}"
)

# Correlation plot
top_correlations = (
    target_correlations
    .head(15)
    .sort_values()
)

plt.figure(figsize=(10, 7))
top_correlations.plot(kind="barh")
plt.title(
    "Top Feature Correlations with Next-Month Profit"
)
plt.xlabel("Correlation")
plt.ylabel("Feature")
save_plot("03_top_feature_profit_correlations.png")


# ============================================================================
# 9. CORRELATION BETWEEN FEATURES
# ============================================================================

print_section("9. FEATURE-TO-FEATURE CORRELATION")

feature_correlation = df[
    feature_numeric_columns
].corr(numeric_only=True)

high_correlation_pairs = []

for i, feature_a in enumerate(feature_numeric_columns):

    for feature_b in feature_numeric_columns[i + 1:]:

        correlation = feature_correlation.loc[
            feature_a,
            feature_b
        ]

        if abs(correlation) >= 0.90:

            high_correlation_pairs.append(
                {
                    "feature_a": feature_a,
                    "feature_b": feature_b,
                    "correlation": correlation,
                }
            )

high_corr_df = pd.DataFrame(
    high_correlation_pairs
)

if not high_corr_df.empty:
    high_corr_df = high_corr_df.sort_values(
        "correlation",
        key=lambda x: x.abs(),
        ascending=False
    )

    print(
        high_corr_df.to_string(index=False)
    )

else:
    print(
        "[PASS] No feature pairs with absolute "
        "correlation >= 0.90"
    )

high_corr_path = (
    REPORT_DIR / "high_feature_correlations.csv"
)

high_corr_df.to_csv(
    high_corr_path,
    index=False
)

print()
print(
    f"[SAVED] High-correlation report: "
    f"{high_corr_path}"
)


# ============================================================================
# 10. TEMPORAL TARGET ANALYSIS
# ============================================================================

print_section("10. TEMPORAL TARGET ANALYSIS")

monthly_target = (
    df.groupby("snapshot_month")
    .agg(
        avg_next_month_profit=(
            TARGET_REGRESSION,
            "mean"
        ),
        median_next_month_profit=(
            TARGET_REGRESSION,
            "median"
        ),
        positive_profit_rate=(
            TARGET_CLASSIFICATION,
            "mean"
        ),
        row_count=(
            TARGET_REGRESSION,
            "size"
        ),
    )
    .reset_index()
)

monthly_target["positive_profit_rate"] *= 100

monthly_target_path = (
    REPORT_DIR / "monthly_target_analysis.csv"
)

monthly_target.to_csv(
    monthly_target_path,
    index=False
)

print(
    monthly_target.to_string(index=False)
)

print()
print(
    f"[SAVED] Monthly target report: "
    f"{monthly_target_path}"
)

# Average next-month profit over time
plt.figure(figsize=(12, 6))
plt.plot(
    monthly_target["snapshot_month"],
    monthly_target["avg_next_month_profit"]
)
plt.title("Average Next-Month Profit by Snapshot Month")
plt.xlabel("Snapshot Month")
plt.ylabel("Average Next-Month Profit")
plt.xticks(rotation=45)
save_plot("04_average_next_month_profit_over_time.png")


# ============================================================================
# 11. PROFITABILITY RATE OVER TIME
# ============================================================================

plt.figure(figsize=(12, 6))
plt.plot(
    monthly_target["snapshot_month"],
    monthly_target["positive_profit_rate"]
)
plt.title("Positive Profitability Rate by Snapshot Month")
plt.xlabel("Snapshot Month")
plt.ylabel("Positive Profitability Rate (%)")
plt.xticks(rotation=45)
save_plot("05_profitability_rate_over_time.png")


# ============================================================================
# 12. SPLIT-WISE TARGET ANALYSIS
# ============================================================================

print_section("12. TRAIN / VALIDATION / TEST TARGET ANALYSIS")

split_summary = (
    df.groupby("data_split")
    .agg(
        rows=(
            TARGET_REGRESSION,
            "size"
        ),
        avg_next_month_profit=(
            TARGET_REGRESSION,
            "mean"
        ),
        median_next_month_profit=(
            TARGET_REGRESSION,
            "median"
        ),
        min_next_month_profit=(
            TARGET_REGRESSION,
            "min"
        ),
        max_next_month_profit=(
            TARGET_REGRESSION,
            "max"
        ),
        positive_profit_rate=(
            TARGET_CLASSIFICATION,
            "mean"
        ),
    )
)

split_summary["positive_profit_rate"] *= 100

print(
    split_summary.to_string()
)

split_summary_path = (
    REPORT_DIR / "split_target_summary.csv"
)

split_summary.to_csv(
    split_summary_path
)

print()
print(
    f"[SAVED] Split target report: "
    f"{split_summary_path}"
)


# ============================================================================
# 13. FEATURE RANGE CHECK
# ============================================================================

print_section("13. FEATURE RANGE / BUSINESS SANITY CHECK")

range_checks = []

for column in feature_numeric_columns:

    series = df[column]

    range_checks.append(
        {
            "feature": column,
            "min": series.min(),
            "max": series.max(),
            "zero_count": int((series == 0).sum()),
            "negative_count": int((series < 0).sum()),
        }
    )

range_df = pd.DataFrame(range_checks)

print(
    range_df.to_string(index=False)
)

range_path = REPORT_DIR / "feature_range_check.csv"

range_df.to_csv(
    range_path,
    index=False
)

print()
print(
    f"[SAVED] Feature range report: {range_path}"
)


# ============================================================================
# 14. OCCUPANCY / VACANCY FEATURE CHECK
# ============================================================================

print_section("14. OCCUPANCY / VACANCY FEATURE CHECK")

occupancy_columns = [
    column
    for column in df.columns
    if "occupancy" in column.lower()
]

vacancy_columns = [
    column
    for column in df.columns
    if "vacancy" in column.lower()
]

print("Occupancy-related columns:")

for column in occupancy_columns:
    print(f"- {column}")

print()
print("Vacancy-related columns:")

for column in vacancy_columns:
    print(f"- {column}")

for column in occupancy_columns:

    minimum = df[column].min()
    maximum = df[column].max()

    if minimum >= 0 and maximum <= 1:
        print(
            f"[PASS] {column} is within 0-1 range"
        )
    else:
        print(
            f"[WARNING] {column} is outside expected 0-1 range: "
            f"min={minimum}, max={maximum}"
        )


# ============================================================================
# 15. FEATURE CATEGORIZATION
# ============================================================================

print_section("15. FEATURE CATEGORIZATION")

base_features = [
    "city",
    "size_sqft",
    "bedrooms_bhk",
    "property_age_years",
    "monthly_rent",
    "collected_rent",
    "expense_amount",
    "current_month_profit",
    "occupancy_rate",
    "estimated_vacancy_loss",
    "revenue_after_estimated_vacancy_loss",
]

rolling_features = [
    column
    for column in df.columns
    if "_3m_" in column
    or "_6m_" in column
    or column.endswith("_3m_avg")
    or column.endswith("_6m_avg")
    or column.endswith("_3m_sum")
    or column.endswith("_6m_sum")
]

trend_features = [
    column
    for column in df.columns
    if column.endswith("_trend")
]

print("Base/current-period features:")
for column in base_features:
    if column in df.columns:
        print(f"- {column}")

print()
print("Rolling historical features:")
for column in rolling_features:
    print(f"- {column}")

print()
print("Trend features:")
for column in trend_features:
    print(f"- {column}")

print()
print(
    f"Base/current features found: {len([x for x in base_features if x in df.columns])}"
)
print(f"Rolling features found: {len(rolling_features)}")
print(f"Trend features found: {len(trend_features)}")


# ============================================================================
# 16. EDA SUMMARY
# ============================================================================

print_section("16. FINAL EDA SUMMARY")

print("Dataset:")
print(f"- Rows: {len(df):,}")
print(f"- Properties: {df['property_id'].nunique():,}")
print(
    f"- Period: "
    f"{df['snapshot_month'].min().date()} "
    f"to "
    f"{df['snapshot_month'].max().date()}"
)

print()
print("Data quality:")
print(f"- Missing values: {missing_total:,}")
print(f"- Duplicate rows: {duplicate_rows:,}")
print(
    f"- Duplicate property-month rows: "
    f"{duplicate_property_month:,}"
)

print()
print("Regression target:")
print(f"- Target: {TARGET_REGRESSION}")
print(f"- Mean: {profit.mean():,.2f}")
print(f"- Median: {profit.median():,.2f}")
print(f"- Min: {profit.min():,.2f}")
print(f"- Max: {profit.max():,.2f}")

print()
print("Classification target:")
print(f"- Target: {TARGET_CLASSIFICATION}")
print(f"- Positive rate: {positive_rate:.2%}")

print()
print("Feature analysis:")
print(
    f"- Numeric model-candidate features: "
    f"{len(feature_numeric_columns)}"
)
print(
    f"- High-correlation feature pairs "
    f"(absolute correlation >= 0.90): "
    f"{len(high_corr_df)}"
)

print()
print("Generated reports:")
print(f"- {REPORT_DIR}")

print()
print("Generated plots:")
print(f"- {PLOT_DIR}")

print()
print("=" * 79)
print("EDA COMPLETE")
print("=" * 79)
print()
print(
    "No model training was performed."
)
print(
    "Review the EDA output before proceeding to preprocessing."
)
