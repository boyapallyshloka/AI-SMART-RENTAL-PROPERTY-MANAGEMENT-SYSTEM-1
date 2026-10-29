package com.rental.rental_management_backend.ai.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rental.rental_management_backend.ai.dto.M6ProfitabilityRequest;
import com.rental.rental_management_backend.ai.dto.M6ProfitabilityResponse;

@Component
public class M6ProfitabilityClient {

    private final RestClient restClient;
    private final String aiServiceBaseUrl;
    private final ObjectMapper objectMapper;

    public M6ProfitabilityClient(
            RestClient.Builder restClientBuilder,
            @Value("${ai.ml.base-url}") String aiServiceBaseUrl,
            ObjectMapper objectMapper) {
        this.restClient = restClientBuilder.build();
        this.aiServiceBaseUrl = aiServiceBaseUrl.replaceAll("/+$", "");
        this.objectMapper = objectMapper;
    }

    public M6ProfitabilityResponse predict(M6ProfitabilityRequest request) {
        try {
            return restClient.post()
                    .uri(aiServiceBaseUrl + "/m6/predict-profitability")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(M6ProfitabilityResponse.class);
        } catch (RestClientResponseException exception) {
            String detail = responseErrorDetail(exception);
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "M6 profitability service rejected or failed the request: "
                            + detail);
        } catch (ResourceAccessException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "M6 profitability service could not be reached in time");
        } catch (RestClientException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "M6 profitability service returned an unexpected response");
        }
    }

    private String responseErrorDetail(RestClientResponseException exception) {
        try {
            JsonNode response = objectMapper.readTree(
                    exception.getResponseBodyAsString());
            String message = response.path("message").asText(null);
            String errorCode = response.path("errorCode").asText(null);

            if (message != null && !message.isBlank()) {
                return message;
            }
            if (errorCode != null && !errorCode.isBlank()) {
                return errorCode;
            }
        } catch (JsonProcessingException ignored) {
            // Return the status only; never expose an unparsed upstream body.
        }

        return "HTTP " + exception.getStatusCode().value();
    }
}
