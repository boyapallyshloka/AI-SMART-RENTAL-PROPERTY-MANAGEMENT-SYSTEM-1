package com.rental.rental_management_backend.property.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class PropertyDocumentRejectionRequest {

    @NotBlank(message = "Rejection reason is required")
    @Size(min = 5, max = 1000, message = "Rejection reason must be between 5 and 1000 characters")
    private String reason;

    public PropertyDocumentRejectionRequest() {
    }

    public PropertyDocumentRejectionRequest(String reason) {
        this.reason = reason;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
