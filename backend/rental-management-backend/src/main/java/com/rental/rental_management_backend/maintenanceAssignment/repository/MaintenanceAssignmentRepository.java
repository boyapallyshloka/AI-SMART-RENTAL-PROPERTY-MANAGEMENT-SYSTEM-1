
package com.rental.rental_management_backend.maintenanceAssignment.repository;

import java.util.List;
import java.util.Collection;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.rental.rental_management_backend.maintenanceAssignment.entity.MaintenanceAssignment;

public interface MaintenanceAssignmentRepository
        extends JpaRepository<MaintenanceAssignment, Long> {

    @Query("""
            SELECT a
            FROM MaintenanceAssignment a
            JOIN FETCH a.maintenanceRequest
            JOIN FETCH a.worker
            WHERE a.id = :id
            """)
    java.util.Optional<MaintenanceAssignment> findAssignmentWithDetails(
            @Param("id") Long id);

    List<MaintenanceAssignment> findByWorkerWorkerId(Long workerId);

    List<MaintenanceAssignment> findByMaintenanceRequestRequestId(Long requestId);

    @Query("""
            SELECT DISTINCT a
            FROM MaintenanceAssignment a
            WHERE a.maintenanceRequest.property.propertyId IN :propertyIds
            """)
    List<MaintenanceAssignment> findByMaintenancePropertyIds(
            @Param("propertyIds") Collection<Long> propertyIds);
}
