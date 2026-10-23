import numpy as np
import pandas as pd

from m3_rental_demand.config import (
    DATASET_PATH,
    DATE_COLUMN,
    FEATURES,
    NUMERIC_FEATURES,
    PROPERTY_TYPES,
    TARGET_COLUMN,
)


COUNT_COLUMNS = [
    "property_count",
    "application_count",
    "agreement_start_count",
    "available_unit_count",
    TARGET_COLUMN,
]
LAG_COLUMNS = [
    "demand_lag_1_month",
    "demand_lag_2_month",
]
GROWTH_COLUMN = "demand_growth_1_month"
NUMERIC_COLUMNS = list(
    dict.fromkeys(NUMERIC_FEATURES + [TARGET_COLUMN])
)
EXPECTED_COLUMNS = [
    "city",
    "area_locality",
    "property_type",
    "year",
    "month",
    "property_count",
    "application_count",
    "agreement_start_count",
    "average_monthly_rent",
    "demand_lag_1_month",
    "demand_lag_2_month",
    GROWTH_COLUMN,
    "occupancy_rate",
    "vacancy_rate",
    "available_unit_count",
    TARGET_COLUMN,
]
SERIES_COLUMNS = ["city", "area_locality", "property_type"]


def _assert_matches(actual, expected, name, tolerance=1e-9):
    actual_missing = actual.isna()
    expected_missing = expected.isna()
    if not actual_missing.equals(expected_missing):
        raise ValueError(
            f"{name} has missing values inconsistent with its definition."
        )

    mask = ~expected_missing
    if mask.any() and not np.allclose(
        actual.loc[mask].to_numpy(dtype=float),
        expected.loc[mask].to_numpy(dtype=float),
        rtol=0,
        atol=tolerance,
    ):
        raise ValueError(f"{name} does not match its documented formula.")


def load_and_prepare():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Configured M3 dataset not found: {DATASET_PATH}. "
            "No fallback dataset is used."
        )

    df = pd.read_csv(DATASET_PATH)
    df.columns = df.columns.str.strip()
    missing_columns = [
        column for column in EXPECTED_COLUMNS if column not in df.columns
    ]
    unexpected_columns = [
        column for column in df.columns if column not in EXPECTED_COLUMNS
    ]
    if missing_columns or unexpected_columns:
        raise ValueError(
            "M3 dataset schema mismatch. "
            f"Missing columns: {missing_columns}; "
            f"unexpected columns: {unexpected_columns}."
        )
    if df.empty:
        raise ValueError("The configured M3 dataset contains no rows.")

    for column in NUMERIC_COLUMNS:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    string_columns = ["city", "area_locality", "property_type"]
    for column in string_columns:
        df[column] = df[column].astype("string").str.strip()
        if df[column].isna().any() or df[column].eq("").any():
            raise ValueError(f"{column} must be present and non-blank.")

    df["property_type"] = df["property_type"].str.upper()
    invalid_types = sorted(set(df["property_type"]) - set(PROPERTY_TYPES))
    if invalid_types:
        raise ValueError(f"Unsupported property_type values: {invalid_types}.")

    for column in ["year", "month"]:
        values = pd.to_numeric(df[column], errors="coerce")
        if values.isna().any() or not np.equal(
            values.to_numpy(dtype=float),
            np.floor(values.to_numpy(dtype=float)),
        ).all():
            raise ValueError(f"{column} must contain whole numbers.")
        df[column] = values.astype(int)

    if not df["month"].between(1, 12).all() or (df["year"] < 1).any():
        raise ValueError("M3 dataset contains invalid year/month values.")

    df[DATE_COLUMN] = pd.to_datetime(
        {
            "year": df["year"],
            "month": df["month"],
            "day": 1,
        },
        errors="coerce",
    )
    if df[DATE_COLUMN].isna().any():
        raise ValueError("M3 dataset contains invalid calendar dates.")

    duplicate_columns = SERIES_COLUMNS + [DATE_COLUMN]
    if df.duplicated(duplicate_columns, keep=False).any():
        raise ValueError(
            "M3 dataset contains duplicate city/locality/property_type/month rows."
        )

    df = df.sort_values(
        duplicate_columns,
        kind="stable",
    ).reset_index(drop=True)

    numeric_feature_columns = list(NUMERIC_FEATURES)
    for column in numeric_feature_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    finite_features = np.isfinite(
        df[numeric_feature_columns].fillna(0).to_numpy(dtype=float)
    )
    if not finite_features.all():
        raise ValueError("M3 feature columns contain infinite values.")

    required_feature_columns = [
        column for column in numeric_feature_columns
        if column not in LAG_COLUMNS and column != GROWTH_COLUMN
    ]
    if df[required_feature_columns].isna().any().any():
        raise ValueError("M3 dataset has missing required feature values.")

    for column in COUNT_COLUMNS[:-1]:
        values = df[column].dropna().to_numpy(dtype=float)
        if (values < 0).any() or not np.equal(values, np.floor(values)).all():
            raise ValueError(f"{column} must contain non-negative whole counts.")

    for column in LAG_COLUMNS:
        values = df[column].dropna().to_numpy(dtype=float)
        if (values < 0).any() or not np.equal(values, np.floor(values)).all():
            raise ValueError(f"{column} must contain non-negative whole counts.")

    if (df["average_monthly_rent"] < 0).any():
        raise ValueError("average_monthly_rent cannot be negative.")
    for column in ["occupancy_rate", "vacancy_rate"]:
        if not df[column].between(0, 1).all():
            raise ValueError(f"{column} must be a fraction between 0 and 1.")

    grouped = df.groupby(SERIES_COLUMNS, sort=False, observed=True)
    previous_month = grouped[DATE_COLUMN].shift(1)
    previous2_month = grouped[DATE_COLUMN].shift(2)
    previous_applications = grouped["application_count"].shift(1)
    previous2_applications = grouped["application_count"].shift(2)
    following_month = grouped[DATE_COLUMN].shift(-1)
    following_applications = grouped["application_count"].shift(-1)

    one_month = pd.offsets.MonthBegin(1)
    consecutive_previous = previous_month.eq(df[DATE_COLUMN] - one_month)
    consecutive_previous2 = previous2_month.eq(
        df[DATE_COLUMN] - 2 * one_month
    )
    consecutive_following = following_month.eq(
        df[DATE_COLUMN] + one_month
    )

    expected_lag1 = previous_applications.where(consecutive_previous)
    expected_lag2 = previous2_applications.where(consecutive_previous2)
    expected_growth = (
        (df["application_count"] - previous_applications)
        / previous_applications.replace(0, np.nan)
    ).where(consecutive_previous)
    expected_target = following_applications.where(consecutive_following)

    _assert_matches(df[LAG_COLUMNS[0]], expected_lag1, LAG_COLUMNS[0])
    _assert_matches(df[LAG_COLUMNS[1]], expected_lag2, LAG_COLUMNS[1])
    _assert_matches(df[GROWTH_COLUMN], expected_growth, GROWTH_COLUMN)
    _assert_matches(df[TARGET_COLUMN], expected_target, TARGET_COLUMN)

    missing_target_rows = df[TARGET_COLUMN].isna()
    if int(missing_target_rows.sum()) != int((~consecutive_following).sum()):
        raise ValueError(
            "Missing target values must correspond exactly to rows without "
            "a consecutive following month."
        )
    if not missing_target_rows.equals(~consecutive_following):
        raise ValueError(
            "Target values are missing outside terminal/gap rows or are "
            "present where the following month is unavailable."
        )

    labeled_targets = df[TARGET_COLUMN].dropna().to_numpy(dtype=float)
    if (
        not np.isfinite(labeled_targets).all()
        or (labeled_targets < 0).any()
        or not np.equal(labeled_targets, np.floor(labeled_targets)).all()
    ):
        raise ValueError(
            f"{TARGET_COLUMN} must contain non-negative whole counts."
        )

    return df


def time_based_split(df, test_fraction=0.2):
    """Split labeled rows by target month, not by feature month."""
    labeled = df.loc[df[TARGET_COLUMN].notna()].copy()
    if labeled.empty:
        raise ValueError("No labeled rows are available for evaluation.")

    labeled["target_month"] = labeled[DATE_COLUMN] + pd.offsets.MonthBegin(1)
    months = sorted(labeled["target_month"].unique())
    if len(months) < 5 or not 0 < test_fraction < 1:
        raise ValueError("Insufficient target months or invalid test fraction.")

    split_index = int(len(months) * (1 - test_fraction))
    split_index = min(max(split_index, 1), len(months) - 1)
    train_months = months[:split_index]
    test_months = months[split_index:]

    train = labeled[labeled["target_month"].isin(train_months)].copy()
    test = labeled[labeled["target_month"].isin(test_months)].copy()
    if train.empty or test.empty:
        raise ValueError("Chronological train/test split is empty.")
    if set(train["target_month"]).intersection(test["target_month"]):
        raise ValueError("Train and test target months overlap.")

    return train.drop(columns=["target_month"]), test.drop(
        columns=["target_month"]
    )


TARGET = TARGET_COLUMN
