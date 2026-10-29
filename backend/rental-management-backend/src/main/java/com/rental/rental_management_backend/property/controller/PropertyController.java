
package com.rental.rental_management_backend.property.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.property.dto.PropertyDetailsResponse;
import com.rental.rental_management_backend.property.dto.PropertyRequest;
import com.rental.rental_management_backend.property.dto.PropertyResponse;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.service.PropertyDetailsService;
import com.rental.rental_management_backend.property.service.PropertyService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/owner/properties")
@PreAuthorize("hasRole('PROPERTY_OWNER')")
public class PropertyController {

    private final PropertyService propertyService;

    private final PropertyDetailsService propertyDetailsService;

    public PropertyController(
            PropertyService propertyService,
            PropertyDetailsService propertyDetailsService) {

        this.propertyService = propertyService;
        this.propertyDetailsService = propertyDetailsService;
    }

    /*
     * CREATE PROPERTY
     */
    @PostMapping
    public ResponseEntity<PropertyResponse> createProperty(
            @Valid @RequestBody PropertyRequest request) {

        PropertyResponse response =
                propertyService.createProperty(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    /*
     * GET LOGGED-IN OWNER'S PROPERTIES OR AVAILABLE PROPERTIES FOR TENANT
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('PROPERTY_OWNER', 'TENANT')")
    public ResponseEntity<List<PropertyResponse>> getMyProperties() {

        return ResponseEntity.ok(
                propertyService.getMyProperties()
        );
    }

    /*
     * GET ONE PROPERTY OF LOGGED-IN OWNER
     */
    @GetMapping("/{id}")
    public ResponseEntity<PropertyResponse> getPropertyById(
            @PathVariable Long id) {

        return ResponseEntity.ok(
                propertyService.getMyPropertyById(id)
        );
    }

    /*
     * GET COMPLETE PROPERTY DETAILS
     *
     * Returns:
     * Property
     * Address
     * Buildings
     * Floors
     * Units
     * Amenities
     * Images
     */
    @GetMapping("/{id}/details")
    @PreAuthorize("hasAnyRole('PROPERTY_OWNER', 'TENANT')")
    public ResponseEntity<PropertyDetailsResponse> getPropertyDetails(
            @PathVariable Long id) {

        return ResponseEntity.ok(
                propertyDetailsService.getPropertyDetails(id)
        );
    }

    /*
     * UPDATE PROPERTY
     */
    @PutMapping("/{id}")
    public ResponseEntity<PropertyResponse> updateProperty(
            @PathVariable Long id,
            @Valid @RequestBody PropertyRequest request) {

        return ResponseEntity.ok(
                propertyService.updateProperty(
                        id,
                        request
                )
        );
    }

    /*
     * DELETE PROPERTY
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteProperty(
            @PathVariable Long id) {

        propertyService.deleteProperty(id);

        return ResponseEntity.ok(
                "Property deleted successfully"
        );
    }

    /*
     * UPDATE PROPERTY STATUS
     */
    @PutMapping("/{id}/status")
    public ResponseEntity<PropertyResponse> updatePropertyStatus(
            @PathVariable Long id,
            @RequestParam PropertyStatus status) {

        return ResponseEntity.ok(
                propertyService.updatePropertyStatus(
                        id,
                        status
                )
        );
    }

    /*
     * ASSIGN PROPERTY MANAGER
     *
     * The logged-in property owner can assign
     * a PropertyManager to their own property.
     */
    @PutMapping("/{propertyId}/manager/{propertyManagerId}")
    public ResponseEntity<PropertyResponse> assignPropertyManager(
            @PathVariable Long propertyId,
            @PathVariable Long propertyManagerId) {

        return ResponseEntity.ok(
                propertyService.assignPropertyManager(
                        propertyId,
                        propertyManagerId
                )
        );
    }

    /*
     * REMOVE PROPERTY MANAGER
     *
     * The logged-in property owner can remove
     * the manager assigned to their own property.
     */
    @DeleteMapping("/{propertyId}/manager")
    public ResponseEntity<PropertyResponse> removePropertyManager(
            @PathVariable Long propertyId) {

        return ResponseEntity.ok(
                propertyService.removePropertyManager(
                        propertyId
                )
        );
    }
}


