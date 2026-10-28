package com.rental.rental_management_backend.ai.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public class RentPredictionPropertyRequestDTO {

    @NotNull(message = "Property ID is required")
    @Positive(message = "Property ID must be positive")
    private Long propertyId;

    public Long getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(Long propertyId) {
        this.propertyId = propertyId;
    }
}
