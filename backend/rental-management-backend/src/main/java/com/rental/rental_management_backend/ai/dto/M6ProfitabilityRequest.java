package com.rental.rental_management_backend.ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record M6ProfitabilityRequest(
        @JsonProperty("city")
        String city,
        @JsonProperty("size_sqft")
        Double sizeSqft,
        @JsonProperty("bedrooms_bhk")
        Double bedroomsBhk,
        @JsonProperty("property_age_years")
        Double propertyAgeYears,
        @JsonProperty("monthly_rent")
        Double monthlyRent,
        @JsonProperty("collected_rent")
        Double collectedRent,
        @JsonProperty("expense_amount")
        Double expenseAmount,
        @JsonProperty("current_month_profit")
        Double currentMonthProfit,
        @JsonProperty("occupancy_rate")
        Double occupancyRate,
        @JsonProperty("estimated_vacancy_loss")
        Double estimatedVacancyLoss,
        @JsonProperty("revenue_after_estimated_vacancy_loss")
        Double revenueAfterEstimatedVacancyLoss,
        @JsonProperty("collected_rent_3m_avg")
        Double collectedRent3mAvg,
        @JsonProperty("expense_amount_3m_avg")
        Double expenseAmount3mAvg,
        @JsonProperty("current_month_profit_3m_avg")
        Double currentMonthProfit3mAvg,
        @JsonProperty("occupancy_rate_3m_avg")
        Double occupancyRate3mAvg,
        @JsonProperty("estimated_vacancy_loss_3m_avg")
        Double estimatedVacancyLoss3mAvg,
        @JsonProperty("collected_rent_6m_avg")
        Double collectedRent6mAvg,
        @JsonProperty("expense_amount_6m_avg")
        Double expenseAmount6mAvg,
        @JsonProperty("current_month_profit_6m_avg")
        Double currentMonthProfit6mAvg,
        @JsonProperty("occupancy_rate_6m_avg")
        Double occupancyRate6mAvg,
        @JsonProperty("estimated_vacancy_loss_6m_avg")
        Double estimatedVacancyLoss6mAvg,
        @JsonProperty("collected_rent_trend")
        Double collectedRentTrend,
        @JsonProperty("expense_amount_trend")
        Double expenseAmountTrend,
        @JsonProperty("current_month_profit_trend")
        Double currentMonthProfitTrend,
        @JsonProperty("occupancy_rate_trend")
        Double occupancyRateTrend,
        @JsonProperty("estimated_vacancy_loss_trend")
        Double estimatedVacancyLossTrend) {
}
