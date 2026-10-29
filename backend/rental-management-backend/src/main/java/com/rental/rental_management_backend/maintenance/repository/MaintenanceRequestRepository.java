package com.rental.rental_management_backend.maintenance.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.rental.rental_management_backend.maintenance.entity.MaintenanceRequest;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePriority;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePayer;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceStatus;

@Repository
public interface MaintenanceRequestRepository extends JpaRepository<MaintenanceRequest, Long> {

    List<MaintenanceRequest> findByStatus(MaintenanceStatus status);

    List<MaintenanceRequest> findByPriority(MaintenancePriority priority);

    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "unit.floor.building.property"
    })
    List<MaintenanceRequest> findByTenant_TenantId(Long tenantId);

    // Spring Data property-path methods
    List<MaintenanceRequest> findByProperty_PropertyId(Long propertyId);

    List<MaintenanceRequest> findByUnit_UnitId(Long unitId);

    List<MaintenanceRequest>
    findByProperty_PropertyIdAndStatusAndPayerAndCompletedDateGreaterThanEqualAndCompletedDateLessThan(
            Long propertyId,
            MaintenanceStatus status,
            MaintenancePayer payer,
            LocalDateTime startDateTime,
            LocalDateTime endDateTime);

    // Explicit JPQL queries to ensure reliable lookups regardless of entity field naming
    @Query("SELECT m FROM MaintenanceRequest m WHERE m.property.propertyId = :propertyId")
    List<MaintenanceRequest> findByPropertyId(@Param("propertyId") Long propertyId);

    @Query("""
            SELECT m.requestedDate AS requestedDate,
                   m.cost AS cost,
                   m.status AS status,
                   m.completedDate AS completedDate,
                   m.category AS category
            FROM MaintenanceRequest m
            WHERE m.property.propertyId = :propertyId
            """)
    List<MaintenanceHistoryProjection> findHistoryValuesByPropertyId(
            @Param("propertyId") Long propertyId);

    @Query("SELECT m FROM MaintenanceRequest m WHERE m.unit.unitId = :unitId")
    List<MaintenanceRequest> findByUnitId(@Param("unitId") Long unitId);

    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "unit.floor.building.property"
    })
    @Query("SELECT m FROM MaintenanceRequest m WHERE m.property.owner.id = :ownerId")
    List<MaintenanceRequest> findByPropertyOwnerId(@Param("ownerId") Long ownerId);

    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "unit.floor.building.property"
    })
    @Query("SELECT m FROM MaintenanceRequest m WHERE m.property.propertyManager.user.id = :managerUserId")
    List<MaintenanceRequest> findByPropertyManagerUserId(@Param("managerUserId") Long managerUserId);

    @EntityGraph(attributePaths = {
            "tenant.user",
            "property.owner",
            "unit.floor.building.property"
    })
    @Override
    List<MaintenanceRequest> findAll();
}