package com.rental.rental_management_backend.receipt.serviceImpl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.payment.entity.Payment;
import com.rental.rental_management_backend.payment.enums.PaymentStatus;
import com.rental.rental_management_backend.payment.repository.PaymentRepository;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.repository.UnitRepository;
import com.rental.rental_management_backend.rental.entity.RentInvoice;
import com.rental.rental_management_backend.receipt.dto.ReceiptResponse;
import com.rental.rental_management_backend.receipt.entity.Receipt;
import com.rental.rental_management_backend.receipt.repository.ReceiptRepository;
import com.rental.rental_management_backend.receipt.service.ReceiptService;
import com.rental.rental_management_backend.tenant.entity.Tenant;
import com.rental.rental_management_backend.tenant.repository.TenantRepository;


@Service
@Transactional
public class ReceiptServiceImpl implements ReceiptService {

    private final ReceiptRepository receiptRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final UnitRepository unitRepository;

    public ReceiptServiceImpl(
            ReceiptRepository receiptRepository,
            PaymentRepository paymentRepository,
            UserRepository userRepository,
            TenantRepository tenantRepository,
            UnitRepository unitRepository) {

        this.receiptRepository = receiptRepository;
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.unitRepository = unitRepository;
    }

    // =========================================================
    // AUTOMATIC RECEIPT CREATION
    // Called internally after successful Razorpay verification
    // =========================================================

    @Override
    public ReceiptResponse createReceipt(Long paymentId) {

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() ->
                        new RuntimeException("Payment not found"));

        // Receipt can be created only for successful payments
        if (payment.getPaymentStatus() != PaymentStatus.SUCCESS) {
            throw new RuntimeException(
                    "Receipt can be created only for successful payments");
        }

        // Prevent duplicate receipt for the same payment
        Receipt existingReceipt =
                receiptRepository
                        .findByPayment_PaymentId(paymentId)
                        .orElse(null);

        if (existingReceipt != null) {
            return mapToResponse(existingReceipt);
        }

        RentInvoice invoice = payment.getInvoice();

        if (invoice == null) {
            throw new RuntimeException(
                    "Invoice not found for payment");
        }

        /*
         * Calculate total amount successfully paid
         * for this invoice.
         */
        BigDecimal totalPaid = paymentRepository
                .findByInvoice_InvoiceId(
                        invoice.getInvoiceId())
                .stream()
                .filter(p ->
                        p.getPaymentStatus()
                                == PaymentStatus.SUCCESS)
                .map(Payment::getAmount)
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add);

        BigDecimal remainingAmount =
                invoice.getTotalAmount()
                        .subtract(totalPaid);

        if (remainingAmount.compareTo(
                BigDecimal.ZERO) < 0) {

            remainingAmount = BigDecimal.ZERO;
        }

        LocalDateTime now = LocalDateTime.now();

        Receipt receipt = new Receipt();

        receipt.setPayment(payment);
        receipt.setInvoiceId(invoice.getInvoiceId());
        receipt.setInvoiceNumber(
                invoice.getInvoiceNumber());

        receipt.setTenantId(
                payment.getTenantId());

        receipt.setUnitId(
                invoice.getUnitId());

        receipt.setAmountPaid(
                payment.getAmount());

        receipt.setInvoiceTotalAmount(
                invoice.getTotalAmount());

        receipt.setRemainingAmount(
                remainingAmount);

        receipt.setPaymentMethod(
                payment.getPaymentMethod());

        receipt.setRazorpayOrderId(
                payment.getRazorpayOrderId());

        receipt.setRazorpayPaymentId(
                payment.getRazorpayPaymentId());

        receipt.setPaymentDate(
                payment.getPaymentDate());

        receipt.setCreatedAt(now);
        receipt.setUpdatedAt(now);

        /*
         * receiptId is generated only after save.
         * Therefore save first, then create
         * the final receipt number.
         */
        receipt.setReceiptNumber(
                "TEMP-" + paymentId);

        receipt = receiptRepository.save(receipt);

        String receiptNumber =
                String.format(
                        "REC-%d-%05d",
                        invoice.getInvoiceId(),
                        receipt.getReceiptId());

        receipt.setReceiptNumber(receiptNumber);
        receipt.setUpdatedAt(LocalDateTime.now());

        receipt = receiptRepository.save(receipt);

        return mapToResponse(receipt);
    }

    // =========================================================
    // GET RECEIPT BY ID
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public ReceiptResponse getReceiptById(
            Long receiptId,
            String email) {

        Receipt receipt =
                receiptRepository.findById(receiptId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Receipt not found"));

        validateReceiptAccess(receipt, email);

        return mapToResponse(receipt);
    }

    // =========================================================
    // GET RECEIPT BY PAYMENT ID
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public ReceiptResponse getReceiptByPaymentId(
            Long paymentId,
            String email) {

        Receipt receipt =
                receiptRepository
                        .findByPayment_PaymentId(paymentId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Receipt not found for payment"));

        validateReceiptAccess(receipt, email);

        return mapToResponse(receipt);
    }

    // =========================================================
    // GET RECEIPTS BY TENANT
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<ReceiptResponse> getReceiptsByTenant(
            Long tenantId,
            String email) {

        User user = getLoggedInUser(email);

        // SUPER_ADMIN can access all tenants
        if (user.getRole() == RoleType.SUPER_ADMIN) {

            return receiptRepository
                    .findByTenantId(tenantId)
                    .stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        // TENANT can access only their own receipts
        if (user.getRole() == RoleType.TENANT) {

            Tenant tenant = tenantRepository
                    .findByUser_Id(user.getId())
                    .orElseThrow(() ->
                            new RuntimeException(
                                    "Tenant profile not found"));

            if (!tenant.getTenantId().equals(tenantId)) {

                throw new RuntimeException(
                        "You are not authorized to access these receipts");
            }

            return receiptRepository
                    .findByTenantId(tenantId)
                    .stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        /*
         * PROPERTY_OWNER and PROPERTY_MANAGER:
         * Check every receipt through its unit/property.
         */
        if (user.getRole() == RoleType.PROPERTY_OWNER
                || user.getRole()
                        == RoleType.PROPERTY_MANAGER) {

            List<Receipt> receipts =
                    receiptRepository
                            .findByTenantId(tenantId);

            return receipts.stream()
                    .filter(receipt ->
                            hasPropertyAccess(
                                    receipt,
                                    user))
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        throw new RuntimeException(
                "You are not authorized to access these receipts");
    }

    // =========================================================
    // GET RECEIPTS BY INVOICE
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<ReceiptResponse> getReceiptsByInvoice(
            Long invoiceId,
            String email) {

        User user = getLoggedInUser(email);

        List<Receipt> receipts =
                receiptRepository
                        .findByInvoiceId(invoiceId);

        /*
         * SUPER_ADMIN can access all receipts.
         */
        if (user.getRole() == RoleType.SUPER_ADMIN) {

            return receipts.stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        /*
         * For all other roles, validate each receipt.
         */
        return receipts.stream()
                .filter(receipt ->
                        hasReceiptAccess(
                                receipt,
                                user))
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // RECEIPT ACCESS VALIDATION
    // =========================================================

    private void validateReceiptAccess(
            Receipt receipt,
            String email) {

        User user = getLoggedInUser(email);

        if (!hasReceiptAccess(receipt, user)) {

            throw new RuntimeException(
                    "You are not authorized to access this receipt");
        }
    }

    private boolean hasReceiptAccess(
            Receipt receipt,
            User user) {

        // SUPER_ADMIN → everything
        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return true;
        }

        // TENANT → only own receipts
        if (user.getRole() == RoleType.TENANT) {

            Tenant tenant = tenantRepository
                    .findByUser_Id(user.getId())
                    .orElseThrow(() ->
                            new RuntimeException(
                                    "Tenant profile not found"));

            return tenant.getTenantId()
                    .equals(receipt.getTenantId());
        }

        // OWNER / MANAGER → property-based access
        if (user.getRole() == RoleType.PROPERTY_OWNER
                || user.getRole()
                        == RoleType.PROPERTY_MANAGER) {

            return hasPropertyAccess(
                    receipt,
                    user);
        }

        return false;
    }

    // =========================================================
    // PROPERTY ACCESS
    // =========================================================

    private boolean hasPropertyAccess(
            Receipt receipt,
            User user) {
                var property = resolveReceiptProperty(receipt);

                if (property == null) {
                        return false;
                }

        /*
         * PROPERTY_OWNER
         */
        if (user.getRole()
                == RoleType.PROPERTY_OWNER) {

            return property.getOwner() != null
                    && property.getOwner()
                            .getId()
                            .equals(user.getId());
        }

        /*
         * PROPERTY_MANAGER
         */
        if (user.getRole()
                == RoleType.PROPERTY_MANAGER) {

            return property.getPropertyManager() != null
                    && property.getPropertyManager().getUser().getId()
                            .equals(user.getId());
        }
        return false;
    }

    private Property resolveReceiptProperty(Receipt receipt) {
        if (receipt == null) {
            return null;
        }

        if (receipt.getPayment() != null
                && receipt.getPayment().getInvoice() != null
                && receipt.getPayment().getInvoice()
                        .getRentalAgreement() != null) {
            var agreement = receipt.getPayment().getInvoice()
                    .getRentalAgreement();
            if (agreement.getProperty() != null) {
                return agreement.getProperty();
            }

            Unit agreementUnit = agreement.getUnit();
            if (agreementUnit != null
                    && agreementUnit.getFloor() != null
                    && agreementUnit.getFloor().getBuilding() != null) {
                return agreementUnit.getFloor()
                        .getBuilding()
                        .getProperty();
            }
        }

        if (receipt.getUnitId() != null) {
            Unit unit = unitRepository.findById(receipt.getUnitId())
                    .orElse(null);
            if (unit != null
                    && unit.getFloor() != null
                    && unit.getFloor().getBuilding() != null) {
                return unit.getFloor().getBuilding().getProperty();
            }
        }

        return null;
    }

    // =========================================================
    // GET LOGGED-IN USER
    // =========================================================

    private User getLoggedInUser(String email) {

        return userRepository
                .findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException(
                                "User not found"));
    }

    // =========================================================
    // MAP ENTITY → RESPONSE
    // =========================================================

    private ReceiptResponse mapToResponse(
            Receipt receipt) {

        ReceiptResponse response =
                new ReceiptResponse();

        response.setReceiptId(
                receipt.getReceiptId());

        response.setReceiptNumber(
                receipt.getReceiptNumber());

        if (receipt.getPayment() != null) {

            response.setPaymentId(
                    receipt.getPayment()
                            .getPaymentId());
        }

        response.setInvoiceId(
                receipt.getInvoiceId());

        response.setInvoiceNumber(
                receipt.getInvoiceNumber());

        response.setTenantId(
                receipt.getTenantId());

        var property = resolveReceiptProperty(receipt);
        if (property != null) {
            response.setPropertyId(property.getPropertyId());
        }

        response.setUnitId(
                receipt.getUnitId());

        response.setAmountPaid(
                receipt.getAmountPaid());

        response.setInvoiceTotalAmount(
                receipt.getInvoiceTotalAmount());

        response.setRemainingAmount(
                receipt.getRemainingAmount());

        response.setPaymentMethod(
                receipt.getPaymentMethod());

        response.setRazorpayOrderId(
                receipt.getRazorpayOrderId());

        response.setRazorpayPaymentId(
                receipt.getRazorpayPaymentId());

        response.setPaymentDate(
                receipt.getPaymentDate());

        response.setCreatedAt(
                receipt.getCreatedAt());

        response.setUpdatedAt(
                receipt.getUpdatedAt());

        return response;
    }
}
