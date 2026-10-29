
package com.rental.rental_management_backend.rental.serviceImpl;

import java.time.LocalDate;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.rental.rental_management_backend.User.serviceImpl.UserAuthEmailDispatcher;
import com.rental.rental_management_backend.email.EmailService;
import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.service.NotificationService;
import com.rental.rental_management_backend.rental.entity.RentInvoice;
import com.rental.rental_management_backend.rental.enums.InvoiceStatus;
import com.rental.rental_management_backend.rental.repository.RentInvoiceRepository;
import com.rental.rental_management_backend.rental.service.RentNotificationSchedulerService;
import com.rental.rental_management_backend.tenant.entity.Tenant;
import com.rental.rental_management_backend.tenant.repository.TenantRepository;

@Service
public class RentNotificationSchedulerServiceImpl
        implements RentNotificationSchedulerService {

    private final RentInvoiceRepository rentInvoiceRepository;

    private final TenantRepository tenantRepository;

    private final NotificationService notificationService;

    private final EmailService emailService;

    private final UserAuthEmailDispatcher userAuthEmailDispatcher;

    public RentNotificationSchedulerServiceImpl(
            RentInvoiceRepository rentInvoiceRepository,
            TenantRepository tenantRepository,
            NotificationService notificationService,
            EmailService emailService,
            UserAuthEmailDispatcher userAuthEmailDispatcher) {

        this.rentInvoiceRepository =
                rentInvoiceRepository;

        this.tenantRepository =
                tenantRepository;

        this.notificationService =
                notificationService;

        this.emailService =
                emailService;

        this.userAuthEmailDispatcher =
                userAuthEmailDispatcher;
    }

    // =========================================================
    // DAILY RENT NOTIFICATION CHECK
    // =========================================================
    //
    // Runs every day at 9:00 AM India time.
    //
    // 0 seconds
    // 0 minutes
    // 9 hours
    // every day
    //
    // =========================================================

    @Override
    @Scheduled(
            cron = "0 0 9 * * *",
            zone = "Asia/Kolkata"
    )
    @Transactional
    public void processRentNotifications() {

        LocalDate today = LocalDate.now();

        List<RentInvoice> invoices =
                rentInvoiceRepository.findAll();

        for (RentInvoice invoice : invoices) {

            if (invoice == null) {
                continue;
            }

            // -------------------------------------------------
            // Ignore PAID invoices
            // -------------------------------------------------

            if (invoice.getStatus() == InvoiceStatus.PAID) {
                continue;
            }

            // -------------------------------------------------
            // Ignore CANCELLED invoices
            // -------------------------------------------------

            if (invoice.getStatus() == InvoiceStatus.CANCELLED) {
                continue;
            }

            if (invoice.getDueDate() == null) {
                continue;
            }

            // -------------------------------------------------
            // CASE 1:
            // Due date is TODAY
            // -------------------------------------------------

            if (invoice.getDueDate().isEqual(today)) {

                notifyRentDue(invoice);

                continue;
            }

            // -------------------------------------------------
            // CASE 2:
            // Due date has already passed
            // -------------------------------------------------

            if (invoice.getDueDate().isBefore(today)) {

                processOverdueInvoice(invoice);
            }
        }
    }

    // =========================================================
    // RENT DUE NOTIFICATION
    // =========================================================

    private void notifyRentDue(
            RentInvoice invoice) {

        Long tenantId =
                invoice.getTenantId();

        if (tenantId == null) {
            return;
        }

        Tenant tenant =
                tenantRepository
                        .findById(tenantId)
                        .orElse(null);

        if (tenant == null) {
            return;
        }

        if (tenant.getUser() == null) {
            return;
        }

        Long tenantUserId =
                tenant.getUser().getId();

        if (tenantUserId == null) {
            return;
        }

        String message =
                "Your rent payment of ₹"
                        + invoice.getTotalAmount()
                        + " is due today for invoice "
                        + invoice.getInvoiceNumber()
                        + ".";

        notificationService.notifyUser(
                tenantUserId,
                NotificationType.RENT_DUE,
                NotificationPriority.HIGH,
                "Rent Payment Due",
                message,
                invoice.getInvoiceId(),
                "RENT_INVOICE"
        );
    }

    // =========================================================
    // PROCESS OVERDUE INVOICE
    // =========================================================

    private void processOverdueInvoice(
            RentInvoice invoice) {

        // -----------------------------------------------------
        // If already OVERDUE, don't send another notification.
        // -----------------------------------------------------

        if (invoice.getStatus() == InvoiceStatus.OVERDUE) {
            return;
        }

        // -----------------------------------------------------
        // Only PENDING and PARTIALLY_PAID invoices
        // can become OVERDUE.
        // -----------------------------------------------------

        if (invoice.getStatus() != InvoiceStatus.PENDING
                && invoice.getStatus()
                        != InvoiceStatus.PARTIALLY_PAID) {

            return;
        }

        // -----------------------------------------------------
        // Change invoice status
        // -----------------------------------------------------

        invoice.setStatus(
                InvoiceStatus.OVERDUE
        );

        rentInvoiceRepository.save(
                invoice
        );

        // -----------------------------------------------------
        // Send overdue notification
        // -----------------------------------------------------

        notifyRentOverdue(invoice);
    }

    // =========================================================
    // RENT OVERDUE NOTIFICATION
    // =========================================================

    private void notifyRentOverdue(
            RentInvoice invoice) {

        Long tenantId =
                invoice.getTenantId();

        if (tenantId == null) {
            return;
        }

        Tenant tenant =
                tenantRepository
                        .findById(tenantId)
                        .orElse(null);

        if (tenant == null) {
            return;
        }

        if (tenant.getUser() == null) {
            return;
        }

        Long tenantUserId =
                tenant.getUser().getId();

        if (tenantUserId == null) {
            return;
        }

        String message =
                "Your rent payment of ₹"
                        + invoice.getTotalAmount()
                        + " for invoice "
                        + invoice.getInvoiceNumber()
                        + " is overdue. "
                        + "Please make the payment as soon as possible.";

        notificationService.notifyUser(
                tenantUserId,
                NotificationType.RENT_OVERDUE,
                NotificationPriority.HIGH,
                "Rent Payment Overdue",
                message,
                invoice.getInvoiceId(),
                "RENT_INVOICE"
        );

        String recipientEmail = tenant.getUser().getEmail();
        if (recipientEmail != null && !recipientEmail.isBlank()) {
            String tenantName = ((tenant.getUser().getFirstName() == null
                    ? ""
                    : tenant.getUser().getFirstName())
                    + " "
                    + (tenant.getUser().getLastName() == null
                            ? ""
                            : tenant.getUser().getLastName())).trim();
            String invoiceNumber = invoice.getInvoiceNumber();
            Long invoiceId = invoice.getInvoiceId();
            String totalAmount = invoice.getTotalAmount() == null
                    ? "Not specified"
                    : invoice.getTotalAmount().toString();
            String dueDate = invoice.getDueDate() == null
                    ? "Not specified"
                    : invoice.getDueDate().toString();

            dispatchEmail(
                    "rent invoice overdue",
                    () -> emailService.sendRentInvoiceOverdueEmail(
                            recipientEmail,
                            tenantName,
                            invoiceNumber,
                            invoiceId,
                            totalAmount,
                            dueDate));
        }
    }

    private void dispatchEmail(String notificationType, Runnable sendEmail) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            userAuthEmailDispatcher.dispatch(notificationType, sendEmail);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        userAuthEmailDispatcher.dispatch(
                                notificationType,
                                sendEmail);
                    }
                });
    }
}
