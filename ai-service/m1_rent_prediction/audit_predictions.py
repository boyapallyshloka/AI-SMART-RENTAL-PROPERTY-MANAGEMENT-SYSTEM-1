
from pathlib import Path

import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "models" / "m1_model_pipeline_onehot_candidate.joblib"
DATA_PATH = BASE_DIR / "data" / "ml" / "M1_Hyderabad_CURRENT_2026_VALIDATION_LEAKAGE_SAFE.csv"
OUTPUT_PATH = BASE_DIR / "data" / "ml" / "M1_candidate_error_audit.csv"

df = pd.read_csv(DATA_PATH)
model = joblib.load(MODEL_PATH)

features = df.drop(columns=["monthly_rent", "data_source"], errors="ignore")
actual = df["monthly_rent"].astype(float)
predicted = model.predict(features)

audit = df.copy()
audit["predicted_rent"] = np.round(predicted, 2)
audit["absolute_error"] = np.abs(actual - predicted)
audit["percentage_error"] = (
    audit["absolute_error"] / actual.replace(0, np.nan) * 100
).round(2)

audit = audit.sort_values("absolute_error", ascending=False)

columns = [
    "area_locality", "property_type", "size_sqft", "bedrooms_bhk",
    "monthly_rent", "predicted_rent", "absolute_error", "percentage_error"
]

print("\nWorst 20 predictions:")
print(audit[columns].head(20).to_string(index=False))
print("\nOverall MAE:", round(mean_absolute_error(actual, predicted), 2))

audit.to_csv(OUTPUT_PATH, index=False)
print("\nFull audit saved to:", OUTPUT_PATH)
