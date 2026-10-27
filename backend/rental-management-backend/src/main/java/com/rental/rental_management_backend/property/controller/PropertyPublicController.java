package com.rental.rental_management_backend.property.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.property.dto.PropertyCardResponse;
import com.rental.rental_management_backend.property.dto.PublicPropertyDetailsResponse;
import com.rental.rental_management_backend.property.dto.PublicPropertyResponse;
import com.rental.rental_management_backend.property.enums.FurnishingStatus;
import com.rental.rental_management_backend.property.enums.PropertyType;
import com.rental.rental_management_backend.property.service.PropertyDetailsService;
import com.rental.rental_management_backend.property.service.PropertyService;

@RestController
@RequestMapping("/api/properties")
public class PropertyPublicController {

    private final PropertyService propertyService;

    private final PropertyDetailsService propertyDetailsService;

    public PropertyPublicController(
            PropertyService propertyService,
            PropertyDetailsService propertyDetailsService) {

        this.propertyService = propertyService;
        this.propertyDetailsService = propertyDetailsService;
    }

    /**
     * GET AVAILABLE PROPERTIES
     *
     * Used by tenants to browse properties
     * that are currently available for rental.
     */
    @GetMapping("/public")
    @PreAuthorize("permitAll()")
    public ResponseEntity<List<PropertyCardResponse>> getAvailableProperties() {

        return ResponseEntity.ok(
                propertyService.getAvailableProperties()
        );
    }

    /**
     * SEARCH / FILTER AVAILABLE PROPERTIES
     *
     * Used by tenants to search available properties
     * using optional filters.
     *
     * All parameters are optional.
     */
    @GetMapping("/public/search")
    @PreAuthorize("permitAll()")
    public ResponseEntity<List<PublicPropertyResponse>> searchAvailableProperties(

            @RequestParam(required = false)
            String searchQuery,

            @RequestParam(required = false)
            String city,

            @RequestParam(required = false)
            PropertyType propertyType,

            @RequestParam(required = false)
            FurnishingStatus furnishingStatus,

            @RequestParam(required = false)
            Boolean parkingAvailable,

            @RequestParam(required = false)
            Double minRent,

            @RequestParam(required = false)
            Double maxRent,

            @RequestParam(required = false)
            Integer bedrooms) {

        return ResponseEntity.ok(
                propertyService.searchAvailableProperties(
                        searchQuery,
                        city,
                        propertyType,
                        furnishingStatus,
                        parkingAvailable,
                        minRent,
                        maxRent,
                        bedrooms
                )
        );
    }

    /**
     * GET ONE AVAILABLE PROPERTY DETAILS
     *
     * Used by tenants to view complete details
     * of one available property.
     */
    @GetMapping("/public/{propertyId}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<PublicPropertyDetailsResponse> getPublicPropertyDetails(
            @PathVariable Long propertyId) {

        return ResponseEntity.ok(
                propertyDetailsService.getPublicPropertyDetails(propertyId)
        );
    }
}
