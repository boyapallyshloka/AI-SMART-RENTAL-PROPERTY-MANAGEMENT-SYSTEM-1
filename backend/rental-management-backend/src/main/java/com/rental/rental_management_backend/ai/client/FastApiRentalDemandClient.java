
package com.rental.rental_management_backend.ai.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

import com.rental.rental_management_backend.ai.dto.RentalDemandRequestDTO;

@Component
public class FastApiRentalDemandClient {

    private final RestClient restClient;

    private final String demandPredictionUrl;

    public FastApiRentalDemandClient(
            RestClient.Builder restClientBuilder,
            @Value("${ai.fastapi.demand-prediction-url}") String demandPredictionUrl) {

        this.restClient = restClientBuilder.build();
        this.demandPredictionUrl = demandPredictionUrl;
    }

    public Map<String, Object> predictDemand(
            RentalDemandRequestDTO request) {

        return restClient
                .post()
                .uri(demandPredictionUrl)
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {});
    }
}
