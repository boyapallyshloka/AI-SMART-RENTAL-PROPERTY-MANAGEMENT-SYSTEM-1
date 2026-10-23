import sys
import unittest
import os
import hashlib
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient


AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_DIR))

from m3_rental_demand import inference
from m3_rental_demand.config import (
    DATASET_PATH,
    FEATURES,
    MODEL_PATH,
    PROPERTY_TYPES,
    TARGET_DEFINITION,
    TARGET_COLUMN,
)
from m3_rental_demand.main import app
from m3_rental_demand.preprocessing import load_and_prepare, time_based_split


class FixedRegressor:
    def predict(self, frame):
        if list(frame.columns) != FEATURES:
            raise AssertionError("Inference feature list is not canonical.")
        if frame.iloc[0]["property_type"] not in PROPERTY_TYPES:
            raise AssertionError("Inference property type is invalid.")
        return [340.0]


class ZeroRegressor:
    def predict(self, frame):
        return [0.0]


class ZeroApplicationCountRegressor:
    def predict(self, frame):
        if frame.iloc[0]["application_count"] != 0:
            raise AssertionError("A genuine zero application count was changed.")
        return [340.0]


class NegativeRegressor:
    def predict(self, frame):
        return [-2.0]


class NonFiniteRegressor:
    def predict(self, frame):
        return [float("inf")]


class ExistingModelPath:
    def exists(self):
        return True


class MissingModelPath:
    def exists(self):
        return False


class M3RentalDemandTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        target_values = load_and_prepare()[TARGET_COLUMN].dropna().to_numpy(
            dtype=float
        )
        low_threshold, medium_threshold = np.quantile(
            target_values,
            [1 / 3, 2 / 3],
        )
        self.valid_payload = {
            "city": "Hyderabad",
            "areaLocality": "Gachibowli",
            "propertyType": "APARTMENT",
            "month": 12,
            "year": 2026,
            "propertyCount": 401,
            "applicationCount": 89,
            "agreementStartCount": 20,
            "averageMonthlyRent": 25000.0,
            "demandLag1Month": 100,
            "demandLag2Month": 90,
            "demandGrowth1Month": 0.1,
            "occupancyRate": 0.85,
            "vacancyRate": 0.15,
            "availableUnitCount": 20,
        }
        self.artifact = {
            "regressor": FixedRegressor(),
            "features": FEATURES,
            "approach": "regression-only",
            "model_version": "test-model",
            "target": TARGET_COLUMN,
            "target_definition": TARGET_DEFINITION,
            "training_metadata": {
                "dataset_path": str(DATASET_PATH.resolve()),
                "dataset_sha256": hashlib.sha256(
                    DATASET_PATH.read_bytes()
                ).hexdigest().upper(),
            },
            "rate_units": {
                "occupancy_rate": "fraction from 0 to 1",
                "vacancy_rate": "fraction from 0 to 1",
            },
            "demand_level_thresholds": {
                "low_max": float(low_threshold),
                "medium_max": float(medium_threshold),
            },
        }

    def predict(self, payload=None):
        with (
            patch.object(inference, "MODEL_PATH", ExistingModelPath()),
            patch.object(
                inference,
                "TARGET_DEFINITION",
                TARGET_DEFINITION,
            ),
            patch.object(
                inference.joblib,
                "load",
                return_value=self.artifact,
            ),
        ):
            return self.client.post(
                "/m3/predict-rental-demand",
                json=payload or self.valid_payload,
            )

    def test_dataset_contract_and_features(self):
        df = load_and_prepare()

        self.assertEqual(len(df), 2160)
        self.assertTrue(all(feature in df.columns for feature in FEATURES))
        self.assertEqual(
            df["property_type"].unique().tolist(),
            list(PROPERTY_TYPES),
        )
        self.assertEqual(int(df["year"].min()), 2024)
        self.assertEqual(int(df["year"].max()), 2026)
        self.assertTrue(df["occupancy_rate"].between(0, 1).all())
        self.assertTrue(df["vacancy_rate"].between(0, 1).all())
        self.assertEqual(int(df[TARGET_COLUMN].notna().sum()), 2100)
        self.assertEqual(int(df[TARGET_COLUMN].isna().sum()), 60)
        self.assertEqual(int(df[TARGET_COLUMN].max()), 233)

    def test_target_and_lag_features_match_consecutive_month_records(self):
        df = load_and_prepare()
        grouped = df.groupby(
            ["city", "area_locality", "property_type"],
            sort=False,
            observed=True,
        )
        following_apps = grouped["application_count"].shift(-1)
        previous_apps = grouped["application_count"].shift(1)
        previous2_apps = grouped["application_count"].shift(2)

        target_mask = df[TARGET_COLUMN].notna()
        np.testing.assert_array_equal(
            df.loc[target_mask, TARGET_COLUMN].to_numpy(dtype=int),
            following_apps.loc[target_mask].to_numpy(dtype=int),
        )
        lag1_mask = df["demand_lag_1_month"].notna()
        np.testing.assert_array_equal(
            df.loc[lag1_mask, "demand_lag_1_month"].to_numpy(dtype=int),
            previous_apps.loc[lag1_mask].to_numpy(dtype=int),
        )
        lag2_mask = df["demand_lag_2_month"].notna()
        np.testing.assert_array_equal(
            df.loc[lag2_mask, "demand_lag_2_month"].to_numpy(dtype=int),
            previous2_apps.loc[lag2_mask].to_numpy(dtype=int),
        )
        previous_count = previous_apps.replace(0, np.nan)
        expected_growth = (
            (df["application_count"] - previous_apps) / previous_count
        )
        growth_mask = df["demand_growth_1_month"].notna()
        np.testing.assert_allclose(
            df.loc[growth_mask, "demand_growth_1_month"].to_numpy(dtype=float),
            expected_growth.loc[growth_mask].to_numpy(dtype=float),
            atol=1e-9,
            rtol=0,
        )

    def test_chronological_split_has_disjoint_target_months(self):
        df = load_and_prepare()
        train, test = time_based_split(df)

        train_targets = set(
            (train["year_month"] + pd.offsets.MonthBegin(1)).unique()
        )
        test_targets = set(
            (test["year_month"] + pd.offsets.MonthBegin(1)).unique()
        )
        self.assertTrue(train_targets.isdisjoint(test_targets))
        self.assertEqual(len(train) + len(test), 2100)

    def test_target_definition_is_explicit(self):
        self.assertIn("immediately following calendar month", TARGET_DEFINITION)

    def test_root_endpoint(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertEqual(response.json()["docs"], "/docs")

    def test_health_reports_promoted_artifact_ready(self):
        self.assertTrue(MODEL_PATH.exists())
        response = self.client.get("/m3/health")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["modelLoaded"])

    def test_active_model_predicts_through_api(self):
        for property_type in PROPERTY_TYPES:
            with self.subTest(property_type=property_type):
                response = self.client.post(
                    "/m3/predict-rental-demand",
                    json={
                        **self.valid_payload,
                        "propertyType": property_type,
                    },
                )

                self.assertEqual(response.status_code, 200, response.text)
                data = response.json()
                self.assertTrue(data["success"])
                self.assertTrue(
                    np.isfinite(data["predictedDemandCount"])
                )
                self.assertGreaterEqual(data["predictedDemandCount"], 0)
                self.assertEqual(data["propertyType"], property_type)
                self.assertEqual(data["modelVersion"], "v2.2")

    def test_prediction_has_no_twenty_count_cap(self):
        response = self.predict()

        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["propertyType"], "APARTMENT")
        self.assertEqual(data["month"], 1)
        self.assertEqual(data["year"], 2027)
        self.assertEqual(data["predictedDemandCount"], 340)
        self.assertEqual(data["demandLevel"], "HIGH")
        self.assertEqual(data["modelVersion"], "test-model")

    def test_all_supported_property_types_are_accepted(self):
        for property_type in PROPERTY_TYPES:
            with self.subTest(property_type=property_type):
                payload = {
                    **self.valid_payload,
                    "propertyType": property_type,
                }
                response = self.predict(payload)

                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(
                    response.json()["propertyType"],
                    property_type,
                )

    def test_missing_property_type_is_rejected(self):
        payload = self.valid_payload.copy()
        del payload["propertyType"]

        response = self.client.post("/m3/predict-rental-demand", json=payload)

        self.assertEqual(response.status_code, 422)

    def test_invalid_property_type_is_rejected(self):
        payload = {
            **self.valid_payload,
            "propertyType": "ROOM",
        }

        response = self.client.post("/m3/predict-rental-demand", json=payload)

        self.assertEqual(response.status_code, 422)

    def test_invalid_fraction_rate_is_rejected(self):
        payload = {
            **self.valid_payload,
            "occupancyRate": 85,
        }

        response = self.client.post("/m3/predict-rental-demand", json=payload)

        self.assertEqual(response.status_code, 422)

    def test_non_finite_numeric_values_are_rejected(self):
        for field, value in (
            ("averageMonthlyRent", "Infinity"),
            ("demandGrowth1Month", "NaN"),
            ("occupancyRate", "Infinity"),
        ):
            with self.subTest(field=field):
                payload = {**self.valid_payload, field: value}
                response = self.client.post(
                    "/m3/predict-rental-demand",
                    json=payload,
                )

                self.assertEqual(response.status_code, 422)

    def test_negative_property_count_is_rejected(self):
        payload = {
            **self.valid_payload,
            "propertyCount": -1,
        }

        response = self.client.post("/m3/predict-rental-demand", json=payload)

        self.assertEqual(response.status_code, 422)

    def test_negative_rent_and_available_count_are_rejected(self):
        for field, value in (
            ("averageMonthlyRent", -1),
            ("availableUnitCount", -1),
        ):
            with self.subTest(field=field):
                payload = {**self.valid_payload, field: value}
                response = self.client.post(
                    "/m3/predict-rental-demand",
                    json=payload,
                )

                self.assertEqual(response.status_code, 422)

    def test_missing_required_field_is_rejected(self):
        payload = self.valid_payload.copy()
        del payload["city"]

        response = self.client.post("/m3/predict-rental-demand", json=payload)

        self.assertEqual(response.status_code, 422)

    def test_missing_or_null_application_count_is_rejected(self):
        for missing_value in ("omitted", None):
            with self.subTest(application_count=missing_value):
                payload = self.valid_payload.copy()
                if missing_value == "omitted":
                    del payload["applicationCount"]
                else:
                    payload["applicationCount"] = None

                response = self.client.post(
                    "/m3/predict-rental-demand",
                    json=payload,
                )

                self.assertEqual(response.status_code, 422)

    def test_genuine_zero_application_count_is_not_treated_as_missing(self):
        artifact = {
            **self.artifact,
            "regressor": ZeroApplicationCountRegressor(),
        }
        payload = {
            **self.valid_payload,
            "applicationCount": 0,
        }
        with (
            patch.object(inference, "MODEL_PATH", ExistingModelPath()),
            patch.object(inference.joblib, "load", return_value=artifact),
        ):
            response = self.client.post(
                "/m3/predict-rental-demand",
                json=payload,
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["predictedDemandCount"], 340)

    def test_missing_model_artifact_returns_503_without_internal_details(self):
        with patch.object(
            inference,
            "MODEL_PATH",
            MissingModelPath(),
        ):
            response = self.client.post(
                "/m3/predict-rental-demand",
                json=self.valid_payload,
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["detail"],
            "Rental-demand model is unavailable.",
        )
        self.assertNotIn(str(MODEL_PATH), response.text)

    def test_unloadable_model_artifact_returns_503(self):
        with (
            patch.object(inference, "MODEL_PATH", ExistingModelPath()),
            patch.object(
                inference.joblib,
                "load",
                side_effect=OSError("internal model path or loader detail"),
            ),
        ):
            response = self.client.post(
                "/m3/predict-rental-demand",
                json=self.valid_payload,
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["detail"],
            "Rental-demand model is unavailable.",
        )
        self.assertNotIn("internal model path", response.text)

    def test_invalid_month_is_rejected(self):
        payload = {
            **self.valid_payload,
            "month": 13,
        }

        response = self.client.post("/m3/predict-rental-demand", json=payload)

        self.assertEqual(response.status_code, 422)

    def test_zero_and_negative_model_outputs_return_zero(self):
        for regressor in (ZeroRegressor(), NegativeRegressor()):
            artifact = {
                **self.artifact,
                "regressor": regressor,
            }
            with (
                patch.object(inference, "MODEL_PATH", ExistingModelPath()),
                patch.object(inference.joblib, "load", return_value=artifact),
            ):
                response = self.client.post(
                    "/m3/predict-rental-demand",
                    json=self.valid_payload,
                )

            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["predictedDemandCount"], 0)

    def test_non_finite_model_prediction_is_rejected(self):
        artifact = {
            **self.artifact,
            "regressor": NonFiniteRegressor(),
        }
        with (
            patch.object(inference, "MODEL_PATH", ExistingModelPath()),
            patch.object(inference.joblib, "load", return_value=artifact),
        ):
            response = self.client.post(
                "/m3/predict-rental-demand",
                json=self.valid_payload,
            )

        self.assertEqual(response.status_code, 422)
        self.assertIn("non-finite prediction", response.json()["detail"])

    def test_candidate_artifact_inference(self):
        candidate_path = os.environ.get("M3_CANDIDATE_MODEL_PATH")
        if not candidate_path:
            self.skipTest("M3_CANDIDATE_MODEL_PATH is not set.")

        with patch.object(inference, "MODEL_PATH", Path(candidate_path)):
            response = self.client.post(
                "/m3/predict-rental-demand",
                json=self.valid_payload,
            )

        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertIsInstance(result["predictedDemandCount"], int)
        self.assertGreaterEqual(result["predictedDemandCount"], 0)
        self.assertEqual(result["propertyType"], "APARTMENT")


if __name__ == "__main__":
    unittest.main()
