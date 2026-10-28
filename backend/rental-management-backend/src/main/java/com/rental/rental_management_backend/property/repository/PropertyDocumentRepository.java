package com.rental.rental_management_backend.property.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyDocument;
import com.rental.rental_management_backend.property.enums.PropertyDocumentStatus;
import com.rental.rental_management_backend.property.enums.PropertyDocumentType;

public interface PropertyDocumentRepository extends JpaRepository<PropertyDocument, Long> {

    @EntityGraph(attributePaths = {"property", "reviewedBy"})
    List<PropertyDocument> findByPropertyOrderByUploadedAtDesc(Property property);

    @EntityGraph(attributePaths = {"property", "reviewedBy"})
    Optional<PropertyDocument> findByDocumentIdAndProperty(Long documentId, Property property);

    @EntityGraph(attributePaths = {"property", "property.owner", "reviewedBy"})
    List<PropertyDocument> findByStatusOrderByUploadedAtAsc(PropertyDocumentStatus status);

    @EntityGraph(attributePaths = {"property", "property.owner", "reviewedBy"})
    List<PropertyDocument> findByProperty_PropertyIdOrderByUploadedAtDesc(Long propertyId);

    long countByPropertyAndStatus(Property property, PropertyDocumentStatus status);

    long countByPropertyAndDocumentTypeAndStatus(
            Property property,
            PropertyDocumentType documentType,
            PropertyDocumentStatus status);

    List<PropertyDocument> findByPropertyAndDocumentType(
            Property property,
            PropertyDocumentType documentType);

    @Query("""
        SELECT pd FROM PropertyDocument pd
        JOIN FETCH pd.property p
        JOIN FETCH p.owner o
        LEFT JOIN FETCH pd.reviewedBy r
        WHERE pd.status = :status
        ORDER BY pd.uploadedAt ASC
    """)
    List<PropertyDocument> findAllPendingWithDetails(@Param("status") PropertyDocumentStatus status);
}
