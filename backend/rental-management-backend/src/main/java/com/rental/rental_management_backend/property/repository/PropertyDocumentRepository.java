package com.rental.rental_management_backend.property.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.rental.rental_management_backend.property.entity.PropertyDocument;

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
}
