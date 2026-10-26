package com.rental.rental_management_backend.rental.serviceImpl;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.serviceImpl.UserAuthEmailDispatcher;
import com.rental.rental_management_backend.email.EmailService;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;

import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.service.NotificationService;

import com.rental.rental_management_backend.property.entity.Building;
import com.rental.rental_management_backend.property.entity.Floor;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.enums.PropertyType;
import com.rental.rental_management_backend.property.enums.UnitStatus;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.repository.UnitRepository;

import com.rental.rental_management_backend.rental.dto.RentalApplicationCreateRequest;
import com.rental.rental_management_backend.rental.dto.RentalApplicationResponse;
import com.rental.rental_management_backend.rental.dto.RentalApplicationReviewRequest;
import com.rental.rental_management_backend.rental.entity.RentalApplication;
import com.rental.rental_management_backend.rental.enums.RentalApplicationStatus;
import com.rental.rental_management_backend.rental.repository.RentalApplicationRepository;
import com.rental.rental_management_backend.rental.service.RentalApplicationService;

import com.rental.rental_management_backend.tenant.entity.Tenant;
import com.rental.rental_management_backend.tenant.repository.TenantRepository;

@Service
@Transactional
public class RentalApplicationServiceImpl
        implements RentalApplicationService {

    private final RentalApplicationRepository rentalApplicationRepository;

    private final TenantRepository tenantRepository;

    private final UserRepository userRepository;

    private final UnitRepository unitRepository;

    private final PropertyRepository propertyRepository;

    private final NotificationService notificationService;

    private final EmailService emailService;

    private final UserAuthEmailDispatcher userAuthEmailDispatcher;

    public RentalApplicationServiceImpl(
            RentalApplicationRepository rentalApplicationRepository,
            TenantRepository tenantRepository,
            UserRepository userRepository,
            UnitRepository unitRepository,
            PropertyRepository propertyRepository,
            NotificationService notificationService,
            EmailService emailService,
            UserAuthEmailDispatcher userAuthEmailDispatcher) {

        this.rentalApplicationRepository =
                rentalApplicationRepository;

        this.tenantRepository =
                tenantRepository;

        this.userRepository =
                userRepository;

        this.unitRepository =
                unitRepository;

        this.propertyRepository =
                propertyRepository;

        this.notificationService =
                notificationService;

        this.emailService = emailService;

        this.userAuthEmailDispatcher = userAuthEmailDispatcher;
    }

    // ============================================================
    // CREATE APPLICATION
    // TENANT ONLY
    // ============================================================

    @Override
    public RentalApplicationResponse createApplication(
            String email,
            RentalApplicationCreateRequest request) {

        validateEmail(email);

        if (request == null) {

            throw new IllegalArgumentException(
                    "Application request is required");
        }

        User user = findUserByEmail(email);

        Tenant tenant = tenantRepository
                .findByUser_Id(user.getId())
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Tenant profile not found for user"));

        ApplicationTarget target = resolveApplicationTarget(request);
        Property property = target.property();
        Unit unit = target.unit();

        boolean alreadyApplied;

        if (unit != null) {
            alreadyApplied = rentalApplicationRepository
                    .existsByTenant_TenantIdAndUnit_UnitIdAndStatus(
                            tenant.getTenantId(),
                            unit.getUnitId(),
                            RentalApplicationStatus.PENDING);
        } else {
            alreadyApplied = rentalApplicationRepository
                    .existsByTenantAndPropertyIdAndStatus(
                            tenant.getTenantId(),
                            property.getPropertyId(),
                            RentalApplicationStatus.PENDING);
        }

        if (alreadyApplied) {

            throw new IllegalArgumentException(
                    "You already have a pending application "
                            + "for this unit");
        }

        RentalApplication application =
                new RentalApplication();

        application.setTenant(tenant);
        application.setProperty(property);
        application.setUnit(unit);

        application.setPreferredMoveInDate(
                request.getPreferredMoveInDate());

        application.setPreferredLeaseDurationMonths(
                request.getPreferredLeaseDurationMonths());

        application.setMonthlyIncome(
                request.getMonthlyIncome());

        // M4 payment-risk analysis reads income from the tenant profile.
        // Keep that profile value in sync with an income supplied here,
        // while preserving an existing profile value when this field is blank.
        if (request.getMonthlyIncome() != null) {
            tenant.setMonthlyIncome(request.getMonthlyIncome());
            tenantRepository.save(tenant);
        }

        application.setEmployerOccupation(
                cleanString(request.getEmployerOccupation()));

        application.setMessage(
                cleanString(request.getMessage()));

        application.setStatus(
                RentalApplicationStatus.PENDING);

        RentalApplication saved =
                rentalApplicationRepository.save(application);

        // --------------------------------------------------------
        // NOTIFY PROPERTY OWNER
        // --------------------------------------------------------

        notifyOwnerAboutNewApplication(saved);

        // --------------------------------------------------------
        // NOTIFY PROPERTY MANAGER
        // --------------------------------------------------------

        notifyManagerAboutNewApplication(saved);

        notifyPropertyContactsAboutApplicationSubmitted(saved);

        return mapToResponse(saved);
    }

    private ApplicationTarget resolveApplicationTarget(
            RentalApplicationCreateRequest request) {
        Property requestedProperty = null;

        if (request.getPropertyId() != null) {
            requestedProperty = propertyRepository
                    .findById(request.getPropertyId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Property not found with ID: "
                                    + request.getPropertyId()));
        }

        if (requestedProperty != null
                && isDirectRentalProperty(requestedProperty)) {
            if (request.getUnitId() != null) {
                throw new IllegalArgumentException(
                        "House/Villa applications must not include a unit ID");
            }

            if (requestedProperty.getStatus() != PropertyStatus.AVAILABLE) {
                throw new IllegalArgumentException(
                        "Applications can only be submitted for available properties");
            }

            return new ApplicationTarget(requestedProperty, null);
        }

        if (request.getUnitId() == null) {
            throw new IllegalArgumentException(
                    "Unit ID is required for this property type");
        }

        Unit unit = unitRepository
                .findById(request.getUnitId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Unit not found with ID: " + request.getUnitId()));

        Property unitProperty = getPropertyFromUnit(unit);

        if (requestedProperty != null
                && !requestedProperty.getPropertyId()
                        .equals(unitProperty.getPropertyId())) {
            throw new IllegalArgumentException(
                    "Unit does not belong to the supplied property");
        }

        if (isDirectRentalProperty(unitProperty)) {
            if (request.getPropertyId() == null) {
                throw new IllegalArgumentException(
                        "Property ID is required for House/Villa applications");
            }
            throw new IllegalArgumentException(
                    "House/Villa applications must not include a unit ID");
        }

        if (unit.getStatus() != UnitStatus.VACANT) {
            throw new IllegalArgumentException(
                    "Applications can only be submitted for vacant units");
        }

        return new ApplicationTarget(unitProperty, unit);
    }

    private boolean isDirectRentalProperty(Property property) {
        return property.getPropertyType() == PropertyType.HOUSE
                || property.getPropertyType() == PropertyType.VILLA;
    }

    private record ApplicationTarget(Property property, Unit unit) {
    }

    // ============================================================
    // GET APPLICATION BY ID
    //
    // TENANT
    //     -> own application only
    //
    // PROPERTY_OWNER
    //     -> applications for owned properties only
    //
    // PROPERTY_MANAGER
    //     -> applications for assigned properties only
    //
    // SUPER_ADMIN
    //     -> any application
    // ============================================================

    @Override
    @Transactional(readOnly = true)
    public RentalApplicationResponse getApplicationById(
            Long applicationId) {

        if (applicationId == null) {

            throw new IllegalArgumentException(
                    "Application ID is required");
        }

        RentalApplication application =
                rentalApplicationRepository
                        .findById(applicationId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Rental application not found "
                                                + "with ID: "
                                                + applicationId));

        String email = getAuthenticatedEmail();

        String role = getAuthenticatedRole();

        // --------------------------------------------------------
        // SUPER ADMIN CAN VIEW ANY APPLICATION
        // --------------------------------------------------------

        if ("ROLE_SUPER_ADMIN".equals(role)) {

            return mapToResponse(application);
        }

        // --------------------------------------------------------
        // TENANT CAN VIEW ONLY THEIR OWN APPLICATION
        // --------------------------------------------------------

        if ("ROLE_TENANT".equals(role)) {

            Tenant tenant = tenantRepository
                    .findByUser_Id(
                            findUserByEmail(email).getId())
                    .orElseThrow(() ->
                            new ResourceNotFoundException(
                                    "Tenant profile not found for user"));

            if (application.getTenant() == null
                    || !application.getTenant()
                            .getTenantId()
                            .equals(tenant.getTenantId())) {

                throw new IllegalArgumentException(
                        "You are not authorized to view "
                                + "this application");
            }

            return mapToResponse(application);
        }

        // --------------------------------------------------------
        // PROPERTY OWNER CAN VIEW ONLY THEIR PROPERTY APPLICATIONS
        // --------------------------------------------------------

        if ("ROLE_PROPERTY_OWNER".equals(role)) {

            Property property =
                    getPropertyFromApplication(application);

            User owner = property.getOwner();

            if (owner == null
                    || owner.getEmail() == null
                    || !owner.getEmail()
                            .equalsIgnoreCase(email)) {

                throw new IllegalArgumentException(
                        "You are not authorized to view "
                                + "this application");
            }

            return mapToResponse(application);
        }

        // --------------------------------------------------------
        // PROPERTY MANAGER CAN VIEW ONLY ASSIGNED PROPERTY
        // APPLICATIONS
        // --------------------------------------------------------

        if ("ROLE_PROPERTY_MANAGER".equals(role)) {

            Property property =
                    getPropertyFromApplication(application);

            if (!isPropertyManagerAssignedToProperty(
                    property,
                    email)) {

                throw new IllegalArgumentException(
                        "You are not authorized to view "
                                + "this application");
            }

            return mapToResponse(application);
        }

        throw new IllegalArgumentException(
                "You are not authorized to view applications");
    }

    // ============================================================
    // GET MY APPLICATIONS
    // TENANT ONLY
    // ============================================================

    @Override
    @Transactional(readOnly = true)
    public List<RentalApplicationResponse> getMyApplications(
            String email) {

        validateEmail(email);

        User user = findUserByEmail(email);

        Tenant tenant = tenantRepository
                .findByUser_Id(user.getId())
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Tenant profile not found for user"));

        return rentalApplicationRepository
                .findByTenant_TenantId(
                        tenant.getTenantId())
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    // ============================================================
    // GET APPLICATIONS FOR UNIT
    //
    // PROPERTY_OWNER
    //     -> own property only
    //
    // PROPERTY_MANAGER
    //     -> assigned property only
    //
    // SUPER_ADMIN
    //     -> any unit
    // ============================================================

    @Override
    @Transactional(readOnly = true)
    public List<RentalApplicationResponse> getApplicationsForUnit(
            Long unitId) {

        if (unitId == null) {

            throw new IllegalArgumentException(
                    "Unit ID is required");
        }

        Unit unit = unitRepository
                .findById(unitId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Unit not found with ID: "
                                        + unitId));

        String email = getAuthenticatedEmail();

        String role = getAuthenticatedRole();

        // --------------------------------------------------------
        // SUPER ADMIN
        // --------------------------------------------------------

        if ("ROLE_SUPER_ADMIN".equals(role)) {

            return rentalApplicationRepository
                    .findByUnit_UnitId(unitId)
                    .stream()
                    .map(this::mapToResponse)
                    .toList();
        }

        // --------------------------------------------------------
        // PROPERTY OWNER
        // --------------------------------------------------------

        if ("ROLE_PROPERTY_OWNER".equals(role)) {

            Property property =
                    getPropertyFromUnit(unit);

            User owner = property.getOwner();

            if (owner == null
                    || owner.getEmail() == null
                    || !owner.getEmail()
                            .equalsIgnoreCase(email)) {

                throw new IllegalArgumentException(
                        "You are not authorized to view "
                                + "applications for this unit");
            }

            return rentalApplicationRepository
                    .findByUnit_UnitId(unitId)
                    .stream()
                    .map(this::mapToResponse)
                    .toList();
        }

        // --------------------------------------------------------
        // PROPERTY MANAGER
        // --------------------------------------------------------

        if ("ROLE_PROPERTY_MANAGER".equals(role)) {

            Property property =
                    getPropertyFromUnit(unit);

            if (!isPropertyManagerAssignedToProperty(
                    property,
                    email)) {

                throw new IllegalArgumentException(
                        "You are not authorized to view "
                                + "applications for this unit");
            }

            return rentalApplicationRepository
                    .findByUnit_UnitId(unitId)
                    .stream()
                    .map(this::mapToResponse)
                    .toList();
        }

        throw new IllegalArgumentException(
                "You are not authorized to view "
                        + "applications for this unit");
    }

    // ============================================================
    // GET ALL APPLICATIONS
    // SUPER ADMIN ONLY
    // ============================================================

    @Override
    @Transactional(readOnly = true)
    public List<RentalApplicationResponse> getAllApplications() {

        String role = getAuthenticatedRole();

        if (!"ROLE_SUPER_ADMIN".equals(role)) {

            throw new IllegalArgumentException(
                    "Only SUPER_ADMIN can view all applications");
        }

        return rentalApplicationRepository
                .findAll()
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    // ============================================================
    // REVIEW APPLICATION
    //
    // PROPERTY OWNER
    //     -> can approve/reject applications for their properties
    //
    // PROPERTY MANAGER
    //     -> can approve/reject applications for properties
    //        assigned to them
    //
    // ONLY PENDING APPLICATIONS CAN BE REVIEWED
    // ============================================================

    @Override
    public RentalApplicationResponse reviewApplication(
            Long applicationId,
            String email,
            RentalApplicationReviewRequest request) {

        validateEmail(email);

        if (request == null) {

            throw new IllegalArgumentException(
                    "Review request is required");
        }

        if (request.getStatus() == null) {

            throw new IllegalArgumentException(
                    "Application status is required");
        }

        if (applicationId == null) {

            throw new IllegalArgumentException(
                    "Application ID is required");
        }

        RentalApplication application =
                rentalApplicationRepository
                        .findById(applicationId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Rental application not found "
                                                + "with ID: "
                                                + applicationId));

        // --------------------------------------------------------
        // ONLY PENDING APPLICATIONS CAN BE REVIEWED
        // --------------------------------------------------------

        if (application.getStatus()
                != RentalApplicationStatus.PENDING) {

            throw new IllegalArgumentException(
                    "Only pending applications can be reviewed");
        }

        Property property =
                getPropertyFromApplication(application);

        User owner = property.getOwner();

        if (owner == null) {

            throw new ResourceNotFoundException(
                    "Property owner not found");
        }

        String role = getAuthenticatedRole();

        // --------------------------------------------------------
        // PROPERTY OWNER
        // --------------------------------------------------------

        if ("ROLE_PROPERTY_OWNER".equals(role)) {

            if (owner.getEmail() == null
                    || !owner.getEmail()
                            .equalsIgnoreCase(email.trim())) {

                throw new IllegalArgumentException(
                        "You are not authorized to review "
                                + "this application");
            }
        }

        // --------------------------------------------------------
        // PROPERTY MANAGER
        // --------------------------------------------------------

        else if ("ROLE_PROPERTY_MANAGER".equals(role)) {

            if (!isPropertyManagerAssignedToProperty(
                    property,
                    email)) {

                throw new IllegalArgumentException(
                        "You are not authorized to review "
                                + "this application");
            }
        }

        // --------------------------------------------------------
        // ANY OTHER ROLE
        // --------------------------------------------------------

        else {

            throw new IllegalArgumentException(
                    "You are not authorized to review "
                            + "this application");
        }

        RentalApplicationStatus newStatus =
                request.getStatus();

        // --------------------------------------------------------
        // ONLY APPROVED OR REJECTED
        // --------------------------------------------------------

        if (newStatus != RentalApplicationStatus.APPROVED
                && newStatus != RentalApplicationStatus.REJECTED) {

            throw new IllegalArgumentException(
                    "Application can only be APPROVED "
                            + "or REJECTED");
        }

        // --------------------------------------------------------
        // REJECT
        // --------------------------------------------------------

        if (newStatus == RentalApplicationStatus.REJECTED) {

            String rejectionReason =
                    cleanString(
                            request.getRejectionReason());

            if (rejectionReason == null) {

                throw new IllegalArgumentException(
                        "Rejection reason is required");
            }

            application.setRejectionReason(
                    rejectionReason);
        }

        // --------------------------------------------------------
        // APPROVE
        // --------------------------------------------------------

        else {

            application.setRejectionReason(null);
        }

        RentalApplicationStatus previousStatus =
                application.getStatus();

        application.setStatus(newStatus);

        application.setReviewedAt(
                LocalDateTime.now());

        RentalApplication updated =
                rentalApplicationRepository
                        .save(application);

        // --------------------------------------------------------
        // NOTIFY TENANT ABOUT APPROVAL / REJECTION
        // --------------------------------------------------------

        notifyTenantAboutApplicationReview(
                updated);

        if (previousStatus != newStatus) {
            notifyTenantByEmailAboutApplicationReview(updated);
        }

        return mapToResponse(updated);
    }

    // ============================================================
    // WITHDRAW APPLICATION
    // TENANT ONLY
    // ============================================================

    @Override
    public void withdrawApplication(
            Long applicationId,
            String email) {

        validateEmail(email);

        if (applicationId == null) {

            throw new IllegalArgumentException(
                    "Application ID is required");
        }

        RentalApplication application =
                rentalApplicationRepository
                        .findById(applicationId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Rental application not found "
                                                + "with ID: "
                                                + applicationId));

        User user = findUserByEmail(email);

        Tenant tenant = tenantRepository
                .findByUser_Id(user.getId())
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Tenant profile not found for user"));

        // --------------------------------------------------------
        // TENANT MUST OWN APPLICATION
        // --------------------------------------------------------

        if (application.getTenant() == null
                || !application.getTenant()
                        .getTenantId()
                        .equals(tenant.getTenantId())) {

            throw new IllegalArgumentException(
                    "You are not allowed to withdraw "
                            + "this application");
        }

        // --------------------------------------------------------
        // ONLY PENDING APPLICATIONS CAN BE WITHDRAWN
        // --------------------------------------------------------

        if (application.getStatus()
                != RentalApplicationStatus.PENDING) {

            throw new IllegalArgumentException(
                    "Only pending applications can be withdrawn");
        }

        application.setStatus(
                RentalApplicationStatus.WITHDRAWN);

        rentalApplicationRepository.save(application);

        notifyPropertyContactsAboutApplicationWithdrawn(
                application);
    }

    // ============================================================
    // GET ALL APPLICATIONS FOR PROPERTY
    //
    // PROPERTY_OWNER
    //     -> own property only
    //
    // PROPERTY_MANAGER
    //     -> assigned property only
    //
    // SUPER_ADMIN
    //     -> any property
    //
    // TENANT
    //     -> not allowed
    //
    // IMPORTANT:
    // A valid property with zero applications returns []
    // instead of 404.
    // ============================================================

    @Override
    @Transactional(readOnly = true)
    public List<RentalApplicationResponse> getApplicationsForProperty(
            Long propertyId) {

        if (propertyId == null) {

            throw new IllegalArgumentException(
                    "Property ID is required");
        }

        // --------------------------------------------------------
        // FIND PROPERTY FIRST
        // --------------------------------------------------------

        Property property =
                propertyRepository
                        .findById(propertyId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found with ID: "
                                                + propertyId));

        String email = getAuthenticatedEmail();

        String role = getAuthenticatedRole();

        // --------------------------------------------------------
        // GET APPLICATIONS FOR PROPERTY
        // --------------------------------------------------------

        List<RentalApplication> applications =
                rentalApplicationRepository
                        .findAllByPropertyIdIncludingUnitApplications(
                                propertyId);

        // --------------------------------------------------------
        // SUPER ADMIN
        // --------------------------------------------------------

        if ("ROLE_SUPER_ADMIN".equals(role)) {

            return applications
                    .stream()
                    .map(this::mapToResponse)
                    .toList();
        }

        // --------------------------------------------------------
        // PROPERTY OWNER
        // --------------------------------------------------------

        if ("ROLE_PROPERTY_OWNER".equals(role)) {

            User owner = property.getOwner();

            if (owner == null
                    || owner.getEmail() == null
                    || !owner.getEmail()
                            .equalsIgnoreCase(email)) {

                throw new IllegalArgumentException(
                        "You are not authorized to view "
                                + "applications for this property");
            }

            return applications
                    .stream()
                    .map(this::mapToResponse)
                    .toList();
        }

        // --------------------------------------------------------
        // PROPERTY MANAGER
        // --------------------------------------------------------

        if ("ROLE_PROPERTY_MANAGER".equals(role)) {

            if (!isPropertyManagerAssignedToProperty(
                    property,
                    email)) {

                throw new IllegalArgumentException(
                        "You are not authorized to view "
                                + "applications for this property");
            }

            return applications
                    .stream()
                    .map(this::mapToResponse)
                    .toList();
        }

        // --------------------------------------------------------
        // OTHER ROLES
        // --------------------------------------------------------

        throw new IllegalArgumentException(
                "You are not authorized to view "
                        + "applications for this property");
    }

    // ============================================================
    // NOTIFY PROPERTY OWNER ABOUT NEW APPLICATION
    // ============================================================

    private void notifyOwnerAboutNewApplication(
            RentalApplication application) {

        if (application == null) {

            return;
        }

        Property property =
                getPropertyFromApplication(application);

        if (property == null
                || property.getOwner() == null
                || property.getOwner().getId() == null) {

            return;
        }

        notificationService.notifyUser(
                property.getOwner().getId(),
                NotificationType.NEW_APPLICATION,
                NotificationPriority.MEDIUM,
                "New Rental Application",
                "A new rental application has been submitted for your property.",
                application.getApplicationId(),
                "RENTAL_APPLICATION"
        );
    }

    private void notifyPropertyContactsAboutApplicationSubmitted(
            RentalApplication application) {

        Property property = getPropertyFromApplication(application);
        Tenant tenant = application.getTenant();
        User tenantUser = tenant != null ? tenant.getUser() : null;
        Unit unit = application.getUnit();

        if (property == null || tenantUser == null) {
            return;
        }

        String tenantName = getUserDisplayName(tenantUser);
        String propertyName = property.getPropertyName();
        String unitNumber = unit == null
                ? "Direct property rental"
                : unit.getUnitNumber();
        Long applicationId = application.getApplicationId();
        String moveInDate = application.getPreferredMoveInDate() == null
                ? "Not specified"
                : application.getPreferredMoveInDate().toString();
        Integer leaseDurationMonths =
                application.getPreferredLeaseDurationMonths();
        String applicationMessage = application.getMessage() == null
                ? "Not provided"
                : application.getMessage();

        User owner = property.getOwner();
        if (owner != null && owner.getEmail() != null) {
            String recipientEmail = owner.getEmail();
            dispatchEmail(
                    "rental application submitted",
                    () -> emailService.sendRentalApplicationSubmittedEmail(
                            recipientEmail,
                            tenantName,
                            propertyName,
                            unitNumber,
                            applicationId,
                            moveInDate,
                            leaseDurationMonths,
                            applicationMessage));
        }

        if (property.getPropertyManager() != null
                && property.getPropertyManager().getUser() != null) {
            User manager = property.getPropertyManager().getUser();
            if (manager.getEmail() != null
                    && manager.getId() != null
                    && (owner == null
                            || !manager.getId().equals(owner.getId()))) {
                String recipientEmail = manager.getEmail();
                dispatchEmail(
                        "rental application submitted",
                        () -> emailService.sendRentalApplicationSubmittedEmail(
                                recipientEmail,
                                tenantName,
                                propertyName,
                                unitNumber,
                                applicationId,
                                moveInDate,
                                leaseDurationMonths,
                                applicationMessage));
            }
        }
    }

    // ============================================================
    // NOTIFY PROPERTY MANAGER ABOUT NEW APPLICATION
    // ============================================================

    private void notifyManagerAboutNewApplication(
            RentalApplication application) {

        if (application == null) {

            return;
        }

        Property property =
                getPropertyFromApplication(application);

        if (property == null
                || property.getPropertyManager() == null
                || property.getPropertyManager().getUser() == null
                || property.getPropertyManager()
                        .getUser()
                        .getId() == null) {

            return;
        }

        Long managerUserId =
                property.getPropertyManager()
                        .getUser()
                        .getId();

        // --------------------------------------------------------
        // AVOID DUPLICATE NOTIFICATION
        // --------------------------------------------------------

        if (property.getOwner() != null
                && property.getOwner().getId() != null
                && property.getOwner()
                        .getId()
                        .equals(managerUserId)) {

            return;
        }

        notificationService.notifyUser(
                managerUserId,
                NotificationType.NEW_APPLICATION,
                NotificationPriority.MEDIUM,
                "New Rental Application",
                "A new rental application has been submitted for a property assigned to you.",
                application.getApplicationId(),
                "RENTAL_APPLICATION"
        );
    }

    // ============================================================
    // NOTIFY TENANT ABOUT APPLICATION REVIEW
    // ============================================================

    private void notifyTenantAboutApplicationReview(
            RentalApplication application) {

        if (application == null
                || application.getTenant() == null
                || application.getTenant().getUser() == null
                || application.getTenant()
                        .getUser()
                        .getId() == null) {

            return;
        }

        Long tenantUserId =
                application.getTenant()
                        .getUser()
                        .getId();

        // --------------------------------------------------------
        // APPLICATION APPROVED
        // --------------------------------------------------------

        if (application.getStatus()
                == RentalApplicationStatus.APPROVED) {

            notificationService.notifyUser(
                    tenantUserId,
                    NotificationType.APPLICATION_APPROVED,
                    NotificationPriority.HIGH,
                    "Rental Application Approved",
                    "Your rental application has been approved.",
                    application.getApplicationId(),
                    "RENTAL_APPLICATION"
            );
        }

        // --------------------------------------------------------
        // APPLICATION REJECTED
        // --------------------------------------------------------

        else if (application.getStatus()
                == RentalApplicationStatus.REJECTED) {

            String rejectionReason =
                    application.getRejectionReason();

            String message =
                    "Your rental application has been rejected.";

            if (rejectionReason != null
                    && !rejectionReason.isBlank()) {

                message =
                        "Your rental application has been rejected. "
                                + "Reason: "
                                + rejectionReason;
            }

            notificationService.notifyUser(
                    tenantUserId,
                    NotificationType.APPLICATION_REJECTED,
                    NotificationPriority.HIGH,
                    "Rental Application Rejected",
                    message,
                    application.getApplicationId(),
                    "RENTAL_APPLICATION"
            );
        }
    }

    private void notifyTenantByEmailAboutApplicationReview(
            RentalApplication application) {

        Tenant tenant = application.getTenant();
        User tenantUser = tenant != null ? tenant.getUser() : null;
        Property property = getPropertyFromApplication(application);
        Unit unit = application.getUnit();

        if (tenantUser == null || tenantUser.getEmail() == null
                || property == null) {
            return;
        }

        String recipientEmail = tenantUser.getEmail();
        String tenantName = getUserDisplayName(tenantUser);
        String propertyName = property.getPropertyName();
        String unitNumber = unit == null
                ? "Direct property rental"
                : unit.getUnitNumber();
        Long applicationId = application.getApplicationId();
        String status = application.getStatus().name();
        String rejectionReason = application.getRejectionReason();

        dispatchEmail(
                "rental application " + status.toLowerCase(),
                () -> emailService.sendRentalApplicationReviewEmail(
                        recipientEmail,
                        tenantName,
                        propertyName,
                        unitNumber,
                        applicationId,
                        status,
                        rejectionReason));
    }

    private void notifyPropertyContactsAboutApplicationWithdrawn(
            RentalApplication application) {

        Property property = getPropertyFromApplication(application);
        Tenant tenant = application.getTenant();
        User tenantUser = tenant != null ? tenant.getUser() : null;
        Unit unit = application.getUnit();

        if (property == null || tenantUser == null) {
            return;
        }

        String tenantName = getUserDisplayName(tenantUser);
        String propertyName = property.getPropertyName();
        String unitNumber = unit == null
                ? "Direct property rental"
                : unit.getUnitNumber();
        Long applicationId = application.getApplicationId();

        User owner = property.getOwner();
        if (owner != null && owner.getEmail() != null) {
            String recipientEmail = owner.getEmail();
            dispatchEmail(
                    "rental application withdrawn",
                    () -> emailService.sendRentalApplicationWithdrawnEmail(
                            recipientEmail,
                            tenantName,
                            propertyName,
                            unitNumber,
                            applicationId));
        }

        if (property.getPropertyManager() != null
                && property.getPropertyManager().getUser() != null) {
            User manager = property.getPropertyManager().getUser();
            if (manager.getEmail() != null
                    && manager.getId() != null
                    && (owner == null
                            || !manager.getId().equals(owner.getId()))) {
                String recipientEmail = manager.getEmail();
                dispatchEmail(
                        "rental application withdrawn",
                        () -> emailService.sendRentalApplicationWithdrawnEmail(
                                recipientEmail,
                                tenantName,
                                propertyName,
                                unitNumber,
                                applicationId));
            }
        }
    }

    private String getUserDisplayName(User user) {
        String firstName = user.getFirstName() == null
                ? ""
                : user.getFirstName();
        String lastName = user.getLastName() == null
                ? ""
                : user.getLastName();
        return (firstName + " " + lastName).trim();
    }

    private void dispatchEmail(String notificationType, Runnable sendEmail) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            userAuthEmailDispatcher.dispatch(notificationType, sendEmail);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        userAuthEmailDispatcher.dispatch(
                                notificationType,
                                sendEmail);
                    }
                });
    }

    // ============================================================
    // CHECK PROPERTY MANAGER ACCESS
    // ============================================================

    private boolean isPropertyManagerAssignedToProperty(
            Property property,
            String managerEmail) {

        if (property == null
                || property.getPropertyManager() == null
                || property.getPropertyManager().getUser() == null
                || property.getPropertyManager().getUser()
                        .getEmail() == null
                || managerEmail == null
                || managerEmail.isBlank()) {

            return false;
        }

        return property.getPropertyManager()
                .getUser()
                .getEmail()
                .equalsIgnoreCase(
                        managerEmail.trim());
    }

    // ============================================================
    // GET PROPERTY FROM APPLICATION
    // ============================================================

    private Property getPropertyFromApplication(
            RentalApplication application) {

                if (application.getProperty() != null) {
                        return application.getProperty();
                }

        if (application.getUnit() == null) {

            throw new ResourceNotFoundException(
                    "Unit not found for this application");
        }

        return getPropertyFromUnit(
                application.getUnit());
    }

    // ============================================================
    // GET PROPERTY FROM UNIT
    // ============================================================

    private Property getPropertyFromUnit(Unit unit) {

        Floor floor = unit.getFloor();

        if (floor == null) {

            throw new ResourceNotFoundException(
                    "Floor not found for this unit");
        }

        Building building = floor.getBuilding();

        if (building == null) {

            throw new ResourceNotFoundException(
                    "Building not found for this floor");
        }

        Property property = building.getProperty();

        if (property == null) {

            throw new ResourceNotFoundException(
                    "Property not found for this building");
        }

        return property;
    }

    // ============================================================
    // FIND USER BY EMAIL
    // ============================================================

    private User findUserByEmail(String email) {

        return userRepository
                .findByEmail(
                        email.trim().toLowerCase())
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "User not found with email: "
                                        + email));
    }

    // ============================================================
    // AUTHENTICATED EMAIL
    // ============================================================

    private String getAuthenticatedEmail() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || authentication.getName().isBlank()) {

            throw new IllegalArgumentException(
                    "Authenticated user is required");
        }

        return authentication.getName()
                .trim()
                .toLowerCase();
    }

    // ============================================================
    // AUTHENTICATED ROLE
    // ============================================================

    private String getAuthenticatedRole() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()) {

            throw new IllegalArgumentException(
                    "Authenticated user is required");
        }

        for (GrantedAuthority authority :
                authentication.getAuthorities()) {

            String role = authority.getAuthority();

            if ("ROLE_SUPER_ADMIN".equals(role)
                    || "ROLE_PROPERTY_OWNER".equals(role)
                    || "ROLE_PROPERTY_MANAGER".equals(role)
                    || "ROLE_TENANT".equals(role)) {

                return role;
            }
        }

        throw new IllegalArgumentException(
                "User role not found");
    }

    // ============================================================
    // VALIDATE EMAIL
    // ============================================================

    private void validateEmail(String email) {

        if (email == null || email.isBlank()) {

            throw new IllegalArgumentException(
                    "Authenticated user email is required");
        }
    }

    // ============================================================
    // MAP ENTITY TO RESPONSE
    // ============================================================

    private RentalApplicationResponse mapToResponse(
            RentalApplication application) {

        RentalApplicationResponse response =
                new RentalApplicationResponse();

        // --------------------------------------------------------
        // APPLICATION ID
        // --------------------------------------------------------

        response.setApplicationId(
                application.getApplicationId());

        // --------------------------------------------------------
        // TENANT
        // --------------------------------------------------------

        Tenant tenant =
                application.getTenant();

        if (tenant != null) {

            response.setTenantId(
                    tenant.getTenantId());

            User user =
                    tenant.getUser();

            if (user != null) {

                String firstName =
                        user.getFirstName();

                String lastName =
                        user.getLastName();

                String tenantName =
                        ((firstName != null
                                ? firstName
                                : "")
                        + " "
                        + (lastName != null
                                ? lastName
                                : ""))
                        .trim();

                response.setTenantName(
                        tenantName);

                response.setTenantEmail(
                        user.getEmail());
            }
        }

        // --------------------------------------------------------
        // UNIT
        // --------------------------------------------------------

        Unit unit =
                application.getUnit();

        if (unit != null) {

            response.setUnitId(
                    unit.getUnitId());

            response.setUnitNumber(
                    unit.getUnitNumber());

            response.setMonthlyRent(
                    unit.getMonthlyRent());

            response.setSecurityDeposit(
                    unit.getSecurityDeposit());

            // ----------------------------------------------------
            // FLOOR
            // ----------------------------------------------------

            Floor floor =
                    unit.getFloor();

            if (floor != null) {

                response.setFloorId(
                        floor.getFloorId());

                // ------------------------------------------------
                // BUILDING
                // ------------------------------------------------

                Building building =
                        floor.getBuilding();

                if (building != null) {

                    response.setBuildingId(
                            building.getBuildingId());

                    response.setBuildingName(
                            building.getBuildingName());

                    // --------------------------------------------
                    // PROPERTY
                    // --------------------------------------------

                    Property property =
                            building.getProperty();

                    if (property != null) {

                        response.setPropertyId(
                                property.getPropertyId());

                        response.setPropertyName(
                                property.getPropertyName());
                    }
                }
            }
        }

                Property property = application.getProperty();
                if (property != null) {
                        response.setPropertyId(property.getPropertyId());
                        response.setPropertyName(property.getPropertyName());

                        if (unit == null) {
                                response.setMonthlyRent(property.getMonthlyRent());
                                response.setSecurityDeposit(property.getSecurityDeposit());
                        }
                } else if (unit != null
                                && unit.getFloor() != null
                                && unit.getFloor().getBuilding() != null
                                && unit.getFloor().getBuilding().getProperty() != null) {
                        Property unitProperty =
                                        unit.getFloor().getBuilding().getProperty();
                        response.setPropertyId(unitProperty.getPropertyId());
                        response.setPropertyName(unitProperty.getPropertyName());
                }

        // --------------------------------------------------------
        // APPLICATION DETAILS
        // --------------------------------------------------------

        response.setApplicationDate(
                application.getApplicationDate());

        response.setPreferredMoveInDate(
                application.getPreferredMoveInDate());

        response.setPreferredLeaseDurationMonths(
                application.getPreferredLeaseDurationMonths());

        response.setMonthlyIncome(
                application.getMonthlyIncome());

        response.setEmployerOccupation(
                application.getEmployerOccupation());

        response.setMessage(
                application.getMessage());

        response.setStatus(
                application.getStatus());

        response.setRejectionReason(
                application.getRejectionReason());

        response.setReviewedAt(
                application.getReviewedAt());

        response.setCreatedAt(
                application.getCreatedAt());

        response.setUpdatedAt(
                application.getUpdatedAt());

        return response;
    }

    // ============================================================
    // CLEAN STRING
    // ============================================================

    private String cleanString(String value) {

        if (value == null) {

            return null;
        }

        String cleaned =
                value.trim();

        if (cleaned.isEmpty()) {

            return null;
        }

        return cleaned;
    }
}