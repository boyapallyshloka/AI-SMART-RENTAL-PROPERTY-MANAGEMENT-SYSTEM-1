package com.rental.rental_management_backend.ai.dto;

import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;
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
        @JsonProperty("snapshot_month")
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
        LocalDate snapshotMonth,
        @JsonProperty("monthly_rent")
        Double monthlyRent,
        @JsonProperty("collected_rent")
        Double collectedRent,
        @JsonProperty("expense_amount")
        Double expenseAmount,
        @JsonProperty("occupancy_rate")
        Double occupancyRate,
        @JsonProperty("monthly_history")
        List<MonthlyFinancialRecord> monthlyHistory) {

    public record MonthlyFinancialRecord(
            @JsonProperty("snapshot_month")
            @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
            LocalDate snapshotMonth,
            @JsonProperty("monthly_rent")
            Double monthlyRent,
            @JsonProperty("collected_rent")
            Double collectedRent,
            @JsonProperty("expense_amount")
            Double expenseAmount,
            @JsonProperty("occupancy_rate")
            Double occupancyRate) {
    }
}
