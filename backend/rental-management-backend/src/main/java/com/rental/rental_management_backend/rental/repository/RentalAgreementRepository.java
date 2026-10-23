 package com.rental.rental_management_backend.rental.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

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

    @EntityGraph(attributePaths = {
            "rentalApplication",
            "tenant.user",
            "property",
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
        SELECT COUNT(ra)
        FROM RentalAgreement ra
        JOIN ra.unit u
        JOIN u.floor f
        JOIN f.building b
        JOIN PropertyAddress pa
            ON pa.property = b.property
        WHERE LOWER(pa.city) = LOWER(:city)
          AND LOWER(pa.area) = LOWER(:area)
          AND ra.startDate >= :startDate
          AND ra.startDate < :endDate
        """)
    long countAgreementStartsForRentalDemand(
            @Param("city") String city,
            @Param("area") String area,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
