package com.rental.rental_management_backend.maintenance.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class InspectionCreateRequest {

    @NotNull
    @Positive
    private Long propertyId;

    @NotNull
    private LocalDate inspectionDate;

    @NotBlank
    private String inspectorName;

    @NotNull
    private Boolean passed;

    @NotNull
    private Boolean hasIssuesRequiringAttention;

    private String notes;
}
