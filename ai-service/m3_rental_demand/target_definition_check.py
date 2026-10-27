
import pandas as pd
from config import DATASET_PATH, DATE_COLUMN, TARGET_COLUMN

def main():
    df = pd.read_csv(DATASET_PATH)

    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN], format="%Y-%m", errors="raise"
    )

    numeric_cols = [
        TARGET_COLUMN,
        "application_count",
        "agreement_start_count",
    ]

    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="raise")

    keys = ["city", "area_locality"]
    df = df.sort_values(keys + [DATE_COLUMN]).copy()

    grouped = df.groupby(keys, sort=False)

    df["following_month"] = grouped[DATE_COLUMN].shift(-1)
    df["next_month_applications"] = grouped["application_count"].shift(-1)
    df["next_month_agreements"] = grouped["agreement_start_count"].shift(-1)

    expected_month = df[DATE_COLUMN] + pd.offsets.MonthBegin(1)

    # Compare only rows with a genuine consecutive next month.
    valid = (
        df["following_month"].eq(expected_month)
        & df["next_month_applications"].notna()
        & df["next_month_agreements"].notna()
    )

    df["valid_next_month"] = valid

    print("\n--- DATASET COVERAGE ---")
    print("Total rows:", len(df))
    print("Rows with a consecutive next month:", int(valid.sum()))
    print("Rows without a consecutive next month:", int((~valid).sum()))

    print("\n--- TARGET COMPARISON ---")
    comparisons = {
        "Current application_count": "application_count",
        "Next month's application_count": "next_month_applications",
        "Next month's agreement_start_count": "next_month_agreements",
    }

    for label, col in comparisons.items():
        mask = valid & df[col].notna()
        matches = df.loc[mask, TARGET_COLUMN].eq(df.loc[mask, col])

        print(
            f"{label}: "
            f"{int(matches.sum())}/{int(mask.sum())} exact matches"
        )

    print("\n--- ZERO TARGET WITH FUTURE ACTIVITY ---")
    future_activity = (
        df["next_month_applications"].fillna(0).gt(0)
        | df["next_month_agreements"].fillna(0).gt(0)
    )

    mask = valid & df[TARGET_COLUMN].eq(0) & future_activity

    print("Zero-target rows with future applications or agreements:", int(mask.sum()))
    print(
        df.loc[mask, [
            "city",
            "area_locality",
            DATE_COLUMN,
            "application_count",
            "agreement_start_count",
            "next_month_applications",
            "next_month_agreements",
            TARGET_COLUMN,
        ]].tail(20).to_string(index=False)
    )

    print("\n--- TARGET AND FUTURE ACTIVITY BY MONTH ---")
    monthly = df.loc[valid].groupby(DATE_COLUMN).agg(
        target_sum=(TARGET_COLUMN, "sum"),
        current_applications=("application_count", "sum"),
        next_month_applications=("next_month_applications", "sum"),
        next_month_agreements=("next_month_agreements", "sum"),
    )

    print(monthly.tail(10).to_string())

if __name__ == "__main__":
    main()
