package com.rental.rental_management_backend.payment.repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.rental.rental_management_backend.payment.entity.Payment;
import com.rental.rental_management_backend.payment.enums.PaymentStatus;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    // Get all payments for a particular invoice
    @EntityGraph(attributePaths = "invoice")
    List<Payment> findByInvoice_InvoiceId(Long invoiceId);

    // Get all payments made by a particular tenant
    @EntityGraph(attributePaths = "invoice")
    List<Payment> findByTenantId(Long tenantId);

    @EntityGraph(attributePaths = "invoice")
    @Query("""
            SELECT payment
            FROM Payment payment
            JOIN payment.invoice invoice
                                                LEFT JOIN invoice.rentalAgreement agreement
                                                LEFT JOIN agreement.property directProperty
                                                LEFT JOIN Unit unit ON unit.unitId = invoice.unitId
                                                LEFT JOIN unit.floor floor
                                                LEFT JOIN floor.building building
                                                LEFT JOIN building.property unitProperty
            WHERE payment.tenantId = :tenantId
                                                        AND (directProperty.owner.id = :ownerId
                                                                         OR unitProperty.owner.id = :ownerId)
            """)
    List<Payment> findByTenantIdAndPropertyOwnerId(
            @Param("tenantId") Long tenantId,
            @Param("ownerId") Long ownerId);

    @EntityGraph(attributePaths = "invoice")
    @Query("""
            SELECT payment
            FROM Payment payment
            JOIN payment.invoice invoice
                                                LEFT JOIN invoice.rentalAgreement agreement
                                                LEFT JOIN agreement.property directProperty
                                                LEFT JOIN directProperty.propertyManager directManager
                                                LEFT JOIN Unit unit ON unit.unitId = invoice.unitId
                                                LEFT JOIN unit.floor floor
                                                LEFT JOIN floor.building building
                                                LEFT JOIN building.property unitProperty
                                                LEFT JOIN unitProperty.propertyManager unitManager
            WHERE payment.tenantId = :tenantId
                                                        AND (directManager.user.id = :managerUserId
                                                                         OR unitManager.user.id = :managerUserId)
            """)
    List<Payment> findByTenantIdAndPropertyManagerUserId(
            @Param("tenantId") Long tenantId,
            @Param("managerUserId") Long managerUserId);

    @Query("""
            SELECT SUM(payment.amount)
            FROM Payment payment
            WHERE payment.invoice.invoiceId = :invoiceId
              AND payment.paymentStatus = :status
            """)
    BigDecimal sumAmountByInvoiceIdAndPaymentStatus(
            @Param("invoiceId") Long invoiceId,
            @Param("status") PaymentStatus status);

    // Find payment using Razorpay order ID
    Optional<Payment> findByRazorpayOrderId(String razorpayOrderId);

    // Find payment using Razorpay payment ID
    Optional<Payment> findByRazorpayPaymentId(String razorpayPaymentId);

    // Check whether a Razorpay order already exists
    boolean existsByRazorpayOrderId(String razorpayOrderId);

    // Check whether a Razorpay payment already exists
    boolean existsByRazorpayPaymentId(String razorpayPaymentId);
}