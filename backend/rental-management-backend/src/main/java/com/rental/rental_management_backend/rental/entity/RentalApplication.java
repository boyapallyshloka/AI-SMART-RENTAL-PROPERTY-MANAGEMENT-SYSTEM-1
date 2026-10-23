
package com.rental.rental_management_backend.rental.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.rental.enums.RentalApplicationStatus;
import com.rental.rental_management_backend.tenant.entity.Tenant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(
    name = "rental_applications",
    indexes = {
        @Index(name = "idx_application_tenant", columnList = "tenant_id"),
        @Index(name = "idx_application_property", columnList = "property_id"),
        @Index(name = "idx_application_unit", columnList = "unit_id"),
        @Index(name = "idx_application_status", columnList = "status")
    }
)
public class RentalApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "application_id")
    private Long applicationId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "unit_id", nullable = true)
    private Unit unit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    private Property property;

    @Column(name = "application_date", nullable = false)
    private LocalDate applicationDate;

    @Column(name = "preferred_move_in_date")
    private LocalDate preferredMoveInDate;

    @Column(name = "preferred_lease_duration_months")
    private Integer preferredLeaseDurationMonths;

    @Column(name = "monthly_income", precision = 12, scale = 2)
    private BigDecimal monthlyIncome;

    @Column(name = "employer_occupation", length = 200)
    private String employerOccupation;

    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private RentalApplicationStatus status;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public RentalApplication() {
    }

    @PrePersist
    protected void onCreate() {

        if (applicationDate == null) {
            applicationDate = LocalDate.now();
        }

        if (status == null) {
            status = RentalApplicationStatus.PENDING;
        }

        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getApplicationId() {
        return applicationId;
    }

    public void setApplicationId(Long applicationId) {
        this.applicationId = applicationId;
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

    public Property getProperty() { return property; }

    public void setProperty(Property property) { this.property = property; }

    public LocalDate getApplicationDate() {
        return applicationDate;
    }

    public void setApplicationDate(LocalDate applicationDate) {
        this.applicationDate = applicationDate;
    }

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

    public RentalApplicationStatus getStatus() {
        return status;
    }

    public void setStatus(RentalApplicationStatus status) {
        this.status = status;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}

