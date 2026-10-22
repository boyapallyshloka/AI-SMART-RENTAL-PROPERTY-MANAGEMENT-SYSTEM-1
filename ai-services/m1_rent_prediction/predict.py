from pathlib import Path

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "m1_model_pipeline.joblib"
)


def load_model():
    """Load the complete fitted M1 pipeline."""
    return joblib.load(MODEL_PATH)


def validate_input(property_data):
    """Validate basic M1 business constraints."""

    required_fields = [
        "city",
        "area_locality",
        "area_type",
        "size_sqft",
        "bedrooms_bhk",
        "bathrooms",
        "floor",
        "total_floors",
        "furnishing_status",
        "parking_available",
        "property_age_years",
        "amenity_count",
        "amenity_parking",
        "amenity_lift",
        "amenity_gym",
        "amenity_security",
        "amenity_power_backup",
        "amenity_air_conditioning",
        "amenity_wifi",
        "amenity_garden",
        "latitude",
        "longitude",
        "property_type"
    ]

    missing_fields = [
        field
        for field in required_fields
        if field not in property_data
    ]

    if missing_fields:
        raise ValueError(
            f"Missing required fields: {missing_fields}"
        )

    if property_data["size_sqft"] <= 0:
        raise ValueError(
            "size_sqft must be greater than 0"
        )

    if property_data["bedrooms_bhk"] <= 0:
        raise ValueError(
            "bedrooms_bhk must be greater than 0"
        )

    if property_data["bathrooms"] <= 0:
        raise ValueError(
            "bathrooms must be greater than 0"
        )

    if property_data["floor"] < 0:
        raise ValueError(
            "floor cannot be negative"
        )

    if property_data["total_floors"] <= 0:
        raise ValueError(
            "total_floors must be greater than 0"
        )

    if property_data["floor"] > property_data["total_floors"]:
        raise ValueError(
            "floor cannot be greater than total_floors"
        )


def predict_rent(property_data):

    validate_input(property_data)

    model_pipeline = load_model()

    input_df = pd.DataFrame(
        [property_data]
    )

    prediction = model_pipeline.predict(
        input_df
    )[0]

    # Rent cannot be negative
    prediction = max(
        float(prediction),
        0.0
    )

    return round(
        prediction,
        2
    )


if __name__ == "__main__":

    sample_property = {
        "city": "Hyderabad",
        "area_locality": "Kondapur",
        "area_type": "Super Area",
        "size_sqft": 1200,
        "bedrooms_bhk": 2,
        "bathrooms": 2,
        "floor": 3,
        "total_floors": 5,
        "furnishing_status": "Semi-Furnished",
        "parking_available": True,
        "property_age_years": 10,
        "amenity_count": 5,

        "amenity_parking": True,
        "amenity_lift": True,
        "amenity_gym": True,
        "amenity_security": True,
        "amenity_power_backup": True,
        "amenity_air_conditioning": False,
        "amenity_wifi": False,
        "amenity_garden": False,
        
        "latitude": 17.46,
        "longitude": 78.36,
        "property_type": "APARTMENT"
    }
    predicted_rent = predict_rent(
        sample_property
    )

    print(
        "\nPredicted monthly rent:",
        predicted_rent
    )