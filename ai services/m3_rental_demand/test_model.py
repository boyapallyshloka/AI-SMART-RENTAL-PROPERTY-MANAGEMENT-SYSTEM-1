import os
import sys
import pandas as pd
from fastapi.testclient import TestClient

# Ensure m3_rental_demand directory and parent ai-service are in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)
PARENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

# Ensure working directory is ai-service so that relative data and artifact paths resolve correctly
AI_SERVICE_DIR = PARENT_DIR
if os.path.exists(os.path.join(AI_SERVICE_DIR, "data", "ml", "M3_Rental_Demand.csv")):
    os.chdir(AI_SERVICE_DIR)
elif os.path.exists(os.path.join(AI_SERVICE_DIR, "data", "raw", "ml", "M3_Rental_Demand.csv")):
    os.chdir(AI_SERVICE_DIR)

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

try:
    from m3_rental_demand.preprocessing import load_and_prepare, time_based_split, FEATURES, TARGET
    from m3_rental_demand.main import predict_demand
    from m3_rental_demand.api import router, validation_exception_handler
except ImportError:
    from preprocessing import load_and_prepare, time_based_split, FEATURES, TARGET
    from main import predict_demand
    from api import router, validation_exception_handler

app = FastAPI()
app.include_router(router)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

client = TestClient(app)


def test_no_data_leakage():
    """Confirm no row with year_month >= '2026-01' exists in the training split."""
    df = load_and_prepare()
    train, _ = time_based_split(df)
    leakage = train[train["year_month"] >= "2026-01"]
    if len(leakage) > 0:
        raise AssertionError(
            f"FAIL: Data leakage detected! Found {len(leakage)} row(s) with year_month >= '2026-01' in training set."
        )
    print("PASS: test_no_data_leakage - No rows with year_month >= '2026-01' in the training split.")


def test_no_overlap_between_train_test():
    """Confirm train and test sets share no year_month values."""
    df = load_and_prepare()
    train, test = time_based_split(df)
    train_months = set(train["year_month"].unique())
    test_months = set(test["year_month"].unique())
    overlap = train_months.intersection(test_months)
    if overlap:
        raise AssertionError(
            f"FAIL: Train and test sets share year_month values: {sorted(overlap)}"
        )
    print("PASS: test_no_overlap_between_train_test - Train and test sets share no year_month values.")


def test_all_features_present():
    """Confirm every column in FEATURES exists in the dataframe after load_and_prepare()."""
    df = load_and_prepare()
    missing_features = [col for col in FEATURES if col not in df.columns]
    if missing_features:
        raise AssertionError(
            f"FAIL: Missing expected features in prepared dataframe: {missing_features}"
        )
    print(f"PASS: test_all_features_present - All {len(FEATURES)} features present in prepared dataframe.")


def test_prediction_is_non_negative():
    """Call predict_demand() with raw feature dict and assert result is >= 0."""
    sample = {
        "city": "Bangalore",
        "area_locality": "A Narayanapura, Mahadevapura",
        "property_count": 50,
        "application_count": 12,
        "agreement_start_count": 3,
        "average_monthly_rent": 25000.0,
        "demand_lag_1_month": 2,
        "demand_lag_2_month": 1,
        "demand_growth_1_month": 0.5,
        "occupancy_rate": 85,
        "vacancy_rate": 15,
        "available_unit_count": 8,
        "month": 6,
    }
    result = predict_demand(sample)
    if result < 0:
        raise AssertionError(f"FAIL: predict_demand returned negative prediction: {result}")
    print(f"PASS: test_prediction_is_non_negative - Prediction is non-negative ({result}).")


def test_higher_activity_gives_higher_prediction():
    """
    Take a base row and compare low activity vs high activity predictions using raw inputs.
    Asserts predict_demand(high_activity) >= predict_demand(low_activity).
    """
    df = load_and_prepare()
    first_row = df.iloc[0]

    raw_features = [
        "city", "area_locality", "property_count", "application_count",
        "agreement_start_count", "average_monthly_rent", "demand_lag_1_month",
        "demand_lag_2_month", "demand_growth_1_month", "occupancy_rate",
        "vacancy_rate", "available_unit_count", "month"
    ]
    base_row = {k: first_row[k] for k in raw_features if k in first_row}

    # Low-activity scenario
    low_activity = dict(
        base_row,
        application_count=0,
        agreement_start_count=0,
        demand_lag_1_month=0,
        demand_lag_2_month=0,
        demand_growth_1_month=-0.5,
        occupancy_rate=0.0,
        vacancy_rate=100.0,
    )

    # High-activity scenario
    high_activity = dict(
        base_row,
        application_count=15,
        agreement_start_count=5,
        demand_lag_1_month=10,
        demand_lag_2_month=8,
        demand_growth_1_month=0.8,
        occupancy_rate=95.0,
        vacancy_rate=5.0,
    )

    pred_low = predict_demand(low_activity)
    pred_high = predict_demand(high_activity)

    if not (pred_high >= pred_low):
        raise AssertionError(
            f"FAIL: Higher activity did not give higher prediction! "
            f"High activity ({pred_high}) < Low activity ({pred_low})"
        )
    print(
        f"PASS: test_higher_activity_gives_higher_prediction - High activity ({pred_high}) >= Low activity ({pred_low})."
    )


def test_api_predict_demand_valid_shape():
    """Send a valid request to /predict-demand and verify the 200 response shape."""
    payload = {
        "city": "Bangalore",
        "area_locality": "A Narayanapura, Mahadevapura",
        "month": 6,
        "property_count": 50,
        "application_count": 12,
        "agreement_start_count": 3,
        "average_monthly_rent": 25000.0,
        "demand_lag_1_month": 2,
        "demand_lag_2_month": 1,
        "demand_growth_1_month": 0.5,
        "occupancy_rate": 85.0,
        "vacancy_rate": 15.0,
        "available_unit_count": 8
    }
    response = client.post("/m3/predict-demand", json=payload)
    if response.status_code != 200:
        raise AssertionError(f"FAIL: Expected status 200, got {response.status_code}: {response.text}")

    data = response.json()
    if not data.get("success"):
        raise AssertionError(f"FAIL: Expected 'success': True, got: {data}")
    has_prediction = "predictedDemandCount" in data or "prediction" in data
    if not has_prediction:
        raise AssertionError(f"FAIL: Missing prediction key in response: {data}")
    if data.get("modelVersion") not in ["1.0", "v1.0"]:
        raise AssertionError(f"FAIL: Expected modelVersion '1.0' or 'v1.0', got: {data.get('modelVersion')}")

    print("PASS: test_api_predict_demand_valid_shape - Valid request returned standard shape.")


def test_api_predict_demand_missing_field():
    """Send a request with a missing required field and check it returns INVALID_INPUT error format."""
    invalid_payload = {
        # 'city' is intentionally missing
        "area_locality": "A Narayanapura, Mahadevapura",
        "month": 6,
        "property_count": 50,
        "application_count": 12,
        "agreement_start_count": 3,
        "average_monthly_rent": 25000.0,
        "demand_lag_1_month": 2,
        "demand_lag_2_month": 1,
        "demand_growth_1_month": 0.5,
        "occupancy_rate": 85.0,
        "vacancy_rate": 15.0,
        "available_unit_count": 8
    }
    response = client.post("/m3/predict-demand", json=invalid_payload)
    if response.status_code != 400:
        raise AssertionError(f"FAIL: Expected status 400 for missing field, got {response.status_code}: {response.text}")

    data = response.json()
    if data.get("success") is not False:
        raise AssertionError(f"FAIL: Expected 'success': False, got: {data}")
    if data.get("errorCode") != "INVALID_INPUT":
        raise AssertionError(f"FAIL: Expected 'errorCode': 'INVALID_INPUT', got: {data.get('errorCode')}")
    if not data.get("message"):
        raise AssertionError("FAIL: Expected non-empty 'message' field in error response")

    print("PASS: test_api_predict_demand_missing_field - Returned INVALID_INPUT error format.")


def test_api_response_schema_keys():
    """Confirm the response always includes success, predictedDemandCount/prediction, and modelVersion keys on success."""
    payload = {
        "city": "Mumbai",
        "area_locality": "Andheri West",
        "month": 8,
        "property_count": 100,
        "application_count": 25,
        "agreement_start_count": 10,
        "average_monthly_rent": 45000.0,
        "demand_lag_1_month": 5,
        "demand_lag_2_month": 3,
        "demand_growth_1_month": 0.2,
        "occupancy_rate": 90.0,
        "vacancy_rate": 10.0,
        "available_unit_count": 10
    }
    response = client.post("/m3/predict-demand", json=payload)
    if response.status_code != 200:
        raise AssertionError(f"FAIL: Expected status 200, got {response.status_code}: {response.text}")

    data = response.json()
    if not ("predictedDemandCount" in data or "prediction" in data):
        raise AssertionError(f"FAIL: Missing predictedDemandCount or prediction in API response: {data}")
    if "modelVersion" not in data or "success" not in data:
        raise AssertionError(f"FAIL: Missing success or modelVersion in API response: {data}")

    print("PASS: test_api_response_schema_keys - All standard keys present in success response.")


if __name__ == "__main__":
    tests = [
        ("test_no_data_leakage", test_no_data_leakage),
        ("test_no_overlap_between_train_test", test_no_overlap_between_train_test),
        ("test_all_features_present", test_all_features_present),
        ("test_prediction_is_non_negative", test_prediction_is_non_negative),
        ("test_higher_activity_gives_higher_prediction", test_higher_activity_gives_higher_prediction),
        ("test_api_predict_demand_valid_shape", test_api_predict_demand_valid_shape),
        ("test_api_predict_demand_missing_field", test_api_predict_demand_missing_field),
        ("test_api_response_schema_keys", test_api_response_schema_keys),
    ]

    results = {}
    print("=" * 60)
    print("Running M3 Rental Demand Model & API Tests")
    print("=" * 60)

    for name, test_fn in tests:
        try:
            test_fn()
            results[name] = "PASSED"
        except AssertionError as e:
            print(str(e))
            results[name] = f"FAILED: {e}"
        except Exception as e:
            print(f"FAIL: {name} encountered an unexpected error: {e}")
            results[name] = f"FAILED (Error): {e}"

    print("\n" + "=" * 60)
    print("Test Execution Summary:")
    print("=" * 60)
    passed_count = sum(1 for status in results.values() if status == "PASSED")
    total_count = len(tests)

    for name, status in results.items():
        tag = "PASS" if status == "PASSED" else "FAIL"
        print(f"[{tag}] {name}")

    print(f"\nTotal: {passed_count}/{total_count} tests passed.")
    print("=" * 60)

    if passed_count != total_count:
        sys.exit(1)
