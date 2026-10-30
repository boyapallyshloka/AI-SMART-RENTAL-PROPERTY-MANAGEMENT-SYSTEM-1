package com.rental.rental_management_backend.property.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.rental.rental_management_backend.property.entity.PropertyDocument;
import com.rental.rental_management_backend.property.enums.PropertyDocumentType;
import com.rental.rental_management_backend.tenant.enums.DocumentVerificationStatus;

public interface PropertyDocumentRepository
        extends JpaRepository<PropertyDocument, Long> {

    @EntityGraph(attributePaths = {"property", "verifiedBy"})
    List<PropertyDocument> findByProperty_PropertyIdOrderByUploadedAtDesc(
            Long propertyId);

    @EntityGraph(attributePaths = {
            "property",
            "property.owner",
            "property.propertyManager.user",
            "verifiedBy"
    })
    Optional<PropertyDocument> findByDocumentIdAndProperty_PropertyId(
            Long documentId,
            Long propertyId);

    @EntityGraph(attributePaths = {
            "property",
            "property.owner",
            "verifiedBy"
    })
    List<PropertyDocument> findByVerificationStatusOrderByUploadedAtDesc(
            DocumentVerificationStatus verificationStatus);

    List<PropertyDocument> findByProperty_PropertyIdAndDocumentTypeIn(
            Long propertyId,
            List<PropertyDocumentType> documentTypes);

    @EntityGraph(attributePaths = {
            "property",
            "property.owner",
            "verifiedBy"
    })
    @Query("""
            SELECT document
            FROM PropertyDocument document
            WHERE document.documentId = :documentId
            """)
    Optional<PropertyDocument> findByDocumentIdWithAdminDetails(
            @Param("documentId") Long documentId);
}
