package com.rental.rental_management_backend.maintenance.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.maintenance.dto.InspectionRequest;
import com.rental.rental_management_backend.maintenance.dto.InspectionResponse;
import com.rental.rental_management_backend.maintenance.service.InspectionService;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/inspections")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'PROPERTY_OWNER', 'PROPERTY_MANAGER')")
public class InspectionController {

    private final InspectionService inspectionService;

    public InspectionController(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    @PostMapping
    @Operation(summary = "Create a property inspection")
    public ResponseEntity<InspectionResponse> createInspection(
            @Valid @RequestBody InspectionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inspectionService.createInspection(request));
    }

    @GetMapping("/{inspectionId}")
    @Operation(summary = "Get an inspection by ID")
    public ResponseEntity<InspectionResponse> getInspectionById(
            @PathVariable Long inspectionId) {
        return ResponseEntity.ok(
                inspectionService.getInspectionById(inspectionId));
    }

    @GetMapping("/property/{propertyId}")
    @Operation(summary = "Get inspections for a property")
    public ResponseEntity<List<InspectionResponse>> getInspectionsByProperty(
            @PathVariable Long propertyId) {
        return ResponseEntity.ok(
                inspectionService.getInspectionsByProperty(propertyId));
    }

    @PutMapping("/{inspectionId}")
    @Operation(summary = "Update a property inspection")
    public ResponseEntity<InspectionResponse> updateInspection(
            @PathVariable Long inspectionId,
            @Valid @RequestBody InspectionRequest request) {
        return ResponseEntity.ok(
                inspectionService.updateInspection(inspectionId, request));
    }

    @DeleteMapping("/{inspectionId}")
    @Operation(summary = "Delete a property inspection")
    public ResponseEntity<Void> deleteInspection(
            @PathVariable Long inspectionId) {
        inspectionService.deleteInspection(inspectionId);
        return ResponseEntity.noContent().build();
    }
}
