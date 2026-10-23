
package com.rental.rental_management_backend.maintenanceAssignment.service;

import java.util.List;
import java.util.Set;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;

import com.rental.rental_management_backend.maintenance.entity.MaintenanceRequest;
import com.rental.rental_management_backend.maintenance.service.MaintenancePropertyAccessService;
import com.rental.rental_management_backend.maintenance.repository.MaintenanceRequestRepository;

import com.rental.rental_management_backend.maintenanceAssignment.entity.MaintenanceAssignment;
import com.rental.rental_management_backend.maintenanceAssignment.repository.MaintenanceAssignmentRepository;
import com.rental.rental_management_backend.maintenancewroker.entity.MaintenanceWorker;
import com.rental.rental_management_backend.maintenancewroker.repository.MaintenanceWorkerPropertyRepository;
import com.rental.rental_management_backend.maintenancewroker.repository.MaintenanceWorkerRepository;
import com.rental.rental_management_backend.property.entity.Property;

import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.service.NotificationService;

@Service
@Transactional
public class MaintenanceAssignmentServiceImpl
        implements MaintenanceAssignmentService {

    // =========================================================
    // REPOSITORIES / SERVICES
    // =========================================================

    private final MaintenanceAssignmentRepository assignmentRepository;

    private final MaintenanceRequestRepository maintenanceRequestRepository;

    private final MaintenanceWorkerRepository workerRepository;

    private final MaintenanceWorkerPropertyRepository workerPropertyRepository;

    private final MaintenancePropertyAccessService propertyAccessService;

    private final NotificationService notificationService;

    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public MaintenanceAssignmentServiceImpl(
            MaintenanceAssignmentRepository assignmentRepository,
            MaintenanceRequestRepository maintenanceRequestRepository,
            MaintenanceWorkerRepository workerRepository,
            MaintenanceWorkerPropertyRepository workerPropertyRepository,
            MaintenancePropertyAccessService propertyAccessService,
            NotificationService notificationService) {

        this.assignmentRepository = assignmentRepository;
        this.maintenanceRequestRepository = maintenanceRequestRepository;
        this.workerRepository = workerRepository;
        this.workerPropertyRepository = workerPropertyRepository;
        this.propertyAccessService = propertyAccessService;
        this.notificationService = notificationService;
    }

    // =========================================================
    // CREATE ASSIGNMENT
    // =========================================================

    @Override
    public MaintenanceAssignment createAssignment(
            MaintenanceAssignment assignment) {

        User loggedInUser =
                propertyAccessService.getAuthenticatedUser();
        MaintenanceRequest maintenanceRequest =
                findMaintenanceRequest(assignment);
        assertPropertyAccess(loggedInUser, maintenanceRequest.getProperty());

        MaintenanceWorker worker = findWorker(assignment);
        requireWorkerProperty(worker, maintenanceRequest.getProperty());

        assignment.setMaintenanceRequest(maintenanceRequest);
        assignment.setWorker(worker);

        // -----------------------------------------------------
        // AUTOMATICALLY SET ASSIGNED BY
        // -----------------------------------------------------

        // Do NOT trust assignedBy sent from Swagger.
        assignment.setAssignedBy(
                loggedInUser.getId());

        // -----------------------------------------------------
        // SAVE ASSIGNMENT
        // -----------------------------------------------------

        MaintenanceAssignment savedAssignment =
                assignmentRepository.save(assignment);

        System.out.println(
                "==================================================");

        System.out.println(
                "MAINTENANCE ASSIGNMENT CREATED");

        System.out.println(
                "Assignment ID: "
                        + savedAssignment.getId());

        System.out.println(
                "Assigned By User ID: "
                        + savedAssignment.getAssignedBy());

        System.out.println(
                "==================================================");

        // -----------------------------------------------------
        // SEND NOTIFICATION TO TENANT
        // -----------------------------------------------------

        notifyTenantAboutMaintenanceAssignment(
                savedAssignment);

        return savedAssignment;
    }

    // =========================================================
    // GET ALL ASSIGNMENTS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<MaintenanceAssignment> getAllAssignments() {

        User user = propertyAccessService.getAuthenticatedUser();
        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return assignmentRepository.findAll();
        }

        Set<Long> propertyIds =
                propertyAccessService.getAuthorizedPropertyIds(user);
        if (propertyIds.isEmpty()) {
            return List.of();
        }

        return assignmentRepository
                .findByMaintenancePropertyIds(propertyIds);
    }

    // =========================================================
    // GET ASSIGNMENT BY ID
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public MaintenanceAssignment getAssignmentById(
            Long id) {

        MaintenanceAssignment assignment = assignmentRepository
                .findAssignmentWithDetails(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Maintenance Assignment not found with id: "
                                        + id));

        assertPropertyAccess(
                propertyAccessService.getAuthenticatedUser(),
                assignment.getMaintenanceRequest().getProperty());
        return assignment;
    }

    // =========================================================
    // UPDATE ASSIGNMENT
    // =========================================================

    @Override
    public MaintenanceAssignment updateAssignment(
            Long id,
            MaintenanceAssignment assignment) {

        // -----------------------------------------------------
        // FIND EXISTING ASSIGNMENT
        // -----------------------------------------------------

        MaintenanceAssignment existingAssignment =
                assignmentRepository
                        .findById(id)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Maintenance Assignment not found with id: "
                                                + id));

        User user = propertyAccessService.getAuthenticatedUser();
        assertPropertyAccess(
                user,
                existingAssignment.getMaintenanceRequest().getProperty());

        MaintenanceRequest maintenanceRequest =
                findMaintenanceRequest(assignment);
        assertPropertyAccess(user, maintenanceRequest.getProperty());

        MaintenanceWorker worker = findWorker(assignment);
        requireWorkerProperty(worker, maintenanceRequest.getProperty());

        // -----------------------------------------------------
        // CHECK WHETHER WORKER CHANGED
        // -----------------------------------------------------

        boolean workerChanged =
                existingAssignment.getWorker() == null
                        || !existingAssignment.getWorker()
                                .getWorkerId()
                                .equals(worker.getWorkerId());

        // -----------------------------------------------------
        // UPDATE ASSIGNMENT DETAILS
        // -----------------------------------------------------

        existingAssignment.setMaintenanceRequest(
                maintenanceRequest);

        existingAssignment.setWorker(
                worker);

        // DO NOT UPDATE assignedBy.
        // Original assignedBy is preserved.

        existingAssignment.setAssignedAt(
                assignment.getAssignedAt());

        existingAssignment.setEstimatedCompletionDate(
                assignment.getEstimatedCompletionDate());

        existingAssignment.setActualCompletionDate(
                assignment.getActualCompletionDate());

        existingAssignment.setStatus(
                assignment.getStatus());

        existingAssignment.setNotes(
                assignment.getNotes());

        // -----------------------------------------------------
        // SAVE UPDATED ASSIGNMENT
        // -----------------------------------------------------

        MaintenanceAssignment updatedAssignment =
                assignmentRepository.save(
                        existingAssignment);

        // -----------------------------------------------------
        // NOTIFY TENANT IF WORKER WAS CHANGED
        // -----------------------------------------------------

        if (workerChanged) {

            notifyTenantAboutMaintenanceAssignment(
                    updatedAssignment);
        }

        return updatedAssignment;
    }

    // =========================================================
    // DELETE ASSIGNMENT
    // =========================================================

    @Override
    public void deleteAssignment(Long id) {

        MaintenanceAssignment assignment =
                assignmentRepository
                        .findById(id)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Maintenance Assignment not found with id: "
                                                + id));

        assertPropertyAccess(
                propertyAccessService.getAuthenticatedUser(),
                assignment.getMaintenanceRequest().getProperty());

        assignmentRepository.delete(assignment);
    }

    private MaintenanceRequest findMaintenanceRequest(
            MaintenanceAssignment assignment) {
        if (assignment == null
                || assignment.getMaintenanceRequest() == null
                || assignment.getMaintenanceRequest().getRequestId() == null) {
            throw new IllegalArgumentException(
                    "Maintenance request ID is required");
        }

        Long requestId =
                assignment.getMaintenanceRequest().getRequestId();
        return maintenanceRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException(
                        "Maintenance request not found with ID: "
                                + requestId));
    }

    private MaintenanceWorker findWorker(
            MaintenanceAssignment assignment) {
        if (assignment == null
                || assignment.getWorker() == null
                || assignment.getWorker().getWorkerId() == null) {
            throw new IllegalArgumentException(
                    "Maintenance worker ID is required");
        }

        Long workerId = assignment.getWorker().getWorkerId();
        MaintenanceWorker worker = workerRepository.findById(workerId)
                .orElseThrow(() -> new RuntimeException(
                        "Maintenance Worker not found with ID: "
                                + workerId));
        String availability = worker.getAvailabilityStatus();
        if (availability != null
                && ("UNAVAILABLE".equalsIgnoreCase(availability)
                        || "INACTIVE".equalsIgnoreCase(availability)
                        || "NOT_AVAILABLE".equalsIgnoreCase(availability))) {
            throw new IllegalArgumentException(
                    "Maintenance worker is unavailable for new assignments");
        }
        return worker;
    }

    private void requireWorkerProperty(
            MaintenanceWorker worker,
            Property property) {
        if (!workerPropertyRepository
                .existsByWorker_WorkerIdAndProperty_PropertyId(
                        worker.getWorkerId(), property.getPropertyId())) {
            throw new AccessDeniedException(
                    "Maintenance worker is not associated with this property");
        }
    }

    private void assertPropertyAccess(User user, Property property) {
        if (property == null || property.getPropertyId() == null) {
            throw new AccessDeniedException(
                    "Maintenance request has no property");
        }

        propertyAccessService.getAuthorizedProperty(
                user, property.getPropertyId());
    }

    // =========================================================
    // NOTIFICATION
    // MAINTENANCE ASSIGNED
    //
    // RECIPIENT:
    // TENANT
    // =========================================================

    private void notifyTenantAboutMaintenanceAssignment(
            MaintenanceAssignment assignment) {

        System.out.println();
        System.out.println(
                "==================================================");
        System.out.println(
                "MAINTENANCE ASSIGNMENT NOTIFICATION DEBUG");
        System.out.println(
                "==================================================");

        // -----------------------------------------------------
        // VALIDATE ASSIGNMENT
        // -----------------------------------------------------

        if (assignment == null) {

            System.out.println(
                    "DEBUG: assignment = NULL");

            return;
        }

        System.out.println(
                "DEBUG: assignment ID = "
                        + assignment.getId());

        // -----------------------------------------------------
        // GET MAINTENANCE REQUEST ID
        // -----------------------------------------------------

        if (assignment.getMaintenanceRequest() == null) {

            System.out.println(
                    "DEBUG: assignment.getMaintenanceRequest() = NULL");

            return;
        }

        Long requestId =
                assignment
                        .getMaintenanceRequest()
                        .getRequestId();

        System.out.println(
                "DEBUG: maintenanceRequest ID = "
                        + requestId);

        if (requestId == null) {

            System.out.println(
                    "DEBUG: maintenanceRequest ID = NULL");

            return;
        }

        // -----------------------------------------------------
        // EXPLICITLY LOAD MAINTENANCE REQUEST FROM DATABASE
        // -----------------------------------------------------

        MaintenanceRequest maintenanceRequest =
                maintenanceRequestRepository
                        .findById(requestId)
                        .orElse(null);

        if (maintenanceRequest == null) {

            System.out.println(
                    "DEBUG: MaintenanceRequest NOT FOUND");

            return;
        }

        System.out.println(
                "DEBUG: MaintenanceRequest loaded successfully");

        // -----------------------------------------------------
        // GET TENANT
        // -----------------------------------------------------

        if (maintenanceRequest.getTenant() == null) {

            System.out.println(
                    "DEBUG: tenant = NULL");

            return;
        }

        Long tenantId =
                maintenanceRequest
                        .getTenant()
                        .getTenantId();

        System.out.println(
                "DEBUG: tenant ID = "
                        + tenantId);

        // -----------------------------------------------------
        // GET TENANT USER
        // -----------------------------------------------------

        if (maintenanceRequest.getTenant().getUser() == null) {

            System.out.println(
                    "DEBUG: tenant.user = NULL");

            return;
        }

        Long tenantUserId =
                maintenanceRequest
                        .getTenant()
                        .getUser()
                        .getId();

        System.out.println(
                "DEBUG: tenant user ID = "
                        + tenantUserId);

        System.out.println(
                "DEBUG: tenant user email = "
                        + maintenanceRequest
                                .getTenant()
                                .getUser()
                                .getEmail());

        // -----------------------------------------------------
        // VALIDATE TENANT USER ID
        // -----------------------------------------------------

        if (tenantUserId == null) {

            System.out.println(
                    "DEBUG: tenantUserId = NULL");

            return;
        }

        // -----------------------------------------------------
        // SEND NOTIFICATION
        // -----------------------------------------------------

        System.out.println(
                "DEBUG: Sending MAINTENANCE_ASSIGNED "
                        + "notification to user ID = "
                        + tenantUserId);

        notificationService.notifyUser(
                tenantUserId,
                NotificationType.MAINTENANCE_ASSIGNED,
                NotificationPriority.MEDIUM,
                "Maintenance Assigned",
                "A maintenance worker has been assigned "
                        + "to your maintenance request.",
                requestId,
                "MAINTENANCE"
        );

        System.out.println(
                "DEBUG: MAINTENANCE_ASSIGNED notification "
                        + "sent successfully to user ID = "
                        + tenantUserId);

        System.out.println(
                "==================================================");
    }
}
