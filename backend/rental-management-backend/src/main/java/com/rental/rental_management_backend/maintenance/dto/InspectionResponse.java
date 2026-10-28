package com.rental.rental_management_backend.maintenance.dto;

import java.time.LocalDate;

public class InspectionResponse {

    private Long id;
    private Long propertyId;
    private LocalDate inspectionDate;
    private String inspectorName;
    private Boolean passed;
    private Boolean hasIssuesRequiringAttention;
    private String notes;

    public InspectionResponse() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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
