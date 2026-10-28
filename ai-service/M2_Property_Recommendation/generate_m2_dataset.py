"""
generate_m2_dataset.py
======================
Generates the M2 Property Recommendation dataset (data/ml/M2_Property_Recommendation.csv)
from source operational data:
  - data/tenant_preferences.csv
  - data/properties_enriched.csv
  - data/property_amenities.csv

Candidate Selection & Generation Rules:
  1. Candidate Pool Eligibility (Hard Constraints):
     - Property city matches tenant's preferred city.
     - Property bedrooms >= tenant's min_bedrooms.
     - Property monthly_rent <= tenant's max_budget * 1.05 (5% budget tolerance).
  2. Deterministic & Preference-Relevant Selection (Zero Randomness):
     - For each tenant, candidates are ranked deterministically by:
       a. recommendation_score DESC (using existing weights)
       b. city_match DESC
       c. budget_gap DESC (greater budget savings ranked higher)
       d. approx_distance_km ASC (closer distance ranked higher)
       e. property_id ASC (deterministic tie-breaker)
     - The top 25 candidates per tenant are retained (5x the requested top 5).
  3. Feature Computations (20-column schema):
     - Exact match features: city_match, budget_match, budget_gap, bedroom_match,
       furnishing_match, parking_match, amenity_match, distance_match, property_type_match.
     - approx_distance_km: Synthetic/approximate intra-city commute distance (2.0 - 12.0 km)
       generated deterministically via hash because source data contains no lat/long coordinates.
     - match_score: (0.30*city + 0.22*budget + 0.18*bedroom + 0.10*parking + 0.08*amenity).round(2)
     - match_label: (match_score >= 0.65).astype(int)
  4. Full Pre-Save Integrity & Consistency Validation:
     - Zero duplicate (tenant_id, property_id) pairs.
     - All tenant IDs exist in tenant_preferences.csv.
     - All property IDs exist in properties_enriched.csv.
     - 100% feature consistency across all audit and recommendation formulas.
"""

from pathlib import Path
import sys
import time
import numpy as np
import pandas as pd


# ----------------------------------------------------------------------
# Paths (relative to script location for robust execution from any cwd)
# ----------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = BASE_DIR.parent
DATA_DIR = AI_SERVICE_DIR / "data"

TENANT_PREFERENCES_PATH = DATA_DIR / "tenant_preferences.csv"
PROPERTIES_PATH = DATA_DIR / "properties_enriched.csv"
PROPERTY_AMENITIES_PATH = DATA_DIR / "property_amenities.csv"
OUTPUT_M2_PATH = DATA_DIR / "ml" / "M2_Property_Recommendation.csv"

CANDIDATES_PER_TENANT = 25

FURNISHING_MAP = {
    "FULLY_FURNISHED": "FURNISHED",
    "SEMI_FURNISHED": "SEMI-FURNISHED",
    "UNFURNISHED": "UNFURNISHED",
}

FINAL_M2_COLUMNS = [
    "tenant_id",
    "property_id",
    "preferred_city",
    "property_city",
    "max_budget",
    "monthly_rent",
    "budget_gap",
    "min_bedrooms",
    "property_bedrooms",
    "city_match",
    "budget_match",
    "bedroom_match",
    "furnishing_match",
    "parking_match",
    "amenity_match",
    "match_score",
    "match_label",
    "approx_distance_km",
    "distance_match",
    "property_type_match",
]


def norm(value):
    """Normalize text for reliable string matching."""
    return str(value).strip().lower().replace("_", " ").replace("-", " ")


def load_source_data():
    """Load and validate existence of all three source datasets."""
    print("Loading source datasets...")
    for path in [TENANT_PREFERENCES_PATH, PROPERTIES_PATH, PROPERTY_AMENITIES_PATH]:
        if not path.exists():
            raise FileNotFoundError(f"Required source file not found: {path}")

    tenants = pd.read_csv(TENANT_PREFERENCES_PATH)
    properties = pd.read_csv(PROPERTIES_PATH)
    amenities = pd.read_csv(PROPERTY_AMENITIES_PATH)

    print(f"  Loaded {len(tenants):,} tenant records.")
    print(f"  Loaded {len(properties):,} property records.")
    print(f"  Loaded {len(amenities):,} amenity records.")
    return tenants, properties, amenities


def compute_amenity_lookup(amenities, properties, tenant_amenity_preferences):
    """Pre-compute set of property_ids matching each unique amenity preference."""
    prop_amenities = (
        amenities.assign(amenity_norm=amenities["amenity"].map(norm))
        .groupby("property_id")["amenity_norm"]
        .agg(set)
    )

    all_property_ids = set(properties["property_id"])
    lookup = {}
    for pref in tenant_amenity_preferences.dropna().unique():
        pref_norm = norm(pref)
        if pref_norm in {"", "none", "no preference", "nan"}:
            lookup[pref] = all_property_ids
        else:
            matching_props = set(
                prop_amenities[
                    prop_amenities.apply(lambda s: pref_norm in s)
                ].index
            )
            lookup[pref] = matching_props
    return lookup


def generate_candidate_pool(tenants, properties, amenities, top_k=CANDIDATES_PER_TENANT):
    """
    Generate candidate pool respecting hard constraints, then rank candidates
    deterministically using preference-relevant criteria to retain top_k per tenant.
    """
    t0 = time.time()
    print("\nGenerating candidate pool...")

    # Normalize cities for merge
    tenants = tenants.copy()
    properties = properties.copy()
    tenants["city_norm"] = tenants["preferred_city"].map(norm)
    properties["city_norm"] = properties["city"].map(norm)

    # 1. Eligibility join: match on city
    merged = tenants.merge(
        properties,
        on="city_norm",
        how="inner",
        suffixes=("_tenant", "_property"),
    )

    # 2. Hard constraint filtering:
    #    - bedrooms_bhk >= min_bedrooms
    #    - monthly_rent <= max_budget * 1.05
    budget_limit = merged["max_budget"] * 1.05
    eligible = merged[
        (merged["bedrooms_bhk"] >= merged["min_bedrooms"])
        & (merged["monthly_rent"] <= budget_limit)
    ].copy()

    total_eligible = len(eligible)
    tenants_with_candidates = eligible["tenant_id"].nunique()
    print(f"  Eligible candidate pairs across all tenants: {total_eligible:,}")
    print(f"  Tenants with >= 1 eligible candidate: {tenants_with_candidates:,} / {len(tenants):,}")

    # 3. Calculate all features for ranking and final schema
    # Core spec columns
    eligible["property_city"] = eligible["city"]
    eligible["property_bedrooms"] = eligible["bedrooms_bhk"]
    eligible["city_match"] = 1
    eligible["bedroom_match"] = 1
    eligible["budget_match"] = (eligible["monthly_rent"] <= eligible["max_budget"]).astype(int)

    # Budget gap (as stored in M2 CSV: max(0, rent - budget); 0 when at/under budget)
    eligible["budget_gap"] = np.maximum(
        0.0, eligible["monthly_rent"] - eligible["max_budget"]
    ).round(2)

    # Furnishing match
    t_furn = eligible["preferred_furnishing"].map(FURNISHING_MAP)
    p_furn = eligible["furnishing_status"].astype(str).str.strip().str.upper()
    eligible["furnishing_match"] = (t_furn == p_furn).astype(int)

    # Parking match (True/1/yes/required)
    t_park_req = (
        eligible["parking_required"]
        .astype(str)
        .str.strip()
        .str.lower()
        .isin(["true", "1", "yes", "required"])
    )
    p_park_avail = (
        eligible["parking_available"]
        .astype(str)
        .str.strip()
        .str.lower()
        .isin(["true", "1", "yes"])
    )
    eligible["parking_match"] = ((~t_park_req) | p_park_avail).astype(int)

    # Property type match
    t_ptype = eligible["preferred_property_type"].astype(str).str.strip().str.upper()
    p_ptype = eligible["property_type"].astype(str).str.strip().str.upper()
    eligible["property_type_match"] = (t_ptype == p_ptype).astype(int)

    # Amenity match
    amenity_lookup = compute_amenity_lookup(
        amenities, properties, tenants["amenity_preference"]
    )
    amenity_match = np.zeros(len(eligible), dtype=int)
    for pref, prop_set in amenity_lookup.items():
        mask = eligible["amenity_preference"] == pref
        if mask.any():
            amenity_match[mask] = eligible.loc[mask, "property_id"].isin(prop_set).astype(int)
    eligible["amenity_match"] = amenity_match

    # approx_distance_km:
    # Synthetic/approximate intra-city commute distance between 2.0 km and 12.0 km.
    # Note: Source data lacks geographic coordinates (latitude/longitude), so this
    # distance is generated deterministically via an integer hash of tenant_id and property_id.
    t_int = eligible["tenant_id"].str[1:].astype(int)
    p_int = eligible["property_id"].str[1:].astype(int)
    eligible["approx_distance_km"] = np.round(
        ((t_int * 31 + p_int * 17) % 101) * 0.1 + 2.0, 1
    )

    # distance_match
    eligible["distance_match"] = (
        eligible["approx_distance_km"] <= eligible["max_commute_distance_km"]
    ).astype(int)

    # M2 development classification targets
    eligible["match_score"] = (
        0.30 * eligible["city_match"]
        + 0.22 * eligible["budget_match"]
        + 0.18 * eligible["bedroom_match"]
        + 0.10 * eligible["parking_match"]
        + 0.08 * eligible["amenity_match"]
    ).round(2)
    eligible["match_label"] = (eligible["match_score"] >= 0.65).astype(int)

    # Continuous budget score and recommendation score for deterministic candidate pool ranking
    # (Matches calculate_recommendation_score in recommend.py)
    budget_score = (eligible["max_budget"] / eligible["monthly_rent"]).clip(upper=1.0)
    eligible["rec_score_for_ranking"] = (
        0.25 * eligible["city_match"]
        + 0.25 * budget_score
        + 0.15 * eligible["bedroom_match"]
        + 0.10 * eligible["property_type_match"]
        + 0.10 * eligible["furnishing_match"]
        + 0.10 * eligible["amenity_match"]
        + 0.05 * eligible["parking_match"]
    ) * 100

    # budget_savings for tie-breaking: max_budget - monthly_rent (larger = better savings)
    eligible["budget_savings"] = eligible["max_budget"] - eligible["monthly_rent"]

    # 4. Deterministic ranking per tenant:
    #    Sort by: rec_score_for_ranking DESC, city_match DESC, budget_savings DESC,
    #             approx_distance_km ASC, property_id ASC
    eligible = eligible.sort_values(
        by=[
            "tenant_id",
            "rec_score_for_ranking",
            "city_match",
            "budget_savings",
            "approx_distance_km",
            "property_id",
        ],
        ascending=[True, False, False, False, True, True],
    )

    # 5. Cap to top_k candidates per tenant
    if top_k is not None:
        print(f"  Selecting top {top_k} candidates per tenant...")
        eligible = eligible.groupby("tenant_id", as_index=False).head(top_k)

    final_df = eligible[FINAL_M2_COLUMNS].copy()
    print(f"  Final candidate dataset prepared in {time.time() - t0:.2f}s: {len(final_df):,} rows.")
    return final_df


def validate_generated_dataset(m2_df, tenants_df, properties_df, amenities_df):
    """
    Run comprehensive integrity and consistency validation before saving:
      1. Required columns & 20-column schema
      2. No null values in any column
      3. No duplicate (tenant_id, property_id)
      4. Foreign key integrity: all tenant_ids in tenant_preferences, all property_ids in properties_enriched
      5. Eligibility criteria: city_match==1, bedroom_match==1, monthly_rent <= max_budget * 1.05
      6. Consistency of furnishing_match, parking_match, amenity_match, property_type_match
      7. Consistency of distance_match
      8. Consistency of match_score and match_label
    """
    print("\nRunning pre-save dataset validations...")

    # 1. Schema check
    if list(m2_df.columns) != FINAL_M2_COLUMNS:
        raise ValueError(
            f"Schema mismatch!\nExpected: {FINAL_M2_COLUMNS}\nGot: {list(m2_df.columns)}"
        )
    print("  [PASS] 20-column M2 schema matches exactly.")

    # 2. Null checks
    if m2_df.isna().any().any():
        null_cols = m2_df.columns[m2_df.isna().any()].tolist()
        raise ValueError(f"Null values found in columns: {null_cols}")
    print("  [PASS] Zero null values across all columns.")

    # 3. Duplicate check
    duplicates = m2_df.duplicated(subset=["tenant_id", "property_id"], keep=False)
    if duplicates.any():
        raise ValueError(
            f"Found {duplicates.sum()} duplicate (tenant_id, property_id) records!"
        )
    print("  [PASS] Zero duplicate (tenant_id, property_id) pairs.")

    # 4. Foreign key integrity
    m2_tenant_ids = set(m2_df["tenant_id"])
    source_tenant_ids = set(tenants_df["tenant_id"])
    invalid_tenants = m2_tenant_ids - source_tenant_ids
    if invalid_tenants:
        raise ValueError(f"Found {len(invalid_tenants)} unknown tenant IDs in M2 dataset!")
    print(f"  [PASS] All {len(m2_tenant_ids):,} tenant IDs exist in tenant_preferences.csv.")

    m2_property_ids = set(m2_df["property_id"])
    source_property_ids = set(properties_df["property_id"])
    invalid_props = m2_property_ids - source_property_ids
    if invalid_props:
        raise ValueError(f"Found {len(invalid_props)} unknown property IDs in M2 dataset!")
    print(f"  [PASS] All {len(m2_property_ids):,} property IDs exist in properties_enriched.csv.")

    # 5. Eligibility checks
    if not (m2_df["city_match"] == 1).all():
        raise ValueError("Candidate pool contains records with city_match != 1.")
    if not (m2_df["bedroom_match"] == 1).all():
        raise ValueError("Candidate pool contains records with bedroom_match != 1.")
    if not (m2_df["monthly_rent"] <= m2_df["max_budget"] * 1.05 + 1e-6).all():
        raise ValueError("Candidate pool contains records exceeding 5% budget limit.")
    print("  [PASS] All candidates satisfy city, bedroom, and budget eligibility.")

    # 6. Audit feature consistency
    # Parking consistency
    tenants_indexed = tenants_df.set_index("tenant_id")
    props_indexed = properties_df.set_index("property_id")

    req_park = (
        m2_df["tenant_id"]
        .map(tenants_indexed["parking_required"])
        .astype(str)
        .str.strip()
        .str.lower()
        .isin(["true", "1", "yes", "required"])
    )
    avail_park = (
        m2_df["property_id"]
        .map(props_indexed["parking_available"])
        .astype(str)
        .str.strip()
        .str.lower()
        .isin(["true", "1", "yes"])
    )
    expected_park = ((~req_park) | avail_park).astype(int)
    if not (m2_df["parking_match"] == expected_park).all():
        raise ValueError("Parking match inconsistency detected!")
    print("  [PASS] Parking match is 100% consistent with audit.py rules.")

    # Amenity consistency
    prop_amenities = (
        amenities_df.assign(amenity_normalized=amenities_df["amenity"].map(norm))
        .groupby("property_id")["amenity_normalized"]
        .agg(set)
    )
    t_amenity_pref = m2_df["tenant_id"].map(tenants_indexed["amenity_preference"]).map(norm)
    p_amenities = m2_df["property_id"].map(prop_amenities)

    def check_amenity(pref, avail_set):
        if pref in {"", "none", "no preference", "nan"}:
            return 1
        if not isinstance(avail_set, set):
            return 0
        return int(pref in avail_set)

    expected_amenity = [
        check_amenity(pref, avail) for pref, avail in zip(t_amenity_pref, p_amenities)
    ]
    if not (m2_df["amenity_match"] == expected_amenity).all():
        raise ValueError("Amenity match inconsistency detected!")
    print("  [PASS] Amenity match is 100% consistent with audit.py rules.")

    # Furnishing consistency
    t_furn = m2_df["tenant_id"].map(tenants_indexed["preferred_furnishing"]).map(FURNISHING_MAP)
    p_furn = m2_df["property_id"].map(props_indexed["furnishing_status"]).astype(str).str.strip().str.upper()
    expected_furn = (t_furn == p_furn).astype(int)
    if not (m2_df["furnishing_match"] == expected_furn).all():
        raise ValueError("Furnishing match inconsistency detected!")
    print("  [PASS] Furnishing match is 100% consistent with property master.")

    # Property type consistency
    t_ptype = m2_df["tenant_id"].map(tenants_indexed["preferred_property_type"]).astype(str).str.strip().str.upper()
    p_ptype = m2_df["property_id"].map(props_indexed["property_type"]).astype(str).str.strip().str.upper()
    expected_ptype = (t_ptype == p_ptype).astype(int)
    if not (m2_df["property_type_match"] == expected_ptype).all():
        raise ValueError("Property type match inconsistency detected!")
    print("  [PASS] Property type match is 100% consistent with property master.")

    # Distance match consistency
    t_max_dist = m2_df["tenant_id"].map(tenants_indexed["max_commute_distance_km"]).astype(float)
    expected_dist_match = (m2_df["approx_distance_km"] <= t_max_dist).astype(int)
    if not (m2_df["distance_match"] == expected_dist_match).all():
        raise ValueError("Distance match inconsistency detected!")
    print("  [PASS] Distance match is 100% consistent with tenant commute limits.")

    # Match score & label consistency
    expected_score = (
        0.30 * m2_df["city_match"]
        + 0.22 * m2_df["budget_match"]
        + 0.18 * m2_df["bedroom_match"]
        + 0.10 * m2_df["parking_match"]
        + 0.08 * m2_df["amenity_match"]
    ).round(2)
    if not np.isclose(m2_df["match_score"], expected_score).all():
        raise ValueError("match_score formula inconsistency detected!")
    expected_label = (expected_score >= 0.65).astype(int)
    if not (m2_df["match_label"] == expected_label).all():
        raise ValueError("match_label threshold inconsistency detected!")
    print("  [PASS] match_score and match_label are 100% consistent.")

    print("All pre-save validations passed successfully!")


def main():
    print("=" * 60)
    print("Avenue360 - M2 Property Recommendation Dataset Generator")
    print("=" * 60)

    # 1. Load source datasets
    tenants, properties, amenities = load_source_data()

    # 2. Generate candidate pool
    m2_dataset = generate_candidate_pool(
        tenants, properties, amenities, top_k=CANDIDATES_PER_TENANT
    )

    # 3. Comprehensive pre-save validation
    validate_generated_dataset(m2_dataset, tenants, properties, amenities)

    # 4. Save to target location
    OUTPUT_M2_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"\nWriting dataset to: {OUTPUT_M2_PATH} ...")
    m2_dataset.to_csv(OUTPUT_M2_PATH, index=False)
    file_size_mb = OUTPUT_M2_PATH.stat().st_size / (1024 * 1024)

    print("Dataset written successfully!")
    print(f"  Output file: {OUTPUT_M2_PATH}")
    print(f"  Total rows : {len(m2_dataset):,}")
    print(f"  File size  : {file_size_mb:.2f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
