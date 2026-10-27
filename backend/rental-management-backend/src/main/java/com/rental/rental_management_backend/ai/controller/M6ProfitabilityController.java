package com.rental.rental_management_backend.ai.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.ai.dto.M6ProfitabilityResponse;
import com.rental.rental_management_backend.ai.service.M6ProfitabilityService;

@RestController
@RequestMapping("/api/ai")
public class M6ProfitabilityController {

    private final M6ProfitabilityService profitabilityService;

    public M6ProfitabilityController(
            M6ProfitabilityService profitabilityService) {
        this.profitabilityService = profitabilityService;
    }

    @GetMapping("/property-profitability/{propertyId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'PROPERTY_OWNER', 'PROPERTY_MANAGER')")
    public ResponseEntity<M6ProfitabilityResponse> predictPropertyProfitability(
            @PathVariable Long propertyId) {
        return ResponseEntity.ok(
                profitabilityService.predictPropertyProfitability(propertyId));
    }
}
