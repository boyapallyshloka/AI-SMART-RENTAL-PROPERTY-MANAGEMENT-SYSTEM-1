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
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    List<RentalApplication> findByUnit_UnitId(Long unitId);

    @EntityGraph(attributePaths = {
            "tenant.user",
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    List<RentalApplication> findByStatus(
            RentalApplicationStatus status);

    @EntityGraph(attributePaths = {
            "tenant.user",
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

    @EntityGraph(attributePaths = {
            "tenant.user", "property.owner", "property.propertyManager.user"
    })
    List<RentalApplication> findByProperty_PropertyId(Long propertyId);

    boolean existsByTenant_TenantIdAndProperty_PropertyIdAndStatus(
            Long tenantId, Long propertyId, RentalApplicationStatus status);

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
            "unit.floor.building.property.owner",
            "unit.floor.building.property.propertyManager.user"
    })
    List<RentalApplication>
    findByUnit_Floor_Building_Property_PropertyId(
            Long propertyId);
 // M3 Rental Demand Prediction

    @Query("""
        SELECT COUNT(ra)
        FROM RentalApplication ra
        JOIN ra.unit u
        JOIN u.floor f
        JOIN f.building b
        JOIN PropertyAddress pa
            ON pa.property = b.property
        WHERE LOWER(pa.city) = LOWER(:city)
          AND LOWER(pa.area) = LOWER(:area)
          AND ra.applicationDate >= :startDate
          AND ra.applicationDate < :endDate
        """)
    long countApplicationsForRentalDemand(
            @Param("city") String city,
            @Param("area") String area,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
    
}
