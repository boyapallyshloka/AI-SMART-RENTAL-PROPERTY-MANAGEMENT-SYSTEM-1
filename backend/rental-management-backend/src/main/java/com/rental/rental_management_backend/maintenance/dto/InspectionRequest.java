package com.rental.rental_management_backend.maintenance.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class InspectionRequest {

    @NotNull(message = "Property ID is required")
    private Long propertyId;

    @NotNull(message = "Inspection date is required")
    private LocalDate inspectionDate;

    @NotBlank(message = "Inspector name is required")
    private String inspectorName;

    @NotNull(message = "Passed value is required")
    private Boolean passed;

    @NotNull(message = "Attention-required value is required")
    private Boolean hasIssuesRequiringAttention;

    private String notes;

    public Long getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(Long propertyId) {
        this.propertyId = propertyId;
    }

    public LocalDate getInspectionDate() {
        return inspectionDate;
    }

    public void setInspectionDate(LocalDate inspectionDate) {
        this.inspectionDate = inspectionDate;
    }

    public String getInspectorName() {
        return inspectorName;
    }

    public void setInspectorName(String inspectorName) {
        this.inspectorName = inspectorName;
    }

    public Boolean getPassed() {
        return passed;
    }

    public void setPassed(Boolean passed) {
        this.passed = passed;
    }

    public Boolean getHasIssuesRequiringAttention() {
        return hasIssuesRequiringAttention;
    }

    public void setHasIssuesRequiringAttention(
            Boolean hasIssuesRequiringAttention) {
        this.hasIssuesRequiringAttention = hasIssuesRequiringAttention;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}