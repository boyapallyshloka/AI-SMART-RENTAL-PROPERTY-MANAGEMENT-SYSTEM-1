
package com.rental.rental_management_backend.rental.serviceImpl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.User.serviceImpl.UserAuthEmailDispatcher;
import com.rental.rental_management_backend.email.EmailService;
import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.service.NotificationService;
import com.rental.rental_management_backend.payment.enums.PaymentStatus;
import com.rental.rental_management_backend.payment.repository.PaymentRepository;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.rental.dto.RentInvoiceLateFeeRequest;
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

    private static final Logger logger =
            LoggerFactory.getLogger(RentInvoiceServiceImpl.class);

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
    @Transactional
    public RentInvoiceResponse createInvoice(
            RentInvoiceRequest request) {

        User user = getAuthenticatedUser();

        // -----------------------------------------------------
        // 1. Find rental agreement
        // -----------------------------------------------------

        RentalAgreement agreement =
                rentalAgreementRepository
                        .findByIdForInvoiceCreation(request.getAgreementId())
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Rental agreement not found"
                                )
                        );

        if (!hasPropertyAccess(agreement, user)) {
            throw new RuntimeException("Rental agreement not found");
        }

        // -----------------------------------------------------
        // 2. Agreement must be ACTIVE
        // -----------------------------------------------------

        if (agreement.getStatus()
                != AgreementStatus.ACTIVE) {

            throw new RuntimeException(
                    "Invoice can only be created for an ACTIVE rental agreement"
            );
        }

        BillingPeriod billingPeriod = getNextBillingPeriod(agreement);
        return createInvoiceForAgreement(
                agreement,
                billingPeriod,
                LocalDate.now(),
                false);
    }

    @Override
    @Transactional
    public RentInvoiceResponse updateLateFee(
            Long invoiceId,
            RentInvoiceLateFeeRequest request) {

        User user = getAuthenticatedUser();
        if (user.getRole() != RoleType.PROPERTY_OWNER
                && user.getRole() != RoleType.PROPERTY_MANAGER
                && user.getRole() != RoleType.SUPER_ADMIN) {
            throw new AccessDeniedException(
                    "You are not authorized to update invoice late fees");
        }

        RentInvoice invoice = rentInvoiceRepository
                .findByIdForUpdate(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Invoice not found"));

        if (!hasPropertyAccess(invoice.getRentalAgreement(), user)) {
            throw new ResourceNotFoundException("Invoice not found");
        }

        if (invoice.getStatus() == InvoiceStatus.PAID) {
            throw new IllegalArgumentException(
                    "Late fee cannot be changed for a paid invoice");
        }

        invoice.setLateFee(request.getLateFee());
        invoice.setTotalAmount(
                invoice.getRentAmount().add(request.getLateFee()));
        rentInvoiceRepository.saveAndFlush(invoice);

        try {
            String updatedInvoiceDocument =
                    rentInvoicePdfService.generateInvoicePdf(invoice);
            if (updatedInvoiceDocument == null
                    || updatedInvoiceDocument.isBlank()) {
                logger.error(
                        "Invoice PDF regeneration returned an empty document reference "
                                + "for invoice {}. Financial changes were saved; "
                                + "the existing invoice document was retained.",
                        invoiceId);
            } else {
                invoice.setInvoiceDocument(updatedInvoiceDocument);
                rentInvoiceRepository.save(invoice);
            }
        } catch (RuntimeException exception) {
            logger.error(
                    "Failed to regenerate PDF for invoice {} after manual late-fee update. "
                            + "Financial changes were saved; the existing invoice document was retained.",
                    invoiceId,
                    exception);
        }

        return mapToResponse(invoice);
    }

    @Override
    @Transactional
    public void generateScheduledInvoice(Long agreementId, LocalDate today) {
        RentalAgreement agreement = rentalAgreementRepository
                .findByIdForInvoiceCreation(agreementId)
                .orElseThrow(() -> new IllegalStateException(
                        "Rental agreement not found: " + agreementId));
        if (agreement.getStatus() != AgreementStatus.ACTIVE) {
            logger.info("Skipping invoice generation for inactive agreement {}", agreementId);
            return;
        }

        BillingPeriod billingPeriod = getNextBillingPeriod(agreement);
        int billingMonth = billingPeriod.billingDate().getMonthValue();
        int billingYear = billingPeriod.billingDate().getYear();

        LocalDate billingPeriodStart = billingPeriod.billingDate();
        LocalDate billingPeriodEnd = billingPeriodStart.withDayOfMonth(
                billingPeriodStart.lengthOfMonth());
        if (billingPeriodEnd.isBefore(agreement.getStartDate())
                || billingPeriodStart.isAfter(agreement.getEndDate())
                || today.isBefore(agreement.getStartDate())
                || today.isAfter(agreement.getEndDate())) {
            logger.info(
                    "Skipping invoice generation for agreement {} billing {}/{}: outside agreement period",
                    agreementId,
                    billingMonth,
                    billingYear);
            return;
        }

        LocalDate generationDate = billingPeriod.dueDate().minusDays(7);
        if (today.isBefore(generationDate)) {
            logger.info(
                    "Skipping invoice generation for agreement {} billing {}/{}: eligible on {}",
                    agreementId,
                    billingMonth,
                    billingYear,
                    generationDate);
            return;
        }

        if (rentInvoiceRepository
                .findByRentalAgreement_AgreementIdAndBillingMonthAndBillingYear(
                        agreementId,
                        billingMonth,
                        billingYear)
                .isPresent()) {
            logger.info(
                    "Skipping invoice generation for agreement {} billing {}/{}: invoice already exists",
                    agreementId,
                    billingMonth,
                    billingYear);
            return;
        }

        try {
            RentInvoiceResponse createdInvoice = createInvoiceForAgreement(
                    agreement,
                    billingPeriod,
                    today,
                    true);
            if (createdInvoice == null) {
                logger.info(
                        "Skipping invoice generation for agreement {} billing {}/{}: invoice already exists",
                        agreementId,
                        billingMonth,
                        billingYear);
                return;
            }
            logger.info(
                    "Created rent invoice for agreement {} billing {}/{}",
                    agreementId,
                    billingMonth,
                    billingYear);
        } catch (RuntimeException exception) {
            logger.error(
                    "Failed to create rent invoice for agreement {} billing {}/{}",
                    agreementId,
                    billingMonth,
                    billingYear,
                    exception);
            throw exception;
        }
    }

    private RentInvoiceResponse createInvoiceForAgreement(
            RentalAgreement agreement,
            BillingPeriod billingPeriod,
            LocalDate invoiceDate,
            boolean preserveInvoiceOnPdfFailure) {
        int billingMonth = billingPeriod.billingDate().getMonthValue();
        int billingYear = billingPeriod.billingDate().getYear();

        if (rentInvoiceRepository
                .findByRentalAgreement_AgreementIdAndBillingMonthAndBillingYear(
                        agreement.getAgreementId(),
                        billingMonth,
                        billingYear)
                .isPresent()) {
            if (preserveInvoiceOnPdfFailure) {
                return null;
            }
            throw new RuntimeException(
                    "Invoice already exists for " + billingMonth + "/" + billingYear);
        }

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

        invoice.setInvoiceDate(invoiceDate);

        invoice.setDueDate(
                billingPeriod.dueDate()
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

        String invoiceDocument;
        try {
            invoiceDocument = rentInvoicePdfService.generateInvoicePdf(invoice);
        } catch (RuntimeException exception) {
            if (!preserveInvoiceOnPdfFailure) {
                throw exception;
            }
            logger.error(
                    "Failed to generate PDF for scheduled rent invoice {}. "
                            + "Invoice financial data will be retained.",
                    invoice.getInvoiceId(),
                    exception);
            invoiceDocument = null;
        }

        if (invoiceDocument != null && !invoiceDocument.isBlank()) {
            invoice.setInvoiceDocument(invoiceDocument);
        } else if (preserveInvoiceOnPdfFailure) {
            logger.error(
                    "Invoice PDF generation returned an empty document for scheduled rent invoice {}. "
                            + "Invoice financial data will be retained.",
                    invoice.getInvoiceId());
        } else {
            invoice.setInvoiceDocument(invoiceDocument);
        }
        invoice = rentInvoiceRepository.save(invoice);

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

    private BillingPeriod getNextBillingPeriod(RentalAgreement agreement) {
        LocalDate billingDate = getNextBillingDate(agreement);
        int dueDay = agreement.getDueDay();
        int lastDayOfMonth = billingDate.lengthOfMonth();
        if (dueDay > lastDayOfMonth) {
            dueDay = lastDayOfMonth;
        }
        LocalDate dueDate = LocalDate.of(
                billingDate.getYear(),
                billingDate.getMonthValue(),
                dueDay);
        return new BillingPeriod(billingDate, dueDate);
    }

    private record BillingPeriod(LocalDate billingDate, LocalDate dueDate) {
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
    @Transactional(readOnly = true)
    public RentInvoiceResponse getInvoiceById(
            Long invoiceId) {

        User user = getAuthenticatedUser();
        RentInvoice invoice =
                rentInvoiceRepository
                        .findById(invoiceId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Invoice not found"
                                )
                        );

        if (!hasInvoiceAccess(invoice, user)) {
            throw new RuntimeException("Invoice not found");
        }

        return mapToResponse(
                invoice
        );
    }

    // =========================================================
    // GET ALL INVOICES
    // =========================================================

    @Override
    public List<RentInvoiceResponse> getAllInvoices() {

        User user = getAuthenticatedUser();
        List<RentInvoice> invoices = switch (user.getRole()) {
            case SUPER_ADMIN -> rentInvoiceRepository.findAll();
            case PROPERTY_OWNER ->
                    rentInvoiceRepository.findAllForPropertyOwner(user.getId());
            case PROPERTY_MANAGER ->
                    rentInvoiceRepository.findAllForPropertyManager(user.getId());
            default -> throw new AccessDeniedException(
                    "You are not authorized to access invoices");
        };

        return mapInvoicesToResponses(invoices);
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

    private User getAuthenticatedUser() {
        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new AccessDeniedException(
                    "Authenticated user is required");
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new AccessDeniedException(
                        "Authenticated user is not authorized"));
    }

    private boolean hasInvoiceAccess(RentInvoice invoice, User user) {
        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return true;
        }
        if (user.getRole() == RoleType.TENANT) {
            return invoice.getTenantId() != null
                    && tenantRepository.findByUser_Id(user.getId())
                            .map(Tenant::getTenantId)
                            .filter(invoice.getTenantId()::equals)
                            .isPresent();
        }

        return hasPropertyAccess(
                invoice.getRentalAgreement(),
                user);
    }

    private boolean hasPropertyAccess(
            RentalAgreement agreement,
            User user) {
        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return true;
        }

        Property property = resolveAgreementProperty(agreement);
        if (property == null) {
            return false;
        }

        if (user.getRole() == RoleType.PROPERTY_OWNER) {
            return property.getOwner() != null
                    && user.getId().equals(property.getOwner().getId());
        }
        if (user.getRole() == RoleType.PROPERTY_MANAGER) {
            return property.getPropertyManager() != null
                    && property.getPropertyManager().getUser() != null
                    && user.getId().equals(
                            property.getPropertyManager().getUser().getId());
        }
        return false;
    }

    private Property resolveAgreementProperty(RentalAgreement agreement) {
        if (agreement == null) {
            return null;
        }
        if (agreement.getProperty() != null) {
            return agreement.getProperty();
        }
        if (agreement.getRentalApplication() != null) {
            if (agreement.getRentalApplication().getProperty() != null) {
                return agreement.getRentalApplication().getProperty();
            }
            Property applicationUnitProperty = resolveUnitProperty(
                    agreement.getRentalApplication().getUnit());
            if (applicationUnitProperty != null) {
                return applicationUnitProperty;
            }
        }
        return resolveUnitProperty(agreement.getUnit());
    }

    private Property resolveUnitProperty(Unit unit) {
        if (unit == null
                || unit.getFloor() == null
                || unit.getFloor().getBuilding() == null) {
            return null;
        }
        return unit.getFloor().getBuilding().getProperty();
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

        if (invoice.getRentalAgreement().getProperty() != null) {
            response.setPropertyId(
                    invoice.getRentalAgreement().getProperty().getPropertyId());
            response.setPropertyName(
                    invoice.getRentalAgreement().getProperty().getPropertyName());
        }

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
