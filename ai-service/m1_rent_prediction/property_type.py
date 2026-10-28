import pandas as pd


M1_PATH = "../data/ml/M1_Rent_Prediction.csv"
PROPERTIES_PATH = "../data/properties_enriched.csv"
OUTPUT_PATH = "../data/ml/M1_Rent_Prediction_final.csv"


def build_final_m1_dataset():
    m1 = pd.read_csv(M1_PATH)
    properties = pd.read_csv(PROPERTIES_PATH)

    property_type = properties[
        ["property_id", "property_type"]
    ].drop_duplicates("property_id")

    # Add property type using the real property ID
    m1 = m1.merge(
        property_type,
        on="property_id",
        how="left",
        validate="one_to_one"
    )

    # Fix logical floor inconsistencies
    invalid_floor = m1["floor"] > m1["total_floors"]
    m1.loc[invalid_floor, "total_floors"] = m1.loc[
        invalid_floor, "floor"
    ]

    print("Rows:", len(m1))
    print("Missing property_type:", m1["property_type"].isna().sum())
    print("Floor fixes:", invalid_floor.sum())

    # Remove identifier and excluded fields to prevent
    # identifier-based learning and potential target leakage.
    columns_to_drop = [
        "property_id",
        "average_recent_historical_rent",
        "historical_rent_change_pct",
        "market_rent_index_latest"
    ]

    m1 = m1.drop(columns=columns_to_drop)

    m1.to_csv(
        OUTPUT_PATH,
        index=False
    )

    print("Final dataset shape:", m1.shape)
    print("Saved:", OUTPUT_PATH)


if __name__ == "__main__":
    build_final_m1_dataset()