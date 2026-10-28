"""
Compact validation test for parking_required in M2 Property Recommendation.

Tested input values:
  - False, "False", 0  -> expected normalized parking_required = False
  - True, "True", 1    -> expected normalized parking_required = True

Verification criteria:
  - For False cases: parking_match must be 1 for all properties because parking is not required.
  - For True cases: parking_match must be 1 only when the property has parking, otherwise 0.
"""

import sys
from pathlib import Path
import pandas as pd
import pytest

# Ensure M2 directory is on sys.path regardless of execution working directory
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from recommend import calculate_parking_match, normalize_parking_required

# The six test cases specified by requirements
TEST_CASES = [
    (False, False, "bool False"),
    (True, True, "bool True"),
    ("False", False, "str 'False'"),
    ("True", True, "str 'True'"),
    (0, False, "int 0"),
    (1, True, "int 1"),
]


def create_test_properties():
    """Create controlled test properties with and without parking."""
    properties_df = pd.DataFrame({
        "property_id": ["PROP_NO_PARK", "PROP_HAS_PARK"],
        "parking_available": [False, True],
    })
    target_df = pd.DataFrame({
        "property_id": ["PROP_NO_PARK", "PROP_HAS_PARK"],
    })
    return properties_df, target_df


def run_parking_validation():
    """
    Run compact validation test across all six input values and display results.
    Returns True if all tests pass, False otherwise.
    """
    properties_df, target_df = create_test_properties()

    print("=" * 72)
    print(" M2 PARKING_REQUIRED COMPACT VALIDATION TEST")
    print("=" * 72)

    all_passed = True
    results = []

    for raw_val, expected_norm, desc in TEST_CASES:
        prefs = {"parking_required": raw_val}

        # 1. Test normalization
        actual_norm = normalize_parking_required(raw_val)
        norm_ok = (actual_norm is expected_norm)

        # 2. Test calculate_parking_match
        result_df = calculate_parking_match(target_df.copy(), properties_df, prefs)

        match_no_park = result_df.loc[
            result_df["property_id"] == "PROP_NO_PARK", "parking_match"
        ].iloc[0]
        match_has_park = result_df.loc[
            result_df["property_id"] == "PROP_HAS_PARK", "parking_match"
        ].iloc[0]

        # For False cases: parking_match must be 1 for all properties.
        # For True cases: parking_match must be 1 only when property has parking, otherwise 0.
        if not expected_norm:
            match_ok = (match_no_park == 1) and (match_has_park == 1)
        else:
            match_ok = (match_no_park == 0) and (match_has_park == 1)

        test_passed = norm_ok and match_ok
        if not test_passed:
            all_passed = False

        status = "PASS" if test_passed else "FAIL"
        results.append({
            "Input Value": repr(raw_val),
            "Type": type(raw_val).__name__,
            "Expected": expected_norm,
            "Normalized": actual_norm,
            "Match(No Park)": match_no_park,
            "Match(Has Park)": match_has_park,
            "Status": status,
        })

    summary_df = pd.DataFrame(results)
    print(summary_df.to_string(index=False))
    print("=" * 72)

    if all_passed:
        print("OVERALL RESULT: ALL 6 TESTS PASSED")
    else:
        print("OVERALL RESULT: SOME TESTS FAILED")
    print("=" * 72)

    return all_passed


# Pytest test function parameterized over the six test cases
@pytest.mark.parametrize("raw_val, expected_norm, desc", TEST_CASES)
def test_parking_required(raw_val, expected_norm, desc):
    properties_df, target_df = create_test_properties()
    prefs = {"parking_required": raw_val}

    # 1. Verify normalization
    actual_norm = normalize_parking_required(raw_val)
    assert actual_norm is expected_norm, (
        f"Normalization failed for {raw_val} ({desc}): expected {expected_norm}, got {actual_norm}"
    )

    # 2. Verify calculate_parking_match behavior
    result_df = calculate_parking_match(target_df.copy(), properties_df, prefs)

    match_no_park = result_df.loc[
        result_df["property_id"] == "PROP_NO_PARK", "parking_match"
    ].iloc[0]
    match_has_park = result_df.loc[
        result_df["property_id"] == "PROP_HAS_PARK", "parking_match"
    ].iloc[0]

    if not expected_norm:
        # False cases: parking_match must be 1 for all properties
        assert match_no_park == 1, (
            f"Expected parking_match=1 for property without parking when parking_required is False ({raw_val})"
        )
        assert match_has_park == 1, (
            f"Expected parking_match=1 for property with parking when parking_required is False ({raw_val})"
        )
    else:
        # True cases: parking_match must be 1 only when property has parking, otherwise 0
        assert match_no_park == 0, (
            f"Expected parking_match=0 for property without parking when parking_required is True ({raw_val})"
        )
        assert match_has_park == 1, (
            f"Expected parking_match=1 for property with parking when parking_required is True ({raw_val})"
        )


if __name__ == "__main__":
    success = run_parking_validation()
    sys.exit(0 if success else 1)
