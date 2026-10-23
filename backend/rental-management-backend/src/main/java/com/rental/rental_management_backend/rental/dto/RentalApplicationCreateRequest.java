
package com.rental.rental_management_backend.rental.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

public class RentalApplicationCreateRequest {

    private Long propertyId;

    private Long unitId;

    private Long propertyId;

    @FutureOrPresent(message = "Preferred move-in date cannot be in the past")
    private LocalDate preferredMoveInDate;

    @NotNull(message = "Preferred lease duration is required")
    @Min(value = 1, message = "Preferred lease duration must be at least 1 month")
    private Integer preferredLeaseDurationMonths;

    @DecimalMin(value = "0.0", message = "Monthly income cannot be negative")
    private BigDecimal monthlyIncome;

    @Size(max = 200, message = "Employer / occupation cannot exceed 200 characters")
    private String employerOccupation;

    @Size(max = 1000, message = "Message cannot exceed 1000 characters")
    private String message;

    public RentalApplicationCreateRequest() {
    }

    public Long getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(Long propertyId) {
        this.propertyId = propertyId;
    }

    public Long getUnitId() {
        return unitId;
    }

    public void setUnitId(Long unitId) {
        this.unitId = unitId;
    }

    public Long getPropertyId() { return propertyId; }

    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public LocalDate getPreferredMoveInDate() {
        return preferredMoveInDate;
    }

    public void setPreferredMoveInDate(LocalDate preferredMoveInDate) {
        this.preferredMoveInDate = preferredMoveInDate;
    }

    public Integer getPreferredLeaseDurationMonths() {
        return preferredLeaseDurationMonths;
    }

    public void setPreferredLeaseDurationMonths(Integer preferredLeaseDurationMonths) {
        this.preferredLeaseDurationMonths = preferredLeaseDurationMonths;
    }

    public BigDecimal getMonthlyIncome() {
        return monthlyIncome;
    }

    public void setMonthlyIncome(BigDecimal monthlyIncome) {
        this.monthlyIncome = monthlyIncome;
    }

    public String getEmployerOccupation() {
        return employerOccupation;
    }

    public void setEmployerOccupation(String employerOccupation) {
        this.employerOccupation = employerOccupation;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
