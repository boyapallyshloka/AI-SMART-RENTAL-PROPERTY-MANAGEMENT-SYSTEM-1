from collections.abc import Mapping
from numbers import Real
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .config import (
    DATASET_PATH,
    DATE_SPLIT_TEST_START,
    DATE_SPLIT_TRAIN_END,
    FEATURE_COLUMNS,
    IDENTIFIER_COLUMNS,
    REQUIRED_DATASET_COLUMNS,
    SUPPORTED_PROPERTY_TYPES,
    TARGET_COLUMN,
)


COUNT_COLUMNS = [
    "property_count",
    "application_count",
    "agreement_start_count",
    "demand_lag_1_month",
    "demand_lag_2_month",
    "available_unit_count",
    TARGET_COLUMN,
]

NUMERIC_DATASET_COLUMNS = COUNT_COLUMNS + [
    "year",
    "month",
    "average_monthly_rent",
    "demand_growth_1_month",
    "occupancy_rate",
    "vacancy_rate",
]

INFERENCE_METADATA_FIELDS = ("year", "month")
FORBIDDEN_INFERENCE_FIELDS = {
    TARGET_COLUMN,
    "next_month_application_count",
}


def load_dataset(path: Path = DATASET_PATH) -> pd.DataFrame:
    """Load and validate the canonical M3 dataset."""

    if not path.exists():
        raise FileNotFoundError(f"M3 dataset not found: {path}")

    dataframe = validate_dataset(pd.read_csv(path))
    dataframe.attrs["source_path"] = str(path.resolve())
    return dataframe


def validate_dataset(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Validate source schema, keys, target, and numeric values."""

    if dataframe.empty:
        raise ValueError("The M3 dataset is empty.")

    duplicate_columns = dataframe.columns[dataframe.columns.duplicated()].tolist()
    if duplicate_columns:
        raise ValueError(f"Dataset has duplicate columns: {duplicate_columns}")

    missing_columns = [
        column
        for column in REQUIRED_DATASET_COLUMNS
        if column not in dataframe.columns
    ]
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {missing_columns}")

    result = dataframe.copy()

    for column in ("city", "area_locality", "property_type"):
        if result[column].isna().any():
            raise ValueError(f"{column} cannot contain missing values.")
        result[column] = result[column].astype(str).str.strip()
        if result[column].eq("").any():
            raise ValueError(f"{column} cannot contain blank values.")

    unsupported_types = sorted(
        set(result["property_type"]) - set(SUPPORTED_PROPERTY_TYPES)
    )
    if unsupported_types:
        raise ValueError(
            f"Unsupported property_type values: {unsupported_types}"
        )

    for column in NUMERIC_DATASET_COLUMNS:
        result[column] = pd.to_numeric(result[column], errors="coerce")
        values = result[column].to_numpy(dtype=float)
        if not np.isfinite(values).all():
            raise ValueError(
                f"{column} contains missing, invalid, or non-finite values."
            )

    for column in COUNT_COLUMNS:
        values = result[column].to_numpy(dtype=float)
        if (values < 0).any():
            raise ValueError(f"{column} cannot contain negative values.")
        if not np.equal(values, np.floor(values)).all():
            raise ValueError(f"{column} must contain whole-number counts.")
        result[column] = result[column].astype("int64")

    for column in ("year", "month"):
        values = result[column].to_numpy(dtype=float)
        if not np.equal(values, np.floor(values)).all():
            raise ValueError(f"{column} must contain whole numbers.")
        result[column] = result[column].astype("int64")

    if ((result["year"] < 2000) | (result["year"] > 2100)).any():
        raise ValueError("year must be between 2000 and 2100.")
    if ((result["month"] < 1) | (result["month"] > 12)).any():
        raise ValueError("month must be between 1 and 12.")
    if (result["average_monthly_rent"] < 0).any():
        raise ValueError("average_monthly_rent cannot be negative.")

    for column in ("occupancy_rate", "vacancy_rate"):
        if ((result[column] < 0) | (result[column] > 1)).any():
            raise ValueError(f"{column} must use the 0-to-1 fraction scale.")

    key_columns = IDENTIFIER_COLUMNS + ["year", "month"]
    duplicate_keys = result.duplicated(subset=key_columns, keep=False)
    if duplicate_keys.any():
        raise ValueError(
            "Dataset contains duplicate city/locality/property-type/month keys."
        )

    result["_observation_month"] = pd.to_datetime(
        {
            "year": result["year"],
            "month": result["month"],
            "day": 1,
        }
    )

    return result


def engineer_historical_features(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Recompute demand lags and growth from observed application counts."""

    result = dataframe.copy()
    result["_month_index"] = result["year"] * 12 + result["month"]
    result = result.sort_values(
        IDENTIFIER_COLUMNS + ["_observation_month"]
    ).copy()

    history_index = pd.MultiIndex.from_frame(
        result[IDENTIFIER_COLUMNS + ["_month_index"]]
    )
    historical_applications = pd.Series(
        result["application_count"].to_numpy(dtype=float),
        index=history_index,
    )
    lag_indexes = {
        months: pd.MultiIndex.from_arrays(
            [
                *(result[column].to_numpy() for column in IDENTIFIER_COLUMNS),
                (result["_month_index"] - months).to_numpy(),
            ],
            names=IDENTIFIER_COLUMNS + ["_month_index"],
        )
        for months in (1, 2)
    }
    lag_1 = pd.Series(
        historical_applications.reindex(lag_indexes[1]).to_numpy(),
        index=result.index,
    )
    lag_2 = pd.Series(
        historical_applications.reindex(lag_indexes[2]).to_numpy(),
        index=result.index,
    )

    result["demand_lag_1_month"] = lag_1
    result["demand_lag_2_month"] = lag_2

    growth_denominator = lag_1.where(lag_1.ne(0))
    growth = (result["application_count"] - lag_1) / growth_denominator
    zero_denominator_growth = result["application_count"].astype(float)
    result["demand_growth_1_month"] = np.where(
        lag_1.eq(0),
        zero_denominator_growth,
        growth,
    )
    result.loc[lag_1.isna(), "demand_growth_1_month"] = np.nan
    result["demand_growth_1_month"] = result[
        "demand_growth_1_month"
    ].round(4)

    result = result.drop(columns=["_month_index"])
    return result


def prepare_training_data(
    dataframe: pd.DataFrame,
) -> tuple[pd.DataFrame, int]:
    """Return feature-complete rows and the count omitted for absent history."""

    engineered = engineer_historical_features(dataframe)
    complete = engineered[FEATURE_COLUMNS + [TARGET_COLUMN]].notna().all(axis=1)
    omitted_rows = int((~complete).sum())
    prepared = engineered.loc[complete].copy()

    if prepared.empty:
        raise ValueError(
            "No training rows have complete, observed historical features."
        )

    return prepared, omitted_rows


def chronological_split(
    dataframe: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split observations through 2025-12 from the 2026 test period."""

    train_end = pd.Period(DATE_SPLIT_TRAIN_END, freq="M").to_timestamp()
    test_start = pd.Period(DATE_SPLIT_TEST_START, freq="M").to_timestamp()
    train = dataframe.loc[
        dataframe["_observation_month"] <= train_end
    ].copy()
    test = dataframe.loc[
        dataframe["_observation_month"] >= test_start
    ].copy()

    if train.empty or test.empty:
        raise ValueError(
            "Chronological split requires training rows through 2025-12 "
            "and test rows from 2026-01 onward."
        )
    if train["_observation_month"].max() >= test["_observation_month"].min():
        raise ValueError("Training and test periods overlap.")

    return train, test


def validate_inference_record(record: Mapping[str, Any]) -> dict[str, Any]:
    """Validate a complete, cutoff-available inference feature record."""

    forbidden = FORBIDDEN_INFERENCE_FIELDS.intersection(record)
    if forbidden:
        raise ValueError(
            f"Target or future-target fields cannot be inference inputs: "
            f"{sorted(forbidden)}"
        )

    required = FEATURE_COLUMNS + list(INFERENCE_METADATA_FIELDS)
    missing = [field for field in required if field not in record]
    if missing:
        raise ValueError(f"Missing required prediction features: {missing}")

    normalized = dict(record)
    for field in ("city", "area_locality"):
        value = normalized[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{field} must be a non-empty string.")
        normalized[field] = value.strip()

    property_type = normalized["property_type"]
    if property_type not in SUPPORTED_PROPERTY_TYPES:
        raise ValueError(
            "property_type must be one of "
            f"{list(SUPPORTED_PROPERTY_TYPES)}."
        )

    for field in FEATURE_COLUMNS:
        if field in ("city", "area_locality", "property_type"):
            continue
        value = normalized[field]
        if isinstance(value, bool) or not isinstance(value, Real):
            raise ValueError(f"{field} must be a numeric value.")
        if not np.isfinite(float(value)):
            raise ValueError(f"{field} must be finite.")
        normalized[field] = float(value)

    for field in (
        "property_count",
        "application_count",
        "agreement_start_count",
        "demand_lag_1_month",
        "demand_lag_2_month",
        "available_unit_count",
    ):
        value = normalized[field]
        if value < 0 or not value.is_integer():
            raise ValueError(f"{field} must be a non-negative whole count.")

    for field in ("occupancy_rate", "vacancy_rate"):
        if not 0 <= normalized[field] <= 1:
            raise ValueError(f"{field} must use the 0-to-1 fraction scale.")
    if normalized["average_monthly_rent"] < 0:
        raise ValueError("average_monthly_rent cannot be negative.")

    for field, lower, upper in (("year", 2000, 2100), ("month", 1, 12)):
        value = normalized[field]
        if isinstance(value, bool) or not isinstance(value, Real):
            raise ValueError(f"{field} must be an integer.")
        if not float(value).is_integer() or not lower <= value <= upper:
            raise ValueError(
                f"{field} must be a whole number between {lower} and {upper}."
            )
        normalized[field] = int(value)

    return normalized
