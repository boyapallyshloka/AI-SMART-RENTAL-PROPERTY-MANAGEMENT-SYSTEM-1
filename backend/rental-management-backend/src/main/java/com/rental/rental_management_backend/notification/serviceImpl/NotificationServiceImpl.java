
package com.rental.rental_management_backend.notification.serviceImpl;

import java.util.List;
import java.util.Objects;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.notification.dto.NotificationCreateRequest;
import com.rental.rental_management_backend.notification.dto.NotificationResponse;
import com.rental.rental_management_backend.notification.entity.Notification;
import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;
import com.rental.rental_management_backend.notification.repository.NotificationRepository;
import com.rental.rental_management_backend.notification.service.NotificationService;
import com.rental.rental_management_backend.notification.service.NotificationSseService;

@Service
@Transactional
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final NotificationSseService notificationSseService;

    public NotificationServiceImpl(
            NotificationRepository notificationRepository,
            UserRepository userRepository,
            NotificationSseService notificationSseService) {

        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.notificationSseService = notificationSseService;
    }

    // CREATE NOTIFICATION
    @Override
    public NotificationResponse createNotification(
            NotificationCreateRequest request) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "Notification request cannot be null");
        }

        if (request.getUserId() == null) {
            throw new IllegalArgumentException(
                    "Notification user ID is required");
        }

        if (request.getType() == null) {
            throw new IllegalArgumentException(
                    "Notification type is required");
        }

        if (request.getPriority() == null) {
            throw new IllegalArgumentException(
                    "Notification priority is required");
        }

        if (request.getTitle() == null
                || request.getTitle().isBlank()) {
            throw new IllegalArgumentException(
                    "Notification title is required");
        }

        if (request.getMessage() == null
                || request.getMessage().isBlank()) {
            throw new IllegalArgumentException(
                    "Notification message is required");
        }

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException(
                        "User not found with ID: "
                                + request.getUserId()));

        Notification notification = new Notification(
                user,
                request.getType(),
                request.getPriority(),
                request.getTitle(),
                request.getMessage(),
                request.getReferenceId(),
                request.getReferenceType(),
                false
        );

        Notification savedNotification =
                notificationRepository.save(notification);

        NotificationResponse response =
                mapToResponse(savedNotification);

        // Deliver the notification immediately if the user
        // has an active SSE connection.
        notificationSseService.sendNotification(
                user.getId(),
                response
        );

        return response;
    }

    // GET ALL NOTIFICATIONS OF LOGGED-IN USER
    @Override
    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications() {

        User user = getLoggedInUser();

        return notificationRepository
                .findByUser_IdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    // GET UNREAD NOTIFICATIONS OF LOGGED-IN USER
    @Override
    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyUnreadNotifications() {

        User user = getLoggedInUser();

        return notificationRepository
                .findByUser_IdAndReadFalseOrderByCreatedAtDesc(
                        user.getId())
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    // GET UNREAD NOTIFICATION COUNT
    @Override
    @Transactional(readOnly = true)
    public long getMyUnreadCount() {

        User user = getLoggedInUser();

        return notificationRepository
                .countByUser_IdAndReadFalse(user.getId());
    }

    // MARK ONE NOTIFICATION AS READ
    // A user can mark only their own notification as read.
    @Override
    public void markAsRead(Long notificationId) {

        if (notificationId == null) {
            throw new IllegalArgumentException(
                    "Notification ID is required");
        }

        User user = getLoggedInUser();

        Notification notification = notificationRepository
                .findById(notificationId)
                .orElseThrow(() -> new RuntimeException(
                        "Notification not found with ID: "
                                + notificationId));

        // Return 403 when the notification belongs to another user.
        if (!Objects.equals(
                notification.getUser().getId(),
                user.getId())) {

            throw new AccessDeniedException(
                    "You are not authorized to access this notification");
        }

        notification.setRead(true);
        notificationRepository.save(notification);
    }

    // MARK ALL NOTIFICATIONS AS READ
    // Only notifications belonging to the logged-in user are updated.
    @Override
    public void markAllAsRead() {

        User user = getLoggedInUser();

        List<Notification> notifications =
                notificationRepository
                        .findByUser_IdOrderByCreatedAtDesc(
                                user.getId());

        notifications.forEach(notification ->
                notification.setRead(true));

        notificationRepository.saveAll(notifications);
    }

    // SEND NOTIFICATION TO A SPECIFIC USER
    // Used by Rental Agreement, Rent/Payment, Maintenance, etc.
    @Override
    public void notifyUser(
            Long userId,
            NotificationType type,
            NotificationPriority priority,
            String title,
            String message,
            Long referenceId,
            String referenceType) {

        if (userId == null) {
            throw new IllegalArgumentException(
                    "Recipient user ID is required");
        }

        NotificationCreateRequest request =
                new NotificationCreateRequest();

        request.setUserId(userId);
        request.setType(type);
        request.setPriority(priority);
        request.setTitle(title);
        request.setMessage(message);
        request.setReferenceId(referenceId);
        request.setReferenceType(referenceType);

        createNotification(request);
    }

    // GET LOGGED-IN USER
    private User getLoggedInUser() {

        if (SecurityContextHolder.getContext()
                .getAuthentication() == null) {

            throw new AccessDeniedException(
                    "No authenticated user found");
        }

        String email = SecurityContextHolder.getContext()
                .getAuthentication()
                .getName();

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException(
                        "Logged-in user not found"));
    }

    // CONVERT NOTIFICATION ENTITY TO RESPONSE DTO
    private NotificationResponse mapToResponse(
            Notification notification) {

        return new NotificationResponse(
                notification.getNotificationId(),
                notification.getType(),
                notification.getPriority(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getReferenceId(),
                notification.getReferenceType(),
                notification.isRead(),
                notification.getCreatedAt()
        );
    }
}