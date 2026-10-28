package com.rental.rental_management_backend.ai.service;

import com.rental.rental_management_backend.ai.dto.M6ProfitabilityResponse;

public interface M6ProfitabilityService {

    M6ProfitabilityResponse predictPropertyProfitability(Long propertyId);
}
