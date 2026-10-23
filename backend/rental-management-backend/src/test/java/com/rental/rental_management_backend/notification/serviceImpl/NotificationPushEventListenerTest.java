package com.rental.rental_management_backend.notification.serviceImpl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Method;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.notification.service.NotificationCreatedEvent;

@ExtendWith(MockitoExtension.class)
class NotificationPushEventListenerTest {

    @Mock
    private WebPushNotificationService webPushNotificationService;

    @InjectMocks
    private NotificationPushEventListener listener;

    @Test
    void deliveryFailureDoesNotEscapeTheAfterCommitListener() {
        NotificationCreatedEvent event = new NotificationCreatedEvent(
                8L,
                3L,
                "Property approved",
                "Your property was approved.",
                "PROPERTY",
                12L,
                RoleType.PROPERTY_OWNER);
        doThrow(new IllegalStateException("provider unavailable"))
                .when(webPushNotificationService)
                .sendSystemAlertNotification(
                        3L,
                        "Property approved",
                        "Your property was approved.",
                        "PROPERTY",
                        12L,
                        RoleType.PROPERTY_OWNER);

        assertDoesNotThrow(() -> listener.onNotificationCreated(event));
        verify(webPushNotificationService).sendSystemAlertNotification(
                3L,
                "Property approved",
                "Your property was approved.",
                "PROPERTY",
                12L,
                RoleType.PROPERTY_OWNER);
    }

    @Test
    void pushEventIsRegisteredForAfterCommitOnly() throws Exception {
        Method listenerMethod = NotificationPushEventListener.class
                .getMethod(
                        "onNotificationCreated",
                        NotificationCreatedEvent.class);

        assertEquals(
                TransactionPhase.AFTER_COMMIT,
                listenerMethod
                        .getAnnotation(TransactionalEventListener.class)
                        .phase());
    }
}
