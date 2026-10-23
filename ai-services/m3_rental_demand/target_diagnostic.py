
import pandas as pd

from config import DATASET_PATH, DATE_COLUMN, TARGET_COLUMN


def main():
    df = pd.read_csv(DATASET_PATH)

    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN],
        format="%Y-%m",
        errors="raise",
    )

    df[TARGET_COLUMN] = pd.to_numeric(
        df[TARGET_COLUMN],
        errors="raise",
    )

    # Summarize target values for each month
    monthly = df.groupby(DATE_COLUMN).agg(
        rows=(TARGET_COLUMN, "size"),
        target_sum=(TARGET_COLUMN, "sum"),
        target_mean=(TARGET_COLUMN, "mean"),
        zero_targets=(
            TARGET_COLUMN,
            lambda s: int((s == 0).sum()),
        ),
        positive_targets=(
            TARGET_COLUMN,
            lambda s: int((s > 0).sum()),
        ),
    )

    monthly["zero_percentage"] = (
        monthly["zero_targets"] / monthly["rows"] * 100
    ).round(2)

    print("\n--- MONTHLY TARGET DIAGNOSTIC ---")
    print(monthly.to_string())

    # Inspect target values alongside the following month's
    # agreement counts for the same city and locality.
    keys = ["city", "area_locality"]

    df = df.sort_values(keys + [DATE_COLUMN]).copy()

    df["following_month"] = (
        df.groupby(keys)[DATE_COLUMN].shift(-1)
    )

    df["following_agreements"] = (
        df.groupby(keys)["agreement_start_count"].shift(-1)
    )

    expected_next_month = (
        df[DATE_COLUMN] + pd.offsets.MonthBegin(1)
    )

    valid = (
        df["following_month"].eq(expected_next_month)
        & df["following_agreements"].notna()
    )

    comparison = df.loc[
        valid,
        [
            DATE_COLUMN,
            TARGET_COLUMN,
            "following_agreements",
        ],
    ].copy()

    comparison["matches"] = (
        comparison[TARGET_COLUMN]
        == comparison["following_agreements"]
    )

    print("\n--- TARGET VS FOLLOWING-MONTH AGREEMENTS ---")
    print(
        comparison.groupby(DATE_COLUMN).agg(
            rows=("matches", "size"),
            matches=("matches", "sum"),
            target_sum=(TARGET_COLUMN, "sum"),
            following_agreements_sum=(
                "following_agreements", "sum"
            ),
        ).to_string()
    )

    print("\n--- SAMPLE ROWS FROM LATE 2025 AND 2026 ---")
    print(
        df.loc[
            df[DATE_COLUMN] >= "2025-11-01",
            [
                "city",
                "area_locality",
                DATE_COLUMN,
                "application_count",
                "agreement_start_count",
                "demand_lag_1_month",
                "demand_lag_2_month",
                TARGET_COLUMN,
            ],
        ].head(20).to_string(index=False)
    )


if __name__ == "__main__":
    main()
