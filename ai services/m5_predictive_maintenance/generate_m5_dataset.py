"""
Generate a synthetic-but-realistic dataset for M5 Predictive Maintenance.

The target maintenance_risk_label is generated from information that would be
available at the snapshot month. Future maintenance columns are retained only
for target creation/analysis and must not be used as model predictors.
"""

from pathlib import Path
import numpy as np
import pandas as pd

RANDOM_STATE = 42
N_PROPERTIES = 500
START_MONTH = "2024-01-01"
END_MONTH = "2026-12-01"

OUTPUT_PATH = (
    Path(__file__).resolve().parent.parent
    / "data" / "ml" / "M5_Predictive_Maintenance.csv"
)

COLUMNS = [
    "property_id", "snapshot_month", "property_age_years", "size_sqft",
    "bedrooms_bhk", "amenity_count", "historical_maintenance_count",
    "maintenance_count_last_90d", "historical_maintenance_cost",
    "historical_avg_cost", "days_since_last_maintenance",
    "dominant_issue_category", "next_month_maintenance_count",
    "next_month_maintenance_cost", "maintenance_risk_label",
    "inspection_count", "needs_attention_count", "equipment_count",
    "avg_equipment_age_years", "critical_equipment_count",
]

CATEGORIES = np.array([
    "AC", "APPLIANCE", "CLEANING", "ELECTRICAL",
    "OTHER", "PLUMBING", "STRUCTURAL"
])


def generate_dataset():
    rng = np.random.default_rng(RANDOM_STATE)
    months = pd.date_range(START_MONTH, END_MONTH, freq="MS")

    properties = []
    for i in range(N_PROPERTIES):
        age = int(rng.integers(1, 31))
        size = int(np.clip(rng.normal(1050, 300), 450, 2200) // 50 * 50)
        bedrooms = int(np.clip(np.round(size / 500 + rng.normal(0, 0.45)), 1, 4))
        amenities = int(np.clip(rng.poisson(3), 1, 8))
        equipment = int(np.clip(rng.poisson(2.3) + 1, 1, 6))
        equipment_age = float(
            np.clip(rng.normal(3.5 + age * 0.12, 1.2), 1, 12)
        )
        critical = int(np.clip(
            rng.binomial(
                equipment,
                np.clip(0.15 + 0.01 * age, 0.10, 0.40)
            ),
            0,
            equipment
        ))

        # Stable property-level maintenance tendency.
        base_risk = 0.08 + 0.012 * age + 0.025 * (equipment_age / 5)
        base_risk += 0.018 * critical + rng.normal(0, 0.025)

        properties.append(
            (
                f"P{i + 1:05d}", age, size, bedrooms, amenities,
                equipment, equipment_age, critical, float(base_risk)
            )
        )

    rows = []

    for (
        property_id, age, size, bedrooms, amenities, equipment,
        equipment_age, critical, base_risk
    ) in properties:

        # Past maintenance events only.
        events = []
        last_event = None

        # Each property gets its own recurring issue profile.
        issue_weights = rng.dirichlet(
            np.array([1.5, 1.0, 0.8, 1.1, 0.6, 1.4, 0.5])
        )

        for snapshot in months:
            prior_events = [
                event for event in events if event[0] < snapshot
            ]

            historical_count = sum(event[1] for event in prior_events)
            historical_cost = sum(event[2] for event in prior_events)

            recent_events = [
                event for event in prior_events
                if (snapshot - event[0]).days <= 90
            ]
            recent_count = sum(event[1] for event in recent_events)

            if last_event is None:
                days_since_last = int(rng.integers(20, 180))
            else:
                days_since_last = (snapshot - last_event).days

            inspection_count = int(
                rng.poisson(1.2 + 0.03 * age + 0.5 * (recent_count > 0))
            )

            attention_probability = np.clip(
                0.05
                + 0.12 * base_risk
                + 0.10 * (recent_count > 0)
                + 0.03 * critical,
                0.02,
                0.70
            )

            needs_attention = int(
                rng.binomial(max(inspection_count, 1), attention_probability)
            )

            dominant_issue = CATEGORIES[
                rng.choice(len(CATEGORIES), p=issue_weights)
            ]

            # The future event probability depends on historical/current
            # information only. This creates genuine learnable signal.
            seasonality = 0.12 * np.sin(
                2 * np.pi * snapshot.month / 12
            )

            logit = (
                -4.60
                + 0.055 * age
                + 0.085 * equipment_age
                + 0.11 * critical
                + 0.18 * recent_count
                + 0.035 * needs_attention
                + 0.0015 * max(days_since_last - 60, 0)
                + 0.035 * min(historical_count, 15)
                + 0.00015 * min(historical_cost, 15000)
                + seasonality
                + rng.normal(0, 0.12)
            )

            probability = float(
                np.clip(1 / (1 + np.exp(-logit)), 0.005, 0.70)
            )

            next_month_count = int(rng.random() < probability)

            if next_month_count:
                # A smaller fraction of cases have multiple maintenance events.
                next_month_count += int(
                    rng.random() < min(0.25, probability * 0.8)
                )

                next_month_cost = float(np.round(
                    np.sum(
                        rng.lognormal(
                            mean=np.log(950 + 80 * age),
                            sigma=0.45,
                            size=next_month_count
                        )
                    ),
                    2
                ))
            else:
                next_month_cost = 0.0

            historical_avg_cost = (
                historical_cost / historical_count
                if historical_count > 0
                else 0.0
            )

            rows.append({
                "property_id": property_id,
                "snapshot_month": snapshot.strftime("%Y-%m"),
                "property_age_years": age,
                "size_sqft": size,
                "bedrooms_bhk": bedrooms,
                "amenity_count": amenities,
                "historical_maintenance_count": historical_count,
                "maintenance_count_last_90d": recent_count,
                "historical_maintenance_cost": round(historical_cost, 2),
                "historical_avg_cost": round(historical_avg_cost, 2),
                "days_since_last_maintenance": days_since_last,
                "dominant_issue_category": dominant_issue,
                "next_month_maintenance_count": next_month_count,
                "next_month_maintenance_cost": next_month_cost,
                "maintenance_risk_label": int(next_month_count > 0),
                "inspection_count": inspection_count,
                "needs_attention_count": needs_attention,
                "equipment_count": equipment,
                "avg_equipment_age_years": round(equipment_age, 1),
                "critical_equipment_count": critical,
            })

            # Future event becomes historical information at the next snapshot.
            if next_month_count:
                next_snapshot = snapshot + pd.offsets.MonthBegin(1)
                events.append((
                    next_snapshot,
                    next_month_count,
                    next_month_cost,
                    dominant_issue
                ))
                last_event = next_snapshot

    return pd.DataFrame(rows, columns=COLUMNS)


if __name__ == "__main__":
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    dataset = generate_dataset()
    dataset.to_csv(OUTPUT_PATH, index=False)

    print("M5 dataset generated successfully.")
    print(f"Output : {OUTPUT_PATH}")
    print(f"Shape  : {dataset.shape}")
    print(f"Properties : {dataset['property_id'].nunique():,}")
    print(
        "Positive risk : "
        f"{dataset['maintenance_risk_label'].mean() * 100:.2f}%"
    )
    print(
        "Date range : "
        f"{dataset['snapshot_month'].min()} to "
        f"{dataset['snapshot_month'].max()}"
    )