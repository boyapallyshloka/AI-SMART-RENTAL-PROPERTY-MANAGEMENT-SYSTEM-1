import pandas as pd
import numpy as np

from config import DATA_PATH


# ============================================================
# LOAD DATA
# ============================================================

df = pd.read_csv(DATA_PATH)

df["snapshot_month"] = pd.to_datetime(
    df["snapshot_month"],
    format="%Y-%m"
)

COST = "next_month_maintenance_cost"
COUNT = "next_month_maintenance_count"


print("=" * 80)
print("M5 PREDICTIVE MAINTENANCE - COST TARGET AUDIT")
print("=" * 80)


# ============================================================
# 1. BASIC TARGET INFORMATION
# ============================================================

print("\n" + "=" * 80)
print("1. COST TARGET DISTRIBUTION")
print("=" * 80)

print(f"Total records       : {len(df)}")
print(f"Zero-cost records   : {(df[COST] == 0).sum()}")
print(f"Positive-cost records: {(df[COST] > 0).sum()}")
print(
    f"Positive percentage : {(df[COST] > 0).mean() * 100:.2f}%"
)

print("\nOverall cost statistics:")
print(df[COST].describe())


# ============================================================
# 2. POSITIVE COST DISTRIBUTION
# ============================================================

positive = df[df[COST] > 0].copy()

print("\n" + "=" * 80)
print("2. POSITIVE MAINTENANCE COST DISTRIBUTION")
print("=" * 80)

print(f"Positive records: {len(positive)}")

print("\nQuantiles:")
print(
    positive[COST].quantile(
        [0.00, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99, 1.00]
    )
)


# ============================================================
# 3. COST BY MAINTENANCE COUNT
# ============================================================

print("\n" + "=" * 80)
print("3. COST BY NEXT-MONTH MAINTENANCE COUNT")
print("=" * 80)

cost_by_count = df.groupby(COUNT)[COST].agg(
    ["count", "mean", "median", "std", "min", "max"]
)

print(cost_by_count)


# ============================================================
# 4. COST PER MAINTENANCE EVENT
# ============================================================

positive["cost_per_event"] = (
    positive[COST] / positive[COUNT]
)

print("\n" + "=" * 80)
print("4. COST PER MAINTENANCE EVENT")
print("=" * 80)

print(
    positive["cost_per_event"].describe(
        percentiles=[0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99]
    )
)


# ============================================================
# 5. CORRELATION WITH AVAILABLE FEATURES
# ============================================================

print("\n" + "=" * 80)
print("5. CORRELATION WITH COST TARGET")
print("=" * 80)

numeric_features = [
    "property_age_years",
    "size_sqft",
    "bedrooms_bhk",
    "amenity_count",
    "historical_maintenance_count",
    "maintenance_count_last_90d",
    "historical_maintenance_cost",
    "historical_avg_cost",
    "days_since_last_maintenance",
    "inspection_count",
    "needs_attention_count",
    "equipment_count",
    "avg_equipment_age_years",
    "critical_equipment_count",
    COUNT,
]

correlations = (
    df[numeric_features + [COST]]
    .corr(numeric_only=True)[COST]
    .sort_values(ascending=False)
)

print(correlations)


# ============================================================
# 6. COST BY ISSUE CATEGORY
# ============================================================

print("\n" + "=" * 80)
print("6. COST BY ISSUE CATEGORY")
print("=" * 80)

category_stats = df.groupby("dominant_issue_category")[COST].agg(
    ["count", "mean", "median", "std", "min", "max"]
)

print(category_stats)


# ============================================================
# 7. COST BY PROPERTY AGE
# ============================================================

print("\n" + "=" * 80)
print("7. COST BY PROPERTY AGE")
print("=" * 80)

df["age_group"] = pd.cut(
    df["property_age_years"],
    bins=[-1, 5, 10, 20, 100],
    labels=["0-5", "6-10", "11-20", "20+"]
)

age_stats = df.groupby(
    "age_group",
    observed=False
)[COST].agg(
    ["count", "mean", "median", "std"]
)

print(age_stats)


# ============================================================
# 8. HISTORICAL COST VS FUTURE COST
# ============================================================

print("\n" + "=" * 80)
print("8. HISTORICAL COST VS NEXT-MONTH COST")
print("=" * 80)

print(
    "Correlation:",
    df["historical_maintenance_cost"].corr(
        df[COST]
    )
)

print(
    "Historical average cost correlation:",
    df["historical_avg_cost"].corr(
        df[COST]
    )
)


# ============================================================
# 9. TRAIN / VALIDATION / TEST TARGET SHIFT
# ============================================================

print("\n" + "=" * 80)
print("9. COST DISTRIBUTION BY TIME SPLIT")
print("=" * 80)

train = df[df["snapshot_month"] <= "2025-06-01"]

validation = df[
    (df["snapshot_month"] >= "2025-07-01")
    & (df["snapshot_month"] <= "2025-09-01")
]

test = df[df["snapshot_month"] >= "2025-10-01"]


def print_split_stats(name, data):
    print(f"\n{name}")
    print("-" * 40)
    print(f"Records          : {len(data)}")
    print(
        f"Positive %       : {(data[COST] > 0).mean() * 100:.2f}%"
    )
    print(f"Mean cost        : {data[COST].mean():.2f}")
    print(f"Median cost      : {data[COST].median():.2f}")
    print(f"Positive mean    : {data.loc[data[COST] > 0, COST].mean():.2f}")
    print(f"Positive median  : {data.loc[data[COST] > 0, COST].median():.2f}")


print_split_stats("TRAIN", train)
print_split_stats("VALIDATION", validation)
print_split_stats("TEST", test)


# ============================================================
# 10. SAMPLE POSITIVE RECORDS
# ============================================================

print("\n" + "=" * 80)
print("10. SAMPLE POSITIVE-COST RECORDS")
print("=" * 80)

sample_columns = [
    "property_id",
    "snapshot_month",
    "property_age_years",
    "size_sqft",
    "historical_maintenance_count",
    "maintenance_count_last_90d",
    "historical_maintenance_cost",
    "historical_avg_cost",
    "days_since_last_maintenance",
    "dominant_issue_category",
    "equipment_count",
    "avg_equipment_age_years",
    "critical_equipment_count",
    COUNT,
    COST,
]

print(
    positive[
        sample_columns
    ].head(20).to_string(index=False)
)


# ============================================================
# FINAL
# ============================================================

print("\n" + "=" * 80)
print("COST TARGET AUDIT COMPLETE")
print("=" * 80)