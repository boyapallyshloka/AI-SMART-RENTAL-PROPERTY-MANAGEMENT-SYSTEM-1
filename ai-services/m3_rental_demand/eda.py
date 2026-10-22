
import pandas as pd
import matplotlib.pyplot as plt

from config import (
    DATASET_PATH,
    PLOTS_DIR,
    REPORTS_DIR,
    DATE_COLUMN,
    TARGET_COLUMN,
)


def run_eda():
    print("=" * 65)
    print("M3 RENTAL DEMAND - EXPLORATORY DATA ANALYSIS")
    print("=" * 65)

    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATASET_PATH}"
        )

    df = pd.read_csv(DATASET_PATH)

    # Parse the monthly date
    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN],
        format="%Y-%m",
        errors="raise",
    )

    # Create output folders
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Target distribution
    print("\n--- TARGET VALUE COUNTS ---")
    target_counts = (
        df[TARGET_COLUMN]
        .value_counts()
        .sort_index()
    )
    print(target_counts.to_string())

    target_counts.rename_axis(TARGET_COLUMN).to_csv(
        REPORTS_DIR / "target_distribution.csv"
    )

    print("\nZero-demand percentage:")
    print(
        round(
            (df[TARGET_COLUMN] == 0).mean() * 100,
            2,
        ),
        "%",
    )

    # 2. Demand by historical month
    print("\n--- MONTHLY DATA COVERAGE ---")

    monthly_rows = (
        df.groupby(DATE_COLUMN)
        .size()
        .rename("row_count")
    )

    monthly_rows.to_csv(
        REPORTS_DIR / "monthly_data_coverage.csv"
    )

    print(monthly_rows.to_string())

    # 3. Demand distribution by month
    monthly_demand = (
        df.groupby(DATE_COLUMN)[TARGET_COLUMN]
        .agg(["count", "mean", "sum"])
    )

    monthly_demand.to_csv(
        REPORTS_DIR / "monthly_demand_summary.csv"
    )

    print("\n--- MONTHLY TARGET SUMMARY ---")
    print(monthly_demand.to_string())

    # 4. Compare potentially related columns
    print("\n--- FEATURE RELATIONSHIP CHECKS ---")

    comparisons = [
        ("application_count", "demand_lag_1_month"),
        ("application_count", "demand_lag_2_month"),
        ("demand_lag_1_month", "demand_lag_2_month"),
    ]

    for first, second in comparisons:
        same = int((df[first] == df[second]).sum())
        print(
            f"{first} == {second}: "
            f"{same:,} / {len(df):,} rows"
        )

    correlations = df[
        [
            "application_count",
            "agreement_start_count",
            "demand_lag_1_month",
            "demand_lag_2_month",
            "demand_growth_1_month",
            TARGET_COLUMN,
        ]
    ].corr()

    correlations.to_csv(
        REPORTS_DIR / "feature_target_correlations.csv"
    )

    print("\n--- CORRELATIONS ---")
    print(correlations.round(3).to_string())

    # 5. Check the meaning of next-month demand
    print("\n--- NEXT-MONTH TARGET ALIGNMENT ---")

    ordered = df.sort_values(
        ["city", "area_locality", DATE_COLUMN]
    ).copy()

    group_columns = ["city", "area_locality"]

    ordered["following_month"] = (
        ordered.groupby(group_columns)[DATE_COLUMN]
        .shift(-1)
    )

    ordered["following_agreements"] = (
        ordered.groupby(group_columns)[
            "agreement_start_count"
        ].shift(-1)
    )

    # Compare only consecutive calendar months
    consecutive = (
        ordered["following_month"]
        == ordered[DATE_COLUMN] + pd.offsets.MonthBegin(1)
    )

    valid = (
        consecutive
        & ordered["following_agreements"].notna()
    )

    if valid.any():
        actual_target = ordered.loc[valid, TARGET_COLUMN]
        following_agreements = ordered.loc[
            valid, "following_agreements"
        ]

        exact_matches = int(
            (
                actual_target.to_numpy()
                == following_agreements.to_numpy()
            ).sum()
        )

        print("Consecutive month pairs:", int(valid.sum()))
        print("Target equals following month's agreements:",
              exact_matches)
        print(
            "Exact match rate:",
            round(exact_matches / int(valid.sum()) * 100, 2),
            "%",
        )
    else:
        print("No consecutive monthly pairs found.")

    # 6. Plot target distribution
    plt.figure(figsize=(9, 5))
    target_counts.plot(kind="bar")
    plt.title("Distribution of Next-Month Rental Demand")
    plt.xlabel("Next-Month Demand")
    plt.ylabel("Number of Records")
    plt.tight_layout()
    plt.savefig(
        PLOTS_DIR / "target_distribution.png",
        dpi=150,
    )
    plt.close()

    # 7. Plot average demand over time
    plt.figure(figsize=(10, 5))
    monthly_demand["mean"].plot(marker="o")
    plt.title("Average Predicted-Target Demand by Month")
    plt.xlabel("Historical Month")
    plt.ylabel("Average Next-Month Demand")
    plt.tight_layout()
    plt.savefig(
        PLOTS_DIR / "monthly_demand.png",
        dpi=150,
    )
    plt.close()

    print("\n--- OUTPUTS SAVED ---")
    print("Reports:", REPORTS_DIR)
    print("Plots:", PLOTS_DIR)
    print("EDA completed successfully.")


if __name__ == "__main__":
    run_eda()
