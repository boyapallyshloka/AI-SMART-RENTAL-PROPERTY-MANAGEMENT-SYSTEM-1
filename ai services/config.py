from pathlib import Path


# ============================================================
# PROJECT DIRECTORIES
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"
ML_DATA_DIR = DATA_DIR / "ml"

ARTIFACTS_DIR = BASE_DIR / "artifacts"
PLOTS_DIR = BASE_DIR / "plots"
REPORTS_DIR = BASE_DIR / "reports"


# ============================================================
# M5 DATASET
# ============================================================

M5_DATASET_PATH = (
    ML_DATA_DIR / "M5_Predictive_Maintenance.csv"
)


# ============================================================
# M5 TARGETS
# ============================================================

TARGET_RISK = "maintenance_risk_label"

TARGET_COUNT = "next_month_maintenance_count"

TARGET_COST = "next_month_maintenance_cost"


# ============================================================
# M5 INPUT FEATURES
# ============================================================

M5_FEATURES = [
    "property_age_years",
    "size_sqft",
    "bedrooms_bhk",
    "amenity_count",
    "historical_maintenance_count",
    "maintenance_count_last_90d",
    "historical_maintenance_cost",
    "historical_avg_cost",
    "days_since_last_maintenance",
    "dominant_issue_category",
    "inspection_count",
    "needs_attention_count",
    "equipment_count",
    "avg_equipment_age_years",
    "critical_equipment_count",
]


# ============================================================
# IDENTIFIER / TIME COLUMNS
# ============================================================

M5_ID_COLUMN = "property_id"

M5_TIME_COLUMN = "snapshot_month"


# ============================================================
# COLUMNS THAT MUST NOT BE MODEL INPUTS
# ============================================================

M5_EXCLUDED_COLUMNS = [
    "property_id",
    "snapshot_month",
    "maintenance_risk_label",
    "next_month_maintenance_count",
    "next_month_maintenance_cost",
]


# ============================================================
# M5 MODEL ARTIFACTS
# ============================================================

RISK_MODEL_PATH = (
    ARTIFACTS_DIR /
    "best_maintenance_risk_model.joblib"
)

COUNT_MODEL_PATH = (
    ARTIFACTS_DIR /
    "best_maintenance_count_model.joblib"
)

COST_MODEL_PATH = (
    ARTIFACTS_DIR /
    "best_maintenance_cost_model.joblib"
)