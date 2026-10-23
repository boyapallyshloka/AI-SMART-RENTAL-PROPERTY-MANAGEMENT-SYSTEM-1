package com.rental.rental_management_backend.notification.serviceImpl;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.notification.entity.UserDeviceToken;
import com.rental.rental_management_backend.notification.repository.UserDeviceTokenRepository;
import com.rental.rental_management_backend.notification.service.PushProvider;
import com.rental.rental_management_backend.notification.service.WebPushDeliveryException;

@Service
public class WebPushNotificationService {

    private static final Logger LOGGER =
            LoggerFactory.getLogger(WebPushNotificationService.class);
    private static final int MAX_ATTEMPTS = 3;

    private final UserRepository userRepository;
    private final UserDeviceTokenRepository deviceTokenRepository;
    private final PushProvider pushProvider;
    private final ObjectMapper objectMapper;
    private final String icon;

    public WebPushNotificationService(
            UserRepository userRepository,
            UserDeviceTokenRepository deviceTokenRepository,
            PushProvider pushProvider,
            ObjectMapper objectMapper,
            @Value("${webpush.icon:/favicon.ico}") String icon) {
        this.userRepository = userRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.pushProvider = pushProvider;
        this.objectMapper = objectMapper;
        this.icon = icon;
    }

    public void sendSystemAlertNotification(
            Long userId,
            String title,
            String body,
            String type,
            Long entityId,
            RoleType userRole) {
        if (userId == null || userRole == null) {
            LOGGER.warn("Skipping Web Push because recipient identity is incomplete");
            return;
        }

        User recipient = userRepository.findById(userId).orElse(null);
        if (recipient == null || recipient.getRole() != userRole) {
            LOGGER.warn("Skipping Web Push because recipient role could not be verified");
            return;
        }

        String url = PushDeepLink.create(userRole, type, entityId);
        if (url == null) {
            LOGGER.debug("Skipping Web Push for unsupported route type or recipient role");
            return;
        }

        List<UserDeviceToken> subscriptions =
                deviceTokenRepository.findByUser_IdAndActiveTrue(userId);
        if (subscriptions.isEmpty()) {
            return;
        }

        String payload;
        try {
            payload = objectMapper.writeValueAsString(Map.of(
                    "title", title,
                    "body", body,
                    "icon", icon,
                    "data", Map.of("url", url)));
        } catch (JsonProcessingException exception) {
            LOGGER.error("Unable to serialize Web Push payload", exception);
            return;
        }

        for (UserDeviceToken subscription : subscriptions) {
            deliverToSubscription(userId, subscription, payload);
        }
    }

    private void deliverToSubscription(
            Long userId,
            UserDeviceToken subscription,
            String payload) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                int status = pushProvider.send(subscription, payload);
                if (status >= 200 && status < 300) {
                    return;
                }
                if (status == 404 || status == 410) {
                    deviceTokenRepository.deactivateOwnedToken(
                            subscription.getId(),
                            userId);
                    LOGGER.info(
                            "Deactivated expired Web Push subscription id={}",
                            subscription.getId());
                    return;
                }
                if (!isRetryableStatus(status) || attempt == MAX_ATTEMPTS) {
                    LOGGER.warn(
                            "Web Push provider returned status={} for subscription id={}",
                            status,
                            subscription.getId());
                    return;
                }
            } catch (WebPushDeliveryException exception) {
                if (!exception.isRetryable() || attempt == MAX_ATTEMPTS) {
                    LOGGER.warn(
                            "Web Push delivery failed for subscription id={} after attempt={}",
                            subscription.getId(),
                            attempt);
                    return;
                }
            }

            if (!waitBeforeRetry(attempt)) {
                return;
            }
        }
    }

    private boolean waitBeforeRetry(int attempt) {
        try {
            Thread.sleep(100L * attempt);
            return true;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            LOGGER.warn("Web Push retry interrupted");
            return false;
        }
    }

    private boolean isRetryableStatus(int status) {
        return status == 429 || status >= 500;
    }
}
