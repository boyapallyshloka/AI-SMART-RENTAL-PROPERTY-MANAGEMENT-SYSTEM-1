package com.rental.rental_management_backend.maintenance.dto;

import java.math.BigDecimal;

import com.rental.rental_management_backend.maintenance.enums.MaintenanceCostResponsibility;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public class MaintenanceCostUpdateRequest {

    @NotNull(message = "Repair amount is required")
    @DecimalMin(value = "0.0", message = "Repair amount cannot be negative")
    private BigDecimal cost;

    @NotNull(message = "Payer responsibility is required")
    private MaintenanceCostResponsibility costResponsibility;

    public BigDecimal getCost() {
        return cost;
    }

    public void setCost(BigDecimal cost) {
        this.cost = cost;
    }

    public MaintenanceCostResponsibility getCostResponsibility() {
        return costResponsibility;
    }

    public void setCostResponsibility(MaintenanceCostResponsibility costResponsibility) {
        this.costResponsibility = costResponsibility;
    }
}
