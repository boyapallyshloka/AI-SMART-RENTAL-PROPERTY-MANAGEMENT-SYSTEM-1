package com.rental.rental_management_backend.tenant.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.tenant.dto.AccessibleTenantsResponseDTO;
import com.rental.rental_management_backend.tenant.service.AccessibleTenantService;

@RestController
@RequestMapping("/api")
public class AccessibleTenantController {

    private final AccessibleTenantService accessibleTenantService;

    public AccessibleTenantController(
            AccessibleTenantService accessibleTenantService) {
        this.accessibleTenantService = accessibleTenantService;
    }

    @GetMapping("/owner/tenants")
    @PreAuthorize("hasRole('PROPERTY_OWNER')")
    public ResponseEntity<AccessibleTenantsResponseDTO> getOwnerTenants() {
        return ResponseEntity.ok(accessibleTenantService.getOwnerTenants());
    }

    @GetMapping("/manager/tenants")
    @PreAuthorize("hasRole('PROPERTY_MANAGER')")
    public ResponseEntity<AccessibleTenantsResponseDTO> getManagerTenants() {
        return ResponseEntity.ok(accessibleTenantService.getManagerTenants());
    }
}
