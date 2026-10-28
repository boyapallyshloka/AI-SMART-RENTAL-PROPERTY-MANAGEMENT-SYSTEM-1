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

@Entity
@Table(name = "property_inspections")
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

    public Inspection() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }
    public LocalDate getInspectionDate() { return inspectionDate; }
    public void setInspectionDate(LocalDate inspectionDate) { this.inspectionDate = inspectionDate; }
    public String getInspectorName() { return inspectorName; }
    public void setInspectorName(String inspectorName) { this.inspectorName = inspectorName; }
    public Boolean getPassed() { return passed; }
    public void setPassed(Boolean passed) { this.passed = passed; }
    public Boolean getHasIssuesRequiringAttention() { return hasIssuesRequiringAttention; }
    public void setHasIssuesRequiringAttention(Boolean hasIssuesRequiringAttention) {
        this.hasIssuesRequiringAttention = hasIssuesRequiringAttention;
    }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
