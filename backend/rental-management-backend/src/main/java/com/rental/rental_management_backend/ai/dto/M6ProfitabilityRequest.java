package com.rental.rental_management_backend.ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class M6ProfitabilityRequest {

    private String city;

    @JsonProperty("size_sqft")
    private Double sizeSqft;

    @JsonProperty("bedrooms_bhk")
    private Double bedroomsBhk;

    @JsonProperty("property_age_years")
    private Double propertyAgeYears;

    @JsonProperty("monthly_rent")
    private Double monthlyRent;

    @JsonProperty("collected_rent")
    private Double collectedRent;

    @JsonProperty("expense_amount")
    private Double expenseAmount;

    @JsonProperty("current_month_profit")
    private Double currentMonthProfit;

    @JsonProperty("occupancy_rate")
    private Double occupancyRate;

    @JsonProperty("estimated_vacancy_loss")
    private Double estimatedVacancyLoss;

    @JsonProperty("revenue_after_estimated_vacancy_loss")
    private Double revenueAfterEstimatedVacancyLoss;

    @JsonProperty("collected_rent_3m_avg")
    private Double collectedRent3mAvg;

    @JsonProperty("expense_amount_3m_avg")
    private Double expenseAmount3mAvg;

    @JsonProperty("current_month_profit_3m_avg")
    private Double currentMonthProfit3mAvg;

    @JsonProperty("occupancy_rate_3m_avg")
    private Double occupancyRate3mAvg;

    @JsonProperty("estimated_vacancy_loss_3m_avg")
    private Double estimatedVacancyLoss3mAvg;

    @JsonProperty("collected_rent_6m_avg")
    private Double collectedRent6mAvg;

    @JsonProperty("expense_amount_6m_avg")
    private Double expenseAmount6mAvg;

    @JsonProperty("current_month_profit_6m_avg")
    private Double currentMonthProfit6mAvg;

    @JsonProperty("occupancy_rate_6m_avg")
    private Double occupancyRate6mAvg;

    @JsonProperty("estimated_vacancy_loss_6m_avg")
    private Double estimatedVacancyLoss6mAvg;

    @JsonProperty("collected_rent_trend")
    private Double collectedRentTrend;

    @JsonProperty("expense_amount_trend")
    private Double expenseAmountTrend;

    @JsonProperty("current_month_profit_trend")
    private Double currentMonthProfitTrend;

    @JsonProperty("occupancy_rate_trend")
    private Double occupancyRateTrend;

    @JsonProperty("estimated_vacancy_loss_trend")
    private Double estimatedVacancyLossTrend;
}
