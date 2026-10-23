package com.rental.rental_management_backend.property.dto;

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
}
