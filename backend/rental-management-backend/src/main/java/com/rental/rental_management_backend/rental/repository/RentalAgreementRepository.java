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

    List<RentalAgreement> findByStatus(AgreementStatus status);

    Optional<RentalAgreement>
    findByRentalApplication_ApplicationId(Long applicationId);

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

    boolean existsByTenant_TenantIdAndProperty_PropertyIdAndUnitIsNullAndStatus(
            Long tenantId,
            Long propertyId,
            AgreementStatus status);

    boolean existsByTenant_TenantIdAndUnit_UnitIdAndStatus(
            Long tenantId,
            Long unitId,
            AgreementStatus status);

    boolean existsByProperty_PropertyIdAndStatus(
            Long propertyId,
            AgreementStatus status);

    @Query("""
            SELECT COUNT(agreement)
            FROM RentalAgreement agreement
            LEFT JOIN agreement.property directProperty
            LEFT JOIN agreement.unit unit
            LEFT JOIN unit.floor floor
            LEFT JOIN floor.building building
            LEFT JOIN building.property unitProperty
            WHERE agreement.tenant.tenantId = :tenantId
              AND agreement.status <> :draftStatus
              AND agreement.startDate <= :asOfDate
              AND (directProperty.owner.id = :ownerId
                    OR unitProperty.owner.id = :ownerId)
            """)
    long countQualifyingAgreementsForTenantAndOwner(
            @Param("tenantId") Long tenantId,
            @Param("ownerId") Long ownerId,
            @Param("draftStatus") AgreementStatus draftStatus,
            @Param("asOfDate") LocalDate asOfDate);

    @Query("""
            SELECT COUNT(agreement)
            FROM RentalAgreement agreement
            LEFT JOIN agreement.property directProperty
            LEFT JOIN directProperty.propertyManager directManager
            LEFT JOIN agreement.unit unit
            LEFT JOIN unit.floor floor
            LEFT JOIN floor.building building
            LEFT JOIN building.property unitProperty
            LEFT JOIN unitProperty.propertyManager unitManager
            WHERE agreement.tenant.tenantId = :tenantId
              AND agreement.status <> :draftStatus
              AND agreement.startDate <= :asOfDate
              AND (directManager.user.id = :managerUserId
                    OR unitManager.user.id = :managerUserId)
            """)
    long countQualifyingAgreementsForTenantAndManager(
            @Param("tenantId") Long tenantId,
            @Param("managerUserId") Long managerUserId,
            @Param("draftStatus") AgreementStatus draftStatus,
            @Param("asOfDate") LocalDate asOfDate);

    @Query("""
            SELECT DISTINCT
                   tenant.tenantId AS tenantId,
                   TRIM(CONCAT(
                       CONCAT(COALESCE(tenantUser.firstName, ''), ' '),
                       COALESCE(tenantUser.lastName, '')
                   )) AS tenantName,
                   CASE
                       WHEN directProperty.owner.id = :ownerId
                           THEN directProperty.propertyId
                       ELSE unitProperty.propertyId
                   END AS propertyId,
                   CASE
                       WHEN directProperty.owner.id = :ownerId
                           THEN directProperty.propertyName
                       ELSE unitProperty.propertyName
                   END AS propertyName
            FROM RentalAgreement agreement
            JOIN agreement.tenant tenant
            JOIN tenant.user tenantUser
            LEFT JOIN agreement.property directProperty
            LEFT JOIN agreement.unit unit
            LEFT JOIN unit.floor floor
            LEFT JOIN floor.building building
            LEFT JOIN building.property unitProperty
            WHERE agreement.status <> :draftStatus
              AND agreement.startDate <= :asOfDate
              AND (directProperty.owner.id = :ownerId
                    OR unitProperty.owner.id = :ownerId)
            """)
    List<AccessibleTenantProperty> findQualifyingTenantPropertiesForOwner(
            @Param("ownerId") Long ownerId,
            @Param("draftStatus") AgreementStatus draftStatus,
            @Param("asOfDate") LocalDate asOfDate);

    @Query("""
            SELECT DISTINCT
                   tenant.tenantId AS tenantId,
                   TRIM(CONCAT(
                       CONCAT(COALESCE(tenantUser.firstName, ''), ' '),
                       COALESCE(tenantUser.lastName, '')
                   )) AS tenantName,
                   CASE
                       WHEN directManager.user.id = :managerUserId
                           THEN directProperty.propertyId
                       ELSE unitProperty.propertyId
                   END AS propertyId,
                   CASE
                       WHEN directManager.user.id = :managerUserId
                           THEN directProperty.propertyName
                       ELSE unitProperty.propertyName
                   END AS propertyName
            FROM RentalAgreement agreement
            JOIN agreement.tenant tenant
            JOIN tenant.user tenantUser
            LEFT JOIN agreement.property directProperty
            LEFT JOIN directProperty.propertyManager directManager
            LEFT JOIN agreement.unit unit
            LEFT JOIN unit.floor floor
            LEFT JOIN floor.building building
            LEFT JOIN building.property unitProperty
            LEFT JOIN unitProperty.propertyManager unitManager
            WHERE agreement.status <> :draftStatus
              AND agreement.startDate <= :asOfDate
              AND (directManager.user.id = :managerUserId
                    OR unitManager.user.id = :managerUserId)
            """)
    List<AccessibleTenantProperty> findQualifyingTenantPropertiesForManager(
            @Param("managerUserId") Long managerUserId,
            @Param("draftStatus") AgreementStatus draftStatus,
            @Param("asOfDate") LocalDate asOfDate);

    interface AccessibleTenantProperty {
        Long getTenantId();

        String getTenantName();

        Long getPropertyId();

        String getPropertyName();
    }

    @Query("""
            SELECT agreement
            FROM RentalAgreement agreement
            LEFT JOIN agreement.property directProperty
            LEFT JOIN agreement.unit unit
            LEFT JOIN unit.floor floor
            LEFT JOIN floor.building building
            LEFT JOIN building.property unitProperty
            WHERE directProperty.propertyId = :propertyId
               OR unitProperty.propertyId = :propertyId
            """)
    List<RentalAgreement> findByPropertyIdIncludingUnitHierarchy(
            @Param("propertyId") Long propertyId);

    boolean existsByProperty_PropertyIdAndUnitIsNullAndStatus(
            Long propertyId,
            AgreementStatus status);

    @EntityGraph(attributePaths = {"property", "unit"})
    @Query("""
            SELECT DISTINCT agreement
            FROM RentalAgreement agreement
            LEFT JOIN agreement.unit unit
            LEFT JOIN unit.floor floor
            LEFT JOIN floor.building building
            LEFT JOIN building.property unitProperty
            WHERE (agreement.property.propertyId = :propertyId
                    OR unitProperty.propertyId = :propertyId)
              AND agreement.startDate <= :endDate
              AND COALESCE(agreement.moveOutDate, agreement.endDate) >= :startDate
              AND agreement.status <> :draftStatus
            """)
    List<RentalAgreement> findProfitabilityAgreements(
            @Param("propertyId") Long propertyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("draftStatus") AgreementStatus draftStatus);

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