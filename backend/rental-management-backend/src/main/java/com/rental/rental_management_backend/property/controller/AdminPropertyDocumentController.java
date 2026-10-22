package com.rental.rental_management_backend.property.controller;

import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.property.dto.PropertyDocumentRejectionRequest;
import com.rental.rental_management_backend.property.dto.PropertyDocumentResponse;
import com.rental.rental_management_backend.property.service.PropertyDocumentService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin/property-documents")
@CrossOrigin(origins = "*")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminPropertyDocumentController {

    private final PropertyDocumentService documentService;

    public AdminPropertyDocumentController(PropertyDocumentService documentService) {
        this.documentService = documentService;
    }

    // =========================================================
    // GET ALL PENDING PROPERTY DOCUMENTS
    // =========================================================
    @GetMapping("/pending")
    public ResponseEntity<List<PropertyDocumentResponse>> getPendingDocuments() {
        return ResponseEntity.ok(documentService.getPendingDocumentsForAdmin());
    }

    // =========================================================
    // GET ALL DOCUMENTS FOR A SPECIFIC PROPERTY
    // =========================================================
    @GetMapping("/property/{propertyId}")
    public ResponseEntity<List<PropertyDocumentResponse>> getDocumentsForProperty(
            @PathVariable Long propertyId) {
        return ResponseEntity.ok(documentService.getDocumentsByPropertyForAdmin(propertyId));
    }

    // =========================================================
    // APPROVE DOCUMENT
    // =========================================================
    @PatchMapping("/{documentId}/approve")
    public ResponseEntity<PropertyDocumentResponse> approveDocument(
            @PathVariable Long documentId,
            Authentication authentication) {

        String adminEmail = authentication.getName();
        return ResponseEntity.ok(documentService.approveDocument(documentId, adminEmail));
    }

    // =========================================================
    // REJECT DOCUMENT
    // Accepts either JSON body {"reason": "..."} or query parameter ?reason=...
    // =========================================================
    @PatchMapping("/{documentId}/reject")
    public ResponseEntity<PropertyDocumentResponse> rejectDocument(
            @PathVariable Long documentId,
            @Valid @RequestBody(required = false) PropertyDocumentRejectionRequest request,
            @RequestParam(required = false) String reason,
            Authentication authentication) {

        String finalReason = null;
        if (request != null && request.getReason() != null && !request.getReason().isBlank()) {
            finalReason = request.getReason().trim();
        } else if (reason != null && !reason.isBlank()) {
            finalReason = reason.trim();
        }

        if (finalReason == null || finalReason.isBlank()) {
            throw new IllegalArgumentException("A rejection reason is required");
        }

        String adminEmail = authentication.getName();
        return ResponseEntity.ok(documentService.rejectDocument(documentId, finalReason, adminEmail));
    }

    // =========================================================
    // DOWNLOAD / PREVIEW DOCUMENT
    // =========================================================
    @GetMapping("/{documentId}/download")
    public ResponseEntity<Resource> downloadDocument(
            @PathVariable Long documentId) {

        Resource file = documentService.downloadDocumentForAdmin(documentId);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"property-document-" + documentId + "\"")
                .body(file);
    }
}
