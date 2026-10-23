from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "data" / "raw" / "House_Rent_Dataset.csv"

df = pd.read_csv(DATA_PATH)

print("Dataset shape:", df.shape)
print("\nColumns:")
print(df.columns.tolist())

print("\nMissing values:")
print(df.isnull().sum())

print("\nData types:")
print(df.dtypes)
print("\nUnique values:")
for column in df.columns:
    print(f"\n{column}: {df[column].nunique()} unique values")

print("\nSample records:")
print(df.head(10).to_string(index=False))