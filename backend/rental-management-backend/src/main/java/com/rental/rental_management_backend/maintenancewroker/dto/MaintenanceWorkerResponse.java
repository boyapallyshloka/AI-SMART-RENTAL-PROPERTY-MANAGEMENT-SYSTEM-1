package com.rental.rental_management_backend.maintenancewroker.dto;

import java.util.List;

import com.rental.rental_management_backend.maintenancewroker.entity.MaintenanceWorker;

/** Explicit API shape that keeps Hibernate proxies out of JSON responses. */
public record MaintenanceWorkerResponse(
        Long workerId,
        String name,
        String phone,
        String email,
        String specialization,
        String availabilityStatus,
        List<Long> propertyIds) {

    public static MaintenanceWorkerResponse from(MaintenanceWorker worker) {
        return new MaintenanceWorkerResponse(
                worker.getWorkerId(),
                worker.getName(),
                worker.getPhone(),
                worker.getEmail(),
                worker.getSpecialization(),
                worker.getAvailabilityStatus(),
                worker.getPropertyIds() == null
                        ? List.of()
                        : List.copyOf(worker.getPropertyIds()));
    }
}
