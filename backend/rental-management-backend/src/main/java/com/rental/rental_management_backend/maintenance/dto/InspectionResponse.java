package com.rental.rental_management_backend.maintenance.dto;

import java.time.LocalDate;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class InspectionResponse {

    private Long id;
    private Long propertyId;
    private String propertyName;
    private LocalDate inspectionDate;
    private String inspectorName;
    private Boolean passed;
    private Boolean hasIssuesRequiringAttention;
    private String notes;
}
