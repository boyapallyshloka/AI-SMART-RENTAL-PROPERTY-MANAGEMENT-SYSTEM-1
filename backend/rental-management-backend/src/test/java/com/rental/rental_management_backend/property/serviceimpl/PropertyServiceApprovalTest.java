package com.rental.rental_management_backend.property.serviceimpl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.enums.UserStatus;
import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.service.NotificationService;
import com.rental.rental_management_backend.property.dto.PropertyRequest;
import com.rental.rental_management_backend.property.dto.PropertyResponse;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.repository.PropertyManagerRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.service.PropertyDocumentService;
import com.rental.rental_management_backend.s3.service.S3Service;

@ExtendWith(MockitoExtension.class)
class PropertyServiceApprovalTest {

    @Mock
    private PropertyRepository propertyRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PropertyManagerRepository propertyManagerRepository;
    @Mock
    private PropertyNotificationDispatcher notificationDispatcher;
    @Mock
    private S3Service s3Service;
    @Mock
    private PropertyDocumentService propertyDocumentService;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private PropertyServiceImpl propertyService;

    private User owner;
    private User admin;
    private Property property;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(4L);
        owner.setFirstName("Alex");
        owner.setLastName("Owner");
        owner.setEmail("owner@example.test");
        owner.setRole(RoleType.PROPERTY_OWNER);
        owner.setStatus(UserStatus.ACTIVE);

        admin = new User();
        admin.setId(9L);
        admin.setEmail("admin@example.test");
        admin.setRole(RoleType.SUPER_ADMIN);
        admin.setStatus(UserStatus.ACTIVE);

        property = new Property();
        property.setPropertyId(72L);
        property.setPropertyName("Lake House");
        property.setOwner(owner);
        property.setStatus(PropertyStatus.DRAFT);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void ownerSubmissionKeepsDraftStatusFlagsReviewAndNotifiesActiveAdminsOnce() {
        authenticate(owner.getEmail());
        when(userRepository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(propertyRepository.findByPropertyIdAndOwnerForUpdate(72L, owner))
                .thenReturn(Optional.of(property));
        when(userRepository.findByRoleAndStatus(RoleType.SUPER_ADMIN, UserStatus.ACTIVE))
                .thenReturn(List.of(admin));
        when(propertyRepository.save(property)).thenReturn(property);

        PropertyResponse result = propertyService.submitPropertyForApproval(72L);

        assertEquals(PropertyStatus.DRAFT, result.getStatus());
        org.junit.jupiter.api.Assertions.assertTrue(result.isSubmittedForApproval());
        verify(propertyDocumentService).validatePropertySubmissionEligibility(property);
        verify(notificationService).notifyUserOnce(
                eq(admin.getId()),
                eq(NotificationType.PROPERTY_SUBMITTED),
                eq(NotificationPriority.HIGH),
                eq("Property submitted for review"),
                any(String.class),
                eq(72L),
                eq("PROPERTY"),
                eq("property-submitted-72-admin-9"));

        propertyService.submitPropertyForApproval(72L);
        verify(notificationService).notifyUserOnce(
                eq(admin.getId()),
                eq(NotificationType.PROPERTY_SUBMITTED),
                eq(NotificationPriority.HIGH),
                eq("Property submitted for review"),
                any(String.class),
                eq(72L),
                eq("PROPERTY"),
                eq("property-submitted-72-admin-9"));
    }

    @Test
    void approvalRequiresAdministratorAndApprovedRequiredDocuments() {
        authenticate(admin.getEmail());
        property.setStatus(PropertyStatus.DRAFT);
        property.setSubmittedForApproval(true);
        when(userRepository.findByEmail(admin.getEmail())).thenReturn(Optional.of(admin));
        when(propertyRepository.findByPropertyIdForUpdate(72L))
                .thenReturn(Optional.of(property));
        when(propertyRepository.save(property)).thenReturn(property);

        PropertyResponse result = propertyService.approveProperty(72L);

        assertEquals(PropertyStatus.AVAILABLE, result.getStatus());
        org.junit.jupiter.api.Assertions.assertFalse(result.isSubmittedForApproval());
        verify(propertyDocumentService).validatePropertyPublishEligibility(property);
        verify(notificationService).notifyUserOnce(
                eq(owner.getId()),
                eq(NotificationType.PROPERTY_APPROVED),
                eq(NotificationPriority.HIGH),
                eq("Property approved"),
                any(String.class),
                eq(72L),
                eq("PROPERTY"),
                eq("property-approved-72"));

        // Repeated approval requests return the published property without a second alert.
        PropertyResponse repeated = propertyService.approveProperty(72L);
        assertEquals(PropertyStatus.AVAILABLE, repeated.getStatus());
        verify(notificationService, org.mockito.Mockito.times(1)).notifyUserOnce(
                eq(owner.getId()), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void ownerCannotApproveOrSetApprovalStatusDirectly() {
        authenticate(owner.getEmail());
        when(userRepository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(propertyRepository.findByPropertyIdAndOwner(72L, owner))
                .thenReturn(Optional.of(property));

        assertThrows(AccessDeniedException.class,
                () -> propertyService.approveProperty(72L));
        assertThrows(IllegalArgumentException.class,
                () -> propertyService.updatePropertyStatus(72L, PropertyStatus.OCCUPIED));
        verify(notificationService, never()).notifyUserOnce(
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void ownerCannotSubmitWithoutRequiredDocuments() {
        authenticate(owner.getEmail());
        when(userRepository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(propertyRepository.findByPropertyIdAndOwnerForUpdate(72L, owner))
                .thenReturn(Optional.of(property));
        org.mockito.Mockito.doThrow(new IllegalStateException("Title deed required"))
                .when(propertyDocumentService)
                .validatePropertySubmissionEligibility(property);

        assertThrows(IllegalStateException.class,
                () -> propertyService.submitPropertyForApproval(72L));
        verify(propertyRepository, never()).save(any(Property.class));
        verify(notificationService, never()).notifyUserOnce(
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void ownerCanToggleAnApprovedPropertyBetweenAvailableAndNotAvailable() {
        authenticate(owner.getEmail());
        property.setStatus(PropertyStatus.AVAILABLE);
        when(userRepository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(propertyRepository.findByPropertyIdAndOwner(72L, owner))
                .thenReturn(Optional.of(property));
        when(propertyRepository.save(property)).thenReturn(property);

        PropertyResponse unavailable = propertyService.updatePropertyStatus(
                72L, PropertyStatus.NOT_AVAILABLE);
        assertEquals(PropertyStatus.NOT_AVAILABLE, unavailable.getStatus());

        PropertyResponse available = propertyService.updatePropertyStatus(
                72L, PropertyStatus.AVAILABLE);
        assertEquals(PropertyStatus.AVAILABLE, available.getStatus());
        verify(propertyDocumentService).validatePropertyPublishEligibility(property);
    }

    @Test
    void ownerCannotEditOrDeleteWhilePropertyIsUnderReview() {
        authenticate(owner.getEmail());
        ownerPropertyPending();

        assertThrows(IllegalStateException.class,
                () -> propertyService.updateProperty(72L, new PropertyRequest()));
        assertThrows(IllegalStateException.class,
                () -> propertyService.deleteProperty(72L));
        verify(propertyRepository, never()).save(any(Property.class));
        verify(propertyRepository, never()).delete(property);
    }

    private void ownerPropertyPending() {
        property.setStatus(PropertyStatus.DRAFT);
        property.setSubmittedForApproval(true);
        when(userRepository.findByEmail(owner.getEmail())).thenReturn(Optional.of(owner));
        when(propertyRepository.findByPropertyIdAndOwner(72L, owner))
                .thenReturn(Optional.of(property));
    }

    private void authenticate(String email) {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(
                        email, "password", List.of()));
    }
}
