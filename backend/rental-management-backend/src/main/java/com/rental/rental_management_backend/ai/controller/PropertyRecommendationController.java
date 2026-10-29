package com.rental.rental_management_backend.ai.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.ai.dto.M2RecommendationResponse;
import com.rental.rental_management_backend.ai.service.PropertyRecommendationService;

@RestController
@RequestMapping("/api/ai")
public class PropertyRecommendationController {

    private final PropertyRecommendationService propertyRecommendationService;

    public PropertyRecommendationController(
            PropertyRecommendationService propertyRecommendationService) {
        this.propertyRecommendationService = propertyRecommendationService;
    }

    @GetMapping("/recommendations")
    public ResponseEntity<M2RecommendationResponse> recommendProperties(
            @RequestParam Long tenantId,
            @RequestParam(defaultValue = "5") Integer topN,
            @RequestParam(required = false) Double currentLatitude,
            @RequestParam(required = false) Double currentLongitude,
            @RequestParam(required = false) String currentAddress) {

        M2RecommendationResponse response =
                propertyRecommendationService.recommendProperties(
                        tenantId,
                        topN,
                        currentLatitude,
                        currentLongitude,
                        currentAddress
                );

        return ResponseEntity.ok(response);
    }
}