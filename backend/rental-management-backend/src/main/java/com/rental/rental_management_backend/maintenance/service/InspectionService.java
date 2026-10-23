package com.rental.rental_management_backend.maintenance.service;

import java.util.List;

import com.rental.rental_management_backend.maintenance.dto.InspectionCreateRequest;
import com.rental.rental_management_backend.maintenance.dto.InspectionResponse;

public interface InspectionService {

    List<InspectionResponse> getManagerInspections();

    InspectionResponse createManagerInspection(InspectionCreateRequest request);
}
