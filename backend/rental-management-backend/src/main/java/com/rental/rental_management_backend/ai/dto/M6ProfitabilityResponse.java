package com.rental.rental_management_backend.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record M6ProfitabilityResponse(
        @JsonProperty("success")
        Boolean success,
        @JsonProperty("predicted_next_month_profit")
        Double predictedNextMonthProfit,
        @JsonProperty("profitability_label")
        Integer profitabilityLabel,
        @JsonProperty("profitability_probability")
        Double profitabilityProbability,
        @JsonProperty("modelVersion")
        String modelVersion) {
}
