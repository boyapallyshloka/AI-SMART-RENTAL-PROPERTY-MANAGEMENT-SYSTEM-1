package com.rental.rental_management_backend.ai.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.rental.rental_management_backend.ai.dto.M6ProfitabilityRequest;
import com.rental.rental_management_backend.ai.dto.M6ProfitabilityResponse;

@Component
public class M6ProfitabilityClient {

    private final RestClient restClient;
    private final String aiMlBaseUrl;

    public M6ProfitabilityClient(
            RestClient.Builder restClientBuilder,
            @Value("${ai.ml.base-url}") String aiMlBaseUrl) {
        this.restClient = restClientBuilder.build();
        this.aiMlBaseUrl = aiMlBaseUrl;
    }

    public M6ProfitabilityResponse predictProfitability(
            M6ProfitabilityRequest request) {
        M6ProfitabilityResponse response = restClient.post()
                .uri(aiMlBaseUrl + "/m6/predict-profitability")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(M6ProfitabilityResponse.class);

        if (response == null) {
            throw new IllegalStateException(
                    "M6 profitability service returned an empty response");
        }

        return response;
    }
}
