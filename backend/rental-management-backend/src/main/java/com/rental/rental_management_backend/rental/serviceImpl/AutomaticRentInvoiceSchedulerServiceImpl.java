package com.rental.rental_management_backend.rental.serviceImpl;

import java.sql.SQLException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.rental.rental_management_backend.rental.entity.RentalAgreement;
import com.rental.rental_management_backend.rental.enums.AgreementStatus;
import com.rental.rental_management_backend.rental.repository.RentalAgreementRepository;
import com.rental.rental_management_backend.rental.service.AutomaticRentInvoiceSchedulerService;
import com.rental.rental_management_backend.rental.service.RentInvoiceService;

@Service
public class AutomaticRentInvoiceSchedulerServiceImpl
        implements AutomaticRentInvoiceSchedulerService {

    private static final Logger logger =
            LoggerFactory.getLogger(
                    AutomaticRentInvoiceSchedulerServiceImpl.class);

    private static final ZoneId SCHEDULER_ZONE =
            ZoneId.of("Asia/Kolkata");

    private final RentalAgreementRepository rentalAgreementRepository;
    private final RentInvoiceService rentInvoiceService;

    public AutomaticRentInvoiceSchedulerServiceImpl(
            RentalAgreementRepository rentalAgreementRepository,
            RentInvoiceService rentInvoiceService) {
        this.rentalAgreementRepository = rentalAgreementRepository;
        this.rentInvoiceService = rentInvoiceService;
    }

    @Override
@Scheduled(cron = "0 0 1 * * *", zone = "Asia/Kolkata")
    public void generateMonthlyInvoices() {
        LocalDate today = LocalDate.now(SCHEDULER_ZONE);
        YearMonth currentPeriod = YearMonth.from(today);

        List<RentalAgreement> activeAgreements =
                rentalAgreementRepository.findByStatus(
                        AgreementStatus.ACTIVE);

        logger.info(
                "Automatic rent invoice generation started; active agreements found: {}",
                activeAgreements.size());

        for (RentalAgreement agreement : activeAgreements) {
            Long agreementId = agreement.getAgreementId();
            if (agreementId == null) {
                logger.warn(
                        "Skipping automatic invoice generation for an agreement without an ID");
                continue;
            }

            for (YearMonth billingPeriod : List.of(
                    currentPeriod,
                    currentPeriod.plusMonths(1))) {
                try {
                    Optional<Long> invoiceId =
                            rentInvoiceService.createScheduledInvoice(
                                    agreementId,
                                    billingPeriod,
                                    today);

                    if (invoiceId.isPresent()) {
                        logger.info(
                                "Generated rent invoice {} for agreement {} and billing period {}",
                                invoiceId.get(),
                                agreementId,
                                billingPeriod);
                    } else {
                        logger.debug(
                                "Skipped rent invoice for agreement {} and billing period {}",
                                agreementId,
                                billingPeriod);
                    }
                } catch (RuntimeException exception) {
                    if (isUniqueConstraintViolation(exception)) {
                        logger.info(
                                "Skipped rent invoice already generated concurrently for agreement {} and billing period {}",
                                agreementId,
                                billingPeriod);
                    } else {
                        logger.error(
                                "Automatic rent invoice generation failed for agreement {} and billing period {} ({})",
                                agreementId,
                                billingPeriod,
                                exception.getClass().getSimpleName());
                    }
                }
            }
        }
    }

    private boolean isUniqueConstraintViolation(Throwable exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof SQLException sqlException
                    && "23505".equals(sqlException.getSQLState())) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
