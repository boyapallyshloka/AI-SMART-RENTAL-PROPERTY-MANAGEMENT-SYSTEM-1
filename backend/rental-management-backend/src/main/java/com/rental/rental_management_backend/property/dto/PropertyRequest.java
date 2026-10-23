package com.rental.rental_management_backend.property.dto;

import java.math.BigDecimal;

import com.rental.rental_management_backend.property.enums.FurnishingStatus;
import com.rental.rental_management_backend.property.enums.PropertyType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public class PropertyRequest {

    @NotBlank(message = "Property name is required")
    private String propertyName;

    @NotNull(message = "Property type is required")
    private PropertyType propertyType;

    private String description;

    @PositiveOrZero(message = "Total area cannot be negative")
    private Double totalArea;

    @PositiveOrZero(message = "Bedrooms cannot be negative")
    private Integer bedrooms;

    @PositiveOrZero(message = "Bathrooms cannot be negative")
    private Integer bathrooms;

    @PositiveOrZero(message = "Floor number cannot be negative")
    private Integer floorNumber;

    @PositiveOrZero(message = "Total floors cannot be negative")
    private Integer totalFloors;

    private FurnishingStatus furnishingStatus;

    private Boolean parkingAvailable;

    @PositiveOrZero(message = "Year built cannot be negative")
    private Integer yearBuilt;

    @PositiveOrZero(message = "Monthly rent cannot be negative")
    private BigDecimal monthlyRent;

    @PositiveOrZero(message = "Security deposit cannot be negative")
    private BigDecimal securityDeposit;

    public PropertyRequest() {
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
}
