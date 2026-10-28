from pathlib import Path
import sys

import numpy as np
import pandas as pd
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


AI_SERVICE_DIR = Path(__file__).resolve().parents[2]
if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_DIR))

from m3_rental_demand.config import (  # noqa: E402
    DATASET_PATH,
    FEATURE_COLUMNS,
    MODEL_PATH,
    SUPPORTED_PROPERTY_TYPES,
    TARGET_COLUMN,
)
from m3_rental_demand.inference import (  # noqa: E402
    M3Inference,
    predict_rental_demand,
)
from m3_rental_demand.preprocessing import (  # noqa: E402
    chronological_split,
    engineer_historical_features,
    load_dataset,
    prepare_training_data,
    validate_dataset,
    validate_inference_record,
)
from m3_rental_demand.train_model import train_and_evaluate  # noqa: E402
from m3_rental_demand.api import router  # noqa: E402


def _valid_inference_record(property_type: str = "VILLA") -> dict:
    source = load_dataset()
    engineered = engineer_historical_features(source)
    row = engineered.loc[
        engineered["property_type"].eq(property_type)
        & engineered["demand_lag_2_month"].notna()
    ].iloc[0]
    record = {
        field: row[field].item()
        if isinstance(row[field], np.generic)
        else row[field]
        for field in FEATURE_COLUMNS
    } | {
        "year": int(row["year"]),
        "month": int(row["month"]),
    }
    return record


@pytest.fixture(scope="module")
def trained_metadata():
    return train_and_evaluate()


def test_canonical_target_and_dataset_schema():
    dataframe = load_dataset()

    assert TARGET_COLUMN == "next_month_demand"
    assert "next_month_application_count" not in dataframe.columns
    assert dataframe[TARGET_COLUMN].ge(0).all()
    assert np.equal(
        dataframe[TARGET_COLUMN],
        np.floor(dataframe[TARGET_COLUMN]),
    ).all()
    assert set(dataframe["property_type"]) == set(SUPPORTED_PROPERTY_TYPES)
    assert len(dataframe) == 2160


def test_dataset_validation_rejects_duplicate_time_keys():
    dataframe = load_dataset().drop(columns=["_observation_month"])
    duplicate = pd.concat([dataframe, dataframe.iloc[[0]]], ignore_index=True)

    with pytest.raises(ValueError, match="duplicate"):
        validate_dataset(duplicate)


def test_historical_features_are_recomputed_from_observed_applications():
    dataframe = load_dataset()
    engineered = engineer_historical_features(dataframe)
    row = engineered.loc[
        engineered["city"].eq("Hyderabad")
        & engineered["area_locality"].eq("Gachibowli")
        & engineered["property_type"].eq("VILLA")
        & engineered["year"].eq(2024)
        & engineered["month"].eq(3)
    ].iloc[0]

    assert row["demand_lag_1_month"] == 3
    assert row["demand_lag_2_month"] == 6
    assert row["demand_growth_1_month"] == pytest.approx(-0.3333)


def test_zero_denominator_growth_uses_existing_backend_rule():
    dataframe = load_dataset()
    february = (
        dataframe["city"].eq("Hyderabad")
        & dataframe["area_locality"].eq("Gachibowli")
        & dataframe["property_type"].eq("VILLA")
        & dataframe["year"].eq(2024)
        & dataframe["month"].eq(2)
    )
    dataframe.loc[february, "application_count"] = 0
    engineered = engineer_historical_features(dataframe)
    march = engineered.loc[
        engineered["city"].eq("Hyderabad")
        & engineered["area_locality"].eq("Gachibowli")
        & engineered["property_type"].eq("VILLA")
        & engineered["year"].eq(2024)
        & engineered["month"].eq(3)
    ].iloc[0]

    assert march["demand_lag_1_month"] == 0
    assert march["demand_growth_1_month"] == march["application_count"]


def test_history_is_missing_when_prior_calendar_months_are_unavailable():
    dataframe = load_dataset()
    engineered = engineer_historical_features(dataframe)
    first_month = engineered.loc[
        engineered["year"].eq(2024) & engineered["month"].eq(1)
    ]
    second_month = engineered.loc[
        engineered["year"].eq(2024) & engineered["month"].eq(2)
    ]

    assert first_month["demand_lag_1_month"].isna().all()
    assert first_month["demand_lag_2_month"].isna().all()
    assert second_month["demand_lag_1_month"].notna().all()
    assert second_month["demand_lag_2_month"].isna().all()


def test_missing_month_does_not_become_a_false_one_month_lag():
    dataframe = load_dataset().drop(columns=["_observation_month"])
    missing_february = ~(
        dataframe["city"].eq("Hyderabad")
        & dataframe["area_locality"].eq("Gachibowli")
        & dataframe["property_type"].eq("VILLA")
        & dataframe["year"].eq(2024)
        & dataframe["month"].eq(2)
    )
    sparse = dataframe.loc[missing_february].copy()
    engineered = engineer_historical_features(
        validate_dataset(sparse)
    )
    march = engineered.loc[
        engineered["city"].eq("Hyderabad")
        & engineered["area_locality"].eq("Gachibowli")
        & engineered["property_type"].eq("VILLA")
        & engineered["year"].eq(2024)
        & engineered["month"].eq(3)
    ].iloc[0]

    assert pd.isna(march["demand_lag_1_month"])
    assert march["demand_lag_2_month"] == 6


def test_chronological_split_has_no_temporal_overlap():
    prepared, _ = prepare_training_data(load_dataset())
    train, test = chronological_split(prepared)

    assert train["_observation_month"].max() < test["_observation_month"].min()
    assert train["_observation_month"].max().strftime("%Y-%m") == "2025-12"
    assert test["_observation_month"].min().strftime("%Y-%m") == "2026-01"


def test_inference_requires_complete_history_and_rejects_target_inputs():
    record = _valid_inference_record()
    record.pop("demand_lag_1_month")

    with pytest.raises(ValueError, match="Missing required"):
        validate_inference_record(record)

    record = _valid_inference_record()
    record[TARGET_COLUMN] = 9
    with pytest.raises(ValueError, match="Target or future-target"):
        validate_inference_record(record)


def test_unsupported_property_type_is_rejected():
    record = _valid_inference_record()
    record["property_type"] = "HOUSE"

    with pytest.raises(ValueError, match="property_type"):
        validate_inference_record(record)


def test_training_saves_actual_metrics_and_model_artifact(trained_metadata):
    assert MODEL_PATH.exists()
    assert trained_metadata["target"] == "next_month_demand"
    assert trained_metadata["metrics"]["model"]["mae"] >= 0
    assert trained_metadata["metrics"]["model"]["rmse"] >= 0
    assert trained_metadata["metrics"]["model"]["r2"] <= 1
    assert trained_metadata["metrics"]["baseline_current_application_count"]["mae"] >= 0
    assert set(trained_metadata["metrics"]["by_property_type"]) == set(
        SUPPORTED_PROPERTY_TYPES
    )


@pytest.mark.parametrize("property_type", SUPPORTED_PROPERTY_TYPES)
def test_loaded_model_predicts_supported_property_types(
    property_type,
    trained_metadata,
):
    inference = M3Inference()
    result = inference.predict(_valid_inference_record(property_type))

    assert result["target"] == "next_month_demand"
    assert result["propertyType"] == property_type
    assert result["predictedDemandCount"] >= 0
    assert result["forecastPeriod"]
    assert result["modelVersion"]


def test_api_prediction_response_contract(trained_metadata):
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)
    record = _valid_inference_record()
    response = client.post("/m3/predict-rental-demand", json=record)

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["target"] == "next_month_demand"
    assert payload["propertyType"] == record["property_type"]
    assert payload["predictedDemandCount"] >= 0


def test_missing_model_artifact_is_reported(tmp_path):
    with pytest.raises(FileNotFoundError, match="M3 model artifact not found"):
        M3Inference(tmp_path / "missing.joblib")


def test_dataset_file_is_not_copied_into_module():
    assert DATASET_PATH.exists()
    assert not (Path(__file__).resolve().parents[1] / DATASET_PATH.name).exists()
