package com.rental.rental_management_backend.property.dto;

public record PublicPropertyImageResponse(
        String imageUrl,
        String imageType,
        Boolean isPrimary) {
}
