package com.rental.rental_management_backend.ai.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.ai.dto.M6ProfitabilityResponse;
import com.rental.rental_management_backend.ai.service.PropertyProfitabilityService;

@RestController
@RequestMapping("/api/ai/property-profitability")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'PROPERTY_OWNER', 'PROPERTY_MANAGER')")
public class PropertyProfitabilityController {

    private final PropertyProfitabilityService propertyProfitabilityService;

    public PropertyProfitabilityController(
            PropertyProfitabilityService propertyProfitabilityService) {
        this.propertyProfitabilityService = propertyProfitabilityService;
    }

    @GetMapping("/{propertyId}")
    public ResponseEntity<M6ProfitabilityResponse> predictProfitability(
            @PathVariable Long propertyId,
            Authentication authentication) {
        return ResponseEntity.ok(propertyProfitabilityService.predict(
                propertyId, authentication.getName()));
    }
}
