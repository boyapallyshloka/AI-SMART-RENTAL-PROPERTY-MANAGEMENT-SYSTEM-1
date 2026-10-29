package com.rental.rental_management_backend.ai.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.ai.dto.RentPredictionPreviewRequestDTO;
import com.rental.rental_management_backend.ai.dto.RentPredictionResponseDTO;
import com.rental.rental_management_backend.ai.service.RentPredictionService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/ai/rent-prediction")
public class RentPredictionController {

    private final RentPredictionService rentPredictionService;

    public RentPredictionController(
            RentPredictionService rentPredictionService) {

        this.rentPredictionService = rentPredictionService;
    }

    @PostMapping("/predict-unit")
    @PreAuthorize("hasRole('PROPERTY_OWNER')")
    public ResponseEntity<RentPredictionResponseDTO> predictRent(
            @Valid @RequestBody RentPredictionPreviewRequestDTO request) {

        RentPredictionResponseDTO response =
                rentPredictionService.predictRent(request);

        return ResponseEntity.ok(response);
    }
}