
package com.rental.rental_management_backend.rental.repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.rental.rental_management_backend.payment.enums.PaymentStatus;
import com.rental.rental_management_backend.rental.entity.RentInvoice;

@Repository
public interface RentInvoiceRepository extends JpaRepository<RentInvoice, Long> {

    @Override
    @EntityGraph(attributePaths = {
            "rentalAgreement.property",
            "rentalAgreement.unit.floor.building.property"
    })
    Optional<RentInvoice> findById(Long invoiceId);

    @Override
    @EntityGraph(attributePaths = {
            "rentalAgreement.property",
            "rentalAgreement.unit.floor.building.property"
    })
    List<RentInvoice> findAll();

    Optional<RentInvoice> findByRentalAgreement_AgreementIdAndBillingMonthAndBillingYear(
            Long agreementId,
            Integer billingMonth,
            Integer billingYear
    );

    Optional<RentInvoice>
    findFirstByRentalAgreement_AgreementIdOrderByBillingYearDescBillingMonthDesc(
            Long agreementId);

    @EntityGraph(attributePaths = {
            "rentalAgreement.property",
            "rentalAgreement.unit.floor.building.property"
    })
    List<RentInvoice> findByTenantId(Long tenantId);

    @Query("""
            SELECT tenant.tenantId
            FROM Tenant tenant
            WHERE tenant.user.email = :email
            """)
    Optional<Long> findTenantIdByUserEmail(
            @Param("email") String email);

    @Query("""
            SELECT payment.invoice.invoiceId AS invoiceId,
                   SUM(payment.amount) AS totalPaid
            FROM Payment payment
            WHERE payment.invoice.invoiceId IN :invoiceIds
              AND payment.paymentStatus = :status
            GROUP BY payment.invoice.invoiceId
            """)
    List<PaidAmountByInvoice> findPaidAmountsByInvoiceIds(
            @Param("invoiceIds") List<Long> invoiceIds,
            @Param("status") PaymentStatus status);

    interface PaidAmountByInvoice {
        Long getInvoiceId();
        BigDecimal getTotalPaid();
    }
}
