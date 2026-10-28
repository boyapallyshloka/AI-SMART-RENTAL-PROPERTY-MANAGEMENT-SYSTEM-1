"""Leakage-safe one-hot M1 model components. Candidate only; not production replacement."""
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from xgboost import XGBRegressor
import numpy as np

CATEGORICAL_COLUMNS = ['city', 'area_locality', 'area_type', 'furnishing_status', 'property_type']
FEATURE_COLUMNS = [
    'city','area_locality','area_type','size_sqft','bedrooms_bhk','bathrooms','floor','total_floors',
    'furnishing_status','parking_available','property_age_years','amenity_count','amenity_parking',
    'amenity_lift','amenity_gym','amenity_security','amenity_power_backup','amenity_air_conditioning',
    'amenity_wifi','amenity_garden','latitude','longitude','property_type'
]
NUMERIC_COLUMNS = [c for c in FEATURE_COLUMNS if c not in CATEGORICAL_COLUMNS]

class M1CategoryNormalizer(BaseEstimator, TransformerMixin):
    """Trim categories and map case-insensitive input variants to training spelling."""
    def __init__(self, categorical_columns=None):
        self.categorical_columns = categorical_columns if categorical_columns is not None else CATEGORICAL_COLUMNS
    def fit(self, X, y=None):
        self.input_columns_ = list(X.columns)
        self.category_maps_ = {}
        for col in self.categorical_columns:
            values = X[col].dropna().astype(str).str.strip()
            counts = values.value_counts()
            canonical = {}
            for value, count in counts.items():
                key = value.casefold()
                if key not in canonical or count > counts.get(canonical[key], -1):
                    canonical[key] = value
            self.category_maps_[col] = canonical
        return self
    def transform(self, X):
        X = X.copy()
        for col in self.categorical_columns:
            mapping = self.category_maps_[col]
            X[col] = X[col].fillna('__UNKNOWN__').astype(str).str.strip().map(
                lambda value: mapping.get(value.casefold(), value)
            )
        return X

def build_onehot_model(params):
    pre = ColumnTransformer([
        ('categorical', OneHotEncoder(handle_unknown='ignore', sparse_output=True), CATEGORICAL_COLUMNS),
        ('numeric', 'passthrough', NUMERIC_COLUMNS),
    ], remainder='drop')
    reg = XGBRegressor(
        objective='reg:squarederror', random_state=42, n_jobs=4,
        n_estimators=params['n_estimators'], learning_rate=params['learning_rate'],
        max_depth=params['max_depth'], min_child_weight=params['min_child_weight'],
        subsample=params['subsample'], colsample_bytree=params['colsample_bytree'],
        reg_lambda=params['reg_lambda'], reg_alpha=params['reg_alpha'], tree_method='hist'
    )
    return Pipeline([
        ('category_normalizer', M1CategoryNormalizer()),
        ('preprocessor', pre),
        ('model', TransformedTargetRegressor(regressor=reg, func=np.log1p, inverse_func=np.expm1))
    ])
