
package com.rental.rental_management_backend.notification.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rental.rental_management_backend.notification.entity.Notification;
import com.rental.rental_management_backend.notification.enums.NotificationType;

public interface NotificationRepository
        extends JpaRepository<Notification, Long> {

    List<Notification> findByUser_IdOrderByCreatedAtDesc(
            Long userId
    );

    List<Notification> findByUser_IdAndReadFalseOrderByCreatedAtDesc(
            Long userId
    );

    long countByUser_IdAndReadFalse(
            Long userId
    );

    boolean existsByUser_IdAndTypeAndReferenceIdAndReferenceType(
            Long userId,
            NotificationType type,
            Long referenceId,
            String referenceType
    );
}
