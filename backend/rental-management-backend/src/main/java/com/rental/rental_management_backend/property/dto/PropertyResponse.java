package com.rental.rental_management_backend.property.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.rental.rental_management_backend.property.enums.FurnishingStatus;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.enums.PropertyType;

public class PropertyResponse {

    private Long propertyId;

    private String propertyName;

    private PropertyType propertyType;

    private String description;

    private Double totalArea;

    private Integer bedrooms;

    private Integer bathrooms;

    private Integer floorNumber;

    private Integer totalFloors;

    private FurnishingStatus furnishingStatus;

    private Boolean parkingAvailable;

    private Integer yearBuilt;

    private BigDecimal monthlyRent;

    private BigDecimal securityDeposit;

    private PropertyStatus status;

    private Long ownerId;

    private String ownerName;

    private Long propertyManagerId;

    private String managerName;

    private String managerEmail;

    private String managerPhone;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public PropertyResponse() {
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

    public Long getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(Long ownerId) {
        this.ownerId = ownerId;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public Long getPropertyManagerId() {
        return propertyManagerId;
    }

    public void setPropertyManagerId(Long propertyManagerId) {
        this.propertyManagerId = propertyManagerId;
    }

    public String getManagerName() {
        return managerName;
    }

    public void setManagerName(String managerName) {
        this.managerName = managerName;
    }

    public String getManagerEmail() {
        return managerEmail;
    }

    public void setManagerEmail(String managerEmail) {
        this.managerEmail = managerEmail;
    }

    public String getManagerPhone() {
        return managerPhone;
    }

    public void setManagerPhone(String managerPhone) {
        this.managerPhone = managerPhone;
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
