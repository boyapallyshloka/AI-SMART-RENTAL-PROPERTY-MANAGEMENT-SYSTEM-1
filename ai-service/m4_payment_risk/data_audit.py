import pandas as pd

from config import (
    DATA_PATH,
    TARGET_COLUMN,
    DATE_COLUMN,
    ID_COLUMNS,
    LEAKAGE_COLUMNS,
    FEATURE_COLUMNS,
    REPORTS_DIR,
)


def main():

    print("=" * 80)
    print("M4 TENANT PAYMENT RISK - DATA AUDIT")
    print("=" * 80)

    # =====================================================
    # 1. LOAD DATA
    # =====================================================

    print("\n1. LOADING DATASET")
    print("-" * 60)

    df = pd.read_csv(DATA_PATH)

    print("Dataset loaded successfully.")
    print(f"Path: {DATA_PATH}")

    # =====================================================
    # 2. SHAPE
    # =====================================================

    print("\n2. DATASET SHAPE")
    print("-" * 60)

    print(f"Rows    : {df.shape[0]:,}")
    print(f"Columns : {df.shape[1]}")

    # =====================================================
    # 3. COLUMNS
    # =====================================================

    print("\n3. COLUMNS")
    print("-" * 60)

    for index, column in enumerate(df.columns, start=1):
        print(f"{index:02d}. {column}")

    # =====================================================
    # 4. REQUIRED COLUMNS
    # =====================================================

    print("\n4. REQUIRED COLUMN CHECK")
    print("-" * 60)

    required_columns = (
        FEATURE_COLUMNS
        + ID_COLUMNS
        + LEAKAGE_COLUMNS
        + [
            TARGET_COLUMN,
            DATE_COLUMN,
        ]
    )

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:

        print("FAIL - Missing required columns:")

        for column in missing_columns:
            print(f"  - {column}")

    else:

        print("PASS - All required columns are present.")

    # =====================================================
    # 5. DATA TYPES
    # =====================================================

    print("\n5. DATA TYPES")
    print("-" * 60)

    print(df.dtypes)

    # =====================================================
    # 6. MISSING VALUES
    # =====================================================

    print("\n6. MISSING VALUES")
    print("-" * 60)

    missing = df.isnull().sum()

    missing_report = pd.DataFrame({
        "column": missing.index,
        "missing_count": missing.values,
        "missing_percentage": (
            missing.values / len(df) * 100
        )
    })

    print(missing_report.to_string(index=False))

    missing_report.to_csv(
        REPORTS_DIR / "missing_values.csv",
        index=False
    )

    # =====================================================
    # 7. DUPLICATES
    # =====================================================

    print("\n7. DUPLICATE ROWS")
    print("-" * 60)

    duplicate_count = df.duplicated().sum()

    print(
        f"Duplicate rows: {duplicate_count:,}"
    )

    # Tenant + snapshot should represent one observation.
    tenant_month_duplicates = df.duplicated(
        subset=[
            "tenant_id",
            "snapshot_month",
        ]
    ).sum()

    print(
        "Duplicate tenant/month rows:",
        tenant_month_duplicates
    )

    # =====================================================
    # 8. DATE ANALYSIS
    # =====================================================

    print("\n8. SNAPSHOT DATE ANALYSIS")
    print("-" * 60)

    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN],
        format="%Y-%m"
    )

    print(
        "Minimum snapshot:",
        df[DATE_COLUMN].min()
    )

    print(
        "Maximum snapshot:",
        df[DATE_COLUMN].max()
    )

    print(
        "Unique months:",
        df[DATE_COLUMN].nunique()
    )

    # =====================================================
    # 9. TENANT ANALYSIS
    # =====================================================

    print("\n9. TENANT ANALYSIS")
    print("-" * 60)

    print(
        "Unique tenants:",
        df["tenant_id"].nunique()
    )

    snapshots_per_tenant = (
        df.groupby("tenant_id")
        .size()
    )

    print("\nSnapshots per tenant:")

    print(
        snapshots_per_tenant.describe()
    )

    # =====================================================
    # 10. TARGET ANALYSIS
    # =====================================================

    print("\n10. TARGET ANALYSIS")
    print("-" * 60)

    print(
        "Target:",
        TARGET_COLUMN
    )

    print(
        "\nTarget values:"
    )

    target_counts = (
        df[TARGET_COLUMN]
        .value_counts(dropna=False)
        .sort_index()
    )

    print(target_counts)

    target_distribution = pd.DataFrame({
        "risk_label": target_counts.index,
        "count": target_counts.values,
        "percentage": (
            target_counts.values
            / len(df)
            * 100
        )
    })

    print(
        "\nTarget distribution:"
    )

    print(
        target_distribution.to_string(
            index=False
        )
    )

    target_distribution.to_csv(
        REPORTS_DIR
        / "target_distribution.csv",
        index=False
    )

    # =====================================================
    # 11. NUMERICAL SUMMARY
    # =====================================================

    print("\n11. NUMERICAL SUMMARY")
    print("-" * 60)

    numerical_columns = (
        df.select_dtypes(
            include=["number"]
        )
        .columns
    )

    numerical_summary = (
        df[numerical_columns]
        .describe()
        .T
    )

    print(
        numerical_summary.to_string()
    )

    numerical_summary.to_csv(
        REPORTS_DIR
        / "numerical_summary.csv"
    )

    # =====================================================
    # 12. FEATURE CHECK
    # =====================================================

    print("\n12. FEATURE CHECK")
    print("-" * 60)

    print("Configured features:")

    for feature in FEATURE_COLUMNS:
        print(f"  ✓ {feature}")

    # =====================================================
    # 13. LEAKAGE CHECK
    # =====================================================

    print("\n13. DATA LEAKAGE CHECK")
    print("-" * 60)

    leakage_in_features = [
        column
        for column in FEATURE_COLUMNS
        if column in (
            LEAKAGE_COLUMNS
            + [TARGET_COLUMN]
            + ID_COLUMNS
        )
    ]

    if leakage_in_features:

        print(
            "FAIL - Invalid columns found "
            "inside FEATURE_COLUMNS:"
        )

        for column in leakage_in_features:
            print(f"  ✗ {column}")

    else:

        print(
            "PASS - No target, ID, or leakage "
            "columns are configured as features."
        )

    # =====================================================
    # 14. FUTURE TARGET RELATIONSHIP
    # =====================================================

    print("\n14. FUTURE-BEHAVIOR CHECK")
    print("-" * 60)

    if (
        "future_bad_payment_ratio" in df.columns
        and TARGET_COLUMN in df.columns
    ):

        consistency = (
            (
                (
                    df["future_bad_payment_ratio"]
                    >= 0.4
                ).astype(int)
                == df[TARGET_COLUMN]
            )
            .mean()
        )

        print(
            "Relationship between "
            "future_bad_payment_ratio and risk_label:"
        )

        print(
            f"Agreement using 0.4 threshold: "
            f"{consistency:.2%}"
        )

        print(
            "\nIMPORTANT:"
        )

        print(
            "future_bad_payment_ratio is treated "
            "as a leakage/future-outcome column and "
            "will NOT be used as a model feature."
        )

    # =====================================================
    # 15. RANGE VALIDATION
    # =====================================================

    print("\n15. BASIC RANGE CHECKS")
    print("-" * 60)

    checks = {

        "monthly_income > 0":
            (df["monthly_income"] > 0).all(),

        "historical_invoice_count >= 0":
            (
                df["historical_invoice_count"]
                >= 0
            ).all(),

        "late_payment_count >= 0":
            (
                df["late_payment_count"]
                >= 0
            ).all(),

        "missed_payment_count >= 0":
            (
                df["missed_payment_count"]
                >= 0
            ).all(),

        "avg_days_late >= 0":
            (
                df["avg_days_late"]
                >= 0
            ).all(),

        "max_days_late >= 0":
            (
                df["max_days_late"]
                >= 0
            ).all(),

        "historical_outstanding >= 0":
            (
                df["historical_outstanding"]
                >= 0
            ).all(),

        "payment_completion_ratio between 0 and 1":
            (
                df["payment_completion_ratio"]
                .between(0, 1)
                .all()
            ),

        "future_bad_payment_ratio between 0 and 1":
            (
                df["future_bad_payment_ratio"]
                .between(0, 1)
                .all()
            ),

        "risk_label is binary":
            set(
                df[TARGET_COLUMN]
                .dropna()
                .unique()
            ).issubset({0, 1}),
    }

    for check, result in checks.items():

        status = "PASS" if result else "FAIL"

        print(
            f"{status}: {check}"
        )

    # =====================================================
    # 16. FINAL RESULT
    # =====================================================

    print("\n" + "=" * 80)
    print("M4 DATA AUDIT COMPLETED")
    print("=" * 80)


if __name__ == "__main__":
    main()