import os
import sys
import joblib
import pandas as pd

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)
PARENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

try:
    from m3_rental_demand import pipeline
    sys.modules["pipeline"] = pipeline
    from m3_rental_demand.pipeline import RentalDemandPipeline
except ImportError:
    import pipeline
    sys.modules["m3_rental_demand.pipeline"] = pipeline
    from pipeline import RentalDemandPipeline

ARTIFACTS_DIR = os.path.join(CURRENT_DIR, "artifacts")
PIPELINE_PATH = os.path.join(ARTIFACTS_DIR, "model_pipeline.joblib")

_pipeline = None



def _get_pipeline():
    """
    Loads and caches the single unified RentalDemandPipeline artifact.
    Falls back to legacy .pkl model if pipeline artifact is not yet created.
    """
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    if os.path.exists(PIPELINE_PATH):
        _pipeline = joblib.load(PIPELINE_PATH)
        return _pipeline

    # Fallback to legacy artifact location or .pkl for backward compatibility
    if os.path.exists(ARTIFACTS_DIR):
        joblib_files = [f for f in os.listdir(ARTIFACTS_DIR) if f.endswith(".joblib")]
        if joblib_files:
            _pipeline = joblib.load(os.path.join(ARTIFACTS_DIR, joblib_files[0]))
            return _pipeline

        pkl_files = [f for f in os.listdir(ARTIFACTS_DIR) if f.endswith(".pkl")]
        if pkl_files:
            _pipeline = joblib.load(os.path.join(ARTIFACTS_DIR, pkl_files[0]))
            return _pipeline

    raise FileNotFoundError(f"Model artifact not found at {PIPELINE_PATH} or {ARTIFACTS_DIR}")


def predict_demand(features: dict) -> float:
    """
    Predicts next month rental demand using the fitted pipeline.

    Accepts RAW features:
      - city: str
      - area_locality: str
      - month: int (or year_month: str)
      - property_count: int
      - application_count: int
      - agreement_start_count: int
      - average_monthly_rent: float
      - demand_lag_1_month: int
      - demand_lag_2_month: int
      - demand_growth_1_month: float
      - occupancy_rate: float
      - vacancy_rate: float
      - available_unit_count: int

    Returns:
      float: Predicted rental demand count (>= 0.0, rounded to 2 decimals).
    """
    pipeline = _get_pipeline()
    X = pd.DataFrame([features])

    preds = pipeline.predict(X)
    if hasattr(preds, "__len__"):
        val = preds[0]
    else:
        val = preds

    return float(max(0.0, round(float(val), 2)))


if __name__ == "__main__":
    sample = {
        "city": "Bangalore",
        "area_locality": "A Narayanapura, Mahadevapura",
        "property_count": 50,
        "application_count": 12,
        "agreement_start_count": 3,
        "average_monthly_rent": 25000.0,
        "demand_lag_1_month": 2,
        "demand_lag_2_month": 1,
        "demand_growth_1_month": 0.5,
        "occupancy_rate": 85,
        "vacancy_rate": 15,
        "available_unit_count": 8,
        "month": 6,
    }
    print("Predicted next month demand:", predict_demand(sample))