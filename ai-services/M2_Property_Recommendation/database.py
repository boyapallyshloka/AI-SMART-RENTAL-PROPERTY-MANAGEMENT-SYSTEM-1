"""Read-only Neon PostgreSQL access for live M2 recommendations."""

from __future__ import annotations

import math
import os
from typing import Any

from dotenv import load_dotenv
import pandas as pd
import psycopg
from psycopg.rows import dict_row

load_dotenv()


M2_DATABASE_URL_ENV = "M2_DATABASE_URL"


# ============================================================
# Database Connection
# ============================================================

def _database_url() -> str:
    """Get the dedicated M2 Neon database URL."""

    value = os.getenv(M2_DATABASE_URL_ENV, "").strip()

    if not value:
        raise RuntimeError(
            "M2_DATABASE_URL is not configured."
        )

    return value


def get_connection() -> psycopg.Connection:
    """
    Open a read-only PostgreSQL connection.

    The database role itself should be SELECT-only.
    default_transaction_read_only provides an additional safety layer.
    """

    return psycopg.connect(
        _database_url(),
        row_factory=dict_row,
        connect_timeout=10,
        options="-c default_transaction_read_only=on",
    )


# ============================================================
# Tenant Preferences
# ============================================================

def load_live_tenant_preferences(
    tenant_id: int
) -> dict[str, Any]:
    """
    Load the current tenant preferences and preferred amenities
    directly from Neon.
    """

    query = """
        SELECT
            tp.tenant_id,
            tp.preferred_city,
            tp.max_budget,
            tp.min_bedrooms,
            tp.preferred_property_type,
            tp.furnishing_preference,
            tp.parking_required,
            tp.preferred_latitude,
            tp.preferred_longitude,
            tp.max_distance_km,
            a.amenity_name AS amenity_name

        FROM tenant_preferences tp

        LEFT JOIN tenant_preference_amenities tpa
            ON tpa.preference_id = tp.preference_id

        LEFT JOIN amenities a
            ON a.amenity_id = tpa.amenity_id

        WHERE tp.tenant_id = %s

        ORDER BY a.amenity_name
    """

    with get_connection() as conn:
        with conn.cursor() as cur:

            cur.execute(
                query,
                (tenant_id,)
            )

            rows = cur.fetchall()

    if not rows:
        raise ValueError(
            f"No tenant preferences found for tenant_id: {tenant_id}"
        )

    first = rows[0]

    preferred_amenities = [
        row["amenity_name"]
        for row in rows
        if row.get("amenity_name")
    ]

    return {
        "tenant_id": str(first["tenant_id"]),

        "preferred_city":
            first["preferred_city"],

        "preferred_property_type":
            first["preferred_property_type"],

        "min_bedrooms":
            int(first["min_bedrooms"] or 0),

        "max_budget":
            float(first["max_budget"] or 0),

        "preferred_furnishing":
            first["furnishing_preference"],

        "parking_required":
            first["parking_required"],

        "preferred_amenities":
            preferred_amenities,

        # Keep this because the existing M2 code
        # still understands the old single-amenity field.
        "amenity_preference":
            preferred_amenities[0]
            if preferred_amenities
            else "",

        "preferred_latitude":
            _as_float(first["preferred_latitude"]),

        "preferred_longitude":
            _as_float(first["preferred_longitude"]),

        "max_commute_distance_km":
            float(first["max_distance_km"] or 0),
    }


# ============================================================
# Live Properties + Units
# ============================================================

def load_live_properties() -> pd.DataFrame:
    """
    Load currently available properties and vacant units.

    Only:
        property.status = AVAILABLE
        unit.status = VACANT

    are considered for live recommendations.
    """

    query = """
        SELECT
            p.property_id,
            p.property_type,
            p.furnishing_status,

            COALESCE(
                p.parking_available,
                FALSE
            ) AS parking_available,

            pa.city AS property_city,
            pa.latitude,
            pa.longitude,

            u.unit_id,
            u.monthly_rent,
            u.bedrooms AS property_bedrooms

        FROM properties p

        JOIN property_addresses pa
            ON pa.property_id = p.property_id

        JOIN buildings b
            ON b.property_id = p.property_id

        JOIN floors f
            ON f.building_id = b.building_id

        JOIN units u
            ON u.floor_id = f.floor_id

        WHERE p.status = 'AVAILABLE'

          AND u.status = 'VACANT'

          AND u.monthly_rent IS NOT NULL

          AND u.monthly_rent > 0

          AND u.bedrooms IS NOT NULL

          AND u.bedrooms >= 0

        ORDER BY
            p.property_id,
            u.monthly_rent,
            u.unit_id
    """

    with get_connection() as conn:
        with conn.cursor() as cur:

            cur.execute(query)

            rows = cur.fetchall()

    return pd.DataFrame(rows)


# ============================================================
# Property Amenities
# ============================================================

def load_live_property_amenities() -> pd.DataFrame:
    """
    Load current property-to-amenity relationships from Neon.
    """

    query = """
        SELECT
            pa.property_id,
            a.amenity_name AS amenity

        FROM property_amenities pa

        JOIN amenities a
            ON a.amenity_id = pa.amenity_id

        ORDER BY
            pa.property_id,
            a.amenity_name
    """

    with get_connection() as conn:
        with conn.cursor() as cur:

            cur.execute(query)

            rows = cur.fetchall()

    return pd.DataFrame(
        rows,
        columns=[
            "property_id",
            "amenity"
        ]
    )


# ============================================================
# Convert Neon Data → Existing M2 Dataset Shape
# ============================================================

def build_live_m2_dataset(
    tenant_id: int,
    preferences: dict[str, Any],
    properties: pd.DataFrame,
    current_latitude: float | None = None,
    current_longitude: float | None = None,
) -> pd.DataFrame:
    """
    Convert current Neon property/unit data into the
    feature shape expected by the existing M2 recommendation logic.

    Distance is calculated from the user's current location
    when current GPS coordinates are available.
    """

    if properties.empty:
        return pd.DataFrame(
            columns=[
                "tenant_id",
                "property_id",
                "property_city",
                "property_bedrooms",
                "monthly_rent",
                "max_budget",
                "min_bedrooms",
                "preferred_city",
                "approx_distance_km",
            ]
        )

    df = properties.copy()

    df["tenant_id"] = str(tenant_id)

    df["max_budget"] = float(
        preferences["max_budget"]
    )

    df["min_bedrooms"] = int(
        preferences["min_bedrooms"]
    )

    df["preferred_city"] = (
        preferences["preferred_city"]
    )

    df["monthly_rent"] = pd.to_numeric(
        df["monthly_rent"],
        errors="coerce"
    )

    df["property_bedrooms"] = pd.to_numeric(
        df["property_bedrooms"],
        errors="coerce"
    ).fillna(0).astype(int)

    # --------------------------------------------------------
    # Calculate live distance
    # --------------------------------------------------------
    # Use the current location supplied by the backend.
    #
    # If current latitude/longitude are unavailable,
    # haversine_km() returns NaN and the recommendation
    # scoring logic will omit the distance component.
    # --------------------------------------------------------

    df["approx_distance_km"] = df.apply(
        lambda row: haversine_km(
            current_latitude,
            current_longitude,
            _as_float(row.get("latitude")),
            _as_float(row.get("longitude")),
        ),
        axis=1,
    )

    return df


# ============================================================
# Haversine Distance
# ============================================================

def haversine_km(
    lat1: float | None,
    lon1: float | None,
    lat2: float | None,
    lon2: float | None,
) -> float:

    values = (
        lat1,
        lon1,
        lat2,
        lon2
    )

    if any(
        value is None
        or not math.isfinite(value)
        for value in values
    ):
        return float("nan")

    radius_km = 6371.0088

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    delta_phi = math.radians(
        lat2 - lat1
    )

    delta_lambda = math.radians(
        lon2 - lon1
    )

    a = (
        math.sin(delta_phi / 2) ** 2
        +
        math.cos(phi1)
        * math.cos(phi2)
        * math.sin(delta_lambda / 2) ** 2
    )

    return (
        radius_km
        * 2
        * math.atan2(
            math.sqrt(a),
            math.sqrt(1 - a)
        )
    )


# ============================================================
# Main M2 Live Data Loader
# ============================================================

def load_live_m2_data(
    tenant_id: int,
    current_latitude: float | None = None,
    current_longitude: float | None = None,
    current_address: str | None = None,
):
    """
    Load all live M2 inputs directly from Neon.

    Current latitude/longitude are supplied by the backend
    for live distance calculation.

    current_address is accepted for the API contract.
    Address-based distance fallback will be handled separately
    once the property's full address/geocoding fields are confirmed.
    """

    preferences = load_live_tenant_preferences(
        tenant_id
    )

    properties = load_live_properties()

    property_amenities = (
        load_live_property_amenities()
    )

    live_df = build_live_m2_dataset(
        tenant_id,
        preferences,
        properties,
        current_latitude=current_latitude,
        current_longitude=current_longitude,
    )

    return (
        live_df,
        properties,
        property_amenities,
        preferences,
    )


# ============================================================
# Database Health Check
# ============================================================

def check_database_connection() -> dict[str, Any]:
    """
    Verify the current Neon connection, database user,
    and read-only transaction setting.
    """

    with get_connection() as conn:
        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT
                    current_user AS current_user,
                    current_database() AS current_database,
                    current_setting(
                        'transaction_read_only'
                    ) AS transaction_read_only
                """
            )

            row = cur.fetchone()

    return dict(row)


# ============================================================
# Utility
# ============================================================

def _as_float(
    value: Any
) -> float | None:

    if value is None:
        return None

    try:
        value = float(value)

    except (
        TypeError,
        ValueError
    ):
        return None

    if not math.isfinite(value):
        return None

    return value