
package com.rental.rental_management_backend.maintenance.service;

import java.io.IOException;
import java.util.List;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;

import com.rental.rental_management_backend.maintenance.dto.M5PredictionRequest;
import com.rental.rental_management_backend.maintenance.dto.M5PredictionResponse;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceRequestRequest;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceRequestResponse;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceCostUpdateRequest;
import com.rental.rental_management_backend.maintenance.dto.MaintenanceStatusUpdateRequest;
import com.rental.rental_management_backend.maintenance.entity.MaintenanceRequest;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePayer;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceStatus;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceCostResponsibility;
import com.rental.rental_management_backend.maintenance.repository.MaintenanceRequestRepository;

import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.service.NotificationService;

import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.repository.UnitRepository;

import com.rental.rental_management_backend.s3.service.S3Service;

import com.rental.rental_management_backend.tenant.entity.Tenant;
import com.rental.rental_management_backend.tenant.repository.TenantRepository;

@Service
@Transactional
public class MaintenanceRequestServiceImpl
        implements MaintenanceRequestService {

    // =========================================================
    // REPOSITORIES / SERVICES
    // =========================================================

    private final MaintenanceRequestRepository maintenanceRequestRepository;
    private final TenantRepository tenantRepository;
    private final PropertyRepository propertyRepository;
    private final UnitRepository unitRepository;
    private final MaintenanceImageService maintenanceImageService;
    private final S3Service s3Service;
    private final UserRepository userRepository;

    private final MaintenanceAiServiceClient maintenanceAiServiceClient;
    private final M5AggregationService m5AggregationService;

    // =========================================================
    // NOTIFICATION SERVICE
    // =========================================================

    private final NotificationService notificationService;

    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public MaintenanceRequestServiceImpl(
            MaintenanceRequestRepository maintenanceRequestRepository,
            TenantRepository tenantRepository,
            PropertyRepository propertyRepository,
            UnitRepository unitRepository,
            MaintenanceImageService maintenanceImageService,
            S3Service s3Service,
            UserRepository userRepository,
            MaintenanceAiServiceClient maintenanceAiServiceClient,
            M5AggregationService m5AggregationService,
            NotificationService notificationService) {

        this.maintenanceRequestRepository =
                maintenanceRequestRepository;

        this.tenantRepository =
                tenantRepository;

        this.propertyRepository =
                propertyRepository;

        this.unitRepository =
                unitRepository;

        this.maintenanceImageService =
                maintenanceImageService;

        this.s3Service =
                s3Service;

        this.userRepository =
                userRepository;

        this.maintenanceAiServiceClient =
                maintenanceAiServiceClient;

        this.m5AggregationService =
                m5AggregationService;

        this.notificationService =
                notificationService;
    }

    // =========================================================
    // CREATE MAINTENANCE REQUEST
    //
    // TENANT IS TAKEN FROM LOGGED-IN USER
    // =========================================================

    @Override
    public MaintenanceRequestResponse createRequest(
            MaintenanceRequestRequest request,
            MultipartFile image) throws IOException {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()) {

            throw new AccessDeniedException(
                    "User is not authenticated");
        }

        Object principal =
                authentication.getPrincipal();

        if (!(principal instanceof UserDetails)) {

            throw new AccessDeniedException(
                    "Unable to identify logged-in user");
        }

        UserDetails userDetails =
                (UserDetails) principal;

        String email =
                userDetails.getUsername();

        User user =
                userRepository
                        .findByEmail(email.toLowerCase().trim())
                        .orElseThrow(() ->
                                new AccessDeniedException(
                                        "Logged-in user not found"));

        // -----------------------------------------------------
        // CHECK TENANT ROLE
        // -----------------------------------------------------

        if (user.getRole() == null
                || !"TENANT".equals(
                        user.getRole().name())) {

            throw new AccessDeniedException(
                    "Only tenants can create maintenance requests");
        }

        // -----------------------------------------------------
        // FIND TENANT PROFILE
        // -----------------------------------------------------

        Tenant tenant =
                tenantRepository
                        .findByUser(user)
                        .orElseThrow(() ->
                                new AccessDeniedException(
                                        "Tenant profile not found "
                                                + "for logged-in user: "
                                                + email));

        // -----------------------------------------------------
        // FIND PROPERTY
        // -----------------------------------------------------

        Property property =
                propertyRepository
                        .findById(request.getPropertyId())
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found with ID: "
                                                + request.getPropertyId()));

        // -----------------------------------------------------
        // FIND UNIT
        // -----------------------------------------------------

        Unit unit =
                unitRepository
                        .findById(request.getUnitId())
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Unit not found with ID: "
                                                + request.getUnitId()));

        // -----------------------------------------------------
        // CREATE REQUEST
        // -----------------------------------------------------

        MaintenanceRequest maintenanceRequest =
                new MaintenanceRequest();

        maintenanceRequest.setTenant(tenant);

        maintenanceRequest.setProperty(property);

        maintenanceRequest.setUnit(unit);

        maintenanceRequest.setCategory(
                request.getCategory());

        maintenanceRequest.setDescription(
                request.getDescription());

        maintenanceRequest.setPriority(
                request.getPriority());

        if (request.getPayer() != null) {
            maintenanceRequest.setPayer(request.getPayer());
        }

        maintenanceRequest.setStatus(
                MaintenanceStatus.OPEN);

        // -----------------------------------------------------
        // OPTIONAL IMAGE
        // -----------------------------------------------------

        if (image != null && !image.isEmpty()) {

            String imageKey =
                    s3Service.uploadFile(image);

            maintenanceRequest.setImageUrl(imageKey);
        }

        // -----------------------------------------------------
        // SAVE
        // -----------------------------------------------------

        MaintenanceRequest savedRequest =
                maintenanceRequestRepository
                        .save(maintenanceRequest);

        // -----------------------------------------------------
        // NOTIFICATION
        //
        // Tenant creates maintenance request
        //              |
        //              v
        //       Save maintenance
        //              |
        //       +------+------+
        //       |             |
        //       v             v
        //    Owner          Manager
        //       |             |
        //       +------Notification
        //              |
        //              v
        //             SSE
        // -----------------------------------------------------

        notifyOwnerAndManagerAboutNewMaintenance(
                savedRequest);

        return mapToResponse(savedRequest);
    }

    // =========================================================
    // GET ALL MAINTENANCE REQUESTS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<MaintenanceRequestResponse> getAllRequests() {

        User user = getLoggedInUser();
        RoleType role = user.getRole();

        if (role == null) {

            throw new AccessDeniedException(
                    "User has no assigned role");
        }

        switch (role) {

            case TENANT:

                Tenant tenant =
                        tenantRepository
                                .findByUser(user)
                                .orElse(null);

                if (tenant == null) {
                    return List.of();
                }

                return maintenanceRequestRepository
                        .findByTenant_TenantId(
                                tenant.getTenantId())
                        .stream()
                        .map(this::mapToResponse)
                        .toList();

            case PROPERTY_OWNER:

                return maintenanceRequestRepository
                        .findByPropertyOwnerId(user.getId())
                        .stream()
                        .map(this::mapToResponse)
                        .toList();

            case PROPERTY_MANAGER:

                return maintenanceRequestRepository
                        .findByPropertyManagerUserId(user.getId())
                        .stream()
                        .map(this::mapToResponse)
                        .toList();

            case SUPER_ADMIN:

                return maintenanceRequestRepository
                        .findAll()
                        .stream()
                        .map(this::mapToResponse)
                        .toList();

            default:

                throw new AccessDeniedException(
                        "Role not authorized to view maintenance requests");
        }
    }

    // =========================================================
    // GET MAINTENANCE REQUEST BY ID
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public MaintenanceRequestResponse getRequestById(
            Long requestId) {

        MaintenanceRequest request =
                maintenanceRequestRepository
                        .findById(requestId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Maintenance request not found "
                                                + "with ID: "
                                                + requestId));

        User user = getLoggedInUser();
        RoleType role = user.getRole();

        if (role == null) {

            throw new AccessDeniedException(
                    "User has no assigned role");
        }

        // -----------------------------------------------------
        // TENANT SECURITY CHECK
        // -----------------------------------------------------

        if (role == RoleType.TENANT) {

            Tenant tenant =
                    tenantRepository
                            .findByUser(user)
                            .orElseThrow(() ->
                                    new AccessDeniedException(
                                            "Tenant profile not found "
                                                    + "for logged-in user"));

            if (request.getTenant() == null
                    || request.getTenant().getTenantId() == null) {

                throw new AccessDeniedException(
                        "Maintenance request has no tenant");
            }

            Long loggedInTenantId =
                    tenant.getTenantId();

            Long requestTenantId =
                    request.getTenant().getTenantId();

            if (!loggedInTenantId.equals(requestTenantId)) {

                throw new AccessDeniedException(
                        "You are not allowed to view "
                                + "this maintenance request");
            }
        }

        // -----------------------------------------------------
        // PROPERTY OWNER SECURITY CHECK
        // -----------------------------------------------------

        else if (role == RoleType.PROPERTY_OWNER) {

            if (request.getProperty() == null
                    || request.getProperty().getOwner() == null
                    || !user.getId().equals(
                            request.getProperty()
                                    .getOwner()
                                    .getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to view "
                                + "this maintenance request");
            }
        }

        // -----------------------------------------------------
        // PROPERTY MANAGER SECURITY CHECK
        // -----------------------------------------------------

        else if (role == RoleType.PROPERTY_MANAGER) {

            if (request.getProperty() == null
                    || request.getProperty()
                            .getPropertyManager() == null
                    || request.getProperty()
                            .getPropertyManager()
                            .getUser() == null
                    || !user.getId().equals(
                            request.getProperty()
                                    .getPropertyManager()
                                    .getUser()
                                    .getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to view "
                                + "this maintenance request");
            }
        }

        // -----------------------------------------------------
        // SUPER ADMIN
        // -----------------------------------------------------

        else if (role != RoleType.SUPER_ADMIN) {

            throw new AccessDeniedException(
                    "You are not allowed to view "
                            + "this maintenance request");
        }

        return mapToResponse(request);
    }

    // =========================================================
    // UPDATE MAINTENANCE REQUEST
    // =========================================================

    @Override
    public MaintenanceRequestResponse updateRequest(
            Long requestId,
            MaintenanceRequestRequest request,
            MultipartFile image) throws IOException {

        // -----------------------------------------------------
        // FIND EXISTING REQUEST
        // -----------------------------------------------------

        MaintenanceRequest existingRequest =
                maintenanceRequestRepository
                        .findById(requestId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Maintenance request not found "
                                                + "with ID: "
                                                + requestId));

        User user = getLoggedInUser();
        RoleType role = user.getRole();

        if (role == null) {

            throw new AccessDeniedException(
                    "User has no assigned role");
        }

        boolean isTenant =
                role == RoleType.TENANT;

        // -----------------------------------------------------
        // STORE OLD STATUS
        // -----------------------------------------------------

        MaintenanceStatus oldStatus =
                existingRequest.getStatus();

        // -----------------------------------------------------
        // TENANT SECURITY CHECK
        // -----------------------------------------------------

        if (isTenant) {

            Tenant loggedInTenant =
                    tenantRepository
                            .findByUser(user)
                            .orElseThrow(() ->
                                    new AccessDeniedException(
                                            "Tenant profile not found "
                                                    + "for logged-in user"));

            if (existingRequest.getTenant() == null
                    || existingRequest.getTenant()
                            .getTenantId() == null) {

                throw new AccessDeniedException(
                        "Maintenance request has no tenant");
            }

            Long loggedInTenantId =
                    loggedInTenant.getTenantId();

            Long requestTenantId =
                    existingRequest
                            .getTenant()
                            .getTenantId();

            if (!loggedInTenantId.equals(requestTenantId)) {

                throw new AccessDeniedException(
                        "You are not allowed to update "
                                + "this maintenance request");
            }

            MaintenanceStatus currentStatus =
                    existingRequest.getStatus();

            if (currentStatus != null
                    && currentStatus != MaintenanceStatus.OPEN) {

                throw new AccessDeniedException(
                        "You cannot update this maintenance request "
                                + "because it is already being processed");
            }
        }

        // -----------------------------------------------------
        // PROPERTY OWNER SECURITY CHECK
        // -----------------------------------------------------

        else if (role == RoleType.PROPERTY_OWNER) {

            if (existingRequest.getProperty() == null
                    || existingRequest.getProperty().getOwner() == null
                    || !user.getId().equals(
                            existingRequest.getProperty()
                                    .getOwner()
                                    .getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to update this maintenance request");
            }
        }

        // -----------------------------------------------------
        // PROPERTY MANAGER SECURITY CHECK
        // -----------------------------------------------------

        else if (role == RoleType.PROPERTY_MANAGER) {

            if (existingRequest.getProperty() == null
                    || existingRequest.getProperty()
                            .getPropertyManager() == null
                    || existingRequest.getProperty()
                            .getPropertyManager()
                            .getUser() == null
                    || !user.getId().equals(
                            existingRequest.getProperty()
                                    .getPropertyManager()
                                    .getUser()
                                    .getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to update this maintenance request");
            }
        }

        // -----------------------------------------------------
        // SUPER ADMIN
        // -----------------------------------------------------

        else if (role != RoleType.SUPER_ADMIN) {

            throw new AccessDeniedException(
                    "You are not allowed to update this maintenance request");
        }

        // -----------------------------------------------------
        // FIND PROPERTY
        // -----------------------------------------------------

        Property property =
                propertyRepository
                        .findById(request.getPropertyId())
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found with ID: "
                                                + request.getPropertyId()));

        if (role == RoleType.PROPERTY_OWNER) {

            if (property.getOwner() == null
                    || !user.getId().equals(
                            property.getOwner().getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to assign maintenance request "
                                + "to an unowned property");
            }

        } else if (role == RoleType.PROPERTY_MANAGER) {

            if (property.getPropertyManager() == null
                    || property.getPropertyManager().getUser() == null
                    || !user.getId().equals(
                            property.getPropertyManager()
                                    .getUser()
                                    .getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to assign maintenance request "
                                + "to an unmanaged property");
            }
        }

        // -----------------------------------------------------
        // FIND UNIT
        // -----------------------------------------------------

        Unit unit =
                unitRepository
                        .findById(request.getUnitId())
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Unit not found with ID: "
                                                + request.getUnitId()));

        // -----------------------------------------------------
        // TENANT HANDLING
        // -----------------------------------------------------

        Tenant tenant;

        if (isTenant) {

            tenant =
                    existingRequest.getTenant();

        } else {

            tenant =
                    tenantRepository
                            .findById(request.getTenantId())
                            .orElseThrow(() ->
                                    new ResourceNotFoundException(
                                            "Tenant not found with ID: "
                                                    + request.getTenantId()));
        }

        // -----------------------------------------------------
        // UPDATE BASIC FIELDS
        // -----------------------------------------------------

        existingRequest.setTenant(tenant);

        existingRequest.setProperty(property);

        existingRequest.setUnit(unit);

        existingRequest.setCategory(
                request.getCategory());

        existingRequest.setDescription(
                request.getDescription());

        existingRequest.setPriority(
                request.getPriority());

        // -----------------------------------------------------
        // UPDATE STATUS
        // -----------------------------------------------------

        if (request.getStatus() != null) {

            existingRequest.setStatus(
                    request.getStatus());
        }

        // -----------------------------------------------------
        // UPDATE COMPLETED DATE
        // -----------------------------------------------------

        if (request.getCompletedDate() != null) {

            existingRequest.setCompletedDate(
                    request.getCompletedDate());
        }

        // -----------------------------------------------------
        // UPDATE COST
        // -----------------------------------------------------

        if (request.getCost() != null) {

            existingRequest.setCost(
                    request.getCost());
        }

        if (request.getPayer() != null) {
            existingRequest.setPayer(request.getPayer());
        }

        // -----------------------------------------------------
        // UPDATE IMAGE
        // -----------------------------------------------------

        if (image != null && !image.isEmpty()) {

            String imageKey =
                    s3Service.uploadFile(image);

            existingRequest.setImageUrl(imageKey);
        }

        // -----------------------------------------------------
        // SAVE
        // -----------------------------------------------------

        MaintenanceRequest updatedRequest =
                maintenanceRequestRepository
                        .save(existingRequest);

        // -----------------------------------------------------
        // NOTIFY TENANT IF STATUS CHANGED
        // -----------------------------------------------------

        MaintenanceStatus newStatus =
                updatedRequest.getStatus();

        if (oldStatus != newStatus) {

            notifyTenantAboutMaintenanceStatus(
                    updatedRequest);
        }

        return mapToResponse(updatedRequest);
    }

    // =========================================================
    // UPDATE STATUS
    // =========================================================

    @Override
    public MaintenanceRequestResponse updateStatus(
            Long ticketId,
            MaintenanceStatusUpdateRequest request) {

        // -----------------------------------------------------
        // VALIDATE REQUEST BODY
        // -----------------------------------------------------

        if (request == null
                || request.getStatus() == null
                || request.getStatus().trim().isEmpty()) {

            throw new IllegalArgumentException(
                    "Status is required");
        }

        // -----------------------------------------------------
        // FIND REQUEST
        // -----------------------------------------------------

        MaintenanceRequest maintenanceRequest =
                maintenanceRequestRepository
                        .findById(ticketId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Maintenance request not found "
                                                + "with ID: "
                                                + ticketId));

        // -----------------------------------------------------
        // STORE OLD STATUS
        // -----------------------------------------------------

        MaintenanceStatus oldStatus =
                maintenanceRequest.getStatus();

        // -----------------------------------------------------
        // AUTHORIZATION CHECK
        // -----------------------------------------------------

        User user = getLoggedInUser();
        RoleType role = user.getRole();

        if (role == RoleType.PROPERTY_OWNER) {

            if (maintenanceRequest.getProperty() == null
                    || maintenanceRequest.getProperty().getOwner() == null
                    || !user.getId().equals(
                            maintenanceRequest.getProperty()
                                    .getOwner()
                                    .getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to update the status "
                                + "of this maintenance request");
            }

        } else if (role == RoleType.PROPERTY_MANAGER) {

            if (maintenanceRequest.getProperty() == null
                    || maintenanceRequest.getProperty()
                            .getPropertyManager() == null
                    || maintenanceRequest.getProperty()
                            .getPropertyManager()
                            .getUser() == null
                    || !user.getId().equals(
                            maintenanceRequest.getProperty()
                                    .getPropertyManager()
                                    .getUser()
                                    .getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to update the status "
                                + "of this maintenance request");
            }

        } else if (role != RoleType.SUPER_ADMIN) {

            throw new AccessDeniedException(
                    "You are not allowed to update the status "
                            + "of this maintenance request");
        }

        // -----------------------------------------------------
        // CONVERT STRING TO ENUM
        // -----------------------------------------------------

        MaintenanceStatus newStatus;

        try {

            newStatus =
                    MaintenanceStatus.valueOf(
                            request.getStatus()
                                    .trim()
                                    .toUpperCase());

        } catch (IllegalArgumentException e) {

            throw new IllegalArgumentException(
                    "Invalid maintenance status: "
                            + request.getStatus());
        }

        // -----------------------------------------------------
        // UPDATE STATUS
        // -----------------------------------------------------

        maintenanceRequest.setStatus(newStatus);

        // -----------------------------------------------------
        // SAVE
        // -----------------------------------------------------

        MaintenanceRequest updatedRequest =
                maintenanceRequestRepository
                        .save(maintenanceRequest);

        // -----------------------------------------------------
        // NOTIFICATION
        //
        // Only notify when status actually changes.
        // -----------------------------------------------------

        if (oldStatus != newStatus) {

            notifyTenantAboutMaintenanceStatus(
                    updatedRequest);
        }

        return mapToResponse(updatedRequest);
    }

    @Override
    public MaintenanceRequestResponse updateCost(
            Long ticketId,
            MaintenanceCostUpdateRequest request) {

        if (request == null || request.getCost() == null
                || request.getCostResponsibility() == null) {
            throw new IllegalArgumentException(
                    "Repair amount and payer responsibility are required");
        }
        if (request.getCost().signum() < 0) {
            throw new IllegalArgumentException("Repair amount cannot be negative");
        }

        MaintenanceRequest ticket = maintenanceRequestRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Maintenance request not found with ID: " + ticketId));
        User user = getLoggedInUser();
        RoleType role = user.getRole();

        if (role == RoleType.PROPERTY_OWNER) {
            if (ticket.getProperty() == null || ticket.getProperty().getOwner() == null
                    || !user.getId().equals(ticket.getProperty().getOwner().getId())) {
                throw new AccessDeniedException("You are not allowed to update this maintenance cost");
            }
        } else if (role == RoleType.PROPERTY_MANAGER) {
            if (ticket.getProperty() == null || ticket.getProperty().getPropertyManager() == null
                    || ticket.getProperty().getPropertyManager().getUser() == null
                    || !user.getId().equals(ticket.getProperty().getPropertyManager().getUser().getId())) {
                throw new AccessDeniedException("You are not allowed to update this maintenance cost");
            }
        } else if (role != RoleType.SUPER_ADMIN) {
            throw new AccessDeniedException("You are not allowed to update this maintenance cost");
        }

        ticket.setCost(request.getCost());
        ticket.setCostResponsibility(request.getCostResponsibility());
        return mapToResponse(maintenanceRequestRepository.save(ticket));
    }

    // =========================================================
    // DELETE MAINTENANCE REQUEST
    // =========================================================

    @Override
    public void deleteRequest(Long requestId) {

        // -----------------------------------------------------
        // FIND REQUEST
        // -----------------------------------------------------

        MaintenanceRequest request =
                maintenanceRequestRepository
                        .findById(requestId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Maintenance request not found "
                                                + "with ID: "
                                                + requestId));

        // -----------------------------------------------------
        // GET LOGGED-IN USER
        // -----------------------------------------------------

        User user = getLoggedInUser();
        RoleType role = user.getRole();

        if (role == null) {

            throw new AccessDeniedException(
                    "User has no assigned role");
        }

        // -----------------------------------------------------
        // TENANT SECURITY CHECK
        // -----------------------------------------------------

        if (role == RoleType.TENANT) {

            Tenant loggedInTenant =
                    tenantRepository
                            .findByUser(user)
                            .orElseThrow(() ->
                                    new AccessDeniedException(
                                            "Tenant profile not found "
                                                    + "for logged-in user"));

            if (request.getTenant() == null
                    || request.getTenant().getTenantId() == null) {

                throw new AccessDeniedException(
                        "Maintenance request has no tenant");
            }

            Long loggedInTenantId =
                    loggedInTenant.getTenantId();

            Long requestTenantId =
                    request.getTenant()
                            .getTenantId();

            if (!loggedInTenantId.equals(requestTenantId)) {

                throw new AccessDeniedException(
                        "You are not allowed to delete "
                                + "this maintenance request");
            }

            if (request.getStatus()
                    != MaintenanceStatus.OPEN) {

                throw new AccessDeniedException(
                        "You can delete a maintenance request "
                                + "only while its status is OPEN");
            }
        }

        // -----------------------------------------------------
        // PROPERTY OWNER SECURITY CHECK
        // -----------------------------------------------------

        else if (role == RoleType.PROPERTY_OWNER) {

            if (request.getProperty() == null
                    || request.getProperty().getOwner() == null
                    || !user.getId().equals(
                            request.getProperty()
                                    .getOwner()
                                    .getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to delete "
                                + "this maintenance request");
            }
        }

        // -----------------------------------------------------
        // PROPERTY MANAGER SECURITY CHECK
        // -----------------------------------------------------

        else if (role == RoleType.PROPERTY_MANAGER) {

            if (request.getProperty() == null
                    || request.getProperty()
                            .getPropertyManager() == null
                    || request.getProperty()
                            .getPropertyManager()
                            .getUser() == null
                    || !user.getId().equals(
                            request.getProperty()
                                    .getPropertyManager()
                                    .getUser()
                                    .getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to delete "
                                + "this maintenance request");
            }
        }

        // -----------------------------------------------------
        // SUPER ADMIN
        // -----------------------------------------------------

        else if (role != RoleType.SUPER_ADMIN) {

            throw new AccessDeniedException(
                    "You are not allowed to delete "
                            + "this maintenance request");
        }

        // -----------------------------------------------------
        // DELETE
        // -----------------------------------------------------

        maintenanceRequestRepository.delete(request);
    }

    // =========================================================
    // AI MAINTENANCE PREDICTION
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public M5PredictionResponse predictMaintenance(
            Long propertyId,
            Long unitId) {

        Property property =
                propertyRepository
                        .findById(propertyId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found with ID: "
                                                + propertyId));

        User user = getLoggedInUser();
        RoleType role = user.getRole();

        if (role == RoleType.PROPERTY_OWNER) {

            if (property.getOwner() == null
                    || !user.getId().equals(
                            property.getOwner().getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to run predictive "
                                + "maintenance for this property");
            }

        } else if (role == RoleType.PROPERTY_MANAGER) {

            if (property.getPropertyManager() == null
                    || property.getPropertyManager().getUser() == null
                    || !user.getId().equals(
                            property.getPropertyManager()
                                    .getUser()
                                    .getId())) {

                throw new AccessDeniedException(
                        "You are not allowed to run predictive "
                                + "maintenance for this property");
            }

        } else if (role != RoleType.SUPER_ADMIN) {

            throw new AccessDeniedException(
                    "You are not allowed to run predictive "
                            + "maintenance for this property");
        }

        Unit unit =
                unitRepository
                        .findById(unitId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Unit not found with ID: "
                                                + unitId));

        M5PredictionRequest request =
                m5AggregationService
                        .aggregate(property, unit);

        return maintenanceAiServiceClient
                .predictMaintenance(request);
    }

    // =========================================================
    // NOTIFICATION:
    // NEW MAINTENANCE REQUEST
    //
    // RECIPIENTS:
    // 1. PROPERTY OWNER
    // 2. PROPERTY MANAGER
    // =========================================================

    private void notifyOwnerAndManagerAboutNewMaintenance(
            MaintenanceRequest request) {

        if (request == null
                || request.getProperty() == null) {

            return;
        }

        Property property =
                request.getProperty();

        // -----------------------------------------------------
        // NOTIFY PROPERTY OWNER
        // -----------------------------------------------------

        if (property.getOwner() != null
                && property.getOwner().getId() != null) {

            notificationService.notifyUser(

                    property.getOwner().getId(),

                    NotificationType.MAINTENANCE_CREATED,

                    NotificationPriority.MEDIUM,

                    "New Maintenance Request",

                    "A new maintenance request has been created "
                            + "for your property.",

                    request.getRequestId(),

                    "MAINTENANCE"
            );
        }

        // -----------------------------------------------------
        // NOTIFY PROPERTY MANAGER
        // -----------------------------------------------------

        if (property.getPropertyManager() != null
                && property.getPropertyManager().getUser() != null
                && property.getPropertyManager()
                        .getUser()
                        .getId() != null) {

            Long managerUserId =
                    property.getPropertyManager()
                            .getUser()
                            .getId();

            // Avoid sending duplicate notification
            // if owner and manager happen to be same user.

            if (property.getOwner() == null
                    || property.getOwner().getId() == null
                    || !property.getOwner()
                            .getId()
                            .equals(managerUserId)) {

                notificationService.notifyUser(

                        managerUserId,

                        NotificationType.MAINTENANCE_CREATED,

                        NotificationPriority.MEDIUM,

                        "New Maintenance Request",

                        "A new maintenance request has been created "
                                + "for a property assigned to you.",

                        request.getRequestId(),

                        "MAINTENANCE"
                );
            }
        }
    }

    // =========================================================
    // NOTIFICATION:
    // MAINTENANCE STATUS UPDATED
    //
    // RECIPIENT:
    // TENANT
    // =========================================================

    private void notifyTenantAboutMaintenanceStatus(
            MaintenanceRequest request) {

        if (request == null
                || request.getTenant() == null
                || request.getTenant().getUser() == null
                || request.getTenant()
                        .getUser()
                        .getId() == null) {

            return;
        }

        Long tenantUserId =
                request.getTenant()
                        .getUser()
                        .getId();

        // -----------------------------------------------------
        // COMPLETED
        // -----------------------------------------------------

        if (request.getStatus()
                == MaintenanceStatus.COMPLETED) {

            notificationService.notifyUser(

                    tenantUserId,

                    NotificationType.MAINTENANCE_COMPLETED,

                    NotificationPriority.HIGH,

                    "Maintenance Completed",

                    "Your maintenance request has been completed.",

                    request.getRequestId(),

                    "MAINTENANCE"
            );

            return;
        }

        // -----------------------------------------------------
        // OTHER STATUS CHANGES
        // -----------------------------------------------------

        notificationService.notifyUser(

                tenantUserId,

                NotificationType.MAINTENANCE_STATUS_UPDATED,

                NotificationPriority.MEDIUM,

                "Maintenance Status Updated",

                "The status of your maintenance request has been "
                        + "updated to "
                        + request.getStatus()
                        + ".",

                request.getRequestId(),

                "MAINTENANCE"
        );
    }

    // =========================================================
    // HELPER METHOD
    // GET CURRENT LOGGED-IN USER
    // =========================================================

    private User getLoggedInUser() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()) {

            throw new AccessDeniedException(
                    "User is not authenticated");
        }

        Object principal =
                authentication.getPrincipal();

        String email;

        if (principal instanceof UserDetails) {

            email =
                    ((UserDetails) principal)
                            .getUsername();

        } else if (principal instanceof String) {

            email = (String) principal;

        } else {

            email = authentication.getName();
        }

        if (email == null || email.isBlank()) {

            throw new AccessDeniedException(
                    "Unable to identify logged-in user");
        }

        return userRepository
                .findByEmail(
                        email.toLowerCase().trim())
                .orElseThrow(() ->
                        new AccessDeniedException(
                                "Logged-in user not found"));
    }

    // =========================================================
    // MAP ENTITY TO RESPONSE DTO
    //
    // DATABASE:
    //     images/filename.webp
    //
    // API:
    //     Temporary S3 presigned URL
    //
    // URL VALIDITY:
    //     10 minutes
    // =========================================================

    private MaintenanceRequestResponse mapToResponse(
            MaintenanceRequest request) {

        MaintenanceRequestResponse response =
                new MaintenanceRequestResponse();

        // -----------------------------------------------------
        // REQUEST ID
        // -----------------------------------------------------

        response.setRequestId(
                request.getRequestId());

        // -----------------------------------------------------
        // TENANT
        // -----------------------------------------------------

        if (request.getTenant() != null) {

            response.setTenantId(
                    request.getTenant()
                            .getTenantId());
        }

        // -----------------------------------------------------
        // PROPERTY
        // -----------------------------------------------------

        if (request.getProperty() != null) {

            response.setPropertyId(
                    request.getProperty()
                            .getPropertyId());
        }

        // -----------------------------------------------------
        // UNIT
        // -----------------------------------------------------

        if (request.getUnit() != null) {

            response.setUnitId(
                    request.getUnit()
                            .getUnitId());
        }

        // -----------------------------------------------------
        // MAINTENANCE DETAILS
        // -----------------------------------------------------

        response.setCategory(
                request.getCategory());

        response.setDescription(
                request.getDescription());

        response.setPriority(
                request.getPriority());

        response.setStatus(
                request.getStatus());

        // -----------------------------------------------------
        // S3 IMAGE
        // -----------------------------------------------------

        if (request.getImageUrl() != null
                && !request.getImageUrl().isBlank()) {

            response.setImageUrl(
                    s3Service.generatePresignedUrl(
                            request.getImageUrl()
                    )
            );
        }

        // -----------------------------------------------------
        // DATES
        // -----------------------------------------------------

        response.setRequestedDate(
                request.getRequestedDate());

        response.setCompletedDate(
                request.getCompletedDate());

        // -----------------------------------------------------
        // COST
        // -----------------------------------------------------

        response.setCost(
                request.getCost());

        response.setCostResponsibility(
                request.getCostResponsibility());

        return response;
    }
}
