import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from config import (
    DATA_PATH,
    TARGET_COLUMN,
    DATE_COLUMN,
    PLOTS_DIR,
)


sns.set_theme(style="whitegrid")


def save_plot(filename):
    plt.tight_layout()
    plt.savefig(
        PLOTS_DIR / filename,
        dpi=300,
        bbox_inches="tight"
    )
    plt.close()


def main():

    print("=" * 80)
    print("M5 PREDICTIVE MAINTENANCE - EXPLORATORY DATA ANALYSIS")
    print("=" * 80)

    df = pd.read_csv(DATA_PATH)

    df[DATE_COLUMN] = pd.to_datetime(
        df[DATE_COLUMN],
        format="%Y-%m"
    )

    # -----------------------------------------------------
    # TARGET DISTRIBUTION
    # -----------------------------------------------------

    plt.figure(figsize=(7, 5))

    sns.countplot(
        data=df,
        x=TARGET_COLUMN
    )

    plt.title("Maintenance Risk Class Distribution")
    plt.xlabel("Maintenance Risk Label")
    plt.ylabel("Number of Records")

    save_plot("01_target_distribution.png")

    # -----------------------------------------------------
    # MONTHLY RISK RATE
    # -----------------------------------------------------

    monthly_risk = (
        df.groupby(DATE_COLUMN)[TARGET_COLUMN]
        .mean()
        .reset_index()
    )

    monthly_risk["risk_percentage"] = (
        monthly_risk[TARGET_COLUMN] * 100
    )

    plt.figure(figsize=(12, 6))

    sns.lineplot(
        data=monthly_risk,
        x=DATE_COLUMN,
        y="risk_percentage",
        marker="o"
    )

    plt.title("Maintenance Risk Rate Over Time")
    plt.xlabel("Month")
    plt.ylabel("Risk Percentage")

    plt.xticks(rotation=45)

    save_plot("02_monthly_risk_rate.png")

    # -----------------------------------------------------
    # DOMINANT ISSUE CATEGORY
    # -----------------------------------------------------

    plt.figure(figsize=(10, 6))

    order = (
        df["dominant_issue_category"]
        .value_counts()
        .index
    )

    sns.countplot(
        data=df,
        y="dominant_issue_category",
        order=order
    )

    plt.title("Dominant Maintenance Issue Categories")
    plt.xlabel("Number of Records")
    plt.ylabel("Issue Category")

    save_plot("03_issue_category_distribution.png")

    # -----------------------------------------------------
    # RISK BY ISSUE CATEGORY
    # -----------------------------------------------------

    category_risk = (
        df.groupby("dominant_issue_category")[TARGET_COLUMN]
        .mean()
        .sort_values(ascending=False)
        .reset_index()
    )

    category_risk["risk_percentage"] = (
        category_risk[TARGET_COLUMN] * 100
    )

    plt.figure(figsize=(10, 6))

    sns.barplot(
        data=category_risk,
        x="risk_percentage",
        y="dominant_issue_category"
    )

    plt.title("Maintenance Risk by Issue Category")
    plt.xlabel("Risk Percentage")
    plt.ylabel("Dominant Issue Category")

    save_plot("04_risk_by_issue_category.png")

    # -----------------------------------------------------
    # PROPERTY AGE DISTRIBUTION
    # -----------------------------------------------------

    plt.figure(figsize=(9, 5))

    sns.histplot(
        data=df,
        x="property_age_years",
        bins=30,
        kde=True
    )

    plt.title("Property Age Distribution")

    save_plot("05_property_age_distribution.png")

    # -----------------------------------------------------
    # EQUIPMENT AGE VS RISK
    # -----------------------------------------------------

    plt.figure(figsize=(8, 5))

    sns.boxplot(
        data=df,
        x=TARGET_COLUMN,
        y="avg_equipment_age_years"
    )

    plt.title(
        "Average Equipment Age vs Maintenance Risk"
    )

    save_plot("06_equipment_age_vs_risk.png")

    # -----------------------------------------------------
    # RECENT MAINTENANCE VS RISK
    # -----------------------------------------------------

    plt.figure(figsize=(8, 5))

    sns.boxplot(
        data=df,
        x=TARGET_COLUMN,
        y="maintenance_count_last_90d"
    )

    plt.title(
        "Recent Maintenance Count vs Future Risk"
    )

    save_plot("07_recent_maintenance_vs_risk.png")

    # -----------------------------------------------------
    # DAYS SINCE LAST MAINTENANCE
    # -----------------------------------------------------

    plt.figure(figsize=(8, 5))

    sns.boxplot(
        data=df,
        x=TARGET_COLUMN,
        y="days_since_last_maintenance"
    )

    plt.title(
        "Days Since Last Maintenance vs Future Risk"
    )

    save_plot("08_days_since_maintenance_vs_risk.png")

    # -----------------------------------------------------
    # CRITICAL EQUIPMENT
    # -----------------------------------------------------

    critical_risk = (
        df.groupby("critical_equipment_count")[TARGET_COLUMN]
        .mean()
        .reset_index()
    )

    critical_risk["risk_percentage"] = (
        critical_risk[TARGET_COLUMN] * 100
    )

    plt.figure(figsize=(8, 5))

    sns.barplot(
        data=critical_risk,
        x="critical_equipment_count",
        y="risk_percentage"
    )

    plt.title(
        "Critical Equipment Count vs Maintenance Risk"
    )

    save_plot("09_critical_equipment_risk.png")

    # -----------------------------------------------------
    # CORRELATION HEATMAP
    # -----------------------------------------------------

    numerical_df = df.select_dtypes(
        include=["number"]
    )

    # Remove future targets from correlation interpretation
    feature_numerical_df = numerical_df.drop(
        columns=[
            "next_month_maintenance_count",
            "next_month_maintenance_cost"
        ],
        errors="ignore"
    )

    correlation = feature_numerical_df.corr()

    plt.figure(figsize=(15, 11))

    sns.heatmap(
        correlation,
        cmap="coolwarm",
        center=0
    )

    plt.title(
        "Numerical Feature Correlation Matrix"
    )

    save_plot("10_correlation_heatmap.png")

    # -----------------------------------------------------
    # FUTURE MAINTENANCE COUNT
    # Used only for TARGET exploration
    # -----------------------------------------------------

    positive = df[
        df["next_month_maintenance_count"] > 0
    ]

    plt.figure(figsize=(7, 5))

    sns.countplot(
        data=positive,
        x="next_month_maintenance_count"
    )

    plt.title(
        "Future Maintenance Count Among Positive Cases"
    )

    save_plot("11_future_maintenance_count.png")

    print(
        f"\nEDA complete. Plots saved to:\n{PLOTS_DIR}"
    )


if __name__ == "__main__":
    main()