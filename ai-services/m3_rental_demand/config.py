
from pathlib import Path

# Module and project directories
MODULE_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = MODULE_DIR.parent
PROJECT_ROOT = AI_SERVICE_DIR.parent

# Original dataset
DATA_DIR = AI_SERVICE_DIR / "data" / "ML"
DATASET_PATH = DATA_DIR / "M3_Rental_Demand_Data.csv"

# Output directories
ARTIFACTS_DIR = MODULE_DIR / "artifacts"
PLOTS_DIR = MODULE_DIR / "plots"
REPORTS_DIR = MODULE_DIR / "reports"
TESTS_DIR = MODULE_DIR / "tests"

# Trained model artifact
MODEL_PATH = ARTIFACTS_DIR / "model_pipeline.joblib"

# Model version
MODEL_VERSION = "v1.0"


# Dataset date and target columns
DATE_COLUMN = "year_month"
TARGET_COLUMN = "next_month_demand"
