"""
M6 Property Profitability Prediction
Dataset Audit and Validation

Avenue360 ML Standard v1.1
"""

from pathlib import Path
import pandas as pd
import numpy as np


# ============================================================
# Configuration
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "ml" / "M6_Profitability_v2.csv"


# ============================================================
# Helper
# ============================================================

def print_section(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


# ============================================================
# Main Audit
# ============================================================

def main():

    print_section("M6 PROPERTY PROFITABILITY DATASET AUDIT")

    print(f"Dataset path: {DATA_PATH}")

    if not DATA_PATH.exists():
        print("\nERROR: Dataset file not found.")
        print(f"Expected location:\n{DATA_PATH}")
        return

    df = pd.read_csv(DATA_PATH)

    # --------------------------------------------------------
    # 1. Basic information
    # --------------------------------------------------------

    print_section("1. BASIC DATASET INFORMATION")

    print(f"Rows    : {df.shape[0]:,}")
    print(f"Columns : {df.shape[1]}")

    print("\nColumns:")
    for i, column in enumerate(df.columns, start=1):
        print(f"{i:2}. {column}")

    # --------------------------------------------------------
    # 2. Data types
    # --------------------------------------------------------

    print_section("2. DATA TYPES")

    print(df.dtypes)

    # --------------------------------------------------------
    # 3. Missing values
    # --------------------------------------------------------

    print_section("3. MISSING VALUES")

    missing = df.isnull().sum()

    if missing.sum() == 0:
        print("PASS: No missing values.")
    else:
        print("WARNING: Missing values found:")
        print(missing[missing > 0])

    # --------------------------------------------------------
    # 4. Duplicate rows
    # --------------------------------------------------------

    print_section("4. DUPLICATE CHECK")

    duplicate_rows = df.duplicated().sum()

    print(f"Duplicate complete rows: {duplicate_rows:,}")

    if duplicate_rows == 0:
        print("PASS: No duplicate complete rows.")
    else:
        print("WARNING: Duplicate rows exist.")

    # --------------------------------------------------------
    # 5. Property-month uniqueness
    # --------------------------------------------------------

    print_section("5. PROPERTY-MONTH UNIQUENESS")

    required_keys = ["property_id", "snapshot_month"]

    if all(column in df.columns for column in required_keys):

        duplicate_property_month = (
            df.duplicated(
                subset=["property_id", "snapshot_month"]
            ).sum()
        )

        print(
            "Duplicate property + snapshot_month rows:",
            duplicate_property_month
        )

        if duplicate_property_month == 0:
            print("PASS: One row per property per snapshot month.")
        else:
            print("WARNING: Duplicate property-month records found.")

    # --------------------------------------------------------
    # 6. Property count
    # --------------------------------------------------------

    print_section("6. PROPERTY COVERAGE")

    if "property_id" in df.columns:

        print(
            f"Unique properties: "
            f"{df['property_id'].nunique():,}"
        )

        print(
            f"Rows per property - min: "
            f"{df.groupby('property_id').size().min()}"
        )

        print(
            f"Rows per property - max: "
            f"{df.groupby('property_id').size().max()}"
        )

    # --------------------------------------------------------
    # 7. Date coverage
    # --------------------------------------------------------

    print_section("7. TEMPORAL COVERAGE")

    if "snapshot_month" in df.columns:

        df["snapshot_month"] = pd.to_datetime(
            df["snapshot_month"],
            errors="coerce"
        )

        print(
            f"Minimum snapshot month: "
            f"{df['snapshot_month'].min()}"
        )

        print(
            f"Maximum snapshot month: "
            f"{df['snapshot_month'].max()}"
        )

        print(
            f"Unique snapshot months: "
            f"{df['snapshot_month'].nunique()}"
        )

        print("\nRecords by month:")

        monthly_counts = (
            df.groupby("snapshot_month")
            .size()
            .sort_index()
        )

        print(monthly_counts.to_string())

    # --------------------------------------------------------
    # 8. Target validation
    # --------------------------------------------------------

    print_section("8. TARGET VALIDATION")

    regression_target = "next_month_profit"
    classification_target = "profitability_label"

    for target in [regression_target, classification_target]:

        if target not in df.columns:
            print(f"ERROR: Missing target column: {target}")
            continue

        print(f"\nTarget: {target}")

        print(
            f"Missing values: "
            f"{df[target].isnull().sum():,}"
        )

        print(
            f"Unique values: "
            f"{df[target].nunique():,}"
        )

        print("\nStatistics:")

        if pd.api.types.is_numeric_dtype(df[target]):
            print(df[target].describe())

    # --------------------------------------------------------
    # 9. Profitability label consistency
    # --------------------------------------------------------

    print_section("9. PROFITABILITY LABEL CONSISTENCY")

    if (
        "next_month_profit" in df.columns
        and "profitability_label" in df.columns
    ):

        expected_label = (
            df["next_month_profit"] > 0
        ).astype(int)

        mismatches = (
            expected_label != df["profitability_label"]
        ).sum()

        print(
            f"Label mismatches: {mismatches:,}"
        )

        if mismatches == 0:
            print(
                "PASS: profitability_label is consistent "
                "with next_month_profit."
            )
        else:
            print(
                "WARNING: Target label inconsistencies found."
            )

    # --------------------------------------------------------
    # 10. Classification distribution
    # --------------------------------------------------------

    print_section("10. PROFITABILITY CLASS DISTRIBUTION")

    if classification_target in df.columns:

        distribution = (
            df[classification_target]
            .value_counts(dropna=False)
            .sort_index()
        )

        percentages = (
            df[classification_target]
            .value_counts(normalize=True)
            .sort_index()
            * 100
        )

        result = pd.DataFrame({
            "count": distribution,
            "percentage": percentages.round(2)
        })

        print(result)

    # --------------------------------------------------------
    # 11. Numerical feature summary
    # --------------------------------------------------------

    print_section("11. NUMERICAL FEATURE SUMMARY")

    numerical_columns = df.select_dtypes(
        include=np.number
    ).columns.tolist()

    print(
        f"Numerical columns: {len(numerical_columns)}"
    )

    print("\n")

    print(
        df[numerical_columns]
        .describe()
        .T
        .to_string()
    )

    # --------------------------------------------------------
    # 12. Categorical columns
    # --------------------------------------------------------

    print_section("12. CATEGORICAL / NON-NUMERICAL COLUMNS")

    non_numeric = df.select_dtypes(
        exclude=np.number
    ).columns.tolist()

    for column in non_numeric:

        print(
            f"\n{column}: "
            f"{df[column].nunique()} unique values"
        )

        if df[column].nunique() <= 50:
            print(
                df[column]
                .value_counts()
                .head(50)
                .to_string()
            )

    # --------------------------------------------------------
    # 13. Potential ID columns
    # --------------------------------------------------------

    print_section("13. IDENTIFIER COLUMNS")

    possible_ids = [
        column
        for column in df.columns
        if column.lower().endswith("_id")
        or column.lower() in ["id"]
    ]

    print("Potential identifier columns:")

    for column in possible_ids:
        print(f"- {column}")

    print(
        "\nAvenue360 rule: identifiers such as property_id "
        "should not be used directly as model features."
    )

    # --------------------------------------------------------
    # 14. Target leakage check
    # --------------------------------------------------------

    print_section("14. DIRECT TARGET LEAKAGE CHECK")

    leakage_columns = [
        "next_month_profit",
        "profitability_label"
    ]

    print("Columns that must NOT be model features:")

    for column in leakage_columns:
        if column in df.columns:
            print(f"- {column}")

    # --------------------------------------------------------
    # 15. Suspicious future-looking column names
    # --------------------------------------------------------

    print_section("15. FUTURE-LOOKING FEATURE CHECK")

    future_terms = [
        "next",
        "future",
        "forecast",
        "predicted",
        "prediction",
        "actual_future"
    ]

    suspicious = []

    for column in df.columns:

        column_lower = column.lower()

        if any(
            term in column_lower
            for term in future_terms
        ):
            suspicious.append(column)

    if suspicious:
        print(
            "Columns requiring temporal review:"
        )

        for column in suspicious:
            print(f"- {column}")
    else:
        print(
            "No future-looking column names detected."
        )

    # --------------------------------------------------------
    # 16. Basic correlation with target
    # --------------------------------------------------------

    print_section("16. NUMERICAL CORRELATION WITH NEXT-MONTH PROFIT")

    if regression_target in df.columns:

        numeric_df = df.select_dtypes(
            include=np.number
        )

        correlations = (
            numeric_df.corr()[regression_target]
            .sort_values(
                key=lambda x: x.abs(),
                ascending=False
            )
        )

        print(correlations.to_string())

    # --------------------------------------------------------
    # 17. Final audit summary
    # --------------------------------------------------------

    print_section("17. FINAL AUDIT SUMMARY")

    checks = {
        "Dataset exists": DATA_PATH.exists(),
        "No missing values": df.isnull().sum().sum() == 0,
        "No duplicate rows": duplicate_rows == 0,
    }

    if all(
        column in df.columns
        for column in required_keys
    ):
        checks[
            "No duplicate property-month"
        ] = duplicate_property_month == 0

    if (
        regression_target in df.columns
        and classification_target in df.columns
    ):
        checks[
            "Target label consistency"
        ] = mismatches == 0

    for name, passed in checks.items():

        status = "PASS" if passed else "FAIL"

        print(
            f"[{status}] {name}"
        )

    print("\nAudit completed.")


if __name__ == "__main__":
    main()