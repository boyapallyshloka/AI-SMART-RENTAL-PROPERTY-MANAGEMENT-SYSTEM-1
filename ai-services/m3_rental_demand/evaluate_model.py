import argparse
import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from m3_rental_demand.config import (
    DATASET_PATH,
    FEATURES,
    MODEL_PATH,
    MODEL_VERSION,
    TARGET_DEFINITION,
    TARGET_COLUMN,
)
from m3_rental_demand.preprocessing import load_and_prepare, time_based_split
from m3_rental_demand.train_model import regression_metrics


def _sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate the active M3 artifact on the canonical dataset."
    )
    parser.add_argument(
        "--evaluation-output",
        type=Path,
        required=True,
        help="New report path; do not overwrite existing historical reports.",
    )
    args = parser.parse_args()

    df = load_and_prepare()
    train_df, test_df = time_based_split(df)
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"M3 model artifact not found: {MODEL_PATH}")

    artifact = joblib.load(MODEL_PATH)
    if artifact.get("features") != FEATURES:
        raise ValueError("Active M3 artifact has a stale feature contract.")
    if (
        artifact.get("target") != TARGET_COLUMN
        or artifact.get("target_definition") != TARGET_DEFINITION
    ):
        raise ValueError("Active M3 artifact has a stale target contract.")
    training_metadata = artifact.get("training_metadata", {})
    expected_provenance = {
        "dataset_sha256": _sha256(DATASET_PATH),
        "config_script_sha256": _sha256(
            Path(__file__).with_name("config.py")
        ),
        "training_script_sha256": _sha256(
            Path(__file__).with_name("train_model.py")
        ),
        "preprocessing_script_sha256": _sha256(
            Path(__file__).with_name("preprocessing.py")
        ),
    }
    recorded_dataset_path = training_metadata.get("dataset_path")
    if (
        not isinstance(training_metadata, dict)
        or not isinstance(recorded_dataset_path, str)
        or Path(recorded_dataset_path).resolve() != DATASET_PATH.resolve()
        or any(
            training_metadata.get(name) != value
            for name, value in expected_provenance.items()
        )
    ):
        raise ValueError(
            "Active M3 artifact provenance does not match the canonical "
            "dataset and current training/configuration code."
        )
    model = artifact["regressor"]
    y_train = train_df[TARGET_COLUMN].to_numpy(dtype=float)
    y_test = test_df[TARGET_COLUMN].to_numpy(dtype=float)
    train_predictions = model.predict(train_df[FEATURES])
    test_predictions = model.predict(test_df[FEATURES])
    if not all(
        np.isfinite(values).all()
        for values in (train_predictions, test_predictions)
    ):
        raise ValueError("The active M3 model returned non-finite predictions.")
    test_predictions = np.maximum(0, test_predictions)
    train_mean = float(y_train.mean())
    property_type_metrics = {}
    for property_type in sorted(test_df["property_type"].unique()):
        train_type = train_df.loc[
            train_df["property_type"] == property_type, TARGET_COLUMN
        ]
        test_mask = test_df["property_type"].eq(property_type).to_numpy()
        type_actual = y_test[test_mask]
        property_type_metrics[property_type] = {
            "train_rows": int(len(train_type)),
            "test_rows": int(test_mask.sum()),
            "test_target_min": int(type_actual.min()),
            "test_target_max": int(type_actual.max()),
            "model_test_metrics": regression_metrics(
                type_actual,
                test_predictions[test_mask],
            ),
            "train_mean_baseline_test_metrics": regression_metrics(
                type_actual,
                [train_mean] * len(type_actual),
            ),
        }

    report = {
        "dataset_path": str(DATASET_PATH),
        "dataset_sha256": _sha256(DATASET_PATH),
        "model_version": artifact.get("model_version", MODEL_VERSION),
        "target": artifact["target"],
        "target_definition": TARGET_DEFINITION,
        "features": FEATURES,
        "training_metadata": training_metadata,
        "split": {
            "strategy": "chronological by target month",
            "train_rows": len(train_df),
            "test_rows": len(test_df),
        },
        "target_range": {
            "labeled_min": int(min(y_train.min(), y_test.min())),
            "labeled_max": int(max(y_train.max(), y_test.max())),
            "test_min": int(y_test.min()),
            "test_max": int(y_test.max()),
        },
        "model_metrics": {
            "train": regression_metrics(y_train, train_predictions),
            "test": regression_metrics(y_test, test_predictions),
        },
        "train_mean_baseline_metrics": {
            "train": regression_metrics(
                y_train,
                [train_mean] * len(y_train),
            ),
            "test": regression_metrics(
                y_test,
                [train_mean] * len(y_test),
            ),
        },
        "property_type_metrics": property_type_metrics,
        "actual_vs_predicted": [
            {
                "city": row.city,
                "area_locality": row.area_locality,
                "property_type": row.property_type,
                "target_month": str(
                    (row.year_month + pd.offsets.MonthBegin(1)).date()
                ),
                "actual": int(getattr(row, TARGET_COLUMN)),
                "predicted": round(float(prediction), 4),
            }
            for row, prediction in zip(
                test_df.itertuples(index=False),
                test_predictions,
            )
        ],
    }
    args.evaluation_output.parent.mkdir(parents=True, exist_ok=True)
    args.evaluation_output.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2))
    print("Evaluation report:", args.evaluation_output)


if __name__ == "__main__":
    main()
