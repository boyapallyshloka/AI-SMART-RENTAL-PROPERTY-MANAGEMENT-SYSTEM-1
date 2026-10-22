
package com.rental.rental_management_backend.ai.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.rental.rental_management_backend.ai.dto.RentalDemandRequestDTO;
import com.rental.rental_management_backend.ai.dto.RentalDemandResponseDTO;

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

    public RentalDemandResponseDTO predictDemand(
            RentalDemandRequestDTO request) {

        System.out.println("========== M3 DEBUG START ==========");
        System.out.println("FastAPI URL: " + demandPredictionUrl);
        System.out.println("City: " + request.getCity());
        System.out.println("Area: " + request.getAreaLocality());
        System.out.println("Month: " + request.getMonth());
        System.out.println("Year: " + request.getYear());
        System.out.println("Property count: " + request.getPropertyCount());
        System.out.println("Application count: " + request.getApplicationCount());
        System.out.println("Agreement start count: " + request.getAgreementStartCount());
        System.out.println("Average monthly rent: " + request.getAverageMonthlyRent());
        System.out.println("Demand lag 1: " + request.getDemandLag1Month());
        System.out.println("Demand lag 2: " + request.getDemandLag2Month());
        System.out.println("Demand growth: " + request.getDemandGrowth1Month());
        System.out.println("Occupancy rate: " + request.getOccupancyRate());
        System.out.println("Vacancy rate: " + request.getVacancyRate());
        System.out.println("Available unit count: " + request.getAvailableUnitCount());

        RentalDemandResponseDTO response = restClient
                .post()
                .uri(demandPredictionUrl)
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(RentalDemandResponseDTO.class);

        System.out.println("Received success: "
                + (response == null ? null : response.getSuccess()));
        System.out.println("Received predictedDemandCount: "
                + (response == null ? null : response.getPredictedDemandCount()));
        System.out.println("Received demandLevel: "
                + (response == null ? null : response.getDemandLevel()));
        System.out.println("Received city: "
                + (response == null ? null : response.getCity()));
        System.out.println("Received area: "
                + (response == null ? null : response.getAreaLocality()));
        System.out.println("Received month: "
                + (response == null ? null : response.getMonth()));
        System.out.println("Received year: "
                + (response == null ? null : response.getYear()));
        System.out.println("========== M3 DEBUG END ==========");

        return response;
    }
}
