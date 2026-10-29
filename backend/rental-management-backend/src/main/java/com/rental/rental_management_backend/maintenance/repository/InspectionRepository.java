package com.rental.rental_management_backend.maintenance.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.rental.rental_management_backend.maintenance.entity.Inspection;

@Repository
public interface InspectionRepository extends JpaRepository<Inspection, Long> {

    List<Inspection> findByProperty_PropertyId(Long propertyId);

    long countByProperty_PropertyId(Long propertyId);

    long countByProperty_PropertyIdAndHasIssuesRequiringAttentionTrue(Long propertyId);

    default List<Inspection> findByPropertyId(Long propertyId) {
        return findByProperty_PropertyId(propertyId);
    }

    default long countByPropertyId(Long propertyId) {
        return countByProperty_PropertyId(propertyId);
    }

    default long countByPropertyIdAndHasIssuesRequiringAttentionTrue(Long propertyId) {
        return countByProperty_PropertyIdAndHasIssuesRequiringAttentionTrue(propertyId);
    }
}