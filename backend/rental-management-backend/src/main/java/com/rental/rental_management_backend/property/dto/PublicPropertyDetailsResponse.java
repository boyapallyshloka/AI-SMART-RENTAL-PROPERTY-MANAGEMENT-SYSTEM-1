package com.rental.rental_management_backend.property.dto;

import java.math.BigDecimal;
import java.util.List;

public record PublicPropertyDetailsResponse(
        PublicPropertyResponse property,
        PublicLocation location,
        List<AvailableUnit> availableUnits,
        List<String> amenities,
        List<PublicPropertyImageResponse> images) {

    public record PublicLocation(
            String area,
            String city,
            String state) {
    }

    public record AvailableUnit(
            Long unitId,
            String unitNumber,
            String buildingName,
            Integer floorNumber,
            Double area,
            Integer bedrooms,
            Integer bathrooms,
            BigDecimal monthlyRent,
            BigDecimal securityDeposit) {
    }
}
