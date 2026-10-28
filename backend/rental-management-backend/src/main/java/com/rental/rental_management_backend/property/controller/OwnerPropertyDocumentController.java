package com.rental.rental_management_backend.property.controller;

import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.property.dto.PropertyDocumentResponse;
import com.rental.rental_management_backend.property.dto.PropertyPublishEligibilityResponse;
import com.rental.rental_management_backend.property.enums.PropertyDocumentType;
import com.rental.rental_management_backend.property.service.PropertyDocumentService;

@RestController
@RequestMapping("/api/owner/properties/{propertyId}/documents")
@CrossOrigin(origins = "*")
@PreAuthorize("hasRole('PROPERTY_OWNER')")
public class OwnerPropertyDocumentController {

    private final PropertyDocumentService documentService;

    public OwnerPropertyDocumentController(PropertyDocumentService documentService) {
        this.documentService = documentService;
    }

    // =========================================================
    // UPLOAD PROPERTY DOCUMENT
    // =========================================================
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PropertyDocumentResponse> uploadDocument(
            @PathVariable Long propertyId,
            @RequestPart("file") MultipartFile file,
            @RequestParam("documentType") PropertyDocumentType documentType,
            Authentication authentication) {

        String ownerEmail = authentication.getName();
        PropertyDocumentResponse response = documentService.uploadDocument(
                propertyId, file, documentType, ownerEmail);

        return ResponseEntity.ok(response);
    }

    // =========================================================
    // GET ALL DOCUMENTS FOR PROPERTY
    // =========================================================
    @GetMapping
    public ResponseEntity<List<PropertyDocumentResponse>> getDocuments(
            @PathVariable Long propertyId,
            Authentication authentication) {

        String ownerEmail = authentication.getName();
        return ResponseEntity.ok(documentService.getDocumentsForOwner(propertyId, ownerEmail));
    }

    // =========================================================
    // GET SINGLE DOCUMENT
    // =========================================================
    @GetMapping("/{documentId}")
    public ResponseEntity<PropertyDocumentResponse> getDocument(
            @PathVariable Long propertyId,
            @PathVariable Long documentId,
            Authentication authentication) {

        String ownerEmail = authentication.getName();
        return ResponseEntity.ok(documentService.getDocumentForOwner(propertyId, documentId, ownerEmail));
    }

    // =========================================================
    // DOWNLOAD DOCUMENT
    // =========================================================
    @GetMapping("/{documentId}/download")
    public ResponseEntity<Resource> downloadDocument(
            @PathVariable Long propertyId,
            @PathVariable Long documentId,
            Authentication authentication) {

        String ownerEmail = authentication.getName();
        PropertyDocumentResponse docMeta = documentService.getDocumentForOwner(propertyId, documentId, ownerEmail);
        Resource file = documentService.downloadDocumentForOwner(propertyId, documentId, ownerEmail);

        String filename = docMeta.getFileName() != null ? docMeta.getFileName() : "property-document";
        String contentType = docMeta.getContentType() != null ? docMeta.getContentType() : "application/octet-stream";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(file);
    }

    // =========================================================
    // DELETE DOCUMENT (PENDING OR REJECTED ONLY)
    // =========================================================
    @DeleteMapping("/{documentId}")
    public ResponseEntity<String> deleteDocument(
            @PathVariable Long propertyId,
            @PathVariable Long documentId,
            Authentication authentication) {

        String ownerEmail = authentication.getName();
        documentService.deleteDocumentForOwner(propertyId, documentId, ownerEmail);
        return ResponseEntity.ok("Property document removed successfully");
    }

    // =========================================================
    // PUBLISH ELIGIBILITY CHECK
    // =========================================================
    @GetMapping("/publish-eligibility")
    public ResponseEntity<PropertyPublishEligibilityResponse> getPublishEligibility(
            @PathVariable Long propertyId,
            Authentication authentication) {

        String ownerEmail = authentication.getName();
        return ResponseEntity.ok(documentService.getPublishEligibility(propertyId, ownerEmail));
    }
}
