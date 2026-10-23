import pandas as pd

from .database import load_live_m2_data
from .recommend import recommend_properties

MODEL_VERSION = "v1.1"


def apply_preference_overrides(
    preferences: dict,
    preferred_city: str | None = None,
    max_budget: float | None = None,
    min_bedrooms: int | None = None,
    property_type: str | None = None,
    furnishing: str | None = None,
    parking: bool | None = None,
    amenities: list[str] | None = None,
    max_distance: float | None = None,
) -> dict:
    """
    Create the effective preferences for the current recommendation request.

    Saved tenant preferences are copied and are NOT modified.

    Any value explicitly provided by Scout overrides the saved
    preference for this request only.
    """

    effective_preferences = preferences.copy()

    if preferred_city is not None:
        effective_preferences["preferred_city"] = preferred_city

    if max_budget is not None:
        effective_preferences["max_budget"] = float(max_budget)

    if min_bedrooms is not None:
        effective_preferences["min_bedrooms"] = int(min_bedrooms)

    if property_type is not None:
        effective_preferences["preferred_property_type"] = property_type

    if furnishing is not None:
        effective_preferences["preferred_furnishing"] = furnishing

    if parking is not None:
        effective_preferences["parking_required"] = parking

    if amenities is not None:
        effective_preferences["preferred_amenities"] = amenities

    if max_distance is not None:
        effective_preferences["max_commute_distance_km"] = float(max_distance)

    return effective_preferences


def generate_recommendations(
    tenant_id: str,
    top_n: int,
    current_latitude: float | None = None,
    current_longitude: float | None = None,
    current_address: str | None = None,
    preferred_city: str | None = None,
    max_budget: float | None = None,
    min_bedrooms: int | None = None,
    property_type: str | None = None,
    furnishing: str | None = None,
    parking: bool | None = None,
    amenities: list[str] | None = None,
    max_distance: float | None = None,
):
    """
    Reusable M2 recommendation operation.

    Pipeline:
        1. Load live data from Neon
        2. Get saved tenant preferences
        3. Apply optional temporary preference overrides
        4. Run the existing M2 recommendation algorithm
        5. Convert results into the existing M2 response format

    Existing /m2/recommend-properties API callers remain compatible.
    """

    tenant_id = tenant_id.strip()

    if not tenant_id:
        raise ValueError("tenantId must not be empty")

    (
        live_df,
        properties,
        property_amenities,
        preferences
    ) = load_live_m2_data(
        int(tenant_id),
        current_latitude=current_latitude,
        current_longitude=current_longitude,
        current_address=current_address,
    )

    # Create request-specific preferences.
    # This does NOT modify the preferences stored in Neon.
    preferences = apply_preference_overrides(
        preferences=preferences,
        preferred_city=preferred_city,
        max_budget=max_budget,
        min_bedrooms=min_bedrooms,
        property_type=property_type,
        furnishing=furnishing,
        parking=parking,
        amenities=amenities,
        max_distance=max_distance,
    )

    recommendations_df = recommend_properties(
        live_df,
        properties,
        property_amenities,
        preferences,
        top_n
    )

    recommendations = []

    for property_id, property_df in recommendations_df.groupby(
        "property_id",
        sort=False
    ):
        first_row = property_df.iloc[0]

        available_units = []

        for _, unit_row in property_df.iterrows():
            available_units.append(
                {
                    "unitId": str(unit_row["unit_id"]),
                    "monthlyRent": float(unit_row["monthly_rent"]),
                    "bedrooms": int(unit_row["property_bedrooms"]),
                }
            )

        city_match_value = int(first_row["city_match"])
        budget_match_value = int(first_row["budget_match"])
        bedroom_match_value = int(first_row["bedroom_match"])
        property_type_match_value = int(first_row["property_type_match"])
        furnishing_match_value = int(first_row["furnishing_match"])
        parking_match_value = int(first_row["parking_match"])

        amenity_match = first_row["amenity_match"]

        if pd.isna(amenity_match):
            amenity_percentage = 0.0
        else:
            amenity_percentage = round(
                float(amenity_match) * 100,
                2
            )

        matched_amenities = first_row.get(
            "amenity_matched",
            []
        )

        missing_amenities = first_row.get(
            "amenity_missing",
            []
        )

        if matched_amenities is None:
            matched_amenities = []

        if missing_amenities is None:
            missing_amenities = []

        matched_amenities = [
            str(value)
            for value in matched_amenities
        ]

        missing_amenities = [
            str(value)
            for value in missing_amenities
        ]

        distance_match = first_row["distance_match"]
        approx_distance_km = first_row["approx_distance_km"]

        if pd.isna(distance_match):
            distance_considered = False
            distance_match_value = None
        else:
            distance_considered = True
            distance_match_value = round(
                float(distance_match),
                4
            )

        if pd.isna(approx_distance_km):
            approx_distance_value = None
        else:
            approx_distance_value = round(
                float(approx_distance_km),
                2
            )

        recommendation_score = float(
            first_row["recommendation_score"]
        )

        recommendations.append(
            {
                "propertyId": str(property_id),

                "recommendationScore": round(
                    recommendation_score,
                    2
                ),

                "propertyCity": str(
                    first_row["property_city"]
                ),

                "matchDetails": {
                    "cityMatch": city_match_value,
                    "budgetMatch": budget_match_value,
                    "bedroomMatch": bedroom_match_value,
                    "propertyTypeMatch": property_type_match_value,
                    "furnishingMatch": furnishing_match_value,
                    "parkingMatch": parking_match_value,

                    "amenities": {
                        "matchPercentage": amenity_percentage,
                        "matched": matched_amenities,
                        "missing": missing_amenities,
                    },

                    "distance": {
                        "distanceConsidered": distance_considered,
                        "distanceMatch": distance_match_value,
                        "approxDistanceKm": approx_distance_value,
                    },
                },

                "availableUnits": available_units,
            }
        )

    return {
        "success": True,
        "tenantId": tenant_id,
        "recommendations": recommendations,
        "count": len(recommendations),
        "modelVersion": MODEL_VERSION
    }