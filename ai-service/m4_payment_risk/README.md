# Avenue360 M4 - Tenant Payment Risk Analysis

## 1. Module Overview

M4 is the Tenant Payment Risk Analysis module of the Avenue360 AI/ML service.

The module analyzes historical tenant payment behavior and produces a payment-risk indicator.

The purpose of the module is to support property-management decision making by identifying tenants whose historical payment behavior is associated with higher future payment risk.

The M4 prediction is a decision-support indicator. It must not be used as an automatic tenant rejection or approval mechanism.

---

## 2. Objective

The objective of M4 is to predict whether a tenant is likely to exhibit bad payment behavior in the future based on information available at a historical snapshot.

The model uses historical payment-related features such as:

- Historical invoice count
- Late payment count
- Missed payment count
- Average days late
- Maximum days late
- Historical outstanding amount
- Rent-to-income ratio
- Payment completion ratio
- Recent payment behavior
- Payment behavior trends

---

## 3. Target Variable

The target variable is:

```text
risk_label