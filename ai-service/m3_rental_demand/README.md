# M3 Rental Demand Prediction

M3 predicts the next-period demand count using the canonical dataset's
`next_month_demand` target. The target's generation provenance is unverified;
results are development evaluations and must not be represented as verified
real-world forecasting accuracy.

## Dataset and model contract

The module reads the existing file
`ai-services/data/ml/M3_Rental_Demand_Property_Type_2024_2026 (1).csv`.
It does not copy or alter the dataset. The sole target is
`next_month_demand`.

Model inputs:

| Field | Meaning and validation |
| --- | --- |
| `city` | Non-blank city |
| `area_locality` | Non-blank locality |
| `property_type` | `APARTMENT`, `VILLA`, or `INDEPENDENT_HOUSE` |
| `month` | Current observation month, 1–12 |
| `property_count` | Non-negative whole count |
| `application_count` | Non-negative whole count for the current observation month |
| `agreement_start_count` | Non-negative whole count for the current observation month |
| `average_monthly_rent` | Non-negative rent in the dataset's currency units |
| `demand_lag_1_month` | Previous calendar month's observed application count |
| `demand_lag_2_month` | Application count from two calendar months earlier |
| `demand_growth_1_month` | Current versus previous application change, rounded to four decimals |
| `occupancy_rate` | Fraction from 0 to 1, not a percentage |
| `vacancy_rate` | Fraction from 0 to 1, not a percentage |
| `available_unit_count` | Non-negative whole count |

`year` is required for forecast-period reporting and splitting, but is not a
model feature. All numeric features above must be available at the current
observation cutoff. The backend must supply the complete record; selecting a
property type alone is not enough to generate a prediction.

During training, the CSV lag and growth values are replaced by features
recomputed from observed `application_count` values within each
city/locality/property-type series. A lag is set missing if the exact calendar
month is absent; those rows are excluded from training rather than given
fabricated history. Growth is `(current - previous) / previous`, rounded to four
decimals. If previous applications are zero, growth is zero when current
applications are also zero; otherwise it is the current count, matching the
existing backend's zero-denominator rule. The first two months of each series
therefore do not have complete training history.

## Training and evaluation

The model is the previous M3 regression algorithm and configuration:

```text
GradientBoostingRegressor(
    n_estimators=100,
    learning_rate=0.05,
    max_depth=2,
    loss="huber",
    random_state=42,
)
```

Numeric fields use median imputation. City, locality, and property type use
most-frequent imputation and one-hot encoding with unseen categories ignored.
The time split trains on observations through December 2025 and evaluates on
January–December 2026. The baseline predicts current `application_count`.
Metrics include MAE, RMSE, R², and per-property-type results. Demand-level
labels use the training-target 1/3 and 2/3 quantiles recorded in model
metadata.

From the repository's `ai-services` directory:

```powershell
.\.venv\Scripts\python.exe -m m3_rental_demand.train_model
.\.venv\Scripts\python.exe -m pytest m3_rental_demand\tests -q
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

The last command starts the existing shared AI service, whose M3 router
registration already points to this module. No shared application files were
changed.

The trained pipeline is saved to
`ai-services/m3_rental_demand/artifacts/model_pipeline.joblib`; actual metrics,
feature schema, split periods, and target provenance note are recorded in
`artifacts/model_metadata.json`.

## API contract

The module exposes a router for the shared AI service; no shared application
files are changed. When the existing AI service includes this router, the
endpoints are:

- `GET /m3/health`
- `POST /m3/predict-rental-demand`

Request fields accept snake_case or camelCase. Example snake_case payload:

```json
{
  "city": "Hyderabad",
  "area_locality": "Gachibowli",
  "property_type": "VILLA",
  "year": 2026,
  "month": 11,
  "property_count": 39,
  "application_count": 6,
  "agreement_start_count": 3,
  "average_monthly_rent": 25000,
  "demand_lag_1_month": 5,
  "demand_lag_2_month": 4,
  "demand_growth_1_month": 0.2,
  "occupancy_rate": 0.78,
  "vacancy_rate": 0.22,
  "available_unit_count": 8
}
```

The backend must calculate all inputs for the selected property type. In
particular, existing locality-wide aggregates must be extended or replaced
with type-filtered aggregates before these fields can represent the dataset's
type-specific rows.

Successful responses include `success`, `city`, `areaLocality`,
`propertyType`, `forecastPeriod`, non-negative integer `predictedDemandCount`,
`demandUnit`, `demandLevel`, `modelVersion`, and `target`. The prediction is
rounded to a whole count for compatibility with the previous M3 output.
Invalid input returns `INVALID_INPUT`; a missing trained artifact returns
`MODEL_NOT_FOUND`.

## Known limitations

- `next_month_demand` is used as the sole target, but its generation method is
  not verified and it is not consistently equal to the following month's
  `application_count`.
- The dataset covers Hyderabad only and uses controlled/generated data;
  results do not establish accuracy for other markets or operational data.
- The current Java workflow aggregates by locality, not property type, and
  emits occupancy/vacancy percentages. Integration must filter the aggregates
  by property type and send rates on the dataset's 0-to-1 scale.
- Backend property type `HOUSE` must map to dataset category
  `INDEPENDENT_HOUSE`.
