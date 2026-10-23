package com.rental.rental_management_backend.notification.dto;

import java.time.LocalDateTime;

public record DeviceRegistrationResponse(
        Long deviceId,
        String deviceType,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
