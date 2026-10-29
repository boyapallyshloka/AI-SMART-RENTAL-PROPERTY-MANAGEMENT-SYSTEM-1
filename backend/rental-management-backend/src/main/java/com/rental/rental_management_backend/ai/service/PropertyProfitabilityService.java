package com.rental.rental_management_backend.ai.service;

import com.rental.rental_management_backend.ai.dto.M6ProfitabilityResponse;

public interface PropertyProfitabilityService {

    M6ProfitabilityResponse predict(Long propertyId, String authenticatedEmail);
}
