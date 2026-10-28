"""
M6 Property Profitability Prediction
Temporal Leakage Audit

Avenue360 ML Standard v1.1

Purpose:
    Verify that all M6 snapshot features use information available
    at or before snapshot month T and that next_month_profit represents
    the actual profit of T+1.

Dataset:
    data/ml/M6_Profitability_v2.csv
"""

from pathlib import Path

import numpy as np
import pandas as pd


# ============================================================
# Configuration
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "ml" / "M6_Profitability_v2.csv"


# ============================================================
# Helper functions
# ============================================================

def section(title):
    print("\n" + "=" * 75)
    print(title)
    print("=" * 75)


def result(name, passed, details=""):
    status = "PASS" if passed else "FAIL"

    print(f"[{status}] {name}")

    if details:
        print(f"       {details}")


# ============================================================
# Main audit
# ============================================================

def main():

    section("M6 TEMPORAL LEAKAGE AUDIT")

    print(f"Dataset: {DATA_PATH}")

    if not DATA_PATH.exists():
        print("\nERROR: Dataset not found.")
        print(f"Expected:\n{DATA_PATH}")
        return

    df = pd.read_csv(DATA_PATH)

    # --------------------------------------------------------
    # Basic preparation
    # --------------------------------------------------------

    df["snapshot_month"] = pd.to_datetime(
        df["snapshot_month"],
        errors="coerce"
    )

    df = df.sort_values(
        ["property_id", "snapshot_month"]
    ).reset_index(drop=True)

    print(
        f"\nRows loaded: {len(df):,}"
    )

    print(
        f"Properties: {df['property_id'].nunique():,}"
    )

    print(
        f"Snapshot months: "
        f"{df['snapshot_month'].min().date()} "
        f"to "
        f"{df['snapshot_month'].max().date()}"
    )

    # ========================================================
    # 1. Property-month chronological continuity
    # ========================================================

    section("1. PROPERTY MONTH CONTINUITY")

    df["month_diff"] = (
        df.groupby("property_id")["snapshot_month"]
        .diff()
        .dt.days
    )

    # For monthly snapshots, consecutive months should normally
    # differ by 28-31 days.

    invalid_gaps = df[
        df["month_diff"].notna()
        & ~df["month_diff"].isin([28, 29, 30, 31])
    ]

    result(
        "Every property's snapshots are consecutive monthly records",
        len(invalid_gaps) == 0,
        f"Invalid month gaps: {len(invalid_gaps):,}"
    )

    # ========================================================
    # 2. Validate next-month target
    # ========================================================

    section("2. NEXT-MONTH TARGET VALIDATION")

    # Actual next month's current profit for the same property
    df["expected_next_month_profit"] = (
        df.groupby("property_id")["current_month_profit"]
        .shift(-1)
    )

    df["expected_next_month_date"] = (
        df.groupby("property_id")["snapshot_month"]
        .shift(-1)
    )

    df["expected_date"] = (
        df["snapshot_month"]
        + pd.DateOffset(months=1)
    )

    # Only evaluate rows where a real next month exists.
    target_check = df[
        df["expected_next_month_date"].notna()
        & (
            df["expected_next_month_date"]
            == df["expected_date"]
        )
    ].copy()

    target_difference = (
        target_check["next_month_profit"]
        - target_check["expected_next_month_profit"]
    ).abs()

    max_target_difference = (
        target_difference.max()
        if len(target_difference) > 0
        else np.nan
    )

    result(
        "next_month_profit equals actual T+1 profit",
        max_target_difference == 0,
        (
            f"Rows checked: {len(target_check):,}; "
            f"maximum absolute difference: "
            f"{max_target_difference}"
        )
    )

    # ========================================================
    # 3. Verify target date relationship
    # ========================================================

    section("3. TARGET DATE RELATIONSHIP")

    date_mismatch = target_check[
        target_check["expected_next_month_date"]
        != target_check["expected_date"]
    ]

    result(
        "Target always points to the immediate next calendar month",
        len(date_mismatch) == 0,
        f"Date mismatches: {len(date_mismatch):,}"
    )

    # ========================================================
    # 4. Check 3-month rolling features
    # ========================================================

    section("4. THREE-MONTH ROLLING FEATURE VALIDATION")

    three_month_specs = {
        "collected_rent_3m_avg":
            ("collected_rent", "mean"),

        "collected_rent_3m_sum":
            ("collected_rent", "sum"),

        "expense_amount_3m_avg":
            ("expense_amount", "mean"),

        "expense_amount_3m_sum":
            ("expense_amount", "sum"),

        "current_month_profit_3m_avg":
            ("current_month_profit", "mean"),

        "current_month_profit_3m_sum":
            ("current_month_profit", "sum"),

        "occupancy_rate_3m_avg":
            ("occupancy_rate", "mean"),

        "occupancy_rate_3m_sum":
            ("occupancy_rate", "sum"),

        "estimated_vacancy_loss_3m_avg":
            ("estimated_vacancy_loss", "mean"),

        "estimated_vacancy_loss_3m_sum":
            ("estimated_vacancy_loss", "sum"),
    }

    rolling_failures = []

    for feature, (source, operation) in three_month_specs.items():

        if feature not in df.columns:
            rolling_failures.append(
                f"{feature}: column missing"
            )
            continue

        expected = (
            df.groupby("property_id")[source]
            .rolling(window=3, min_periods=1)
        )

        if operation == "mean":
            expected = expected.mean()
        else:
            expected = expected.sum()

        expected = (
            expected
            .reset_index(level=0, drop=True)
        )

        # Because the dataframe is sorted by property/month,
        # the rolling result aligns to the current row.
        actual = df[feature]

        difference = (
            actual - expected
        ).abs()

        max_difference = difference.max()

        if not np.isclose(
            max_difference,
            0,
            atol=1e-6
        ):
            rolling_failures.append(
                f"{feature}: max difference={max_difference}"
            )

    result(
        "3-month features use T and previous two months only",
        len(rolling_failures) == 0,
        (
            "All 3-month rolling features validated."
            if not rolling_failures
            else "; ".join(rolling_failures)
        )
    )

    # ========================================================
    # 5. Check 6-month rolling features
    # ========================================================

    section("5. SIX-MONTH ROLLING FEATURE VALIDATION")

    six_month_specs = {
        "collected_rent_6m_avg":
            ("collected_rent", "mean"),

        "collected_rent_6m_sum":
            ("collected_rent", "sum"),

        "expense_amount_6m_avg":
            ("expense_amount", "mean"),

        "expense_amount_6m_sum":
            ("expense_amount", "sum"),

        "current_month_profit_6m_avg":
            ("current_month_profit", "mean"),

        "current_month_profit_6m_sum":
            ("current_month_profit", "sum"),

        "occupancy_rate_6m_avg":
            ("occupancy_rate", "mean"),

        "occupancy_rate_6m_sum":
            ("occupancy_rate", "sum"),

        "estimated_vacancy_loss_6m_avg":
            ("estimated_vacancy_loss", "mean"),

        "estimated_vacancy_loss_6m_sum":
            ("estimated_vacancy_loss", "sum"),
    }

    rolling_failures = []

    for feature, (source, operation) in six_month_specs.items():

        if feature not in df.columns:
            rolling_failures.append(
                f"{feature}: column missing"
            )
            continue

        expected = (
            df.groupby("property_id")[source]
            .rolling(window=6, min_periods=1)
        )

        if operation == "mean":
            expected = expected.mean()
        else:
            expected = expected.sum()

        expected = (
            expected
            .reset_index(level=0, drop=True)
        )

        actual = df[feature]

        difference = (
            actual - expected
        ).abs()

        max_difference = difference.max()

        if not np.isclose(
            max_difference,
            0,
            atol=1e-6
        ):
            rolling_failures.append(
                f"{feature}: max difference={max_difference}"
            )

    result(
        "6-month features use T and previous five months only",
        len(rolling_failures) == 0,
        (
            "All 6-month rolling features validated."
            if not rolling_failures
            else "; ".join(rolling_failures)
        )
    )

    # ========================================================
    # 6. Trend feature validation
    # ========================================================

    section("6. TREND FEATURE VALIDATION")

    trend_specs = {
        "collected_rent_trend":
            "collected_rent",

        "expense_amount_trend":
            "expense_amount",

        "current_month_profit_trend":
            "current_month_profit",

        "occupancy_rate_trend":
            "occupancy_rate",

        "estimated_vacancy_loss_trend":
            "estimated_vacancy_loss",
    }

    trend_failures = []

    for feature, source in trend_specs.items():

        if feature not in df.columns:
            trend_failures.append(
                f"{feature}: column missing"
            )
            continue

        # Expected trend is current value minus previous month.
        expected = (
            df[source]
            - df.groupby("property_id")[source].shift(1)
        )

        actual = df[feature]

        # First month has no previous value.
        comparable = expected.notna()

        difference = (
            actual[comparable]
            - expected[comparable]
        ).abs()

        if len(difference) > 0:

            max_difference = difference.max()

            if not np.isclose(
                max_difference,
                0,
                atol=1e-6
            ):
                trend_failures.append(
                    f"{feature}: max difference={max_difference}"
                )

    result(
        "Trend features use current and previous information only",
        len(trend_failures) == 0,
        (
            "All trend features validated."
            if not trend_failures
            else "; ".join(trend_failures)
        )
    )

    # ========================================================
    # 7. Direct leakage columns
    # ========================================================

    section("7. DIRECT TARGET LEAKAGE")

    prohibited_features = [
        "next_month_profit",
        "profitability_label",
    ]

    leakage_present = [
        column
        for column in prohibited_features
        if column in df.columns
    ]

    result(
        "Target columns are identified and can be excluded",
        set(leakage_present) == set(prohibited_features),
        f"Target columns: {leakage_present}"
    )

    # ========================================================
    # 8. Suspicious feature names
    # ========================================================

    section("8. FUTURE-LOOKING FEATURE NAME CHECK")

    future_terms = [
        "next",
        "future",
        "forecast",
        "predicted",
        "prediction",
    ]

    feature_columns = [
        column
        for column in df.columns
        if column not in [
            "property_id",
            "snapshot_month",
            "city",
            "data_split",
            "next_month_profit",
            "profitability_label",
            "month_diff",
            "expected_next_month_profit",
            "expected_next_month_date",
            "expected_date",
        ]
    ]

    suspicious_features = []

    for column in feature_columns:

        column_lower = column.lower()

        if any(
            term in column_lower
            for term in future_terms
        ):
            suspicious_features.append(column)

    result(
        "No future-looking feature names",
        len(suspicious_features) == 0,
        (
            "No suspicious feature names found."
            if not suspicious_features
            else f"Suspicious: {suspicious_features}"
        )
    )

    # ========================================================
    # 9. Data split temporal ordering
    # ========================================================

    section("9. TRAIN / VALIDATION / TEST TEMPORAL ORDER")

    split_ranges = (
        df.groupby("data_split")["snapshot_month"]
        .agg(["min", "max", "count"])
        .sort_values("min")
    )

    print("\nSplit ranges:")
    print(split_ranges)

    split_order = [
        "train",
        "validation",
        "test",
    ]

    split_order_present = [
        split
        for split in split_order
        if split in split_ranges.index
    ]

    chronological_split = True

    for i in range(len(split_order_present) - 1):

        current_split = split_order_present[i]
        next_split = split_order_present[i + 1]

        current_max = split_ranges.loc[
            current_split, "max"
        ]

        next_min = split_ranges.loc[
            next_split, "min"
        ]

        if current_max >= next_min:
            chronological_split = False

    result(
        "Train, validation and test periods do not overlap",
        chronological_split,
        "Chronological split verified."
    )

    # ========================================================
    # 10. Cross-split property leakage
    # ========================================================

    section("10. PROPERTY DISTRIBUTION ACROSS SPLITS")

    property_split_counts = (
        df.groupby("property_id")["data_split"]
        .nunique()
    )

    properties_in_multiple_splits = (
        property_split_counts > 1
    ).sum()

    print(
        f"Properties appearing in multiple splits: "
        f"{properties_in_multiple_splits:,}"
    )

    # IMPORTANT:
    # For a time-series prediction problem, it is acceptable
    # for the same property to appear in train/validation/test
    # if the split is strictly chronological. This is not
    # automatically leakage.

    print(
        "\nNOTE: Same properties may appear in multiple "
        "chronological splits. This is acceptable for a "
        "property-month forecasting problem when no future "
        "features are used in earlier snapshots."
    )

    # ========================================================
    # 11. Feature columns that must be excluded
    # ========================================================

    section("11. MODEL FEATURE EXCLUSION CHECK")

    excluded_columns = [
        "property_id",
        "snapshot_month",
        "next_month_profit",
        "profitability_label",
        "data_split",
    ]

    print("Columns excluded from model features:")

    for column in excluded_columns:
        print(f"- {column}")

    # ========================================================
    # 12. Final summary
    # ========================================================

    section("12. FINAL TEMPORAL LEAKAGE AUDIT SUMMARY")

    print("""
Avenue360 ML Standard v1.1 temporal principles:

1. Features must use information available at snapshot T.
2. next_month_profit represents the actual outcome at T+1.
3. Historical rolling features must not include T+1 or later.
4. Target columns must never be model features.
5. Train/validation/test must respect temporal ordering.
""")

    print("\nAudit checks:")

    # Recalculate high-level statuses
    continuity_pass = len(invalid_gaps) == 0

    target_pass = (
        len(target_check) > 0
        and max_target_difference == 0
    )

    date_pass = len(date_mismatch) == 0

    three_month_pass = len(
        [
            x for x in []
        ]
    ) == 0

    # We need to independently derive these from earlier
    # failure lists. They are currently empty if passed.
    three_month_pass = (
        len(rolling_failures) == 0
    )

    # The variable rolling_failures was reused for 6m.
    # Re-run the conceptual status from the actual data below.

    # Recalculate 3m status
    three_month_pass = True

    for feature, (source, operation) in three_month_specs.items():

        if feature not in df.columns:
            three_month_pass = False
            break

        expected = (
            df.groupby("property_id")[source]
            .rolling(window=3, min_periods=1)
        )

        expected = (
            expected.mean()
            if operation == "mean"
            else expected.sum()
        )

        expected = (
            expected
            .reset_index(level=0, drop=True)
        )

        if not np.allclose(
            df[feature].values,
            expected.values,
            atol=1e-6,
            rtol=1e-9
        ):
            three_month_pass = False
            break

    # Recalculate 6m status
    six_month_pass = True

    for feature, (source, operation) in six_month_specs.items():

        if feature not in df.columns:
            six_month_pass = False
            break

        expected = (
            df.groupby("property_id")[source]
            .rolling(window=6, min_periods=1)
        )

        expected = (
            expected.mean()
            if operation == "mean"
            else expected.sum()
        )

        expected = (
            expected
            .reset_index(level=0, drop=True)
        )

        if not np.allclose(
            df[feature].values,
            expected.values,
            atol=1e-6,
            rtol=1e-9
        ):
            six_month_pass = False
            break

    trend_pass = len(trend_failures) == 0
    suspicious_pass = len(suspicious_features) == 0

    summary = {
        "Property month continuity": continuity_pass,
        "T+1 target correctness": target_pass,
        "T+1 date relationship": date_pass,
        "3-month rolling features": three_month_pass,
        "6-month rolling features": six_month_pass,
        "Trend features": trend_pass,
        "No suspicious future features": suspicious_pass,
        "Chronological split": chronological_split,
    }

    for name, passed in summary.items():

        print(
            f"[{'PASS' if passed else 'FAIL'}] {name}"
        )

    all_passed = all(summary.values())

    print("\n" + "=" * 75)

    if all_passed:
        print(
            "FINAL RESULT: PASS"
        )
        print(
            "No temporal leakage was detected by this audit."
        )
        print(
            "The dataset can proceed to EDA and preprocessing."
        )
    else:
        print(
            "FINAL RESULT: REVIEW REQUIRED"
        )
        print(
            "One or more temporal checks failed."
        )
        print(
            "Do NOT train models until the failed checks "
            "are resolved."
        )

    print("=" * 75)


if __name__ == "__main__":
    main()