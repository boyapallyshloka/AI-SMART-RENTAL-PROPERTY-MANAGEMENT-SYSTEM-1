package com.rental.rental_management_backend.notification.service;

import com.rental.rental_management_backend.User.enums.RoleType;

public record NotificationCreatedEvent(
        Long notificationId,
        Long userId,
        String title,
        String body,
        String referenceType,
        Long referenceId,
        RoleType recipientRole) {
}
