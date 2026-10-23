from pathlib import Path


# =========================================================
# PROJECT PATHS
# =========================================================

MODULE_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = MODULE_DIR.parent

DATA_PATH = (
    AI_SERVICE_DIR
    / "data"
    / "ml"
    / "M4_Payment_Risk.csv"
)

ARTIFACTS_DIR = MODULE_DIR / "artifacts"
REPORTS_DIR = MODULE_DIR / "reports"
PLOTS_DIR = MODULE_DIR / "plots"


ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
PLOTS_DIR.mkdir(parents=True, exist_ok=True)


# =========================================================
# DATASET
# =========================================================

TARGET_COLUMN = "risk_label"

DATE_COLUMN = "snapshot_month"

ID_COLUMNS = [
    "tenant_id"
]


# =========================================================
# LEAKAGE COLUMNS
# =========================================================
#
# These columns contain information about future payment
# behavior and therefore must NOT be used as input features.
#

LEAKAGE_COLUMNS = [
    "future_bad_payment_ratio"
]


# =========================================================
# M4 FEATURES
# =========================================================

FEATURE_COLUMNS = [
    "monthly_income",
    "historical_invoice_count",
    "late_payment_count",
    "missed_payment_count",
    "avg_days_late",
    "max_days_late",
    "historical_outstanding",
    "rent_to_income_ratio",
    "payment_completion_ratio",
]


# =========================================================
# CHRONOLOGICAL SPLIT
# =========================================================
#
# Initial split:
#
# TRAIN:
# 2024-01 -> 2025-06
#
# VALIDATION:
# 2025-07 -> 2025-09
#
# TEST:
# 2025-10 -> 2025-12
#
# This must be chronological because M4 is a
# tenant-month time-snapshot problem.
#

TRAIN_END = "2025-06-01"

VALIDATION_START = "2025-07-01"
VALIDATION_END = "2025-09-01"

TEST_START = "2025-10-01"


# =========================================================
# MODEL
# =========================================================

RANDOM_STATE = 42

MODEL_VERSION = "v1.0"