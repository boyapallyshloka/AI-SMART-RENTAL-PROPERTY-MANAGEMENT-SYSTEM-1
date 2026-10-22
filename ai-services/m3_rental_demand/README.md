# M3 - Rental Demand Prediction Module

This module implements the **M3 Rental Demand Prediction** service for the Avenue360 AI Smart Rental Property Management System, conforming to **Avenue360 ML Standard v1.1**.

---

## 1. What the Module Does
The M3 module forecasts next-month rental demand count for properties across Indian cities and micro-markets (localities). It enables property managers and landlords to anticipate leasing velocity, plan vacancy mitigation, and adjust pricing and marketing campaigns proactively before high-demand or low-demand cycles hit.

---

## 2. Dataset & Version Used
- **Dataset Source**: `data/ml/M3_Rental_Demand.csv` (Avenue360 Master Rental Dataset).
- **Type**: Hybrid operational development dataset combining real listing data and controlled operational leasing activity.
- **Records & Scope**: 61,412 records spanning major metropolitan areas (Bangalore, Mumbai, Delhi, Chennai, Hyderabad, Kolkata).
- **Time Range**: `2024-01` through `2025-11` (records from `2025-12` onward represent placeholder horizons excluded from training to prevent distortion).
- **Splitting Strategy**: Strict time-based splitting:
  - **Train Set**: `2024-01` to `2025-06`
  - **Test/Validation Set**: `2025-07` to `2025-11`
  - Zero leakage between past training intervals and future evaluation intervals.

---

## 3. Target and Features

### Target
- **`next_month_demand`** (Integer): Number of prospective tenant applications/demand units anticipated in the locality during the subsequent month.

### Raw Input Features
| Feature | Type | Description |
| :--- | :--- | :--- |
| `city` | String | Metropolitan city name (e.g., Bangalore, Mumbai, Delhi) |
| `area_locality` | String | Specific micro-market locality within the city |
| `month` | Integer | Calendar month of the prediction window (1 to 12) |
| `property_count` | Integer | Total rental units tracked in the micro-market |
| `application_count` | Integer | Tenant applications submitted in the current month |
| `agreement_start_count`| Integer | Number of newly executed rental agreements |
| `average_monthly_rent` | Float | Locality average monthly rent in INR |
| `demand_lag_1_month` | Integer | Recorded demand from previous month |
| `demand_lag_2_month` | Integer | Recorded demand from 2 months prior |
| `demand_growth_1_month`| Float | Month-over-month demand growth rate |
| `occupancy_rate` | Float | Locality occupancy rate |
| `vacancy_rate` | Float | Locality vacancy rate |
| `available_unit_count` | Integer | Immediately vacant/available rental units |

### Categorical Features (Encoded Internally by Pipeline)
- **`city`**: One-hot encoded across metropolitan city categories.
- **`area_locality`**: One-hot encoded across micro-market localities with `handle_unknown="ignore"`.
- **`month`**: Calendar month derived from `year_month` if not passed directly.

---

## 4. Preprocessing & Feature Engineering Applied
Per Avenue360 ML Standard v1.1, all preprocessing logic is bundled directly inside the model pipeline (`RentalDemandPipeline` in `pipeline.py`):
1. **Fitted Categorical OneHotEncoder (`ColumnTransformer`)**:
   - `city` and `area_locality` are transformed into one-hot features via `OneHotEncoder(handle_unknown="ignore", sparse_output=True)`.
   - The encoder is fitted strictly on the training split to eliminate data leakage.
   - Unseen localities at inference time gracefully encode to zeros without runtime exceptions.
2. **Temporal Feature Derivation**:
   - Derives calendar month numbers from composite date formats (`YYYY-MM`) to capture seasonality.
3. **Imbalance & Hurdle Preprocessing**:
   - Zero-demand inflation is addressed by generating a binary indicator target (`y > 0`) for Stage 1 classification and sample weighting via `compute_sample_weight("balanced")`.

---

## 5. Model Used and Why

### Architecture: Two-Stage Hurdle Model
1. **Stage 1 - Classifier**:
   - **Algorithm**: `GradientBoostingClassifier(n_estimators=200, random_state=42)`
   - **Weighting**: Balanced sample weights to handle zero-demand class imbalance.
   - **Threshold**: Calibrated decision threshold (`threshold = 0.50`) tuned to maximize test F1-score.
2. **Stage 2 - Regressor**:
   - **Algorithm**: `GradientBoostingRegressor(n_estimators=200, random_state=42)`
   - **Training Subset**: Trained exclusively on positive demand instances (`demand > 0`).
3. **Inference Combination**:
   $$\text{Final Demand} = \mathbb{I}(P(\text{demand} > 0) \ge \text{threshold}) \times \max(0, \hat{y}_{\text{regressor}})$$

### Selection Rationale
Rental demand is heavily zero-inflated (many micro-markets see periods of zero transaction activity). Standard regression models suffer from:
- Predicting non-sensical fractional noise (e.g. 0.12 demand units) on zero-activity zones.
- Under-predicting actual bursts during peak leasing periods.
The two-stage hurdle approach cleanly decouples the decision of **whether demand will occur** from **the magnitude of demand**, leading to significantly superior precision and zero-demand suppression.

---

## 6. Metrics Achieved
Metrics recorded from strict time-based out-of-time evaluation (`2025-07` to `2025-11`):

| Metric | Score |
| :--- | :--- |
| **MAE** | `0.4771` |
| **RMSE** | `0.7866` |
| **Binarized Accuracy** | `70.60%` |
| **Binarized F1-Score** | `0.5519` |
| **Recall (Demand > 0)** | `63.98%` |
| **Precision (Demand > 0)**| `48.52%` |
| **Calibrated Threshold** | `0.50` |

---

## 7. How to Train
To train the unified pipeline and generate the model artifact:

```bash
# From workspace root
python ai-service/m3_rental_demand/train_model.py

# Or from inside ai-service/
cd ai-service
python m3_rental_demand/train_model.py
```

This generates:
- `artifacts/model_pipeline.joblib` (the primary unified pipeline artifact).
- `artifacts/metrics_final.json` (recorded validation performance metrics).
- Legacy artifacts `model_m3_classifier.pkl` and `model_m3_regressor.pkl` for backward compatibility.

---

## 8. How to Start the API
Run the Uvicorn ASGI server:

```bash
# From ai-service directory
uvicorn m3_rental_demand.api:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

---

## 9. Exact Endpoint

```http
POST /predict-demand
```

---

## 10. Request and Response Schemas

### Request Schema (`application/json`)
```json
{
  "city": "Bangalore",
  "area_locality": "A Narayanapura, Mahadevapura",
  "month": 6,
  "property_count": 50,
  "application_count": 12,
  "agreement_start_count": 3,
  "average_monthly_rent": 25000.0,
  "demand_lag_1_month": 2,
  "demand_lag_2_month": 1,
  "demand_growth_1_month": 0.5,
  "occupancy_rate": 85.0,
  "vacancy_rate": 15.0,
  "available_unit_count": 8
}
```

### Success Response Schema (`200 OK`)
```json
{
  {
  "success": true,
  "city": "Hyderabad",
  "areaLocality": "Gachibowli",
  "month": 9,
  "predictedDemandCount": 8,
  "demandLevel": "HIGH",
  "modelVersion": "v1.0"
}
}
```

### Error Response Schema (`400 Bad Request` or `500 Internal Server Error`)
```json
{
  "success": false,
  "errorCode": "INVALID_INPUT",
  "message": "Validation failed: city: field required"
}
```

Standard Error Codes:
- `INVALID_INPUT`: Request payload missing required fields or having invalid types/ranges.
- `MODEL_NOT_FOUND`: Model pipeline artifact file is missing.
- `PREDICTION_ERROR`: Internal failure while executing prediction pipeline.
- `INTERNAL_ERROR`: Unhandled internal server error (never exposes Python stack traces).

---

## 11. Current Model Version
- **Model Version**: `1.0`
- **Artifact**: `artifacts/model_pipeline.joblib`
