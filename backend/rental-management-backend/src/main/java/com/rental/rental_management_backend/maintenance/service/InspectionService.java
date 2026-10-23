package com.rental.rental_management_backend.maintenance.service;

import java.util.List;

import com.rental.rental_management_backend.maintenance.dto.InspectionRequest;
import com.rental.rental_management_backend.maintenance.dto.InspectionResponse;

public interface InspectionService {

    InspectionResponse createInspection(InspectionRequest request);

    InspectionResponse getInspectionById(Long inspectionId);

    List<InspectionResponse> getInspectionsByProperty(Long propertyId);

    InspectionResponse updateInspection(
            Long inspectionId,
            InspectionRequest request);

    void deleteInspection(Long inspectionId);
}
