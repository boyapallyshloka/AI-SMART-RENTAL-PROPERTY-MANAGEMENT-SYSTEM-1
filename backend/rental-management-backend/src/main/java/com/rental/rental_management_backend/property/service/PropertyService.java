package com.rental.rental_management_backend.property.service;

import java.util.List;

import com.rental.rental_management_backend.property.dto.PropertyCardResponse;
import com.rental.rental_management_backend.property.dto.PropertyRequest;
import com.rental.rental_management_backend.property.dto.PropertyResponse;
import com.rental.rental_management_backend.property.enums.FurnishingStatus;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.enums.PropertyType;

public interface PropertyService {

    // Owner property management
    PropertyResponse createProperty(PropertyRequest request);

    List<PropertyResponse> getMyProperties();

    PropertyResponse getMyPropertyById(Long id);

    PropertyResponse updateProperty(Long id, PropertyRequest request);

    void deleteProperty(Long id);

    PropertyResponse updatePropertyStatus(
            Long id,
            PropertyStatus status
    );

    PropertyResponse submitPropertyForApproval(Long id);

    List<PropertyResponse> getPendingApprovalProperties();

    PropertyResponse getPropertyForAdmin(Long id);

    PropertyResponse approveProperty(Long id);

    // Public/Tenant property access
    PropertyResponse getPublicPropertyById(Long propertyId);

    List<PropertyCardResponse> getAvailableProperties();

    /*
     * Tenant property search/filter
     */
    List<PropertyResponse> searchAvailableProperties(
            String searchQuery,
            String city,
            PropertyType propertyType,
            FurnishingStatus furnishingStatus,
            Boolean parkingAvailable,
            Double minRent,
            Double maxRent,
            Integer bedrooms
    );

    // Property manager assignment
    PropertyResponse assignPropertyManager(
            Long propertyId,
            Long propertyManagerId
    );

    PropertyResponse removePropertyManager(
            Long propertyId
    );
}
