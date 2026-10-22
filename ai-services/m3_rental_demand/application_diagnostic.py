
import pandas as pd
from config import DATASET_PATH, DATE_COLUMN

def main():
    df = pd.read_csv(DATASET_PATH)
    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN], format="%Y-%m", errors="raise"
    )

    numeric_columns = [
        "application_count",
        "agreement_start_count",
        "property_count",
        "available_unit_count",
    ]

    for col in numeric_columns:
        df[col] = pd.to_numeric(df[col], errors="raise")

    monthly = df.groupby(DATE_COLUMN).agg(
        rows=("application_count", "size"),
        application_sum=("application_count", "sum"),
        application_mean=("application_count", "mean"),
        application_positive=("application_count", lambda s: int((s > 0).sum())),
        application_zero=("application_count", lambda s: int((s == 0).sum())),
        agreement_sum=("agreement_start_count", "sum"),
        properties_sum=("property_count", "sum"),
        available_units_sum=("available_unit_count", "sum"),
    )

    monthly["application_zero_pct"] = (
        monthly["application_zero"] / monthly["rows"] * 100
    ).round(2)

    print("\n--- MONTHLY SOURCE FEATURE DIAGNOSTIC ---")
    print(monthly.to_string())

    print("\n--- SAMPLE ROWS FROM NOVEMBER 2025 ONWARD ---")
    print(
        df.loc[df[DATE_COLUMN] >= "2025-11-01", [
            "city",
            "area_locality",
            DATE_COLUMN,
            "application_count",
            "agreement_start_count",
            "property_count",
            "available_unit_count",
        ]].head(30).to_string(index=False)
    )

if __name__ == "__main__":
    main()
