package com.rental.rental_management_backend.notification.serviceImpl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.notification.dto.PushSubscriptionRequest;
import com.rental.rental_management_backend.notification.dto.PushSubscriptionRequest.SubscriptionKeys;
import com.rental.rental_management_backend.notification.entity.UserDeviceToken;
import com.rental.rental_management_backend.notification.repository.UserDeviceTokenRepository;

@ExtendWith(MockitoExtension.class)
class DeviceSubscriptionServiceTest {

    @Mock
    private UserDeviceTokenRepository deviceTokenRepository;
    @Mock
    private UserRepository userRepository;

    private DeviceSubscriptionService service;
    private User user;
    private PushSubscriptionRequest request;

    @BeforeEach
    void setUp() {
        service = new DeviceSubscriptionService(
                deviceTokenRepository,
                userRepository);

        user = new User();
        user.setId(42L);

        SubscriptionKeys keys = new SubscriptionKeys();
        keys.setP256dh("browser-public-key");
        keys.setAuth("browser-auth-key");

        request = new PushSubscriptionRequest();
        request.setEndpoint("https://fcm.googleapis.com/fcm/send/endpoint-token");
        request.setKeys(keys);
    }

    @Test
    void registrationPersistsOnlyTheAuthenticatedUserAndCanRepeat() {
        UserDeviceToken saved = mock(UserDeviceToken.class);
        when(userRepository.findById(42L)).thenReturn(Optional.of(user));
        when(deviceTokenRepository.upsertOwnedEndpoint(
                42L,
                request.getEndpoint(),
                "browser-public-key",
                "browser-auth-key",
                "WEB")).thenReturn(1);
        when(deviceTokenRepository.findByEndpoint(request.getEndpoint()))
                .thenReturn(Optional.of(saved));
        when(saved.getId()).thenReturn(9L);
        when(saved.getDeviceType()).thenReturn("WEB");
        when(saved.getUser()).thenReturn(user);

        assertEquals(9L, service.register(42L, request).deviceId());
        assertEquals(9L, service.register(42L, request).deviceId());

        verify(deviceTokenRepository, org.mockito.Mockito.times(2))
                .upsertOwnedEndpoint(
                        42L,
                        request.getEndpoint(),
                        "browser-public-key",
                        "browser-auth-key",
                        "WEB");
    }

    @Test
    void subscriptionAlreadyOwnedByAnotherUserCannotBeReassigned() {
        when(userRepository.findById(42L)).thenReturn(Optional.of(user));
        when(deviceTokenRepository.upsertOwnedEndpoint(
                42L,
                request.getEndpoint(),
                "browser-public-key",
                "browser-auth-key",
                "WEB")).thenReturn(0);
        when(deviceTokenRepository.findByEndpoint(request.getEndpoint()))
                .thenReturn(Optional.of(mock(UserDeviceToken.class)));

        assertThrows(
                ResponseStatusException.class,
                () -> service.register(42L, request));
    }

    @Test
    void removingAnotherUsersDeviceDoesNotDeleteIt() {
        when(deviceTokenRepository.deactivateOwnedToken(8L, 42L))
                .thenReturn(0);

        assertThrows(
                ResponseStatusException.class,
                () -> service.remove(42L, 8L));

        verify(deviceTokenRepository, never()).deleteById(8L);
    }
}
