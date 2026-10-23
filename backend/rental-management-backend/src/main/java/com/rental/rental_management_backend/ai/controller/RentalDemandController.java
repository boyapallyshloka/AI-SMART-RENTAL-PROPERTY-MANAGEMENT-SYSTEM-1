package com.rental.rental_management_backend.ai.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.ai.dto.RentalDemandPreviewRequestDTO;
import com.rental.rental_management_backend.ai.service.RentalDemandService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/ai/rental-demand")
public class RentalDemandController {

    private final RentalDemandService rentalDemandService;

    public RentalDemandController(
            RentalDemandService rentalDemandService) {

        this.rentalDemandService = rentalDemandService;
    }

    @PostMapping("/predict")
    @PreAuthorize("""
            hasAnyRole(
                'PROPERTY_OWNER',
                'PROPERTY_MANAGER',
                'SUPER_ADMIN'
            )
            """)
        public ResponseEntity<?> predictRentalDemand(
            @Valid @RequestBody RentalDemandPreviewRequestDTO request) {

        return ResponseEntity.ok(
            rentalDemandService.predictRentalDemand(request));
    }
}