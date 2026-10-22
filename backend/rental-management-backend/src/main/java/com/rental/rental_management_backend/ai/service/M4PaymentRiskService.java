
package com.rental.rental_management_backend.ai.service;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.ai.client.M4PaymentRiskClient;
import com.rental.rental_management_backend.ai.dto.M4PaymentRiskRequest;
import com.rental.rental_management_backend.ai.dto.M4PaymentRiskResponse;
import com.rental.rental_management_backend.payment.service.PaymentService;
import com.rental.rental_management_backend.rental.repository.RentInvoiceRepository;

@Service
public class M4PaymentRiskService {

    private final M4PaymentRiskAggregationService aggregationService;

    private final M4PaymentRiskClient paymentRiskClient;

    private final PaymentService paymentService;

    private final UserRepository userRepository;

    private final RentInvoiceRepository rentInvoiceRepository;

    public M4PaymentRiskService(

            M4PaymentRiskAggregationService aggregationService,

            M4PaymentRiskClient paymentRiskClient,

            PaymentService paymentService,

            UserRepository userRepository,

            RentInvoiceRepository rentInvoiceRepository) {

        this.aggregationService =
                aggregationService;

        this.paymentRiskClient =
                paymentRiskClient;

        this.paymentService =
                paymentService;

        this.userRepository =
                userRepository;

        this.rentInvoiceRepository =
                rentInvoiceRepository;
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

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AccessDeniedException(
                        "You do not have permission to view this payment-risk prediction"));

        /*
         * Preserve the existing payment-access validation, then separately
         * verify invoice history so authorization does not depend on payments.
         */
        paymentService.getPaymentsByTenant(
                tenantId,
                email);

        boolean authorized = switch (user.getRole()) {
            case SUPER_ADMIN -> true;
            case PROPERTY_OWNER ->
                    rentInvoiceRepository
                            .existsPaymentRiskInvoiceForTenantAndOwner(
                                    tenantId,
                                    user.getId());
            case PROPERTY_MANAGER ->
                    rentInvoiceRepository
                            .existsPaymentRiskInvoiceForTenantAndManager(
                                    tenantId,
                                    user.getId());
            case TENANT -> false;
        };

        if (!authorized) {
            throw new AccessDeniedException(
                    "You do not have permission to view this payment-risk prediction");
        }

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
