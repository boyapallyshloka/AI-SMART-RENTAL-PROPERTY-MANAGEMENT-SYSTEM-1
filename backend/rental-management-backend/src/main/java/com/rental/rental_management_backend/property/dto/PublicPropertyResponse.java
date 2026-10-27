package com.rental.rental_management_backend.property.dto;

import java.math.BigDecimal;

import com.rental.rental_management_backend.property.enums.FurnishingStatus;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.enums.PropertyType;

public record PublicPropertyResponse(
        Long propertyId,
        String propertyName,
        PropertyType propertyType,
        String description,
        BigDecimal monthlyRent,
        BigDecimal securityDeposit,
        Double totalArea,
        Integer bedrooms,
        Integer bathrooms,
        FurnishingStatus furnishingStatus,
        Boolean parkingAvailable,
        Integer yearBuilt,
        PropertyStatus status,
        String imageUrl) {

    public PublicPropertyResponse(
            Long propertyId,
            String propertyName,
            PropertyType propertyType,
            String description,
            BigDecimal monthlyRent,
            BigDecimal securityDeposit,
            Double totalArea,
            Integer bedrooms,
            Integer bathrooms,
            FurnishingStatus furnishingStatus,
            Boolean parkingAvailable,
            Integer yearBuilt,
            PropertyStatus status) {
        this(
                propertyId,
                propertyName,
                propertyType,
                description,
                monthlyRent,
                securityDeposit,
                totalArea,
                bedrooms,
                bathrooms,
                furnishingStatus,
                parkingAvailable,
                yearBuilt,
                status,
                null);
    }
}
