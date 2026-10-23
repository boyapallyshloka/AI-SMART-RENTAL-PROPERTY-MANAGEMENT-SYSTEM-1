from preprocessing import load_and_prepare, time_based_split 
df = load_and_prepare() 
train, test = time_based_split(df) 
print("Test set target value counts:") 
print(test["next_month_demand"].value_counts()) 
print("Percent of test rows with demand > 0:", (test["next_month_demand"] > 0).mean() * 100)