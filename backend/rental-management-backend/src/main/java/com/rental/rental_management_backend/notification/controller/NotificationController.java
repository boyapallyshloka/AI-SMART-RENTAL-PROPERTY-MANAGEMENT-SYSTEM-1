package com.rental.rental_management_backend.notification.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.rental.rental_management_backend.notification.dto.NotificationCreateRequest;
import com.rental.rental_management_backend.notification.dto.NotificationResponse;
import com.rental.rental_management_backend.notification.dto.DeviceRegistrationResponse;
import com.rental.rental_management_backend.notification.dto.PushSubscriptionRequest;
import com.rental.rental_management_backend.notification.service.NotificationService;
import com.rental.rental_management_backend.notification.serviceImpl.DeviceSubscriptionService;
import com.rental.rental_management_backend.User.security.RentalUserDetails;

import jakarta.validation.Valid;

@RestController
@RequestMapping({"/api/notifications", "/api/v1/notifications"})
public class NotificationController {

    private final NotificationService notificationService;
    private final DeviceSubscriptionService deviceSubscriptionService;

    public NotificationController(
            NotificationService notificationService,
            DeviceSubscriptionService deviceSubscriptionService) {

        this.notificationService =
                notificationService;
        this.deviceSubscriptionService = deviceSubscriptionService;
    }

    @PostMapping("/register-device")
    @PreAuthorize(
            "hasAnyRole('SUPER_ADMIN','PROPERTY_OWNER','PROPERTY_MANAGER','TENANT')")
    public ResponseEntity<DeviceRegistrationResponse> registerDevice(
            @Valid @RequestBody PushSubscriptionRequest request,
            Authentication authentication) {
        Long userId = authenticatedUserId(authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(
                deviceSubscriptionService.register(userId, request));
    }

    @DeleteMapping("/devices/{deviceId}")
    @PreAuthorize(
            "hasAnyRole('SUPER_ADMIN','PROPERTY_OWNER','PROPERTY_MANAGER','TENANT')")
    public ResponseEntity<Void> removeDevice(
            @PathVariable Long deviceId,
            Authentication authentication) {
        deviceSubscriptionService.remove(
                authenticatedUserId(authentication),
                deviceId);
        return ResponseEntity.noContent().build();
    }

    private Long authenticatedUserId(Authentication authentication) {
        if (authentication == null
                || !(authentication.getPrincipal()
                        instanceof RentalUserDetails userDetails)
                || userDetails.getUserResponse().getId() == null) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Unable to identify authenticated user");
        }
        return userDetails.getUserResponse().getId();
    }

    // =========================================================
    // GET MY NOTIFICATIONS
    // =========================================================

    @GetMapping
    @PreAuthorize(
            "hasAnyRole(" +
            "'SUPER_ADMIN'," +
            "'PROPERTY_OWNER'," +
            "'PROPERTY_MANAGER'," +
            "'TENANT'" +
            ")"
    )
    public ResponseEntity<List<NotificationResponse>>
            getMyNotifications() {

        return ResponseEntity.ok(
                notificationService.getMyNotifications()
        );
    }

    // =========================================================
    // GET MY UNREAD NOTIFICATIONS
    // =========================================================

    @GetMapping("/unread")
    @PreAuthorize(
            "hasAnyRole(" +
            "'SUPER_ADMIN'," +
            "'PROPERTY_OWNER'," +
            "'PROPERTY_MANAGER'," +
            "'TENANT'" +
            ")"
    )
    public ResponseEntity<List<NotificationResponse>>
            getMyUnreadNotifications() {

        return ResponseEntity.ok(
                notificationService
                        .getMyUnreadNotifications()
        );
    }

    // =========================================================
    // UNREAD COUNT
    // =========================================================

    @GetMapping("/unread/count")
    @PreAuthorize(
            "hasAnyRole(" +
            "'SUPER_ADMIN'," +
            "'PROPERTY_OWNER'," +
            "'PROPERTY_MANAGER'," +
            "'TENANT'" +
            ")"
    )
    public ResponseEntity<Long> getUnreadCount() {

        return ResponseEntity.ok(
                notificationService.getMyUnreadCount()
        );
    }

    // =========================================================
    // MARK ONE AS READ
    // =========================================================

    @PatchMapping("/{notificationId}/read")
    @PreAuthorize(
            "hasAnyRole(" +
            "'SUPER_ADMIN'," +
            "'PROPERTY_OWNER'," +
            "'PROPERTY_MANAGER'," +
            "'TENANT'" +
            ")"
    )
    public ResponseEntity<Void> markAsRead(
            @PathVariable Long notificationId) {

        notificationService.markAsRead(
                notificationId
        );

        return ResponseEntity.noContent().build();
    }

    // =========================================================
    // MARK ALL AS READ
    // =========================================================

    @PatchMapping("/read-all")
    @PreAuthorize(
            "hasAnyRole(" +
            "'SUPER_ADMIN'," +
            "'PROPERTY_OWNER'," +
            "'PROPERTY_MANAGER'," +
            "'TENANT'" +
            ")"
    )
    public ResponseEntity<Void> markAllAsRead() {

        notificationService.markAllAsRead();

        return ResponseEntity.noContent().build();
    }

    // =========================================================
    // CREATE NOTIFICATION
    // Mainly for internal testing/admin use
    // =========================================================

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<NotificationResponse>
            createNotification(
                    @Valid
                    @RequestBody
                    NotificationCreateRequest request) {

        return ResponseEntity.ok(
                notificationService
                        .createNotification(request)
        );
    }
}