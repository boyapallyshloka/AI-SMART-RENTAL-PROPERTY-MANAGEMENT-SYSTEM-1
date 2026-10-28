package com.rental.rental_management_backend.rental.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

public class RentInvoiceLateFeeRequest {

    @NotNull(message = "Late fee is required")
    @DecimalMin(value = "0.00", message = "Late fee cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Late fee must have at most two decimal places")
    private BigDecimal lateFee;

    public BigDecimal getLateFee() {
        return lateFee;
    }

    public void setLateFee(BigDecimal lateFee) {
        this.lateFee = lateFee;
    }
}
