package com.rental.rental_management_backend.maintenancewroker.entity;

import com.rental.rental_management_backend.property.entity.Property;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "maintenance_worker_properties",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_maintenance_worker_property",
                columnNames = {"worker_id", "property_id"}))
public class MaintenanceWorkerProperty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worker_id", nullable = false)
    private MaintenanceWorker worker;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    public Long getId() {
        return id;
    }

    public MaintenanceWorker getWorker() {
        return worker;
    }

    public void setWorker(MaintenanceWorker worker) {
        this.worker = worker;
    }

    public Property getProperty() {
        return property;
    }

    public void setProperty(Property property) {
        this.property = property;
    }
}
