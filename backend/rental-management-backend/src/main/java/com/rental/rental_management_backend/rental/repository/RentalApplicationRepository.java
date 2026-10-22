package com.rental.rental_management_backend.rental.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.rental.rental_management_backend.rental.entity.RentalApplication;
import com.rental.rental_management_backend.rental.enums.RentalApplicationStatus;

public interface RentalApplicationRepository
        extends JpaRepository<RentalApplication, Long> {

    @Override
    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    List<RentalApplication> findAll();

    @Override
    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    Optional<RentalApplication> findById(Long applicationId);

    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    List<RentalApplication> findByTenant_TenantId(Long tenantId);

    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    List<RentalApplication> findByUnit_UnitId(Long unitId);

    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    List<RentalApplication> findByStatus(
            RentalApplicationStatus status);

    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    List<RentalApplication> findByUnit_UnitIdAndStatus(
            Long unitId,
            RentalApplicationStatus status);

    boolean existsByTenant_TenantIdAndUnit_UnitIdAndStatus(
            Long tenantId,
            Long unitId,
            RentalApplicationStatus status);

        @Query("""
                SELECT CASE WHEN COUNT(application) > 0 THEN true ELSE false END
                FROM RentalApplication application
                LEFT JOIN application.property directProperty
                LEFT JOIN application.unit unit
                LEFT JOIN unit.floor floor
                LEFT JOIN floor.building building
                LEFT JOIN building.property unitProperty
                WHERE application.tenant.tenantId = :tenantId
                  AND application.status = :status
                  AND (directProperty.propertyId = :propertyId
                           OR unitProperty.propertyId = :propertyId)
                """)
        boolean existsByTenantAndPropertyIdAndStatus(
                        @Param("tenantId") Long tenantId,
                        @Param("propertyId") Long propertyId,
                        @Param("status") RentalApplicationStatus status);

    /*
     * Get all rental applications belonging to a property.
     *
     * Property hierarchy:
     *
     * Property
     *   -> Building
     *      -> Floor
     *         -> Unit
     *            -> RentalApplication
     */
    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    List<RentalApplication>
    findByUnit_Floor_Building_Property_PropertyId(
            Long propertyId);

    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "property.propertyManager.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    @Query("""
        SELECT application
        FROM RentalApplication application
        LEFT JOIN application.property directProperty
        LEFT JOIN application.unit unit
        LEFT JOIN unit.floor floor
        LEFT JOIN floor.building building
        LEFT JOIN building.property unitProperty
        WHERE directProperty.propertyId = :propertyId
           OR unitProperty.propertyId = :propertyId
        """)
    List<RentalApplication> findAllByPropertyIdIncludingUnitApplications(
            @Param("propertyId") Long propertyId);
 // M3 Rental Demand Prediction

    @Query("""
        SELECT COUNT(DISTINCT ra)
        FROM RentalApplication ra
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
          AND ra.applicationDate >= :startDate
          AND ra.applicationDate < :endDate
        """)
    long countApplicationsForRentalDemand(
            @Param("city") String city,
            @Param("area") String area,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
    
}