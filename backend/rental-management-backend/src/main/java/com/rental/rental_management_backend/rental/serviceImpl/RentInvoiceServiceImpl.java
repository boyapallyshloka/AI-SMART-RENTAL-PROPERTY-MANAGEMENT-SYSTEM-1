
package com.rental.rental_management_backend.rental.serviceImpl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.User.serviceImpl.UserAuthEmailDispatcher;
import com.rental.rental_management_backend.email.EmailService;
import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.service.NotificationService;
import com.rental.rental_management_backend.payment.enums.PaymentStatus;
import com.rental.rental_management_backend.payment.repository.PaymentRepository;
import com.rental.rental_management_backend.rental.dto.RentInvoiceRequest;
import com.rental.rental_management_backend.rental.dto.RentInvoiceResponse;
import com.rental.rental_management_backend.rental.entity.RentInvoice;
import com.rental.rental_management_backend.rental.entity.RentalAgreement;
import com.rental.rental_management_backend.rental.enums.AgreementStatus;
import com.rental.rental_management_backend.rental.enums.InvoiceStatus;
import com.rental.rental_management_backend.rental.repository.RentInvoiceRepository;
import com.rental.rental_management_backend.rental.repository.RentalAgreementRepository;
import com.rental.rental_management_backend.rental.service.RentInvoicePdfService;
import com.rental.rental_management_backend.rental.service.RentInvoiceService;
import com.rental.rental_management_backend.s3.service.S3Service;
import com.rental.rental_management_backend.tenant.entity.Tenant;
import com.rental.rental_management_backend.tenant.repository.TenantRepository;

@Service
public class RentInvoiceServiceImpl implements RentInvoiceService {

    private final RentInvoiceRepository rentInvoiceRepository;

    private final RentalAgreementRepository rentalAgreementRepository;

    private final UserRepository userRepository;

    private final RentInvoicePdfService rentInvoicePdfService;

    private final TenantRepository tenantRepository;

    private final PaymentRepository paymentRepository;

    private final S3Service s3Service;

    private final NotificationService notificationService;

    private final EmailService emailService;

    private final UserAuthEmailDispatcher userAuthEmailDispatcher;

    public RentInvoiceServiceImpl(

            RentInvoiceRepository rentInvoiceRepository,

            RentalAgreementRepository rentalAgreementRepository,

            UserRepository userRepository,

            RentInvoicePdfService rentInvoicePdfService,

            TenantRepository tenantRepository,

            PaymentRepository paymentRepository,

            S3Service s3Service,

            NotificationService notificationService,

            EmailService emailService,

            UserAuthEmailDispatcher userAuthEmailDispatcher) {

        this.rentInvoiceRepository =
                rentInvoiceRepository;

        this.rentalAgreementRepository =
                rentalAgreementRepository;

        this.userRepository =
                userRepository;

        this.rentInvoicePdfService =
                rentInvoicePdfService;

        this.tenantRepository =
                tenantRepository;

        this.paymentRepository =
                paymentRepository;

        this.s3Service =
                s3Service;

        this.notificationService =
                notificationService;

        this.emailService =
                emailService;

        this.userAuthEmailDispatcher =
                userAuthEmailDispatcher;
    }

    // =========================================================
    // CREATE INVOICE
    // =========================================================

    @Override
    public RentInvoiceResponse createInvoice(
            RentInvoiceRequest request) {

        // -----------------------------------------------------
        // 1. Find rental agreement
        // -----------------------------------------------------

        RentalAgreement agreement =
                rentalAgreementRepository
                        .findById(request.getAgreementId())
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Rental agreement not found"
                                )
                        );

        // -----------------------------------------------------
        // 2. Agreement must be ACTIVE
        // -----------------------------------------------------

        if (agreement.getStatus()
                != AgreementStatus.ACTIVE) {

            throw new RuntimeException(
                    "Invoice can only be created for an ACTIVE rental agreement"
            );
        }

        // -----------------------------------------------------
        // 3. Determine next billing month
        // -----------------------------------------------------

        LocalDate billingDate =
                getNextBillingDate(agreement);

        int billingMonth =
                billingDate.getMonthValue();

        int billingYear =
                billingDate.getYear();

        // -----------------------------------------------------
        // 4. Prevent duplicate invoice
        // -----------------------------------------------------

        if (rentInvoiceRepository
                .findByRentalAgreement_AgreementIdAndBillingMonthAndBillingYear(
                        agreement.getAgreementId(),
                        billingMonth,
                        billingYear
                )
                .isPresent()) {

            throw new RuntimeException(
                    "Invoice already exists for "
                            + billingMonth
                            + "/"
                            + billingYear
            );
        }

        // -----------------------------------------------------
        // 5. Create invoice entity
        // -----------------------------------------------------

        RentInvoice invoice =
                new RentInvoice();

        invoice.setRentalAgreement(
                agreement
        );

        invoice.setTenantId(
                agreement
                        .getTenant()
                        .getTenantId()
        );

        invoice.setUnitId(
                agreement.getUnit() == null
                        ? null
                        : agreement.getUnit().getUnitId());

        invoice.setBillingMonth(
                billingMonth
        );

        invoice.setBillingYear(
                billingYear
        );

        invoice.setInvoiceDate(
                LocalDate.now()
        );

        // -----------------------------------------------------
        // 6. Calculate due date
        // -----------------------------------------------------

        int dueDay =
                agreement.getDueDay();

        LocalDate dueDate;

        int lastDayOfMonth =
                billingDate.lengthOfMonth();

        if (dueDay > lastDayOfMonth) {

            dueDay = lastDayOfMonth;
        }

        dueDate =
                LocalDate.of(
                        billingYear,
                        billingMonth,
                        dueDay
                );

        invoice.setDueDate(
                dueDate
        );

        // -----------------------------------------------------
        // 7. Rent amount
        // -----------------------------------------------------

        BigDecimal rentAmount =
                agreement.getMonthlyRent();

        invoice.setRentAmount(
                rentAmount
        );

        // -----------------------------------------------------
        // 8. Initial late fee
        // -----------------------------------------------------

        invoice.setLateFee(
                BigDecimal.ZERO
        );

        // -----------------------------------------------------
        // 9. Total amount
        // -----------------------------------------------------

        invoice.setTotalAmount(
                rentAmount.add(
                        BigDecimal.ZERO
                )
        );

        // -----------------------------------------------------
        // 10. Invoice status
        // -----------------------------------------------------

        invoice.setStatus(
                InvoiceStatus.PENDING
        );

        // -----------------------------------------------------
        // 11. Temporary invoice number
        // -----------------------------------------------------

        invoice.setInvoiceNumber(
                "TEMP-"
                        + System.currentTimeMillis()
        );

        // -----------------------------------------------------
        // 12. Save invoice first
        //     This generates invoiceId
        // -----------------------------------------------------

        invoice =
                rentInvoiceRepository.save(
                        invoice
                );

        // -----------------------------------------------------
        // 13. Generate final invoice number
        // -----------------------------------------------------

        invoice.setInvoiceNumber(
                String.format(
                        "INV-%d-%05d",
                        billingYear,
                        invoice.getInvoiceId()
                )
        );

        // -----------------------------------------------------
        // 14. Generate PDF
        // -----------------------------------------------------

        String invoiceDocument =
                rentInvoicePdfService
                        .generateInvoicePdf(
                                invoice
                        );

        invoice.setInvoiceDocument(
                invoiceDocument
        );

        // -----------------------------------------------------
        // 15. Save final invoice
        // -----------------------------------------------------

        invoice =
                rentInvoiceRepository.save(
                        invoice
                );

        // -----------------------------------------------------
        // 16. Notify tenant
        // -----------------------------------------------------

        notifyTenantAboutNewInvoice(
                invoice
        );

        // -----------------------------------------------------
        // 17. Return response
        // -----------------------------------------------------

        return mapToResponse(
                invoice
        );
    }

    // =========================================================
    // NOTIFY TENANT ABOUT NEW INVOICE
    // =========================================================

    private void notifyTenantAboutNewInvoice(
            RentInvoice invoice) {

        if (invoice == null
                || invoice.getTenantId() == null) {

            return;
        }

        Tenant tenant =
                tenantRepository
                        .findById(
                                invoice.getTenantId()
                        )
                        .orElse(null);

        if (tenant == null
                || tenant.getUser() == null
                || tenant.getUser().getId() == null) {

            return;
        }

        Long tenantUserId =
                tenant.getUser().getId();

        String message =
                "Your rent invoice "
                        + invoice.getInvoiceNumber()
                        + " has been generated. "
                        + "Amount: ₹"
                        + invoice.getTotalAmount()
                        + ". Due date: "
                        + invoice.getDueDate()
                        + ".";

        notificationService.notifyUser(
                tenantUserId,
                NotificationType.RENT_DUE,
                NotificationPriority.HIGH,
                "Rent Invoice Generated",
                message,
                invoice.getInvoiceId(),
                "RENT_INVOICE"
        );

        User tenantUser = tenant.getUser();
        String recipientEmail = tenantUser.getEmail();
        if (recipientEmail != null && !recipientEmail.isBlank()) {
            String tenantName = ((tenantUser.getFirstName() == null
                    ? ""
                    : tenantUser.getFirstName())
                    + " "
                    + (tenantUser.getLastName() == null
                            ? ""
                            : tenantUser.getLastName())).trim();
            String invoiceNumber = invoice.getInvoiceNumber();
            Long invoiceId = invoice.getInvoiceId();
            Long agreementId = invoice.getRentalAgreement() == null
                    ? null
                    : invoice.getRentalAgreement().getAgreementId();
            Integer billingMonth = invoice.getBillingMonth();
            Integer billingYear = invoice.getBillingYear();
            String totalAmount = invoice.getTotalAmount() == null
                    ? "Not specified"
                    : invoice.getTotalAmount().toString();
            String dueDate = invoice.getDueDate() == null
                    ? "Not specified"
                    : invoice.getDueDate().toString();

            dispatchEmail(
                    "rent invoice generated",
                    () -> emailService.sendRentInvoiceGeneratedEmail(
                            recipientEmail,
                            tenantName,
                            invoiceNumber,
                            invoiceId,
                            agreementId,
                            billingMonth,
                            billingYear,
                            totalAmount,
                            dueDate));
        }
    }

    // =========================================================
    // GET INVOICE BY ID
    // =========================================================

    @Override
    public RentInvoiceResponse getInvoiceById(
            Long invoiceId) {

        RentInvoice invoice =
                rentInvoiceRepository
                        .findById(invoiceId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Invoice not found"
                                )
                        );

        return mapToResponse(
                invoice
        );
    }

    // =========================================================
    // GET ALL INVOICES
    // =========================================================

    @Override
    public List<RentInvoiceResponse> getAllInvoices() {

        return mapInvoicesToResponses(rentInvoiceRepository.findAll());
    }

    // =========================================================
    // GET LOGGED-IN TENANT INVOICES
    // =========================================================

    @Override
    public List<RentInvoiceResponse> getMyInvoices() {

        // -----------------------------------------------------
        // 1. Get authentication information from JWT
        // -----------------------------------------------------

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        String email =
                authentication.getName();

        Long tenantId = rentInvoiceRepository
                .findTenantIdByUserEmail(email)
                .orElseGet(() -> {
                    if (userRepository.findByEmail(email).isEmpty()) {
                        throw new RuntimeException(
                                "Logged-in user not found");
                    }
                    throw new ResourceNotFoundException(
                            "Tenant profile not found for logged-in user");
                });

        // -----------------------------------------------------
        // 2. Find invoices belonging to this tenant
        // -----------------------------------------------------

        List<RentInvoice> invoices =
                rentInvoiceRepository.findByTenantId(tenantId);

        return mapInvoicesToResponses(invoices);
    }

    // =========================================================
    // FIND NEXT BILLING DATE
    // =========================================================

    private LocalDate getNextBillingDate(
            RentalAgreement agreement) {

        // -----------------------------------------------------
        // Start with agreement start date
        // -----------------------------------------------------

        LocalDate billingDate =
                agreement
                        .getStartDate()
                        .withDayOfMonth(1);

        // -----------------------------------------------------
        // Find latest invoice for this agreement
        // -----------------------------------------------------

        RentInvoice latestInvoice = rentInvoiceRepository
                .findFirstByRentalAgreement_AgreementIdOrderByBillingYearDescBillingMonthDesc(
                        agreement.getAgreementId())
                .orElse(null);

        if (latestInvoice != null) {
            billingDate =
                    LocalDate.of(
                            latestInvoice.getBillingYear(),
                            latestInvoice.getBillingMonth(),
                            1
                    )
                    .plusMonths(1);
        }

        return billingDate;
    }

    private List<RentInvoiceResponse> mapInvoicesToResponses(
            List<RentInvoice> invoices) {

        if (invoices.isEmpty()) {
            return List.of();
        }

        List<Long> invoiceIds = invoices.stream()
                .map(RentInvoice::getInvoiceId)
                .toList();
        Map<Long, BigDecimal> paidAmounts = new HashMap<>();
        List<Long> tenantIds = invoices.stream()
                .map(RentInvoice::getTenantId)
                .filter(tenantId -> tenantId != null)
                .distinct()
                .toList();
        Map<Long, Tenant> tenantsById = new HashMap<>();

        tenantRepository.findAllById(tenantIds).forEach(tenant ->
                tenantsById.put(tenant.getTenantId(), tenant));

        rentInvoiceRepository.findPaidAmountsByInvoiceIds(
                        invoiceIds,
                        PaymentStatus.SUCCESS)
                .forEach(result -> paidAmounts.put(
                        result.getInvoiceId(),
                        result.getTotalPaid()));

        return invoices.stream()
                .map(invoice -> mapToResponse(
                        invoice,
                        paidAmounts.getOrDefault(
                                invoice.getInvoiceId(),
                                BigDecimal.ZERO),
                        tenantsById.get(invoice.getTenantId())))
                .toList();
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

    // =========================================================
    // CALCULATE SUCCESSFULLY PAID AMOUNT
    // =========================================================

    private BigDecimal getSuccessfullyPaidAmount(
            Long invoiceId) {

        return paymentRepository
                .findByInvoice_InvoiceId(invoiceId)
                .stream()
                .filter(payment ->
                        payment.getPaymentStatus()
                                == PaymentStatus.SUCCESS
                )
                .map(payment ->
                        payment.getAmount()
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    // =========================================================
    // MAP ENTITY TO RESPONSE
    // =========================================================

    private RentInvoiceResponse mapToResponse(
            RentInvoice invoice) {
        return mapToResponse(
                invoice,
                getSuccessfullyPaidAmount(invoice.getInvoiceId()));
    }

    private RentInvoiceResponse mapToResponse(
            RentInvoice invoice,
            BigDecimal totalPaid) {
        Tenant tenant = invoice.getTenantId() == null
                ? null
                : tenantRepository.findById(invoice.getTenantId()).orElse(null);
        return mapToResponse(invoice, totalPaid, tenant);
    }

    private RentInvoiceResponse mapToResponse(
            RentInvoice invoice,
            BigDecimal totalPaid,
            Tenant tenant) {

        totalPaid = totalPaid.setScale(
                2,
                RoundingMode.HALF_UP);

        RentInvoiceResponse response =
                new RentInvoiceResponse();

        response.setInvoiceId(
                invoice.getInvoiceId()
        );

        response.setInvoiceNumber(
                invoice.getInvoiceNumber()
        );

        response.setAgreementId(
                invoice
                        .getRentalAgreement()
                        .getAgreementId()
        );

        response.setTenantId(
                invoice.getTenantId()
        );

        RentalAgreement agreement = invoice.getRentalAgreement();
        if (agreement != null) {
            var property = agreement.getProperty();
            if (property == null
                    && agreement.getUnit() != null
                    && agreement.getUnit().getFloor() != null
                    && agreement.getUnit().getFloor().getBuilding() != null) {
                property = agreement.getUnit()
                        .getFloor()
                        .getBuilding()
                        .getProperty();
            }
            if (property != null) {
                response.setPropertyId(property.getPropertyId());
            }
                }

        User tenantUser = tenant == null ? null : tenant.getUser();
        if (tenantUser != null) {
            String firstName = tenantUser.getFirstName() == null
                    ? ""
                    : tenantUser.getFirstName().trim();
            String lastName = tenantUser.getLastName() == null
                    ? ""
                    : tenantUser.getLastName().trim();
            String tenantName = (firstName + " " + lastName).trim();
            response.setTenantName(tenantName.isBlank() ? null : tenantName);
            response.setTenantEmail(tenantUser.getEmail());
        }

        response.setUnitId(
                invoice.getUnitId()
        );

        response.setBillingMonth(
                invoice.getBillingMonth()
        );

        response.setBillingYear(
                invoice.getBillingYear()
        );

        response.setInvoiceDate(
                invoice.getInvoiceDate()
        );

        response.setDueDate(
                invoice.getDueDate()
        );

        response.setRentAmount(
                invoice.getRentAmount()
        );

        response.setLateFee(
                invoice.getLateFee()
        );

        response.setTotalAmount(
                invoice.getTotalAmount()
        );

        // -----------------------------------------------------
        // Calculate total successfully paid
        // -----------------------------------------------------

        response.setTotalPaid(
                totalPaid
        );

        // -----------------------------------------------------
        // Calculate remaining amount
        // -----------------------------------------------------

        BigDecimal remainingAmount =
                invoice.getTotalAmount()
                        .subtract(totalPaid)
                        .max(BigDecimal.ZERO)
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        response.setRemainingAmount(
                remainingAmount
        );

        // -----------------------------------------------------
        // Invoice document
        // -----------------------------------------------------

        String documentKey =
                invoice.getInvoiceDocument();

        if (documentKey != null
                && !documentKey.isBlank()) {

            /*
             * Backward compatibility for old
             * locally stored invoice PDFs.
             */
            if (documentKey.startsWith("/uploads/")) {

                response.setInvoiceDocument(
                        documentKey
                );

            } else {

                /*
                 * New S3 invoice document.
                 *
                 * Database:
                 * invoices/4/invoice_4_xxx.pdf
                 *
                 * Response:
                 * temporary S3 presigned URL
                 */
                response.setInvoiceDocument(
                        s3Service.generatePresignedUrl(
                                documentKey
                        )
                );
            }

        } else {

            response.setInvoiceDocument(
                    null
            );
        }

        response.setStatus(
                invoice.getStatus()
        );

        response.setCreatedAt(
                invoice.getCreatedAt()
        );

        response.setUpdatedAt(
                invoice.getUpdatedAt()
        );

        return response;
    }
}
