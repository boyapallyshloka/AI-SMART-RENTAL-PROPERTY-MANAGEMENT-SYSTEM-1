# M3 Rental Demand Prediction: Model Comparison & Selection Report

This document presents an empirical comparison of the four machine learning models evaluated for the **M3 Rental Demand Prediction** module within the Avenue360 AI Smart Rental Property Management System.

All evaluations were conducted strictly out-of-time on the standardized validation horizon (**2025-07 to 2025-11**, $N = 10,235$ samples) following training on **2024-01 to 2025-06** per Avenue360 ML Standard v1.1.

---

## 1. Model Comparison Table

The table below contrasts the **Two-Stage Hurdle Pipeline** against three single-stage regression architectures (**Random Forest**, **Gradient Boosting**, and **XGBoost**). 

For continuous regression models, binary classification metrics were computed using the standard decision threshold of $\hat{y} > 0.5$ (where $y > 0$ represents an active demand event):

| Metric | Two-Stage Pipeline (`metrics_final.json`) | Random Forest (`metrics_rf.json`) | Gradient Boosting (`metrics_gb.json`) | XGBoost (`metrics_xgb.json`) |
| :--- | :---: | :---: | :---: | :---: |
| **Model Type / Architecture** | `GradientBoostingClassifier` (weighted) + `GradientBoostingRegressor` | `RandomForestRegressor` (`n=200, depth=10`) | `GradientBoostingRegressor` (`n=200, depth=5, lr=0.05`) | `XGBRegressor` (`n=200, depth=5, lr=0.05`) |
| **MAE** *(Mean Absolute Error)* | **0.4771** | **0.4372** | **0.4330** *(Best)* | **0.4418** |
| **RMSE** *(Root Mean Squared Error)* | **0.7866** | **0.6406** | **0.6324** *(Best)* | **0.6559** |
| **R-squared ($R^2$)** | **0.0619** | **0.3778** | **0.3936** *(Best)* | **0.3478** |
| **Binarized Accuracy** | **70.60%** (`0.7060`) | **75.81%** (`0.7581`) | **75.90%** (`0.7590`) *(Best)* | **75.60%** (`0.7560`) |
| **Binarized F1-Score** | **0.5519** *(Best)* | **0.5284** | **0.5275** | **0.5177** |
| **Recall** *(Demand > 0)* | **63.98%** (`0.6398`) *(Best)* | **47.89%** (`0.4789`) | **47.55%** (`0.4755`) | **46.27%** (`0.4627`) |
| **Precision** *(Demand > 0)* | **48.52%** (`0.4852`) | **58.92%** (`0.5892`) | **59.23%** (`0.5923`) *(Best)* | **58.75%** (`0.5875`) |
| **ROC-AUC** | **0.7560** | **0.7549** | **0.7568** *(Best)* | **0.7509** |

### Confusion Matrix Breakdown (Test Set: $N = 10,235$)
- **Actual Positive Demand Events ($y > 0$)**: $2,896$ ($28.30\%$)
- **Actual Zero-Demand Periods ($y = 0$)**: $7,339$ ($71.70\%$)

| Model | True Positives (TP) | False Negatives (FN - Missed Demand) | False Positives (FP) | True Negatives (TN) |
| :--- | :---: | :---: | :---: | :---: |
| **Two-Stage Pipeline** | **1,853** | **1,043** *(Lowest Misses)* | 1,966 | 5,373 |
| **Random Forest** | 1,387 | 1,509 | 967 | 6,372 |
| **Gradient Boosting** | 1,377 | 1,519 | 948 | 6,391 |
| **XGBoost** | 1,340 | 1,556 | 941 | 6,398 |

---

## 2. Analysis of the Core Trade-Off: Numeric Error vs. Event Recall

An uncritical evaluation based solely on headline regression metrics (MAE, RMSE, $R^2$) would suggest selecting **Gradient Boosting Regressor** ($\text{MAE} = 0.4330$, $R^2 = 0.3936$) over the **Two-Stage Pipeline** ($\text{MAE} = 0.4771$, $R^2 = 0.0619$). However, doing so would overlook how these models behave under real-world rental market dynamics.

### A. The Zero-Inflation Distortion
In the test set, **71.7% of locality-month observations have zero demand** ($y = 0$). Standard regression loss functions (MAE and MSE) penalize variance across the entire distribution. Consequently, single-stage regressors (RF, GB, XGB) learn to play it safe:
- They heavily shrink predictions toward zero or fractional values between $0.1$ and $0.4$.
- Because predictions for small demand spikes remain below the $0.5$ threshold, these models artificially minimize squared error and maximize passive True Negatives ($\text{TN} \approx 6,370\text{--}6,400$).
- This inflates **Binarized Accuracy to ~75.9%**, yet that accuracy is almost entirely driven by correctly classifying inactive markets, not active ones.

### B. The Catastrophic Failure on Actual Demand (False Negatives)
When evaluating their ability to catch real tenant demand ($y > 0$):
- **Gradient Boosting misses 1,519 out of 2,896 actual demand events (52.45% False Negative rate; Recall = 47.55%)**.
- **Random Forest misses 1,509 demand events (52.11% False Negative rate; Recall = 47.89%)**.
- **XGBoost misses 1,556 demand events (53.73% False Negative rate; Recall = 46.27%)**.

All three single-stage regression models fail to alert stakeholders to **more than half** of all genuine demand opportunities in the rental market.

### C. The Business Decision-Support Reality
M3 is deployed as a **business decision-support tool** for property managers, asset owners, and landlords. In property operations, the business cost structure between error types is asymmetric:

1. **Cost of a False Negative (Type II Error - Missing Real Demand): HIGH**
   - If the model predicts $0$ demand when demand is actually positive, landlords fail to ready units, withhold digital ad spending, miss optimal leasing velocity, and suffer prolonged vacancy.
   - For an institutional portfolio, missing active leasing windows translates directly into unrecovered rent and extended days-on-market.

2. **Cost of a False Positive / Minor Count Imprecision: LOW**
   - If the model predicts demand when actual demand is $0$ (or overestimates count by fractional amounts), the property manager proactively stages or features the listing.
   - The operational penalty is negligible marketing overhead.
   - Crucially, the Two-Stage Pipeline's MAE penalty relative to Gradient Boosting is only **$0.0441$ units** ($0.4771$ vs $0.4330$). This represents a discrepancy of less than **one-twentieth of an application** per micro-market per month—an imperceptible difference on the ground.

### D. Why the Two-Stage Pipeline Excels
By using a **class-weighted classifier** in Stage 1, the Two-Stage Pipeline decouples the question of *“Will there be any leasing activity?”* from *“How many units will be leased?”*.
- It boosts Recall from **47.55% to 63.98%**, capturing **1,853 real demand events** compared to GB's 1,377 (a net gain of **476 active markets detected**).
- It reduces missed demand events from 1,519 down to 1,043—a **31.3% reduction in costly false negatives**.
- It achieves the highest overall **Binarized F1-score (0.5519)**, demonstrating the superior balance between precision and sensitivity.

---

## 3. Final Recommendation

### **Recommended Model: Two-Stage Hurdle Pipeline (`model_pipeline.joblib`)**

Going forward, the **Two-Stage Pipeline** (`GradientBoostingClassifier(weighted)` + `GradientBoostingRegressor`, recorded in `metrics_final.json`) is the recommended production model for the M3 Rental Demand module.

### Concrete Justification Based on Evaluated Metrics:
1. **Superior Event Detection (+16.43% Recall Advantage)**:
   The Two-Stage Pipeline detects **$63.98\%$** of positive demand occurrences, compared to $47.89\%$ for Random Forest, $47.55\%$ for Gradient Boosting, and $46.27\%$ for XGBoost. In absolute terms, it correctly captures **1,853 demand events** vs. 1,377 for GB and 1,340 for XGB.
2. **Substantial Reduction in Business-Critical Misses**:
   The Two-Stage Pipeline slashes False Negatives to **1,043**, avoiding over **476 to 513 missed leasing opportunities** that the single regressors fail to detect.
3. **Highest Binarized F1-Score ($0.5519$)**:
   The pipeline achieves the highest harmonic balance between precision and recall ($0.5519$ vs $0.5275$ for GB and $0.5177$ for XGB), proving that its recall gains do not collapse predictive utility.
4. **Negligible Operational Accuracy Penalty**:
   While the Two-Stage Pipeline registers a lower $R^2$ ($0.0619$ vs $0.3936$) and higher MAE ($0.4771$ vs $0.4330$), the absolute difference in MAE is only **$0.0441$ units**. Trading $0.044$ fractional tenant applications of raw numeric precision in exchange for detecting 476 additional active rental micro-markets is an overwhelmingly favorable trade-off for property operations.

---

## 4. Explicit Trade-Off Assumption

> **Primary Operating Assumption:**
> This recommendation explicitly assumes that **detecting real leasing demand surges and active tenant interest (maximizing Recall / minimizing False Negatives)** carries substantially higher business and operational priority than minimizing raw fractional count variance (MAE/RMSE) or maximizing passive zero-demand recognition.

### Alternative Priority Considerations:
If an organization's business priorities differ:
- **Choose Gradient Boosting Regressor (`metrics_gb.json`) IF:**
  - The primary KPI is aggregate portfolio count calibration or financial budgeting where minimizing overall variance ($\text{MAE} = 0.4330$, $\text{RMSE} = 0.6324$, $R^2 = 0.3936$) is the sole mandate.
  - Or marketing/operational capital is so strictly constrained that False Positives cannot be tolerated, prioritizing Precision ($59.23\%$ vs $48.52\%$) at the known expense of missing more than half ($52.45\%$) of all localized leasing demand opportunities.
