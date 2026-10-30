
package com.rental.rental_management_backend.ai.service;

import java.time.LocalDate;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.ai.client.M4PaymentRiskClient;
import com.rental.rental_management_backend.ai.dto.M4PaymentRiskRequest;
import com.rental.rental_management_backend.ai.dto.M4PaymentRiskResponse;
import com.rental.rental_management_backend.rental.enums.AgreementStatus;
import com.rental.rental_management_backend.rental.repository.RentalAgreementRepository;

@Service
public class M4PaymentRiskService {

    private final M4PaymentRiskAggregationService aggregationService;

    private final M4PaymentRiskClient paymentRiskClient;

    private final UserRepository userRepository;

    private final RentalAgreementRepository rentalAgreementRepository;

    public M4PaymentRiskService(

            M4PaymentRiskAggregationService aggregationService,

            M4PaymentRiskClient paymentRiskClient,

            UserRepository userRepository,

            RentalAgreementRepository rentalAgreementRepository) {

        this.aggregationService =
                aggregationService;

        this.paymentRiskClient =
                paymentRiskClient;

        this.userRepository =
                userRepository;

        this.rentalAgreementRepository =
                rentalAgreementRepository;
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

        validatePaymentRiskTenantAccess(tenantId, email);

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

    private void validatePaymentRiskTenantAccess(
            Long tenantId,
            String email) {
        User user = userRepository.findByEmail(email.trim())
                .orElseThrow(() -> new AccessDeniedException(
                        "You are not authorized to view payment risk for this tenant"));

        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return;
        }

        LocalDate asOfDate = LocalDate.now();
        long qualifyingAgreements;

        if (user.getRole() == RoleType.PROPERTY_OWNER) {
            qualifyingAgreements =
                    rentalAgreementRepository
                            .countQualifyingAgreementsForTenantAndOwner(
                                    tenantId,
                                    user.getId(),
                                    AgreementStatus.DRAFT,
                                    asOfDate);
        } else if (user.getRole() == RoleType.PROPERTY_MANAGER) {
            qualifyingAgreements =
                    rentalAgreementRepository
                            .countQualifyingAgreementsForTenantAndManager(
                                    tenantId,
                                    user.getId(),
                                    AgreementStatus.DRAFT,
                                    asOfDate);
        } else {
            throw new AccessDeniedException(
                    "You are not authorized to view payment risk for this tenant");
        }

        if (qualifyingAgreements == 0) {
            throw new AccessDeniedException(
                    "You are not authorized to view payment risk for this tenant");
        }
    }
}
