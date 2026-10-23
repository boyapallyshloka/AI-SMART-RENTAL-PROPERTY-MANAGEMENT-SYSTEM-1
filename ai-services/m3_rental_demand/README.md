# M3 Rental Demand Prediction

## Canonical dataset

All active M3 data loading uses this single CSV path, defined in
`config.py`:

```text
ai-services/data/ML/M3_Rental_Demand_Property_Type_2024_2026 (1).csv
```

The existing CSV was corrected in place. The original copy was preserved
outside the active M3 data configuration before correction. No rental records
were added or removed.

The source is synthetic/development data for Hyderabad locality, property
type, and month groups. Model metrics are development-data results and do not
establish real-world forecasting accuracy.

## Target definition and corrected features

The training target is `next_month_application_count`. For feature month `t`,
city, locality, and property type, it equals that same series's
`application_count` in the immediately following calendar month `t+1`.
Rows without a consecutive following-month record have a blank target and are
excluded from supervised training/evaluation, but retained in the CSV.

The history features are recalculated within each
city/locality/property-type series:

- `demand_lag_1_month`: previous calendar month's `application_count`.
- `demand_lag_2_month`: application count two calendar months before.
- `demand_growth_1_month`: `(application_count(t) -
  application_count(t-1)) / application_count(t-1)`. It is blank where the
  previous month is unavailable or its application count is zero.

The loader verifies target, lag, and growth values against these definitions
and rejects duplicate series-month keys or schema/value inconsistencies.
Missing lag/growth values at series starts or zero denominators are imputed
inside the fitted model pipeline; preprocessing is fit using training data
only.

## Model features and units

```text
city, area_locality, property_type, month, year, property_count,
application_count, agreement_start_count, average_monthly_rent,
demand_lag_1_month, demand_lag_2_month, demand_growth_1_month,
occupancy_rate, vacancy_rate, available_unit_count
```

`year` is retained. `property_type` is categorical and must be
`APARTMENT`, `INDEPENDENT_HOUSE`, or `VILLA`. `occupancy_rate` and
`vacancy_rate` are fractions from 0 to 1. The target is a non-negative
integer application count with no arbitrary maximum. Since this dataset is
synthetic, its observed target range is not a real-world business limit.

## Training and evaluation

Run from the `ai-services` directory. Candidate training does not overwrite
the active model artifact:

```powershell
python -m m3_rental_demand.feature_engineering
python -m m3_rental_demand.train_model `
  --candidate-output <temporary-candidate.joblib> `
  --evaluation-output <new-evaluation-report.json>
python m3_rental_demand/test_model.py
```

The split is chronological by target month. The final 20% of labeled target
months form the test set; the remaining earlier target months are training
data. A train-mean predictor is reported as a baseline. Train/test metrics,
actual-versus-predicted rows, and train/test error gaps are recorded for
overfitting review, including held-out metrics for each property type. The
artifact records its UTC training time, resolved dataset path and SHA-256,
and SHA-256 fingerprints of the configuration, training script, and
preprocessing script. Evaluation refuses artifacts whose recorded
provenance does not match the current inputs and code.

Only promote the candidate to `artifacts/model_pipeline.joblib` after the
candidate API/inference test and other M3 tests pass. The serving code checks
the artifact's feature list, target definition, and rate units before use.
Predictions are rounded to counts and constrained only to non-negative
values, not capped at 20.

## Backend integration later

The M3 request needs `propertyType` for category-specific predictions, and
occupancy/vacancy rates must be sent as fractions. Backend code is intentionally
not modified here.

## Historical files

Previously generated processed CSVs, reports, and archived scripts are
historical artifacts and are not active input sources. In particular,
`data/ml/m3_rental_demand/train.csv`,
`data/ml/m3_rental_demand/test.csv`,
`reports/feature_engineering_report.json`, and
`reports/model_evaluation.json` refer to an earlier dataset/target contract;
the active training and evaluation paths do not consume them. The active
loader has no old-dataset fallback and does not write a second training CSV.

The active artifact is model version `v2.2`. API inference requires recorded
canonical dataset-path and SHA-256 metadata in addition to the feature and
target contracts. Predictions are rounded to integer counts using Python's
`round` behavior and floored at zero; there is no maximum-count cap.
