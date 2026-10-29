package com.rental.rental_management_backend.maintenance.entity;

import java.time.LocalDate;

import com.rental.rental_management_backend.property.entity.Property;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "property_inspections")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Inspection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    private LocalDate inspectionDate;

    private String inspectorName;

    @Column(nullable = false)
    private Boolean passed;

    @Column(nullable = false)
    private Boolean hasIssuesRequiringAttention;

    private String notes;
}