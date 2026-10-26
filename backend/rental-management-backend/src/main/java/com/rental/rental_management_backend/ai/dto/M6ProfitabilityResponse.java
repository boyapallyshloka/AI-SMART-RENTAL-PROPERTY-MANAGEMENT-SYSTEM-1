package com.rental.rental_management_backend.ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class M6ProfitabilityResponse {

    private Boolean success;

    @JsonProperty("predicted_next_month_profit")
    private Double predictedNextMonthProfit;

    @JsonProperty("profitability_label")
    private Integer profitabilityLabel;

    @JsonProperty("profitability_probability")
    private Double profitabilityProbability;

    @JsonProperty("modelVersion")
    private String modelVersion;
}
