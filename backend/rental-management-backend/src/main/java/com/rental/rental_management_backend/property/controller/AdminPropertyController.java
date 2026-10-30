package com.rental.rental_management_backend.property.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.property.dto.AdminPendingPropertyResponse;
import com.rental.rental_management_backend.property.dto.PropertyResponse;
import com.rental.rental_management_backend.property.service.PropertyService;

@RestController
@RequestMapping("/api/admin/properties")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminPropertyController {

    private final PropertyService propertyService;

    public AdminPropertyController(PropertyService propertyService) {
        this.propertyService = propertyService;
    }

    @GetMapping("/pending-approval")
    public ResponseEntity<List<AdminPendingPropertyResponse>>
            getPendingApprovalProperties() {
        return ResponseEntity.ok(
                propertyService.getPendingApprovalProperties());
    }

    @PatchMapping("/{propertyId}/approve")
    public ResponseEntity<PropertyResponse> approveProperty(
            @PathVariable Long propertyId) {
        return ResponseEntity.ok(
                propertyService.approveProperty(propertyId));
    }
}
