from pathlib import Path


MODULE_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = MODULE_DIR.parent
DATASET_PATH = (
    AI_SERVICE_DIR
    / "data"
    / "ml"
    / "M3_Rental_Demand_Property_Type_2024_2026 (1).csv"
)

ARTIFACT_DIR = MODULE_DIR / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "model_pipeline.joblib"
METADATA_PATH = ARTIFACT_DIR / "model_metadata.json"

TARGET_COLUMN = "next_month_demand"
MODEL_VERSION = "M3-v2.0"

SUPPORTED_PROPERTY_TYPES = (
    "APARTMENT",
    "VILLA",
    "INDEPENDENT_HOUSE",
)

CATEGORICAL_FEATURES = [
    "city",
    "area_locality",
    "property_type",
]

NUMERICAL_FEATURES = [
    "month",
    "property_count",
    "application_count",
    "agreement_start_count",
    "average_monthly_rent",
    "demand_lag_1_month",
    "demand_lag_2_month",
    "demand_growth_1_month",
    "occupancy_rate",
    "vacancy_rate",
    "available_unit_count",
]

FEATURE_COLUMNS = CATEGORICAL_FEATURES + NUMERICAL_FEATURES
IDENTIFIER_COLUMNS = CATEGORICAL_FEATURES
DATE_SPLIT_TRAIN_END = "2025-12"
DATE_SPLIT_TEST_START = "2026-01"

REQUIRED_DATASET_COLUMNS = [
    "city",
    "area_locality",
    "property_type",
    "year",
    "month",
    "property_count",
    "application_count",
    "agreement_start_count",
    "average_monthly_rent",
    "demand_lag_1_month",
    "demand_lag_2_month",
    "demand_growth_1_month",
    "occupancy_rate",
    "vacancy_rate",
    "available_unit_count",
    TARGET_COLUMN,
]
