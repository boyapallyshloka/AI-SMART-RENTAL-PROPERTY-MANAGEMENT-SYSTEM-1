package com.rental.rental_management_backend.property.service;

import java.util.List;

import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.property.dto.PropertyDocumentDownload;
import com.rental.rental_management_backend.property.dto.PropertyDocumentResponse;
import com.rental.rental_management_backend.property.dto.PropertyDocumentVerificationRequest;
import com.rental.rental_management_backend.property.enums.PropertyDocumentType;

public interface PropertyDocumentService {

    PropertyDocumentResponse uploadDocument(
            String email,
            Long propertyId,
            MultipartFile file,
            PropertyDocumentType documentType,
            String documentName);

    List<PropertyDocumentResponse> getDocuments(
            String email,
            Long propertyId);

    List<PropertyDocumentResponse> getPendingDocuments();

    PropertyDocumentResponse getDocument(
            String email,
            Long propertyId,
            Long documentId);

    PropertyDocumentDownload downloadDocument(
            String email,
            Long propertyId,
            Long documentId);

    void deleteDocument(
            String email,
            Long propertyId,
            Long documentId);

    PropertyDocumentResponse updateVerificationStatus(
            String email,
            Long propertyId,
            Long documentId,
            PropertyDocumentVerificationRequest request);
}
