package com.rental.rental_management_backend.property.controller;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.property.dto.PropertyDocumentDownload;
import com.rental.rental_management_backend.property.dto.PropertyDocumentResponse;
import com.rental.rental_management_backend.property.dto.PropertyDocumentVerificationRequest;
import com.rental.rental_management_backend.property.enums.PropertyDocumentType;
import com.rental.rental_management_backend.property.service.PropertyDocumentService;

@RestController
@RequestMapping("/api/properties/{propertyId}/documents")
@PreAuthorize("hasAnyRole('PROPERTY_OWNER', 'PROPERTY_MANAGER', 'SUPER_ADMIN')")
public class PropertyDocumentController {

    private final PropertyDocumentService propertyDocumentService;

    public PropertyDocumentController(
            PropertyDocumentService propertyDocumentService) {
        this.propertyDocumentService = propertyDocumentService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PropertyDocumentResponse> uploadDocument(
            Authentication authentication,
            @PathVariable Long propertyId,
            @RequestPart("file") MultipartFile file,
            @RequestParam("documentType") PropertyDocumentType documentType,
            @RequestParam(value = "documentName", required = false)
                    String documentName) {
        return ResponseEntity.ok(propertyDocumentService.uploadDocument(
                authentication.getName(),
                propertyId,
                file,
                documentType,
                documentName));
    }

    @GetMapping
    public ResponseEntity<List<PropertyDocumentResponse>> getDocuments(
            Authentication authentication,
            @PathVariable Long propertyId) {
        return ResponseEntity.ok(propertyDocumentService.getDocuments(
                authentication.getName(),
                propertyId));
    }

    @GetMapping("/{documentId}")
    public ResponseEntity<PropertyDocumentResponse> getDocument(
            Authentication authentication,
            @PathVariable Long propertyId,
            @PathVariable Long documentId) {
        return ResponseEntity.ok(propertyDocumentService.getDocument(
                authentication.getName(),
                propertyId,
                documentId));
    }

    @GetMapping("/{documentId}/download")
    public ResponseEntity<Resource> downloadDocument(
            Authentication authentication,
            @PathVariable Long propertyId,
            @PathVariable Long documentId) {
        PropertyDocumentDownload download =
                propertyDocumentService.downloadDocument(
                        authentication.getName(),
                        propertyId,
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

    @DeleteMapping("/{documentId}")
    public ResponseEntity<Void> deleteDocument(
            Authentication authentication,
            @PathVariable Long propertyId,
            @PathVariable Long documentId) {
        propertyDocumentService.deleteDocument(
                authentication.getName(),
                propertyId,
                documentId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{documentId}/verification")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<PropertyDocumentResponse> updateVerificationStatus(
            Authentication authentication,
            @PathVariable Long propertyId,
            @PathVariable Long documentId,
            @RequestBody PropertyDocumentVerificationRequest request) {
        return ResponseEntity.ok(
                propertyDocumentService.updateVerificationStatus(
                        authentication.getName(),
                        propertyId,
                        documentId,
                        request));
    }
}
