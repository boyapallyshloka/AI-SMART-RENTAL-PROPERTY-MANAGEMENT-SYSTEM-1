from pathlib import Path
import joblib
import pandas as pd
import numpy as np


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"

RISK_MODEL_PATH = ARTIFACTS_DIR / "best_maintenance_risk_model.joblib"
COUNT_MODEL_PATH = ARTIFACTS_DIR / "best_maintenance_count_model.joblib"
COST_MODEL_PATH = ARTIFACTS_DIR / "best_maintenance_cost_model_v2.joblib"


# ============================================================
# EXACT MODEL FEATURES
# ============================================================

MODEL_FEATURE_COLUMNS = [
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
    "snapshot_year",
    "snapshot_month_number",
    "month_sin",
    "month_cos",
    "maintenance_cost_per_event",
    "inspection_attention_ratio",
    "critical_equipment_ratio",
    "recent_maintenance_ratio",
]


# ============================================================
# FEATURE ENGINEERING
# ============================================================

def engineer_features(data: dict) -> pd.DataFrame:

    df = pd.DataFrame([data])

    df["snapshot_month"] = pd.to_datetime(
        df["snapshot_month"],
        format="%Y-%m"
    )

    df["snapshot_year"] = df["snapshot_month"].dt.year
    df["snapshot_month_number"] = df["snapshot_month"].dt.month

    df["month_sin"] = np.sin(
        2 * np.pi * df["snapshot_month_number"] / 12
    )

    df["month_cos"] = np.cos(
        2 * np.pi * df["snapshot_month_number"] / 12
    )

    df["maintenance_cost_per_event"] = np.where(
        df["historical_maintenance_count"] > 0,
        df["historical_maintenance_cost"]
        / df["historical_maintenance_count"],
        0.0
    )

    df["inspection_attention_ratio"] = np.where(
        df["inspection_count"] > 0,
        df["needs_attention_count"]
        / df["inspection_count"],
        0.0
    )

    df["critical_equipment_ratio"] = np.where(
        df["equipment_count"] > 0,
        df["critical_equipment_count"]
        / df["equipment_count"],
        0.0
    )

    df["recent_maintenance_ratio"] = np.where(
        df["historical_maintenance_count"] > 0,
        df["maintenance_count_last_90d"]
        / df["historical_maintenance_count"],
        0.0
    )

    return df


# ============================================================
# LOAD MODELS
# ============================================================

def load_models():

    if not RISK_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Risk model not found: {RISK_MODEL_PATH}"
        )

    if not COUNT_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Count model not found: {COUNT_MODEL_PATH}"
        )

    if not COST_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Cost model not found: {COST_MODEL_PATH}"
        )

    risk_model = joblib.load(RISK_MODEL_PATH)
    count_model = joblib.load(COUNT_MODEL_PATH)
    cost_artifact = joblib.load(COST_MODEL_PATH)

    if not isinstance(cost_artifact, dict):
        raise ValueError("Cost artifact must be a dictionary.")

    if "model" not in cost_artifact:
        raise ValueError("Cost artifact missing 'model'.")

    if "risk_model" not in cost_artifact:
        raise ValueError("Cost artifact missing 'risk_model'.")

    cost_model = cost_artifact["model"]
    cost_risk_model = cost_artifact["risk_model"]

    return (
        risk_model,
        count_model,
        cost_model,
        cost_risk_model
    )


# ============================================================
# INITIALIZE MODELS
# ============================================================

try:

    (
        RISK_MODEL,
        COUNT_MODEL,
        COST_MODEL,
        COST_RISK_MODEL
    ) = load_models()

    MODELS_LOADED = True
    MODEL_LOAD_ERROR = None

except Exception as e:

    RISK_MODEL = None
    COUNT_MODEL = None
    COST_MODEL = None
    COST_RISK_MODEL = None

    MODELS_LOADED = False
    MODEL_LOAD_ERROR = str(e)


# ============================================================
# INPUT VALIDATION
# ============================================================

def validate_input(data: dict):

    required_fields = [
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
        "snapshot_month",
    ]

    missing = [
        field
        for field in required_fields
        if field not in data
    ]

    if missing:
        raise ValueError(
            f"Missing required fields: {missing}"
        )

    numeric_nonnegative = [
        "property_age_years",
        "size_sqft",
        "bedrooms_bhk",
        "amenity_count",
        "historical_maintenance_count",
        "maintenance_count_last_90d",
        "historical_maintenance_cost",
        "historical_avg_cost",
        "days_since_last_maintenance",
        "inspection_count",
        "needs_attention_count",
        "equipment_count",
        "avg_equipment_age_years",
        "critical_equipment_count",
    ]

    for field in numeric_nonnegative:

        if data[field] < 0:
            raise ValueError(
                f"{field} cannot be negative."
            )

    if data["size_sqft"] <= 0:
        raise ValueError(
            "size_sqft must be greater than 0."
        )

    if (
        data["critical_equipment_count"]
        > data["equipment_count"]
    ):
        raise ValueError(
            "critical_equipment_count cannot exceed equipment_count."
        )

    if (
        data["needs_attention_count"]
        > data["inspection_count"]
    ):
        raise ValueError(
            "needs_attention_count cannot exceed inspection_count."
        )


# ============================================================
# PREDICTION
# ============================================================

def predict_maintenance(data: dict) -> dict:

    if not MODELS_LOADED:

        raise RuntimeError(
            f"Models could not be loaded: {MODEL_LOAD_ERROR}"
        )

    validate_input(data)

    df = engineer_features(data)

    # --------------------------------------------------------
    # Verify exact feature availability
    # --------------------------------------------------------

    missing_features = [
        feature
        for feature in MODEL_FEATURE_COLUMNS
        if feature not in df.columns
    ]

    if missing_features:

        raise ValueError(
            f"Missing engineered features: {missing_features}"
        )

    X = df[MODEL_FEATURE_COLUMNS].copy()

    # --------------------------------------------------------
    # RISK
    # --------------------------------------------------------

    risk_probability = float(
        RISK_MODEL.predict_proba(X)[0][1]
    )

    risk_prediction = int(
        RISK_MODEL.predict(X)[0]
    )

    # --------------------------------------------------------
    # COUNT
    # --------------------------------------------------------

    predicted_count = float(
        COUNT_MODEL.predict(X)[0]
    )

    predicted_count = max(
        0.0,
        predicted_count
    )

    # --------------------------------------------------------
    # COST
    # --------------------------------------------------------

    cost_risk_probability = float(
        COST_RISK_MODEL.predict_proba(X)[0][1]
    )

    positive_cost = float(
        COST_MODEL.predict(X)[0]
    )

    positive_cost = max(
        0.0,
        positive_cost
    )

    predicted_cost = (
        cost_risk_probability * positive_cost
    )
    
    predicted_cost = max(
        0.0,
        predicted_cost
    )
    
    predicted_cost = predicted_cost * 1000

    # --------------------------------------------------------
    # RISK LEVEL
    # --------------------------------------------------------

    if risk_probability >= 0.70:

        risk_level = "HIGH"

    elif risk_probability >= 0.40:

        risk_level = "MEDIUM"

    else:

        risk_level = "LOW"

    # --------------------------------------------------------
    # FINAL RESPONSE
    # --------------------------------------------------------

    return {
        "maintenance_risk": {
            "prediction": risk_prediction,
            "probability": round(
                risk_probability,
                4
            ),
            "risk_level": risk_level
        },

        "next_month_maintenance_count": round(
            predicted_count,
            2
        ),

        "next_month_maintenance_cost": round(
            predicted_cost,
            2
        ),

        "model_info": {
            "risk_model": "GradientBoosting",
            "count_model": "ExtraTrees",
            "cost_model": "HistGradientBoosting"
        }
    }