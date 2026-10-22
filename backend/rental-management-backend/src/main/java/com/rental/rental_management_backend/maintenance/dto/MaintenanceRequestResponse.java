package com.rental.rental_management_backend.maintenance.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.rental.rental_management_backend.maintenance.enums.MaintenanceCategory;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePriority;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceStatus;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceCostResponsibility;

public class MaintenanceRequestResponse {

    private Long requestId;

    private Long tenantId;

    private Long propertyId;

    private Long unitId;

    private MaintenanceCategory category;

    private String description;

    private MaintenancePriority priority;

    private MaintenanceStatus status;

    private String imageUrl;

    private LocalDateTime requestedDate;

    private LocalDateTime completedDate;

    private BigDecimal cost;

    private MaintenanceCostResponsibility costResponsibility;

    public MaintenanceRequestResponse() {
    }

    public Long getRequestId() {
        return requestId;
    }

    public void setRequestId(Long requestId) {
        this.requestId = requestId;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
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

    public MaintenanceCategory getCategory() {
        return category;
    }

    public void setCategory(MaintenanceCategory category) {
        this.category = category;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public MaintenancePriority getPriority() {
        return priority;
    }

    public void setPriority(MaintenancePriority priority) {
        this.priority = priority;
    }

    public MaintenanceStatus getStatus() {
        return status;
    }

    public void setStatus(MaintenanceStatus status) {
        this.status = status;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public LocalDateTime getRequestedDate() {
        return requestedDate;
    }

    public void setRequestedDate(LocalDateTime requestedDate) {
        this.requestedDate = requestedDate;
    }

    public LocalDateTime getCompletedDate() {
        return completedDate;
    }

    public void setCompletedDate(LocalDateTime completedDate) {
        this.completedDate = completedDate;
    }

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