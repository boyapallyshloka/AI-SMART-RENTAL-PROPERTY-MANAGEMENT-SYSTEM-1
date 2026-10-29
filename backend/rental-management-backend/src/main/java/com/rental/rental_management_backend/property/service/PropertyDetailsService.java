package com.rental.rental_management_backend.property.service;

import com.rental.rental_management_backend.property.dto.PropertyDetailsResponse;
import com.rental.rental_management_backend.property.dto.PropertyResponse;

public interface PropertyDetailsService {

    PropertyDetailsResponse getPropertyDetails(Long propertyId);

    PropertyDetailsResponse getPublicPropertyDetails(Long propertyId);

    PropertyDetailsResponse getPropertyDetailsForManager(
            Long propertyId,
            PropertyResponse property);
}