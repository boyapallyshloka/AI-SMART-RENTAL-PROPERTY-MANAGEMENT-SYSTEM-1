
package com.rental.rental_management_backend.rental.serviceImpl;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.serviceImpl.UserAuthEmailDispatcher;
import com.rental.rental_management_backend.email.EmailService;
import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.service.NotificationService;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.enums.UnitStatus;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.rental.dto.RentalAgreementRequest;
import com.rental.rental_management_backend.rental.dto.RentalAgreementResponse;
import com.rental.rental_management_backend.rental.entity.RentalAgreement;
import com.rental.rental_management_backend.rental.entity.RentalApplication;
import com.rental.rental_management_backend.rental.enums.AgreementStatus;
import com.rental.rental_management_backend.rental.repository.RentalAgreementRepository;
import com.rental.rental_management_backend.rental.repository.RentalApplicationRepository;
import com.rental.rental_management_backend.rental.service.RentalAgreementPdfService;
import com.rental.rental_management_backend.rental.service.RentalAgreementService;
import com.rental.rental_management_backend.s3.service.S3Service;

import jakarta.persistence.EntityNotFoundException;

@Service
@Transactional
public class RentalAgreementServiceImpl implements RentalAgreementService {

    private final RentalAgreementRepository rentalAgreementRepository;
    private final RentalApplicationRepository rentalApplicationRepository;
    private final UserRepository userRepository;
    private final RentalAgreementPdfService rentalAgreementPdfService;
    private final S3Service s3Service;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final UserAuthEmailDispatcher userAuthEmailDispatcher;

    public RentalAgreementServiceImpl(
            RentalAgreementRepository rentalAgreementRepository,
            RentalApplicationRepository rentalApplicationRepository,
            UserRepository userRepository,
            RentalAgreementPdfService rentalAgreementPdfService,
            S3Service s3Service,
            NotificationService notificationService,
            EmailService emailService,
            UserAuthEmailDispatcher userAuthEmailDispatcher) {

        this.rentalAgreementRepository = rentalAgreementRepository;
        this.rentalApplicationRepository = rentalApplicationRepository;
        this.userRepository = userRepository;
        this.rentalAgreementPdfService = rentalAgreementPdfService;
        this.s3Service = s3Service;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.userAuthEmailDispatcher = userAuthEmailDispatcher;
    }

    // =========================================================
    // CREATE AGREEMENT
    // =========================================================

    @Override
    public RentalAgreementResponse createAgreement(
            RentalAgreementRequest request,
            String email) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "Rental agreement request is required");
        }

        if (request.getApplicationId() == null) {
            throw new IllegalArgumentException(
                    "Application ID is required");
        }

        User user = getUserByEmail(email);

        RentalApplication application = rentalApplicationRepository
                .findById(request.getApplicationId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Rental application not found with ID: "
                                + request.getApplicationId()));

        if (application.getStatus() == null
                || !"APPROVED".equalsIgnoreCase(
                        application.getStatus().name())) {
            throw new IllegalStateException(
                    "Rental agreement can be created only for an APPROVED rental application");
        }

        if (user.getRole() == RoleType.TENANT) {
            throw new IllegalStateException(
                    "Tenant is not authorized to create a rental agreement");
        }

        if (user.getRole() != RoleType.SUPER_ADMIN
                && user.getRole() != RoleType.PROPERTY_OWNER
                && user.getRole() != RoleType.PROPERTY_MANAGER) {
            throw new IllegalStateException(
                    "You are not authorized to create a rental agreement");
        }

        if (user.getRole() != RoleType.SUPER_ADMIN
                && !hasApplicationPropertyAccess(application, user)) {
            throw new IllegalStateException(
                    "You are not authorized to create an agreement for this property");
        }

        if (application.getTenant() == null) {
            throw new IllegalStateException(
                    "Rental application does not have a tenant");
        }

        Unit unit = application.getUnit();
        Property property = application.getProperty();
        if (property == null && unit != null && unit.getFloor() != null
                && unit.getFloor().getBuilding() != null) {
            property = unit.getFloor().getBuilding().getProperty();
        }
        if (property == null) {
            throw new IllegalStateException(
                    "Rental application does not identify a rentable property");
        }

        if (rentalAgreementRepository
                .existsByRentalApplication_ApplicationId(
                        request.getApplicationId())) {
            throw new IllegalStateException(
                    "A rental agreement already exists for this application");
        }

        if (unit != null && unit.getStatus() != UnitStatus.VACANT) {
            throw new IllegalStateException(
                    "Rental agreement cannot be created because the unit is not vacant");
        }
        if (unit == null
                && property.getStatus() != PropertyStatus.AVAILABLE
                && property.getStatus() != PropertyStatus.PUBLISHED) {
            throw new IllegalStateException(
                    "Rental agreement cannot be created because the property is not available");
        }

        validateDates(application);

        if (request.getDueDay() != null
                && (request.getDueDay() < 1
                || request.getDueDay() > 31)) {
            throw new IllegalArgumentException(
                    "Due day must be between 1 and 31");
        }

        if (request.getNoticePeriodDays() != null
                && request.getNoticePeriodDays() < 0) {
            throw new IllegalArgumentException(
                    "Notice period cannot be negative");
        }

        RentalAgreement agreement = new RentalAgreement();

        agreement.setRentalApplication(application);
        agreement.setTenant(application.getTenant());
        agreement.setUnit(unit);
        agreement.setProperty(property);

        LocalDate startDate = application.getPreferredMoveInDate();
        Integer leaseDurationMonths =
                application.getPreferredLeaseDurationMonths();

        LocalDate endDate = startDate
                .plusMonths(leaseDurationMonths)
                .minusDays(1);

        agreement.setStartDate(startDate);
        agreement.setEndDate(endDate);

        agreement.setMonthlyRent(unit != null ? unit.getMonthlyRent() : property.getMonthlyRent());
        agreement.setSecurityDeposit(unit != null ? unit.getSecurityDeposit() : property.getSecurityDeposit());

        agreement.setDueDay(request.getDueDay());
        agreement.setNoticePeriodDays(request.getNoticePeriodDays());
        LocalDate moveInDate = request.getMoveInDate() != null
                ? request.getMoveInDate()
                : application.getPreferredMoveInDate();
        if (moveInDate != null && moveInDate.isBefore(startDate)) {
            throw new IllegalArgumentException(
                    "Move-in date cannot be before the lease start date");
        }
        agreement.setMoveInDate(moveInDate);
        agreement.setTermsAndConditions(
                cleanString(request.getTermsAndConditions()));
        agreement.setAgreementDocument(null);
        agreement.setStatus(AgreementStatus.DRAFT);

        RentalAgreement savedAgreement =
                rentalAgreementRepository.save(agreement);

        String pdfPath = rentalAgreementPdfService
                .generateAgreementPdf(savedAgreement);

        savedAgreement.setAgreementDocument(pdfPath);

        savedAgreement = rentalAgreementRepository.save(savedAgreement);

        sendAgreementCreatedEmail(savedAgreement);

        return mapToResponse(savedAgreement);
    }

    // =========================================================
    // GET ONE AGREEMENT
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public RentalAgreementResponse getAgreement(
            Long agreementId,
            String email) {

        User user = getUserByEmail(email);

        RentalAgreement agreement = getAgreementEntity(agreementId);

        if (!hasAccess(agreement, user)) {
            throw new IllegalStateException(
                    "You are not authorized to access this rental agreement");
        }

        return mapToResponse(agreement);
    }

    // =========================================================
    // TENANT -> MY AGREEMENTS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<RentalAgreementResponse> getMyAgreements(String email) {

        User user = getUserByEmail(email);

        if (user.getRole() != RoleType.TENANT) {
            throw new IllegalStateException(
                    "Only tenants can access their own agreements");
        }

        return rentalAgreementRepository
                .findByTenant_User_Email(email)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // GET ALL AGREEMENTS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<RentalAgreementResponse> getAllAgreements(String email) {

        User user = getUserByEmail(email);

        if (user.getRole() == RoleType.TENANT) {
            throw new IllegalStateException(
                    "Tenant should use the My Agreements endpoint");
        }

        if (user.getRole() != RoleType.SUPER_ADMIN
                && user.getRole() != RoleType.PROPERTY_OWNER
                && user.getRole() != RoleType.PROPERTY_MANAGER) {
            throw new IllegalStateException(
                    "You are not authorized to view rental agreements");
        }

        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return rentalAgreementRepository.findAllForAdminResponse()
                    .stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }

        return rentalAgreementRepository.findAllForManagementResponse()
                .stream()
                .filter(agreement -> hasAccess(agreement, user))
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // UPDATE AGREEMENT STATUS
    // =========================================================

    @Override
    public RentalAgreementResponse updateStatus(
            Long agreementId,
            AgreementStatus status,
            String email) {

        User user = getUserByEmail(email);
        RentalAgreement agreement = getAgreementEntity(agreementId);

        validateManagementAccess(agreement, user);

        if (status == null) {
            throw new IllegalArgumentException(
                    "Agreement status is required");
        }

        AgreementStatus currentStatus = agreement.getStatus();

        if (currentStatus == status) {
            return mapToResponse(agreement);
        }

        if (status == AgreementStatus.ACTIVE) {

            validateActivation(agreement);

            agreement.setStatus(AgreementStatus.ACTIVE);
            occupyUnit(agreement.getUnit());
            if (agreement.getUnit() == null && agreement.getProperty() != null) {
                agreement.getProperty().setStatus(PropertyStatus.OCCUPIED);
            }

        } else if (status == AgreementStatus.EXPIRED) {

            if (currentStatus != AgreementStatus.ACTIVE) {
                throw new IllegalStateException(
                        "Only ACTIVE agreements can be marked as expired");
            }

            if (agreement.getEndDate() == null) {
                throw new IllegalStateException(
                        "Agreement end date is required before expiration");
            }

            if (agreement.getEndDate().isAfter(LocalDate.now())) {
                throw new IllegalStateException(
                        "Agreement cannot be marked expired before its end date");
            }

            agreement.setStatus(AgreementStatus.EXPIRED);
            releaseUnit(agreement.getUnit());
            if (agreement.getUnit() == null && agreement.getProperty() != null) {
                agreement.getProperty().setStatus(PropertyStatus.AVAILABLE);
            }

        } else if (status == AgreementStatus.TERMINATED) {

            if (currentStatus != AgreementStatus.ACTIVE) {
                throw new IllegalStateException(
                        "Only ACTIVE agreements can be terminated");
            }

            agreement.setStatus(AgreementStatus.TERMINATED);

            if (agreement.getMoveOutDate() == null) {
                agreement.setMoveOutDate(LocalDate.now());
            }

            releaseUnit(agreement.getUnit());
            if (agreement.getUnit() == null && agreement.getProperty() != null) {
                agreement.getProperty().setStatus(PropertyStatus.AVAILABLE);
            }

        } else if (status == AgreementStatus.DRAFT) {

            if (currentStatus == AgreementStatus.ACTIVE) {
                throw new IllegalStateException(
                        "An active agreement cannot be changed back to draft");
            }

            agreement.setStatus(AgreementStatus.DRAFT);

        } else {
            throw new IllegalArgumentException(
                    "Unsupported rental agreement status: " + status);
        }

        RentalAgreement updatedAgreement =
                rentalAgreementRepository.save(agreement);

        sendAgreementStatusNotification(updatedAgreement);
        sendAgreementStatusChangedEmail(
                updatedAgreement,
                currentStatus);

        return mapToResponse(updatedAgreement);
    }

    // =========================================================
    // UPDATE MOVE-OUT DATE
    // Notify only if an ACTIVE agreement is terminated.
    // =========================================================

    @Override
    public RentalAgreementResponse updateMoveOutDate(
            Long agreementId,
            LocalDate moveOutDate,
            String email) {

        User user = getUserByEmail(email);
        RentalAgreement agreement = getAgreementEntity(agreementId);

        validateManagementAccess(agreement, user);

        if (moveOutDate == null) {
            throw new IllegalArgumentException(
                    "Move-out date is required");
        }

        if (agreement.getStartDate() != null
                && moveOutDate.isBefore(agreement.getStartDate())) {
            throw new IllegalArgumentException(
                    "Move-out date cannot be before agreement start date");
        }

        if (agreement.getEndDate() != null
                && moveOutDate.isAfter(agreement.getEndDate())) {
            throw new IllegalArgumentException(
                    "Move-out date cannot be after agreement end date");
        }

        boolean moveOutDateChanged =
                !Objects.equals(moveOutDate, agreement.getMoveOutDate());

        boolean agreementTerminated =
                agreement.getStatus() == AgreementStatus.ACTIVE;

        if (!moveOutDateChanged && !agreementTerminated) {
            return mapToResponse(agreement);
        }

        agreement.setMoveOutDate(moveOutDate);

        if (agreementTerminated) {
            agreement.setStatus(AgreementStatus.TERMINATED);
            releaseUnit(agreement.getUnit());
            if (agreement.getUnit() == null && agreement.getProperty() != null) {
                agreement.getProperty().setStatus(PropertyStatus.AVAILABLE);
            }
        }

        RentalAgreement updatedAgreement =
                rentalAgreementRepository.save(agreement);

        if (agreementTerminated) {
            sendAgreementStatusNotification(updatedAgreement);
        }

        if (moveOutDateChanged || agreementTerminated) {
            sendAgreementMoveOutEmail(updatedAgreement);
        }

        return mapToResponse(updatedAgreement);
    }

    private void sendAgreementCreatedEmail(RentalAgreement agreement) {
        AgreementEmailDetails details = getAgreementEmailDetails(agreement);
        if (details == null) {
            return;
        }

        dispatchEmail(
                "rental agreement created",
                () -> emailService.sendAgreementCreatedEmail(
                        details.tenantEmail(),
                        details.tenantName(),
                        details.agreementId(),
                        details.propertyName(),
                        details.unitNumber(),
                        details.startDate(),
                        details.endDate(),
                        details.monthlyRent(),
                        details.status()));
    }

    private void sendAgreementStatusChangedEmail(
            RentalAgreement agreement,
            AgreementStatus previousStatus) {

        AgreementEmailDetails details = getAgreementEmailDetails(agreement);
        if (details == null) {
            return;
        }

        String previousStatusName = previousStatus == null
                ? "Not specified"
                : previousStatus.name();

        dispatchEmail(
                "rental agreement status changed",
                () -> emailService.sendAgreementStatusChangedEmail(
                        details.tenantEmail(),
                        details.tenantName(),
                        details.agreementId(),
                        details.propertyName(),
                        details.unitNumber(),
                        previousStatusName,
                        details.status(),
                        details.startDate(),
                        details.endDate(),
                        details.monthlyRent()));
    }

    private void sendAgreementMoveOutEmail(RentalAgreement agreement) {
        AgreementEmailDetails details = getAgreementEmailDetails(agreement);
        if (details == null) {
            return;
        }

        dispatchEmail(
                "rental agreement move-out updated",
                () -> emailService.sendAgreementMoveOutEmail(
                        details.tenantEmail(),
                        details.tenantName(),
                        details.agreementId(),
                        details.propertyName(),
                        details.unitNumber(),
                        details.status(),
                        details.moveOutDate(),
                        details.startDate(),
                        details.endDate(),
                        details.monthlyRent()));
    }

    private AgreementEmailDetails getAgreementEmailDetails(
            RentalAgreement agreement) {

        if (agreement == null
                || agreement.getTenant() == null
                || agreement.getTenant().getUser() == null) {
            return null;
        }

        User tenantUser = agreement.getTenant().getUser();
        String tenantEmail = tenantUser.getEmail();
        if (tenantEmail == null || tenantEmail.isBlank()) {
            return null;
        }

        Unit unit = agreement.getUnit();
        var property = agreement.getProperty() != null
                ? agreement.getProperty()
                : unit != null
                && unit.getFloor() != null
                && unit.getFloor().getBuilding() != null
                ? unit.getFloor().getBuilding().getProperty()
                : null;
        String tenantName = ((tenantUser.getFirstName() == null
                ? ""
                : tenantUser.getFirstName())
                + " "
                + (tenantUser.getLastName() == null
                        ? ""
                        : tenantUser.getLastName())).trim();

        return new AgreementEmailDetails(
                tenantEmail,
                tenantName,
                agreement.getAgreementId(),
                property == null || property.getPropertyName() == null
                        ? "Not specified"
                        : property.getPropertyName(),
                unit == null || unit.getUnitNumber() == null
                        ? "Entire property"
                        : unit.getUnitNumber(),
                formatEmailValue(agreement.getStartDate()),
                formatEmailValue(agreement.getEndDate()),
                formatEmailValue(agreement.getMonthlyRent()),
                formatEmailValue(agreement.getStatus()),
                formatEmailValue(agreement.getMoveOutDate()));
    }

    private String formatEmailValue(Object value) {
        return value == null ? "Not specified" : value.toString();
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

    private record AgreementEmailDetails(
            String tenantEmail,
            String tenantName,
            Long agreementId,
            String propertyName,
            String unitNumber,
            String startDate,
            String endDate,
            String monthlyRent,
            String status,
            String moveOutDate) {
    }

    // =========================================================
    // SEND STATUS NOTIFICATION TO TENANT, OWNER, AND MANAGER
    // =========================================================

    private void sendAgreementStatusNotification(
            RentalAgreement agreement) {

        if (agreement == null || agreement.getStatus() == null) {
            return;
        }

        List<Long> recipientUserIds = new ArrayList<>();
        Long tenantUserId = null;

        // Tenant user ID.
        if (agreement.getTenant() != null
                && agreement.getTenant().getUser() != null) {

            tenantUserId = agreement.getTenant().getUser().getId();

            if (tenantUserId != null) {
                recipientUserIds.add(tenantUserId);
            }
        }

        // Resolve property through Unit -> Floor -> Building -> Property.
        Unit unit = agreement.getUnit();
        var property = agreement.getProperty() != null
                ? agreement.getProperty()
                : unit != null
                && unit.getFloor() != null
                && unit.getFloor().getBuilding() != null
                ? unit.getFloor()
                    .getBuilding()
                    .getProperty()
                : null;

        if (property != null) {

            // Property owner.
            if (property.getOwner() != null
                    && property.getOwner().getId() != null) {

                Long ownerUserId = property.getOwner().getId();

                if (!recipientUserIds.contains(ownerUserId)) {
                    recipientUserIds.add(ownerUserId);
                }
            }

            // Assigned property manager.
            if (property.getPropertyManager() != null
                    && property.getPropertyManager().getUser() != null
                    && property.getPropertyManager().getUser().getId() != null) {

                Long managerUserId =
                        property.getPropertyManager().getUser().getId();

                if (!recipientUserIds.contains(managerUserId)) {
                    recipientUserIds.add(managerUserId);
                }
            }
        }

        if (recipientUserIds.isEmpty()) {
            return;
        }

        NotificationType notificationType;
        String title;
        String tenantMessage;
        String managementMessage;

        if (agreement.getStatus() == AgreementStatus.ACTIVE) {

            notificationType = NotificationType.AGREEMENT_ACTIVE;
            title = "Rental Agreement Activated";
            tenantMessage =
                    "Your rental agreement has been activated successfully.";
            managementMessage =
                    "A rental agreement for your property has been activated.";

        } else if (agreement.getStatus() == AgreementStatus.EXPIRED) {

            notificationType = NotificationType.AGREEMENT_EXPIRED;
            title = "Rental Agreement Expired";
            tenantMessage = "Your rental agreement has expired.";
            managementMessage =
                    "A rental agreement for your property has expired.";

        } else if (agreement.getStatus() == AgreementStatus.TERMINATED) {

            notificationType = NotificationType.AGREEMENT_TERMINATED;
            title = "Rental Agreement Terminated";
            tenantMessage = "Your rental agreement has been terminated.";
            managementMessage =
                    "A rental agreement for your property has been terminated.";

        } else {
            // Do not notify for DRAFT or unchanged/unsupported statuses.
            return;
        }

        Long agreementId = agreement.getAgreementId();

        for (Long recipientUserId : recipientUserIds) {

            boolean isTenant = Objects.equals(
                    recipientUserId, tenantUserId);

            notificationService.notifyUser(
                    recipientUserId,
                    notificationType,
                    NotificationPriority.HIGH,
                    title,
                    isTenant ? tenantMessage : managementMessage,
                    agreementId,
                    "RENTAL_AGREEMENT");
        }
    }

    // =========================================================
    // VALIDATE ACTIVATION
    // =========================================================

    private void validateActivation(RentalAgreement agreement) {

        if (agreement.getStartDate() == null
                || agreement.getEndDate() == null) {
            throw new IllegalStateException(
                    "Agreement start date and end date are required before activation");
        }

        if (agreement.getEndDate().isBefore(agreement.getStartDate())) {
            throw new IllegalStateException(
                    "Agreement end date cannot be before start date");
        }

        if (agreement.getMoveInDate() != null
                && agreement.getMoveInDate()
                        .isBefore(agreement.getStartDate())) {
            throw new IllegalStateException(
                    "Move-in date cannot be before agreement start date");
        }

        Unit unit = agreement.getUnit();
        if (unit != null) {
            if (unit.getStatus() != UnitStatus.VACANT) {
                throw new IllegalStateException(
                        "Agreement cannot be activated because the unit is not vacant");
            }
            if (rentalAgreementRepository.existsByUnit_UnitIdAndStatus(
                    unit.getUnitId(), AgreementStatus.ACTIVE)) {
                throw new IllegalStateException(
                        "This unit already has an active rental agreement");
            }
        } else {
            Property property = agreement.getProperty();
            if (property == null) {
                throw new IllegalStateException("Agreement property is missing");
            }
            if (property.getStatus() != PropertyStatus.AVAILABLE
                    && property.getStatus() != PropertyStatus.PUBLISHED) {
                throw new IllegalStateException(
                        "Agreement cannot be activated because the property is not available");
            }
            if (rentalAgreementRepository.existsByProperty_PropertyIdAndStatus(
                    property.getPropertyId(), AgreementStatus.ACTIVE)) {
                throw new IllegalStateException(
                        "This property already has an active rental agreement");
            }
        }
    }

    // =========================================================
    // OCCUPY UNIT
    // =========================================================

    private void occupyUnit(Unit unit) {
        if (unit != null) {
            unit.setStatus(UnitStatus.OCCUPIED);
        }
    }

    // =========================================================
    // RELEASE UNIT
    // =========================================================

    private void releaseUnit(Unit unit) {
        if (unit != null) {
            unit.setStatus(UnitStatus.VACANT);
        }
    }

    // =========================================================
    // VALIDATE CREATE DATES
    // =========================================================

    private void validateDates(RentalApplication application) {

        LocalDate moveInDate = application.getPreferredMoveInDate();

        if (moveInDate == null) {
            throw new IllegalArgumentException(
                    "Preferred move-in date is required in the rental application");
        }

        Integer leaseDurationMonths =
                application.getPreferredLeaseDurationMonths();

        if (leaseDurationMonths == null || leaseDurationMonths < 1) {
            throw new IllegalArgumentException(
                    "Preferred lease duration must be at least 1 month in the rental application");
        }

        LocalDate calculatedEndDate = moveInDate
                .plusMonths(leaseDurationMonths)
                .minusDays(1);

        if (calculatedEndDate.isBefore(moveInDate)) {
            throw new IllegalArgumentException(
                    "Calculated agreement end date cannot be before start date");
        }
    }

    // =========================================================
    // USER LOOKUP
    // =========================================================

    private User getUserByEmail(String email) {

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException(
                    "Authenticated user email is required");
        }

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new EntityNotFoundException(
                        "User not found with email: " + email));
    }

    // =========================================================
    // AGREEMENT LOOKUP
    // =========================================================

    private RentalAgreement getAgreementEntity(Long agreementId) {

        if (agreementId == null) {
            throw new IllegalArgumentException(
                    "Agreement ID is required");
        }

        return rentalAgreementRepository
                .findForAccessByAgreementId(agreementId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Rental agreement not found with ID: " + agreementId));
    }

    // =========================================================
    // GENERAL AGREEMENT ACCESS
    // =========================================================

    private boolean hasAccess(
            RentalAgreement agreement,
            User user) {

        if (agreement == null || user == null) {
            return false;
        }

        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return true;
        }

        // Tenant can access only their own agreement.
        if (user.getRole() == RoleType.TENANT) {
            return agreement.getTenant() != null
                    && agreement.getTenant().getUser() != null
                    && agreement.getTenant().getUser().getId() != null
                    && agreement.getTenant().getUser().getId()
                            .equals(user.getId());
        }

        var property = agreement.getProperty();
        if (property == null && agreement.getUnit() != null
                && agreement.getUnit().getFloor() != null
                && agreement.getUnit().getFloor().getBuilding() != null) {
            property = agreement.getUnit().getFloor().getBuilding().getProperty();
        }
        if (property == null) return false;

        // Owner can access only their own properties.
        if (user.getRole() == RoleType.PROPERTY_OWNER) {
            return property.getOwner() != null
                    && property.getOwner().getId() != null
                    && property.getOwner().getId().equals(user.getId());
        }

        // Manager can access only assigned properties.
        if (user.getRole() == RoleType.PROPERTY_MANAGER) {
            return property.getPropertyManager() != null
                    && property.getPropertyManager().getUser() != null
                    && property.getPropertyManager().getUser().getId() != null
                    && property.getPropertyManager().getUser().getId()
                            .equals(user.getId());
        }

        return false;
    }

    // =========================================================
    // APPLICATION PROPERTY ACCESS
    // =========================================================

    private boolean hasApplicationPropertyAccess(
            RentalApplication application,
            User user) {

        if (application == null) {
            return false;
        }
        var property = application.getProperty();
        if (property == null && application.getUnit() != null
                && application.getUnit().getFloor() != null
                && application.getUnit().getFloor().getBuilding() != null) {
            property = application.getUnit().getFloor().getBuilding().getProperty();
        }
        if (property == null) return false;

        if (user.getRole() == RoleType.PROPERTY_OWNER) {
            return property.getOwner() != null
                    && property.getOwner().getId() != null
                    && property.getOwner().getId().equals(user.getId());
        }

        if (user.getRole() == RoleType.PROPERTY_MANAGER) {
            return property.getPropertyManager() != null
                    && property.getPropertyManager().getUser() != null
                    && property.getPropertyManager().getUser().getId() != null
                    && property.getPropertyManager().getUser().getId()
                            .equals(user.getId());
        }

        return false;
    }

    // =========================================================
    // MANAGEMENT ACCESS
    // =========================================================

    private void validateManagementAccess(
            RentalAgreement agreement,
            User user) {

        if (user == null) {
            throw new IllegalStateException(
                    "Authenticated user not found");
        }

        if (user.getRole() == RoleType.TENANT) {
            throw new IllegalStateException(
                    "Tenant is not authorized to modify a rental agreement");
        }

        if (user.getRole() != RoleType.SUPER_ADMIN
                && user.getRole() != RoleType.PROPERTY_OWNER
                && user.getRole() != RoleType.PROPERTY_MANAGER) {
            throw new IllegalStateException(
                    "You are not authorized to modify this rental agreement");
        }

        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return;
        }

        if (!hasAccess(agreement, user)) {
            throw new IllegalStateException(
                    "You are not authorized to modify this rental agreement");
        }
    }

    // =========================================================
    // RESPONSE MAPPING
    // =========================================================

    private RentalAgreementResponse mapToResponse(
            RentalAgreement agreement) {

        RentalAgreementResponse response = new RentalAgreementResponse();

        response.setAgreementId(agreement.getAgreementId());

        if (agreement.getRentalApplication() != null) {
            response.setApplicationId(
                    agreement.getRentalApplication().getApplicationId());

            response.setLeaseDurationMonths(
                    agreement.getRentalApplication()
                            .getPreferredLeaseDurationMonths());
        }

        if (agreement.getTenant() != null) {
            response.setTenantId(agreement.getTenant().getTenantId());
        }

        if (agreement.getUnit() != null) {
            response.setUnitId(agreement.getUnit().getUnitId());
        }
        if (agreement.getProperty() != null) {
            response.setPropertyId(agreement.getProperty().getPropertyId());
            response.setPropertyName(agreement.getProperty().getPropertyName());
        } else if (agreement.getUnit() != null
                && agreement.getUnit().getFloor() != null
                && agreement.getUnit().getFloor().getBuilding() != null
                && agreement.getUnit().getFloor().getBuilding().getProperty() != null) {
            Property unitProperty = agreement.getUnit().getFloor()
                    .getBuilding().getProperty();
            response.setPropertyId(unitProperty.getPropertyId());
            response.setPropertyName(unitProperty.getPropertyName());
        }

        response.setStartDate(agreement.getStartDate());
        response.setEndDate(agreement.getEndDate());
        response.setMonthlyRent(agreement.getMonthlyRent());
        response.setSecurityDeposit(agreement.getSecurityDeposit());
        response.setDueDay(agreement.getDueDay());
        response.setNoticePeriodDays(agreement.getNoticePeriodDays());

        // Database stores the S3 object key.
        // API response returns a presigned URL.
        String documentKey = agreement.getAgreementDocument();

        if (documentKey != null && !documentKey.isBlank()) {
            if (documentKey.startsWith("/uploads/")) {
                // Backward compatibility for old local records.
                response.setAgreementDocument(documentKey);
            } else {
                response.setAgreementDocument(
                        s3Service.generatePresignedUrl(documentKey));
            }
        } else {
            response.setAgreementDocument(null);
        }

        response.setMoveInDate(agreement.getMoveInDate());
        response.setMoveOutDate(agreement.getMoveOutDate());
        response.setStatus(agreement.getStatus());
        response.setTermsAndConditions(
                agreement.getTermsAndConditions());
        response.setCreatedAt(agreement.getCreatedAt());
        response.setUpdatedAt(agreement.getUpdatedAt());

        return response;
    }

    // =========================================================
    // CLEAN STRING
    // =========================================================

    private String cleanString(String value) {

        if (value == null) {
            return null;
        }

        String cleaned = value.trim();

        return cleaned.isEmpty() ? null : cleaned;
    }

    // =========================================================
    // GET AGREEMENT DOCUMENT
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public Resource getAgreementDocument(
            Long agreementId,
            String email) {

        User user = getUserByEmail(email);
        RentalAgreement agreement = getAgreementEntity(agreementId);

        if (!hasAccess(agreement, user)) {
            throw new IllegalStateException(
                    "You are not authorized to access this agreement document");
        }

        String documentKey = agreement.getAgreementDocument();

        if (documentKey == null || documentKey.isBlank()) {
            throw new EntityNotFoundException(
                    "Agreement document not found for agreement ID: "
                            + agreementId);
        }

        if (documentKey.startsWith("/uploads/")) {
            throw new EntityNotFoundException(
                    "This agreement document is stored in the old local filesystem");
        }

        return s3Service.downloadFile(documentKey);
    }
}
