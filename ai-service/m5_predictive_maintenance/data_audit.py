import pandas as pd

from config import (
    DATA_PATH,
    TARGET_COLUMN,
    DATE_COLUMN,
    LEAKAGE_COLUMNS,
    REPORTS_DIR,
)


def main():

    print("=" * 80)
    print("M5 PREDICTIVE MAINTENANCE - DATA AUDIT")
    print("=" * 80)

    # -----------------------------------------------------
    # 1. LOAD DATASET
    # -----------------------------------------------------

    df = pd.read_csv(DATA_PATH)

    print("\nDataset loaded successfully.")
    print(f"Dataset path: {DATA_PATH}")

    # -----------------------------------------------------
    # 2. SHAPE
    # -----------------------------------------------------

    print("\n1. DATASET SHAPE")
    print("-" * 50)

    print(f"Rows    : {df.shape[0]:,}")
    print(f"Columns : {df.shape[1]}")

    # -----------------------------------------------------
    # 3. COLUMN NAMES
    # -----------------------------------------------------

    print("\n2. COLUMNS")
    print("-" * 50)

    for index, column in enumerate(df.columns, start=1):
        print(f"{index:02d}. {column}")

    # -----------------------------------------------------
    # 4. DATA TYPES
    # -----------------------------------------------------

    print("\n3. DATA TYPES")
    print("-" * 50)

    print(df.dtypes)

    # -----------------------------------------------------
    # 5. SAMPLE DATA
    # -----------------------------------------------------

    print("\n4. SAMPLE RECORDS")
    print("-" * 50)

    print(df.head())

    # -----------------------------------------------------
    # 6. MISSING VALUES
    # -----------------------------------------------------

    print("\n5. MISSING VALUES")
    print("-" * 50)

    missing = df.isnull().sum()

    missing_report = pd.DataFrame({
        "column": missing.index,
        "missing_count": missing.values,
        "missing_percentage": (
            missing.values / len(df) * 100
        )
    })

    print(missing_report)

    missing_report.to_csv(
        REPORTS_DIR / "missing_values.csv",
        index=False
    )

    # -----------------------------------------------------
    # 7. DUPLICATES
    # -----------------------------------------------------

    duplicate_count = df.duplicated().sum()

    print("\n6. DUPLICATE RECORDS")
    print("-" * 50)

    print(f"Duplicate rows: {duplicate_count}")

    # -----------------------------------------------------
    # 8. DESCRIPTIVE STATISTICS
    # -----------------------------------------------------

    print("\n7. NUMERICAL STATISTICS")
    print("-" * 50)

    numerical_summary = df.describe().T

    print(numerical_summary)

    numerical_summary.to_csv(
        REPORTS_DIR / "numerical_summary.csv"
    )

    # -----------------------------------------------------
    # 9. TARGET DISTRIBUTION
    # -----------------------------------------------------

    print("\n8. TARGET DISTRIBUTION")
    print("-" * 50)

    target_counts = df[TARGET_COLUMN].value_counts().sort_index()

    target_percentage = (
        df[TARGET_COLUMN]
        .value_counts(normalize=True)
        .sort_index()
        * 100
    )

    target_report = pd.DataFrame({
        "count": target_counts,
        "percentage": target_percentage
    })

    print(target_report)

    target_report.to_csv(
        REPORTS_DIR / "target_distribution.csv"
    )

    # -----------------------------------------------------
    # 10. DATE RANGE
    # -----------------------------------------------------

    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN],
        format="%Y-%m"
    )

    print("\n9. DATA DATE RANGE")
    print("-" * 50)

    print("Minimum date:", df[DATE_COLUMN].min())
    print("Maximum date:", df[DATE_COLUMN].max())

    # -----------------------------------------------------
    # 11. CATEGORY DISTRIBUTION
    # -----------------------------------------------------

    print("\n10. MAINTENANCE ISSUE CATEGORIES")
    print("-" * 50)

    print(
        df["dominant_issue_category"]
        .value_counts()
    )

    # -----------------------------------------------------
    # 12. LEAKAGE VALIDATION
    # -----------------------------------------------------

    print("\n11. DATA LEAKAGE CHECK")
    print("-" * 50)

    count_rule = (
        df[TARGET_COLUMN]
        ==
        (df["next_month_maintenance_count"] > 0).astype(int)
    )

    cost_rule = (
        df[TARGET_COLUMN]
        ==
        (df["next_month_maintenance_cost"] > 0).astype(int)
    )

    print(
        "maintenance_risk_label matches "
        "next_month_maintenance_count > 0:",
        f"{count_rule.mean() * 100:.2f}%"
    )

    print(
        "maintenance_risk_label matches "
        "next_month_maintenance_cost > 0:",
        f"{cost_rule.mean() * 100:.2f}%"
    )

    print("\nWARNING:")
    print(
        f"{LEAKAGE_COLUMNS} MUST NOT be used as predictor features."
    )

    print("\nData audit completed successfully.")


if __name__ == "__main__":
    main()