package com.rental.rental_management_backend.notification.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.notification.entity.UserDeviceToken;

public interface UserDeviceTokenRepository
        extends JpaRepository<UserDeviceToken, Long> {

    Optional<UserDeviceToken> findByEndpoint(String endpoint);

    List<UserDeviceToken> findByUser_IdAndActiveTrue(Long userId);

    Optional<UserDeviceToken> findByIdAndUser_Id(Long id, Long userId);

    @Modifying
    @Transactional
    @Query("""
            update UserDeviceToken token
            set token.active = false
            where token.id = :id and token.user.id = :userId
            """)
    int deactivateOwnedToken(
            @Param("id") Long id,
            @Param("userId") Long userId);

    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO user_device_tokens (
                user_id,
                endpoint,
                p256dh_key,
                auth_key,
                device_type,
                active,
                created_at,
                updated_at
            )
            VALUES (
                :userId,
                :endpoint,
                :p256dhKey,
                :authKey,
                :deviceType,
                true,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (endpoint) DO UPDATE
            SET p256dh_key = EXCLUDED.p256dh_key,
                auth_key = EXCLUDED.auth_key,
                device_type = EXCLUDED.device_type,
                active = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_device_tokens.user_id = EXCLUDED.user_id
            """, nativeQuery = true)
    int upsertOwnedEndpoint(
            @Param("userId") Long userId,
            @Param("endpoint") String endpoint,
            @Param("p256dhKey") String p256dhKey,
            @Param("authKey") String authKey,
            @Param("deviceType") String deviceType);
}
