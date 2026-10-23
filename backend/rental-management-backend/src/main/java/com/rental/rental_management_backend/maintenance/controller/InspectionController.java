package com.rental.rental_management_backend.maintenance.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.maintenance.dto.InspectionCreateRequest;
import com.rental.rental_management_backend.maintenance.dto.InspectionResponse;
import com.rental.rental_management_backend.maintenance.service.InspectionService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/inspections")
@PreAuthorize("hasRole('PROPERTY_MANAGER')")
public class InspectionController {

    private final InspectionService inspectionService;

    public InspectionController(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    @GetMapping("/manager")
    public List<InspectionResponse> getManagerInspections() {
        return inspectionService.getManagerInspections();
    }

    @PostMapping
    public InspectionResponse createInspection(@Valid @RequestBody InspectionCreateRequest request) {
        return inspectionService.createManagerInspection(request);
    }
}
