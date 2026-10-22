package com.rental.rental_management_backend.maintenance.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.rental.rental_management_backend.maintenance.enums.MaintenanceCategory;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePayer;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePriority;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceStatus;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceCostResponsibility;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.tenant.entity.Tenant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Entity
@Table(name = "maintenance_requests")
public class MaintenanceRequest {

    // =========================================================
    // PRIMARY KEY
    // =========================================================

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "request_id")
    private Long requestId;

    // =========================================================
    // TENANT
    // =========================================================

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    // =========================================================
    // PROPERTY
    // =========================================================

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    // =========================================================
    // UNIT
    // =========================================================

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    // =========================================================
    // CATEGORY
    // =========================================================

    @NotNull(message = "Maintenance category is required")
    @Enumerated(EnumType.STRING)
    @Column(
        name = "category",
        nullable = false,
        length = 30
    )
    private MaintenanceCategory category;

    // =========================================================
    // DESCRIPTION
    // =========================================================

    @NotBlank(message = "Description is required")
    @Column(
        name = "description",
        nullable = false,
        columnDefinition = "TEXT"
    )
    private String description;

    // =========================================================
    // PRIORITY
    // =========================================================

    @NotNull(message = "Maintenance priority is required")
    @Enumerated(EnumType.STRING)
    @Column(
        name = "priority",
        nullable = false,
        length = 20
    )
    private MaintenancePriority priority;

    // =========================================================
    // STATUS
    // =========================================================

    @NotNull(message = "Maintenance status is required")
    @Enumerated(EnumType.STRING)
    @Column(
        name = "status",
        nullable = false,
        length = 20
    )
    private MaintenanceStatus status = MaintenanceStatus.OPEN;

    // =========================================================
    // IMAGE URL
    // =========================================================

    @Column(name = "image_url")
    private String imageUrl;

    // =========================================================
    // REQUESTED DATE
    // =========================================================

    @Column(
        name = "requested_date",
        nullable = false,
        updatable = false
    )
    private LocalDateTime requestedDate;

    // =========================================================
    // COMPLETED DATE
    // =========================================================

    @Column(name = "completed_date")
    private LocalDateTime completedDate;

    // =========================================================
    // COST
    // =========================================================

    @DecimalMin(
        value = "0.0",
        message = "Cost cannot be negative"
    )
    @Column(
        name = "cost",
        precision = 12,
        scale = 2
    )
    private BigDecimal cost;

    @Enumerated(EnumType.STRING)
    @Column(name = "cost_responsibility", length = 20)
    private MaintenanceCostResponsibility costResponsibility;

    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public MaintenanceRequest() {
    }

    // =========================================================
    // PRE PERSIST
    // =========================================================

    @PrePersist
    protected void onCreate() {

        requestedDate = LocalDateTime.now();

        if (status == null) {
            status = MaintenanceStatus.OPEN;
        }

        if (payer == null) {
            payer = MaintenancePayer.OWNER_PAID;
        }
    }

    // =========================================================
    // GETTERS AND SETTERS
    // =========================================================

    public Long getRequestId() {
        return requestId;
    }

    public void setRequestId(Long requestId) {
        this.requestId = requestId;
    }

    public Tenant getTenant() {
        return tenant;
    }

    public void setTenant(Tenant tenant) {
        this.tenant = tenant;
    }

    public Property getProperty() {
        return property;
    }

    public void setProperty(Property property) {
        this.property = property;
    }

    public Unit getUnit() {
        return unit;
    }

    public void setUnit(Unit unit) {
        this.unit = unit;
    }

    public MaintenanceCategory getCategory() {
        return category;
    }

    public void setCategory(MaintenanceCategory category) {
        this.category = category;
    }

    // =========================================================
    // DESCRIPTION GETTER AND SETTER
    // =========================================================

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

<<<<<<< HEAD
    public MaintenancePayer getPayer() {
        return payer;
    }

    public void setPayer(MaintenancePayer payer) {
        this.payer = payer;
    }
}
=======
    public MaintenanceCostResponsibility getCostResponsibility() {
        return costResponsibility;
    }

    public void setCostResponsibility(MaintenanceCostResponsibility costResponsibility) {
        this.costResponsibility = costResponsibility;
    }
}
>>>>>>> 686803810078b26d5f8c91a340b0ad65f5c68aba
