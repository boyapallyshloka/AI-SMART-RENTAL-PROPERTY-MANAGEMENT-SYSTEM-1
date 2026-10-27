
from pathlib import Path
import json

import pandas as pd

from config import (
    DATASET_PATH,
    REPORTS_DIR,
    DATE_COLUMN,
    TARGET_COLUMN,
)

REQUIRED_COLUMNS = [
    "city",
    "area_locality",
    "year_month",
    "property_count",
    "application_count",
    "agreement_start_count",
    "average_monthly_rent",
    "demand_lag_1_month",
    "demand_lag_2_month",
    "demand_growth_1_month",
    "next_month_demand",
    "occupancy_rate",
    "vacancy_rate",
    "available_unit_count",
]

NUMERIC_COLUMNS = [
    "property_count",
    "application_count",
    "agreement_start_count",
    "average_monthly_rent",
    "demand_lag_1_month",
    "demand_lag_2_month",
    "demand_growth_1_month",
    "next_month_demand",
    "occupancy_rate",
    "vacancy_rate",
    "available_unit_count",
]


def audit_dataset():
    """Inspect the original dataset without modifying it."""

    print("=" * 65)
    print("M3 RENTAL DEMAND - DATA AUDIT")
    print("=" * 65)

    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATASET_PATH}"
        )

    df = pd.read_csv(DATASET_PATH)

    print(f"\nDataset path: {DATASET_PATH}")
    print(f"Rows: {len(df):,}")
    print(f"Columns: {len(df.columns)}")

    # Check required columns
    missing_columns = [
        col for col in REQUIRED_COLUMNS
        if col not in df.columns
    ]

    extra_columns = [
        col for col in df.columns
        if col not in REQUIRED_COLUMNS
    ]

    print("\n--- COLUMN VALIDATION ---")
    print("Missing required columns:", missing_columns)
    print("Unexpected extra columns:", extra_columns)

    if missing_columns:
        raise ValueError(
            f"Dataset is missing required columns: {missing_columns}"
        )

    # Check missing values
    print("\n--- MISSING VALUES ---")
    missing_counts = df.isnull().sum()
    print(missing_counts.to_string())

    # Check duplicate records
    print("\n--- DUPLICATE RECORDS ---")
    print("Exact duplicate rows:", int(df.duplicated().sum()))

    # Check monthly date values
    parsed_dates = pd.to_datetime(
        df[DATE_COLUMN],
        format="%Y-%m",
        errors="coerce",
    )

    print("\n--- DATE VALIDATION ---")
    print("Invalid dates:", int(parsed_dates.isna().sum()))

    if parsed_dates.notna().any():
        print("Earliest month:", parsed_dates.min())
        print("Latest month:", parsed_dates.max())

    # Check numeric columns
    print("\n--- NUMERIC VALIDATION ---")

    numeric_df = df[NUMERIC_COLUMNS].apply(
        pd.to_numeric,
        errors="coerce",
    )

    for column in NUMERIC_COLUMNS:
        invalid_count = int(
            numeric_df[column].isna().sum()
        )
        negative_count = int(
            (numeric_df[column].dropna() < 0).sum()
        )

        print(
            f"{column}: "
            f"invalid/non-numeric={invalid_count}, "
            f"negative={negative_count}"
        )

    # Inspect target distribution
    print("\n--- TARGET DISTRIBUTION ---")

    target = numeric_df[TARGET_COLUMN]

    if target.notna().any():
        print(target.describe().to_string())
        print("Zero-demand rows:", int((target == 0).sum()))
        print("Unique target values:", int(target.nunique()))

    # Check duplicate city-locality-month combinations
    print("\n--- LOCATION-MONTH VALIDATION ---")

    key_columns = ["city", "area_locality", DATE_COLUMN]

    duplicate_keys = int(
        df.duplicated(subset=key_columns, keep=False).sum()
    )

    print(
        "Rows sharing a city/locality/month key:",
        duplicate_keys,
    )

    # Inspect numeric ranges
    print("\n--- NUMERIC SUMMARY ---")
    print(numeric_df.describe().round(3).to_string())

    # Save audit reports
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    missing_counts.rename("missing_count").to_csv(
        REPORTS_DIR / "missing_values.csv"
    )

    numeric_df.describe().T.to_csv(
        REPORTS_DIR / "numeric_summary.csv"
    )

    summary = {
        "dataset_path": str(DATASET_PATH),
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "missing_columns": missing_columns,
        "extra_columns": extra_columns,
        "exact_duplicate_rows": int(df.duplicated().sum()),
        "invalid_dates": int(parsed_dates.isna().sum()),
        "duplicate_location_month_rows": duplicate_keys,
        "target_column": TARGET_COLUMN,
        "target_missing_values": int(target.isna().sum()),
    }

    with open(
        REPORTS_DIR / "data_audit.json",
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(summary, file, indent=4)

    print("\n--- REPORTS SAVED ---")
    print("Reports directory:", REPORTS_DIR)
    print(" - data_audit.json")
    print(" - missing_values.csv")
    print(" - numeric_summary.csv")

    print("\nData audit completed.")


if __name__ == "__main__":
    audit_dataset()
