import pandas as pd

df = pd.read_csv("data/House_Rent_Dataset.csv")

print(df.head())
print(df.shape)
print(df.columns)

print(df["City"].value_counts())
print(df["Furnishing Status"].value_counts())
print(df.isnull().sum())
print(df.describe())
df.info()
print("Rent percentiles:")
print(df["Rent"].quantile([0.50, 0.75, 0.90, 0.95, 0.99, 1.00]))
print("\nMost expensive properties:")
print(df.nlargest(10, "Rent")[["Rent", "BHK", "Size", "City", "Area Locality"]])
print("Rent percentiles:")
print(df["Rent"].quantile([0.50, 0.75, 0.90, 0.95, 0.99, 1.00]))

print("\nMost expensive properties:")
print(df.nlargest(10, "Rent")[["Rent", "BHK", "Size", "City", "Area Locality"]])
print("\nFloor values:")
print(df["Floor"].value_counts().head(20))
print("\nAll Floor values:")
print(df["Floor"].unique())