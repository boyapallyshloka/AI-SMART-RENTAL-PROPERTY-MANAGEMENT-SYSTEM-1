from pathlib import Path

import pandas as pd

from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import OneHotEncoder


BASE_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = BASE_DIR / "data" / "ml" / "M1_Rent_Prediction_final.csv"

TARGET_COLUMN = "current_listing_rent"

CATEGORICAL_COLUMNS = [
    "city",
    "area_type",
    "furnishing_status",
    "property_type"
]

LOCALITY_COLUMN = "area_locality"


class M1Preprocessor(BaseEstimator, TransformerMixin):
    """
    M1-specific preprocessing.

    Responsibilities:
    - One-hot encode categorical columns.
    - Frequency encode area_locality using training data only.
    - Preserve all other numeric/binary features.
    """

    def __init__(
        self,
        categorical_columns=None,
        locality_column=LOCALITY_COLUMN
    ):
        self.categorical_columns = (
            categorical_columns
            if categorical_columns is not None
            else CATEGORICAL_COLUMNS
        )
        self.locality_column = locality_column

    def fit(self, X, y=None):
        X = X.copy()

        # Store feature order used during training.
        self.input_columns_ = list(X.columns)

        # Fit OneHotEncoder only on training data.
        self.encoder_ = OneHotEncoder(
            handle_unknown="ignore",
            sparse_output=False
        )

        self.encoder_.fit(
            X[self.categorical_columns]
        )

        # Learn locality frequencies only from training data.
        self.locality_frequency_ = (
            X[self.locality_column]
            .value_counts(normalize=True)
            .to_dict()
        )

        # Store the remaining numeric/binary columns.
        self.numeric_columns_ = [
            column
            for column in self.input_columns_
            if column not in self.categorical_columns
            and column != self.locality_column
        ]

        self.feature_names_ = (
            self.numeric_columns_
            + list(
                self.encoder_.get_feature_names_out(
                    self.categorical_columns
                )
            )
            + ["area_locality_frequency"]
        )

        return self

    def transform(self, X):
        X = X.copy()

        # Validate required columns.
        missing_columns = [
            column
            for column in self.input_columns_
            if column not in X.columns
        ]

        if missing_columns:
            raise ValueError(
                f"Missing required columns: {missing_columns}"
            )

        # Numeric / boolean features.
        numeric_df = X[
            self.numeric_columns_
        ].reset_index(drop=True)
        amenity_columns = [
            "amenity_parking",
            "amenity_lift",
            "amenity_gym",
            "amenity_security",
            "amenity_power_backup",
            "amenity_air_conditioning",
            "amenity_wifi",
            "amenity_garden"
        ]

        for column in amenity_columns:
            numeric_df[column] = numeric_df[column].astype(int)

        # One-hot encoded categorical features.
        encoded = self.encoder_.transform(
            X[self.categorical_columns]
        )

        encoded_df = pd.DataFrame(
            encoded,
            columns=self.encoder_.get_feature_names_out(
                self.categorical_columns
            )
        )

        # Frequency encoded locality.
        locality_df = pd.DataFrame({
            "area_locality_frequency": (
                X[self.locality_column]
                .map(self.locality_frequency_)
                .fillna(0.0)
                .reset_index(drop=True)
            )
        })

        final_df = pd.concat(
            [
                numeric_df,
                encoded_df,
                locality_df
            ],
            axis=1
        )

        return final_df[self.feature_names_]


def load_data(data_path=DATA_PATH):
    """Load the finalized M1 dataset."""
    return pd.read_csv(data_path)


def split_features_target(df):
    """Separate model features and target."""
    X = df.drop(columns=[TARGET_COLUMN])
    y = df[TARGET_COLUMN]

    return X, y