package com.rental.rental_management_backend.property.controller;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.property.dto.PropertyDocumentDownload;
import com.rental.rental_management_backend.property.dto.PropertyDocumentRejectionRequest;
import com.rental.rental_management_backend.property.dto.PropertyDocumentResponse;
import com.rental.rental_management_backend.property.service.PropertyDocumentService;

import jakarta.validation.Valid;

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

    @GetMapping("/property/{propertyId}")
    public ResponseEntity<List<PropertyDocumentResponse>> getPropertyDocuments(
            Authentication authentication,
            @PathVariable Long propertyId) {
        return ResponseEntity.ok(
                propertyDocumentService.getPropertyDocumentsForAdmin(
                        authentication.getName(),
                        propertyId));
    }

    @PatchMapping("/{documentId}/approve")
    public ResponseEntity<PropertyDocumentResponse> approveDocument(
            Authentication authentication,
            @PathVariable Long documentId) {
        return ResponseEntity.ok(propertyDocumentService.approveDocument(
                authentication.getName(),
                documentId));
    }

    @PatchMapping("/{documentId}/reject")
    public ResponseEntity<PropertyDocumentResponse> rejectDocument(
            Authentication authentication,
            @PathVariable Long documentId,
            @Valid @RequestBody(required = false)
                    PropertyDocumentRejectionRequest request) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "Rejection reason is required");
        }
        return ResponseEntity.ok(propertyDocumentService.rejectDocument(
                authentication.getName(),
                documentId,
                request.getReason()));
    }

    @GetMapping("/{documentId}/download")
    public ResponseEntity<Resource> downloadDocument(
            Authentication authentication,
            @PathVariable Long documentId) {
        PropertyDocumentDownload download =
                propertyDocumentService.downloadAdminDocument(
                        authentication.getName(),
                        documentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.contentType()))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(
                                        download.fileName(),
                                        StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .body(download.resource());
    }
}
