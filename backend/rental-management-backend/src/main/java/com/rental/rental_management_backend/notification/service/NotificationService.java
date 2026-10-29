
package com.rental.rental_management_backend.notification.service;

import java.util.List;

import com.rental.rental_management_backend.notification.dto.NotificationCreateRequest;
import com.rental.rental_management_backend.notification.dto.NotificationResponse;
import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;

public interface NotificationService {

    // =========================================================
    // CREATE NOTIFICATION
    // =========================================================

    NotificationResponse createNotification(
            NotificationCreateRequest request
    );

    // =========================================================
    // GET NOTIFICATIONS OF LOGGED-IN USER
    // =========================================================

    List<NotificationResponse> getMyNotifications();

    // =========================================================
    // GET UNREAD NOTIFICATIONS OF LOGGED-IN USER
    // =========================================================

    List<NotificationResponse> getMyUnreadNotifications();

    // =========================================================
    // GET UNREAD NOTIFICATION COUNT
    // =========================================================

    long getMyUnreadCount();

    // =========================================================
    // MARK ONE NOTIFICATION AS READ
    // =========================================================

    void markAsRead(Long notificationId);

    // =========================================================
    // MARK ALL NOTIFICATIONS AS READ
    // =========================================================

    void markAllAsRead();

    // =========================================================
    // SEND NOTIFICATION TO A SPECIFIC USER
    // Used by Maintenance, Rent Payment, Rental Agreement,
    // and other application modules.
    //
    // The implementation should save the notification for
    // the specified user and send it through SSE if connected.
    // =========================================================

    void notifyUser(
            Long userId,
            NotificationType type,
            NotificationPriority priority,
            String title,
            String message,
            Long referenceId,
            String referenceType
    );
}

