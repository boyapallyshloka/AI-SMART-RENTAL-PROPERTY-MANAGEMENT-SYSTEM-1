from m3_rental_demand.config import (
    DATASET_PATH,
    DATE_COLUMN,
    FEATURES,
    TARGET_COLUMN,
)
from m3_rental_demand.preprocessing import load_and_prepare


def main():
    df = load_and_prepare()
    print("Canonical dataset validation completed.")
    print("Source dataset:", DATASET_PATH)
    print("Source rows:", len(df))
    print("Labeled rows:", int(df[TARGET_COLUMN].notna().sum()))
    print("Unlabeled terminal/gap rows:", int(df[TARGET_COLUMN].isna().sum()))
    print("Date coverage:", df[DATE_COLUMN].min(), "through", df[DATE_COLUMN].max())
    print("Features:", FEATURES)
    print("Target:", TARGET_COLUMN)
    print("Feature engineering does not create or write another dataset.")


if __name__ == "__main__":
    main()
