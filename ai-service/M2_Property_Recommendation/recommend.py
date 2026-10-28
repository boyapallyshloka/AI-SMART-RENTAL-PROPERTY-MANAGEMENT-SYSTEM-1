from pathlib import Path
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data"

DATA_PATH = DATA_DIR / "ml" / "M2_Property_Recommendation.csv"
TENANT_PREFERENCES_PATH = DATA_DIR / "tenant_preferences.csv"
PROPERTIES_PATH = DATA_DIR / "properties_enriched.csv"
PROPERTY_AMENITIES_PATH = DATA_DIR / "property_amenities.csv"


def load_data():
    """Load the M2 recommendation dataset."""
    return pd.read_csv(DATA_PATH)


def load_tenant_preferences():
    """Load tenant preference data."""
    return pd.read_csv(TENANT_PREFERENCES_PATH)


def load_properties():
    """Load enriched property data."""
    return pd.read_csv(PROPERTIES_PATH)


def load_property_amenities():
    """Load property amenity data."""
    return pd.read_csv(PROPERTY_AMENITIES_PATH)


def get_tenant_preferences(
    tenant_preferences_df,
    tenant_id
):
    """
    Load preferences for the requested tenant.

    The tenant preferences are read from tenant_preferences.csv
    instead of being hard-coded in the recommendation code.
    """

    tenant_id = str(tenant_id).strip()

    tenant_preferences_df = tenant_preferences_df.copy()

    tenant_preferences_df["tenant_id"] = (
        tenant_preferences_df["tenant_id"]
        .astype(str)
        .str.strip()
    )

    tenant_row = tenant_preferences_df[
        tenant_preferences_df["tenant_id"] == tenant_id
    ]

    if tenant_row.empty:
        raise ValueError(
            f"No preferences found for tenant_id: {tenant_id}"
        )

    if len(tenant_row) > 1:
        raise ValueError(
            f"Multiple preference records found for tenant_id: {tenant_id}"
        )

    row = tenant_row.iloc[0]

    return {
        "tenant_id": row["tenant_id"],
        "preferred_city": row["preferred_city"],
        "preferred_property_type": row["preferred_property_type"],
        "min_bedrooms": int(row["min_bedrooms"]),
        "max_budget": float(row["max_budget"]),
        "preferred_furnishing": row["preferred_furnishing"],
        "parking_required": row["parking_required"],
        "amenity_preference": row["amenity_preference"],
        "max_commute_distance_km": float(
            row["max_commute_distance_km"]
        )
    }

def normalize_text(value):
    """Normalize text values for reliable comparison."""
    if pd.isna(value):
        return ""

    return str(value).strip().upper()

REQUIRED_M2_COLUMNS = {
    "tenant_id",
    "property_id",
    "preferred_city",
    "property_city",
    "max_budget",
    "monthly_rent",
    "min_bedrooms",
    "property_bedrooms",
    "approx_distance_km",
}

REQUIRED_TENANT_COLUMNS = {
    "tenant_id",
    "preferred_city",
    "preferred_property_type",
    "min_bedrooms",
    "max_budget",
    "preferred_furnishing",
    "parking_required",
    "amenity_preference",
    "max_commute_distance_km",
}

REQUIRED_PROPERTY_COLUMNS = {
    "property_id",
    "property_type",
    "furnishing_status",
    "parking_available",
}

REQUIRED_AMENITY_COLUMNS = {
    "property_id",
    "amenity",
}

AMENITY_ALIASES = {
    "COVERED PARKING": "PARKING",
    "OPEN PARKING": "PARKING",
    "CAR PARKING": "PARKING",
    "VEHICLE PARKING": "PARKING",
}


def normalize_amenity(value):
    """
    Normalize amenity names so equivalent values
    are treated as the same amenity.
    """
    normalized = normalize_text(value)
    return AMENITY_ALIASES.get(normalized, normalized)
def validate_required_columns(df, required_columns, dataset_name):
    """Validate that all required columns are present."""

    missing_columns = required_columns - set(df.columns)

    if missing_columns:
        raise ValueError(
            f"{dataset_name} is missing required columns: "
            f"{sorted(missing_columns)}"
        )


def validate_m2_data(
    df,
    tenant_preferences,
    properties,
    property_amenities,
):
    """
    Validate all M2 datasets before filtering and scoring.
    """

    # ---------------------------------------------------------
    # 1. Dataset must not be empty
    # ---------------------------------------------------------

    if df.empty:
        raise ValueError("M2 recommendation dataset is empty.")

    if tenant_preferences.empty:
        raise ValueError("Tenant preferences dataset is empty.")

    if properties.empty:
        raise ValueError("Property dataset is empty.")

    if property_amenities.empty:
        raise ValueError("Property amenities dataset is empty.")

    # ---------------------------------------------------------
    # 2. Required column checks
    # ---------------------------------------------------------

    validate_required_columns(
        df,
        REQUIRED_M2_COLUMNS,
        "M2 dataset",
    )

    validate_required_columns(
        tenant_preferences,
        REQUIRED_TENANT_COLUMNS,
        "Tenant preferences",
    )

    validate_required_columns(
        properties,
        REQUIRED_PROPERTY_COLUMNS,
        "Property dataset",
    )

    validate_required_columns(
        property_amenities,
        REQUIRED_AMENITY_COLUMNS,
        "Property amenities",
    )

    # ---------------------------------------------------------
    # 3. Required key columns must not contain nulls
    # ---------------------------------------------------------

    for dataset_name, dataset, column in [
        ("M2 dataset", df, "tenant_id"),
        ("M2 dataset", df, "property_id"),
        ("Tenant preferences", tenant_preferences, "tenant_id"),
        ("Property dataset", properties, "property_id"),
        ("Property amenities", property_amenities, "property_id"),
    ]:
        if dataset[column].isna().any():
            raise ValueError(
                f"{dataset_name} contains null values in "
                f"required key column '{column}'."
            )

    # ---------------------------------------------------------
    # 4. Property master must have unique property IDs
    # ---------------------------------------------------------

    duplicate_property_ids = properties[
        properties["property_id"].duplicated(keep=False)
    ]

    if not duplicate_property_ids.empty:
        duplicate_ids = (
            duplicate_property_ids["property_id"]
            .drop_duplicates()
            .tolist()
        )

        raise ValueError(
            "Duplicate property_id values found in "
            f"property dataset: {duplicate_ids[:10]}"
        )

    # ---------------------------------------------------------
    # 5. M2 tenant + property combination must be unique
    # ---------------------------------------------------------

    duplicate_pairs = df[
        df.duplicated(
            subset=["tenant_id", "property_id"],
            keep=False,
        )
    ]

    if not duplicate_pairs.empty:
        raise ValueError(
            "Duplicate tenant_id + property_id records "
            "found in M2 dataset."
        )

    # ---------------------------------------------------------
    # 6. Every M2 property must exist in property master
    # ---------------------------------------------------------

    m2_property_ids = set(
        df["property_id"].dropna()
    )

    property_ids = set(
        properties["property_id"].dropna()
    )

    unmatched_properties = (
        m2_property_ids - property_ids
    )

    if unmatched_properties:
        raise ValueError(
            f"{len(unmatched_properties)} property IDs "
            "from M2 dataset were not found in "
            "property dataset. "
            f"Examples: {list(unmatched_properties)[:10]}"
        )

    # ---------------------------------------------------------
    # 7. Every M2 tenant must exist in preferences
    # ---------------------------------------------------------

    m2_tenant_ids = set(
        df["tenant_id"].dropna()
    )

    preference_tenant_ids = set(
        tenant_preferences["tenant_id"].dropna()
    )

    unmatched_tenants = (
        m2_tenant_ids - preference_tenant_ids
    )

    if unmatched_tenants:
        raise ValueError(
            f"{len(unmatched_tenants)} tenant IDs "
            "from M2 dataset were not found in "
            "tenant_preferences.csv. "
            f"Examples: {list(unmatched_tenants)[:10]}"
        )

    # ---------------------------------------------------------
    # 8. Every amenity property must exist in property master
    # ---------------------------------------------------------

    amenity_property_ids = set(
        property_amenities["property_id"].dropna()
    )

    orphan_amenity_properties = (
        amenity_property_ids - property_ids
    )

    if orphan_amenity_properties:
        raise ValueError(
            f"{len(orphan_amenity_properties)} property IDs "
            "in property_amenities.csv do not exist in "
            "the property dataset. "
            f"Examples: "
            f"{list(orphan_amenity_properties)[:10]}"
        )

    # ---------------------------------------------------------
    # 9. Numeric sanity checks
    # ---------------------------------------------------------

    if (df["max_budget"] <= 0).any():
        raise ValueError(
            "M2 dataset contains max_budget values <= 0."
        )

    if (df["monthly_rent"] <= 0).any():
        raise ValueError(
            "M2 dataset contains monthly_rent values <= 0."
        )

    if (df["min_bedrooms"] < 0).any():
        raise ValueError(
            "M2 dataset contains negative min_bedrooms."
        )

    if (df["property_bedrooms"] < 0).any():
        raise ValueError(
            "M2 dataset contains negative property_bedrooms."
        )

    if (df["approx_distance_km"] < 0).any():
        raise ValueError(
            "M2 dataset contains negative approx_distance_km."
        )

    print("M2 startup validation passed.")
def calculate_city_match(df, preferences):
    """Calculate city match."""
    preferred_city = normalize_text(preferences["preferred_city"])

    df["city_match"] = (
        df["property_city"]
        .apply(normalize_text)
        .eq(preferred_city)
        .astype(int)
    )

    return df


def calculate_budget_match(df, preferences):
    """
    Calculate budget match.

    A property is considered a budget match when its monthly
    rent is within the tenant's maximum budget.
    """
    max_budget = float(preferences["max_budget"])

    df["budget_match"] = (
        df["monthly_rent"] <= max_budget
    ).astype(int)

    return df


def calculate_budget_gap(df, preferences):
    """
    Calculate the difference between tenant budget and
    property monthly rent.

    Positive value  -> property is below budget.
    Zero            -> property equals budget.
    Negative value  -> property is above budget.
    """
    max_budget = float(preferences["max_budget"])

    df["budget_gap"] = (
        max_budget - df["monthly_rent"]
    )

    return df


def calculate_bedroom_match(df, preferences):
    """
    Calculate bedroom match.

    A property matches when it provides at least the
    minimum number of bedrooms requested by the tenant.
    """
    min_bedrooms = int(preferences["min_bedrooms"])

    df["bedroom_match"] = (
        df["property_bedrooms"] >= min_bedrooms
    ).astype(int)

    return df


def calculate_property_type_match(df, properties, preferences):
    """Calculate property type match using property data."""

    preferred_property_type = normalize_text(
        preferences["preferred_property_type"]
    )

    property_type_lookup = (
        properties[
            ["property_id", "property_type"]
        ]
        .drop_duplicates("property_id")
        .set_index("property_id")["property_type"]
        .map(normalize_text)
    )

    df["property_type"] = (
        df["property_id"]
        .map(property_type_lookup)
    )

    df["property_type_match"] = (
        df["property_type"] == preferred_property_type
    ).astype(int)

    return df


def calculate_furnishing_match(df, properties, preferences):
    """Calculate furnishing preference match."""

    preferred_furnishing = normalize_text(
        preferences["preferred_furnishing"]
    )

    furnishing_lookup = (
        properties[
            ["property_id", "furnishing_status"]
        ]
        .drop_duplicates("property_id")
        .set_index("property_id")["furnishing_status"]
        .map(normalize_text)
    )

    df["furnishing_status"] = (
        df["property_id"]
        .map(furnishing_lookup)
    )

    df["furnishing_match"] = (
        df["furnishing_status"] == preferred_furnishing
    ).astype(int)

    return df


def normalize_parking_required(value):
    """
    Normalize tenant parking_required preference into a boolean.

    Truth-like values: True, "True", 1 (also "yes", "y", "required") -> True
    Falsy-like values: False, "False", 0 -> False
    """
    if pd.isna(value):
        return False

    if isinstance(value, str):
        return value.strip().lower() in {
            "true",
            "1",
            "yes",
            "y",
            "required",
        }

    return bool(value)


def calculate_parking_match(df, properties, preferences):
    """
    Calculate parking match.

    If parking is required, the property must have parking.
    If parking is not required, the property receives a match
    because parking is not a mandatory preference.
    """

    parking_required = normalize_parking_required(
        preferences["parking_required"]
    )

    parking_lookup = (
        properties[
            ["property_id", "parking_available"]
        ]
        .drop_duplicates("property_id")
        .set_index("property_id")["parking_available"]
    )

    df["parking_available"] = (
        df["property_id"]
        .map(parking_lookup)
    )

    if parking_required:
        df["parking_match"] = (
            df["parking_available"]
            .fillna(False)
            .astype(bool)
            .astype(int)
        )
    else:
        df["parking_match"] = 1

    return df


def calculate_amenity_match(
    df,
    property_amenities,
    preferences,
):
    """
    Calculate amenity coverage for each property.

    Amenity coverage =
        matched preferred amenities
        ---------------------------
        total preferred amenities

    Equivalent amenity names are normalized using
    AMENITY_ALIASES before comparison.

    Example:
        Preferred: Gym, Parking, Security
        Property:  Gym, Parking

        Coverage = 2 / 3 = 0.6667
    """

    # ---------------------------------------------------------
    # 1. Get preferred amenities
    # ---------------------------------------------------------

    preferred_amenities = preferences.get(
        "preferred_amenities"
    )

    # Keep dataset-mode compatibility.
    # Older dataset preferences contain only
    # "amenity_preference".
    if preferred_amenities is None:
        preferred_amenity = normalize_amenity(
            preferences.get("amenity_preference", "")
        )

        preferred_amenities = (
            [preferred_amenity]
            if preferred_amenity
            else []
        )

    # Normalize and remove empty/duplicate values.
    preferred_amenities = {
        normalize_amenity(amenity)
        for amenity in preferred_amenities
        if normalize_amenity(amenity)
    }

    # ---------------------------------------------------------
    # 2. Build property -> set of amenities lookup
    # ---------------------------------------------------------

    amenity_lookup = (
        property_amenities.assign(
            amenity_normalized=
            property_amenities["amenity"].map(
                normalize_amenity
            )
        )
        .groupby("property_id")["amenity_normalized"]
        .apply(set)
    )

    # ---------------------------------------------------------
    # 3. Calculate amenity coverage
    # ---------------------------------------------------------

    total_preferred = len(preferred_amenities)

    if total_preferred == 0:
        df["amenity_match"] = 1.0
        df["amenity_matched"] = [[] for _ in range(len(df))]
        df["amenity_missing"] = [[] for _ in range(len(df))]
        return df

    def calculate_for_property(property_id):
        property_set = amenity_lookup.get(
            property_id,
            set()
        )

        matched = (
            preferred_amenities
            & property_set
        )

        missing = (
            preferred_amenities
            - property_set
        )

        coverage = (
            len(matched) / total_preferred
        )

        return coverage, list(matched), list(missing)

    results = df["property_id"].apply(
        calculate_for_property
    )

    # ---------------------------------------------------------
    # 4. Store results
    # ---------------------------------------------------------

    df["amenity_match"] = results.apply(
        lambda result: result[0]
    )

    df["amenity_matched"] = results.apply(
        lambda result: result[1]
    )

    df["amenity_missing"] = results.apply(
        lambda result: result[2]
    )

    return df


def calculate_distance_match(
    df,
    preferences,
):
    """
    Calculate continuous distance fit.

    A property closer to the tenant's location gets a
    higher distance-fit score.

    Distance fit:
        1.0 -> closest / within preferred distance
        0.0 -> at or beyond the maximum preferred distance

    If distance cannot be calculated because location data
    is unavailable, the value remains NaN so the scoring
    function can omit distance from the active ranking.
    """

    max_distance = preferences.get(
        "max_commute_distance_km"
    )

    # If there is no usable maximum distance,
    # distance cannot contribute meaningfully to scoring.
    if (
        max_distance is None
        or max_distance <= 0
    ):
        df["distance_match"] = float("nan")
        return df

    distance = pd.to_numeric(
        df["approx_distance_km"],
        errors="coerce"
    )

    # Continuous distance fit.
    #
    # Example with max_distance = 20 km:
    #
    # 0 km  -> 1.00
    # 5 km  -> 0.75
    # 10 km -> 0.50
    # 20 km -> 0.00
    # >20km -> 0.00
    #
    df["distance_match"] = (
        1
        - (distance / max_distance)
    ).clip(
        lower=0,
        upper=1,
    )

    return df


def calculate_all_match_features(
    df,
    properties,
    property_amenities,
    preferences,
):
    """
    Calculate all M2 match features from tenant preferences
    and property data.
    """

    df = df.copy()

    df = calculate_city_match(
        df,
        preferences,
    )

    df = calculate_budget_gap(
        df,
        preferences,
    )

    df = calculate_budget_match(
        df,
        preferences,
    )

    df = calculate_bedroom_match(
        df,
        preferences,
    )

    df = calculate_property_type_match(
        df,
        properties,
        preferences,
    )

    df = calculate_furnishing_match(
        df,
        properties,
        preferences,
    )

    df = calculate_parking_match(
        df,
        properties,
        preferences,
    )

    df = calculate_amenity_match(
        df,
        property_amenities,
        preferences,
    )

    df = calculate_distance_match(
        df,
        preferences,
    )

    return df


def calculate_recommendation_score(df):
    """
    Calculate the final M2 recommendation score.

    Ranking weights:
        Budget Fit       : 25%
        Amenity Coverage : 20%
        Property Type    : 15%
        Furnishing       : 15%
        Distance Fit     : 15%
        Parking Match    : 10%

    Total               : 100%

    If distance is unavailable, its 15% weight is omitted
    and the remaining weights are normalized to 100%.
    """

    df = df.copy()

    # ---------------------------------------------------------
    # 1. Continuous budget fit
    # ---------------------------------------------------------
    #
    # At or below budget -> 1.0
    # Above budget      -> proportionally lower
    #
    # Example:
    # budget = 30,000
    # rent   = 31,500
    #
    # budget_fit = 30,000 / 31,500
    #
    # Eligibility already allows properties up to 5% above
    # the maximum budget.
    df["budget_score"] = (
        df["max_budget"] / df["monthly_rent"]
    ).clip(
        upper=1.0
    )

    # ---------------------------------------------------------
    # 2. Base v1.1 weights
    # ---------------------------------------------------------
    weights = {
        "budget_score": 0.25,
        "amenity_match": 0.20,
        "property_type_match": 0.15,
        "furnishing_match": 0.15,
        "distance_match": 0.15,
        "parking_match": 0.10,
    }

    # ---------------------------------------------------------
    # 3. Detect whether distance is available
    # ---------------------------------------------------------
    distance_available = (
        df["distance_match"]
        .notna()
    )

    # ---------------------------------------------------------
    # 4. Calculate score row-by-row
    # ---------------------------------------------------------
    #
    # Distance unavailable:
    # remove its 15% contribution and normalize the
    # remaining 85% back to 100%.
    #
    # Distance available:
    # use the full v1.1 weights.
    active_weights = (
        df["distance_match"]
        .notna()
        .map(
            lambda available: (
                {
                    key: value
                    for key, value in weights.items()
                    if available or key != "distance_match"
                }
            )
        )
    )

    def calculate_row_score(row):
        row_weights = active_weights.loc[row.name]

        weight_total = sum(
            row_weights.values()
        )

        score = 0.0

        for feature, weight in row_weights.items():
            value = row[feature]

            if pd.isna(value):
                continue

            score += (
                value * weight
            )

        if weight_total > 0:
            score /= weight_total

        return score * 100

    df["recommendation_score"] = (
        df.apply(
            calculate_row_score,
            axis=1,
        )
    )

    # Keep full precision internally.
    # Presentation rounding should happen at the API boundary.
    return df


def filter_properties(df, preferences):
    """
    Apply basic eligibility filtering.

    A 5% budget tolerance is allowed.

    Note:
    Match columns are calculated separately before scoring.
    """
    df = df[df["tenant_id"] == preferences["tenant_id"]].copy()

    budget_limit = (
        float(preferences["max_budget"]) * 1.05
    )

    preferred_city = normalize_text(
        preferences["preferred_city"]
    )

    filtered_df = df[
        (
            df["property_city"]
            .apply(normalize_text)
            == preferred_city
        )
        & (
            df["property_bedrooms"]
            >= int(preferences["min_bedrooms"])
        )
        & (
            df["monthly_rent"]
            <= budget_limit
        )
    ].copy()

    return filtered_df


def rank_properties(df):
    """
    Rank properties using the v1.1 recommendation score
    and deterministic tie-breaking.

    Tie-break order:
        1. Higher recommendation score
        2. Better budget fit
        3. Greater amenity coverage
        4. Smaller distance
        5. Lower property ID

    If distance is unavailable, NaN is placed after
    properties with a usable distance when all preceding
    ranking values are tied.
    """

    df = df.copy()

    # Ensure property_id can be sorted numerically when possible.
    df["_property_id_sort"] = pd.to_numeric(
        df["property_id"],
        errors="coerce"
    )

    ranked_df = df.sort_values(
        by=[
            "recommendation_score",
            "budget_score",
            "amenity_match",
            "approx_distance_km",
            "_property_id_sort",
            "property_id",
        ],
        ascending=[
            False,
            False,
            False,
            True,
            True,
            True,
        ],
        na_position="last",
    ).copy()

    ranked_df = ranked_df.drop(
        columns=[
            "_property_id_sort",
        ]
    )

    return ranked_df

def get_top_recommendations(
    df,
    top_n=5,
):
    """Return the top N ranked properties."""

    return df.head(top_n).copy()


def recommend_properties(
    df,
    properties,
    property_amenities,
    preferences,
    top_n=5,
):
    """
    Execute the complete M2 recommendation pipeline.

    Steps:
        1. Filter eligible properties/units
        2. Calculate all match features
        3. Calculate recommendation score
        4. Rank candidates
        5. Select Top-N DISTINCT properties
        6. Keep all qualifying units belonging to those properties
    """

    # ---------------------------------------------------------
    # 1. Filter eligible properties/units
    # ---------------------------------------------------------
    filtered_df = filter_properties(
        df,
        preferences,
    )

    if filtered_df.empty:
        return filtered_df

    # ---------------------------------------------------------
    # 2. Calculate all match features
    # ---------------------------------------------------------
    scored_df = calculate_all_match_features(
        filtered_df,
        properties,
        property_amenities,
        preferences,
    )

    # ---------------------------------------------------------
    # 3. Calculate recommendation score
    # ---------------------------------------------------------
    scored_df = calculate_recommendation_score(
        scored_df
    )

    # ---------------------------------------------------------
    # 4. Rank all qualifying unit rows
    # ---------------------------------------------------------
    ranked_df = rank_properties(
        scored_df
    )

    # ---------------------------------------------------------
    # 5. Select Top-N DISTINCT properties.
    #
    # The first row for each property is its highest-ranked
    # qualifying unit because ranked_df is already sorted.
    # ---------------------------------------------------------
    top_property_ids = (
        ranked_df
        .drop_duplicates(
            subset=["property_id"],
            keep="first",
        )
        .head(top_n)["property_id"]
        .tolist()
    )

    # ---------------------------------------------------------
    # 6. Keep ALL qualifying units for those Top-N properties.
    #
    # This allows api.py to group them into availableUnits[].
    # ---------------------------------------------------------
    recommendations_df = ranked_df[
        ranked_df["property_id"].isin(top_property_ids)
    ].copy()

    return recommendations_df


if __name__ == "__main__":

    # ---------------------------------------------------------
    # Load datasets
    # ---------------------------------------------------------

    df = load_data()
    tenant_preferences_df = load_tenant_preferences()
    properties = load_properties()
    property_amenities = load_property_amenities()

    # ---------------------------------------------------------
    # Validate datasets before any filtering or scoring
    # ---------------------------------------------------------

    validate_m2_data(
        df,
        tenant_preferences_df,
        properties,
        property_amenities,
    )

    # ---------------------------------------------------------
    # Requested tenant
    # ---------------------------------------------------------

    tenant_id = "T00888"

    # Load the actual preferences for the requested tenant
    preferences = get_tenant_preferences(
        tenant_preferences_df,
        tenant_id,
    )

    # ---------------------------------------------------------
    # Display tenant preferences
    # ---------------------------------------------------------

    print("\nTenant preferences:")

    for key, value in preferences.items():
        print(f"{key}: {value}")

    # ---------------------------------------------------------
    # Generate recommendations
    # ---------------------------------------------------------

    recommendations = recommend_properties(
        df=df,
        properties=properties,
        property_amenities=property_amenities,
        preferences=preferences,
        top_n=5,
    )

    # ---------------------------------------------------------
    # Dataset information
    # ---------------------------------------------------------

    print("\nM2 dataset loaded successfully.")
    print("Rows:", len(df))
    print("Columns:", len(df.columns))

    # ---------------------------------------------------------
    # Recommendation results
    # ---------------------------------------------------------

    print("\nMatching properties:", len(recommendations))

    print("\nTop 5 recommendations:")

    if recommendations.empty:
        print("No matching properties found.")

    else:

        display_columns = [
            "tenant_id",
            "property_id",
            "property_city",
            "monthly_rent",
            "property_bedrooms",
            "city_match",
            "budget_match",
            "bedroom_match",
            "property_type_match",
            "furnishing_match",
            "parking_match",
            "amenity_match",
            "distance_match",
            "recommendation_score",
        ]

        available_columns = [
            column
            for column in display_columns
            if column in recommendations.columns
        ]

        print(
            recommendations[available_columns]
            .to_string(index=False)
        )