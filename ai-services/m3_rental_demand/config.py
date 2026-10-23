
from pathlib import Path

# Module and project directories
MODULE_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = MODULE_DIR.parent
PROJECT_ROOT = AI_SERVICE_DIR.parent

# Canonical M3 development dataset. Do not fall back to older datasets.
DATA_DIR = AI_SERVICE_DIR / "data" / "ml"
DATASET_PATH = DATA_DIR / "M3_Rental_Demand_Property_Type_2024_2026 (1).csv"

DATE_COLUMN = "year_month"
TARGET_COLUMN = "next_month_application_count"

CATEGORICAL_FEATURES = [
    "city",
    "area_locality",
    "property_type",
]

NUMERIC_FEATURES = [
    "month",
    "year",
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

FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES

PROPERTY_TYPES = (
    "APARTMENT",
    "INDEPENDENT_HOUSE",
    "VILLA",
)

TARGET_DEFINITION = (
    "For feature month t, the application_count for the same city, "
    "area_locality, and property_type in the immediately following calendar "
    "month t+1; labels are missing when that following month is unavailable."
)

# Output directories
ARTIFACTS_DIR = MODULE_DIR / "artifacts"
PLOTS_DIR = MODULE_DIR / "plots"
REPORTS_DIR = MODULE_DIR / "reports"
TESTS_DIR = MODULE_DIR / "tests"

# Trained model artifact
MODEL_PATH = ARTIFACTS_DIR / "model_pipeline.joblib"

# Model version
MODEL_VERSION = "v2.2"
