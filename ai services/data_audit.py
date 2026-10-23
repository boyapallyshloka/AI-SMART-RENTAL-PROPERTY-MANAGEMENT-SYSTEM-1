import pandas as pd

from config import (
    M5_DATASET_PATH,
    M5_FEATURES,
    TARGET_RISK,
    TARGET_COUNT,
    TARGET_COST,
)


def main():

    print("=" * 70)
    print("M5 PREDICTIVE MAINTENANCE - DATA AUDIT")
    print("=" * 70)

    # ---------------------------------------------------------
    # Load dataset
    # ---------------------------------------------------------

    df = pd.read_csv(M5_DATASET_PATH)

    print("\nDataset shape:")
    print(df.shape)

    print("\nColumns:")
    for column in df.columns:
        print(f"  - {column}")

    # ---------------------------------------------------------
    # Required columns
    # ---------------------------------------------------------

    required_columns = (
        M5_FEATURES
        + [
            TARGET_RISK,
            TARGET_COUNT,
            TARGET_COST,
            "property_id",
            "snapshot_month",
        ]
    )

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:

        print("\nERROR - Missing columns:")

        for column in missing_columns:
            print(f"  - {column}")

        return

    print("\nPASS - All required columns are present.")

    # ---------------------------------------------------------
    # Missing values
    # ---------------------------------------------------------

    print("\nMissing values:")

    missing = df.isnull().sum()

    for column, count in missing.items():

        if count > 0:
            print(
                f"  {column}: {count}"
            )

    # ---------------------------------------------------------
    # Target missing values
    # ---------------------------------------------------------

    print("\nTarget missing values:")

    for target in [
        TARGET_RISK,
        TARGET_COUNT,
        TARGET_COST,
    ]:

        print(
            f"  {target}: "
            f"{df[target].isna().sum()}"
        )

    # ---------------------------------------------------------
    # Risk/count relationship
    # ---------------------------------------------------------

    expected_risk = (
        df[TARGET_COUNT] > 0
    ).astype(int)

    actual_risk = df[TARGET_RISK]

    consistency = (
        expected_risk == actual_risk
    ).mean()

    print("\nRisk / count consistency:")

    print(
        f"  maintenance_risk_label == "
        f"(next_month_maintenance_count > 0): "
        f"{consistency:.2%}"
    )

    # ---------------------------------------------------------
    # Target distributions
    # ---------------------------------------------------------

    print("\nRisk distribution:")

    print(
        df[TARGET_RISK]
        .value_counts(dropna=False)
        .sort_index()
    )

    print("\nMaintenance count statistics:")

    print(
        df[TARGET_COUNT].describe()
    )

    print("\nMaintenance cost statistics:")

    print(
        df[TARGET_COST].describe()
    )

    # ---------------------------------------------------------
    # Property / month duplicates
    # ---------------------------------------------------------

    duplicates = df.duplicated(
        subset=[
            "property_id",
            "snapshot_month",
        ]
    ).sum()

    print(
        "\nDuplicate property/snapshot rows:",
        duplicates,
    )

    # ---------------------------------------------------------
    # Date range
    # ---------------------------------------------------------

    df["snapshot_month"] = pd.to_datetime(
        df["snapshot_month"]
    )

    print("\nSnapshot range:")

    print(
        "  From:",
        df["snapshot_month"].min()
    )

    print(
        "  To:",
        df["snapshot_month"].max()
    )

    print(
        "\nUnique properties:",
        df["property_id"].nunique()
    )

    print(
        "Unique snapshot months:",
        df["snapshot_month"].nunique()
    )

    # ---------------------------------------------------------
    # Leakage check
    # ---------------------------------------------------------

    target_columns = {
        TARGET_RISK,
        TARGET_COUNT,
        TARGET_COST,
    }

    leakage_features = [
        feature
        for feature in M5_FEATURES
        if feature in target_columns
    ]

    print("\nFeature leakage check:")

    if leakage_features:

        print(
            "FAIL - Target columns are present "
            "in M5_FEATURES:"
        )

        for feature in leakage_features:
            print(f"  - {feature}")

    else:

        print(
            "PASS - No target columns are "
            "included in M5_FEATURES."
        )

    print("\nAudit completed.")


if __name__ == "__main__":
    main()