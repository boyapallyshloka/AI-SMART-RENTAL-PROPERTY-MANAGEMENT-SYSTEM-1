package com.rental.rental_management_backend.property.entity;

import java.time.LocalDateTime;
import java.math.BigDecimal;

import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.property.enums.FurnishingStatus;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.enums.PropertyType;

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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

@Entity
@Table(name = "properties")
public class Property {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "property_id")
    private Long propertyId;

    @NotBlank(message = "Property name is required")
    @Column(name = "property_name", nullable = false, length = 150)
    private String propertyName;

    @NotNull(message = "Property type is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "property_type", nullable = false, length = 30)
    private PropertyType propertyType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @PositiveOrZero(message = "Total area cannot be negative")
    @Column(name = "total_area")
    private Double totalArea;

    @PositiveOrZero(message = "Bedrooms cannot be negative")
    @Column(name = "bedrooms")
    private Integer bedrooms;

    @PositiveOrZero(message = "Bathrooms cannot be negative")
    @Column(name = "bathrooms")
    private Integer bathrooms;

    @PositiveOrZero(message = "Floor number cannot be negative")
    @Column(name = "floor_number")
    private Integer floorNumber;

    @PositiveOrZero(message = "Total floors cannot be negative")
    @Column(name = "total_floors")
    private Integer totalFloors;

    @Enumerated(EnumType.STRING)
    @Column(name = "furnishing_status", length = 30)
    private FurnishingStatus furnishingStatus;

    @Column(name = "parking_available")
    private Boolean parkingAvailable;

    // M1 AI Rent Prediction field
    @Column(name = "year_built")
    private Integer yearBuilt;

    @PositiveOrZero(message = "Monthly rent cannot be negative")
    @Column(name = "monthly_rent", precision = 12, scale = 2)
    private BigDecimal monthlyRent;

    @PositiveOrZero(message = "Security deposit cannot be negative")
    @Column(name = "security_deposit", precision = 12, scale = 2)
    private BigDecimal securityDeposit;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private PropertyStatus status = PropertyStatus.DRAFT;

    // Property owner
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    // Assigned property manager
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_manager_id")
    private PropertyManager propertyManager;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Property() {
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();

        if (status == null) {
            status = PropertyStatus.DRAFT;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(Long propertyId) {
        this.propertyId = propertyId;
    }

    public String getPropertyName() {
        return propertyName;
    }

    public void setPropertyName(String propertyName) {
        this.propertyName = propertyName;
    }

    public PropertyType getPropertyType() {
        return propertyType;
    }

    public void setPropertyType(PropertyType propertyType) {
        this.propertyType = propertyType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Double getTotalArea() {
        return totalArea;
    }

    public void setTotalArea(Double totalArea) {
        this.totalArea = totalArea;
    }

    public Integer getBedrooms() {
        return bedrooms;
    }

    public void setBedrooms(Integer bedrooms) {
        this.bedrooms = bedrooms;
    }

    public Integer getBathrooms() {
        return bathrooms;
    }

    public void setBathrooms(Integer bathrooms) {
        this.bathrooms = bathrooms;
    }

    public Integer getFloorNumber() {
        return floorNumber;
    }

    public void setFloorNumber(Integer floorNumber) {
        this.floorNumber = floorNumber;
    }

    public Integer getTotalFloors() {
        return totalFloors;
    }

    public void setTotalFloors(Integer totalFloors) {
        this.totalFloors = totalFloors;
    }

    public FurnishingStatus getFurnishingStatus() {
        return furnishingStatus;
    }

    public void setFurnishingStatus(FurnishingStatus furnishingStatus) {
        this.furnishingStatus = furnishingStatus;
    }

    public Boolean getParkingAvailable() {
        return parkingAvailable;
    }

    public void setParkingAvailable(Boolean parkingAvailable) {
        this.parkingAvailable = parkingAvailable;
    }

    public Integer getYearBuilt() {
        return yearBuilt;
    }

    public void setYearBuilt(Integer yearBuilt) {
        this.yearBuilt = yearBuilt;
    }

    public BigDecimal getMonthlyRent() { return monthlyRent; }

    public void setMonthlyRent(BigDecimal monthlyRent) { this.monthlyRent = monthlyRent; }

    public BigDecimal getSecurityDeposit() { return securityDeposit; }

    public void setSecurityDeposit(BigDecimal securityDeposit) { this.securityDeposit = securityDeposit; }

    public PropertyStatus getStatus() {
        return status;
    }

    public void setStatus(PropertyStatus status) {
        this.status = status;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public PropertyManager getPropertyManager() {
        return propertyManager;
    }

    public void setPropertyManager(PropertyManager propertyManager) {
        this.propertyManager = propertyManager;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
