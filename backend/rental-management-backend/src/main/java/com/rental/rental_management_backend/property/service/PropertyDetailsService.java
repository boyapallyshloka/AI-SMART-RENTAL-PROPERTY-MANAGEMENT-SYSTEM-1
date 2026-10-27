package com.rental.rental_management_backend.property.service;

import com.rental.rental_management_backend.property.dto.PublicPropertyDetailsResponse;
import com.rental.rental_management_backend.property.dto.PropertyDetailsResponse;
import com.rental.rental_management_backend.property.dto.PropertyResponse;

public interface PropertyDetailsService {

    PropertyDetailsResponse getPropertyDetails(Long propertyId);

    PublicPropertyDetailsResponse getPublicPropertyDetails(Long propertyId);

    PropertyDetailsResponse getPropertyDetailsForManager(
            Long propertyId,
            PropertyResponse property);
}