package com.rental.rental_management_backend.property.service;

import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.property.dto.PropertyDocumentResponse;
import com.rental.rental_management_backend.property.dto.PropertyPublishEligibilityResponse;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.enums.PropertyDocumentType;

public interface PropertyDocumentService {

    PropertyDocumentResponse uploadDocument(
            Long propertyId,
            MultipartFile file,
            PropertyDocumentType documentType,
            String ownerEmail);

    List<PropertyDocumentResponse> getDocumentsForOwner(
            Long propertyId,
            String ownerEmail);

    PropertyDocumentResponse getDocumentForOwner(
            Long propertyId,
            Long documentId,
            String ownerEmail);

    Resource downloadDocumentForOwner(
            Long propertyId,
            Long documentId,
            String ownerEmail);

    void deleteDocumentForOwner(
            Long propertyId,
            Long documentId,
            String ownerEmail);

    List<PropertyDocumentResponse> getPendingDocumentsForAdmin();

    List<PropertyDocumentResponse> getDocumentsByPropertyForAdmin(Long propertyId);

    PropertyDocumentResponse approveDocument(
            Long documentId,
            String adminEmail);

    PropertyDocumentResponse rejectDocument(
            Long documentId,
            String reason,
            String adminEmail);

    Resource downloadDocumentForAdmin(Long documentId);

    PropertyPublishEligibilityResponse getPublishEligibility(
            Long propertyId,
            String ownerEmail);

    void validatePropertyPublishEligibility(Property property);
}
