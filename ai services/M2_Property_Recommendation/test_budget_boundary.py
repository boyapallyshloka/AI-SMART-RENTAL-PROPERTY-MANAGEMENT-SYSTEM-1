"""
Compact boundary test for M2 budget hard-filter rule.

Rule:
    A property is eligible only if:
        monthly_rent <= max_budget * 1.05 (5% budget tolerance)

Boundary conditions tested (using temporary/in-memory test data):
    - monthly_rent < max_budget * 1.05  -> ACCEPTED
    - monthly_rent == max_budget * 1.05 -> ACCEPTED (exact upper threshold)
    - monthly_rent > max_budget * 1.05  -> REJECTED (above threshold)

Production M2 datasets and scoring logic remain completely untouched.
"""

import sys
from pathlib import Path
import pandas as pd
import pytest

# Ensure M2 directory is on sys.path regardless of working directory
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from recommend import filter_properties, recommend_properties


# Standard test preference for boundary evaluation
BASE_BUDGET = 20000.0
TOLERANCE_MULTIPLIER = 1.05
BUDGET_LIMIT = BASE_BUDGET * TOLERANCE_MULTIPLIER  # 21000.0

TEST_PREFERENCES = {
    "tenant_id": "T_TEST_001",
    "preferred_city": "Mumbai",
    "min_bedrooms": 2,
    "max_budget": BASE_BUDGET,
    "preferred_property_type": "APARTMENT",
    "preferred_furnishing": "FURNISHED",
    "parking_required": False,
    "amenity_preference": "POWER_BACKUP",
    "max_commute_distance_km": 30.0,
}

# Explicit boundary test cases around the 1.05 threshold
BOUNDARY_CASES = [
    {
        "property_id": "PROP_BELOW_BUDGET",
        "monthly_rent": 18000.0,
        "desc": "Rent well below max_budget (18,000 <= 21,000)",
        "expected_accepted": True,
    },
    {
        "property_id": "PROP_AT_MAX_BUDGET",
        "monthly_rent": 20000.0,
        "desc": "Rent exactly at max_budget (20,000 <= 21,000)",
        "expected_accepted": True,
    },
    {
        "property_id": "PROP_EXACT_BOUNDARY",
        "monthly_rent": 21000.0,
        "desc": "Rent exactly at max_budget * 1.05 (21,000 <= 21,000)",
        "expected_accepted": True,
    },
    {
        "property_id": "PROP_JUST_ABOVE_BOUNDARY",
        "monthly_rent": 21000.01,
        "desc": "Rent 1 cent above max_budget * 1.05 (21,000.01 > 21,000)",
        "expected_accepted": False,
    },
    {
        "property_id": "PROP_SLIGHTLY_ABOVE_BOUNDARY",
        "monthly_rent": 21001.0,
        "desc": "Rent 1 rupee above max_budget * 1.05 (21,001 > 21,000)",
        "expected_accepted": False,
    },
    {
        "property_id": "PROP_WELL_ABOVE_BOUNDARY",
        "monthly_rent": 25000.0,
        "desc": "Rent well above max_budget * 1.05 (25,000 > 21,000)",
        "expected_accepted": False,
    },
]


def create_in_memory_dataset():
    """Create in-memory temporary DataFrame with boundary test properties."""
    rows = []
    for case in BOUNDARY_CASES:
        rows.append({
            "tenant_id": TEST_PREFERENCES["tenant_id"],
            "property_id": case["property_id"],
            "property_city": TEST_PREFERENCES["preferred_city"],
            "property_bedrooms": TEST_PREFERENCES["min_bedrooms"],
            "monthly_rent": case["monthly_rent"],
            "max_budget": TEST_PREFERENCES["max_budget"],
            "min_bedrooms": TEST_PREFERENCES["min_bedrooms"],
            "preferred_city": TEST_PREFERENCES["preferred_city"],
            "approx_distance_km": 10.0,
        })
    return pd.DataFrame(rows)


def run_budget_boundary_validation():
    """
    Execute boundary validation on filter_properties and report PASS/FAIL.
    """
    df_test = create_in_memory_dataset()

    print("=" * 82)
    print(" M2 BUDGET HARD-FILTER BOUNDARY TEST (5% TOLERANCE)")
    print(f" Base Budget: {BASE_BUDGET:,.2f} | Limit (Budget * 1.05): {BUDGET_LIMIT:,.2f}")
    print("=" * 82)

    filtered_df = filter_properties(df_test, TEST_PREFERENCES)
    accepted_ids = set(filtered_df["property_id"].tolist())

    all_passed = True
    results = []

    for case in BOUNDARY_CASES:
        pid = case["property_id"]
        rent = case["monthly_rent"]
        expected = case["expected_accepted"]
        actual = pid in accepted_ids

        status_ok = (actual == expected)
        if not status_ok:
            all_passed = False

        diff_from_limit = rent - BUDGET_LIMIT
        diff_str = f"{diff_from_limit:+.2f}"

        results.append({
            "Property ID": pid,
            "Monthly Rent": f"{rent:,.2f}",
            "Diff to Limit": diff_str,
            "Expected": "ACCEPTED" if expected else "REJECTED",
            "Actual": "ACCEPTED" if actual else "REJECTED",
            "Status": "PASS" if status_ok else "FAIL",
        })

    results_df = pd.DataFrame(results)
    print(results_df.to_string(index=False))
    print("=" * 82)

    # Secondary assertion: verify exact boundary behavior
    exact_boundary_accepted = "PROP_EXACT_BOUNDARY" in accepted_ids
    just_above_rejected = "PROP_JUST_ABOVE_BOUNDARY" not in accepted_ids

    print(f"Boundary Check (rent == limit): {'PASS' if exact_boundary_accepted else 'FAIL'}")
    print(f"Boundary Check (rent > limit) : {'PASS' if just_above_rejected else 'FAIL'}")
    print("=" * 82)

    if all_passed and exact_boundary_accepted and just_above_rejected:
        print("OVERALL RESULT: ALL BUDGET BOUNDARY TESTS PASSED")
    else:
        print("OVERALL RESULT: BUDGET BOUNDARY TESTS FAILED")
    print("=" * 82)

    return all_passed


# Pytest parameterized unit tests
@pytest.mark.parametrize("case", BOUNDARY_CASES)
def test_budget_filter_boundary(case):
    """Test each boundary condition individually using isolated in-memory data."""
    test_df = pd.DataFrame([{
        "tenant_id": TEST_PREFERENCES["tenant_id"],
        "property_id": case["property_id"],
        "property_city": TEST_PREFERENCES["preferred_city"],
        "property_bedrooms": TEST_PREFERENCES["min_bedrooms"],
        "monthly_rent": case["monthly_rent"],
    }])

    filtered = filter_properties(test_df, TEST_PREFERENCES)
    was_accepted = not filtered.empty

    if case["expected_accepted"]:
        assert was_accepted, (
            f"Expected {case['property_id']} with rent {case['monthly_rent']} "
            f"to be ACCEPTED (budget_limit={BUDGET_LIMIT})"
        )
    else:
        assert not was_accepted, (
            f"Expected {case['property_id']} with rent {case['monthly_rent']} "
            f"to be REJECTED (budget_limit={BUDGET_LIMIT})"
        )


def test_end_to_end_recommendation_budget_filter():
    """Verify that rejected properties never enter the scored recommendations."""
    df_test = create_in_memory_dataset()

    properties_meta = pd.DataFrame([
        {
            "property_id": case["property_id"],
            "property_type": "APARTMENT",
            "furnishing_status": "FURNISHED",
            "parking_available": True,
        }
        for case in BOUNDARY_CASES
    ])

    amenities_meta = pd.DataFrame([
        {
            "property_id": case["property_id"],
            "amenity": "POWER_BACKUP",
        }
        for case in BOUNDARY_CASES
    ])

    recs = recommend_properties(
        df=df_test,
        properties=properties_meta,
        property_amenities=amenities_meta,
        preferences=TEST_PREFERENCES,
        top_n=10,
    )

    recommended_ids = set(recs["property_id"].tolist())

    # All accepted boundary cases should be eligible for recommendation
    assert "PROP_EXACT_BOUNDARY" in recommended_ids
    assert "PROP_AT_MAX_BUDGET" in recommended_ids
    assert "PROP_BELOW_BUDGET" in recommended_ids

    # None of the cases above budget limit must ever be recommended
    assert "PROP_JUST_ABOVE_BOUNDARY" not in recommended_ids
    assert "PROP_SLIGHTLY_ABOVE_BOUNDARY" not in recommended_ids
    assert "PROP_WELL_ABOVE_BOUNDARY" not in recommended_ids


if __name__ == "__main__":
    success = run_budget_boundary_validation()
    sys.exit(0 if success else 1)
