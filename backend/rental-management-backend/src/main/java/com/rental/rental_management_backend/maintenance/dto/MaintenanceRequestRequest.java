package com.rental.rental_management_backend.maintenance.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.rental.rental_management_backend.maintenance.enums.MaintenanceCategory;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePayer;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePriority;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class MaintenanceRequestRequest {

    @NotNull(message = "Tenant ID is required")
    private Long tenantId;

    @NotNull(message = "Property ID is required")
    private Long propertyId;

    private Long unitId;

    @NotNull(message = "Maintenance category is required")
    private MaintenanceCategory category;

    @NotBlank(message = "Description is required")
    private String description;

    @NotNull(message = "Maintenance priority is required")
    private MaintenancePriority priority;

    // Used when updating the maintenance request
    private MaintenanceStatus status;

    private LocalDateTime completedDate;

    private BigDecimal cost;

    private MaintenancePayer payer;

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    public MaintenanceRequestRequest() {
    }

    // ============================================================
    // TENANT ID
    // ============================================================

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }

    // ============================================================
    // PROPERTY ID
    // ============================================================

    public Long getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(Long propertyId) {
        this.propertyId = propertyId;
    }

    // ============================================================
    // UNIT ID
    // ============================================================

    public Long getUnitId() {
        return unitId;
    }

    public void setUnitId(Long unitId) {
        this.unitId = unitId;
    }

    // ============================================================
    // CATEGORY
    // ============================================================

    public MaintenanceCategory getCategory() {
        return category;
    }

    public void setCategory(MaintenanceCategory category) {
        this.category = category;
    }

    // ============================================================
    // DESCRIPTION
    // ============================================================

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    // ============================================================
    // PRIORITY
    // ============================================================

    public MaintenancePriority getPriority() {
        return priority;
    }

    public void setPriority(MaintenancePriority priority) {
        this.priority = priority;
    }

    // ============================================================
    // STATUS
    // ============================================================

    public MaintenanceStatus getStatus() {
        return status;
    }

    public void setStatus(MaintenanceStatus status) {
        this.status = status;
    }

    // ============================================================
    // COMPLETED DATE
    // ============================================================

    public LocalDateTime getCompletedDate() {
        return completedDate;
    }

    public void setCompletedDate(LocalDateTime completedDate) {
        this.completedDate = completedDate;
    }

    // ============================================================
    // COST
    // ============================================================

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