from fastapi import FastAPI
from fastapi.testclient import TestClient

try:
    from .api import router
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from m6_profitability_prediction.api import router


app = FastAPI()
app.include_router(router)

client = TestClient(app)


payload = {
    "city": "Hyderabad",
    "size_sqft": 1200,
    "bedrooms_bhk": 2,
    "property_age_years": 5,
    "monthly_rent": 25000,
    "collected_rent": 24000,
    "expense_amount": 5000,
    "current_month_profit": 19000,
    "occupancy_rate": 0.95,
    "estimated_vacancy_loss": 1250,
    "revenue_after_estimated_vacancy_loss": 22750,
    "collected_rent_3m_avg": 23500,
    "expense_amount_3m_avg": 4800,
    "current_month_profit_3m_avg": 18700,
    "occupancy_rate_3m_avg": 0.94,
    "estimated_vacancy_loss_3m_avg": 1400,
    "collected_rent_6m_avg": 23000,
    "expense_amount_6m_avg": 4700,
    "current_month_profit_6m_avg": 18300,
    "occupancy_rate_6m_avg": 0.93,
    "estimated_vacancy_loss_6m_avg": 1500,
    "collected_rent_trend": 0.05,
    "expense_amount_trend": 0.02,
    "current_month_profit_trend": 0.04,
    "occupancy_rate_trend": 0.01,
    "estimated_vacancy_loss_trend": -0.02,
}


response = client.post("/m6/predict-profitability", json=payload)

print("Status code:", response.status_code)
print("Response:")
print(response.json())

# Test 2: Invalid occupancy rate
invalid_payload = payload.copy()
invalid_payload["occupancy_rate"] = 1.5

response = client.post(
    "/m6/predict-profitability",
    json=invalid_payload
)

print("\nInvalid occupancy test:")
print("Status code:", response.status_code)
print("Response:", response.json())
# Test 3: Missing required feature
from copy import deepcopy

from fastapi import FastAPI
from fastapi.testclient import TestClient

try:
    from .api import router
except ImportError:
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from m6_profitability_prediction.api import router


app = FastAPI()
app.include_router(router)
client = TestClient(app)


# Valid synthetic property payload: all 26 required model features.
PAYLOAD = {
    "city": "Hyderabad",
    "size_sqft": 1200,
    "bedrooms_bhk": 2,
    "property_age_years": 5,
    "monthly_rent": 25000,
    "collected_rent": 24000,
    "expense_amount": 5000,
    "current_month_profit": 19000,
    "occupancy_rate": 0.95,
    "estimated_vacancy_loss": 1250,
    "revenue_after_estimated_vacancy_loss": 22750,
    "collected_rent_3m_avg": 23500,
    "expense_amount_3m_avg": 4800,
    "current_month_profit_3m_avg": 18700,
    "occupancy_rate_3m_avg": 0.94,
    "estimated_vacancy_loss_3m_avg": 1400,
    "collected_rent_6m_avg": 23000,
    "expense_amount_6m_avg": 4700,
    "current_month_profit_6m_avg": 18300,
    "occupancy_rate_6m_avg": 0.93,
    "estimated_vacancy_loss_6m_avg": 1500,
    "collected_rent_trend": 0.05,
    "expense_amount_trend": 0.02,
    "current_month_profit_trend": 0.04,
    "occupancy_rate_trend": 0.01,
    "estimated_vacancy_loss_trend": -0.02,
}

ENDPOINTS = [
    "/m6/predict-profitability",
    "/m6/predict",
]

passed = 0
failed = 0
results = []


def check(name, condition, details=""):
    global passed, failed

    status = "PASS" if condition else "FAIL"
    passed += int(condition)
    failed += int(not condition)
    results.append((name, status, details))

    print(f"[{status}] {name}")
    if details:
        print(f"       {details}")


def run_tests():
    print("\n========== M6 API TEST SUITE ==========\n")

    # 1. Health and module information routes
    for path in ("/m6/health", "/m6/"):
        try:
            response = client.get(path)
            check(
                f"GET {path}",
                response.status_code == 200,
                f"HTTP {response.status_code}",
            )
        except Exception as exc:
            check(f"GET {path}", False, repr(exc))

    # 2. Both prediction endpoints with valid data
    successful_responses = {}

    for endpoint in ENDPOINTS:
        try:
            response = client.post(endpoint, json=deepcopy(PAYLOAD))
            body = response.json()

            valid = (
                response.status_code == 200
                and body.get("success") is True
                and isinstance(body.get("predicted_next_month_profit"), (int, float))
                and body.get("profitability_label") in (0, 1)
                and isinstance(body.get("profitability_probability"), (int, float))
                and 0 <= body["profitability_probability"] <= 1
                and isinstance(body.get("financial_analysis"), dict)
            )

            check(
                f"Valid prediction: {endpoint}",
                valid,
                f"HTTP {response.status_code}; response keys={list(body.keys())}",
            )

            if response.status_code == 200:
                successful_responses[endpoint] = body

        except Exception as exc:
            check(f"Valid prediction: {endpoint}", False, repr(exc))

    # 3. Both endpoints should return consistent model predictions.
    if len(successful_responses) == 2:
        first = successful_responses[ENDPOINTS[0]]
        second = successful_responses[ENDPOINTS[1]]

        consistent = (
            abs(
                first["predicted_next_month_profit"]
                - second["predicted_next_month_profit"]
            ) < 1e-6
            and first["profitability_label"] == second["profitability_label"]
            and abs(
                first["profitability_probability"]
                - second["profitability_probability"]
            ) < 1e-6
        )
        check("Prediction endpoint consistency", consistent)
    else:
        check(
            "Prediction endpoint consistency",
            False,
            "Skipped because both endpoints did not return HTTP 200.",
        )

    # 4. Occupancy rate above its allowed range.
    invalid = deepcopy(PAYLOAD)
    invalid["occupancy_rate"] = 1.5
    response = client.post(ENDPOINTS[0], json=invalid)
    check(
        "Reject occupancy_rate > 1",
        response.status_code == 422,
        f"HTTP {response.status_code}",
    )

    # 5. Negative monthly rent.
    invalid = deepcopy(PAYLOAD)
    invalid["monthly_rent"] = -100
    response = client.post(ENDPOINTS[0], json=invalid)
    check(
        "Reject negative monthly_rent",
        response.status_code == 422,
        f"HTTP {response.status_code}",
    )

    # 6. Missing required feature.
    invalid = deepcopy(PAYLOAD)
    invalid.pop("monthly_rent")
    response = client.post(ENDPOINTS[0], json=invalid)
    check(
        "Reject missing monthly_rent",
        response.status_code == 422,
        f"HTTP {response.status_code}",
    )

    # 7. Unknown city should be handled by OneHotEncoder(handle_unknown='ignore').
    unknown_city = deepcopy(PAYLOAD)
    unknown_city["city"] = "Unseen_Test_City_987"

    try:
        response = client.post(ENDPOINTS[0], json=unknown_city)
        check(
            "Unknown city handling",
            response.status_code == 200,
            f"HTTP {response.status_code}",
        )
    except Exception as exc:
        check("Unknown city handling", False, repr(exc))

    # 8. Verify financial arithmetic and source selection.
    if ENDPOINTS[0] in successful_responses:
        financial = successful_responses[ENDPOINTS[0]].get(
            "financial_analysis", {}
        )

        check(
            "Financial effective income",
            financial.get("effective_monthly_income") == 22750.0,
            f"Actual: {financial.get('effective_monthly_income')}",
        )

        check(
            "Financial monthly NOI",
            financial.get("net_monthly_operating_income") == 17750.0,
            f"Actual: {financial.get('net_monthly_operating_income')}",
        )

        check(
            "Financial annualized NOI",
            financial.get("annualized_net_operating_income") == 213000.0,
            f"Actual: {financial.get('annualized_net_operating_income')}",
        )

        check(
            "Income source reported",
            financial.get("income_calculation_source")
            == "revenue_after_estimated_vacancy_loss",
            f"Actual: {financial.get('income_calculation_source')}",
        )
    else:
        check(
            "Financial calculations",
            False,
            "Skipped because the main prediction endpoint failed.",
        )

    # 9. No cap rate supplied: property value should remain unavailable.
    if ENDPOINTS[0] in successful_responses:
        financial = successful_responses[ENDPOINTS[0]].get(
            "financial_analysis", {}
        )
        check(
            "Property value omitted without cap rate",
            financial.get("indicative_property_value") is None,
            f"Actual: {financial.get('indicative_property_value')}",
        )

        # Separate expenses were not supplied, so breakdown should be incomplete.
        check(
            "Expense breakdown reflects missing details",
            financial.get("expense_breakdown_complete") is False,
            f"Actual: {financial.get('expense_breakdown_complete')}",
        )

    # 10. Cap rate supplied: check whether property value is calculated.
    cap_rate_payload = deepcopy(PAYLOAD)
    cap_rate_payload["capitalization_rate"] = 8

    response = client.post(ENDPOINTS[0], json=cap_rate_payload)
    if response.status_code == 200:
        financial = response.json().get("financial_analysis", {})
        expected_value = 213000 / 0.08
        actual_value = financial.get("indicative_property_value")

        check(
            "Property value with 8% cap rate",
            isinstance(actual_value, (int, float))
            and abs(actual_value - expected_value) < 0.01,
            f"Expected: {expected_value}; actual: {actual_value}",
        )
    else:
        check(
            "Property value with 8% cap rate",
            False,
            f"HTTP {response.status_code}: {response.text}",
        )

    # 11. Invalid cap rate should be rejected by schema validation.
    invalid = deepcopy(PAYLOAD)
    invalid["capitalization_rate"] = 0
    response = client.post(ENDPOINTS[0], json=invalid)
    check(
        "Reject zero capitalization rate",
        response.status_code == 422,
        f"HTTP {response.status_code}",
    )

    # 12. Nonexistent route should return 404.
    response = client.post("/m6/this-route-does-not-exist", json=PAYLOAD)
    check(
        "Unknown route returns 404",
        response.status_code == 404,
        f"HTTP {response.status_code}",
    )

    print("\n========== TEST SUMMARY ==========")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Total:  {passed + failed}")

    if failed:
        print("\nReview the FAIL entries above. A failure may indicate")
        print("a code defect, a schema mismatch, or an incorrect test assumption.")


if __name__ == "__main__":
    run_tests()

missing_payload = payload.copy()
missing_payload.pop("monthly_rent")

response = client.post(
    "/m6/predict-profitability",
    json=missing_payload
)

print("\nMissing required field test:")
print("Status code:", response.status_code)
print("Response:", response.json())