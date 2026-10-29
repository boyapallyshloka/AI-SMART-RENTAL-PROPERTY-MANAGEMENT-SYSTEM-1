package com.rental.rental_management_backend.notification.entity;

import java.time.LocalDateTime;

import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.notification.enums.NotificationPriority;
import com.rental.rental_management_backend.notification.enums.NotificationType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(
        name = "notifications",
        indexes = {
                @Index(
                        name = "idx_notification_user",
                        columnList = "user_id"
                ),
                @Index(
                        name = "idx_notification_read",
                        columnList = "is_read"
                ),
                @Index(
                        name = "idx_notification_created",
                        columnList = "created_at"
                )
        }
)
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long notificationId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "user_id",
            nullable = false
    )
    private User user;

    @jakarta.persistence.Enumerated(
            jakarta.persistence.EnumType.STRING
    )
    @Column(
            name = "type",
            nullable = false,
            length = 50
    )
    private NotificationType type;

    @jakarta.persistence.Enumerated(
            jakarta.persistence.EnumType.STRING
    )
    @Column(
            name = "priority",
            nullable = false,
            length = 20
    )
    private NotificationPriority priority;

    @Column(
            name = "title",
            nullable = false,
            length = 150
    )
    private String title;

    @Column(
            name = "message",
            nullable = false,
            columnDefinition = "TEXT"
    )
    private String message;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(
            name = "reference_type",
            length = 50
    )
    private String referenceType;

    @Column(
            name = "is_read",
            nullable = false
    )
    private boolean read;

    @Column(
            name = "created_at",
            nullable = false
    )
    private LocalDateTime createdAt;

    // ============================================================
    // DEFAULT CONSTRUCTOR
    // Required by JPA
    // ============================================================

    public Notification() {
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    public Notification(
            User user,
            NotificationType type,
            NotificationPriority priority,
            String title,
            String message,
            Long referenceId,
            String referenceType,
            boolean read) {

        this.user = user;
        this.type = type;
        this.priority = priority;
        this.title = title;
        this.message = message;
        this.referenceId = referenceId;
        this.referenceType = referenceType;
        this.read = read;
    }

    // ============================================================
    // PRE PERSIST
    // ============================================================

    @PrePersist
    protected void onCreate() {

        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }

        if (priority == null) {
            priority = NotificationPriority.MEDIUM;
        }
    }

    // ============================================================
    // GETTERS
    // ============================================================

    public Long getNotificationId() {
        return notificationId;
    }

    public User getUser() {
        return user;
    }

    public NotificationType getType() {
        return type;
    }

    public NotificationPriority getPriority() {
        return priority;
    }

    public String getTitle() {
        return title;
    }

    public String getMessage() {
        return message;
    }

    public Long getReferenceId() {
        return referenceId;
    }

    public String getReferenceType() {
        return referenceType;
    }

    public boolean isRead() {
        return read;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    // ============================================================
    // SETTERS
    // ============================================================

    public void setNotificationId(Long notificationId) {
        this.notificationId = notificationId;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public void setType(NotificationType type) {
        this.type = type;
    }

    public void setPriority(NotificationPriority priority) {
        this.priority = priority;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public void setReferenceId(Long referenceId) {
        this.referenceId = referenceId;
    }

    public void setReferenceType(String referenceType) {
        this.referenceType = referenceType;
    }

    public void setRead(boolean read) {
        this.read = read;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}