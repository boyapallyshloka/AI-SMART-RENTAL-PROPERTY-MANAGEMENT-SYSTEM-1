package com.rental.rental_management_backend.notification.serviceImpl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.rental.rental_management_backend.notification.service.NotificationCreatedEvent;

@Component
public class NotificationPushEventListener {

    private static final Logger LOGGER =
            LoggerFactory.getLogger(NotificationPushEventListener.class);

    private final WebPushNotificationService webPushNotificationService;

    public NotificationPushEventListener(
            WebPushNotificationService webPushNotificationService) {
        this.webPushNotificationService = webPushNotificationService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onNotificationCreated(NotificationCreatedEvent event) {
        try {
            webPushNotificationService.sendSystemAlertNotification(
                    event.userId(),
                    event.title(),
                    event.body(),
                    event.referenceType(),
                    event.referenceId(),
                    event.recipientRole());
        } catch (RuntimeException exception) {
            LOGGER.error(
                    "Web Push failed after notification commit; notificationId={}",
                    event.notificationId());
        }
    }
}
