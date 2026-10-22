from fastapi import FastAPI
from fastapi.testclient import TestClient

try:
    from .api import router
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from m6_profitability_prediction.api import router


app = FastAPI()
app.include_router(router)

client = TestClient(app)


payload = {
    "city": "Hyderabad",
    "size_sqft": 1200,
    "bedrooms_bhk": 2,
    "property_age_years": 5,
    "monthly_rent": 25000,
    "collected_rent": 24000,
    "expense_amount": 5000,
    "current_month_profit": 19000,
    "occupancy_rate": 0.95,
    "estimated_vacancy_loss": 1250,
    "revenue_after_estimated_vacancy_loss": 22750,
    "collected_rent_3m_avg": 23500,
    "expense_amount_3m_avg": 4800,
    "current_month_profit_3m_avg": 18700,
    "occupancy_rate_3m_avg": 0.94,
    "estimated_vacancy_loss_3m_avg": 1400,
    "collected_rent_6m_avg": 23000,
    "expense_amount_6m_avg": 4700,
    "current_month_profit_6m_avg": 18300,
    "occupancy_rate_6m_avg": 0.93,
    "estimated_vacancy_loss_6m_avg": 1500,
    "collected_rent_trend": 0.05,
    "expense_amount_trend": 0.02,
    "current_month_profit_trend": 0.04,
    "occupancy_rate_trend": 0.01,
    "estimated_vacancy_loss_trend": -0.02,
}


response = client.post("/m6/predict", json=payload)

print("Status code:", response.status_code)
print("Response:")
print(response.json())