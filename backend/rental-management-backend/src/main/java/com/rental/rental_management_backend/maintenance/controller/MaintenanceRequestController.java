package com.rental.rental_management_backend.maintenance.controller;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.maintenance.dto.M5PredictionResponse;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceRequestRequest;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceRequestResponse;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceStatusUpdateRequest;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceCostUpdateRequest;
import jakarta.validation.Valid;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceCategory;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePayer;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePriority;
import com.rental.rental_management_backend.maintenance.service.MaintenanceRequestService;

@RestController
@RequestMapping("/api/maintenance")
public class MaintenanceRequestController {

    private final MaintenanceRequestService maintenanceRequestService;

    @Autowired
    public MaintenanceRequestController(
            MaintenanceRequestService maintenanceRequestService) {

        this.maintenanceRequestService = maintenanceRequestService;
    }

    // =========================================================
    // M5 AI MAINTENANCE PREDICTION
    // Property Manager / Property Owner / Super Admin
    // =========================================================

    @GetMapping("/predict/{propertyId}")
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER','PROPERTY_OWNER','SUPER_ADMIN')"
    )
    public ResponseEntity<M5PredictionResponse> predictMaintenance(

            @PathVariable Long propertyId,

            @RequestParam Long unitId) {

        /*
         * IMPORTANT:
         * Do not directly call M5AggregationService or
         * MaintenanceAiServiceClient from the controller.
         *
         * The service layer already performs:
         *
         * 1. Logged-in user identification
         * 2. Role checking
         * 3. Property ownership validation
         * 4. Property manager validation
         * 5. M5 feature aggregation
         * 6. AI prediction
         *
         * Therefore, the controller delegates the complete
         * operation to MaintenanceRequestService.
         */

        M5PredictionResponse response =
                maintenanceRequestService.predictMaintenance(
                        propertyId,
                        unitId
                );

        return ResponseEntity.ok(response);
    }

    // =========================================================
    // CREATE MAINTENANCE REQUEST
    // Tenant Only
    // =========================================================

    @PostMapping(consumes = "multipart/form-data")
    @PreAuthorize("hasRole('TENANT')")
    public ResponseEntity<MaintenanceRequestResponse> createRequest(

            @RequestParam Long propertyId,

            @RequestParam Long unitId,

            @RequestParam MaintenanceCategory category,

            @RequestParam String description,

            @RequestParam MaintenancePriority priority,

            @RequestParam(required = false)
            MaintenancePayer payer,

            @RequestParam(value = "image", required = false)
            MultipartFile image)

            throws IOException {

        MaintenanceRequestRequest request =
                new MaintenanceRequestRequest();

        request.setPropertyId(propertyId);

        request.setUnitId(unitId);

        request.setCategory(category);

        request.setDescription(description);

        request.setPriority(priority);

        request.setPayer(payer);

        MaintenanceRequestResponse response =
                maintenanceRequestService.createRequest(
                        request,
                        image
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // =========================================================
    // GET ALL REQUESTS
    // =========================================================

    @GetMapping
    @PreAuthorize(
            "hasAnyRole('TENANT','PROPERTY_MANAGER','PROPERTY_OWNER','SUPER_ADMIN')"
    )
    public ResponseEntity<List<MaintenanceRequestResponse>>
            getAllRequests() {

        return ResponseEntity.ok(
                maintenanceRequestService.getAllRequests()
        );
    }

    // =========================================================
    // GET REQUEST BY ID
    // =========================================================

    @GetMapping("/{requestId}")
    @PreAuthorize(
            "hasAnyRole('TENANT','PROPERTY_MANAGER','PROPERTY_OWNER','SUPER_ADMIN')"
    )
    public ResponseEntity<MaintenanceRequestResponse>
            getRequestById(
                    @PathVariable Long requestId) {

        return ResponseEntity.ok(
                maintenanceRequestService.getRequestById(requestId)
        );
    }

    // =========================================================
    // UPDATE REQUEST
    // =========================================================

    @PutMapping(
            value = "/{requestId}",
            consumes = "multipart/form-data"
    )
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER','PROPERTY_OWNER','SUPER_ADMIN')"
    )
    public ResponseEntity<MaintenanceRequestResponse>
            updateRequest(

            @PathVariable Long requestId,

            @RequestParam Long tenantId,

            @RequestParam Long propertyId,

            @RequestParam Long unitId,

            @RequestParam MaintenanceCategory category,

            @RequestParam String description,

            @RequestParam MaintenancePriority priority,

            @RequestParam(required = false)
            com.rental.rental_management_backend.maintenance.enums.MaintenanceStatus status,

            @RequestParam(required = false)
            LocalDateTime completedDate,

            @RequestParam(required = false)
            BigDecimal cost,

            @RequestParam(required = false)
            MaintenancePayer payer,

            @RequestParam(value = "image", required = false)
            MultipartFile image)

            throws IOException {

        MaintenanceRequestRequest request =
                new MaintenanceRequestRequest();

        request.setTenantId(tenantId);

        request.setPropertyId(propertyId);

        request.setUnitId(unitId);

        request.setCategory(category);

        request.setDescription(description);

        request.setPriority(priority);

        request.setStatus(status);

        request.setCompletedDate(completedDate);

        request.setCost(cost);

        request.setPayer(payer);

        return ResponseEntity.ok(
                maintenanceRequestService.updateRequest(
                        requestId,
                        request,
                        image
                )
        );
    }

    // =========================================================
    // UPDATE STATUS
    // =========================================================

    @PatchMapping("/{ticketId}/status")
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER','PROPERTY_OWNER','SUPER_ADMIN')"
    )
    public ResponseEntity<MaintenanceRequestResponse>
            updateStatus(

            @PathVariable Long ticketId,

            @RequestBody MaintenanceStatusUpdateRequest request) {

        return ResponseEntity.ok(
                maintenanceRequestService.updateStatus(
                        ticketId,
                        request
                )
        );
    }

    @PatchMapping("/{ticketId}/cost")
    @PreAuthorize("hasAnyRole('PROPERTY_MANAGER','PROPERTY_OWNER','SUPER_ADMIN')")
    public ResponseEntity<MaintenanceRequestResponse> updateCost(
            @PathVariable Long ticketId,
            @Valid @RequestBody MaintenanceCostUpdateRequest request) {
        return ResponseEntity.ok(
                maintenanceRequestService.updateCost(ticketId, request));
    }

    // =========================================================
    // DELETE REQUEST
    // =========================================================

    @DeleteMapping("/{requestId}")
    @PreAuthorize(
            "hasAnyRole('PROPERTY_MANAGER','PROPERTY_OWNER','SUPER_ADMIN')"
    )
    public ResponseEntity<Void> deleteRequest(

            @PathVariable Long requestId) {

        maintenanceRequestService.deleteRequest(requestId);

        return ResponseEntity.noContent().build();
    }
}
