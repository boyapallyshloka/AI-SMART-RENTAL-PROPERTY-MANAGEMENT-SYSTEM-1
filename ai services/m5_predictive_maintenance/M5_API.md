# M5 Predictive Maintenance API

## 1. Purpose

## 2. M5 Targets
- Maintenance Risk
- Next Month Maintenance Count
- Next Month Maintenance Cost

## 3. Model Features
- 23 internal model features

## 4. API Input
- 16 raw fields required from backend

## 5. Feature Engineering
- snapshot_year
- snapshot_month_number
- month_sin
- month_cos
- maintenance_cost_per_event
- inspection_attention_ratio
- critical_equipment_ratio
- recent_maintenance_ratio

## 6. API Endpoints
### GET /health
### POST /predict-maintenance

## 7. Request JSON
[16-field request example]

## 8. Response JSON
[3 prediction outputs]

## 9. Error Handling
- INVALID_INPUT
- MODEL_NOT_FOUND
- PREDICTION_ERROR

## 10. Model Information
- Risk: Gradient Boosting
- Count: Extra Trees
- Cost: HistGradientBoosting

## 11. Model Evaluation
[Test metrics]

## 12. Data Split
[Train / validation / test]

## 13. Artifacts
[List of .joblib files]

## 14. How to Run
[uvicorn command]

## 15. Backend Integration Contract
[Spring Boot → FastAPI flow]

## 16. Backend Required Fields
[16 raw fields and their meaning]

## 17. Integration Notes
- Backend sends raw fields only
- AI service performs feature engineering
- One POST request returns all 3 predictions
- snapshot_month format: YYYY-MM
- Backend should call FastAPI, not send the 23 engineered features

## 18. Testing
- Health: 200
- Valid prediction: 200
- Invalid input: 422

## 19. Known Limitation
[Cost model limitation]

## 20. Version / Metadata