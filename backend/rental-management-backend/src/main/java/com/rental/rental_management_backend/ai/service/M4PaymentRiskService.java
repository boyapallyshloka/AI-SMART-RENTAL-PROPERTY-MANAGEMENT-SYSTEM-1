
package com.rental.rental_management_backend.ai.service;

import org.springframework.stereotype.Service;

import com.rental.rental_management_backend.ai.client.M4PaymentRiskClient;
import com.rental.rental_management_backend.ai.dto.M4PaymentRiskRequest;
import com.rental.rental_management_backend.ai.dto.M4PaymentRiskResponse;
import com.rental.rental_management_backend.payment.service.PaymentService;

@Service
public class M4PaymentRiskService {

    private final M4PaymentRiskAggregationService aggregationService;

    private final M4PaymentRiskClient paymentRiskClient;

    private final PaymentService paymentService;

    public M4PaymentRiskService(

            M4PaymentRiskAggregationService aggregationService,

            M4PaymentRiskClient paymentRiskClient,

            PaymentService paymentService) {

        this.aggregationService =
                aggregationService;

        this.paymentRiskClient =
                paymentRiskClient;

        this.paymentService =
                paymentService;
    }

    public M4PaymentRiskResponse predictPaymentRisk(

            Long tenantId,

            String email) {

        if (tenantId == null) {

            throw new IllegalArgumentException(
                    "Tenant ID is required");
        }

        if (email == null || email.isBlank()) {

            throw new IllegalArgumentException(
                    "Authenticated user is required");
        }

        /*
         * Step 1:
         * Reuse the existing payment authorization logic.
         *
         * PaymentService already verifies:
         *
         * SUPER_ADMIN        -> allowed
         * PROPERTY_OWNER     -> property ownership checked
         * PROPERTY_MANAGER   -> managed property checked
         * TENANT             -> blocked by controller
         *
         * This prevents us from creating a second,
         * different property-authorization implementation.
         */
        paymentService.getPaymentsByTenant(
                tenantId,
                email);

        /*
         * Step 2:
         * Aggregate the tenant's historical invoice/payment
         * information into the exact 20 M4 features.
         */
        M4PaymentRiskRequest request =
                aggregationService.aggregateFeatures(
                        tenantId);

        /*
         * Step 3:
         * Send only the 20 model features to the
         * centralized AI service.
         */
        M4PaymentRiskResponse response =
                paymentRiskClient.predictPaymentRisk(
                        request);

        if (response == null) {

            throw new IllegalArgumentException(
                    "M4 payment-risk service returned an empty response");
        }

        return response;
    }
}
