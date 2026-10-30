package com.rental.rental_management_backend.property.dto;

public record AdminPendingPropertyResponse(
        Long propertyId,
        String propertyName,
        Long ownerId,
        String ownerName,
        String description) {
}
