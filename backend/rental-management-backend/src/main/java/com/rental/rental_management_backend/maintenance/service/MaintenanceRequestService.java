package com.rental.rental_management_backend.maintenance.service;

import java.io.IOException;
import java.util.List;

import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.maintenance.dto.M5PredictionResponse;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceRequestRequest;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceRequestResponse;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceStatusUpdateRequest;

public interface MaintenanceRequestService {

    /*
     * Create maintenance request
     *
     * Tenant creates request with optional image
     */
    MaintenanceRequestResponse createRequest(
            MaintenanceRequestRequest request,
            MultipartFile image) throws IOException;


    /*
     * Get all maintenance requests
     *
     * Access depends on user role
     */
    List<MaintenanceRequestResponse> getAllRequests();


    /*
     * Get maintenance request by ID
     */
    MaintenanceRequestResponse getRequestById(
            Long requestId);


    /*
     * Update maintenance request
     *
     * Optional image update
     */
    MaintenanceRequestResponse updateRequest(
            Long requestId,
            MaintenanceRequestRequest request,
            MultipartFile image) throws IOException;


    /*
     * Delete maintenance request
     */
    void deleteRequest(
            Long requestId);


    /*
     * Update maintenance request status
     *
     * Example:
     * OPEN
     * IN_PROGRESS
     * COMPLETED
     */
    MaintenanceRequestResponse updateStatus(
            Long ticketId,
            MaintenanceStatusUpdateRequest request);


    /*
     * M5 AI Maintenance Prediction
     *
     * Property Manager / Property Owner /
     * Super Admin can predict future maintenance
     */
    M5PredictionResponse predictMaintenance(
            Long propertyId,
            Long unitId);

}