package com.rental.rental_management_backend.maintenancewroker.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.maintenancewroker.entity.MaintenanceWorker;
import com.rental.rental_management_backend.maintenancewroker.dto.MaintenanceWorkerResponse;
import com.rental.rental_management_backend.maintenancewroker.service.MaintenanceWorkerService;

@RestController
@RequestMapping("/api/maintenance-workers")
public class MaintenanceWorkerController {

    private final MaintenanceWorkerService service;

    public MaintenanceWorkerController(
            MaintenanceWorkerService service) {

        this.service = service;
    }

    // =========================================================
    // CREATE MAINTENANCE WORKER
    // PROPERTY MANAGER / PROPERTY OWNER / SUPER ADMIN
    // =========================================================

    @PostMapping
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER', 'PROPERTY_OWNER', 'SUPER_ADMIN')"
    )
    public MaintenanceWorkerResponse createWorker(
            @RequestBody MaintenanceWorker worker) {

        return service.createWorker(worker);
    }

    // =========================================================
    // GET ALL MAINTENANCE WORKERS
    // PROPERTY MANAGER / PROPERTY OWNER / SUPER ADMIN
    // =========================================================

    @GetMapping
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER', 'PROPERTY_OWNER', 'SUPER_ADMIN')"
    )
    public List<MaintenanceWorkerResponse> getAllWorkers() {

        return service.getAllWorkers();
    }

    // =========================================================
    // GET MAINTENANCE WORKER BY ID
    // PROPERTY MANAGER / PROPERTY OWNER / SUPER ADMIN
    // =========================================================

    @GetMapping("/{workerId}")
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER', 'PROPERTY_OWNER', 'SUPER_ADMIN')"
    )
    public MaintenanceWorkerResponse getWorkerById(
            @PathVariable Long workerId) {

        return service.getWorkerById(workerId);
    }

    // =========================================================
    // UPDATE MAINTENANCE WORKER
    // PROPERTY MANAGER / PROPERTY OWNER / SUPER ADMIN
    // =========================================================

    @PutMapping("/{workerId}")
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER', 'PROPERTY_OWNER', 'SUPER_ADMIN')"
    )
    public MaintenanceWorkerResponse updateWorker(
            @PathVariable Long workerId,
            @RequestBody MaintenanceWorker worker) {

        return service.updateWorker(workerId, worker);
    }

    // =========================================================
    // DELETE MAINTENANCE WORKER
    // PROPERTY MANAGER / PROPERTY OWNER / SUPER ADMIN
    // =========================================================

    @DeleteMapping("/{workerId}")
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER', 'PROPERTY_OWNER', 'SUPER_ADMIN')"
    )
    public String deleteWorker(
            @PathVariable Long workerId) {

        service.deleteWorker(workerId);

        return "Maintenance Worker deleted successfully";
    }

    @PostMapping("/{workerId}/properties/{propertyId}")
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER', 'PROPERTY_OWNER', 'SUPER_ADMIN')"
    )
    public MaintenanceWorkerResponse associateWorkerWithProperty(
            @PathVariable Long workerId,
            @PathVariable Long propertyId) {

        return service.associateWorkerWithProperty(workerId, propertyId);
    }

    @DeleteMapping("/{workerId}/properties/{propertyId}")
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER', 'PROPERTY_OWNER', 'SUPER_ADMIN')"
    )
    public MaintenanceWorkerResponse removeWorkerFromProperty(
            @PathVariable Long workerId,
            @PathVariable Long propertyId) {

        return service.removeWorkerFromProperty(workerId, propertyId);
    }
}
