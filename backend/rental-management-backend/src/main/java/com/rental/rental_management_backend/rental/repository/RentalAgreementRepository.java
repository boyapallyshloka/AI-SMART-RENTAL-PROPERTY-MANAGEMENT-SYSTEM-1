 package com.rental.rental_management_backend.rental.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.rental.rental_management_backend.rental.entity.RentalAgreement;
import com.rental.rental_management_backend.rental.enums.AgreementStatus;

@Repository
public interface RentalAgreementRepository
        extends JpaRepository<RentalAgreement, Long> {

    @EntityGraph(attributePaths = {
            "rentalApplication",
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner"
    })
    @Query("SELECT agreement FROM RentalAgreement agreement")
    List<RentalAgreement> findAllForAdminResponse();

    @EntityGraph(attributePaths = {
            "rentalApplication",
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    @Query("SELECT agreement FROM RentalAgreement agreement")
    List<RentalAgreement> findAllForManagementResponse();

    @EntityGraph(attributePaths = {
            "rentalApplication",
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    @Query("""
        SELECT agreement
        FROM RentalAgreement agreement
        WHERE agreement.agreementId = :agreementId
        """)
    Optional<RentalAgreement> findForAccessByAgreementId(
            @Param("agreementId") Long agreementId);

    Optional<RentalAgreement>
    findByRentalApplication_ApplicationId(Long applicationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT agreement
        FROM RentalAgreement agreement
        WHERE agreement.agreementId = :agreementId
        """)
    Optional<RentalAgreement> findByIdForInvoiceCreation(
            @Param("agreementId") Long agreementId);

    @EntityGraph(attributePaths = {
            "rentalApplication",
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner"
    })
    List<RentalAgreement>
    findByTenant_User_Email(String email);

    boolean
    existsByRentalApplication_ApplicationId(Long applicationId);

    boolean
    existsByUnit_UnitIdAndStatus(
            Long unitId,
            AgreementStatus status);

    boolean existsByProperty_PropertyIdAndStatus(
            Long propertyId,
            AgreementStatus status);
 // M3 Rental Demand Prediction

    @Query("""
        SELECT COUNT(DISTINCT ra)
        FROM RentalAgreement ra
        LEFT JOIN ra.property directProperty
        LEFT JOIN ra.unit unit
        LEFT JOIN unit.floor floor
        LEFT JOIN floor.building building
        LEFT JOIN building.property unitProperty
        LEFT JOIN PropertyAddress directAddress
            ON directAddress.property = directProperty
        LEFT JOIN PropertyAddress unitAddress
            ON unitAddress.property = unitProperty
        WHERE (
              (
                  directProperty.propertyType IN (
                      com.rental.rental_management_backend.property.enums.PropertyType.HOUSE,
                      com.rental.rental_management_backend.property.enums.PropertyType.VILLA
                  )
                  AND LOWER(directAddress.city) = LOWER(:city)
                  AND LOWER(directAddress.area) = LOWER(:area)
              )
              OR
              (
                  unitProperty.propertyType =
                      com.rental.rental_management_backend.property.enums.PropertyType.APARTMENT
                  AND LOWER(unitAddress.city) = LOWER(:city)
                  AND LOWER(unitAddress.area) = LOWER(:area)
              )
        )
          AND ra.startDate >= :startDate
          AND ra.startDate < :endDate
          AND ra.status IN (
              com.rental.rental_management_backend.rental.enums.AgreementStatus.ACTIVE,
              com.rental.rental_management_backend.rental.enums.AgreementStatus.EXPIRED,
              com.rental.rental_management_backend.rental.enums.AgreementStatus.TERMINATED
          )
        """)
    long countAgreementStartsForRentalDemand(
            @Param("city") String city,
            @Param("area") String area,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
