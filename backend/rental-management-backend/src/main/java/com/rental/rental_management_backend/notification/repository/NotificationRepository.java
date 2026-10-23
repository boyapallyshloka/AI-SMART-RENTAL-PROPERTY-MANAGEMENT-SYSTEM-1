
package com.rental.rental_management_backend.notification.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    Optional<Notification> findByDeduplicationKey(String deduplicationKey);

    @Modifying
    @Query(value = """
            INSERT INTO notifications (
                user_id,
                type,
                priority,
                title,
                message,
                reference_id,
                reference_type,
                deduplication_key,
                is_read,
                created_at
            )
            VALUES (
                :userId,
                :type,
                :priority,
                :title,
                :message,
                :referenceId,
                :referenceType,
                :deduplicationKey,
                false,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (deduplication_key) DO NOTHING
            """, nativeQuery = true)
    int insertIfDeduplicationKeyAbsent(
            @Param("userId") Long userId,
            @Param("type") String type,
            @Param("priority") String priority,
            @Param("title") String title,
            @Param("message") String message,
            @Param("referenceId") Long referenceId,
            @Param("referenceType") String referenceType,
            @Param("deduplicationKey") String deduplicationKey
    );
}
