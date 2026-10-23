
from pathlib import Path
import pandas as pd

# Read the ORIGINAL dataset, not the corrected copy.
DATA_PATH = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "ML"
    / "M3_Rental_Demand_Data.csv"
)

df = pd.read_csv(DATA_PATH)
df["year_month"] = pd.to_datetime(
    df["year_month"], errors="coerce"
).dt.to_period("M")

# Convert relevant fields for the audit only.
numeric_cols = [
    "application_count",
    "agreement_start_count",
    "property_count",
    "available_unit_count",
    "next_month_demand",
]

for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors="coerce")

print("\n=== DATASET OVERVIEW ===")
print("Rows:", len(df))
print("Date range:", df["year_month"].min(), "to", df["year_month"].max())
print("Missing application counts:", df["application_count"].isna().sum())
print("Negative application counts:", (df["application_count"] < 0).sum())

# Monthly audit across all cities/localities.
monthly = df.groupby("year_month", dropna=False).agg(
    rows=("application_count", "size"),
    missing_applications=("application_count", lambda s: s.isna().sum()),
    zero_applications=("application_count", lambda s: (s == 0).sum()),
    positive_applications=("application_count", lambda s: (s > 0).sum()),
    total_applications=("application_count", "sum"),
    total_agreements=("agreement_start_count", "sum"),
    total_properties=("property_count", "sum"),
    total_available_units=("available_unit_count", "sum"),
    target_zeros=("next_month_demand", lambda s: (s == 0).sum()),
)

monthly["zero_application_pct"] = (
    100 * monthly["zero_applications"] / monthly["rows"]
).round(2)

print("\n=== MONTHLY APPLICATION AUDIT ===")
print(monthly.to_string())

# Compare each locality with its previous month.
df = df.sort_values(["city", "area_locality", "year_month"])
groups = df.groupby(["city", "area_locality"], dropna=False)

df["previous_month"] = groups["year_month"].shift(1)
df["previous_applications"] = groups["application_count"].shift(1)

consecutive = (
    df["year_month"].astype("int64")
    - df["previous_month"].astype("int64")
    == 1
)

zero_after_positive = (
    consecutive
    & (df["application_count"] == 0)
    & (df["previous_applications"] > 0)
)

print("\n=== LOCALITY TRANSITIONS ===")
print(
    "Consecutive month comparisons:",
    int(consecutive.sum()),
)
print(
    "Zero applications following a positive month:",
    int(zero_after_positive.sum()),
)

# Save audit outputs separately; original data is not modified.
out_dir = Path(__file__).resolve().parent / "reports"
out_dir.mkdir(parents=True, exist_ok=True)

monthly.to_csv(out_dir / "application_count_monthly_audit.csv")
df.to_csv(out_dir / "application_count_transition_audit.csv", index=False)

print("\nAudit files saved in:", out_dir)
