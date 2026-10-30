package com.rental.rental_management_backend.maintenance.dto;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePayer;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public class MaintenanceCostUpdateRequest {

    @NotNull(message = "Repair cost is required")
    @DecimalMin(value = "0.0", message = "Repair cost cannot be negative")
    private BigDecimal cost;

    @NotNull(message = "Cost responsibility is required")
    @JsonAlias("costResponsibility")
    private MaintenancePayer payer;

    public BigDecimal getCost() {
        return cost;
    }

    public void setCost(BigDecimal cost) {
        this.cost = cost;
    }

    public MaintenancePayer getPayer() {
        return payer;
    }

    public void setPayer(MaintenancePayer payer) {
        this.payer = payer;
    }
}
