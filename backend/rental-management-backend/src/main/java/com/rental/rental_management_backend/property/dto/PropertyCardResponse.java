package com.rental.rental_management_backend.property.dto;

import java.math.BigDecimal;

public class PropertyCardResponse {

    private Long id;
    private String propertyName;
    private String propertyType;
    private String status;
    private Double areaSqft;
    private Integer bedrooms;
    private Integer yearBuilt;
    private String address;
    private String imageUrl;
    private Boolean isFavorite;
    private BigDecimal monthlyRent;
    private BigDecimal securityDeposit;

    public PropertyCardResponse() {
    }

    public PropertyCardResponse(
            Long id,
            String propertyName,
            String propertyType,
            String status,
            Double areaSqft,
            Integer bedrooms,
            Integer yearBuilt,
            String address,
            String imageUrl,
            Boolean isFavorite) {
        this.id = id;
        this.propertyName = propertyName;
        this.propertyType = propertyType;
        this.status = status;
        this.areaSqft = areaSqft;
        this.bedrooms = bedrooms;
        this.yearBuilt = yearBuilt;
        this.address = address;
        this.imageUrl = imageUrl;
        this.isFavorite = isFavorite;
    }

    public PropertyCardResponse(
            Long id,
            String propertyName,
            String propertyType,
            String status,
            Double areaSqft,
            Integer bedrooms,
            Integer yearBuilt,
            String address,
            String imageUrl,
            Boolean isFavorite,
            BigDecimal monthlyRent,
            BigDecimal securityDeposit) {
        this(id, propertyName, propertyType, status, areaSqft, bedrooms,
                yearBuilt, address, imageUrl, isFavorite);
        this.monthlyRent = monthlyRent;
        this.securityDeposit = securityDeposit;
    }

    public PropertyCardResponse(
            Long id,
            String propertyName,
            String propertyType,
            String status,
            Double areaSqft,
            Integer yearBuilt,
            String address,
            String imageUrl,
            Boolean isFavorite,
            BigDecimal monthlyRent,
            BigDecimal securityDeposit) {
        this(id, propertyName, propertyType, status, areaSqft, null,
                yearBuilt, address, imageUrl, isFavorite, monthlyRent,
                securityDeposit);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPropertyName() {
        return propertyName;
    }

    public void setPropertyName(String propertyName) {
        this.propertyName = propertyName;
    }

    public String getPropertyType() {
        return propertyType;
    }

    public void setPropertyType(String propertyType) {
        this.propertyType = propertyType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Double getAreaSqft() {
        return areaSqft;
    }

    public void setAreaSqft(Double areaSqft) {
        this.areaSqft = areaSqft;
    }

    public Integer getBedrooms() {
        return bedrooms;
    }

    public void setBedrooms(Integer bedrooms) {
        this.bedrooms = bedrooms;
    }

    public Integer getYearBuilt() {
        return yearBuilt;
    }

    public void setYearBuilt(Integer yearBuilt) {
        this.yearBuilt = yearBuilt;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Boolean getIsFavorite() {
        return isFavorite;
    }

    public void setIsFavorite(Boolean favorite) {
        isFavorite = favorite;
    }

    public BigDecimal getMonthlyRent() {
        return monthlyRent;
    }

    public void setMonthlyRent(BigDecimal monthlyRent) {
        this.monthlyRent = monthlyRent;
    }

    public BigDecimal getSecurityDeposit() {
        return securityDeposit;
    }

    public void setSecurityDeposit(BigDecimal securityDeposit) {
        this.securityDeposit = securityDeposit;
    }
}
