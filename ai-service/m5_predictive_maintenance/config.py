from pathlib import Path


# ---------------------------------------------------------
# PROJECT PATHS
# ---------------------------------------------------------

MODULE_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = MODULE_DIR.parent

DATA_PATH = (
    AI_SERVICE_DIR
    / "data"
    / "ml"
    / "M5_Predictive_Maintenance.csv"
)

ARTIFACTS_DIR = MODULE_DIR / "artifacts"
REPORTS_DIR = MODULE_DIR / "reports"
PLOTS_DIR = MODULE_DIR / "plots"


# Create output directories if they do not exist
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
PLOTS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------
# DATASET CONFIGURATION
# ---------------------------------------------------------

TARGET_COLUMN = "maintenance_risk_label"

DATE_COLUMN = "snapshot_month"

ID_COLUMNS = [
    "property_id"
]


# ---------------------------------------------------------
# IMPORTANT: DATA LEAKAGE
# ---------------------------------------------------------
#
# These columns describe what happens NEXT month.
# They must NOT be used to predict maintenance_risk_label.
#
# maintenance_risk_label = 1 whenever future maintenance occurs.
#
# Therefore using either future column would leak the answer.
# ---------------------------------------------------------

LEAKAGE_COLUMNS = [
    "next_month_maintenance_count",
    "next_month_maintenance_cost",
]


# ---------------------------------------------------------
# CHRONOLOGICAL SPLIT
# ---------------------------------------------------------
#
# Training:
# 2024-01 -> 2025-06
#
# Validation:
# 2025-07 -> 2025-09
#
# Testing:
# 2025-10 -> 2026-12
#
# The test period represents future/unseen time.
# ---------------------------------------------------------

TRAIN_END = "2025-06-01"

VALIDATION_START = "2025-07-01"
VALIDATION_END = "2025-09-01"

TEST_START = "2025-10-01"

RANDOM_STATE = 42