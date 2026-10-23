package com.rental.rental_management_backend.notification.serviceImpl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.notification.entity.UserDeviceToken;
import com.rental.rental_management_backend.notification.repository.UserDeviceTokenRepository;
import com.rental.rental_management_backend.notification.service.PushProvider;

@ExtendWith(MockitoExtension.class)
class WebPushNotificationServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserDeviceTokenRepository deviceTokenRepository;
    @Mock
    private PushProvider pushProvider;

    private WebPushNotificationService service;

    @BeforeEach
    void setUp() {
        service = new WebPushNotificationService(
                userRepository,
                deviceTokenRepository,
                pushProvider,
                new ObjectMapper(),
                "/favicon.svg");
    }

    @ParameterizedTest
    @EnumSource(value = RoleType.class, names = {
            "TENANT", "PROPERTY_OWNER", "PROPERTY_MANAGER"
    })
    void sendsWebPushWithSupportedRoleDeepLink(RoleType role) throws Exception {
        User recipient = new User();
        recipient.setId(73L);
        recipient.setRole(role);

        UserDeviceToken device = mock(UserDeviceToken.class);
        when(userRepository.findById(73L)).thenReturn(Optional.of(recipient));
        when(deviceTokenRepository.findByUser_IdAndActiveTrue(73L))
                .thenReturn(List.of(device));
        when(pushProvider.send(eq(device), any())).thenReturn(201);

        service.sendSystemAlertNotification(
                73L,
                "Maintenance update",
                "Your request has changed.",
                "MAINTENANCE",
                18L,
                role);

        ArgumentCaptor<String> payloadCaptor =
                ArgumentCaptor.forClass(String.class);
        verify(pushProvider).send(eq(device), payloadCaptor.capture());

        JsonNode payload = new ObjectMapper().readTree(payloadCaptor.getValue());
        assertEquals("Maintenance update", payload.get("title").asText());
        assertEquals("Your request has changed.", payload.get("body").asText());
        assertEquals("/favicon.svg", payload.get("icon").asText());
        assertEquals(
                "/" + (switch (role) {
                    case TENANT -> "tenant";
                    case PROPERTY_OWNER -> "owner";
                    case PROPERTY_MANAGER -> "manager";
                    default -> throw new IllegalStateException();
                }) + "/resolve?type=MAINTENANCE&id=18",
                payload.get("data").get("url").asText());
    }

    @Test
    void sendsOnlyToIntendedRecipientsDevices() {
        User recipient = new User();
        recipient.setId(73L);
        recipient.setRole(RoleType.TENANT);
        UserDeviceToken recipientDevice = mock(UserDeviceToken.class);

        when(userRepository.findById(73L)).thenReturn(Optional.of(recipient));
        when(deviceTokenRepository.findByUser_IdAndActiveTrue(73L))
                .thenReturn(List.of(recipientDevice));
        when(pushProvider.send(eq(recipientDevice), any())).thenReturn(201);

        service.sendSystemAlertNotification(
                73L,
                "Rent due",
                "An invoice is ready.",
                "RENT_INVOICE",
                3L,
                RoleType.TENANT);

        verify(pushProvider).send(eq(recipientDevice), any());
        verify(deviceTokenRepository).findByUser_IdAndActiveTrue(73L);
    }

    @Test
    void expiresSubscriptionsWhenProviderRejectsThem() {
        User recipient = new User();
        recipient.setId(73L);
        recipient.setRole(RoleType.TENANT);
        UserDeviceToken device = mock(UserDeviceToken.class);
        when(device.getId()).thenReturn(6L);
        when(userRepository.findById(73L)).thenReturn(Optional.of(recipient));
        when(deviceTokenRepository.findByUser_IdAndActiveTrue(73L))
                .thenReturn(List.of(device));
        when(pushProvider.send(eq(device), any())).thenReturn(410);

        service.sendSystemAlertNotification(
                73L,
                "Rent due",
                "An invoice is ready.",
                "RENT_INVOICE",
                3L,
                RoleType.TENANT);

        verify(deviceTokenRepository).deactivateOwnedToken(6L, 73L);
    }

    @Test
    void roleMismatchAndUnsupportedDestinationsAreNotDispatched() {
        User recipient = new User();
        recipient.setId(73L);
        recipient.setRole(RoleType.TENANT);
        when(userRepository.findById(73L)).thenReturn(Optional.of(recipient));

        service.sendSystemAlertNotification(
                73L,
                "Property review",
                "Review needed.",
                "PROPERTY",
                18L,
                RoleType.SUPER_ADMIN);

        service.sendSystemAlertNotification(
                73L,
                "Maintenance update",
                "Changed.",
                "UNKNOWN_ENTITY",
                18L,
                RoleType.TENANT);

        verify(deviceTokenRepository, never())
                .findByUser_IdAndActiveTrue(any());
        verify(pushProvider, never()).send(any(), any());
    }

    @Test
    void transientProviderFailuresAreRetriedWithBoundedAttempts() {
        User recipient = new User();
        recipient.setId(73L);
        recipient.setRole(RoleType.TENANT);
        UserDeviceToken device = mock(UserDeviceToken.class);
        when(userRepository.findById(73L)).thenReturn(Optional.of(recipient));
        when(deviceTokenRepository.findByUser_IdAndActiveTrue(73L))
                .thenReturn(List.of(device));
        when(pushProvider.send(eq(device), any()))
                .thenReturn(503, 503, 201);

        service.sendSystemAlertNotification(
                73L,
                "Rent due",
                "An invoice is ready.",
                "RENT_INVOICE",
                3L,
                RoleType.TENANT);

        verify(pushProvider, org.mockito.Mockito.times(3))
                .send(eq(device), any());
    }
}
