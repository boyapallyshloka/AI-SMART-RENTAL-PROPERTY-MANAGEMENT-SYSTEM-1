package com.rental.rental_management_backend.property.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.property.dto.PropertyDocumentResponse;
import com.rental.rental_management_backend.property.service.PropertyDocumentService;

@RestController
@RequestMapping("/api/admin/property-documents")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminPropertyDocumentController {

    private final PropertyDocumentService propertyDocumentService;

    public AdminPropertyDocumentController(
            PropertyDocumentService propertyDocumentService) {
        this.propertyDocumentService = propertyDocumentService;
    }

    @GetMapping("/pending")
    public ResponseEntity<List<PropertyDocumentResponse>> getPendingDocuments() {
        return ResponseEntity.ok(
                propertyDocumentService.getPendingDocuments());
    }
}
