package com.rental.rental_management_backend.maintenance.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.rental.rental_management_backend.maintenance.enums.MaintenanceCategory;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePriority;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceStatus;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceCostResponsibility;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePayer;
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


    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "request_id")
    private Long requestId;


    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;


    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;


    @ManyToOne(fetch = FetchType.EAGER, optional = true)
    @JoinColumn(name = "unit_id", nullable = true)
    private Unit unit;


    @NotNull(message = "Maintenance category is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 30)
    private MaintenanceCategory category;


    @NotBlank(message = "Description is required")
    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;


    @NotNull(message = "Maintenance priority is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 20)
    private MaintenancePriority priority;


    @NotNull(message = "Maintenance status is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MaintenanceStatus status = MaintenanceStatus.OPEN;


    @Column(name = "image_url")
    private String imageUrl;


    @Column(name = "requested_date", nullable = false, updatable = false)
    private LocalDateTime requestedDate;


    @Column(name = "completed_date")
    private LocalDateTime completedDate;


    @DecimalMin(value = "0.0", message = "Cost cannot be negative")
    @Column(name = "cost", precision = 12, scale = 2)
    private BigDecimal cost;


    @Enumerated(EnumType.STRING)
    @Column(name = "cost_responsibility", length = 20)
    private MaintenanceCostResponsibility costResponsibility;


    @Enumerated(EnumType.STRING)
    @Column(name = "payer", length = 20)
    private MaintenancePayer payer;



    public MaintenanceRequest() {
    }



    @PrePersist
    protected void onCreate() {

        requestedDate = LocalDateTime.now();

        if (status == null) {
            status = MaintenanceStatus.OPEN;
        }
    }



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


    public MaintenancePayer getPayer() {
        return payer;
    }

    public void setPayer(MaintenancePayer payer) {
        this.payer = payer;
    }
}