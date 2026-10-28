package com.rental.rental_management_backend.rental.serviceImpl;

import java.time.LocalDate;
import java.util.List;

import org.hibernate.exception.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.rental.rental_management_backend.rental.entity.RentalAgreement;
import com.rental.rental_management_backend.rental.repository.RentalAgreementRepository;
import com.rental.rental_management_backend.rental.service.RentInvoiceLateFeeCalculator;
import com.rental.rental_management_backend.rental.service.RentInvoiceService;

@Service
public class RentInvoiceGenerationSchedulerService {

    private static final String BILLING_PERIOD_CONSTRAINT =
            "uk_rent_invoice_agreement_billing_period";

    private static final Logger logger =
            LoggerFactory.getLogger(RentInvoiceGenerationSchedulerService.class);

    private final RentalAgreementRepository rentalAgreementRepository;
    private final RentInvoiceService rentInvoiceService;

    public RentInvoiceGenerationSchedulerService(
            RentalAgreementRepository rentalAgreementRepository,
            RentInvoiceService rentInvoiceService) {
        this.rentalAgreementRepository = rentalAgreementRepository;
        this.rentInvoiceService = rentInvoiceService;
    }

    @Scheduled(cron = "0 0 10 * * *", zone = "Asia/Kolkata")
    public void generateMonthlyRentInvoices() {
        LocalDate today = RentInvoiceLateFeeCalculator.currentDate();
        List<Long> agreementIds = rentalAgreementRepository.findAll()
                .stream()
                .map(RentalAgreement::getAgreementId)
                .toList();

        for (Long agreementId : agreementIds) {
            try {
                rentInvoiceService.generateScheduledInvoice(
                        agreementId,
                        today);
            } catch (RuntimeException exception) {
                if (isBillingPeriodDuplicate(exception)) {
                    logger.info(
                            "Skipping scheduled rent invoice for agreement {}: billing period already exists",
                            agreementId);
                } else {
                    logger.error(
                            "Scheduled rent invoice generation failed for agreement {}",
                            agreementId,
                            exception);
                }
            }
        }
    }

    private boolean isBillingPeriodDuplicate(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException constraintViolation
                    && BILLING_PERIOD_CONSTRAINT.equals(
                            constraintViolation.getConstraintName())) {
                return true;
            }
        }
        return false;
    }
}
