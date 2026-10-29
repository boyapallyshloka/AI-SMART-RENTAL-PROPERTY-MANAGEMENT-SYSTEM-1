package com.rental.rental_management_backend.ai.service;

import com.rental.rental_management_backend.ai.dto.RentPredictionPreviewRequestDTO;
import com.rental.rental_management_backend.ai.dto.RentPredictionResponseDTO;

public interface RentPredictionService {

    RentPredictionResponseDTO predictRent(
            RentPredictionPreviewRequestDTO request);
}