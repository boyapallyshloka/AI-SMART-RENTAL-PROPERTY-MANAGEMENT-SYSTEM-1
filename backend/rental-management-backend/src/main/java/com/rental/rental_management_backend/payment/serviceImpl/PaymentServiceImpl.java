
package com.rental.rental_management_backend.payment.serviceImpl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.serviceImpl.UserAuthEmailDispatcher;
import com.rental.rental_management_backend.email.EmailService;

import com.rental.rental_management_backend.payment.dto.PaymentCreateDTO;
import com.rental.rental_management_backend.payment.dto.PaymentResponse;
import com.rental.rental_management_backend.payment.dto.RazorpayOrderRequestDTO;
import com.rental.rental_management_backend.payment.dto.RazorpayOrderResponseDTO;
import com.rental.rental_management_backend.payment.dto.RazorpayPaymentVerificationRequestDTO;
import com.rental.rental_management_backend.payment.entity.Payment;
import com.rental.rental_management_backend.payment.enums.PaymentMethod;
import com.rental.rental_management_backend.payment.enums.PaymentStatus;
import com.rental.rental_management_backend.payment.repository.PaymentRepository;
import com.rental.rental_management_backend.payment.service.PaymentService;

import com.rental.rental_management_backend.rental.entity.RentInvoice;
import com.rental.rental_management_backend.rental.enums.InvoiceStatus;
import com.rental.rental_management_backend.rental.repository.RentInvoiceRepository;

import com.rental.rental_management_backend.tenant.entity.Tenant;
import com.rental.rental_management_backend.tenant.repository.TenantRepository;

import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.repository.UnitRepository;

import com.rental.rental_management_backend.receipt.service.ReceiptService;

// Notification imports
import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.service.NotificationService;


@Service
@Transactional
public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository paymentRepository;

    private final RentInvoiceRepository rentInvoiceRepository;

    private final UserRepository userRepository;

    private final TenantRepository tenantRepository;

    private final UnitRepository unitRepository;

    private final ReceiptService receiptService;

    private final RazorpayClient razorpayClient;

    // Notification service
    private final NotificationService notificationService;

    private final EmailService emailService;

    private final UserAuthEmailDispatcher userAuthEmailDispatcher;

    @Value("${razorpay.key.id}")
    private String razorpayKeyId;

    @Value("${razorpay.key.secret}")
    private String razorpayKeySecret;


    public PaymentServiceImpl(

            PaymentRepository paymentRepository,

            RentInvoiceRepository rentInvoiceRepository,

            UserRepository userRepository,

            TenantRepository tenantRepository,

            UnitRepository unitRepository,

            ReceiptService receiptService,

            RazorpayClient razorpayClient,

            NotificationService notificationService,

            EmailService emailService,

            UserAuthEmailDispatcher userAuthEmailDispatcher) {

        this.paymentRepository = paymentRepository;

        this.rentInvoiceRepository = rentInvoiceRepository;

        this.userRepository = userRepository;

        this.tenantRepository = tenantRepository;

        this.unitRepository = unitRepository;

        this.receiptService = receiptService;

        this.razorpayClient = razorpayClient;

        this.notificationService = notificationService;

        this.emailService = emailService;

        this.userAuthEmailDispatcher = userAuthEmailDispatcher;
    }


    // ============================================================
    // EXISTING PAYMENT CREATION
    // ============================================================

    @Override
    public PaymentResponse createPayment(
            PaymentCreateDTO request,
            String email) {

        User user = getLoggedInUser(email);

        if (user.getRole() != RoleType.TENANT) {
            throw new RuntimeException(
                    "Only tenants can create payments");
        }

        Tenant tenant = tenantRepository
                .findByUser_Id(user.getId())
                .orElseThrow(() ->
                        new RuntimeException(
                                "Tenant profile not found"));

        RentInvoice invoice = rentInvoiceRepository
                .findById(request.getInvoiceId())
                .orElseThrow(() ->
                        new RuntimeException(
                                "Rent invoice not found"));

        if (!invoice.getTenantId().equals(
                tenant.getTenantId())) {

            throw new RuntimeException(
                    "You are not authorized to pay this invoice");
        }

        if (invoice.getStatus() == InvoiceStatus.PAID) {
            throw new RuntimeException(
                    "Invoice is already fully paid");
        }

        if (invoice.getStatus() == InvoiceStatus.CANCELLED) {
            throw new RuntimeException(
                    "Cancelled invoice cannot be paid");
        }

        BigDecimal alreadyPaid =
                getSuccessfullyPaidAmount(
                        invoice.getInvoiceId());

        BigDecimal remainingAmount =
                invoice.getTotalAmount()
                        .subtract(alreadyPaid)
                        .setScale(
                                2,
                                RoundingMode.HALF_UP);

        BigDecimal requestedAmount =
                request.getAmount()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP);

        if (requestedAmount.compareTo(
                BigDecimal.ZERO) <= 0) {

            throw new RuntimeException(
                    "Payment amount must be greater than zero");
        }

        if (requestedAmount.compareTo(
                remainingAmount) > 0) {

            throw new RuntimeException(
                    "Payment amount cannot exceed remaining invoice amount");
        }

        Payment payment = new Payment();

        payment.setInvoice(invoice);

        payment.setTenantId(
                tenant.getTenantId());

        payment.setAmount(requestedAmount);

        payment.setPaymentStatus(
                PaymentStatus.PENDING);

        payment.setPaymentMethod(
                request.getPaymentMethod());

        payment.setRazorpayOrderId(null);

        payment.setRazorpayPaymentId(null);

        payment.setPaymentDate(null);

        payment.setCreatedAt(
                LocalDateTime.now());

        payment.setUpdatedAt(
                LocalDateTime.now());

        Payment savedPayment =
                paymentRepository.save(payment);

        return mapToResponse(savedPayment);
    }


    // ============================================================
    // CREATE RAZORPAY ORDER
    // ============================================================

    @Override
    public RazorpayOrderResponseDTO createRazorpayOrder(
            RazorpayOrderRequestDTO request,
            String email) {

        User user = getLoggedInUser(email);

        if (user.getRole() != RoleType.TENANT) {
            throw new RuntimeException(
                    "Only tenants can create Razorpay orders");
        }

        Tenant tenant = tenantRepository
                .findByUser_Id(user.getId())
                .orElseThrow(() ->
                        new RuntimeException(
                                "Tenant profile not found"));

        RentInvoice invoice = rentInvoiceRepository
                .findById(request.getInvoiceId())
                .orElseThrow(() ->
                        new RuntimeException(
                                "Rent invoice not found"));

        // --------------------------------------------------------
        // Tenant ownership validation
        // --------------------------------------------------------

        if (!invoice.getTenantId().equals(
                tenant.getTenantId())) {

            throw new RuntimeException(
                    "You are not authorized to pay this invoice");
        }

        // --------------------------------------------------------
        // Invoice status validation
        // --------------------------------------------------------

        if (invoice.getStatus() == InvoiceStatus.PAID) {

            throw new RuntimeException(
                    "Invoice is already fully paid");
        }

        if (invoice.getStatus() == InvoiceStatus.CANCELLED) {

            throw new RuntimeException(
                    "Cancelled invoice cannot be paid");
        }

        // --------------------------------------------------------
        // Calculate remaining invoice amount
        // --------------------------------------------------------

        BigDecimal alreadyPaid =
                getSuccessfullyPaidAmount(
                        invoice.getInvoiceId());

        BigDecimal remainingAmount =
                invoice.getTotalAmount()
                        .subtract(alreadyPaid)
                        .setScale(
                                2,
                                RoundingMode.HALF_UP);

        BigDecimal requestedAmount =
                request.getAmount()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP);

        if (requestedAmount.compareTo(
                BigDecimal.ZERO) <= 0) {

            throw new RuntimeException(
                    "Payment amount must be greater than zero");
        }

        if (requestedAmount.compareTo(
                remainingAmount) > 0) {

            throw new RuntimeException(
                    "Payment amount cannot exceed remaining invoice amount");
        }

        // --------------------------------------------------------
        // Convert INR to paise
        // --------------------------------------------------------

        long amountInPaise =
                requestedAmount
                        .movePointRight(2)
                        .longValueExact();

        try {

            // ----------------------------------------------------
            // Razorpay Order Request
            // ----------------------------------------------------

            JSONObject orderRequest =
                    new JSONObject();

            orderRequest.put(
                    "amount",
                    amountInPaise);

            orderRequest.put(
                    "currency",
                    "INR");

            String receipt =
                    "INV-"
                    + invoice.getInvoiceId()
                    + "-"
                    + System.currentTimeMillis();

            orderRequest.put(
                    "receipt",
                    receipt);

            // ----------------------------------------------------
            // Optional Razorpay notes
            // ----------------------------------------------------

            JSONObject notes =
                    new JSONObject();

            notes.put(
                    "invoice_id",
                    invoice.getInvoiceId());

            notes.put(
                    "tenant_id",
                    tenant.getTenantId());

            orderRequest.put(
                    "notes",
                    notes);

            // ----------------------------------------------------
            // Create Razorpay Order
            // ----------------------------------------------------

            Order razorpayOrder =
                    razorpayClient.orders.create(
                            orderRequest);

            String razorpayOrderId =
                    razorpayOrder.get("id");

            if (razorpayOrderId == null ||
                    razorpayOrderId.isBlank()) {

                throw new RuntimeException(
                        "Razorpay did not return an order ID");
            }

            // ----------------------------------------------------
            // Save Payment as PENDING
            // ----------------------------------------------------

            Payment payment =
                    new Payment();

            payment.setInvoice(invoice);

            payment.setTenantId(
                    tenant.getTenantId());

            payment.setAmount(
                    requestedAmount);

            payment.setPaymentStatus(
                    PaymentStatus.PENDING);

            /*
             * Razorpay Checkout determines the actual
             * payment method.
             */
            payment.setPaymentMethod(null);

            payment.setRazorpayOrderId(
                    razorpayOrderId);

            payment.setRazorpayPaymentId(
                    null);

            payment.setPaymentDate(
                    null);

            payment.setCreatedAt(
                    LocalDateTime.now());

            payment.setUpdatedAt(
                    LocalDateTime.now());

            Payment savedPayment =
                    paymentRepository.save(payment);

            // ----------------------------------------------------
            // Return data required by frontend Checkout
            // ----------------------------------------------------

            return new RazorpayOrderResponseDTO(
                    savedPayment.getPaymentId(),
                    invoice.getInvoiceId(),
                    razorpayOrderId,
                    requestedAmount,
                    "INR",
                    razorpayKeyId
            );

        } catch (RazorpayException e) {

            throw new RuntimeException(
                    "Failed to create Razorpay order: "
                            + e.getMessage(),
                    e);
        }
    }


    // ============================================================
    // VERIFY RAZORPAY PAYMENT
    // ============================================================

    @Override
    public PaymentResponse verifyRazorpayPayment(
            RazorpayPaymentVerificationRequestDTO request,
            String email) {

        User user = getLoggedInUser(email);

        if (user.getRole() != RoleType.TENANT) {

            throw new RuntimeException(
                    "Only tenants can verify Razorpay payments");
        }

        Tenant tenant = tenantRepository
                .findByUser_Id(user.getId())
                .orElseThrow(() ->
                        new RuntimeException(
                                "Tenant profile not found"));

        // --------------------------------------------------------
        // Find our database payment using Razorpay order ID
        // --------------------------------------------------------

        Payment payment =
                paymentRepository
                        .findByRazorpayOrderId(
                                request.getRazorpayOrderId())
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Payment record not found for Razorpay order"));

        // --------------------------------------------------------
        // Verify tenant ownership
        // --------------------------------------------------------

        if (!payment.getTenantId().equals(
                tenant.getTenantId())) {

            throw new RuntimeException(
                    "You are not authorized to verify this payment");
        }

        // --------------------------------------------------------
        // Verify stored Razorpay order ID
        // --------------------------------------------------------

        if (payment.getRazorpayOrderId() == null ||
                !payment.getRazorpayOrderId()
                        .equals(
                                request.getRazorpayOrderId())) {

            throw new RuntimeException(
                    "Razorpay order ID mismatch");
        }

        // --------------------------------------------------------
        // Idempotency
        // --------------------------------------------------------

        if (payment.getPaymentStatus()
                == PaymentStatus.SUCCESS) {

            return mapToResponse(payment);
        }

        try {

            // ----------------------------------------------------
            // Verify Razorpay signature
            // ----------------------------------------------------

            JSONObject verificationData =
                    new JSONObject();

            verificationData.put(
                    "razorpay_order_id",
                    request.getRazorpayOrderId());

            verificationData.put(
                    "razorpay_payment_id",
                    request.getRazorpayPaymentId());

            verificationData.put(
                    "razorpay_signature",
                    request.getRazorpaySignature());

            boolean signatureValid =
                    Utils.verifyPaymentSignature(
                            verificationData,
                            razorpayKeySecret);

            if (!signatureValid) {

                payment.setPaymentStatus(
                        PaymentStatus.FAILED);

                payment.setUpdatedAt(
                        LocalDateTime.now());

                paymentRepository.save(payment);

                // ====================================================
                // NOTIFICATION: PAYMENT FAILED
                // ====================================================

                notifyPaymentFailed(
                        payment,
                        tenant,
                        "Payment verification failed because the Razorpay signature is invalid.");

                throw new RuntimeException(
                        "Invalid Razorpay payment signature");
            }

            // ----------------------------------------------------
            // Fetch actual payment from Razorpay
            // ----------------------------------------------------

            com.razorpay.Payment razorpayPayment =
                    razorpayClient.payments.fetch(
                            request.getRazorpayPaymentId());

            // ----------------------------------------------------
            // Get actual payment method
            // ----------------------------------------------------

            String razorpayMethod =
                    razorpayPayment.get("method");

            if (razorpayMethod != null) {

                switch (razorpayMethod.toLowerCase()) {

                    case "upi":

                        payment.setPaymentMethod(
                                PaymentMethod.UPI);

                        break;

                    case "card":

                        payment.setPaymentMethod(
                                PaymentMethod.CARD);

                        break;

                    case "netbanking":

                        payment.setPaymentMethod(
                                PaymentMethod.NET_BANKING);

                        break;

                    case "wallet":

                        payment.setPaymentMethod(
                                PaymentMethod.WALLET);

                        break;

                    default:

                        payment.setPaymentMethod(null);

                        break;
                }
            }

            // ----------------------------------------------------
            // Verify Razorpay order ID
            // ----------------------------------------------------

            String razorpayReturnedOrderId =
                    razorpayPayment.get("order_id");

            if (!request.getRazorpayOrderId()
                    .equals(
                            razorpayReturnedOrderId)) {

                throw new RuntimeException(
                        "Razorpay payment does not belong to this order");
            }

            // ----------------------------------------------------
            // Verify payment amount
            // ----------------------------------------------------

            Number razorpayAmount =
                    (Number) razorpayPayment.get("amount");

            long expectedAmount =
                    payment.getAmount()
                            .movePointRight(2)
                            .longValueExact();

            if (razorpayAmount == null ||
                    razorpayAmount.longValue()
                            != expectedAmount) {

                throw new RuntimeException(
                        "Razorpay payment amount does not match payment amount");
            }

            // ----------------------------------------------------
            // Verify captured status
            // ----------------------------------------------------

            String razorpayStatus =
                    razorpayPayment.get("status");

            if (!"captured".equalsIgnoreCase(
                    razorpayStatus)) {

                throw new RuntimeException(
                        "Razorpay payment is not captured. Current status: "
                                + razorpayStatus);
            }

            // ----------------------------------------------------
            // Save Razorpay payment ID
            // ----------------------------------------------------

            payment.setRazorpayPaymentId(
                    request.getRazorpayPaymentId());

            // ----------------------------------------------------
            // Payment SUCCESS
            // ----------------------------------------------------

            payment.setPaymentStatus(
                    PaymentStatus.SUCCESS);

            payment.setPaymentDate(
                    LocalDateTime.now());

            payment.setUpdatedAt(
                    LocalDateTime.now());

            paymentRepository.save(payment);

            // ----------------------------------------------------
            // Update RentInvoice
            // ----------------------------------------------------

            updateInvoiceStatus(
                    payment.getInvoice());

            // ----------------------------------------------------
            // Create Receipt
            // ----------------------------------------------------

            receiptService.createReceipt(
                    payment.getPaymentId());

            // ====================================================
            // NOTIFICATION: PAYMENT SUCCESS
            // ====================================================

            notifyPaymentSuccess(payment, tenant);

            return mapToResponse(payment);

        } catch (RazorpayException e) {

            /*
             * Razorpay communication failed.
             * Mark payment as FAILED and notify tenant.
             */

            payment.setPaymentStatus(
                    PaymentStatus.FAILED);

            payment.setUpdatedAt(
                    LocalDateTime.now());

            paymentRepository.save(payment);

            notifyPaymentFailed(
                    payment,
                    tenant,
                    "Payment verification failed because Razorpay could not be contacted.");

            throw new RuntimeException(
                    "Failed to verify Razorpay payment: "
                            + e.getMessage(),
                    e);
        }
    }


    // ============================================================
    // NOTIFICATION: PAYMENT SUCCESS
    // ============================================================

    private void notifyPaymentSuccess(
            Payment payment,
            Tenant tenant) {

        if (payment == null ||
                payment.getTenantId() == null
                || tenant == null
                || tenant.getUser() == null
                || tenant.getUser().getId() == null) {

            return;
        }

        notificationService.notifyUser(
                tenant.getUser().getId(),
                NotificationType.PAYMENT_SUCCESS,
                NotificationPriority.HIGH,
                "Payment Successful",
                "Your rent payment of ₹"
                        + payment.getAmount()
                        + " was successful.",
                payment.getPaymentId(),
                "PAYMENT"
        );

        String tenantEmail = tenant.getUser().getEmail();
        if (tenantEmail == null || tenantEmail.isBlank()) {
            return;
        }

        String tenantName = getTenantDisplayName(tenant);
        String amount = payment.getAmount() == null
                ? "Not specified"
                : payment.getAmount().toString();
        String invoiceNumber = payment.getInvoice() == null
                ? "Not specified"
                : payment.getInvoice().getInvoiceNumber();

        dispatchEmailAfterCommit(
                "payment successful",
                () -> emailService.sendPaymentSuccessEmail(
                        tenantEmail,
                        tenantName,
                        amount,
                        invoiceNumber));
    }


    // ============================================================
    // NOTIFICATION: PAYMENT FAILED
    // ============================================================

    private void notifyPaymentFailed(
            Payment payment,
            Tenant tenant,
            String reason) {

        if (payment == null ||
                payment.getTenantId() == null
                || tenant == null
                || tenant.getUser() == null
                || tenant.getUser().getId() == null) {

            return;
        }

        notificationService.notifyUser(
                tenant.getUser().getId(),
                NotificationType.PAYMENT_FAILED,
                NotificationPriority.HIGH,
                "Payment Failed",
                reason,
                payment.getPaymentId(),
                "PAYMENT"
        );

        String tenantEmail = tenant.getUser().getEmail();
        if (tenantEmail == null || tenantEmail.isBlank()) {
            return;
        }

        String tenantName = getTenantDisplayName(tenant);
        String invoiceNumber = payment.getInvoice() == null
                ? "Not specified"
                : payment.getInvoice().getInvoiceNumber();

        userAuthEmailDispatcher.dispatch(
                "payment failed",
                () -> emailService.sendPaymentFailureEmail(
                        tenantEmail,
                        tenantName,
                        invoiceNumber));
    }

    private String getTenantDisplayName(Tenant tenant) {
        User tenantUser = tenant.getUser();
        String firstName = tenantUser.getFirstName() == null
                ? ""
                : tenantUser.getFirstName();
        String lastName = tenantUser.getLastName() == null
                ? ""
                : tenantUser.getLastName();
        return (firstName + " " + lastName).trim();
    }

    private void dispatchEmailAfterCommit(
            String notificationType,
            Runnable sendEmail) {

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


    // ============================================================
    // GET PAYMENT BY ID
    // ============================================================

    @Override
    @Transactional(readOnly = true)
    public PaymentResponse getPaymentById(
            Long paymentId,
            String email) {

        User user = getLoggedInUser(email);

        Payment payment =
                paymentRepository
                        .findById(paymentId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Payment not found"));

        validatePaymentAccess(
                payment,
                user);

        return mapToResponse(payment);
    }


    // ============================================================
    // GET PAYMENTS BY TENANT
    // ============================================================

    @Override
    @Transactional(readOnly = true)
    public List<PaymentResponse> getPaymentsByTenant(
            Long tenantId,
            String email) {

        User user = getLoggedInUser(email);

        if (user.getRole() == RoleType.TENANT) {

            Tenant tenant = tenantRepository
                    .findByUser_Id(user.getId())
                    .orElseThrow(() ->
                            new RuntimeException(
                                    "Tenant profile not found"));

            if (!tenant.getTenantId()
                    .equals(tenantId)) {

                throw new RuntimeException(
                        "You are not authorized to view these payments");
            }
        }

        /*
         * SUPER_ADMIN can access all payments.
         */

        if (user.getRole() == RoleType.SUPER_ADMIN) {

            return paymentRepository.findByTenantId(tenantId).stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        /*
         * TENANT already validated above.
         */

        if (user.getRole() == RoleType.TENANT) {

            return paymentRepository.findByTenantId(tenantId).stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        if (user.getRole() == RoleType.PROPERTY_OWNER) {
            return paymentRepository
                    .findByTenantIdAndPropertyOwnerId(
                            tenantId,
                            user.getId())
                    .stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        if (user.getRole() == RoleType.PROPERTY_MANAGER) {
            return paymentRepository
                    .findByTenantIdAndPropertyManagerUserId(
                            tenantId,
                            user.getId())
                    .stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        /*
         * Retain the existing behavior for any other role: include only
         * payments that pass the existing access validator.
         */

        return paymentRepository.findByTenantId(tenantId).stream()
                .filter(payment -> {

                    try {

                        validatePaymentAccess(
                                payment,
                                user);

                        return true;

                    } catch (RuntimeException e) {

                        return false;
                    }
                })
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }


    // ============================================================
    // GET PAYMENTS BY INVOICE
    // ============================================================

    @Override
    @Transactional(readOnly = true)
    public List<PaymentResponse> getPaymentsByInvoice(
            Long invoiceId,
            String email) {

        User user = getLoggedInUser(email);

        RentInvoice invoice =
                rentInvoiceRepository
                        .findById(invoiceId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Rent invoice not found"));

        validateInvoiceAccess(
                invoice,
                user);

        return paymentRepository
                .findByInvoice_InvoiceId(invoiceId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }


    // ============================================================
    // GET LOGGED-IN USER
    // ============================================================

    private User getLoggedInUser(
            String email) {

        return userRepository
                .findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Authenticated user not found"));
    }


    // ============================================================
    // PAYMENT ACCESS VALIDATION
    // ============================================================

    private void validatePaymentAccess(
            Payment payment,
            User user) {

        validateInvoiceAccess(
                payment.getInvoice(),
                user);
    }


    // ============================================================
    // INVOICE ACCESS VALIDATION
    // ============================================================

    private void validateInvoiceAccess(
            RentInvoice invoice,
            User user) {

        // --------------------------------------------------------
        // SUPER ADMIN
        // --------------------------------------------------------

        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return;
        }

        // --------------------------------------------------------
        // TENANT
        // --------------------------------------------------------

        if (user.getRole() == RoleType.TENANT) {

            Tenant tenant = tenantRepository
                    .findByUser_Id(user.getId())
                    .orElseThrow(() ->
                            new RuntimeException(
                                    "Tenant profile not found"));

            if (!invoice.getTenantId()
                    .equals(tenant.getTenantId())) {

                throw new RuntimeException(
                        "You are not authorized to access this invoice");
            }

            return;
        }

        Property property = resolveInvoiceProperty(invoice);

        if (property == null) {
            throw new RuntimeException(
                    "Property not found for invoice");
        }

        // --------------------------------------------------------
        // PROPERTY OWNER
        // --------------------------------------------------------

        if (user.getRole() ==
                RoleType.PROPERTY_OWNER) {

            if (property.getOwner() == null ||
                    !property.getOwner()
                            .getId()
                            .equals(user.getId())) {

                throw new RuntimeException(
                        "You are not authorized to access this invoice");
            }

            return;
        }

        // --------------------------------------------------------
        // PROPERTY MANAGER
        // --------------------------------------------------------

        if (user.getRole() ==
                RoleType.PROPERTY_MANAGER) {

            if (property.getPropertyManager() == null ||
                    property.getPropertyManager()
                            .getUser() == null ||
                    !property.getPropertyManager()
                            .getUser()
                            .getId()
                            .equals(user.getId())) {

                throw new RuntimeException(
                        "You are not authorized to access this invoice");
            }

            return;
        }

        throw new RuntimeException(
                "You are not authorized to access this invoice");
    }

    private Property resolveInvoiceProperty(RentInvoice invoice) {
        if (invoice == null) {
            return null;
        }

        if (invoice.getRentalAgreement() != null) {
            Property property = invoice.getRentalAgreement().getProperty();
            if (property != null) {
                return property;
            }

            Unit agreementUnit = invoice.getRentalAgreement().getUnit();
            if (agreementUnit != null
                    && agreementUnit.getFloor() != null
                    && agreementUnit.getFloor().getBuilding() != null) {
                return agreementUnit.getFloor()
                        .getBuilding()
                        .getProperty();
            }
        }

        if (invoice.getUnitId() != null) {
            return unitRepository.findById(invoice.getUnitId())
                    .map(Unit::getFloor)
                    .map(floor -> floor.getBuilding())
                    .map(building -> building.getProperty())
                    .orElse(null);
        }

        return null;
    }


    // ============================================================
    // GET TENANT ID
    // ============================================================

    private Long getTenantId(
            User user) {

        Tenant tenant = tenantRepository
                .findByUser_Id(user.getId())
                .orElseThrow(() ->
                        new RuntimeException(
                                "Tenant profile not found"));

        return tenant.getTenantId();
    }


    // ============================================================
    // CALCULATE SUCCESSFULLY PAID AMOUNT
    // ============================================================

    private BigDecimal getSuccessfullyPaidAmount(
            Long invoiceId) {

        BigDecimal paidAmount =
                paymentRepository.sumAmountByInvoiceIdAndPaymentStatus(
                        invoiceId,
                        PaymentStatus.SUCCESS);

        return paidAmount == null ? BigDecimal.ZERO : paidAmount;
    }


    // ============================================================
    // UPDATE INVOICE STATUS
    // ============================================================

    private void updateInvoiceStatus(
            RentInvoice invoice) {

        BigDecimal totalPaid =
                getSuccessfullyPaidAmount(
                        invoice.getInvoiceId());

        BigDecimal totalAmount =
                invoice.getTotalAmount();

        if (totalPaid.compareTo(
                totalAmount) >= 0) {

            invoice.setStatus(
                    InvoiceStatus.PAID);

        } else if (totalPaid.compareTo(
                BigDecimal.ZERO) > 0) {

            invoice.setStatus(
                    InvoiceStatus.PARTIALLY_PAID);

        } else {

            invoice.setStatus(
                    InvoiceStatus.PENDING);
        }

        rentInvoiceRepository.save(invoice);
    }


    // ============================================================
    // MAP ENTITY → RESPONSE
    // ============================================================

    private PaymentResponse mapToResponse(
            Payment payment) {

        PaymentResponse response =
                new PaymentResponse();

        response.setPaymentId(
                payment.getPaymentId());

        response.setInvoiceId(
                payment.getInvoice()
                        .getInvoiceId());

        response.setTenantId(
                payment.getTenantId());

        response.setAmount(
                payment.getAmount());

        response.setPaymentStatus(
                payment.getPaymentStatus());

        response.setPaymentMethod(
                payment.getPaymentMethod());

        response.setRazorpayOrderId(
                payment.getRazorpayOrderId());

        response.setRazorpayPaymentId(
                payment.getRazorpayPaymentId());

        response.setPaymentDate(
                payment.getPaymentDate());

        response.setCreatedAt(
                payment.getCreatedAt());

        response.setUpdatedAt(
                payment.getUpdatedAt());

        return response;
    }
}
