package com.rental.rental_management_backend.maintenancewroker.service;

import java.util.List;

import com.rental.rental_management_backend.maintenancewroker.dto.MaintenanceWorkerResponse;
import com.rental.rental_management_backend.maintenancewroker.entity.MaintenanceWorker;

public interface MaintenanceWorkerService {

    MaintenanceWorkerResponse createWorker(MaintenanceWorker worker);

    List<MaintenanceWorkerResponse> getAllWorkers();

    MaintenanceWorkerResponse getWorkerById(Long workerId);

    MaintenanceWorkerResponse updateWorker(
            Long workerId,
            MaintenanceWorker worker);

    void deleteWorker(Long workerId);

    MaintenanceWorkerResponse associateWorkerWithProperty(
            Long workerId,
            Long propertyId);

    MaintenanceWorkerResponse removeWorkerFromProperty(
            Long workerId,
            Long propertyId);
}
