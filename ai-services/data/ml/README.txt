Avenue360 Module-Specific ML Datasets
======================================
These datasets are derived from the connected Avenue360 master data.

M1: Rent prediction; target = monthly_rent.
M2: Property recommendation; target = match_label, with match_score for evaluation.
M3: Rental demand; target = next_month_demand.
M4: Payment risk; target = risk_label, based on future payment behavior after the feature cutoff.
M5: Predictive maintenance; target = future maintenance count/cost and maintenance_risk_label.
M6: Profitability; target = next_month_profit and profitability_label.

Important:
- These are development/training datasets built from the Avenue360 working data.
- Operational source tables contain controlled synthetic records.
- Do not use leakage columns such as rent_per_sqft in M1 when predicting monthly_rent.
- Scout is primarily an operational/RBAC chatbot and does not require a separate predictive ML dataset.
