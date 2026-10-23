import pandas as pd

DATA_PATH = "../data/ml/M3_Rental_Demand_Data.csv"

def run_eda():
    df = pd.read_csv(DATA_PATH)

    print("Target distribution:")
    print(df["next_month_demand"].value_counts().sort_index())
    zero_pct = (df["next_month_demand"] == 0).mean() * 100
    print(f"\n% of rows with zero demand: {zero_pct:.1f}%")

    print("\nCorrelation with target:")
    numeric_cols = [
        "property_count", "application_count", "agreement_start_count",
        "average_monthly_rent", "demand_lag_1_month", "demand_lag_2_month",
        "demand_growth_1_month", "occupancy_rate", "vacancy_rate",
        "available_unit_count"
    ]
    corr = df[numeric_cols + ["next_month_demand"]].corr()["next_month_demand"].sort_values(ascending=False)
    print(corr)

    df["month"] = df["year_month"].str.split("-").str[1].astype(int)
    print("\nAverage demand by month (seasonality check):")
    print(df.groupby("month")["next_month_demand"].mean())

if __name__ == "__main__":
    run_eda()