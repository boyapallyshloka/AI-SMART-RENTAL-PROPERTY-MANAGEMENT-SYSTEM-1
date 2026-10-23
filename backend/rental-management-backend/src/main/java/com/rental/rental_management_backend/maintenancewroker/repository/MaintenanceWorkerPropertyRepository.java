package com.rental.rental_management_backend.maintenancewroker.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.rental.rental_management_backend.maintenancewroker.entity.MaintenanceWorkerProperty;

@Repository
public interface MaintenanceWorkerPropertyRepository
        extends JpaRepository<MaintenanceWorkerProperty, Long> {

    List<MaintenanceWorkerProperty> findByWorker_WorkerId(Long workerId);

    List<MaintenanceWorkerProperty> findByProperty_PropertyIdIn(
            Collection<Long> propertyIds);

    boolean existsByWorker_WorkerIdAndProperty_PropertyId(
            Long workerId,
            Long propertyId);

    void deleteByWorker_WorkerIdAndProperty_PropertyId(
            Long workerId,
            Long propertyId);

    void deleteAllByWorker_WorkerId(Long workerId);
}
