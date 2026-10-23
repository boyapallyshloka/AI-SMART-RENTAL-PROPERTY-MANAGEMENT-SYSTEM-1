import pandas as pd

DATA_PATH = "../data/ml/M3_Rental_Demand_Data.csv"

def run_audit():
    df = pd.read_csv(DATA_PATH)
    print(df.columns.tolist())

    print("Shape:", df.shape)
    print("\nMissing values:\n", df.isnull().sum())
    print("\nDuplicate rows:", df.duplicated().sum())

    print("\nyear_month range:", df["year_month"].min(), "to", df["year_month"].max())
    print("Unique months:", sorted(df["year_month"].unique()))

    numeric_cols = [
        "property_count", "application_count", "agreement_start_count",
        "average_monthly_rent", "demand_lag_1_month", "demand_lag_2_month",
        "occupancy_rate", "vacancy_rate", "available_unit_count", "next_month_demand"
    ]
    print("\nNegative value check:")
    for col in numeric_cols:
        neg_count = (df[col] < 0).sum()
        if neg_count > 0:
            print(f"  WARNING: {col} has {neg_count} negative values")

    print("\nnext_month_demand summary:\n", df["next_month_demand"].describe())

if __name__ == "__main__":
    run_audit()