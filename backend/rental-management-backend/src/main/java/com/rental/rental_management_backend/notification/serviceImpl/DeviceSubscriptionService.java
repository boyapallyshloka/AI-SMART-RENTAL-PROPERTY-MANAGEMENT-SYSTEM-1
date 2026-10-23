package com.rental.rental_management_backend.notification.serviceImpl;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.notification.dto.DeviceRegistrationResponse;
import com.rental.rental_management_backend.notification.dto.PushSubscriptionRequest;
import com.rental.rental_management_backend.notification.entity.UserDeviceToken;
import com.rental.rental_management_backend.notification.repository.UserDeviceTokenRepository;

@Service
public class DeviceSubscriptionService {

    private final UserDeviceTokenRepository deviceTokenRepository;
    private final UserRepository userRepository;

    public DeviceSubscriptionService(
            UserDeviceTokenRepository deviceTokenRepository,
            UserRepository userRepository) {
        this.deviceTokenRepository = deviceTokenRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public DeviceRegistrationResponse register(
            Long authenticatedUserId,
            PushSubscriptionRequest request) {
        User user = userRepository.findById(authenticatedUserId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Authenticated user was not found"));

        int updated = deviceTokenRepository.upsertOwnedEndpoint(
                user.getId(),
                request.getEndpoint(),
                request.getKeys().getP256dh(),
                request.getKeys().getAuth(),
                request.getDeviceType() == null
                        ? "WEB"
                        : request.getDeviceType());

        UserDeviceToken subscription = deviceTokenRepository
                .findByEndpoint(request.getEndpoint())
                .orElseThrow(() -> new IllegalStateException(
                        "Subscription registration did not produce a record"));

        if (updated == 0
                || !subscription.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This browser subscription is registered to another account");
        }

        return toResponse(subscription);
    }

    @Transactional
    public void remove(Long authenticatedUserId, Long deviceId) {
        if (deviceTokenRepository.deactivateOwnedToken(
                deviceId,
                authenticatedUserId) == 0) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Device subscription was not found");
        }
    }

    private DeviceRegistrationResponse toResponse(
            UserDeviceToken subscription) {
        return new DeviceRegistrationResponse(
                subscription.getId(),
                subscription.getDeviceType(),
                subscription.getCreatedAt(),
                subscription.getUpdatedAt());
    }
}
